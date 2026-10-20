import { clamp } from './physics'

/** 실제 운동에 대응시킨 게임 속 선수의 추정치. 조작자의 실제 소모량이 아니다.
 * 2024 Adult Compendium: squash general 7.3 MET, squash 12 MET.
 * https://pacompendium.com/sports/
 */
export const REFERENCE_WEIGHT_KG = 70
export const caloriesFor = (met: number, seconds: number, kg = REFERENCE_WEIGHT_KG) => (met * 3.5 * kg * seconds) / 12000
export type WorkoutHud = { calories: number; intensity: string }

export class Workout {
  calories = 0
  seconds = 0
  effort = 0
  stroke = 0
  rallying = false

  hit(power: number) {
    this.stroke = clamp(this.stroke + power * 0.5, 0, 1)
  }

  /** dt는 정지 시간을 제외한 실제 경과 초, speed는 느리게 재생하기 전 코트 이동 속도다. */
  update(dt: number, speed: number, rally: number, rallying: boolean) {
    if (dt <= 0 || !Number.isFinite(dt) || !Number.isFinite(speed)) return
    this.rallying = rallying
    const load = rallying ? clamp(speed / 5 + this.stroke * 0.3 + Math.min(rally / 12, 1) * 0.15, 0, 1) : 0
    // 지수 평활화와 구간 평균으로 fps에 따른 계산 차이와 표시 깜빡임을 줄인다.
    const decay = Math.exp(-dt / 4)
    const meanEffort = load + ((this.effort - load) * 4 * (1 - decay)) / dt
    this.effort = load + (this.effort - load) * decay
    const met = rallying ? 7.3 + 4.7 * meanEffort : 2
    this.calories += caloriesFor(met, dt)
    this.seconds += dt
    this.stroke *= Math.exp(-dt / 3)
  }

  get hud(): WorkoutHud {
    return { calories: this.calories, intensity: !this.rallying ? '준비·회복' : this.effort > 0.65 ? '치열함' : this.effort > 0.3 ? '활발함' : '여유로움' }
  }
}
