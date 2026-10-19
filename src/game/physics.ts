// 스쿼시 코트 좌표(미터): x는 가운데 0 기준 좌우, y는 바닥에서 위, z는 앞벽에서 뒤쪽
export const COURT = {
  halfWidth: 3.2,
  length: 9.75,
  tin: 0.48,
  serviceLine: 1.78,
  frontOut: 4.57,
  backOut: 2.13,
  shortLine: 5.44,
}

export const G = 9.8
export const BALL_R = 0.09 // 실제(2cm)보다 크게 그려 잘 보이게
const E_FRONT = 0.68
const E_WALL = 0.62
const E_FLOOR = 0.55

export type Vec = { x: number; y: number; z: number }
export type Ball = { p: Vec; v: Vec }
export type Hitter = 'you' | 'cpu'
export type Hit = 'front' | 'side' | 'back' | 'floor'
export type BallEvent = { hit: Hit; at: Vec }

export function step(b: Ball, dt: number): BallEvent[] {
  const events: BallEvent[] = []
  const { p, v } = b
  v.y -= G * dt
  p.x += v.x * dt
  p.y += v.y * dt
  p.z += v.z * dt

  if (p.z <= BALL_R && v.z < 0) {
    p.z = BALL_R
    v.z = -v.z * E_FRONT
    v.x *= 0.9
    v.y *= 0.9
    events.push({ hit: 'front', at: { ...p } })
  }
  if (p.z >= COURT.length - BALL_R && v.z > 0) {
    p.z = COURT.length - BALL_R
    v.z = -v.z * E_WALL
    events.push({ hit: 'back', at: { ...p } })
  }
  if (Math.abs(p.x) >= COURT.halfWidth - BALL_R && Math.sign(v.x) === Math.sign(p.x)) {
    p.x = Math.sign(p.x) * (COURT.halfWidth - BALL_R)
    v.x = -v.x * E_WALL
    events.push({ hit: 'side', at: { ...p } })
  }
  if (p.y <= BALL_R && v.y < 0) {
    p.y = BALL_R
    v.y = -v.y * E_FLOOR
    v.x *= 0.78
    v.z *= 0.78
    events.push({ hit: 'floor', at: { ...p } })
  }
  return events
}

/**
 * 코트 안 한 점(벽 위의 점)을 지나가도록 speed(m/s)로 쳐 내는 속도.
 * 같은 속도로 닿는 길은 낮은 길과 높은 길 두 가지인데, 낮게 깔리는 쪽을 고른다(빠를수록 직선에 가깝다).
 */
export function aimAt(from: Vec, to: Vec, speed: number): Vec {
  const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }
  const vel = (t: number) => ({ x: d.x / t, y: (d.y + 0.5 * G * t * t) / t, z: d.z / t })
  const mag = (t: number) => Math.hypot(d.x / t, (d.y + 0.5 * G * t * t) / t, d.z / t)
  // |v|² = D²/t² + g·dy + g²t²/4 는 t = √(2D/g)에서 가장 작다. 그보다 빠른 쪽(낮은 길)에서 speed가 되는 t를 찾는다
  const dist = Math.hypot(d.x, d.y, d.z)
  let hi = Math.sqrt((2 * dist) / G)
  if (mag(hi) >= speed) return vel(hi)
  let lo = 1e-3
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (mag(mid) > speed) lo = mid
    else hi = mid
  }
  return vel(hi)
}

/** 앞벽 (tx, ty)에 닿는 속도 */
export function aimVelocity(from: Vec, tx: number, ty: number, speed: number): Vec {
  return aimAt(from, { x: tx, y: ty, z: 0 }, speed)
}

// 한 번의 샷이 어떻게 끝나는지: 앞벽에 제대로 맞기 전에는 친 사람 실수, 그 뒤 두 번 튀면 받는 사람 실수
export type ShotFault = 'down' | 'tin' | 'out' | 'serve-fault'

export class Shot {
  frontOk = false
  floorAfterFront = 0
  backWall = false // 앞벽을 맞고 온 공이 뒷벽에도 맞았는지
  boast = false // 앞벽보다 옆벽을 먼저 맞힌 샷(보스트)
  short = false // 앞 코트로 떨어지는 샷(드롭, 보스트, 킬): 받는 사람이 앞으로 나가 친다
  by: Hitter
  serve: boolean
  serveSide: number // 서브한 쪽(x 부호). 서브는 반대쪽 뒤 코트에 떨어져야 한다
  constructor(by: Hitter, serve = false, serveSide = 0) {
    this.by = by
    this.serve = serve
    this.serveSide = serveSide
  }

  /** 반칙이면 사유를, 두 번 튀었으면 'double'을, 아니면 null */
  apply(e: BallEvent): ShotFault | 'double' | null {
    // 옆벽·뒷벽의 아웃 라인 위에 맞으면 언제든 친 사람의 아웃
    if ((e.hit === 'side' || e.hit === 'back') && e.at.y > outLineAt(e.at.z)) return 'out'
    if (!this.frontOk) {
      if (e.hit === 'floor') return 'down'
      if (e.hit === 'side') {
        // 서브는 앞벽부터 맞혀야 하고, 랠리에서는 옆벽 먼저 맞히는 보스트가 된다
        if (this.serve) return 'serve-fault'
        this.boast = true
      }
      if (e.hit === 'front') {
        if (e.at.y < COURT.tin) return 'tin'
        if (e.at.y > COURT.frontOut) return 'out'
        if (this.serve && e.at.y < COURT.serviceLine) return 'serve-fault'
        this.frontOk = true
      }
      return null
    }
    if (e.hit === 'back') this.backWall = true
    if (e.hit === 'floor') {
      // 서브가 처음 떨어진 곳은 쇼트 라인 뒤, 서브한 쪽의 반대편이어야 한다
      if (this.serve && this.floorAfterFront === 0 && this.serveSide && (e.at.z < COURT.shortLine || Math.sign(e.at.x) === this.serveSide)) return 'serve-fault'
      this.floorAfterFront++
      if (this.floorAfterFront >= 2) return 'double'
    }
    return null
  }
}

