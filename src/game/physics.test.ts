import { describe, expect, it } from 'vitest'
import { COURT, Shot, findReachWindow, inCpuReach, inYourReach, simulate, step, type Ball, type Vec } from './physics'
import { cpuShot, intentFrom, judge, kindFor, newShot, plan, playerShot, type ShotKind } from './shots'
import { status, winner } from './score'

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const floorsAfterFront = (from: Vec, v: Vec, shot: Shot) => {
  const sim = simulate({ p: from, v }, shot)
  const fi = sim.events.findIndex((e) => e.hit === 'front')
  return { sim, floors: sim.events.slice(fi + 1).filter((e) => e.hit === 'floor'), before: sim.events.slice(0, fi) }
}

describe('샷 계획기', () => {
  const back = { x: 2.3, y: 0.8, z: 8.0 }
  const front = { x: 1.5, y: 0.9, z: 3.8 }
  const cases: [ShotKind, Vec][] = [
    ['drive', back],
    ['cross', back],
    ['lob', back],
    ['cross-lob', back],
    ['boast', back],
    ['three-wall', back],
    ['skid', back],
    ['drop', front],
    ['cross-drop', front],
    ['kill', { x: 1.2, y: 1.3, z: 4.5 }],
    ['reverse', { x: 1.6, y: 0.9, z: 3.5 }],
    ['back-wall', { x: 2.5, y: 0.6, z: 9.1 }],
    ['serve-lob', { x: 1.6, y: 1, z: 6 }],
    ['serve-hard', { x: 1.6, y: 1, z: 6 }],
  ]
  it.each(cases)('%s 는 조건에 맞는 공을 찾는다', (kind, from) => {
    const p = plan(kind, from, { by: 'you', samples: 300, rand: seeded(3) })
    expect(p.length).toBeGreaterThan(0)
    expect(p[0].score).toBeGreaterThan(0.5)
  })

  it('스트레이트 드라이브는 옆벽 50cm 안쪽에 떨어져 뒤 구석까지 간다', () => {
    const [best] = plan('drive', back, { by: 'you', samples: 200, rand: seeded(5) })
    const { floors } = floorsAfterFront(back, best.v, new Shot('you'))
    expect(floors[0].at.x).toBeGreaterThan(COURT.halfWidth - 0.5)
    expect(floors[0].at.z).toBeGreaterThan(6)
  })

  it('보스트는 가까운 옆벽 → 앞벽을 맞고 반대쪽 앞 코트에 떨어진다', () => {
    for (const from of [back, { x: -2.0, y: 0.6, z: 7.5 }, { x: 2.8, y: 0.7, z: 6.5 }, { x: 2.9, y: 0.5, z: 8.8 }]) {
      const [best] = plan('boast', from, { by: 'you', samples: 300, rand: seeded(7) })
      const { floors, before, sim } = floorsAfterFront(from, best.v, new Shot('you'))
      const s = Math.sign(from.x)
      expect(before[0].hit).toBe('side')
      expect(Math.sign(before[0].at.x)).toBe(s)
      const frontHit = sim.events.find((e) => e.hit === 'front')!
      expect(frontHit.at.x * -s, '앞벽은 반대쪽 절반').toBeGreaterThan(0)
      expect(floors[0].at.z).toBeLessThan(3.5)
    }
  })

  it('타이밍이 좋으면 계획한 샷이 그대로 들어간다', () => {
    const rand = seeded(13)
    for (const kind of ['drive', 'cross', 'drop', 'boast'] as ShotKind[]) {
      const from = kind === 'drop' ? front : back
      const hit = playerShot(kind, from, 1, rand)!
      const sim = simulate({ p: from, v: hit.v }, newShot('you', kind, from))
      expect(judge(kind, sim, Math.sign(from.x)), kind).not.toBeNull()
    }
  })

  it('라켓이 때린 곳으로 샷이 정해진다', () => {
    // 오른쪽 벽 가까운 공: 왼쪽(안쪽)은 보스트, 가운데는 스트레이트, 오른쪽(벽 쪽)은 크로스
    expect(kindFor(intentFrom(2.4, -0.7, 0), back, false)).toBe('boast')
    expect(kindFor(intentFrom(2.4, 0, 0), back, false)).toBe('drive')
    expect(kindFor(intentFrom(2.4, 0.7, 0), back, false)).toBe('cross')
    expect(kindFor(intentFrom(2.4, 0, -0.7), back, false)).toBe('drop')
    expect(kindFor(intentFrom(2.4, 0.7, 0.7), back, false)).toBe('cross-lob')
    expect(kindFor(intentFrom(2.4, 0, -0.7), { x: 2.4, y: 1.4, z: 5 }, false)).toBe('kill')
    // 왼쪽 벽 가까운 공은 좌우가 바뀐다
    expect(kindFor(intentFrom(-2.4, 0.7, 0), back, false)).toBe('boast')
    expect(kindFor(intentFrom(-2.4, -0.7, 0), back, false)).toBe('cross')
    expect(kindFor(intentFrom(1.6, 0, 0), back, true)).toBe('serve-lob')
  })
})

