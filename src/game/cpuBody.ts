import { clamp, type Vec } from './physics'

// 상대 선수의 몸. 공을 칠 곳과 시각을 미리 받아, 스플릿 스텝 → 이동 → 런지 → 백스윙 → 임팩트 → 팔로스루 → T로 복귀를
// 관절 단위로 계산한다. 발은 땅에 붙어 있다가 몸에서 멀어지면 한 발씩 옮기고(걷기), 무릎과 팔꿈치는 IK로 정한다.
// 앞벽을 보고 서 있으므로 오른손(라켓)은 +x 쪽이다.

type P2 = { x: number; z: number }
type Foot = { at: P2; from: P2; to: P2; t: number; dur: number; moving: boolean }

export type Joints = {
  hipL: Vec
  hipR: Vec
  kneeL: Vec
  kneeR: Vec
  ankleL: Vec
  ankleR: Vec
  toeL: Vec
  toeR: Vec
  pelvis: Vec
  chest: Vec
  head: Vec
  shoulderL: Vec
  shoulderR: Vec
  elbowL: Vec
  elbowR: Vec
  handL: Vec
  handR: Vec
  racketTip: Vec
}

export const BODY = { thigh: 0.46, shin: 0.46, torso: 0.5, upper: 0.29, fore: 0.27, racket: 0.62, headR: 0.11, ankle: 0.07 }
export const T_SPOT = { x: 0, z: 5.6 }

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const mul = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k, z: a.z * k })
const len = (a: Vec) => Math.hypot(a.x, a.y, a.z)
const norm = (a: Vec) => mul(a, 1 / (len(a) || 1))
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z
const mix = (a: Vec, b: Vec, k: number): Vec => add(a, mul(sub(b, a), k))
const smooth = (k: number) => {
  const t = clamp(k, 0, 1)
  return t * t * (3 - 2 * t)
}

/** 두 마디(허벅지·정강이, 위팔·아래팔)가 끝점에 닿게 하는 가운데 관절. pole 쪽으로 꺾인다 */
export function ik(base: Vec, end: Vec, l1: number, l2: number, pole: Vec) {
  const d0 = len(sub(end, base))
  const d = clamp(d0, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3)
  const u = norm(sub(end, base))
  const a = (l1 * l1 + d * d - l2 * l2) / (2 * d)
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a))
  const n = norm(sub(pole, mul(u, dot(pole, u))))
  const mid = add(add(base, mul(u, a)), mul(n, h))
  return { mid, end: add(base, mul(u, Math.min(d0, l1 + l2 - 1e-3))) }
}

type Swing = {
  t: number // 임팩트까지 남은 시간(지나면 음수)
  side: 1 | -1 // 1 포핸드(공이 오른쪽), -1 백핸드
  at: Vec // 공을 칠 곳
  lead: 0 | 1 // 런지하는 발(0 왼발, 1 오른발)
  lunge: P2
  swingIt: boolean // 못 받는 공이면 휘두르지 않고 쫓아가기만
}

export class CpuBody {
  root: P2 = { ...T_SPOT }
  vel: P2 = { x: 0, z: 0 }
  target: P2 = { ...T_SPOT }
  speed = 3
  feet: [Foot, Foot]
  hop = 1 // 스플릿 스텝 진행(1이면 끝)
  swing: Swing | null = null
  private lastStep = 0

  constructor() {
    const f = (x: number): Foot => ({ at: { x, z: T_SPOT.z }, from: { x, z: T_SPOT.z }, to: { x, z: T_SPOT.z }, t: 0, dur: 0.2, moving: false })
    this.feet = [f(T_SPOT.x - 0.22), f(T_SPOT.x + 0.22)]
  }

  /** 한 번에 그 자리로 옮긴다(서브 준비) */
  placeAt(p: P2) {
    this.root = { ...p }
    this.target = { ...p }
    this.vel = { x: 0, z: 0 }
    this.feet.forEach((f, i) => {
      const at = { x: p.x + (i ? 0.24 : -0.24), z: p.z + (i ? 0.05 : -0.05) }
      Object.assign(f, { at, from: at, to: at, moving: false })
    })
    this.swing = null
  }

  /** 상대가 공을 친 순간: 작게 뛰어 양발로 착지한다 */
  splitStep() {
    this.hop = 0
  }

