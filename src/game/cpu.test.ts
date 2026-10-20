import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { CPU_LEVEL, chooseIntercept } from './cpu'
import { CpuBody, T_SPOT, strikeStance } from './cpuBody'
import { Engine } from './engine'
import { SIM_DT, Shot, inCpuReach, step, type Ball } from './physics'
import { newShot, plan, type ShotKind } from './shots'

const seeded = (initial: number) => {
  let seed = initial
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}

// 수비 판단은 화면이나 관절 데이터 없이 공 궤적과 선수 위치만으로 검증한다.
describe('상대의 타점 예측과 복귀', () => {
  it('앞 코트 발리와 바운드 직후의 상승 구간을 놓치지 않는다', () => {
    const shot = new Shot('you')
    const ball: Ball = { p: { x: 1, y: 0.8, z: 2 }, v: { x: 0, y: 2, z: 1 } }
    expect(inCpuReach(ball, shot)).toBe(false)
    shot.frontOk = true
    expect(inCpuReach(ball, shot)).toBe(true)
    shot.floorAfterFront = 1
    expect(inCpuReach(ball, shot)).toBe(true)
    shot.floorAfterFront = 2
    expect(inCpuReach(ball, shot)).toBe(false)
    shot.floorAfterFront = 1
    ball.p.y = 0.1
    expect(inCpuReach(ball, shot)).toBe(false)
  })

  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    it(`${difficulty}: 선택한 타점에 실제로 도착하고 공이 유효한 순간 휘두른다`, () => {
      for (const kind of ['drive', 'cross', 'boast', 'drop', 'kill'] as ShotKind[]) {
        const from = { x: 2.3, y: kind === 'kill' ? 1.3 : 0.8, z: ['drop', 'kill'].includes(kind) ? 4 : 7.6 }
        const [candidate] = plan(kind, from, { by: 'you', samples: 160, rand: seeded(13) })
        expect(candidate, kind).toBeTruthy()
        const body = new CpuBody()
        body.configure(CPU_LEVEL[difficulty])
        const ball = { p: { ...from }, v: { ...candidate.v } }
        const shot = newShot('you', kind, from)
        const { hit } = chooseIntercept(ball, shot, body, difficulty)
        expect(hit, kind).not.toBeNull()
        if (!hit) continue
        const stance = strikeStance(hit.p, body.root).stand
        body.plan(hit.p, hit.t)
        for (let t = 0; t < hit.t - SIM_DT / 2; t += SIM_DT) {
          body.update(SIM_DT)
          for (const event of step(ball, SIM_DT)) expect(shot.apply(event), kind).toBeNull()
        }
        expect(inCpuReach(ball, shot), kind).toBe(true)
        expect(Math.hypot(ball.p.x - hit.p.x, ball.p.y - hit.p.y, ball.p.z - hit.p.z)).toBeLessThan(0.001)
        expect(Math.hypot(body.root.x - stance.x, body.root.z - stance.z)).toBeLessThan(0.24)
      }
    })
    it(`${difficulty}: 팔로스루가 끝나기 전 중앙 복귀를 시작한다`, () => {
      const b = new CpuBody()
      b.configure(CPU_LEVEL[difficulty])
      b.placeAt({ x: 2, z: 8 })
      b.plan({ x: 2.7, y: 0.8, z: 7.5 }, 0.8)
      for (let t = 0; t < 0.8 + CPU_LEVEL[difficulty].recoveryDelay + 0.03; t += SIM_DT) b.update(SIM_DT)
      expect(b.swing).not.toBeNull()
      expect(b.target).toEqual(T_SPOT)
      expect(b.speed).toBe(CPU_LEVEL[difficulty].recoverySpeed)
    })
  }

  it('반대쪽 구석의 곧 두 번 튈 공에는 도달했다고 꾸미지 않는다', () => {
    const b = new CpuBody()
    b.configure(CPU_LEVEL.hard)
    b.placeAt({ x: -2.5, z: 8.5 })
    const shot = new Shot('you')
    shot.frontOk = true
    shot.floorAfterFront = 1
    const ball = { p: { x: 2.8, y: 0.4, z: 1.2 }, v: { x: 0, y: -4, z: 0 } }
    expect(chooseIntercept(ball, shot, b, 'hard').hit).toBeNull()
  })
})

type Harness = {
  ball: Ball
  shot: Shot
  body: CpuBody
  phase: string
  difficulty: 'hard'
  sound: boolean
  askRules: boolean
  lastShot: { by: 'you'; kind: ShotKind; sharp: number }
  cpuClock: number
  cpuPlan: { returns: boolean; t: number }
  update(dt: number): void
  planCpu(): void
}

describe('화면 프레임률과 상대 타구 시각', () => {
  beforeAll(() => vi.stubGlobal('window', { devicePixelRatio: 1 }))
  afterAll(() => vi.unstubAllGlobals())

  it('30·60·120fps에서도 같은 게임 시각에 받아친다', () => {
    const from = { x: 2.3, y: 0.8, z: 7.6 }
    const [candidate] = plan('drive', from, { by: 'you', samples: 160, rand: seeded(13) })
    const times: number[] = []
    for (const fps of [30, 60, 120]) {
      const canvas = { getContext: () => ({ setTransform() {} }), getBoundingClientRect: () => ({ width: 1280, height: 720 }) } as unknown as HTMLCanvasElement
      const e = new Engine(canvas, () => {}) as unknown as Harness
      e.sound = false
      e.askRules = false
      e.difficulty = 'hard'
      e.phase = 'rally'
      e.ball = { p: { ...from }, v: { ...candidate.v } }
      e.shot = newShot('you', 'drive', from)
      e.lastShot = { by: 'you', kind: 'drive', sharp: 1 }
      const random = vi.spyOn(Math, 'random').mockImplementation(seeded(17))
      try {
        e.planCpu()
        expect(e.cpuPlan.returns).toBe(true)
        for (let f = 0; f < fps * 5 && e.phase === 'rally' && e.shot.by === 'you'; f++) e.update(1 / fps)
        expect(e.shot.by).toBe('cpu')
        times.push(e.cpuClock)
      } finally {
        random.mockRestore()
      }
    }
    expect(Math.max(...times) - Math.min(...times)).toBeLessThan(1e-8)
  })
})
