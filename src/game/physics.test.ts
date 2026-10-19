import { describe, expect, it } from 'vitest'
import { COURT, Shot, aimVelocity, cpuShot, outcome, findReachWindow, inCpuReach, inYourReach, step, yourShot, type Ball, type Vec } from './physics'
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

describe('뒷벽', () => {
  it('뒷벽을 맞고 나온 공은 뒤 코트에 있는 동안 두 번 튀기 전까지 계속 칠 수 있다', () => {
    const rand = seeded(11)
    let backShots = 0
    for (const diff of ['easy', 'normal', 'hard'] as const) {
      for (let i = 0; i < 60; i++) {
        const from = { x: (rand() * 2 - 1) * 2.4, y: 0.7, z: 3 + rand() * 3 }
        const ball: Ball = { p: { ...from }, v: cpuShot(from, diff, false, rand) }
        const shot = new Shot('cpu')
        let back = false
        for (let t = 0; t < 5; t += 1 / 120) {
          const ends = step(ball, 1 / 120).map((e) => {
            if (e.hit === 'back' && shot.frontOk) back = true
            return shot.apply(e)
          })
          if (ends.some(Boolean)) break
          if (back && ball.p.z >= 5.3 && ball.p.y <= 2.4) expect(inYourReach(ball, shot), `${diff} #${i}`).toBe(true)
        }
        if (back) backShots++
      }
    }
    expect(backShots).toBeGreaterThan(10)
  })

  it('한 번 튀고 뒷벽을 맞은 공을 칠 시간이 남는다', () => {
    // 뒤 코트에 떨어져 뒷벽으로 가는 드라이브
    const from = { x: 1.2, y: 0.6, z: 4 }
    const ball: Ball = { p: { ...from }, v: aimVelocity(from, 1.5, 1.6, 15) }
    const shot = new Shot('cpu')
    let afterBack = 0
    let order = ''
    for (let t = 0; t < 5; t += 1 / 120) {
      const ends = step(ball, 1 / 120).map((e) => {
        if (shot.frontOk && e.hit !== 'side') order += e.hit[0]
        return shot.apply(e)
      })
      if (ends.some(Boolean)) break
      if (shot.backWall && inYourReach(ball, shot)) afterBack++
    }
    expect(order.startsWith('fb')).toBe(true) // 바닥 → 뒷벽
    expect(afterBack / 120).toBeGreaterThan(0.25)
  })

  it('뒷벽 2.13m, 옆벽 비스듬한 아웃 라인 위에 맞으면 아웃', () => {
    const shot = new Shot('cpu')
    expect(shot.apply({ hit: 'back', at: { x: 0, y: 2.5, z: COURT.length } })).toBe('out')
    expect(new Shot('cpu').apply({ hit: 'back', at: { x: 0, y: 1.8, z: COURT.length } })).toBeNull()
    expect(new Shot('cpu').apply({ hit: 'side', at: { x: 3.2, y: 4, z: 1 } })).toBeNull()
    expect(new Shot('cpu').apply({ hit: 'side', at: { x: 3.2, y: 4, z: 8 } })).toBe('out')
  })

  it('상대는 아웃이 될 공을 치지 않는다', () => {
    const rand = seeded(5)
    for (let i = 0; i < 60; i++) {
      const from = { x: (rand() * 2 - 1) * 2.4, y: 0.7, z: 3 + rand() * 4 }
      const v = cpuShot(from, 'hard', false, rand)
      expect(outcome({ p: from, v }, new Shot('cpu')), `#${i}`).toBe('double')
    }
  })
})
