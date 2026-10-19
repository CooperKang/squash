// 대회 현황판 데이터를 모아 public/data/*.json으로 쓴다.
// GitHub Actions가 몇 시간마다 실행하고, 화면은 접속할 때마다 이 파일을 새로 읽는다.
// 한 출처가 실패하면 지금 배포된 파일(그것도 없으면 저장소의 초기 파일)을 그대로 둔다.
import { readFile, writeFile } from 'node:fs/promises'
import { courts } from './fetch-courts.mjs'

const OUT = new URL('../public/data/', import.meta.url)
const LIVE = 'https://cooperkang.github.io/squash/data/'
const PSA_API = 'https://psa-api.ptsportsuite.com'
const PSA_WP = 'https://www.psasquashtour.com/wp-json/wp/v2'
const KSF = 'http://www.koreasquash.or.kr'
const UA = { 'User-Agent': 'squash-court-dashboard (+https://cooperkang.github.io/squash/)' }

const now = new Date()
const today = now.toISOString().slice(0, 10)

async function get(url, as = 'json') {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  if (as === 'json') return res.json()
  if (as === 'euc-kr') return new TextDecoder('euc-kr').decode(await res.arrayBuffer())
  return res
}

async function previous(name) {
  try {
    return await get(LIVE + name)
  } catch {
    try {
      return JSON.parse(await readFile(new URL(name, OUT), 'utf8'))
    } catch {
      return null
    }
  }
}

async function save(name, data) {
  await writeFile(new URL(name, OUT), JSON.stringify({ updated: now.toISOString(), ...data }, null, 1) + '\n')
  console.log(`✓ ${name}`)
}

// ---------- PSA 세계 랭킹 ----------

// 'tecnifibre', 'Head.'처럼 제각각인 표기를 맞춘다
function racketBrand(raw) {
  const s = (raw ?? '').trim().replace(/[.\s]+$/, '')
  if (/^(unknown|none|n\/a|-)?$/i.test(s)) return null
  return (s.charAt(0).toUpperCase() + s.slice(1)).replace(/^Technifibre/, 'Tecnifibre')
}

async function rankings() {
  const pick = (p) => ({
    rank: Number(p['World Ranking']),
    change: Number(p['World Ranking Change']) || 0,
    name: p.Name,
    country: p.Country,
    points: Math.round(Number(p['Total Points'])),
    racket: racketBrand(p['Racket Sponsor']),
    picture: p.Mugshot || p.Picture || null,
    id: p.Id,
  })
  const out = {}
  for (const sex of ['male', 'female']) {
    const list = (await get(`${PSA_API}/rankedplayers/${sex}`)).filter((p) => Number(p['World Ranking']) > 0)
    list.sort((a, b) => Number(a['World Ranking']) - Number(b['World Ranking']))
    out[sex] = {
      top: list.slice(0, 20).map(pick),
      korea: list.filter((p) => p.Country === 'KOR').slice(0, 10).map(pick),
    }
  }
  return out
}

// ---------- PSA 최근 결과(최근 1주일치만 주므로 지난 결과와 합친다) ----------

async function results(prev) {
  const fresh = (await get(`${PSA_API}/results`)).map((m) => ({
    id: m.matchId,
    tournament: m.tournament,
    round: m.round,
    date: m.date,
    players: m.players.map((p) => ({
      name: p.name || '미정',
      country: p.flag?.match(/\/([A-Z]{3})\.png/)?.[1] ?? null,
      games: p.games,
      scores: p.scores,
    })),
  }))
  const byId = new Map((prev?.matches ?? []).map((m) => [m.id, m]))
  for (const m of fresh) byId.set(m.id, m)
  const matches = [...byId.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 400)
  return { matches }
}

// ---------- PSA 대회 일정 ----------

