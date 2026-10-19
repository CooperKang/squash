import { describe, expect, it } from 'vitest'
import { COURT, Shot, cpuShot, findReachWindow, inCpuReach, inYourReach, step, yourShot, type Ball, type Vec } from './physics'
import { winner } from './score'

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

function play(from: Vec, v: Vec, shot: Shot) {
  const b: Ball = { p: { ...from }, v: { ...v } }
  for (let t = 0; t < 5; t += 1 / 120) {
    for (const e of step(b, 1 / 120)) {
      const r = shot.apply(e)
      if (r) return r
    }
  }
  return null
}

describe('cpuShot', () => {
  it('상대 샷은 늘 규칙 안이고 내가 칠 수 있는 구간이 생긴다', () => {
    const rand = seeded(7)
    for (const diff of ['easy', 'normal', 'hard'] as const) {
      for (let i = 0; i < 40; i++) {
        const from = { x: (rand() * 2 - 1) * 2.5, y: 0.5 + rand() * 0.8, z: 3 + rand() * 4 }
        const v = cpuShot(from, diff, false, rand)
        const w = findReachWindow({ p: from, v }, new Shot('cpu'), inYourReach)
        expect(w, `${diff} #${i}`).not.toBeNull()
        expect(w!.length).toBeGreaterThan(0.25)
      }
    }
  })

  it('서브는 서비스 라인 위로 들어간다', () => {
    const rand = seeded(3)
    for (let i = 0; i < 20; i++) {
      const from = { x: 1.6, y: 1, z: 6 }
      const v = cpuShot(from, 'normal', true, rand)
      expect(play(from, v, new Shot('cpu', true))).toBe('double')
    }
  })
})

describe('yourShot', () => {
  const from = { x: 0.5, y: 0.9, z: 8 }

  it('공 가운데를 제때 치면 앞벽에 제대로 들어가고 상대가 칠 기회가 생긴다', () => {
    const { v } = yourShot(from, 0, 0, 1, () => 0.5)
    const shot = new Shot('you')
    expect(findReachWindow({ p: from, v }, shot, inCpuReach)).not.toBeNull()
    expect(play(from, v, new Shot('you'))).toBe('double')
  })

  it('공 윗부분을 치면 낮게 날아가 틴에 걸릴 수 있다', () => {
    const { target } = yourShot(from, 0, -1, 1, () => 0.5)
    expect(target.y).toBeLessThan(COURT.tin)
  })

  it('공 왼쪽을 치면 오른쪽(+x)으로 간다', () => {
    expect(yourShot(from, -0.8, 0, 1, () => 0.5).target.x).toBeGreaterThan(1)
  })
})

describe('winner', () => {
  it('11점을 먼저 내고 2점 앞서야 이긴다', () => {
    expect(winner({ you: 11, cpu: 9 })).toBe('you')
    expect(winner({ you: 11, cpu: 10 })).toBeNull()
    expect(winner({ you: 10, cpu: 12 })).toBe('cpu')
    expect(winner({ you: 7, cpu: 3 })).toBeNull()
  })
})
