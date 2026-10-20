import { CPU_LEVEL } from './cpu'
import { SIM_DT, Shot, aimAt, clamp, findReachWindow, inYourReach, simulate, type Difficulty, type Hitter, type Sim, type SimEvent, type Vec } from './physics'

// 샷 계획기: 샷마다 "제대로 들어간 공"의 조건을 정해 두고, 실제 물리로 굴려 그 조건을 가장 잘 맞는 속도를 찾는다.
// 게임(나·상대)과 기술 백과의 3D 그림이 같은 계획기를 쓴다.

export type ShotKind =
  'drive' | 'cross' | 'lob' | 'cross-lob' | 'drop' | 'cross-drop' | 'kill' | 'boast' | 'three-wall' | 'skid' | 'reverse' | 'back-wall' | 'serve-lob' | 'serve-hard'

export const SHOT_NAME: Record<ShotKind, string> = {
  drive: '스트레이트 드라이브',
  cross: '크로스코트 드라이브',
  lob: '스트레이트 로브',
  'cross-lob': '크로스 로브',
  drop: '스트레이트 드롭',
  'cross-drop': '크로스 드롭',
  kill: '킬',
  boast: '보스트',
  'three-wall': '3벽 보스트',
  skid: '스키드 보스트',
  reverse: '리버스 보스트',
  'back-wall': '백월 샷',
  'serve-lob': '로브 서브',
  'serve-hard': '하드 서브',
}

/** 앞 코트로 떨어지는 샷: 받는 쪽이 앞으로 나가야 한다 */
export const SHORT_KINDS: ShotKind[] = ['drop', 'cross-drop', 'kill', 'boast', 'three-wall', 'reverse']

// 앞벽을 노리는 샷은 앞벽의 점(x, y)을, 옆벽·뒷벽부터 맞히는 샷은 방향(수평각 yaw, 발사각 pitch, 도)을 정한다
type Aim =
  | { wall: 'front'; x: [number, number]; y: [number, number]; speed: [number, number] }
  | { wall: 'near-side' | 'far-side' | 'back'; yaw: [number, number]; pitch: [number, number]; speed: [number, number] }

// x 범위는 "치는 쪽 벽(s)" 기준: +는 가까운 벽 쪽, -는 반대쪽.
// yaw는 앞벽 방향에서 옆벽 쪽으로 기운 각도(뒷벽 샷은 뒷벽 방향에서), pitch는 수평에서 위로 든 각도
const AIM: Record<ShotKind, Aim> = {
  drive: { wall: 'front', x: [1.5, 3.05], y: [1.2, 3.0], speed: [12, 20] },
  cross: { wall: 'front', x: [-1.8, 0.8], y: [1.2, 2.8], speed: [12, 20] },
  lob: { wall: 'front', x: [0.8, 3.0], y: [3.2, 4.45], speed: [8, 16] },
  'cross-lob': { wall: 'front', x: [-2.0, 0.6], y: [3.1, 4.45], speed: [8, 16] },
  drop: { wall: 'front', x: [1.4, 3.05], y: [0.52, 1.0], speed: [4, 11] },
  'cross-drop': { wall: 'front', x: [-3.05, -1.2], y: [0.52, 1.0], speed: [4, 11] },
  kill: { wall: 'front', x: [-1.5, 3.05], y: [0.5, 0.85], speed: [14, 23] },
  boast: { wall: 'near-side', yaw: [30, 75], pitch: [-4, 16], speed: [10, 22] },
  'three-wall': { wall: 'near-side', yaw: [55, 86], pitch: [0, 22], speed: [13, 25] },
  skid: { wall: 'near-side', yaw: [20, 60], pitch: [14, 42], speed: [10, 21] },
  reverse: { wall: 'far-side', yaw: [25, 72], pitch: [-4, 18], speed: [9, 20] },
  'back-wall': { wall: 'back', yaw: [0, 40], pitch: [18, 58], speed: [10, 23] },
  'serve-lob': { wall: 'front', x: [-1.8, 0.4], y: [2.4, 4.3], speed: [8, 14] },
  'serve-hard': { wall: 'front', x: [-1.6, 0.4], y: [1.9, 2.5], speed: [13, 20] },
}

const u = (v: number, lo: number, hi: number) => clamp((v - lo) / (hi - lo), 0, 1)

