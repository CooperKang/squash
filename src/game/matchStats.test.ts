import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { Engine, type HudState } from './engine'
import type { MatchSummary } from './matchStats'
import type { Athlete } from './realism'
import type { CpuBody } from './cpuBody'

type Harness = { mode: string; phase: string; score: {you: number;cpu: number}; sound: boolean; askRules: boolean; bestRally: number; player: Athlete; opponent: Athlete; body: CpuBody; timer: number; update(dt: number): void; newMatch(): void; setupServe(): void; strike(kind: string, serve: boolean, q: number, power: number): void; endRally(win: string, label: string, reason: null): void; summary(): MatchSummary; emit(): void }

describe('누적 경기 기록과 랠리 결과', () => {
  beforeAll(() => vi.stubGlobal('window', { devicePixelRatio: 1 }))
  afterAll(() => vi.unstubAllGlobals())
  function setup() {
    let hud: HudState
    const canvas = { getContext: () => ({ setTransform() {} }), getBoundingClientRect: () => ({ width: 1280, height: 720 }) } as unknown as HTMLCanvasElement
    const e = new Engine(canvas, h => {hud=h}) as unknown as Harness
    e.mode = 'realistic'; e.sound = false; e.askRules = false; e.newMatch()
    return {e, hud: () => hud!}
  }
  it('랠리별 기록과 경기 누적이 다음 서브에서 지워지지 않으며 새 경기에서만 초기화한다', () => {
    const {e,hud}=setup()
    e.bestRally=100
    for(let i=0;i<2;i++) {
      e.update(.1)
      e.strike('drive', true, 1, .6)
      e.update(.1)
      e.endRally('you','test',null)
      expect(hud().lastRally?.hits).toBe(1)
      expect(hud().lastRally!.seconds).toBeGreaterThan(.09)
      expect(hud().lastRally!.you.calories).toBeGreaterThan(0)
      e.setupServe()
    }
    expect(hud().summary.hits).toBe(2)
    expect(hud().summary.points).toBe(2)
    expect(hud().summary.bestRally).toBe(1)
    expect(hud().summary.seconds).toBeGreaterThan(hud().summary.rallySeconds)
    const before=e.summary()
    e.score={you:10,cpu:0};e.endRally('you','win',null)
    const ended=e.summary()
    e.mode='classic'
    expect(e.summary().mode).toBe('realistic')
    e.update(1)
    expect(e.summary()).toEqual(ended)
    expect(ended.you.calories).toBe(before.you.calories)
    e.newMatch()
    expect(hud().summary.mode).toBe('classic')
    expect(hud().summary.hits).toBe(0)
    expect(hud().summary.you.calories).toBe(0)
    expect(hud().lastRally).toBeNull()
  })
  it('같은 T 복귀 상태에서 봇만 회복이 막히지 않는다',()=>{
    const {e}=setup()
    e.phase='point'; e.timer=10; e.player.energy=e.opponent.energy=40
    e.player.root={x:0,z:5.6};e.player.target={x:0,z:5.6}
    e.body.placeAt({x:.03,z:5.6});e.body.recover()
    // point 타이머의 다음 서브 전환을 피해 작은 한 프레임을 비교한다.
    e.update(.05)
    expect(Math.abs(e.player.energy-e.opponent.energy)).toBeLessThan(.15)
  })
})
