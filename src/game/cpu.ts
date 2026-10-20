import { inCpuReach, sampleReach, type Ball, type Difficulty, type Shot, type Vec } from './physics'
import { CpuBody, strikeStance, T_SPOT } from './cpuBody'

// 수비·이동·공격을 난이도별로 함께 조정한다. 관절을 그리는 계산은 리턴 판단에 쓰지 않는다.
export const CPU_LEVEL = {
  easy: {
    returnRate: 0.985,
    pressure: 0.06,
    shortPenalty: 0.015,
    maxSpeed: 6.8,
    recoverySpeed: 3.8,
    recoveryDelay: 0.24,
    reaction: 0.12,
    error: 0.022,
    minWindow: 0.45,
    candidateOffset: 0.25,
  },
  normal: {
    returnRate: 0.997,
    pressure: 0.025,
    shortPenalty: 0.008,
    maxSpeed: 7.5,
    recoverySpeed: 4.6,
    recoveryDelay: 0.18,
    reaction: 0.08,
    error: 0.01,
    minWindow: 0.3,
    candidateOffset: 0.08,
  },
  hard: {
    returnRate: 0.999,
    pressure: 0.008,
    shortPenalty: 0.002,
    maxSpeed: 8.2,
    recoverySpeed: 5.4,
    recoveryDelay: 0.12,
    reaction: 0.045,
    error: 0.003,
    minWindow: 0.18,
    candidateOffset: 0,
  },
} satisfies Record<Difficulty, object>

export type Intercept = { t: number; p: Vec }

/** 타구 위치까지 가는 실제 이동을 예측한다. 팔꿈치·발걸음의 표시 상태와는 무관하다. */
export function chooseIntercept(ball: Ball, shot: Shot, body: CpuBody, difficulty: Difficulty, reach = inCpuReach): { hit: Intercept | null; chase: Intercept | null } {
  const level = CPU_LEVEL[difficulty]
  const pts = sampleReach(ball, shot, reach)
  let hit: Intercept | null = null
  let best = Infinity
  for (const q of pts) {
    // 도착 직후 바로 때리기보다 스윙할 여유와 편한 타점이 있는 후보를 고른다.
    if (hit && q.t > hit.t + 0.18) break
    const { stand } = strikeStance(q.p, body.root)
    const distance = Math.hypot(stand.x - body.root.x, stand.z - body.root.z)
    if (q.t < level.reaction || distance > body.maxSpeed * (q.t - level.reaction)) continue
    if (!body.canArrive(q.p, q.t)) continue
    const score = q.t + Math.abs(q.p.y - 0.85) * 0.16 + Math.hypot(stand.x - T_SPOT.x, stand.z - T_SPOT.z) * 0.025
    if (score < best) {
      hit = q
      best = score
    }
  }
  return { hit, chase: hit ?? pts[Math.floor(pts.length / 2)] ?? null }
}
