import { BALL_R, clamp, type Ball, type Shot, type Vec } from './physics'
import { T_SPOT } from './cpuBody'

export type GameMode = 'classic' | 'realistic'
export type CourtPoint = { x: number; z: number }

/** 게임용 지구력 모델. 의료·생리학 수치가 아니라 경기 밸런스를 위한 단위다. */
export class Athlete {
  root: CourtPoint = { ...T_SPOT }
  target: CourtPoint = { ...T_SPOT }
  energy = 100
  fatigue = 0
  distance = 0
  baseSpeed = 6.8

  get capacity() {
    return 100 - this.fatigue * 25
  }
  get speedFactor() {
    return 0.52 + 0.48 * clamp((this.energy - 12) / 60, 0, 1)
  }
  get powerFactor() {
    return 0.65 + 0.35 * clamp(this.energy / 65, 0, 1)
  }
  get atT() {
    return Math.hypot(this.root.x - T_SPOT.x, this.root.z - T_SPOT.z) < 0.9
  }

  reset(at: CourtPoint = T_SPOT) {
    this.root = { ...at }
    this.target = { ...at }
    this.energy = 100
    this.fatigue = 0
    this.distance = 0
  }

  /** 실제 이동 거리만 소모한다. T에서 기다리면 효율적으로 회복한다. */
  exert(dt: number, meters: number, atT: boolean, resting = false) {
    this.distance += meters
    const speed = meters / Math.max(dt, 1e-6)
    if (meters > 0.0001) {
      this.fatigue = clamp(this.fatigue + meters * 0.00075, 0, 1)
      this.energy -= meters * (0.25 + 0.055 * speed)
    } else {
      this.energy += dt * (resting ? 4 : atT ? 6 : 1)
    }
    this.energy = clamp(this.energy, 0, this.capacity)
  }

  move(dt: number, resting = false) {
    if (resting) {
      this.exert(dt, 0, this.atT, true)
      return
    }
    const dx = this.target.x - this.root.x,
      dz = this.target.z - this.root.z
    const distance = Math.hypot(dx, dz)
    const step = Math.min(distance, this.baseSpeed * this.speedFactor * dt)
    if (distance > 0.01) {
      this.root.x += (dx / distance) * step
      this.root.z += (dz / distance) * step
    }
    this.exert(dt, distance > 0.01 ? step : 0, this.atT)
  }

  hit(power: number) {
    this.energy = Math.max(0, this.energy - (0.35 + power * power * 1.1))
    this.fatigue = clamp(this.fatigue + power * 0.0015, 0, 1)
  }
}

export const chargePower = (seconds: number) => clamp(seconds / 1.05, 0, 1)
export const strikePower = (charge: number, athlete: Athlete) => (0.25 + clamp(charge, 0, 1) * 0.75) * athlete.powerFactor

export function realisticReach(ball: Ball, shot: Shot) {
  // 뒷벽 뒤의 낮은 리턴도 바닥에 닿기 전이면 유효하다. 실제 선수 거리는 별도로 검사한다.
  const minHeight = shot.backWall ? BALL_R + 0.01 : 0.3
  const maxHeight = shot.backWall ? 2.4 : 2.1
  return shot.frontOk && shot.floorAfterFront < 2 && ball.p.y >= minHeight && ball.p.y <= maxHeight
}

export const withinRacketReach = (root: CourtPoint, at: Vec) => Math.hypot(root.x - at.x, root.z - at.z) <= 1.35

export type RealismHud = {
  you: number
  cpu: number
  youDistance: number
  cpuDistance: number
  youAt: CourtPoint
  cpuAt: CourtPoint
  target: CourtPoint
  atT: boolean
  charge: number
  charging: boolean
  maxPower: number
  lastPower: number
}
