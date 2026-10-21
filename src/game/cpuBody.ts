import { clamp, type Vec } from './physics'

// 상대 선수의 몸. 공을 칠 곳과 시각을 미리 받아 스플릿 스텝 → 이동 → 런지 → 스윙 → T로 복귀를 보여 준다.
// 관절을 하나하나 맞추기보다 매끄럽게 보이도록 단순하게 만든다:
// 걸음은 이동한 거리에 맞춰 다리를 앞뒤로 흔들고, 런지는 한 자세로 부드럽게 섞고,
// 스윙은 타구 쪽에 맞춰 팔을 준비하고, 손목과 팔꿈치를 부드럽게 굽혀 큰 호를 그린다. 앞벽을 보고 서 있으므로 오른손(라켓)은 +x 쪽이다.

type P2 = { x: number; z: number }

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

export const BODY = { thigh: 0.46, shin: 0.46, torso: 0.5, arm: 0.52, upperArm: 0.28, forearm: 0.27, racket: 0.62, headR: 0.11, ankle: 0.07 }
export const T_SPOT = { x: 0, z: 5.6 }

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const mul = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k, z: a.z * k })
const len = (a: Vec) => Math.hypot(a.x, a.y, a.z)
const norm = (a: Vec) => mul(a, 1 / (len(a) || 1))
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z
/** 두 방향 사이를 고르게 돈다 */
const turn = (a: Vec, b: Vec, k: number) => {
  const cosine = clamp(dot(a, b), -1, 1)
  if (cosine > 0.999) return norm(add(mul(a, 1 - k), mul(b, k)))
  const angle = Math.acos(cosine)
  // 반대 방향으로 돌아도 중간에 방향 벡터가 0이 되거나 갑자기 뒤집히지 않는다.
  const axis = Math.abs(a.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }
  const tangent = cosine < -0.999 ? norm(sub(axis, mul(a, dot(axis, a)))) : norm(sub(b, mul(a, cosine)))
  return add(mul(a, Math.cos(angle * k)), mul(tangent, Math.sin(angle * k)))
}
const smooth = (k: number) => {
  const t = clamp(k, 0, 1)
  return t * t * (3 - 2 * t)
}

/** 두 마디(허벅지·정강이)가 끝점에 닿게 하는 가운데 관절. pole 쪽으로 꺾인다 */
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
  lunge: P2 // 앞발을 디딜 곳
  swingIt: boolean // 못 받는 공이면 휘두르지 않고 쫓아가기만
}

/** 공에서 팔·라켓 길이만큼 옆으로 떨어진 타구 자세. 예측과 실제 이동이 함께 쓴다. */
export function strikeStance(at: Vec, root: P2) {
  const side: 1 | -1 = at.x >= root.x - 0.15 ? 1 : -1
  return { side, stand: { x: clamp(at.x - side * (side > 0 ? 0.92 : 0.6), -2.85, 2.85), z: clamp(at.z + 0.55, 1.2, 9.2) } }
}

/** 목표에 다가가면 감속한다. 예측과 렌더링 프레임의 이동에 같은 식을 쓴다. */
function move(root: P2, vel: P2, target: P2, speed: number, dt: number) {
  const dx = target.x - root.x,
    dz = target.z - root.z
  const d = Math.hypot(dx, dz)
  const want = d < 0.01 ? 0 : Math.min(speed, d * 8)
  const k = Math.min(1, dt * 12)
  vel.x += ((d ? (dx / d) * want : 0) - vel.x) * k
  vel.z += ((d ? (dz / d) * want : 0) - vel.z) * k
  root.x += vel.x * dt
  root.z += vel.z * dt
}

export class CpuBody {
  root: P2 = { ...T_SPOT }
  vel: P2 = { x: 0, z: 0 }
  target: P2 = { ...T_SPOT }
  speed = 3
  maxSpeed = 6.5
  recoverySpeed = 2.8
  recoveryDelay = 0.5
  private earlyArrival = false
  hop = 1 // 스플릿 스텝 진행(1이면 끝)
  swing: Swing | null = null
  private phase = 0 // 걸음 주기
  private lungeW = 0 // 런지 자세가 섞인 정도

  /** 한 번에 그 자리로 옮긴다(서브 준비) */
  placeAt(p: P2) {
    this.root = { ...p }
    this.target = { ...p }
    this.vel = { x: 0, z: 0 }
    this.swing = null
    this.lungeW = 0
  }

