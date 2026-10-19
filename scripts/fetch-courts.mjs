// 전국 스쿼시 코트 현황을 모아 public/data/courts.json으로 쓴다.
//
// 출처: 스쿼시 센터(코트) 안내 https://www.squash.pe.kr (운영자 홍석표)
//  - 첫 화면 지도에 전국 센터의 이름·주소·좌표가 한 번에 들어 있어, 요청 한 번으로 목록을 새로 받는다.
//  - 코트 수·전화·SNS·안내 문구는 센터별 상세 페이지에만 있으므로, 지난 파일에 없는 새 센터만
//    한 번에 MAX_DETAILS개까지, 요청 사이 DELAY_MS를 두고 받는다. (robots.txt: /bbs/board.php 허용,
//    /bbs/link.php·/adm/·/phpqrcode/codegen.php 금지 → 외부 링크 리다이렉터 link.php는 열지 않는다)
//  - 샤워·화장실·주차·락커, 수용 인원은 출처에 항목이 없다. 안내 문구에 분명히 적힌 경우만 표시하고
//    나머지는 null(모름)로 둔다.
//
// 단독 실행: node scripts/fetch-courts.mjs
// 다른 스크립트에서: import { courts } from './fetch-courts.mjs'; await courts(previousJson)
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const SITE = 'https://www.squash.pe.kr'
const BOARD = `${SITE}/bbs/board.php?bo_table=KoreaSquashCourt`
const OUT = new URL('../public/data/courts.json', import.meta.url)
const SEED = new URL('../public/data/courts.json', import.meta.url)
const LIVE = 'https://cooperkang.github.io/squash/data/courts.json'
const UA = { 'User-Agent': 'squash-court-dashboard (+https://cooperkang.github.io/squash/)' }
const MAX_DETAILS = 40
const DELAY_MS = 1200

export const SOURCES = [
  {
    name: '스쿼시 센터(코트) 안내 (squash.pe.kr)',
    url: SITE + '/',
    note: '전국 센터 목록·주소·좌표·코트 수·전화. 개인 운영 사이트(Copyright © 홍석표). 각 레코드의 source에 원문 링크.',
  },
  {
    name: '대한스쿼시연맹 공인스쿼시코트현황',
    url: 'http://www.koreasquash.or.kr/squash07.asp',
    note: '연맹 공인 코트 이름·전화·주소. squash.pe.kr에 없는 곳만 보탬(좌표·코트 수 없음).',
  },
]

// ---------- 지역 ----------

const REGIONS = [
  [/^서울/, '서울'], [/^부산/, '부산'], [/^대구/, '대구'], [/^인천/, '인천'], [/^광주광역시/, '광주'],
  [/^대전/, '대전'], [/^울산/, '울산'], [/^세종/, '세종'], [/^경기/, '경기'], [/^강원/, '강원'],
  [/^충(청)?북/, '충북'], [/^충(청)?남/, '충남'], [/^전(라)?북|^전북/, '전북'], [/^전(라)?남/, '전남'],
  [/^경(상)?북/, '경북'], [/^경(상)?남/, '경남'], [/^제주/, '제주'],
]

// '전남광주통합특별시'처럼 바뀐 행정구역 이름도 17개 시·도 약칭으로 맞춘다.
// 통합특별시 주소는 자치구(…구)면 옛 광주광역시, 시·군이면 옛 전라남도로 본다.
// '강원특별자치도삼척시'처럼 시·도 뒤 띄어쓰기가 빠진 주소를 고친다
export const tidyAddress = (a) =>
  (a ?? '').trim().replace(/^(\S*?(?:특별자치도|특별자치시|특별시|광역시|통합특별시|도))(?=[가-힣])/, '$1 ')

export function regionOf(address) {
  const a = tidyAddress(address)
  const [first, second = ''] = a.split(/\s+/)
  if (/광주/.test(first) && /전남|전라남/.test(first)) return /구$/.test(second) ? '광주' : '전남'
  for (const [re, r] of REGIONS) if (re.test(first)) return r
  return null
}

