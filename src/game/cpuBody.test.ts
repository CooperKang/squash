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