  /** 상대가 공을 친 순간: 작게 뛰어 양발로 착지한다 */
  splitStep() {
    this.hop = 0
  }

  /** at에서 inT초 뒤에 공을 친다. 그 전에 공 옆으로 가서 런지한다 */
  plan(at: Vec, inT: number, swingIt = true) {
    const { side, stand } = strikeStance(at, this.root)
    // 앞 코트는 라켓 쪽 발로 런지, 뒤 코트 포핸드는 왼발이 앞으로(닫힌 자세), 백핸드는 오른발이 앞으로
    const lead: 0 | 1 = side > 0 ? (at.z < 5 ? 1 : 0) : 1
    const lunge = { x: clamp(at.x - side * 0.45, -3, 3), z: clamp(at.z + 0.2, 0.8, 9.4) }
    const dist = Math.hypot(stand.x - this.root.x, stand.z - this.root.z)
    this.target = stand
    this.speed = this.approachSpeed(dist, inT, swingIt ? this.maxSpeed : Math.min(3.5, this.maxSpeed))
    this.swing = { t: inT, side, at: { ...at }, lead, lunge, swingIt }
  }

  configure(level: { maxSpeed: number; recoverySpeed: number; recoveryDelay: number; earlyArrival?: boolean }) {
    this.maxSpeed = level.maxSpeed
    this.recoverySpeed = level.recoverySpeed
    this.recoveryDelay = level.recoveryDelay
    this.earlyArrival = level.earlyArrival ?? false
  }

  private approachSpeed(distance: number, inT: number, limit = this.maxSpeed) {
    // 플레이어처럼 일찍 도착해 준비한다. 공이 올 때까지 계속 걷게 해 회복을 막지 않는다.
    return this.earlyArrival ? limit : clamp(distance / Math.max(0.08, inT - 0.2), 1.5, limit)
  }

  /** 가속·감속을 포함해 스윙 시작 전에 타구 자세에 가까이 도착할 수 있는가 */
  canArrive(at: Vec, inT: number) {
    const { stand } = strikeStance(at, this.root)
    const root = { ...this.root },
      vel = { ...this.vel }
    const speed = this.approachSpeed(Math.hypot(stand.x - root.x, stand.z - root.z), inT)
    for (let t = 0; t < inT - 0.06; t += 1 / 120) move(root, vel, stand, speed, Math.min(1 / 120, inT - 0.06 - t))
    return Math.hypot(root.x - stand.x, root.z - stand.z) < 0.24
  }

  /** T로 돌아간다 */
  recover() {
    this.target = { ...T_SPOT }
    this.speed = this.recoverySpeed
  }

  update(dt: number) {
    if (dt <= 0) return
    const s = this.swing
    if (s) {
      s.t -= dt
      if (s.t < -this.recoveryDelay) this.recover()
      if (s.t < -Math.max(0.5, this.recoveryDelay + 0.1)) {
        this.swing = null
        this.recover()
      }
    }
    if (this.hop < 1) this.hop = Math.min(1, this.hop + dt / 0.24)

    move(this.root, this.vel, this.target, this.speed, dt)
    // 걸음: 1.1m에 한 주기(두 걸음)
    this.phase += (Math.hypot(this.vel.x, this.vel.z) * dt * Math.PI * 2) / 1.1

    const lunging = !!s && s.swingIt && s.t < 0.38 && s.t > -0.22
    this.lungeW += ((lunging ? 1 : 0) - this.lungeW) * Math.min(1, dt * (lunging ? 9 : 5))
  }

  /** 지금 두 발이 땅에 닿는 자리(왼발, 오른발) */
  feet(): [P2, P2] {
    return [this.foot(0).p, this.foot(1).p]
  }

