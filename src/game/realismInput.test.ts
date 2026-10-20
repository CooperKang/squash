import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Engine } from './engine'
import { Athlete, type GameMode } from './realism'
import { CpuBody } from './cpuBody'
import { Shot, type Ball } from './physics'
import type { ShotKind } from './shots'

type Harness = {
  mode: GameMode
  sound: boolean
  difficulty: string
  phase: string
  ball: Ball
  shot: Shot
  player: Athlete
  opponent: Athlete
  body: CpuBody
  lastPower: number
  lastShot: { by: string; kind: ShotKind } | null
  pick: unknown
  playerIntercept: { x: number; z: number } | null
  charge: { seconds: number; pointerType: string } | null
  pointer: { x: number; y: number } | null
  swings: { x: number; y: number; good: boolean }[]
  press(x: number, y: number, type?: string): void
  release(x: number, y: number): void
  pointerMove(x: number, y: number, type?: string): void
  cancelCharge(): void
  pause(): void
  update(dt: number): void
  newMatch(): void
  setupServe(): void
  project(p: Ball['p']): { x: number; y: number; r: number }
}

function setup(mode: GameMode = 'realistic') {
  const canvas = { getContext: () => ({ setTransform() {} }), getBoundingClientRect: () => ({ width: 1280, height: 720 }) } as unknown as HTMLCanvasElement
  const e = new Engine(canvas, () => {}) as unknown as Harness
  e.mode = mode
  e.sound = false
  e.difficulty = 'normal'
  e.phase = 'serve-you'
  e.ball = { p: { x: 1.8, y: 0.8, z: 7 }, v: { x: 0, y: 0, z: 0 } }
  e.player.root = { x: 1.5, z: 7.4 }
  e.player.target = { ...e.player.root }
  return e
}

describe('현실모드 누르기·놓기 입력과 기본 모드 회귀', () => {
  beforeAll(() => {
    vi.stubGlobal('window', { devicePixelRatio: 1 })
    vi.stubGlobal('navigator', { vibrate() {} })
  })
  afterAll(() => vi.unstubAllGlobals())

  for (const type of ['mouse', 'touch']) {
    it(`${type}: 누르기에는 치지 않고 놓을 때만 그 위치에서 한 번 친다`, () => {
      const e = setup(),
        at = e.project(e.ball.p)
      e.press(at.x, at.y, type)
      expect(e.lastShot).toBeNull()
      expect(e.charge).not.toBeNull()
      e.charge!.seconds = 0.7
      e.release(at.x, at.y)
      expect(e.lastShot?.by).toBe('you')
      expect(e.lastPower).toBeGreaterThan(0.7)
      expect(e.swings.at(-1)).toMatchObject({ x: at.x, y: at.y, good: true })
      expect(e.charge).toBeNull()
      expect(e.pick).toBeNull()
      const hit = e.lastShot
      e.release(at.x, at.y)
      expect(e.lastShot).toBe(hit)
    })
  }
  it('기본모드에서는 누르는 순간 치고 놓을 때 다시 치지 않는다', () => {
    const e = setup('classic'),
      at = e.project(e.ball.p)
    e.press(at.x, at.y)
    expect(e.lastShot?.by).toBe('you')
    expect(e.charge).toBeNull()
    const hit = e.lastShot
    e.release(at.x, at.y)
    expect(e.lastShot).toBe(hit)
  })
  it.each(['cancel', 'pause', 'outside'])('%s 시에는 충전을 취소하고 유령 스윙이 남지 않는다', (action) => {
    const e = setup(),
      at = e.project(e.ball.p)
    e.press(at.x, at.y, 'touch')
    if (action === 'cancel') e.cancelCharge()
    if (action === 'pause') e.pause()
    e.release(action === 'outside' ? -10 : at.x, at.y)
    expect(e.charge).toBeNull()
    expect(e.lastShot).toBeNull()
  })
  it('PC 커서는 피로 시 무거워지고 모바일은 손가락 좌표를 그대로 따른다', () => {
    const fresh = setup(),
      tired = setup(),
      mobile = setup()
    tired.player.energy = mobile.player.energy = 0
    for (const e of [fresh, tired]) {
      e.press(100, 200, 'mouse')
      e.pointerMove(600, 200, 'mouse')
      e.update(0.1)
    }
    expect(tired.pointer!.x).toBeLessThan(fresh.pointer!.x)
    mobile.press(100, 200, 'touch')
    mobile.pointerMove(600, 200, 'touch')
    expect(mobile.pointer).toEqual({ x: 600, y: 200 })
  })
  it('포인트가 바뀌어도 소모 체력·누적 피로는 유지하고 새 경기는 초기화한다', () => {
    const e = setup()
    e.player.energy = 43
    e.player.fatigue = 0.2
    e.opponent.energy = 39
    e.setupServe()
    expect(e.player.energy).toBe(43)
    expect(e.player.fatigue).toBe(0.2)
    expect(e.opponent.energy).toBe(39)
    e.newMatch()
    expect(e.player.energy).toBe(100)
    expect(e.player.fatigue).toBe(0)
    expect(e.opponent.energy).toBe(100)
  })
  it('다음 서브에 이전 랠리의 이동 목표가 남아 선수가 공에서 멀어지지 않는다', () => {
    const e = setup()
    e.playerIntercept = { x: -2, z: 2 }
    e.setupServe()
    expect(e.playerIntercept).toBeNull()
    const at = e.project(e.ball.p)
    e.press(at.x, at.y, 'touch')
    expect(e.player.target.z).toBeGreaterThan(6)
    e.playerIntercept = { x: -2, z: 2 }
    e.newMatch()
    expect(e.playerIntercept).toBeNull()
  })
  it('현실모드 쉬움은 충전 후 놓아도 확대 선택으로 멈추지 않는다', () => {
    const e = setup(),
      at = e.project(e.ball.p)
    e.difficulty = 'easy'
    e.press(at.x, at.y, 'touch')
    e.charge!.seconds = 0.5
    e.release(at.x, at.y)
    expect(e.lastShot?.by).toBe('you')
    expect(e.pick).toBeNull()
  })
})
