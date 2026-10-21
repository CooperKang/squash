// public/data/*.json의 모양(scripts/fetch-data.mjs가 만든다)

export type Ranked = { rank: number; change: number; name: string; country: string; points: number; racket: string | null; picture: string | null; id: string }
export type Rankings = { updated: string; male: { top: Ranked[]; korea: Ranked[] }; female: { top: Ranked[]; korea: Ranked[] } }

export type MatchPlayer = { name: string; country: string | null; games: number; scores: number[] }
export type Match = { id: number; tournament: string; round: string; date: string; players: MatchPlayer[] }
export type Results = { updated: string; matches: Match[] }

export type PsaEvent = {
  id: number
  name: string
  start: string
  end: string
  location: string
  tier: string
  group: 'world' | 'challenger' | 'satellite' | 'other'
  prize: number
  draws: string[]
  link: string
  tv: boolean
}
export type Calendar = { updated: string; season: string; events: PsaEvent[] }

export type KsfEvent = {
  idx: string
  kind: '국내대회' | '국제대회' | '승인대회'
  status: string
  title: string
  start: string
  end: string
  venue: string
  host: string
  apply: string | null
  result?: string
}
export type KsfRanked = { rank: number; change: string; name: string; points: number; team: string }
export type Korea = { updated: string; events: KsfEvent[]; ranking: { men: KsfRanked[]; women: KsfRanked[] } }

/** 빌드 때 미리 그리는 화면에 넣을 데이터(브라우저에선 비어 있다) */
export const preloaded: Record<string, unknown> = {}

/** 이보다 오래 갱신되지 않은 파일은 수집이 멈춘 것으로 보고 보여주지 않는다 */
export const STALE_DAYS = 7

export function isStale(updated: string | undefined, now = Date.now()) {
  return !updated || now - Date.parse(updated) > STALE_DAYS * 864e5
}

export async function loadData<T>(name: string): Promise<T> {
  // 접속할 때마다 새로 받도록 캐시를 쓰지 않는다
  const res = await fetch(`${import.meta.env.BASE_URL}data/${name}?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

type RawResult = { matchId: number; tournament: string; round: string; date: string; players: { name?: string; flag?: string; games: number; scores: number[] }[] }

/** PSA 결과 API는 브라우저에서 바로 부를 수 있어서, 화면을 열 때 최신 경기를 한 번 더 받아 합친다 */
export async function loadLiveResults(): Promise<Match[]> {
  const res = await fetch('https://psa-api.ptsportsuite.com/results', { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`${res.status}`)
  const raw: RawResult[] = await res.json()
  return raw.map((m) => ({
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
}

export function mergeMatches(a: Match[], b: Match[]) {
  const map = new Map(a.map((m) => [m.id, m]))
  for (const m of b) map.set(m.id, m)
  return [...map.values()].sort((x, y) => y.date.localeCompare(x.date))
}

const COUNTRY: Record<string, string> = {
  KOR: '한국', EGY: '이집트', ENG: '잉글랜드', NZL: '뉴질랜드', PER: '페루', FRA: '프랑스', WAL: '웨일스', USA: '미국', MAS: '말레이시아',
  JPN: '일본', BEL: '벨기에', CAN: '캐나다', AUS: '호주', IND: '인도', PAK: '파키스탄', HKG: '홍콩', CHN: '중국', SCO: '스코틀랜드',
  ESP: '스페인', SUI: '스위스', GER: '독일', NED: '네덜란드', COL: '콜롬비아', MEX: '멕시코', RSA: '남아공', QAT: '카타르', KUW: '쿠웨이트',
  CZE: '체코', POR: '포르투갈', ITA: '이탈리아', IRL: '아일랜드', SWE: '스웨덴', FIN: '핀란드', UKR: '우크라이나', HUN: '헝가리',
  ARG: '아르헨티나', BRA: '브라질', SGP: '싱가포르', PHI: '필리핀', TPE: '대만', MON: '모나코', DEN: '덴마크', AUT: '오스트리아',
  KAZ: '카자흐스탄', ROU: '루마니아', SRI: '스리랑카', GUA: '과테말라', CHI: '칠레', ECU: '에콰도르', ISR: '이스라엘', JOR: '요르단', BRN: '바레인', NOR: '노르웨이', BAR: '바베이도스',
}

export function countryName(code: string | null) {
  if (!code) return ''
  return COUNTRY[code] ?? code
}

const TIER_KO: Record<string, string> = {
  Diamond: '다이아몬드',
  Platinum: '플래티넘',
  Gold: '골드',
  Silver: '실버',
  Bronze: '브론즈',
  Copper: '코퍼',
}

export function tierLabel(tier: string) {
  return tier
    .split(' · ')
    .map((t) => TIER_KO[t] ?? t.replace('Challenger', '챌린저').replace('Satellite', '새틀라이트').replace('Federation', '연맹 주관'))
    .join(' · ')
}

/** YYYY-MM-DD 날짜를 오늘과 비교 */
export function eventState(start: string, end: string, today = localToday()) {
  if (today < start) return { state: 'upcoming' as const, days: daysBetween(today, start) }
  if (today > end) return { state: 'done' as const, days: daysBetween(end, today) }
  return { state: 'live' as const, days: 0 }
}

export function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 864e5)
}

export function dateRange(start: string, end: string) {
  const f = (s: string) => `${Number(s.slice(5, 7))}.${Number(s.slice(8, 10))}`
  return start === end ? f(start) : `${f(start)} – ${f(end)}`
}

export function ago(iso: string) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  if (min < 60 * 24) return `${Math.round(min / 60)}시간 전`
  return `${Math.round(min / 60 / 24)}일 전`
}

const ROUND_KO: Record<string, string> = {
  final: '결승',
  semifinal: '준결승',
  quarterfinal: '8강',
}

export function roundLabel(r: string) {
  const key = r.toLowerCase().replace(/[\s-]/g, '')
  if (ROUND_KO[key]) return ROUND_KO[key]
  const m = /Round (\d+)/i.exec(r)
  return m ? `${m[1]}회전` : r
}

export type Video = { id: string; title: string; published: string }
export type Videos = { updated: string; channel: string; videos: Video[] }

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/**
 * 경기와 SQUASHTV 하이라이트 영상을 잇는다.
 * 제목에 두 선수의 성이 모두 있고(“Asal v Elias | … | FINAL HIGHLIGHTS”), 경기 뒤 6일 안에 올라온 영상.
 */
export function findVideo(m: Match, videos: Video[]): Video | null {
  if (m.players.length < 2 || m.players.some((p) => !p.name || p.name === '미정')) return null
  const surnames = m.players.map((p) => fold(p.name.trim().split(/\s+/).at(-1)!))
  const at = Date.parse(m.date)
  const hits = videos.filter((v) => {
    const t = fold(v.title)
    if (!/\bvs?\.?\b/.test(t)) return false
    const dt = Date.parse(v.published) - at
    if (dt < -12 * 3600e3 || dt > 6 * 864e5) return false
    return surnames.every((s) => new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t))
  })
  // 하이라이트 영상을 프리뷰·분석 영상보다 먼저
  return hits.find((v) => /highlight/i.test(v.title)) ?? hits[0] ?? null
}

export function youtubeSearch(q: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
}