  private foot(i: 0 | 1) {
    const sgn = i ? 1 : -1
    const v = Math.hypot(this.vel.x, this.vel.z)
    const dir = v > 0.05 ? { x: this.vel.x / v, z: this.vel.z / v } : { x: 0, z: -1 }
    // 서 있을 땐 어깨너비보다 조금 넓게, 뛸 때는 다리를 앞뒤로 흔든다
    const width = 0.2 + (v < 0.5 ? 0.06 : 0) + (this.hop < 1 ? 0.05 : 0)
    const swing = Math.sin(this.phase + (i ? Math.PI : 0)) * Math.min(0.3, v * 0.09)
    const lift = Math.max(0, Math.cos(this.phase + (i ? Math.PI : 0))) * Math.min(0.1, v * 0.03)
    let p = { x: this.root.x + sgn * width + dir.x * swing, z: this.root.z + dir.z * swing }
    // 런지: 앞발은 공 쪽으로 크게 내딛고 뒷발은 뒤에 남는다(보폭 1.25m 안쪽)
    const s = this.swing
    if (s && this.lungeW > 0.001) {
      const lx = s.lunge.x - this.root.x
      const lz = s.lunge.z - this.root.z
      const ll = Math.hypot(lx, lz)
      const reach = Math.min(ll, 0.75)
      const fwd = ll > 0.01 ? { x: lx / ll, z: lz / ll } : { x: 0, z: -1 }
      const pose = i === s.lead ? { x: this.root.x + fwd.x * reach, z: this.root.z + fwd.z * reach } : { x: this.root.x - fwd.x * 0.5 + sgn * 0.08, z: this.root.z - fwd.z * 0.5 }
      const w = smooth(this.lungeW)
      p = { x: p.x + (pose.x - p.x) * w, z: p.z + (pose.z - p.z) * w }
    }
    return { p: { x: clamp(p.x, -3.05, 3.05), z: clamp(p.z, 0.5, 9.55) }, lift: lift * (1 - this.lungeW) }
  }