async function calendar() {
  const seasons = await get(`${PSA_WP}/tournament-season?per_page=100&_fields=id,name`)
  const y = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const season = seasons.find((s) => s.name === `${y}/${y + 1}`)
  if (!season) throw new Error(`no season ${y}/${y + 1}`)

  const levels = await get(`${PSA_WP}/tournament-level?per_page=100&_fields=id,name,parent`)
  const more = await get(`${PSA_WP}/tournament-level?per_page=100&page=2&_fields=id,name,parent`).catch(() => [])
  const terms = new Map([...levels, ...more].map((t) => [t.id, t]))
  const label = (id) => {
    const t = terms.get(id)
    if (!t) return null
    const parent = terms.get(t.parent)
    if (!parent || parent.name === 'World' || t.name.startsWith(parent.name)) return t.name
    return `${parent.name} ${t.name}`
  }

  const events = []
  for (let page = 1; page < 10; page++) {
    const res = await get(
      `${PSA_WP}/tournament?tournament-season=${season.id}&per_page=100&page=${page}&_fields=id,link,title,meta,tournament-level`,
      'raw',
    )
    const list = await res.json()
    for (const t of list) {
      const m = t.meta ?? {}
      if (m.hidden) continue
      let comps = []
      try {
        comps = JSON.parse(m.competitions || '[]')
      } catch {
        comps = []
      }
      const d = (s) => (s && s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null)
      const tier = [...new Set((t['tournament-level'] ?? []).map(label).filter(Boolean))].join(' · ')
      events.push({
        id: t.id,
        name: decode(t.title.rendered),
        start: d(m.start_date),
        end: d(m.end_date) ?? d(m.start_date),
        location: (m.location || '').replace(/^null,\s*/, '').replace(/^\s*,\s*$/, '').trim(),
        tier,
        group: groupOf(tier, decode(t.title.rendered)),
        prize: comps.reduce((s, c) => s + (Number(c.prize_total) || 0), 0),
        draws: comps.map((c) => (/wom/i.test(c.name) ? 'W' : /men/i.test(c.name) ? 'M' : c.name)),
        link: t.link,
        tv: Boolean(m.squashtv),
      })
    }
    if (page >= Number(res.headers.get('x-wp-totalpages') || 1)) break
  }
  // 같은 대회가 두 번 올라온 경우 장소가 적힌 쪽을 남긴다
  const seen = new Map()
  for (const e of events) {
    const key = `${e.name}|${e.start}`
    const old = seen.get(key)
    if (!old || (!old.location.replace(/[ ,]/g, '') && e.location)) seen.set(key, e)
  }
  const from = new Date(now.getTime() - 14 * 864e5).toISOString().slice(0, 10)
  const until = new Date(now.getTime() + 120 * 864e5).toISOString().slice(0, 10)
  return {
    season: season.name,
    events: [...seen.values()].filter((e) => e.start && e.end >= from && e.start <= until).sort((a, b) => a.start.localeCompare(b.start)),
  }
}

// 월드 투어(다이아몬드~코퍼), 챌린저, 새틀라이트, 그 밖(협회·주니어 대회)
function groupOf(tier, name) {
  if (/^World (Teams|Championship)/.test(name)) return 'world'
  if (/Diamond|Platinum|Gold|Silver|Bronze|Copper|World Championship|World Open|World Teams|World Series/.test(tier)) return 'world'
  if (/Challenger/.test(tier)) return 'challenger'
  if (/Satellite/.test(tier)) return 'satellite'
  return 'other'
}

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
}

// ---------- 대한스쿼시연맹 ----------

// EUC-KR로 인코딩한 검색어(연맹 사이트는 EUC-KR만 알아듣는다)
const KR = {
  domestic: '%B1%B9%B3%BB%B4%EB%C8%B8', // 국내대회
  international: '%B1%B9%C1%A6%B4%EB%C8%B8', // 국제대회
  approved: '%BD%C2%C0%CE%B4%EB%C8%B8', // 승인대회
  men: '%B3%B2',
  women: '%BF%A9',
  open: '%C0%CF%B9%DD%BA%CE', // 일반부
}

const strip = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