// 시·군·구. '청주시 흥덕구'처럼 일반구가 있으면 둘 다, 세종은 시 자체가 기초 단위라 null.
export function districtOf(address) {
  const parts = tidyAddress(address).split(/\s+/)
  if (/^세종/.test(parts[0] ?? '')) return null
  const [a, b] = parts.slice(1, 3)
  if (!a || !/(시|군|구)$/.test(a)) return null
  if (/시$/.test(a) && b && /구$/.test(b)) return `${a} ${b}`
  return a
}

// ---------- 공공/민간, 이용 대상 제한 ----------
// 출처에 운영 주체·이용 대상 항목이 없어 이름으로만 가른다(추정). 틀릴 수 있으니 화면에서 '추정'으로 보여 줄 것.

// 지자체·시설공단·교육청·국공립 기관이 운영하는 것으로 읽히는 이름
const PUBLIC_NAME = new RegExp(
  [
    '국민체육센터', '구민', '시민체육', '군민', '도민', '시설관리', '환경공단', '청소년\\s*수련', '종합운동장',
    '종합\\s*스포츠\\s*(타운|파크)', '복합스포츠타운', '체육문화', '문화체육', '체육회관', '복합체육센터',
    '생활체육센터', '다목적체육센터', '실내체육관', '종합체육관', '어울림체육관', '교육(지원)?청', '레포츠타운',
    '레포츠공원', '스쿼시\\s*경기장', '열우물', '구민회관', '도청', '국립', '도립', '시립', '복합커뮤니티센터',
    '평생학습관', '종합사회복지관', '복합혁신센터', '고원체육관', '고양\\s*체육관', '하늘내린', '민둥산', '쇠부리',
    '체육센터', '부산대학교', '충북대학교', '강원대학교', '서울대학교', '인천대학교', '과학기술원', 'DGIST',
    '한국기술교육대학교', '폴리텍', '마산합포\\s*스포츠', '의창스포츠', '성산스포츠',
  ].join('|'),
)
// 아파트 입주민·임직원·재학생·군 등 일반인 이용이 어려워 보이는 이름
const RESTRICTED_NAME = new RegExp(
  [
    '아파트', '(?<!복합)커뮤니티\\s*(센터|홀)', '커뮤니센터', '빌리지', '타운하우스', '사택', 'S클래스', '롯데캐슬', '드림캐슬',
    '자이', '힐스테이트', '아이파크 삼성동', '노블랜드', '메가시티', '에코타운', '쉐르빌', '현진에버빌', '리츠빌',
    '삼성전자', 'SK하이닉스', 'SK텔레콤', 'LG화학', '현대기아', '기아자동차', '삼성중공업', '동국제강', '이녹스',
    '위델소재', '서연이화', 'KT\\s', 'KT&G', '한국도로공사', '한국토지주택공사', '한울원자력', '포스코 한마당',
    '육군', '선수촌', '고등학교', '초등학교', '중등센터', '국제학교', '스쿼시부', '드리미학교', '외교관',
    '카지노', '인재개발원', '연수원', '생활관', '병원', '기술연구', '연구소', '삼성노블카운티', '대덕비즈센터',
    '유틸리티센터', '국립 중앙 청소년 수련원',
  ].join('|'),
)
export function typeOf(name) {
  const n = name ?? ''
  if (/호텔|리조트|피트니스|휘트니스|클럽|짐|GYM|아카데미|아파트/i.test(n) && !/국민체육센터/.test(n)) return '민간'
  // 대학은 국공립(위 목록에 이름이 있는 곳)만 공공
  const university = /대학교?|대학$/.test(n)
  const nationalUniv = /국립|도립|시립|부산대학교|충북대학교|강원대학교|서울대학교|인천대학교|과학기술원|DGIST|한국기술교육대학교|폴리텍|부산대학교병원/.test(n)
  if (university && !nationalUniv) return '민간'
  return PUBLIC_NAME.test(n) ? '공공' : '민간'
}
export function restrictedOf(name) {
  const n = name ?? ''
  return RESTRICTED_NAME.test(n) && !/아파트먼트/.test(n)
}

