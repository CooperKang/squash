import { describe, expect, it } from 'vitest'
import { BODY, CpuBody } from './cpuBody'

const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

describe('상대 선수 몸', () => {
  for (const at of [
    { x: 2.3, y: 0.8, z: 8 }, // 뒤 코트 포핸드
    { x: -2.4, y: 0.6, z: 8.4 }, // 뒤 코트 백핸드
    { x: 2.2, y: 0.5, z: 2.6 }, // 앞 코트 포핸드
    { x: -2, y: 0.5, z: 2.4 }, // 앞 코트 백핸드
  ]) {
    it(`(${at.x}, ${at.z})에 제시간에 가서 라켓으로 공을 맞힌다`, () => {
      const b = new CpuBody()
      b.splitStep()
      b.plan(at, 1.1)
      const dt = 1 / 240
      while (b.swing && b.swing.t > dt / 2) {
        b.update(dt)
        const j = b.joints()
        // 다리 길이는 늘어나지 않는다
        expect(dist(j.hipL, j.kneeL)).toBeCloseTo(BODY.thigh, 2)
        expect(dist(j.kneeR, j.ankleR)).toBeLessThan(BODY.shin + 0.01)
      }
      const j = b.joints()
      // 라켓 면(손에서 라켓 길이의 70% 안팎)이 공 근처를 지난다
      const face = { x: j.handR.x + (j.racketTip.x - j.handR.x) * 0.72, y: j.handR.y + (j.racketTip.y - j.handR.y) * 0.72, z: j.handR.z + (j.racketTip.z - j.handR.z) * 0.72 }
      expect(dist(face, at)).toBeLessThan(0.3)
      // 임팩트 때 런지 보폭은 1.3m 안쪽(달릴 때 보폭은 더 넓어도 된다)
      expect(Math.hypot(b.feet()[0].x - b.feet()[1].x, b.feet()[0].z - b.feet()[1].z)).toBeLessThan(1.32)
    })
  }
})

// 팔 길이와 손의 위치를 확인해 백핸드에서 팔이 몸을 뚫거나 임팩트 때 늘어나지 않게 한다.
describe('포핸드·백핸드 팔 자세', () => {
  for (const side of [-1, 1] as const) {
    it(`${side > 0 ? '포핸드' : '백핸드'} 준비부터 복귀까지 팔 길이가 일정하고 동작이 이어진다`, () => {
      const b = new CpuBody()
      b.plan({ x: side * 2, y: 0.75, z: 5 }, 1.2)
      let prev = b.joints()
      for (let frame = 0; frame < 430; frame++) {
        b.update(1 / 240)
        const j = b.joints()
        expect(dist(j.shoulderR, j.elbowR)).toBeCloseTo(BODY.upperArm, 5)
        expect(dist(j.elbowR, j.handR)).toBeCloseTo(BODY.forearm, 5)
        expect(dist(j.handR, j.racketTip)).toBeCloseTo(BODY.racket, 5)
        expect(dist(j.handR, prev.handR)).toBeLessThan(0.12)
        expect(dist(j.racketTip, prev.racketTip)).toBeLessThan(0.15)
        if (b.swing && b.swing.t > 0.2 && b.swing.t < 0.4) {
          expect((j.handR.x - j.chest.x) * side).toBeGreaterThan(0.05)
          if (side < 0) expect(j.handR.z).toBeLessThan(j.chest.z)
        }
        prev = j
      }
    })
    it.each([0.35, 0.8, 1.4])(`${side > 0 ? '포핸드' : '백핸드'} 높이 %s의 타점에 라켓 면이 닿는다`, (y) => {
      const b = new CpuBody()
      const at = { x: side * 2.2, y, z: 6 }
      b.plan(at, 1.2)
      for (let i = 0; i < 288; i++) b.update(1 / 240)
      const j = b.joints()
      const face = { x: j.handR.x + (j.racketTip.x - j.handR.x) * 0.72, y: j.handR.y + (j.racketTip.y - j.handR.y) * 0.72, z: j.handR.z + (j.racketTip.z - j.handR.z) * 0.72 }
      expect(dist(face, at)).toBeLessThan(0.3)
    })
  }
  it('코트 중앙 기준이 아니라 선수의 현재 위치 기준으로 백핸드를 준비한다', () => {
    const b = new CpuBody()
    b.placeAt({ x: 2.4, z: 5.6 })
    b.plan({ x: 1, y: 0.8, z: 5 }, 1)
    expect(b.swing?.side).toBe(-1)
  })
})
