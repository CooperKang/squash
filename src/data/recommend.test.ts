import { describe, expect, it } from 'vitest'
import { RACKETS } from './rackets'
import { recommend } from './recommend'

describe('recommend', () => {
  it('어린이용 라켓은 추천하지 않는다', () => {
    const list = recommend(RACKETS, { level: 'beg', style: 'allround', feel: 'stable', budget: 0 }, 20)
    expect(list.every((s) => s.racket.style !== 'junior')).toBe(true)
  })

  it('입문자에게 상급 컨트롤 라켓을 1순위로 주지 않는다', () => {
    const [top] = recommend(RACKETS, { level: 'beg', style: 'power', feel: 'stable', budget: 0 })
    expect(top.racket.level).not.toBe('adv')
    expect(top.racket.style).toBe('power')
  })

  it('예산 안의 라켓을 앞에 둔다', () => {
    const list = recommend(RACKETS, { level: 'mid', style: 'allround', feel: 'light', budget: 150000 }, 3)
    expect(list.every((s) => s.racket.priceKRW <= 150000)).toBe(true)
  })

  it('같은 라인·무게의 색상만 다른 모델은 한 번만 나온다', () => {
    const list = recommend(RACKETS, { level: 'mid', style: 'power', feel: 'stable', budget: 0 }, 20)
    const keys = list.map((s) => `${s.racket.brand}|${s.racket.line}|${s.racket.weightG}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('모든 라켓에 영산스포츠 구매 링크가 있다', () => {
    expect(RACKETS.length).toBeGreaterThan(50)
    expect(RACKETS.every((r) => r.url.startsWith('https://www.ysretail.com/product/pro_view?'))).toBe(true)
  })
})