  /** at에서 inT초 뒤에 공을 친다. 그 전에 그 자리로 가서 런지한다 */
  plan(at: Vec, inT: number, swingIt = true) {
    const side: 1 | -1 = at.x >= this.root.x - 0.15 ? 1 : -1
    // 공이 몸 옆(라켓 쪽)에 오게: 몸은 공에서 라켓 반대쪽으로 0.75m, 공보다 조금 뒤
    // 백핸드는 라켓 쥔 어깨가 공에서 더 멀어 조금 더 붙어 선다
    const stand = { x: clamp(at.x - side * (side > 0 ? 0.78 : 0.58), -2.85, 2.85), z: clamp(at.z + 0.45, 1.2, 9.2) }
    // 앞 코트는 라켓 쪽 발로 런지, 뒤 코트 포핸드는 왼발이 앞으로(닫힌 자세), 백핸드는 오른발이 앞으로
    const front = at.z < 5
    const lead: 0 | 1 = side > 0 ? (front ? 1 : 0) : 1
    const lunge = { x: clamp(at.x - side * (lead === 1 && side > 0 ? 0.32 : 0.5), -3, 3), z: clamp(at.z + 0.1, 0.8, 9.4) }
    const dist = Math.hypot(stand.x - this.root.x, stand.z - this.root.z)
    this.target = stand
    // 런지 전에 자리에 닿도록(가속하는 시간까지 감안해) 여유 있게 서두른다
    this.speed = clamp(dist / Math.max(0.2, inT - 0.5), 1.5, swingIt ? 7.5 : 4)
    this.swing = { t: inT, side, at: { ...at }, lead, lunge, swingIt }
  }

  /** T로 돌아간다 */
  recover() {
    this.target = { ...T_SPOT }
    this.speed = 3.2
  }

  update(dt: number) {
    if (dt <= 0) return
    const s = this.swing
    if (s) {
      s.t -= dt
      if (s.t < -0.55) {
        this.swing = null
        this.recover()
      }
    }
    if (this.hop < 1) this.hop = Math.min(1, this.hop + dt / 0.22)

    // 몸통 이동: 목표를 향해 가속하고, 다가가면 줄인다
    const dx = this.target.x - this.root.x
    const dz = this.target.z - this.root.z
    const d = Math.hypot(dx, dz)
    const want = d < 0.02 ? 0 : Math.min(this.speed, d * 6)
    const vx = d ? (dx / d) * want : 0
    const vz = d ? (dz / d) * want : 0
    const k = Math.min(1, dt * 9)
    this.vel.x += (vx - this.vel.x) * k
    this.vel.z += (vz - this.vel.z) * k
    // 런지 중에는 몸이 앞발 쪽으로 실린다
    const lunging = s && s.swingIt && s.t < 0.36 && s.t > -0.3
    if (!lunging || !s) {
      this.root.x += this.vel.x * dt
      this.root.z += this.vel.z * dt
    } else {
      const lead = this.feet[s.lead].to
      const back = this.feet[1 - s.lead].at
      const goal = { x: back.x * 0.42 + lead.x * 0.58, z: back.z * 0.42 + lead.z * 0.58 }
      this.root.x += (goal.x - this.root.x) * Math.min(1, dt * 10)
      this.root.z += (goal.z - this.root.z) * Math.min(1, dt * 10)
      this.vel = { x: 0, z: 0 }
    }

    // 발: 움직이는 발을 마저 옮기고, 아니면 몸에서 가장 멀어진 발을 한 걸음
    for (const f of this.feet) {
      if (!f.moving) continue
      f.t += dt / f.dur
      const e = smooth(f.t)
      f.at = { x: f.from.x + (f.to.x - f.from.x) * e, z: f.from.z + (f.to.z - f.from.z) * e }
      if (f.t >= 1) {
        f.moving = false
        f.at = { ...f.to }
      }
    }
    const busy = this.feet.some((f) => f.moving)
    if (lunging && s) {
      const f = this.feet[s.lead]
      const back = this.feet[1 - s.lead]
      // 앞발은 뒷발에서 1.25m 안쪽까지만 내딛는다(모자란 거리는 팔과 라켓으로)
      const reachTo = (() => {
        const dx = s.lunge.x - back.at.x
        const dz = s.lunge.z - back.at.z
        const d = Math.hypot(dx, dz)
        return d <= 1.25 || back.moving ? s.lunge : { x: back.at.x + (dx / d) * 1.25, z: back.at.z + (dz / d) * 1.25 }
      })()
      const onLunge = Math.hypot(f.to.x - reachTo.x, f.to.z - reachTo.z) < 0.05
      // 보폭은 1.25m까지: 시간이 있으면 뒷발을 먼저 끌어온다(다리가 찢어지지 않게)
      const gap = Math.hypot(back.at.x - s.lunge.x, back.at.z - s.lunge.z)
      if (!onLunge && !f.moving && !back.moving && gap > 1.3 && s.t > 0.24) {
        const k = 1.05 / gap
        this.stepFoot((1 - s.lead) as 0 | 1, { x: s.lunge.x + (back.at.x - s.lunge.x) * k, z: s.lunge.z + (back.at.z - s.lunge.z) * k }, 0.12)
      } else if (!onLunge && !back.moving) this.stepFoot(s.lead, reachTo, clamp(s.t - 0.04, 0.12, 0.22)) // 걷던 발도 런지로 바꿔 내딛는다
      return
    }
    if (busy) return
    const wide = this.hop < 1 ? 0.3 : 0.24
    const lead = Math.hypot(this.vel.x, this.vel.z)
    const homes: P2[] = [-1, 1].map((side) => ({ x: this.root.x + side * wide + this.vel.x * 0.14, z: this.root.z + this.vel.z * 0.14 }))
    const err = this.feet.map((f, i) => Math.hypot(f.at.x - homes[i].x, f.at.z - homes[i].z))
    // 서 있을 땐 조금만 어긋나도 맞추고, 움직일 땐 보폭이 생기게 더 기다린다
    const limit = lead > 0.6 ? 0.34 : 0.12
    let i = err[0] > err[1] ? 0 : 1
    if (err[1 - i] > limit && i === this.lastStep) i = 1 - i
    if (err[i] > limit) this.stepFoot(i as 0 | 1, homes[i], clamp(0.12 + err[i] * 0.12, 0.12, 0.22))
  }

