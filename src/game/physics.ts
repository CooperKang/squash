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
const E_FRONT = 0.78
const E_WALL = 0.68
const E_FLOOR = 0.6

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
    v.x *= 0.85
    v.z *= 0.85
    events.push({ hit: 'floor', at: { ...p } })
  }
  return events
}

/** 앞벽 (tx, ty)에 닿는 속도 */
export function aimVelocity(from: Vec, tx: number, ty: number, speed: number): Vec {
  return aimAt(from, { x: tx, y: ty, z: 0 }, speed)
}

/** 코트 안 한 점(벽 위의 점)으로 날아가는 속도 */
export function aimAt(from: Vec, to: Vec, speed: number): Vec {
  const dist = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z)
  const t = Math.max(0.25, dist / speed)
  return {
    x: (to.x - from.x) / t,
    y: (to.y - from.y + 0.5 * G * t * t) / t,
    z: (to.z - from.z) / t,
  }
}

// 한 번의 샷이 어떻게 끝나는지: 앞벽에 제대로 맞기 전에는 친 사람 실수, 그 뒤 두 번 튀면 받는 사람 실수
export type ShotFault = 'down' | 'tin' | 'out' | 'serve-fault'

export class Shot {
  frontOk = false
  floorAfterFront = 0
  backWall = false // 앞벽을 맞고 온 공이 뒷벽에도 맞았는지
  boast = false // 앞벽보다 옆벽을 먼저 맞힌 샷(보스트)
  by: Hitter
  serve: boolean
  constructor(by: Hitter, serve = false) {
    this.by = by
    this.serve = serve
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

/** 샷 하나를 끝까지 굴려 어떻게 끝나는지 */
export function outcome(ball: Ball, shot: Shot, maxT = 5, dt = 1 / 120) {
  const b: Ball = { p: { ...ball.p }, v: { ...ball.v } }
  const s = Object.assign(new Shot(shot.by, shot.serve), shot)
  for (let t = 0; t < maxT; t += dt) {
    for (const e of step(b, dt)) {
      const r = s.apply(e)
      if (r) return r
    }
  }
  return null
}

// 받는 쪽(카메라 쪽, 뒤 코트)이 칠 수 있는 범위.
// 뒷벽을 맞고 앞으로 튀어나오는 공도 두 번 튀기 전이면 칠 수 있고, 그때는 공을 따라 조금 더 앞까지 나간다
// 상대 보스트는 앞 코트로 떨어지니 앞으로 달려 나가 친다
export function inYourReach(b: Ball, shot: Shot) {
  if (!shot.frontOk || shot.floorAfterFront > 1 || b.p.y > 2.4) return false
  if (shot.boast) return b.p.z >= 1.6 && b.p.y <= 1.6
  return b.p.z >= (shot.backWall ? 3.8 : 5.3)
}

export type Trace = { result: ReturnType<Shot['apply']>; boast: boolean; front: Vec | null; land: Vec | null }

/** 샷을 끝까지 굴려 앞벽에 맞은 곳, 앞벽 뒤 처음 떨어진 곳까지 알려 준다 */
export function trace(ball: Ball, shot: Shot, maxT = 5, dt = 1 / 120): Trace {
  const b: Ball = { p: { ...ball.p }, v: { ...ball.v } }
  const s = Object.assign(new Shot(shot.by, shot.serve), shot)
  let front: Vec | null = null
  let land: Vec | null = null
  for (let t = 0; t < maxT; t += dt) {
    for (const e of step(b, dt)) {
      const was = s.frontOk
      const r = s.apply(e)
      if (!was && s.frontOk) front = e.at
      if (was && e.hit === 'floor' && !land) land = e.at
      if (r) return { result: r, boast: s.boast, front, land }
    }
  }
  return { result: null, boast: s.boast, front, land }
}

/**
 * 보스트 후보: 가까운 옆벽을 먼저 맞혀 반대쪽 앞 코트로 떨어지는 샷.
 * 앞벽에 낮게 맞고 앞쪽에 떨어질수록 좋은 보스트다.
 */
export function boastCandidates(from: Vec, by: Hitter, rand = Math.random) {
  const side = Math.sign(from.x) || 1
  const out: { v: Vec; score: number; trace: Trace }[] = []
  for (let i = 0; i < 70; i++) {
    const sz = from.z - (0.5 + rand() * 2.8)
    const sy = 0.7 + rand() * 1.5
    const speed = 10 + rand() * 6
    const v = aimAt(from, { x: side * (COURT.halfWidth - BALL_R), y: sy, z: sz }, speed)
    const tr = trace({ p: { ...from }, v }, new Shot(by))
    if (tr.result !== 'double' || !tr.boast || !tr.front || !tr.land) continue
    if (tr.front.y > 2.4 || tr.land.z > 4.8) continue
    const score = -tr.front.y - tr.land.z * 0.4 + (Math.sign(tr.land.x) === -side ? 0.6 : 0)
    out.push({ v, score, trace: tr })
  }
  return out.sort((a, b) => b.score - a.score)
}

/** 내 보스트: 타이밍이 좋을수록 상위 후보에서 고른다. 보스트가 안 되는 자리면 null */
export function yourBoast(from: Vec, quality: number, rand = Math.random): Vec | null {
  const c = boastCandidates(from, 'you', rand)
  if (c.length === 0) return null
  const spread = Math.max(1, Math.round((1 - quality) * Math.min(8, c.length)))
  return c[Math.floor(rand() * Math.min(spread, c.length))].v
}

/** 뒤 코트, 옆벽 가까이에서만 보스트를 칠 수 있다 */
export function canBoast(p: Vec) {
  return Math.abs(p.x) > 1.5 && p.z > 5.6
}

export type Window = { start: number; length: number; at: Vec }

/** 공을 앞으로 굴려 보며 상대가 칠 수 있는 첫 구간을 찾는다(없으면 null) */
export function findReachWindow(ball: Ball, shot: Shot, reach: (b: Ball, s: Shot) => boolean, maxT = 4, dt = 1 / 120): Window | null {
  const b: Ball = { p: { ...ball.p }, v: { ...ball.v } }
  const s = Object.assign(new Shot(shot.by, shot.serve), shot)
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

const CPU_MIN_WINDOW: Record<Difficulty, number> = { easy: 0.55, normal: 0.42, hard: 0.3 }

/** 상대(CPU)의 샷을 고른다: 내가 칠 수 있는 구간이 생기는 후보 중에서 난이도에 맞춰 */
export function cpuShot(from: Vec, diff: Difficulty, serve: boolean, rand = Math.random): Vec {
  const boast = cpuBoast(from, diff, serve, rand)
  if (boast) return boast
  const cands: { v: Vec; score: number }[] = []
  for (let i = 0; i < 60; i++) {
    const tx = (rand() * 2 - 1) * 2.6
    const ty = serve ? 2.2 + rand() * 1.4 : 0.9 + rand() * 2.6
    const speed = 9 + rand() * (diff === 'hard' ? 8 : diff === 'normal' ? 6 : 3.5)
    const v = aimVelocity(from, tx, ty, speed)
    const shot = new Shot('cpu', serve)
    const w = findReachWindow({ p: { ...from }, v: { ...v } }, shot, inYourReach)
    if (!w || w.length < CPU_MIN_WINDOW[diff]) continue
    // 내가 안 쳐도 아웃이 되는 공은 고르지 않는다
    if (outcome({ p: { ...from }, v: { ...v } }, new Shot('cpu', serve)) !== 'double') continue
    const tight = Math.abs(w.at.x) / COURT.halfWidth
    const score =
      diff === 'easy'
        ? w.length - tight - w.start * 0.2
        : diff === 'normal'
          ? -Math.abs(w.length - 0.7) + tight * 0.4
          : -w.length - w.start * 0.5 + tight * 0.8
    cands.push({ v, score })
  }
  if (cands.length === 0) return aimVelocity(from, 0, 2.6, 10)
  cands.sort((a, b) => b.score - a.score)
  return cands[Math.floor(rand() * Math.min(4, cands.length))].v
}

const CPU_BOAST: Record<Difficulty, number> = { easy: 0.12, normal: 0.25, hard: 0.35 }

/** 뒤 구석에 몰린 상대는 가끔 보스트로 빠져나온다. 내가 앞으로 달려가 칠 시간이 있는 것만 */
function cpuBoast(from: Vec, diff: Difficulty, serve: boolean, rand: () => number): Vec | null {
  if (serve || !canBoast(from) || rand() > CPU_BOAST[diff]) return null
  for (const c of boastCandidates(from, 'cpu', rand)) {
    const w = findReachWindow({ p: { ...from }, v: { ...c.v } }, new Shot('cpu'), inYourReach)
    if (w && w.length >= CPU_MIN_WINDOW[diff] + 0.1) return c.v
  }
  return null
}

/**
 * 내 샷: 공의 어디를 쳤는지(dx, dy: 공 중심 기준 -1~1, 화면 아래가 +)와
 * 타이밍 품질(0~1)로 앞벽 목표점을 정한다.
 * 공의 왼쪽을 치면 오른쪽으로, 아래쪽을 치면 높게 날아간다.
 */
export function yourShot(from: Vec, dx: number, dy: number, quality: number, rand = Math.random) {
  const noise = (1 - quality) * 0.9
  const tx = clamp(-dx * 2.8 + from.x * 0.15 + (rand() * 2 - 1) * noise, -2.95, 2.95)
  const ty = clamp(1.55 + dy * 1.5 + (rand() * 2 - 1) * noise * 0.8, 0.2, 5)
  const speed = 11 + quality * 5
  return { v: aimVelocity(from, tx, ty, speed), target: { x: tx, y: ty } }
}

/** 타이밍 품질: 공이 허리 높이, 뒤 코트 깊숙이 왔을 때 칠수록 좋다(뒷벽에서 나온 공은 조금 앞에서 쳐도 된다) */
export function timingQuality(p: Vec, offBackWall = false, frontCourt = false) {
  const depth = frontCourt ? 0.75 : 1 - Math.min(1, Math.abs(p.z - (offBackWall ? 7.4 : 8)) / (offBackWall ? 3 : 2.4))
  const height = 1 - Math.min(1, Math.abs(p.y - 0.9) / 1.4)
  return clamp(0.25 + depth * 0.45 + height * 0.3, 0, 1)
}

const CPU_BASE: Record<Difficulty, number> = { easy: 0.72, normal: 0.84, hard: 0.93 }

/** 내 샷이 얼마나 까다로운지에 따라 상대가 받아낼 확률 */
export function cpuReturnChance(diff: Difficulty, frontY: number, speed: number, strikeAt: Vec) {
  let p = CPU_BASE[diff]
  if (frontY < 0.85) p -= 0.18 // 틴 바로 위로 낮게
  if (speed > 14.5) p -= 0.08
  if (Math.abs(strikeAt.x) > COURT.halfWidth - 0.45) p -= 0.15 // 벽에 붙은 공
  if (strikeAt.z < 3) p -= 0.22 // 앞에서 죽는 드롭
  return clamp(p, 0.15, 0.97)
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