describe('상대 샷', () => {
  it('상대 샷은 늘 규칙 안이고 내가 칠 수 있는 구간이 생긴다', () => {
    const rand = seeded(7)
    const kinds = new Set<string>()
    for (const diff of ['easy', 'normal', 'hard'] as const) {
      for (let i = 0; i < 30; i++) {
        const from = { x: (rand() * 2 - 1) * 2.5, y: 0.5 + rand() * 0.8, z: 3 + rand() * 5 }
        const { v, kind } = cpuShot(from, diff, false, rand)
        kinds.add(kind)
        const shot = newShot('cpu', kind, from)
        expect(simulate({ p: from, v }, shot).result, `${diff} #${i} ${kind}`).toBe('double')
        const w = findReachWindow({ p: from, v }, newShot('cpu', kind, from), inYourReach)
        expect(w, `${diff} #${i} ${kind}`).not.toBeNull()
      }
    }
    expect(kinds.size).toBeGreaterThan(3)
  })

  it('상대 서브는 서비스 라인 위로 들어가 반대쪽 뒤 코트에 떨어진다', () => {
    const rand = seeded(3)
    for (let i = 0; i < 15; i++) {
      const from = { x: (i % 2 ? -1 : 1) * 1.6, y: 1, z: 6 }
      const { v, kind } = cpuShot(from, 'normal', true, rand)
      expect(simulate({ p: from, v }, newShot('cpu', kind, from, true)).result).toBe('double')
    }
  })
})

describe('규칙', () => {
  it('11점을 먼저 내고 2점 앞서야 이긴다', () => {
    expect(winner({ you: 11, cpu: 9 })).toBe('you')
    expect(winner({ you: 11, cpu: 10 })).toBeNull()
    expect(winner({ you: 10, cpu: 12 })).toBe('cpu')
    expect(winner({ you: 7, cpu: 3 })).toBeNull()
  })

  it('듀스와 게임볼을 알아본다', () => {
    expect(status({ you: 10, cpu: 10 })).toBe('deuce')
    expect(status({ you: 12, cpu: 12 })).toBe('deuce')
    expect(status({ you: 10, cpu: 7 })).toBe('game-ball-you')
    expect(status({ you: 11, cpu: 10 })).toBe('game-ball-you')
    expect(status({ you: 9, cpu: 10 })).toBe('game-ball-cpu')
    expect(status({ you: 9, cpu: 9 })).toBeNull()
    expect(status({ you: 11, cpu: 9 })).toBeNull()
  })

  it('서브가 옆벽부터 맞거나 같은 쪽에 떨어지면 서브 폴트', () => {
    expect(new Shot('you', true, 1).apply({ hit: 'side', at: { x: 3.1, y: 1.5, z: 5 } })).toBe('serve-fault')
    const s = new Shot('you', true, 1)
    s.apply({ hit: 'front', at: { x: 0, y: 2.5, z: 0.1 } })
    expect(s.apply({ hit: 'floor', at: { x: 1.5, y: 0.1, z: 8 } })).toBe('serve-fault')
    const ok = new Shot('you', true, 1)
    ok.apply({ hit: 'front', at: { x: 0, y: 2.5, z: 0.1 } })
    expect(ok.apply({ hit: 'floor', at: { x: -1.5, y: 0.1, z: 8 } })).toBeNull()
  })

  it('랠리에서 옆벽 먼저 맞힌 샷은 보스트', () => {
    const s = new Shot('you')
    expect(s.apply({ hit: 'side', at: { x: 3.1, y: 1.5, z: 5 } })).toBeNull()
    expect(s.boast).toBe(true)
  })

  it('뒷벽 2.13m, 옆벽 비스듬한 아웃 라인 위에 맞으면 아웃', () => {
    expect(new Shot('cpu').apply({ hit: 'back', at: { x: 0, y: 2.5, z: COURT.length } })).toBe('out')
    expect(new Shot('cpu').apply({ hit: 'back', at: { x: 0, y: 1.8, z: COURT.length } })).toBeNull()
    expect(new Shot('cpu').apply({ hit: 'side', at: { x: 3.2, y: 4, z: 1 } })).toBeNull()
    expect(new Shot('cpu').apply({ hit: 'side', at: { x: 3.2, y: 4, z: 8 } })).toBe('out')
  })
})