  private stepFoot(i: 0 | 1, to: P2, dur: number) {
    const f = this.feet[i]
    Object.assign(f, { from: { ...f.at }, to: { x: clamp(to.x, -3.05, 3.05), z: clamp(to.z, 0.5, 9.55) }, t: 0, dur, moving: true })
    this.lastStep = i
  }

  /** 지금 자세의 관절 위치(미터, 코트 좌표) */
  joints(): Joints {
    const s = this.swing
    const hopY = this.hop < 1 ? Math.sin(Math.PI * this.hop) * 0.07 : 0
    const ankle = (f: Foot): Vec => ({ x: f.at.x, y: BODY.ankle + hopY + (f.moving ? Math.sin(Math.PI * clamp(f.t, 0, 1)) * 0.1 : 0), z: f.at.z })
    const ankleL = ankle(this.feet[0])
    const ankleR = ankle(this.feet[1])

    // 엉덩이 높이: 두 다리가 닿는 높이 중 낮은 쪽, 서 있을 땐 무릎을 살짝 굽힌다
    const legs = (BODY.thigh + BODY.shin) * 0.985
    const crouch = 0.07 + (s && s.swingIt && s.t < 0.6 && s.t > -0.35 ? 0.05 : 0)
    let hipY = legs - crouch + BODY.ankle + hopY
    for (const [a, sx] of [
      [ankleL, -0.1],
      [ankleR, 0.1],
    ] as const) {
      const h = Math.hypot(a.x - (this.root.x + sx), a.z - this.root.z)
      hipY = Math.min(hipY, a.y + Math.sqrt(Math.max(0.04, legs * legs - h * h)))
    }
    const pelvis = { x: this.root.x, y: hipY, z: this.root.z }

    // 스윙 타이밍에 따른 몸통 회전(yaw)과 숙임, 라켓 머리의 목표
    const side = s?.side ?? 1
    const t = s && s.swingIt ? s.t : 9
    const lunge = s && s.swingIt ? smooth((0.45 - t) / 0.3) * (1 - smooth((-0.15 - t) / 0.35)) : 0
    const lean = 0.18 + lunge * 0.42
    const yawOf = (k: { back: number; hit: number; follow: number }) => {
      if (t > 0.85) return 0
      if (t > 0.55) return k.back * smooth((0.85 - t) / 0.3)
      if (t > 0.14) return k.back
      if (t > 0) return k.back + (k.hit - k.back) * ((0.14 - t) / 0.14) ** 2
      if (t > -0.25) return k.hit + (k.follow - k.hit) * smooth(-t / 0.25)
      return k.follow * (1 - smooth((-0.25 - t) / 0.3))
    }
    const yaw = side * yawOf({ back: 0.75, hit: 0.1, follow: -0.55 })
    const forward = { x: 0, y: 0, z: -1 }
    const up = { x: 0, y: Math.cos(lean), z: -Math.sin(lean) }
    // 런지할 때는 공 쪽으로도 기운다
    const sideLean = s && s.swingIt ? side * lunge * 0.12 : 0
    const chest = add(pelvis, mul(norm({ x: sideLean, y: up.y, z: up.z }), BODY.torso))
    const lateral = { x: Math.cos(yaw), y: 0, z: Math.sin(yaw) }
    const shoulderR = add(chest, mul(lateral, 0.19))
    const shoulderL = sub(chest, mul(lateral, 0.19))
    const head = add(chest, mul(norm({ x: sideLean * 0.5, y: up.y + 0.2, z: up.z - 0.05 }), 0.24))
    const hipL = add(pelvis, { x: -0.1 * Math.cos(yaw * 0.4), y: 0, z: -0.1 * Math.sin(yaw * 0.4) })
    const hipR = add(pelvis, { x: 0.1 * Math.cos(yaw * 0.4), y: 0, z: 0.1 * Math.sin(yaw * 0.4) })

    // 라켓 머리: 준비 → 백스윙(높이, 뒤로) → 공 → 팔로스루(몸 반대쪽 위) → 준비
    const ready = add(chest, { x: 0.32, y: 0.12, z: -0.42 })
    const back = add(chest, side > 0 ? { x: 0.55, y: 0.5, z: 0.32 } : { x: -0.5, y: 0.45, z: 0.28 })
    const follow = add(chest, side > 0 ? { x: -0.42, y: 0.42, z: -0.32 } : { x: 0.62, y: 0.5, z: -0.18 })
    let racket = ready
    if (s && s.swingIt) {
      if (t > 0.85) racket = ready
      else if (t > 0.55) racket = mix(ready, back, smooth((0.85 - t) / 0.3))
      else if (t > 0.14) racket = back
      else if (t > 0) racket = mix(back, s.at, ((0.14 - t) / 0.14) ** 2)
      else if (t > -0.25) racket = mix(s.at, follow, smooth(-t / 0.25))
      else racket = mix(follow, ready, smooth((-0.25 - t) / 0.3))
    }
    // 손은 어깨에서 라켓 머리 쪽으로, 라켓 길이만큼 덜 간 곳
    const toR = sub(racket, shoulderR)
    const reach = clamp(len(toR) - BODY.racket * 0.72, 0.22, BODY.upper + BODY.fore - 0.02)
    const handR = add(shoulderR, mul(norm(toR), reach))
    const elbowR = ik(shoulderR, handR, BODY.upper, BODY.fore, { x: 0.4, y: -1, z: 0.3 }).mid
    const racketTip = add(handR, mul(norm(sub(racket, handR)), BODY.racket))

    // 반대 팔은 균형: 포핸드 땐 앞으로, 백핸드 땐 뒤로
    const free = s && s.swingIt && t < 0.9 && t > -0.5 ? (side > 0 ? { x: -0.25, y: -0.12, z: -0.42 } : { x: -0.35, y: -0.2, z: 0.3 }) : { x: -0.22, y: -0.42, z: -0.18 }
    const handL = add(shoulderL, free)
    const fixedL = ik(shoulderL, handL, BODY.upper, BODY.fore, { x: -0.5, y: -1, z: 0.2 })

    // 다리가 닿지 않을 만큼 먼 발은 닿는 데까지만 뻗는다(다리가 늘어나 보이지 않게)
    const legL = ik(hipL, ankleL, BODY.thigh, BODY.shin, add(forward, { x: -0.25, y: 0, z: 0 }))
    const legR = ik(hipR, ankleR, BODY.thigh, BODY.shin, add(forward, { x: 0.25, y: 0, z: 0 }))
    const kneeL = legL.mid
    const kneeR = legR.mid
    const aL = legL.end
    const aR = legR.end
    const toe = (a: Vec, out: number): Vec => ({ x: a.x + out * 0.04, y: Math.max(0.02, a.y - 0.05), z: a.z - 0.17 })
    return {
      hipL,
      hipR,
      kneeL,
      kneeR,
      ankleL: aL,
      ankleR: aR,
      toeL: toe(aL, -1),
      toeR: toe(aR, 1),
      pelvis,
      chest,
      head,
      shoulderL,
      shoulderR,
      elbowL: fixedL.mid,
      elbowR,
      handL: fixedL.end,
      handR,
      racketTip,
    }
  }
}
