// 스트레칭 동작을 보여 주는 막대 인형. 관절 각도로 자세를 정하고 자세 사이를 이어 움직인다.
// 각도는 도(°) 단위, 0 = 아래, 90 = 앞(오른쪽), 180 = 위. 좌표는 y가 위, 바닥은 y = 0.

export type V = { x: number; y: number }
export type Name =
  | 'hip'
  | 'shoulder'
  | 'neck'
  | 'head'
  | 'hipA'
  | 'kneeA'
  | 'ankleA'
  | 'toeA'
  | 'hipB'
  | 'kneeB'
  | 'ankleB'
  | 'toeB'
  | 'shoulderA'
  | 'elbowA'
  | 'handA'
  | 'fingersA'
  | 'shoulderB'
  | 'elbowB'
  | 'handB'
  | 'fingersB'
export type Seg = 'torso' | 'thighA' | 'shinA' | 'footA' | 'thighB' | 'shinB' | 'footB' | 'upperA' | 'foreA' | 'palmA' | 'upperB' | 'foreB' | 'palmB'

/** 각도로 정한 팔다리: 다리 [허벅지, 정강이, 발(정강이 기준), 허벅지 길이 배율, 정강이 길이 배율], 팔 [위팔, 아래팔, 손목(아래팔 기준), 길이 배율] */
export type Angles = number[]
/** 손발이 닿을 곳을 정한 팔다리: 관절 이름 또는 [x, y] 좌표(y = 0이면 바닥). bend로 무릎·팔꿈치가 꺾이는 쪽을 고른다 */
export type Reach = { to: Name | [number, number]; bend?: 1 | -1; end?: number }
export type Limb = Angles | Reach

export type Pose = {
  lean?: number // 몸통 기울기: 0 서 있음, 90 앞으로 엎드림, -90 뒤로 누움
  head?: number // 몸통 기준 고개 숙임
  torso?: number // 몸통 길이 배율(정면에서 앞으로 숙일 때)
  a: Limb // 다리: 옆모습은 가까운 쪽, 정면은 화면 오른쪽
  b: Limb
  ha: Limb // 팔
  hb: Limb
  h?: number // 엉덩이 높이를 직접 정함(없으면 바닥에 닿게 맞춤)
  x?: number // 기준점에서 옆으로 옮김(사이드 런지)
  lift?: number // 바닥에서 뜬 높이(뛰기)
  roll?: number // 폼롤러가 닿는 자리(구간 비율)
  racket?: number // 라켓 보임(0~1)
  dur?: number // 앞 자세에서 오는 시간(초)
  hold?: number // 이 자세로 머무는 시간
  step?: number // 설명 몇 번째 줄인지
  cut?: boolean // 이어 움직이지 않고 바로 바꿈
  lin?: boolean // 일정한 속도로(돌리기)
}

export type Move = {
  view: 'side' | 'front'
  keys: Pose[]
  focus: Seg[] // 늘이거나 쓰는 곳
  anchor?: Name // 이 점이 제자리에 있게 한다(기본: 엉덩이)
  ground?: Name[] // 바닥에 닿는지 볼 점(기본: 각도로 정한 모든 점)
  // 폼롤러: 구간(seg)의 roll 비율 자리 아래, 또는 점(under) 아래 roll만큼 옆
  roller?: { seg?: Seg; under?: Name; r?: number }
  wall?: number // 벽의 x
  bar?: number // 짚는 봉의 x
  mat?: boolean
}

export const L = { torso: 30, neck: 4.5, head: 6.5, upper: 15, fore: 14, palm: 5, thigh: 23, shin: 22, foot: 7 }
export const R = 3.5 // 팔다리 굵기의 반
const HIP_R = 4.5

const rad = (d: number) => (d * Math.PI) / 180
export const dir = (a: number, len = 1): V => ({ x: Math.sin(rad(a)) * len, y: -Math.cos(rad(a)) * len })
const add = (p: V, q: V): V => ({ x: p.x + q.x, y: p.y + q.y })
const sub = (p: V, q: V): V => ({ x: p.x - q.x, y: p.y - q.y })
export const angleOf = (v: V) => (Math.atan2(v.x, -v.y) * 180) / Math.PI
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export type Figure = { p: Record<Name, V>; racket: number; roller?: { c: V; r: number; turn: number } }

const isReach = (l: Limb): l is Reach => !Array.isArray(l)

