import { clamp, type Vec } from './physics'

// 상대 선수의 몸. 공을 칠 곳과 시각을 미리 받아 스플릿 스텝 → 이동 → 런지 → 스윙 → T로 복귀를 보여 준다.
// 관절을 하나하나 맞추기보다 매끄럽게 보이도록 단순하게 만든다:
// 걸음은 이동한 거리에 맞춰 다리를 앞뒤로 흔들고, 런지는 한 자세로 부드럽게 섞고,
// 스윙은 팔과 라켓이 어깨를 축으로 큰 호를 그린다. 앞벽을 보고 서 있으므로 오른손(라켓)은 +x 쪽이다.

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

export const BODY = { thigh: 0.46, shin: 0.46, torso: 0.5, arm: 0.52, racket: 0.62, headR: 0.11, ankle: 0.07 }
export const T_SPOT = { x: 0, z: 5.6 }

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const mul = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k, z: a.z * k })
const len = (a: Vec) => Math.hypot(a.x, a.y, a.z)
const norm = (a: Vec) => mul(a, 1 / (len(a) || 1))
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z
/** 두 방향 사이를 고르게 돈다 */
const turn = (a: Vec, b: Vec, k: number) => norm(add(mul(a, 1 - k), mul(b, k)))
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

export class CpuBody {
  root: P2 = { ...T_SPOT }
  vel: P2 = { x: 0, z: 0 }
  target: P2 = { ...T_SPOT }
  speed = 3
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
    const side: 1 | -1 = at.x >= this.root.x - 0.15 ? 1 : -1
    // 공이 라켓 쪽 옆에 오게 선다. 백핸드는 라켓 쥔 어깨가 공에서 멀어 조금 더 붙는다
    const stand = { x: clamp(at.x - side * (side > 0 ? 0.92 : 0.6), -2.85, 2.85), z: clamp(at.z + 0.55, 1.2, 9.2) }
    // 앞 코트는 라켓 쪽 발로 런지, 뒤 코트 포핸드는 왼발이 앞으로(닫힌 자세), 백핸드는 오른발이 앞으로
    const lead: 0 | 1 = side > 0 ? (at.z < 5 ? 1 : 0) : 1
    const lunge = { x: clamp(at.x - side * 0.45, -3, 3), z: clamp(at.z + 0.2, 0.8, 9.4) }
    const dist = Math.hypot(stand.x - this.root.x, stand.z - this.root.z)
    this.target = stand
    this.speed = clamp(dist / Math.max(0.25, inT - 0.35), 1.5, swingIt ? 6.5 : 3.5)
    this.swing = { t: inT, side, at: { ...at }, lead, lunge, swingIt }
  }

  /** T로 돌아간다 */
  recover() {
    this.target = { ...T_SPOT }
    this.speed = 2.8
  }

  update(dt: number) {
    if (dt <= 0) return
    const s = this.swing
    if (s) {
      s.t -= dt
      if (s.t < -0.5) {
        this.swing = null
        this.recover()
      }
    }
    if (this.hop < 1) this.hop = Math.min(1, this.hop + dt / 0.24)

    // 몸통: 목표를 향해 부드럽게 가속하고 다가가면 줄인다
    const dx = this.target.x - this.root.x
    const dz = this.target.z - this.root.z
    const d = Math.hypot(dx, dz)
    const want = d < 0.01 ? 0 : Math.min(this.speed, d * 5)
    const k = Math.min(1, dt * 7)
    this.vel.x += ((d ? (dx / d) * want : 0) - this.vel.x) * k
    this.vel.z += ((d ? (dz / d) * want : 0) - this.vel.z) * k
    this.root.x += this.vel.x * dt
    this.root.z += this.vel.z * dt
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

    // 라켓 팔: 어깨에서 뻗은 방향 하나로 팔과 라켓을 함께 돌린다(팔꿈치는 살짝만 굽힘)
    const ready = norm({ x: 0.45, y: 0.15, z: -0.85 })
    const back = side > 0 ? norm({ x: 0.55, y: 0.85, z: 0.45 }) : norm({ x: -0.85, y: 0.7, z: 0.25 })
    const contact = s ? norm(sub(s.at, shoulderR)) : ready
    const follow = side > 0 ? norm({ x: -0.75, y: 0.55, z: -0.45 }) : norm({ x: 0.75, y: 0.75, z: -0.2 })
    const keys = [ready, back, contact, follow, ready]
    const dir = s && s.swingIt ? turn(keys[i], keys[i + 1], f) : ready
    const handR = add(shoulderR, mul(dir, BODY.arm))
    const elbowR = add(add(shoulderR, mul(dir, BODY.arm * 0.5)), { x: 0, y: -0.05, z: 0.02 })
    const racketTip = add(handR, mul(dir, BODY.racket))

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