describe('뒷벽', () => {
  it('뒷벽을 맞고 나온 공은 뒤 코트에 있는 동안 두 번 튀기 전까지 계속 칠 수 있다', () => {
    const rand = seeded(11)
    let backShots = 0
    for (let i = 0; i < 120; i++) {
      const from = { x: (rand() * 2 - 1) * 2.4, y: 0.7, z: 3 + rand() * 3 }
      const { v, kind } = cpuShot(from, 'normal', false, rand)
      const ball: Ball = { p: { ...from }, v }
      const shot = newShot('cpu', kind, from)
      let back = false
      for (let t = 0; t < 5; t += 1 / 120) {
        const ends = step(ball, 1 / 120).map((e) => {
          if (e.hit === 'back' && shot.frontOk) back = true
          return shot.apply(e)
        })
        if (ends.some(Boolean)) break
        if (back && ball.p.z >= 5.3 && ball.p.y <= 2.4) expect(inYourReach(ball, shot)).toBe(true)
      }
      if (back) backShots++
    }
    expect(backShots).toBeGreaterThan(10)
  })

  it('한 번 튀고 뒷벽을 맞은 공을 칠 시간이 남는다', () => {
    // 뒤 코트에 떨어져 뒷벽으로 가는 드라이브
    const from = { x: 1.2, y: 0.6, z: 4 }
    const drives = plan('drive', from, { by: 'cpu', samples: 200, rand: seeded(17) })
    // 그중 뒷벽에 가장 높이 맞아 앞으로 튀어나오는 공
    const backY = (d: (typeof drives)[number]) => {
      const f = d.sim.events.findIndex((e) => e.hit === 'front')
      const after = d.sim.events.slice(f + 1).filter((e) => e.hit !== 'side')
      return after[0]?.hit === 'floor' && after[1]?.hit === 'back' ? after[1].at.y : -1
    }
    const v = [...drives].sort((a, b) => backY(b) - backY(a))[0].v
    const ball: Ball = { p: { ...from }, v }
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
    expect(afterBack / 120).toBeGreaterThan(0.2)
  })

  it('상대는 한 번 튄 공이나 뒤에서 발리로 받는다', () => {
    const s = new Shot('you')
    s.frontOk = true
    s.floorAfterFront = 1
    expect(inCpuReach({ p: { x: 0, y: 0.6, z: 4 }, v: { x: 0, y: -1, z: 1 } }, s)).toBe(true)
  })
})

describe('기술 백과와 혼자 연습 3D', () => {
  it('모든 샷의 3D 그림이 포핸드·백핸드 모두 조건에 맞게 만들어진다', async () => {
    const { SHOTS, shotSim } = await import('../data/shots')
    for (const s of SHOTS)
      for (const back of [false, true]) {
        const [seg] = shotSim(s, back)
        expect(seg, `${s.id} ${back}`).toBeTruthy()
        expect(seg.sim.result, s.id).toBe('double')
        expect(Math.sign(seg.from.x), '백핸드는 왼쪽에서').toBe(back ? -1 : 1)
      }
  })

  it('모든 연습이 끝까지 이어진다', async () => {
    const { DRILLS } = await import('../data/drills')
    const { buildSequence } = await import('./sequence')
    for (const d of DRILLS)
      for (const back of [false, true]) expect(buildSequence(d.id, d.start, d.sequence, back).length, `${d.id} ${back}`).toBe(d.sequence.length)
  })
})