/** 두 마디 팔다리가 target에 닿게 하는 가운데 관절 */
function solve(base: V, target: V, l1: number, l2: number, bend: number) {
  const d0 = Math.hypot(target.x - base.x, target.y - base.y)
  const d = Math.min(Math.max(d0, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.001)
  const th = Math.atan2(target.y - base.y, target.x - base.x)
  const a = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))
  const mid = { x: base.x + Math.cos(th + bend * a) * l1, y: base.y + Math.sin(th + bend * a) * l1 }
  const end = { x: base.x + Math.cos(th) * d, y: base.y + Math.sin(th) * d }
  return { mid, end }
}

/** 자세 하나를 점들로 바꾼다 */
export function resolve(pose: Pose, move: Move): Figure {
  const front = move.view === 'front'
  const p = {} as Record<Name, V>
  const reachPts = new Set<Name>()
  const hip = { x: 0, y: 0 }
  const tDir = 180 - (pose.lean ?? 0)
  p.hip = hip
  p.shoulder = add(hip, dir(tDir, L.torso * (pose.torso ?? 1)))
  p.neck = add(p.shoulder, dir(tDir - (pose.head ?? 0), L.neck))
  p.head = add(p.neck, dir(tDir - (pose.head ?? 0), L.head))
  // 정면에선 골반과 어깨에 폭이 있다
  const hw = front ? 6 : 0
  const sw = front ? 8 : 0
  p.hipA = add(hip, { x: hw, y: 0 })
  p.hipB = add(hip, { x: -hw, y: 0 })
  const across = dir(tDir - 90, sw)
  p.shoulderA = add(p.shoulder, across)
  p.shoulderB = sub(p.shoulder, across)

  const leg = (s: 'A' | 'B', l: Limb) => {
    if (isReach(l)) return
    const [th, sh, ft = 90, k1 = 1, k2 = 1] = l
    const kn = add(p[`hip${s}`], dir(th, L.thigh * k1))
    const an = add(kn, dir(sh, L.shin * k2))
    p[`knee${s}`] = kn
    p[`ankle${s}`] = an
    p[`toe${s}`] = add(an, dir(sh + ft, L.foot * (front ? 0.35 : 1)))
  }
  const arm = (s: 'A' | 'B', l: Limb) => {
    if (isReach(l)) return
    const [up, fo, wr = 0, k = 1] = l
    const el = add(p[`shoulder${s}`], dir(up, L.upper * k))
    const hd = add(el, dir(fo, L.fore * k))
    p[`elbow${s}`] = el
    p[`hand${s}`] = hd
    p[`fingers${s}`] = add(hd, dir(fo + wr, L.palm * k))
  }
  leg('A', pose.a)
  leg('B', pose.b)
  arm('A', pose.ha)
  arm('B', pose.hb)
  for (const [s, l, names] of [
    ['A', pose.a, ['kneeA', 'ankleA', 'toeA']],
    ['B', pose.b, ['kneeB', 'ankleB', 'toeB']],
    ['A', pose.ha, ['elbowA', 'handA', 'fingersA']],
    ['B', pose.hb, ['elbowB', 'handB', 'fingersB']],
  ] as const) {
    void s
    if (isReach(l)) names.forEach((n) => reachPts.add(n))
  }

  // 위아래: 폼롤러에 얹거나, 엉덩이 높이를 정하거나, 가장 낮은 곳을 바닥에 맞춘다
  let dy = 0
  let dx = 0
  let roller: Figure['roller']
  if (move.roller) {
    const r = move.roller.r ?? 5.5
    let center: V
    if (move.roller.under) {
      const u = p[move.roller.under]
      center = { x: u.x + (pose.roll ?? 0), y: u.y - r - (move.roller.under === 'hip' ? HIP_R : R) }
    } else {
      const [s0, s1] = segEnds(move.roller.seg ?? 'thighA')
      const f = pose.roll ?? 0.5
      const c = { x: lerp(p[s0].x, p[s1].x, f), y: lerp(p[s0].y, p[s1].y, f) }
      const n0 = dir(angleOf(sub(p[s1], p[s0])) + 90)
      const n = n0.y > 0 ? { x: -n0.x, y: -n0.y } : n0 // 바닥 쪽
      center = add(c, { x: n.x * (r + R), y: n.y * (r + R) })
    }
    dx = -center.x
    dy = r - center.y
    roller = { c: { x: 0, y: r }, r, turn: 0 }
  } else {
    if (pose.h != null) dy = pose.h
    else {
      const names = (move.ground ?? (Object.keys(p) as Name[])).filter((n) => p[n] && !reachPts.has(n))
      let low = Infinity
      for (const n of names) low = Math.min(low, p[n].y - (n === 'head' ? L.head : n === 'hip' ? HIP_R : R))
      dy = -low
    }
    dy += pose.lift ?? 0
    const an = move.anchor ?? 'hip'
    if (p[an]) dx = -p[an].x
    dx += pose.x ?? 0
  }
  for (const n of Object.keys(p) as Name[]) p[n] = { x: p[n].x + dx, y: p[n].y + dy }
  if (roller) roller.turn = -dx / roller.r

  // 닿을 곳을 정한 팔다리
  const target = (t: Reach['to']): V => (Array.isArray(t) ? { x: t[0], y: t[1] === 0 ? R : t[1] } : p[t])
  const reachLeg = (s: 'A' | 'B', l: Limb) => {
    if (!isReach(l)) return
    const t = target(l.to)
    const { mid, end } = solve(p[`hip${s}`], t, L.thigh, L.shin, l.bend ?? 1)
    p[`knee${s}`] = mid
    p[`ankle${s}`] = end
    p[`toe${s}`] = add(end, dir(l.end ?? 90, L.foot * (front ? 0.35 : 1)))
  }
  const reachArm = (s: 'A' | 'B', l: Limb) => {
    if (!isReach(l)) return
    const t = target(l.to)
    const { mid, end } = solve(p[`shoulder${s}`], t, L.upper, L.fore, l.bend ?? -1)
    p[`elbow${s}`] = mid
    p[`hand${s}`] = end
    const flat = Array.isArray(l.to) && l.to[1] === 0
    p[`fingers${s}`] = add(end, dir(l.end ?? (flat ? 90 : angleOf(sub(end, mid))), L.palm))
  }
  // A 발이 B 무릎에 얹히는 자세(4자)가 있어 B부터
  reachLeg('B', pose.b)
  reachLeg('A', pose.a)
  reachArm('A', pose.ha)
  reachArm('B', pose.hb)
  return { p, racket: pose.racket ?? 0, roller }
}