  /** 지금 자세의 관절 위치(미터, 코트 좌표) */
  joints(): Joints {
    const s = this.swing
    const hopY = this.hop < 1 ? Math.sin(Math.PI * this.hop) * 0.06 : 0
    const v = Math.hypot(this.vel.x, this.vel.z)
    const lw = smooth(this.lungeW)
    const fl = this.foot(0)
    const fr = this.foot(1)
    const ankleL = { x: fl.p.x, y: BODY.ankle + fl.lift + hopY, z: fl.p.z }
    const ankleR = { x: fr.p.x, y: BODY.ankle + fr.lift + hopY, z: fr.p.z }

    // 엉덩이: 무릎을 살짝 굽힌 준비 자세, 뛸 때 조금 낮게, 런지 때 많이 낮게. 걸음마다 살짝 오르내린다
    const bob = Math.abs(Math.sin(this.phase)) * Math.min(0.03, v * 0.008)
    const hipY = 0.85 - Math.min(0.05, v * 0.012) - lw * 0.17 + bob + hopY
    // 런지 때 몸은 두 발 사이로
    const mid = { x: (fl.p.x + fr.p.x) / 2, z: (fl.p.z + fr.p.z) / 2 }
    const pelvis = { x: mid.x * lw + this.root.x * (1 - lw), y: hipY, z: mid.z * lw + this.root.z * (1 - lw) }

    const side = s?.side ?? 1
    const t = s && s.swingIt ? s.t : 9
    // 스윙 진행: 준비(0) → 백스윙(1) → 임팩트(2) → 팔로스루(3) → 준비(4)
    const stage =
      t > 0.8 ? 0 : t > 0.5 ? smooth((0.8 - t) / 0.3) : t > 0.13 ? 1 : t > 0 ? 1 + ((0.13 - t) / 0.13) ** 1.6 : t > -0.24 ? 2 + smooth(-t / 0.24) : 3 + smooth((-0.24 - t) / 0.26)
    const i = Math.min(3, Math.floor(stage))
    const f = stage - i

    // 몸통: 앞으로 숙이고, 스윙에 맞춰 어깨를 돌린다
    const lean = 0.16 + lw * 0.32
    const yawAt = [0, 0.7, 0.05, -0.5, 0]
    const yaw = side * (yawAt[i] + (yawAt[i + 1] - yawAt[i]) * f)
    const up = norm({ x: s && s.swingIt ? side * lw * 0.1 : 0, y: Math.cos(lean), z: -Math.sin(lean) })
    const chest = add(pelvis, mul(up, BODY.torso))
    const lateral = { x: Math.cos(yaw), y: 0, z: Math.sin(yaw) }
    const shoulderR = add(chest, mul(lateral, 0.19))
    const shoulderL = sub(chest, mul(lateral, 0.19))
    const head = add(chest, mul(norm(add(up, { x: 0, y: 0.25, z: 0 })), 0.24))
    const hipL = { x: pelvis.x - 0.1, y: pelvis.y, z: pelvis.z }
    const hipR = { x: pelvis.x + 0.1, y: pelvis.y, z: pelvis.z }

    // 오른손잡이: 백핸드는 오른팔을 가슴 앞으로 가져와 왼쪽에서 준비한다.
    // 손과 라켓의 경로를 분리해 팔 전체가 곧은 막대처럼 회전하지 않게 한다.
    const local = (p: Vec): Vec => ({ x: p.x * Math.cos(yaw) - p.z * Math.sin(yaw), y: p.y, z: p.x * Math.sin(yaw) + p.z * Math.cos(yaw) })
    const readyHand = local({ x: 0.04, y: -0.22, z: -0.34 })
    const backHand = local(side > 0 ? { x: 0.3, y: 0.12, z: 0.28 } : { x: -0.4, y: 0.08, z: -0.3 })
    const contact = s ? norm(sub(s.at, shoulderR)) : norm(readyHand)
    // 라켓 면이 공에 닿도록 타점 높이·거리에 맞춰 손을 뻗는다. 팔 길이는 일정하다.
    const extension = s ? clamp(len(sub(s.at, shoulderR)) - BODY.racket * 0.72, 0.18, BODY.arm) : BODY.arm
    const contactHand = mul(contact, extension)
    const followHand = local(side > 0 ? { x: -0.36, y: 0.14, z: -0.3 } : { x: 0.3, y: 0.22, z: -0.28 })
    const handKeys = [readyHand, backHand, contactHand, followHand, readyHand]
    const handOffset = s && s.swingIt ? add(mul(handKeys[i], 1 - f), mul(handKeys[i + 1], f)) : readyHand
    // 팔꿈치는 항상 몸 바깥·아래로 굽힌다. 백핸드 때도 뒤로 뒤집히지 않는다.
    const arm = ik(shoulderR, add(shoulderR, handOffset), BODY.upperArm, BODY.forearm, local({ x: 0.85, y: -0.55, z: -0.2 }))
    const handR = arm.end
    const elbowR = arm.mid
    const readyRacket = norm(local({ x: 0.18, y: 0.85, z: -0.35 }))
    const backRacket = norm(local(side > 0 ? { x: 0.25, y: 0.95, z: 0.2 } : { x: -0.4, y: 0.9, z: -0.15 }))
    const followRacket = norm(local(side > 0 ? { x: -0.7, y: 0.7, z: -0.2 } : { x: 0.65, y: 0.75, z: -0.15 }))
    const racketKeys = [readyRacket, backRacket, contact, followRacket, readyRacket]
    const racketDir = s && s.swingIt ? turn(racketKeys[i], racketKeys[i + 1], f) : readyRacket
    const racketTip = add(handR, mul(racketDir, BODY.racket))

    // 반대 팔: 준비 땐 앞에, 포핸드 스윙 땐 앞으로 뻗어 균형, 백핸드 땐 뒤로
    const relaxed = norm({ x: -0.35, y: -0.55, z: -0.6 })
    const balance = side > 0 ? norm({ x: -0.5, y: -0.1, z: -0.85 }) : norm({ x: -0.6, y: -0.35, z: 0.7 })
    const swingK = s && s.swingIt ? clamp(Math.min(stage, 4 - stage), 0, 1) : 0
    const dirL = turn(relaxed, balance, swingK)
    const handL = add(shoulderL, mul(dirL, BODY.arm * 0.95))
    const elbowL = add(add(shoulderL, mul(dirL, BODY.arm * 0.48)), { x: -0.03, y: -0.04, z: 0 })

    // 다리: 무릎은 앞(앞벽 쪽)으로 굽힌다
    const legL = ik(hipL, ankleL, BODY.thigh, BODY.shin, { x: -0.15, y: 0, z: -1 })
    const legR = ik(hipR, ankleR, BODY.thigh, BODY.shin, { x: 0.15, y: 0, z: -1 })
    const toe = (a: Vec, out: number): Vec => ({ x: a.x + out * 0.03, y: Math.max(0.03, a.y - 0.04), z: a.z - 0.16 })
    return {
      hipL,
      hipR,
      kneeL: legL.mid,
      kneeR: legR.mid,
      ankleL: legL.end,
      ankleR: legR.end,
      toeL: toe(legL.end, -1),
      toeR: toe(legR.end, 1),
      pelvis,
      chest,
      head,
      shoulderL,
      shoulderR,
      elbowL,
      elbowR,
      handL,
      handR,
      racketTip,
    }
  }
}
