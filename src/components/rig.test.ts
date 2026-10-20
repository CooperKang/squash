import { describe, expect, it } from 'vitest'
import { COOLDOWN, FOAM_ROLLER, WARMUP } from '../data/stretches'
import { MOVES } from '../data/stretchMoves'
import { timeline } from './rig'

describe('스트레칭 동작', () => {
  const all = [...WARMUP, ...COOLDOWN, ...FOAM_ROLLER]

  it('모든 스트레칭에 동작 그림이 있다', () => {
    for (const s of all) expect(MOVES[s.name], s.name).toBeDefined()
  })

  it('어느 순간에도 좌표가 정상이고 몸이 바닥을 크게 뚫지 않는다', () => {
    for (const [name, move] of Object.entries(MOVES)) {
      const tl = timeline(move)
      for (let i = 0; i < 40; i++) {
        const { fig } = tl.at((tl.total * i) / 40)
        for (const [k, v] of Object.entries(fig.p)) {
          expect(Number.isFinite(v.x) && Number.isFinite(v.y), `${name} ${k}`).toBe(true)
          expect(v.y, `${name} ${k}`).toBeGreaterThan(-4)
        }
      }
    }
  })

  it('설명 줄 번호가 설명 수를 넘지 않는다', () => {
    for (const s of all) for (const k of MOVES[s.name].keys) expect(k.step ?? 0, s.name).toBeLessThan(s.how.length)
  })
})