type Parts = {
  front: SimEvent | undefined
  before: SimEvent[] // 앞벽 전에 맞은 벽(보스트 등)
  f1: Vec | undefined
  f2: Vec | undefined
  wallsToF1: SimEvent[] // 앞벽 뒤 첫 바운드 전까지 맞은 벽
  wallsToF2: SimEvent[] // 첫 바운드와 두 번째 바운드 사이에 맞은 벽
}

function parts(sim: Sim): Parts {
  const ev = sim.events
  const fi = ev.findIndex((e) => e.hit === 'front')
  const after = fi >= 0 ? ev.slice(fi + 1) : []
  const floors = after.map((e, i) => (e.hit === 'floor' ? i : -1)).filter((i) => i >= 0)
  const [i1, i2] = floors
  return {
    front: ev[fi],
    before: fi >= 0 ? ev.slice(0, fi) : ev,
    f1: i1 != null ? after[i1].at : undefined,
    f2: i2 != null ? after[i2].at : undefined,
    wallsToF1: after.slice(0, i1 ?? after.length).filter((e) => e.hit !== 'floor'),
    wallsToF2: i1 != null ? after.slice(i1 + 1, i2 ?? after.length).filter((e) => e.hit !== 'floor') : [],
  }
}

const sideHit = (e: SimEvent, sign: number) => e.hit === 'side' && Math.sign(e.at.x) === sign

/**
 * 샷이 제대로 들어갔는지 0~1로 매긴다. 조건을 못 맞추면 null.
 * s: 치는 쪽 벽의 부호(스트레이트는 이 벽을 따라, 크로스는 반대쪽으로)
 */
