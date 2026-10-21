import { describe, expect, it } from 'vitest'
import { caloriesFor, Workout } from './workout'

function play(seconds: number, speed: number, rally: number, step = 0.1) {
  const w = new Workout()
  for (let t = 0; t < seconds - 1e-6; t += step) w.update(step, speed, rally, true)
  return w
}

describe('게임 속 선수의 실제 운동 환산 칼로리', () => {
  it('70kg 일반·고강도 스쿼시 15분은 MET 공식과 일치한다', () => {
    expect(caloriesFor(7.3, 900)).toBeCloseTo(134.1375)
    expect(caloriesFor(12, 900)).toBeCloseTo(220.5)
    expect(caloriesFor(12, 900, 80)).toBeGreaterThan(caloriesFor(12, 900, 70))
  })
  it('같은 시간에 많이 움직이고 긴 랠리를 하면 더 소모한다', () => {
    const calm = play(900, 0.1, 2), intense = play(900, 5, 20)
    expect(intense.calories).toBeGreaterThan(calm.calories * 1.5)
    expect(calm.hud.intensity).toBe('여유로움')
    expect(intense.hud.intensity).toBe('치열함')
    expect(intense.calories).toBeLessThanOrEqual(220.5)
  })
  it('총 예상량은 활동분과 안정 시 대사분의 합이며 안정 대사를 중복 가산하지 않는다', () => {
    const w = play(900, 3, 8)
    expect(w.hud.restCalories).toBeCloseTo(caloriesFor(1, 900))
    expect(w.hud.activeCalories + w.hud.restCalories).toBeCloseTo(w.calories)
  })
  it('고정 움직임의 누적값이 30fps와 120fps에서 같다', () => {
    expect(play(60, 2, 6, 1 / 30).calories).toBeCloseTo(play(60, 2, 6, 1 / 120).calories, 7)
  })
  it('강타 부하가 반영되고 포인트 회복은 낮은 강도로 계산한다', () => {
    const hard = new Workout(), soft = new Workout()
    hard.hit(1)
    soft.hit(0.25)
    hard.update(1, 1, 4, true)
    soft.update(1, 1, 4, true)
    expect(hard.calories).toBeGreaterThan(soft.calories)
    const before = hard.calories
    hard.update(60, 0, 0, false)
    expect(hard.calories - before).toBeCloseTo(caloriesFor(2, 60))
    expect(hard.hud.intensity).toBe('준비·회복')
  })
})
