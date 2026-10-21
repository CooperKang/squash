import { describe, expect, it } from 'vitest'
import { Athlete } from './realism'
import { SIM_DT } from './physics'
import { CpuBody, strikeStance } from './cpuBody'

describe('정지·감속·이동 사이 체력 공정성', () => {
  it('현실모드 봇은 도착 시간을 늦추며 계속 걷지 않고 일찍 도착해 대기한다', () => {
    const early = new CpuBody(), late = new CpuBody()
    const at = { x: 2, y: .8, z: 3 }, stand = strikeStance(at, early.root).stand
    for (const b of [early,late]) b.configure({ maxSpeed: 6.8, recoverySpeed: 4.42, recoveryDelay: .12, earlyArrival: b === early })
    early.plan(at, 2);late.plan(at, 2)
    for (let t=0;t<.6;t+=SIM_DT) { early.update(SIM_DT);late.update(SIM_DT) }
    const distance = (b: CpuBody) => Math.hypot(b.root.x-stand.x,b.root.z-stand.z)
    expect(distance(early)).toBeLessThan(distance(late)*.5)
  })
  it('T에서 감속하는 미세 이동을 달리기로 취급해 회복을 막지 않는다', () => {
    const stopped = new Athlete(), settling = new Athlete()
    stopped.energy = settling.energy = 40
    for (let i = 0; i < 720; i++) {
      stopped.exert(SIM_DT, 0, true)
      settling.exert(SIM_DT, 0.04 * SIM_DT, true)
    }
    expect(stopped.energy).toBeGreaterThan(48.9)
    expect(settling.energy).toBeGreaterThan(48.5)
    expect(Math.abs(stopped.energy - settling.energy)).toBeLessThan(0.4)
  })
  it('같은 속도로 두 배를 움직이면 이동 소모도 두 배이며 움직이는 동안 공짜 회복이 없다', () => {
    const you = new Athlete(), cpu = new Athlete()
    you.exert(2, 8, false); cpu.exert(1, 4, false)
    expect(you.spent).toBeCloseTo(cpu.spent * 2)
    expect(you.recovered).toBe(0)
    expect(cpu.recovered).toBe(0)
    expect(you.energy).toBeLessThan(cpu.energy)
  })
  it('포인트 사이에도 이동 비용과 저속 회복을 함께 계산한다', () => {
    const a = new Athlete()
    a.energy = 40
    a.root = { x: 2, z: 6 }
    a.target = { x: 0, z: 5.6 }
    a.move(0.1, true)
    expect(a.distance).toBeGreaterThan(0)
    expect(a.spent).toBeGreaterThan(0)
    a.exert(1, 0.04, true, true)
    expect(a.recovered).toBeGreaterThan(3)
  })
  it('30fps와120fps의 같은 속도 경로를 같은 비용으로 계산한다', () => {
    const replay = (fps: number) => {
      const a = new Athlete(); a.energy = 50
      for (let i = 0; i < fps * 3; i++) a.exert(1 / fps, 3 / fps, false)
      for (let i = 0; i < fps * 2; i++) a.exert(1 / fps, 0.04 / fps, true)
      return a
    }
    expect(replay(30).energy).toBeCloseTo(replay(120).energy, 8)
  })
})