export function judge(kind: ShotKind, sim: Sim, s: number): number | null {
  if (sim.result !== 'double') return null
  const { front, before, f1, f2, wallsToF1, wallsToF2 } = parts(sim)
  if (!front || !f1 || !f2) return null
  const fy = front.at.y
  const noneBefore = before.length === 0
  const tight = (x: number, sign: number) => u(x * sign, 2.3, 2.95)
  const deep = (z: number) => u(z, 8.2, 9.6)
  // 길이: 두 번째 바운드가 뒷벽 가까이거나, 첫 바운드 뒤 뒷벽 낮은 곳에 맞고 죽으면 좋은 길이
  const backLow = wallsToF2.find((e) => e.hit === 'back')
  const length = backLow ? (backLow.at.y < 1.1 ? 1 - u(backLow.at.y, 0.3, 1.1) * 0.6 : null) : f2.z >= 8.2 ? deep(f2.z) : null

  switch (kind) {
    case 'drive':
      if (!noneBefore || f1.z < 6.0 || f1.z > 9.0 || f1.x * s < 2.45 || length == null) return null
      return 0.6 * tight(f1.x, s) + 0.4 * length
    case 'cross': {
      if (!noneBefore || f1.z < 5.6 || f1.z > 9.0 || f1.x * -s < 1.4) return null
      // 폭: 첫 바운드 뒤 반대쪽 옆벽에 닿아야 T에 선 상대가 끊기 어렵다
      const width = [...wallsToF1, ...wallsToF2].find((e) => sideHit(e, -s) && e.at.z > 6.2)
      if (!width || length == null) return null
      return 0.5 * u(width.at.z, 6.2, 8.4) + 0.5 * length
    }
    case 'lob':
      if (!noneBefore || fy < 3.1 || f1.z < 8.4 || f1.x * s < 1.8) return null
      return 0.5 * u(f1.z, 8.4, 9.5) + 0.5 * tight(f1.x, s)
    case 'cross-lob': {
      if (!noneBefore || fy < 3.0 || f1.z < 7.6 || f1.x * -s < 1.6) return null
      const high = wallsToF1.find((e) => sideHit(e, -s) && e.at.y > 1.8)
      if (!high) return null
      return 0.5 * u(f1.z, 7.6, 9.4) + 0.5 * u(high.at.y, 1.8, 3.2)
    }
    case 'drop':
    case 'cross-drop': {
      const side = kind === 'drop' ? s : -s
      if (!noneBefore || fy > 1.05 || f1.z > 2.2 || f2.z > 3.6) return null
      const nick = wallsToF1.some((e) => sideHit(e, side) && e.at.y < 0.3)
      if (!nick && f2.x * side < 2.2) return null
      return 0.4 * u(1.05 - fy, 0, 0.45) + 0.3 * u(3.6 - f2.z, 0, 2) + 0.3 * (nick ? 1 : tight(f2.x, side))
    }
    case 'kill':
      if (!noneBefore || fy > 0.9 || f1.z > 4.2 || f2.z > 6.2) return null
      return 0.5 * u(0.9 - fy, 0, 0.35) + 0.5 * u(6.2 - f2.z, 0, 2.8)
    case 'boast':
    case 'three-wall': {
      // 가까운 옆벽 → (3벽이면 반대쪽 옆벽) → 앞벽, 그리고 반대쪽 앞 구석에 떨어진다
      if (!before.length || !sideHit(before[0], s)) return null
      if (kind === 'three-wall' && !before.some((e) => sideHit(e, -s))) return null
      if (kind === 'boast' && (before.length !== 1 || front.at.x * -s < 0.2)) return null
      if (fy > 2.0 || f1.z > 3.4) return null
      const into = wallsToF1.some((e) => sideHit(e, -s)) // 반대쪽 옆벽까지 가서 닉 쪽으로
      if (kind === 'boast' && f1.x * -s < 0.8 && !into) return null
      return 0.35 * u(2.0 - fy, 0, 1.3) + 0.35 * u(3.4 - f1.z, 0, 2.2) + 0.3 * (into ? 1 : u(f1.x * -s, 0.8, 2.6))
    }
    case 'skid': {
      // 옆벽 높이 → 앞벽 높이 → 반대쪽 옆벽 → 반대쪽 뒤 구석
      if (before.length !== 1 || !sideHit(before[0], s) || before[0].at.y < 1.8 || fy < 2.4) return null
      // 상대 머리 위로 넘어가 반대쪽 뒤 코트에 떨어져야 한다(반대쪽 옆벽까지 스치면 더 좋다)
      if (f1.z < 6.0 || f1.x * -s < 0.8) return null
      const cross = wallsToF1.some((e) => sideHit(e, -s))
      return 0.4 * u(f1.z, 6.0, 9.0) + 0.3 * u(f1.x * -s, 0.8, 2.6) + 0.3 * (cross ? 1 : 0)
    }
    case 'reverse':
      // 반대쪽 옆벽을 먼저 맞혀 그쪽 앞 구석으로
      if (before.length !== 1 || !sideHit(before[0], -s) || before[0].at.z > 3.4) return null
      if (fy > 1.9 || f1.z > 3.0 || f1.x * -s < 1.0) return null
      return 0.5 * u(1.9 - fy, 0, 1.2) + 0.5 * u(3.0 - f1.z, 0, 2)
    case 'back-wall':
      if (!before.length || before[0].hit !== 'back' || before.some((e) => e.hit === 'side' && e.at.y > 3)) return null
      // 높이 떠서 앞벽에 닿고 깊이 떨어질수록 다시 준비할 시간이 생긴다
      return 0.5 * u(fy, 1.5, 3.8) + 0.5 * u(f1.z, 3.5, 7.5)
    case 'serve-lob': {
      if (fy < 2.2 || f1.z < 7.4 || f1.x * -s < 0.3) return null
      const high = wallsToF1.find((e) => sideHit(e, -s) && e.at.y > 1.6)
      return 0.4 * u(f1.z, 7.4, 9.4) + 0.3 * (high ? 1 : 0) + 0.3 * u(f1.x * -s, 0.3, 2.6)
    }
    case 'serve-hard':
      if (fy > 2.6 || f1.z < 6.0 || f1.x * -s < 0.6) return null
      return 0.5 * u(f1.x * -s, 0.6, 2.6) + 0.5 * u(f2.z, 7.5, 9.5)
  }
}

export type Plan = { kind: ShotKind; v: Vec; score: number; sim: Sim }

/** 조건을 맞는 후보를 찾아 점수 순으로 돌려준다 */
export function plan(kind: ShotKind, from: Vec, opts: { by: Hitter; side?: number; serve?: boolean; samples?: number; rand?: () => number } = { by: 'you' }): Plan[] {
  const rand = opts.rand ?? Math.random
  const s = opts.side ?? (Math.sign(from.x) || 1)
  const a = AIM[kind]
  const serve = opts.serve ?? kind.startsWith('serve')
  const r = (lo: number, hi: number) => lo + rand() * (hi - lo)
  const out: Plan[] = []
  for (let i = 0; i < (opts.samples ?? 110); i++) {
    const speed = r(...a.speed)
    let v: Vec
    if (a.wall === 'front') {
      v = aimAt(from, { x: s * r(...a.x), y: r(...a.y), z: 0 }, speed)
    } else {
      const yaw = (r(...a.yaw) * Math.PI) / 180
      const pitch = (r(...a.pitch) * Math.PI) / 180
      const toward = a.wall === 'far-side' ? -s : s
      const h = Math.cos(pitch) * speed
      v = { x: toward * Math.sin(yaw) * h, y: Math.sin(pitch) * speed, z: (a.wall === 'back' ? 1 : -1) * Math.cos(yaw) * h }
    }
    const shot = new Shot(opts.by, serve, serve ? s : 0)
    const sim = simulate({ p: { ...from }, v }, shot)
    const score = judge(kind, sim, s)
    if (score != null) out.push({ kind, v, score, sim })
  }
  return out.sort((x, y) => y.score - x.score)
}