// ---------- 안내 문구에서 분명히 적힌 것만 ----------

function flag(text, yes, no) {
  if (!text) return null
  if (no && no.test(text)) return false
  if (yes.test(text)) return true
  return null
}

export function facilitiesOf(text) {
  return {
    shower: flag(text, /샤워/, /샤워(실|장)?\s*(없|불가|미운영)/),
    toilet: flag(text, /화장실/, /화장실\s*(없|불가)/),
    parking: flag(text, /주차\s*(가능|무료|지원|장|시설|\d)/, /주차\s*(불가|없|공간\s*없)/),
    locker: flag(text, /락커|라커|사물함|탈의실/, /(락커|라커|사물함)\s*(없|불가)/),
  }
}

// 조건이 붙는 경우가 많아('클래스 참가생만 대관 신청 가능' 등) 판정하지 않고 해당 문장을 그대로 옮긴다.
export function rentalOf(text) {
  if (!text) return null
  if (!/대관|일일\s*(입장|이용|권)|1일\s*(입장|이용|권)|자유\s*(이용|운동)|개인\s*운동/.test(text)) return null
  return text.length > 160 ? text.slice(0, 159) + '…' : text
}

// '단식코트 : 3', '단식코트 : 2 / 복식코트 (가변형 포함) : 1 / 틴보드 : 48cm' 등. 코트 숫자만 더한다. 숫자가 없으면 null.
export function courtsOf(text) {
  if (!text) return null
  const nums = [...text.matchAll(/코트(?:\s*\([^)]*\))?\s*:\s*(\d+)/g)].map((m) => Number(m[1]))
  if (!nums.length) return null
  const sum = nums.reduce((a, b) => a + b, 0)
  return sum > 0 ? sum : null
}

// ---------- HTML 파싱 ----------

const decode = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
const text = (s) => decode((s ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

// 첫 화면의 var positions = [...] (카카오맵 마커 목록)
export function parseHome(html) {
  const start = html.indexOf('var positions = [')
  if (start < 0) throw new Error('positions 목록을 찾지 못함')
  const body = html.slice(start, html.indexOf('];', start))
  const re =
    /linkurl\s*:\s*'([^']*)'([\s\S]*?)imageRsc\s*:\s*(\w+)\s*,\s*latlng:\s*new kakao\.maps\.LatLng\(\s*([\d.]+)\s*,\s*([\d.]+)\)/g
  const out = []
  for (const [, link, content, img, lat, lng] of body.matchAll(re)) {
    const c = [...content.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]).join('')
    const title = c.match(/class="title">([\s\S]*?)<div class="close"/)
    const desc = c.match(/class="ellipsis">([\s\S]*?)<\/div>/)
    const parts = desc ? desc[1].split(/<br\s*\/?>/i).map(text) : []
    const id = Number(link.match(/wr_id=(\d+)/)?.[1])
    if (!id) continue
    out.push({
      id,
      name: text(title?.[1] ?? ''),
      address: parts.length > 1 ? parts.at(-1) : (parts[0] ?? ''),
      planned: img !== 'imageSrc',
      lat: Number(lat),
      lng: Number(lng),
    })
  }
  return out
}

function cell(html, label) {
  const re = new RegExp(
    `<td class="board_table_td_L">\\s*${label}[\\s\\S]*?</td>\\s*<td class="board_table_td_R"[^>]*>([\\s\\S]*?)</td>`,
  )
  return html.match(re)?.[1] ?? null
}

export function parseDetail(raw) {
  const html = raw.replace(/<script[\s\S]*?<\/script>/g, '')
  const sns = cell(html, 'SNS') ?? ''
  const links = [...sns.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => decode(m[1])).filter((u) => !u.includes('squash.pe.kr'))
  const info = html.match(/<div id="bo_v_con">([\s\S]*?)<\/div>\s*<!-- } 본문/)?.[1]
  const phone = text(cell(html, '전화번호'))
  return {
    phone: phone || null,
    courtText: text(cell(html, '코트 정보')) || null,
    links,
    info: info ? text(info) || null : null,
  }
}