export function segEnds(s: Seg): [Name, Name] {
  const m: Record<Seg, [Name, Name]> = {
    torso: ['hip', 'shoulder'],
    thighA: ['hipA', 'kneeA'],
    shinA: ['kneeA', 'ankleA'],
    footA: ['ankleA', 'toeA'],
    thighB: ['hipB', 'kneeB'],
    shinB: ['kneeB', 'ankleB'],
    footB: ['ankleB', 'toeB'],
    upperA: ['shoulderA', 'elbowA'],
    foreA: ['elbowA', 'handA'],
    palmA: ['handA', 'fingersA'],
    upperB: ['shoulderB', 'elbowB'],
    foreB: ['elbowB', 'handB'],
    palmB: ['handB', 'fingersB'],
  }
  return m[s]
}

/** 점들에서 다시 각도를 읽는다(서로 다른 방식의 자세 사이를 이을 때) */
function anglesOf(f: Figure, kind: 'leg' | 'arm', s: 'A' | 'B'): Angles {
  const p = f.p
  if (kind === 'leg') {
    const th = angleOf(sub(p[`knee${s}`], p[`hip${s}`]))
    const sh = angleOf(sub(p[`ankle${s}`], p[`knee${s}`]))
    return [th, sh, wrap(angleOf(sub(p[`toe${s}`], p[`ankle${s}`])) - sh)]
  }
  const up = angleOf(sub(p[`elbow${s}`], p[`shoulder${s}`]))
  const fo = angleOf(sub(p[`hand${s}`], p[`elbow${s}`]))
  return [up, fo, wrap(angleOf(sub(p[`fingers${s}`], p[`hand${s}`])) - fo)]
}
const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180
/** b를 a에 가장 가까운 같은 각도로(한 바퀴 돌아가지 않게) */
const near = (a: number, b: number) => a + wrap(b - a)

