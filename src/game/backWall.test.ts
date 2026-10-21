import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Engine } from './engine'
import { BALL_R, Shot, inYourReach, type Ball } from './physics'
import { Athlete, realisticReach, type GameMode } from './realism'
import { newShot, plan, type ShotKind } from './shots'

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}

type Harness = {
  mode: GameMode
  phase: string
  difficulty: string
  sound: boolean
  askRules: boolean
  ball: Ball
  shot: Shot
  player: Athlete
  lastShot: { by: string; kind: ShotKind } | null
  charge: { seconds: number } | null
  newMatch(): void
  planPlayer(): void
  canYouHit(): boolean
  update(dt: number): void
  press(x: number, y: number, type?: string): void
  release(x: number, y: number): void
  project(p: Ball['p']): { x: number; y: number }
}

function fixture(side = 1) {
  const from = { x: side * 1.2, y: 0.6, z: 4 }
  const candidates = plan('drive', from, { by: 'cpu', samples: 200, rand: seeded(1) })
  const candidate = candidates.find((c) => c.sim.events.some((e) => e.hit === 'back' && e.afterFront))!
  expect(candidate).toBeTruthy()
  return { from, v: candidate.v }
}

function engine(mode: GameMode, side = 1) {
  const canvas = { getContext: () => ({ setTransform() {} }), getBoundingClientRect: () => ({ width: 1280, height: 720 }) } as unknown as HTMLCanvasElement
  const e = new Engine(canvas, () => {}) as unknown as Harness
  e.mode = mode
  e.sound = false
  e.askRules = false
  e.difficulty = 'normal'
  e.newMatch()
  const { from, v } = fixture(side)
  e.phase = 'rally'
  e.ball = { p: { ...from }, v: { ...v } }
  e.shot = newShot('cpu', 'drive', from)
  e.player.reset()
  e.planPlayer()
  return e
}

describe('뒷벽 리턴의 유효 구간', () => {
  it('원래 샷이 짧은 샷이어도 뒷벽 이후에는 별도 높이·코트 구역으로 막지 않는다', () => {
    const shot = new Shot('cpu')
    shot.frontOk = true
    shot.floorAfterFront = 1
    shot.backWall = true
    shot.short = true
    const ball = { p: { x: 1, y: 1.8, z: 3 }, v: { x: 0, y: -1, z: -3 } }
    expect(inYourReach(ball, shot)).toBe(true)
    expect(realisticReach(ball, shot)).toBe(true)
    ball.p.y = 0.18
    expect(realisticReach(ball, shot)).toBe(true)
    ball.p.y = BALL_R
    expect(realisticReach(ball, shot)).toBe(false)
    shot.floorAfterFront = 2
    expect(inYourReach(ball, shot)).toBe(false)
    expect(realisticReach(ball, shot)).toBe(false)
  })
  it('뒷벽 충돌은 바운드 횟수를 지우지 않고 두 번째 바운드는 랠리를 끝낸다', () => {
    const shot = new Shot('cpu')
    shot.frontOk = true
    expect(shot.apply({ hit: 'floor', at: { x: 1, y: BALL_R, z: 8 } })).toBeNull()
    expect(shot.apply({ hit: 'back', at: { x: 1, y: 0.3, z: 9.75 } })).toBeNull()
    expect(shot.floorAfterFront).toBe(1)
    expect(shot.apply({ hit: 'floor', at: { x: 1, y: BALL_R, z: 8.8 } })).toBe('double')
  })
})

describe('뒷벽 이후 실제 타격과 이동', () => {
  beforeAll(() => {
    vi.stubGlobal('window', { devicePixelRatio: 1 })
    vi.stubGlobal('navigator', { vibrate() {} })
  })
  afterAll(() => vi.unstubAllGlobals())

  for (const mode of ['classic', 'realistic'] as const)
    for (const side of [-1, 1]) {
      it(`${mode} ${side}쪽: 첫 타점을 지나쳐도 뒷벽 뒤 30cm 미만의 공을 실제로 받아친다`, () => {
        const e = engine(mode, side)
        let hit = false
        for (let frame = 0; frame < 1200 && e.phase === 'rally'; frame++) {
          e.update(1 / 120)
          if (!e.shot.backWall || e.ball.p.y >= 0.3 || !e.canYouHit()) continue
          const p = e.project(e.ball.p)
          if (p.x < 0 || p.x > 1280 || p.y < 0 || p.y > 720) continue
          e.press(p.x, p.y, 'touch')
          if (e.charge) e.charge.seconds = 0.3
          e.release(p.x, p.y)
          hit = e.lastShot?.by === 'you'
          break
        }
        expect(hit).toBe(true)
        expect(e.shot.by).toBe('you')
      })
    }
  it('뒷벽에서 나온 낮은 공을 눌러 멈춘 뒤 오래 충전해도 놓을 때 친다', () => {
    const e = engine('realistic')
    let hit = false
    for (let frame = 0; frame < 1200 && e.phase === 'rally'; frame++) {
      e.update(1 / 120)
      if (!e.shot.backWall || !e.canYouHit() || e.ball.p.y >= 0.3) continue
      const p = e.project(e.ball.p)
      if (p.x < 0 || p.x > 1280 || p.y < 0 || p.y > 720) continue
      e.press(p.x, p.y, 'touch')
      const at = structuredClone(e.ball)
      e.update(3)
      expect(e.ball).toEqual(at)
      expect(e.phase).toBe('rally')
      e.release(p.x, p.y)
      hit = e.lastShot?.by === 'you'
      break
    }
    expect(hit).toBe(true)
  })
  it('타구 뒤에는 별도 입력 없이 T로 자동 복귀한다', () => {
    const e = engine('realistic')
    let hit = false
    for (let frame = 0; frame < 1200 && e.phase === 'rally'; frame++) {
      e.update(1 / 120)
      if (!e.shot.backWall || !e.canYouHit()) continue
      const p = e.project(e.ball.p)
      if (p.x < 0 || p.x > 1280 || p.y < 0 || p.y > 720) continue
      e.press(p.x, p.y, 'touch')
      e.release(p.x, p.y)
      hit = e.lastShot?.by === 'you'
      break
    }
    expect(hit).toBe(true)
    expect(e.player.target).toEqual({ x: 0, z: 5.6 })
    const before = Math.hypot(e.player.root.x, e.player.root.z - 5.6)
    e.update(0.1)
    expect(Math.hypot(e.player.root.x, e.player.root.z - 5.6)).toBe(before)
    e.update(0.15)
    expect(Math.hypot(e.player.root.x, e.player.root.z - 5.6)).toBeLessThan(before)
  })
  it('기다리다 두 번 튄 공은 늦게 눌러도 타격하지 못한다', () => {
    const e = engine('realistic')
    for (let f = 0; f < 1200 && e.phase === 'rally'; f++) e.update(1 / 120)
    expect(e.phase).toBe('point')
    expect(e.canYouHit()).toBe(false)
    const p = e.project(e.ball.p)
    e.press(p.x, p.y, 'touch')
    e.release(p.x, p.y)
    expect(e.lastShot?.by).not.toBe('you')
  })
})