/** 옆벽 아웃 라인 높이: 앞 4.57m에서 뒤 2.13m로 비스듬히 내려온다(뒷벽은 2.13m) */
export function outLineAt(z: number) {
  const k = clamp(z / COURT.length, 0, 1)
  return COURT.frontOut + (COURT.backOut - COURT.frontOut) * k
}

export type SimEvent = BallEvent & { t: number; afterFront: boolean }
export type Sim = {
  result: ReturnType<Shot['apply']>
  events: SimEvent[]
  points: { p: Vec; t: number }[] // 그림용 궤적(1/60초 간격)
  duration: number
  boast: boolean
}

/** 샷을 끝까지 굴려 벽·바닥에 닿은 순서와 궤적을 모두 기록한다 */
export function simulate(ball: Ball, shot: Shot, maxT = 6, dt = 1 / 120, keepPoints = false): Sim {
  const b: Ball = { p: { ...ball.p }, v: { ...ball.v } }
  const s = Object.assign(new Shot(shot.by, shot.serve, shot.serveSide), shot)
  const events: SimEvent[] = []
  const points = keepPoints ? [{ p: { ...b.p }, t: 0 }] : []
  let t = 0
  for (let i = 0; t < maxT; i++) {
    t += dt
    for (const e of step(b, dt)) {
      const afterFront = s.frontOk
      const r = s.apply(e)
      events.push({ ...e, t, afterFront: afterFront || (e.hit === 'front' && s.frontOk) })
      if (r) {
        if (keepPoints) points.push({ p: { ...b.p }, t })
        return { result: r, events, points, duration: t, boast: s.boast }
      }
    }
    if (keepPoints && i % 2 === 1) points.push({ p: { ...b.p }, t })
  }
  return { result: null, events, points, duration: t, boast: s.boast }
}

/** 샷 하나를 끝까지 굴려 어떻게 끝나는지 */
export function outcome(ball: Ball, shot: Shot) {
  return simulate(ball, shot).result
}

// 받는 쪽(카메라 쪽, 뒤 코트)이 칠 수 있는 범위.
// 뒷벽을 맞고 앞으로 튀어나오는 공도 두 번 튀기 전이면 칠 수 있고, 그때는 공을 따라 조금 더 앞까지 나간다.
// 드롭·보스트처럼 앞 코트로 떨어지는 공은 앞으로 달려 나가 친다
export function inYourReach(b: Ball, shot: Shot) {
  if (!shot.frontOk || shot.floorAfterFront > 1 || b.p.y > 2.4) return false
  if (shot.boast || shot.short) return b.p.z >= 1.4 && b.p.y <= 1.6
  return b.p.z >= (shot.backWall ? 3.8 : 5.3)
}

export type Window = { start: number; length: number; at: Vec }

/** 공을 앞으로 굴려 보며 상대가 칠 수 있는 첫 구간을 찾는다(없으면 null) */
export function findReachWindow(ball: Ball, shot: Shot, reach: (b: Ball, s: Shot) => boolean, maxT = 4, dt = 1 / 120): Window | null {
  const b: Ball = { p: { ...ball.p }, v: { ...ball.v } }
  const s = Object.assign(new Shot(shot.by, shot.serve, shot.serveSide), shot)
  let start = -1
  let at: Vec | null = null
  for (let t = 0; t < maxT; t += dt) {
    for (const e of step(b, dt)) {
      const r = s.apply(e)
      if (r) return start >= 0 ? { start, length: t - start, at: at! } : null
    }
    const ok = reach(b, s)
    if (ok && start < 0) {
      start = t
      at = { ...b.p }
    } else if (!ok && start >= 0) return { start, length: t - start, at: at! }
  }
  return start >= 0 ? { start, length: maxT - start, at: at! } : null
}

export type Difficulty = 'easy' | 'normal' | 'hard'

/** 타이밍 품질: 공이 허리 높이, 뒤 코트 깊숙이 왔을 때 칠수록 좋다(뒷벽에서 나온 공은 조금 앞에서, 앞 코트 공은 앞에서) */
export function timingQuality(p: Vec, offBackWall = false, frontCourt = false) {
  const depth = frontCourt ? 0.8 : 1 - Math.min(1, Math.abs(p.z - (offBackWall ? 7.4 : 8)) / (offBackWall ? 3 : 2.4))
  const height = 1 - Math.min(1, Math.abs(p.y - 0.9) / 1.4)
  return clamp(0.25 + depth * 0.45 + height * 0.3, 0, 1)
}

/** 상대가 칠 수 있는 순간: 한 번 튄 뒤 내려오는 공이 무릎~허리 높이이거나, 뒤에서 발리 */
export function inCpuReach(b: Ball, shot: Shot) {
  if (!shot.frontOk) return false
  if (shot.floorAfterFront === 1) return b.p.y < 1.2 && b.v.y < 0
  return b.p.z > 5 && b.p.y < 1.5 && b.p.y > 0.4
}

export function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}