function mixLimb(l0: Limb, l1: Limb, t: number, f0: Figure, f1: Figure, kind: 'leg' | 'arm', s: 'A' | 'B'): Limb {
  if (isReach(l0) && isReach(l1)) {
    if (typeof l0.to === 'string' && l0.to === l1.to) return { ...l0, end: l0.end != null && l1.end != null ? lerp(l0.end, l1.end, t) : l0.end }
    if (Array.isArray(l0.to) && Array.isArray(l1.to) && (l0.bend ?? 0) === (l1.bend ?? 0))
      return {
        to: [lerp(l0.to[0], l1.to[0], t), l0.to[1] === 0 && l1.to[1] === 0 ? 0 : lerp(l0.to[1] || R, l1.to[1] || R, t)],
        bend: l0.bend,
        end: l0.end != null && l1.end != null ? lerp(l0.end, l1.end, t) : l0.end,
      }
  }
  if (!isReach(l0) && !isReach(l1)) {
    const n = Math.max(l0.length, l1.length)
    const def = kind === 'leg' ? [0, 0, 90, 1, 1] : [0, 0, 0, 1]
    // 각도(앞 세 값)는 가까운 쪽으로 돈다: 0 → 270은 -90으로
    return Array.from({ length: n }, (_, i) => {
      const a = l0[i] ?? def[i]
      const b = l1[i] ?? def[i]
      return lerp(a, i < 3 ? near(a, b) : b, t)
    })
  }
  const a0 = isReach(l0) ? anglesOf(f0, kind, s) : l0
  const a1 = isReach(l1) ? anglesOf(f1, kind, s) : l1
  // 각도로 읽은 쪽은 정한 쪽에 가깝게 맞춘다
  const b0 = isReach(l0) ? a0.map((v, i) => (i < 2 ? near(a1[i] ?? 0, v) : v)) : a0
  const b1 = isReach(l1) ? a1.map((v, i) => (i < 2 ? near(a0[i] ?? 0, v) : v)) : a1
  return mixLimb(b0, b1, t, f0, f1, kind, s)
}

const smooth = (t: number) => t * t * (3 - 2 * t)

export type Timeline = { total: number; at: (time: number) => { fig: Figure; step: number } }

/** 자세들을 한 바퀴 도는 움직임으로 만든다 */
export function timeline(move: Move): Timeline {
  const keys = move.keys
  const figs = keys.map((k) => resolve(k, move))
  const durs = keys.map((k) => (k.cut ? 0 : (k.dur ?? 0.7)))
  const holds = keys.map((k) => k.hold ?? 0.25)
  const total = keys.reduce((s, _, i) => s + durs[i] + holds[i], 0)
  // i번째 자세는 [start + dur, start + dur + hold] 동안 머문다. 0번은 마지막에서 넘어온다.
  return {
    total,
    at(time) {
      let t = ((time % total) + total) % total
      for (let i = 0; i < keys.length; i++) {
        const prev = (i - 1 + keys.length) % keys.length
        if (t < durs[i]) {
          const u = keys[i].lin ? t / durs[i] : smooth(t / durs[i])
          return { fig: mix(keys[prev], keys[i], u, figs[prev], figs[i], move), step: keys[i].step ?? 0 }
        }
        t -= durs[i]
        if (t < holds[i]) return { fig: figs[i], step: keys[i].step ?? 0 }
        t -= holds[i]
      }
      return { fig: figs[0], step: keys[0].step ?? 0 }
    },
  }
}

function mix(k0: Pose, k1: Pose, t: number, f0: Figure, f1: Figure, move: Move): Figure {
  const n = (a: number | undefined, b: number | undefined, d: number) => lerp(a ?? d, b ?? d, t)
  const pose: Pose = {
    lean: n(k0.lean, k1.lean, 0),
    head: n(k0.head, k1.head, 0),
    torso: n(k0.torso, k1.torso, 1),
    lift: n(k0.lift, k1.lift, 0),
    roll: n(k0.roll, k1.roll, 0.5),
    x: n(k0.x, k1.x, 0),
    racket: n(k0.racket, k1.racket, 0),
    a: mixLimb(k0.a, k1.a, t, f0, f1, 'leg', 'A'),
    b: mixLimb(k0.b, k1.b, t, f0, f1, 'leg', 'B'),
    ha: mixLimb(k0.ha, k1.ha, t, f0, f1, 'arm', 'A'),
    hb: mixLimb(k0.hb, k1.hb, t, f0, f1, 'arm', 'B'),
  }
  // 한쪽만 엉덩이 높이를 정했으면 두 자세의 실제 높이 사이를 잇는다
  if (k0.h != null || k1.h != null) pose.h = lerp(f0.p.hip.y, f1.p.hip.y, t) - (pose.lift ?? 0)
  return resolve(pose, move)
}
