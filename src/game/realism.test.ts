import { describe, expect, it } from 'vitest'
import { Athlete, chargePower, realisticReach, strikePower, withinRacketReach } from './realism'
import { Shot, SIM_DT, inYourReach, simulate } from './physics'
import { kindFor, intentFrom, playerShot, newShot, gameplayScore } from './shots'

const seeded = (initial: number) => {
  let seed = initial
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}

describe('앞 코트에서 선택한 샷 유지', () => {
  for (const kind of ['cross', 'boast'] as const)
    for (const side of [-1, 1]) {
      it(`${side}쪽 ${kind}가 드라이브로 바뀌지 않고 실제 경로도 맞는다`, () => {
        for (const z of [1.5, 2.5, 4]) {
          const from = { x: side * 2.5, y: 0.7, z }
          const result = playerShot(kind, from, 1, seeded(23))
          expect(result, `${kind} z=${z}`).not.toBeNull()
          if (!result) continue
          expect(result.kind).toBe(kind)
          const sim = simulate({ p: { ...from }, v: result.v }, newShot('you', kind, from), 6, SIM_DT)
          expect(gameplayScore(kind, sim, side), `${kind} z=${z}`).not.toBeNull()
          const fi = sim.events.findIndex((e) => e.hit === 'front')
          if (kind === 'boast') expect(sim.events[0].hit).toBe('side')
          else {
            expect(fi).toBe(0)
            expect(
              sim.events
                .slice(fi)
                .filter((e) => e.hit === 'floor')
                .some((e) => e.at.x * -side > 0.2),
            ).toBe(true)
          }
        }
      })
    }
  it('높은 앞 코트 공의 바깥쪽 윗칸도 크로스 계열을 유지한다', () => {
    const from = { x: 2, y: 1.4, z: 3 }
    expect(kindFor(intentFrom(from.x, 0.7, -0.7), from, false)).toBe('cross-drop')
  })
})

describe('현실모드 파워와 지구력', () => {
  it('누른 시간이 길수록 파워가 오르고 가득 찬 뒤에도 유지한다', () => {
    const a = new Athlete()
    expect(chargePower(0)).toBe(0)
    expect(chargePower(0.5)).toBeGreaterThan(chargePower(0.1))
    expect(chargePower(8)).toBe(1)
    expect(strikePower(1, a)).toBeGreaterThan(strikePower(0, a))
  })
  it('실제 공 속도에 충전 강도를 반영한다', () => {
    const from = { x: 2.3, y: 0.8, z: 7.6 }
    const soft = playerShot('drive', from, 1, seeded(13), 0.3)!
    const hard = playerShot('drive', from, 1, seeded(13), 1)!
    expect(soft).toBeTruthy()
    expect(hard).toBeTruthy()
    expect(Math.hypot(hard.v.x, hard.v.y, hard.v.z)).toBeGreaterThan(Math.hypot(soft.v.x, soft.v.y, soft.v.z) * 1.3)
  })
  it('먼 이동과 강타로 소모되고 체력이 떨어지면 이동·파워가 줄어든다', () => {
    const fresh = new Athlete(),
      tired = new Athlete()
    for (let i = 0; i < 20; i++) {
      tired.exert(1, 6, false)
      tired.hit(1)
    }
    expect(tired.energy).toBeLessThan(40)
    expect(tired.speedFactor).toBeLessThan(fresh.speedFactor)
    expect(tired.powerFactor).toBeLessThan(fresh.powerFactor)
    expect(tired.distance).toBe(120)
    fresh.target = tired.target = { x: 2, z: 8 }
    fresh.move(0.1)
    tired.move(0.1)
    expect(Math.hypot(tired.root.x, tired.root.z - 5.6)).toBeLessThan(Math.hypot(fresh.root.x, fresh.root.z - 5.6))
  })
  it('T에서 정지하면 더 빨리 회복하고 포인트 사이에도 누적 피로가 남는다', () => {
    const t = new Athlete(),
      corner = new Athlete()
    t.energy = corner.energy = 40
    for (let i = 0; i < 240; i++) {
      t.exert(SIM_DT, 0, true)
      corner.exert(SIM_DT, 0, false)
    }
    expect(t.energy).toBeGreaterThan(corner.energy + 0.8)
    t.exert(10, 50, false)
    const fatigue = t.fatigue
    t.exert(3, 0, true, true)
    expect(t.fatigue).toBe(fatigue)
    expect(t.capacity).toBeLessThan(100)
    expect(t.energy).toBeLessThanOrEqual(t.capacity)
  })
  it('봇과 사용자가 같은 체력 모델을 쓰고 경계값을 넘지 않는다', () => {
    const you = new Athlete(),
      cpu = new Athlete()
    for (let i = 0; i < 100; i++) {
      you.exert(0.5, 3, false)
      cpu.exert(0.5, 3, false)
    }
    expect(you.energy).toBe(cpu.energy)
    expect(you.energy).toBeGreaterThanOrEqual(0)
    for (let i = 0; i < 100; i++) you.exert(1, 0, true)
    expect(you.energy).toBeLessThanOrEqual(you.capacity)
  })
  it('선수가 도착하기 전에는 화면 공만 눌러서 공을 칠 수 없다', () => {
    const shot = new Shot('cpu')
    shot.frontOk = true
    const ball = { p: { x: 2.4, y: 0.8, z: 2 }, v: { x: 0, y: 0, z: 1 } }
    expect(realisticReach(ball, shot)).toBe(true)
    expect(withinRacketReach({ x: 0, z: 5.6 }, ball.p)).toBe(false)
    expect(withinRacketReach({ x: 2, z: 2.5 }, ball.p)).toBe(true)
    // 기존 모드의 타구 영역 계약은 그대로다.
    expect(inYourReach(ball, shot)).toBe(false)
  })
})