/** 실행 오차: 빗맞을수록 속도가 흔들린다 */
export function jitter(v: Vec, err: number, rand = Math.random): Vec {
  const m = Math.hypot(v.x, v.y, v.z) * err
  return { x: v.x + (rand() * 2 - 1) * m, y: v.y + (rand() * 2 - 1) * m, z: v.z + (rand() * 2 - 1) * m * 0.5 }
}

export function newShot(by: Hitter, kind: ShotKind, from: Vec, serve = false) {
  const shot = new Shot(by, serve, serve ? Math.sign(from.x) || 1 : 0)
  shot.short = SHORT_KINDS.includes(kind)
  return shot
}

/** 실제로 친 공이 얼마나 예리한지(상대가 받기 어려운 정도) */
export function sharpness(kind: ShotKind, v: Vec, from: Vec, by: Hitter, serve = false) {
  const sim = simulate({ p: { ...from }, v }, newShot(by, kind, from, serve))
  return { score: judge(kind, sim, Math.sign(from.x) || 1) ?? 0, result: sim.result }
}

// ---------- 내 샷 ----------

// 누른 곳 = 라켓이 공을 때리는 곳. 공이 오른쪽 벽 가까이 있으면
// 공의 왼쪽(안쪽)을 때리면 오른쪽 옆벽으로 가는 보스트, 가운데는 벽을 따라 가는 드라이브, 오른쪽(벽 쪽)을 때리면 크로스.
// 공의 윗부분을 때리면 낮게(드롭, 높은 공은 킬), 아랫부분을 때리면 높게(로브).
export type Intent = { col: 'inner' | 'center' | 'outer'; height: 'low' | 'mid' | 'high' }

export const ZONE = { col: 0.33, row: 0.35 } // 공 둘레 원의 반지름에 대한 비율

/** dx, dy: 공 중심 기준 -1~1(화면 오른쪽, 아래가 +) */
export function intentFrom(ballX: number, dx: number, dy: number): Intent {
  const s = Math.sign(ballX) || 1
  const col = Math.abs(dx) <= ZONE.col ? 'center' : Math.sign(dx) === s ? 'outer' : 'inner'
  const height = dy < -ZONE.row ? 'low' : dy > ZONE.row ? 'high' : 'mid'
  return { col, height }
}

export function kindFor(intent: Intent, ball: Vec, serve: boolean): ShotKind {
  if (serve) return intent.height === 'low' ? 'serve-hard' : 'serve-lob'
  if (intent.col === 'inner') return 'boast'
  const cross = intent.col === 'outer'
  if (intent.height === 'high') return cross ? 'cross-lob' : 'lob'
  if (intent.height === 'low') {
    if (ball.y > 1.15 && ball.z < 7) return 'kill'
    return cross ? 'cross-drop' : 'drop'
  }
  return cross ? 'cross' : 'drive'
}

/** 내가 친 샷: 타이밍이 좋을수록 계획한 대로, 나쁠수록 흔들린다 */
export function playerShot(kind: ShotKind, from: Vec, quality: number, rand = Math.random) {
  const serve = kind.startsWith('serve')
  let plans = plan(kind, from, { by: 'you', serve, samples: 400, rand })
  if (plans.length === 0) plans = plan(kind, from, { by: 'you', serve, samples: 1500, rand })
  if (plans.length === 0) return null
  // 좋은 타이밍은 상위 후보, 나쁜 타이밍은 아래쪽 후보 + 실행 오차
  const pick = plans[Math.min(plans.length - 1, Math.floor((1 - quality) * plans.length * 0.6))]
  const v = jitter(pick.v, (1 - quality) * 0.06, rand)
  return { kind, v }
}

// ---------- 상대 샷 ----------

