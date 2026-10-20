import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Athlete } from './realism'
import { Engine } from './engine'
import { CpuBody } from './cpuBody'
import { CPU_LEVEL, chooseIntercept } from './cpu'
import { SIM_DT, Shot, type Ball } from './physics'
import { newShot, plan, type ShotKind } from './shots'

const seeded = (initial: number) => { let seed = initial; return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) }

describe('현실모드 탈진에 따른 실제 경기력', () => {
  it('체력이 줄수록 이동·파워·범위가 줄고 스윙 회복은 길어진다', () => {
    const a = new Athlete()
    const states = [100, 50, 20, 0].map(energy => {
      a.energy = energy
      return [a.speedFactor, a.powerFactor, a.racketReach, a.recoveryTime]
    })
    for (let i = 1; i < states.length; i++) {
      expect(states[i][0]).toBeLessThan(states[i - 1][0])
      expect(states[i][1]).toBeLessThan(states[i - 1][1])
      expect(states[i][2]).toBeLessThan(states[i - 1][2])
      expect(states[i][3]).toBeGreaterThan(states[i - 1][3])
    }
    expect(states[3][0]).toBeCloseTo(0.28)
  })
  it('탈진해도 가까운 공은 칠 수 있고 먼·높은 공은 준비되지 않는다', () => {
    const a = new Athlete()
    a.root = { x: 0, z: 5 }
    const edge = { x: 1.25, y: 0.8, z: 5 }, high = { x: 0.5, y: 1.9, z: 5 }, close = { x: 0.6, y: 0.8, z: 5 }
    expect(a.canStrike(edge)).toBe(true)
    expect(a.canStrike(high)).toBe(true)
    a.energy = 0
    expect(a.canStrike(edge)).toBe(false)
    expect(a.canStrike(high)).toBe(false)
    expect(a.canStrike(close)).toBe(true)
    a.hit(0.3)
    expect(a.canStrike(close)).toBe(false)
    a.exert(a.recoveryTime + 0.01, 0, true)
    expect(a.canStrike(close)).toBe(true)
  })
  it('같은 구석·앞 코트 공에서 탈진한 봇이 도달할 수 있는 타점이 줄어든다', () => {
    const counts = [0, 0]
    for (const kind of ['drive', 'cross', 'boast', 'drop', 'kill'] as ShotKind[]) {
      for (const side of [-1, 1]) {
        const from = { x: side * 2.3, y: kind === 'kill' ? 1.3 : 0.8, z: ['drop', 'kill'].includes(kind) ? 4 : 7.6 }
        const [candidate] = plan(kind, from, { by: 'you', samples: 160, rand: seeded(13) })
        expect(candidate).toBeTruthy()
        for (const [i, energy] of [100, 0].entries()) {
          const a = new Athlete(), b = new CpuBody()
          a.energy = energy
          b.configure({ ...CPU_LEVEL.hard, maxSpeed: CPU_LEVEL.hard.maxSpeed * a.speedFactor })
          if (chooseIntercept({ p: from, v: candidate.v }, newShot('you', kind, from), b, 'hard').hit) counts[i]++
        }
      }
    }
    expect(counts[0]).toBe(10)
    expect(counts[1]).toBeLessThanOrEqual(5)
  })
  it('탈진한 봇의 긴 복귀 지연이 모션 종료 때문에 무시되지 않는다', () => {
    const b = new CpuBody()
    b.configure({ maxSpeed: 2, recoverySpeed: 1, recoveryDelay: 0.7 })
    b.placeAt({ x: 2, z: 7 })
    b.plan({ x: 2.5, y: 0.8, z: 6.5 }, 0.2)
    for (let t = 0; t < 0.8; t += SIM_DT) b.update(SIM_DT)
    expect(b.target).not.toEqual({ x: 0, z: 5.6 })
    for (let t = 0; t < 0.15; t += SIM_DT) b.update(SIM_DT)
    expect(b.target).toEqual({ x: 0, z: 5.6 })
  })
})

type Harness = {
  mode: string; phase: string; ball: Ball; shot: Shot; player: Athlete; opponent: Athlete; body: CpuBody
  sound: boolean; cpuClock: number; cpuPlan: { returns: boolean; t: number }
  canYouHit(): boolean; yourBallNow(): boolean; physics(dt: number): void
}

describe('몸 위치와 실제 타격 판정', () => {
  beforeAll(() => vi.stubGlobal('window', { devicePixelRatio: 1 }))
  afterAll(() => vi.unstubAllGlobals())
  function setup() {
    const canvas = { getContext: () => ({ setTransform() {} }), getBoundingClientRect: () => ({ width: 1280, height: 720 }) } as unknown as HTMLCanvasElement
    const e = new Engine(canvas, () => {}) as unknown as Harness
    e.mode = 'realistic'; e.phase = 'rally'; e.sound = false
    e.ball = { p: { x: 1.25, y: 0.8, z: 5 }, v: { x: 0, y: 0, z: 0 } }
    return e
  }
  it('플레이어의 청록 링과 실제 타격 가능 여부가 체력에 따라 함께 바뀐다', () => {
    const e = setup()
    e.shot = new Shot('cpu'); e.shot.frontOk = true
    e.player.root = { x: 0, z: 5 }
    expect(e.canYouHit()).toBe(true); expect(e.yourBallNow()).toBe(true)
    e.player.energy = 0
    expect(e.canYouHit()).toBe(false); expect(e.yourBallNow()).toBe(false)
    e.ball.p.x = 0.6
    expect(e.yourBallNow()).toBe(true)
  })
  it('예상 시각이 되어도 봇 몸이 공에서 멀리 떨어져 있으면 받아치지 않는다', () => {
    const e = setup()
    e.shot = new Shot('you'); e.shot.frontOk = true
    e.ball.p = { x: 2.5, y: 0.8, z: 2 }
    e.body.placeAt({ x: -2.5, z: 8 })
    e.opponent.root = { ...e.body.root }
    e.cpuPlan = { returns: true, t: 0 }; e.cpuClock = 0
    e.physics(SIM_DT)
    expect(e.shot.by).toBe('you')
  })
})