async function ksfEvents() {
  const years = [now.getFullYear()]
  if (now.getMonth() >= 10) years.push(now.getFullYear() + 1)
  const events = []
  for (const yy of years) {
    for (const [kind, code] of [
      ['국내대회', KR.domestic],
      ['국제대회', KR.international],
      ['승인대회', KR.approved],
    ]) {
      const html = await get(`${KSF}/competition_list.asp?inOut=${code}&yy=${yy}`, 'euc-kr')
      for (const [, dt, dd] of html.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)) {
        const pick = (re, s) => re.exec(s)?.[1]?.trim() ?? ''
        const title = strip(pick(/<span class="title">([\s\S]*?)<\/span>/, dt))
        if (!title || title.includes('[취소]')) continue
        const fields = Object.fromEntries(
          [...dd.matchAll(/<span class="name">([\s\S]*?)<\/span>\s*<span class="text">([\s\S]*?)<\/span>/g)].map((m) => [strip(m[1]), strip(m[2])]),
        )
        const date = pick(/<span class="date">([\s\S]*?)<\/span>/, dt)
        const [start, end] = date.match(/\d{4}-\d{2}-\d{2}/g) ?? []
        if (!start) continue
        events.push({
          idx: pick(/openLayer2\('schedule-detail', (\d+)\)/, dd),
          kind,
          status: strip(pick(/<span class="ico">([\s\S]*?)<\/span>/, dt)),
          title,
          start,
          end: end ?? start,
          venue: fields['장소'] ?? '',
          host: fields['주최'] ?? '',
          apply: pick(/urlLink\('([^']*)'\);">참가신청/, dd) || null,
        })
      }
    }
  }
  const unique = [...new Map(events.map((e) => [e.idx || e.title, e])).values()].sort((a, b) => a.start.localeCompare(b.start))

  // 끝난 대회 중 최근 것들은 결과 PDF 주소를 붙인다
  const recent = unique.filter((e) => e.end < today && e.idx).slice(-8)
  for (const e of recent) {
    try {
      const res = await get(`${KSF}/competition_filelink.asp?idx=${e.idx}&kind=3`, 'raw')
      const bytes = new Uint8Array(await res.arrayBuffer())
      const path = percentBytes(bytes)
      if (path) e.result = KSF + path
    } catch {
      // 결과 파일이 없으면 넘어간다
    }
  }
  return { events: unique }
}

// {"file":"/matchData/result/<EUC-KR 파일명>.pdf"}에서 경로를 바이트 그대로 퍼센트 인코딩
function percentBytes(bytes) {
  const text = new TextDecoder('latin1').decode(bytes)
  const m = /"file"\s*:\s*"([^"]+)"/.exec(text)
  if (!m || !m[1].startsWith('/')) return null
  return [...m[1]]
    .map((ch) => {
      const c = ch.charCodeAt(0)
      return c < 0x80 && /[A-Za-z0-9/._-]/.test(ch) ? ch : `%${c.toString(16).toUpperCase().padStart(2, '0')}`
    })
    .join('')
}

async function ksfRanking() {
  const out = {}
  for (const [sex, code] of [
    ['men', KR.men],
    ['women', KR.women],
  ]) {
    const html = await get(`${KSF}/ranking.asp?sex=${code}&kind=${KR.open}`, 'euc-kr')
    out[sex] = [...html.matchAll(/<th>(\d+)<\/th>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>/g)]
      .slice(0, 10)
      .map((m) => ({ rank: Number(m[1]), change: strip(m[2]), name: strip(m[3]), points: Number(strip(m[4])) || 0, team: strip(m[5]) }))
  }
  return out
}

// ---------- PSA 공식 유튜브(SQUASHTV) 영상 ----------

// 채널 RSS는 키 없이 최근 15개만 주므로, 실행할 때마다 지난 목록과 합쳐 쌓는다
const SQUASHTV = 'UCklie6BM0fhFvzWYqQVoCTA'

async function videos(prev) {
  const res = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${SQUASHTV}`, 'raw')
  const xml = await res.text()
  const fresh = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    id: /<yt:videoId>([^<]+)/.exec(e)?.[1],
    title: decode(/<title>([^<]*)/.exec(e)?.[1] ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
    published: /<published>([^<]+)/.exec(e)?.[1],
  }))
  if (fresh.length === 0) throw new Error('empty feed')
  const byId = new Map((prev?.videos ?? []).map((v) => [v.id, v]))
  for (const v of fresh) if (v.id) byId.set(v.id, v)
  return { channel: SQUASHTV, videos: [...byId.values()].sort((a, b) => b.published.localeCompare(a.published)).slice(0, 300) }
}

// ---------- 실행 ----------

const jobs = [
  ['rankings.json', async () => rankings()],
  ['results.json', async () => results(await previous('results.json'))],
  ['calendar.json', async () => calendar()],
  ['videos.json', async () => videos(await previous('videos.json'))],
  ['korea.json', async () => ({ ...(await ksfEvents()), ranking: await ksfRanking() })],
  ['courts.json', async () => courts(await previous('courts.json'))],
]

let failed = 0
for (const [name, job] of jobs) {
  try {
    await save(name, await job())
  } catch (err) {
    failed++
    console.warn(`✗ ${name}: ${err.message}`)
    const prev = await previous(name)
    if (prev) {
      await writeFile(new URL(name, OUT), JSON.stringify(prev, null, 1) + '\n')
      console.warn(`  지난 파일(${prev.updated ?? '시각 모름'})을 그대로 씁니다`)
    }
  }
}
if (failed === jobs.length) process.exitCode = 1