/** 상대 위치에 맞는 샷 종류를 고른다(프로 연습처럼 길게 붙이는 드라이브가 기본) */
function cpuKinds(from: Vec, rand: () => number): ShotKind[] {
  const nearWall = Math.abs(from.x) > 1.6
  const w: [ShotKind, number][] =
    from.z > 6.3
      ? [
          ['drive', 0.45],
          ['cross', 0.25],
          ['cross-lob', 0.1],
          ['boast', nearWall ? 0.2 : 0],
        ]
      : from.z > 4.3
        ? [
            ['drive', 0.35],
            ['cross', 0.25],
            ['drop', 0.15],
            ['kill', from.y > 1 ? 0.15 : 0.05],
            ['boast', nearWall ? 0.1 : 0],
          ]
        : [
            ['drop', 0.3],
            ['cross-drop', 0.1],
            ['drive', 0.25],
            ['cross', 0.2],
            ['lob', 0.15],
          ]
  // 가중치대로 순서를 섞어, 앞의 것이 안 되면 다음 것을 쓴다
  return w
    .filter(([, p]) => p > 0)
    .map(([k, p]) => ({ k, key: Math.pow(rand(), 1 / p) }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.k)
}

/** 상대(CPU)의 샷. 내가 칠 수 있는 시간이 남는 샷만 고른다 */
export function cpuShot(from: Vec, diff: Difficulty, serve: boolean, rand = Math.random): { v: Vec; kind: ShotKind } {
  let fallback: { v: Vec; kind: ShotKind; window: number } | null = null
  const kinds: ShotKind[] = serve ? (rand() < 0.7 ? ['serve-lob', 'serve-hard'] : ['serve-hard', 'serve-lob']) : cpuKinds(from, rand)
  for (const kind of kinds) {
    const plans = plan(kind, from, { by: 'cpu', serve, samples: 300, rand })
    // 어려울수록 가장 예리한 후보, 쉬울수록 무난한 후보
    const start = Math.floor(plans.length * CPU_LEVEL[diff].candidateOffset)
    for (const p of plans.slice(start).concat(plans.slice(0, start))) {
      const v = jitter(p.v, CPU_LEVEL[diff].error, rand)
      const shot = newShot('cpu', kind, from, serve)
      if (simulate({ p: { ...from }, v }, shot, 6, SIM_DT).result !== 'double') continue
      const w = findReachWindow({ p: { ...from }, v }, newShot('cpu', kind, from, serve), inYourReach, 4, SIM_DT)
      if (w && w.length >= CPU_LEVEL[diff].minWindow) return { v, kind }
      if (w && (!fallback || w.length > fallback.window)) fallback = { v, kind, window: w.length }
    }
  }
  // 긴 수비 시간이 안 나오더라도 이미 검증된 합법 샷을 쓴다.
  // 앞벽 바로 옆에서 무조건 중앙 높이 2.6m로 치면 거의 수직으로 떠 아웃될 수 있다.
  if (fallback) return { v: fallback.v, kind: fallback.kind }
  for (const y of serve ? [2.2, 2.8, 3.4] : [0.85, 1.2, 1.8, 2.6]) {
    for (const x of [from.x * 0.85, 0, -Math.sign(from.x || 1) * 1.8]) {
      for (const speed of [10, 14, 18]) {
        const v = aimAt(from, { x, y, z: 0 }, speed)
        for (const kind of (serve ? ['serve-lob'] : ['drive', 'drop']) as ShotKind[]) {
          const sim = simulate({ p: { ...from }, v }, newShot('cpu', kind, from, serve), 6, SIM_DT)
          if (sim.result !== 'double') continue
          const w = findReachWindow({ p: { ...from }, v }, newShot('cpu', kind, from, serve), inYourReach, 4, SIM_DT)
          if (w) return { v, kind }
        }
      }
    }
  }
  return { v: aimAt(from, { x: from.x, y: serve ? 2.2 : 1, z: 0 }, 12), kind: serve ? 'serve-lob' : 'drop' }
}

/** 닿는 공은 적극적으로 받되 예리한 샷에는 난이도별 작은 실수 여지를 둔다. */
export function cpuReturnChance(diff: Difficulty, kind: ShotKind, sharp: number) {
  const level = CPU_LEVEL[diff]
  const short = SHORT_KINDS.includes(kind) ? level.shortPenalty : 0
  return clamp(level.returnRate - clamp(sharp, 0, 1) * level.pressure - short, 0, 1)
}

export function canBoast(p: Vec) {
  return Math.abs(p.x) > 1.5 && p.z > 5.6
}