// ---------- 레코드 ----------

export function record(m, d) {
  const info = d?.info ?? null
  return {
    id: `sqpe-${m.id}`,
    name: m.name,
    region: regionOf(m.address),
    district: districtOf(m.address),
    address: tidyAddress(m.address) || null,
    lat: m.lat ?? null,
    lng: m.lng ?? null,
    courts: courtsOf(d?.courtText),
    capacity: null, // 출처에 수용 인원 항목이 없다
    facilities: facilitiesOf(info),
    rental: rentalOf(info),
    type: typeOf(m.name),
    restricted: restrictedOf(m.name),
    phone: d?.phone ?? null,
    link: d?.links?.[0] ?? null,
    source: `${BOARD}&wr_id=${m.id}`,
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(url, encoding = 'utf-8') {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return new TextDecoder(encoding).decode(await res.arrayBuffer())
}

// ---------- 대한스쿼시연맹 공인 스쿼시코트 현황 ----------
// squash.pe.kr에 없는 공인 코트만 보탠다 (좌표·코트 수 없음).

export const KSF_URL = 'http://www.koreasquash.or.kr/squash07.asp'
const KSF_REGION = { 전라북: '전북', 전라남: '전남', 충청북: '충북', 충청남: '충남', 경상북: '경북', 경상남: '경남' }

export function parseKsf(raw) {
  const html = raw.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
  const out = []
  let region = null
  for (const [, tr] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const tds = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => text(m[1]))
    if (tds[0] === '시도명') continue
    if (tds.length === 4) {
      const r = tds.shift()
      region = KSF_REGION[r] ?? r
    }
    if (tds.length !== 3 || !tds[0]) continue
    const [name, phone, address] = tds
    out.push({ region, name, phone: /\d/.test(phone) ? phone : null, address })
  }
  return out
}

const digits = (s) => (s ?? '').replace(/\D/g, '')
const squeeze = (s) => (s ?? '').replace(/\(.*?\)|舊|구\s|스쿼시장?|경기장|\s/g, '').toLowerCase()

function ksfRecord(k, i) {
  // 주소가 '강서구 …', '인천 서구 …'처럼 시·도가 빠지거나 줄어 있다
  const parts = k.address.split(/\s+/)
  const first = regionOf(k.address) ? parts.slice(1) : parts
  const district = /(시|군|구)$/.test(first[0] ?? '')
    ? /시$/.test(first[0]) && /구$/.test(first[1] ?? '') ? `${first[0]} ${first[1]}` : first[0]
    : null
  return {
    id: `ksf-${i + 1}`,
    name: k.name,
    region: k.region,
    district: k.region === '세종' ? null : district,
    address: k.address,
    lat: null,
    lng: null,
    courts: null,
    capacity: null,
    facilities: { shower: null, toilet: null, parking: null, locker: null },
    rental: null,
    type: typeOf(k.name),
    restricted: restrictedOf(k.name),
    phone: k.phone,
    link: null,
    source: KSF_URL,
  }
}

// '남부로 224', '한나루로201번길 19' 같은 도로명+건물번호 (같은 시·도 안에서만 비교)
const roadKey = (a) => {
  const m = (a ?? '').match(/([가-힣A-Za-z0-9]+(?:로|길))\s*(\d+(?:-\d+)?)/)
  return m ? `${m[1]} ${m[2]}` : null
}

export function mergeKsf(list, ksf) {
  const phones = new Set(list.map((c) => digits(c.phone)).filter((p) => p.length >= 9))
  const roads = new Set(list.map((c) => c.region + ' ' + roadKey(c.address)).filter((r) => !r.endsWith('null')))
  const names = list.map((c) => squeeze(c.name))
  const extra = []
  ksf.forEach((k, i) => {
    const p = digits(k.phone)
    if (p.length >= 9 && phones.has(p)) return
    if (roadKey(k.address) && roads.has(k.region + ' ' + roadKey(k.address))) return
    const n = squeeze(k.name)
    if (n.length >= 2 && names.some((x) => x && (x.includes(n) || n.includes(x)))) return
    extra.push(ksfRecord(k, i))
  })
  return extra
}

// prev: 지난 courts.json (없으면 null). 반환값은 { asOf, sources, courts } (updated는 호출하는 쪽에서).
// opts.fetchText(url, encoding)로 가져오는 방법을 바꿀 수 있다 (스냅숏을 캐시에서 만들 때).
export async function courts(prev, opts = {}) {
  const fetchText = opts.fetchText ?? get
  const delay = opts.delay ?? DELAY_MS
  const maxDetails = opts.maxDetails ?? MAX_DETAILS
  const markers = parseHome(await fetchText(SITE + '/'))
  if (markers.length < 100) throw new Error(`센터가 ${markers.length}곳뿐이라 목록이 깨진 것으로 봄`)
  const known = new Map((prev?.courts ?? []).map((c) => [c.id, c]))

  // 지난번에 상세를 못 받은 센터(pending)는 다시 시도한다
  const pendingBefore = new Set(prev?.pending ?? [])
  let fetched = 0
  const list = []
  const pending = []
  for (const m of markers) {
    if (m.planned || /^\[예정\]/.test(m.name)) continue // 건립 예정지는 뺀다
    const id = `sqpe-${m.id}`
    const old = known.get(id)
    if (old && !pendingBefore.has(id) && !process.env.COURTS_REFRESH_ALL) {
      // 상세에서 온 값은 지난 것을 그대로, 목록에서 온 이름·주소·좌표·지역만 새로
      const fresh = record(m, null)
      list.push({ ...old, name: fresh.name, region: fresh.region, district: fresh.district, address: fresh.address, lat: fresh.lat, lng: fresh.lng, type: fresh.type, restricted: fresh.restricted })
      continue
    }
    let d = null
    if (fetched < maxDetails) {
      fetched++
      try {
        d = parseDetail(await fetchText(`${BOARD}&wr_id=${m.id}`))
      } catch (err) {
        console.warn(`  상세 실패 ${m.id}: ${err.message}`)
      }
      if (delay) await sleep(delay)
    }
    if (!d) pending.push(id)
    list.push(record(m, d))
  }

  let ksfExtra = []
  try {
    ksfExtra = mergeKsf(list, parseKsf(await fetchText(KSF_URL, 'euc-kr')))
  } catch (err) {
    console.warn(`  연맹 공인 코트 목록 실패: ${err.message}`)
    ksfExtra = (prev?.courts ?? []).filter((c) => c.id.startsWith('ksf-'))
  }
  list.push(...ksfExtra)

  list.sort((a, b) => (a.region ?? '').localeCompare(b.region ?? '', 'ko') || a.name.localeCompare(b.name, 'ko'))
  console.log(`  센터 ${list.length}곳 (연맹 목록에서 보탠 곳 ${ksfExtra.length}, 상세 새로 받음 ${fetched})`)
  return { asOf: new Date().toISOString().slice(0, 10), sources: SOURCES, courts: list, ...(pending.length ? { pending } : {}) }
}

async function previous() {
  for (const load of [
    async () => (await fetch(LIVE, { headers: UA, signal: AbortSignal.timeout(30_000) })).json(),
    async () => JSON.parse(await readFile(OUT, 'utf8')),
    async () => JSON.parse(await readFile(SEED, 'utf8')),
  ]) {
    try {
      const j = await load()
      if (j?.courts?.length) return j
    } catch {}
  }
  return null
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const prev = await previous()
  try {
    const data = await courts(prev)
    await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), ...data }, null, 1) + '\n')
    console.log('✓ courts.json')
  } catch (err) {
    console.warn(`✗ courts.json: ${err.message}`)
    if (prev) {
      await writeFile(OUT, JSON.stringify(prev, null, 1) + '\n')
      console.warn(`  지난 파일(${prev.asOf ?? '날짜 모름'})을 그대로 씁니다`)
    }
    process.exitCode = 1
  }
}
