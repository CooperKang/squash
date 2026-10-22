import { describe, expect, it } from 'vitest'
import { KIT_GROUPS, KIT_TIPS } from './kit'
import { PARTNERS, picksFor, type PartnerKey } from './partners'

const partnerKeys = () => Object.keys(PARTNERS) as PartnerKey[]
const allItems = () => partnerKeys().flatMap((k) => PARTNERS[k].items.map((it) => ({ key: k, ...it })))

describe('kit', () => {
  it('상담의 링크 키가 모두 partners.json에 있다', () => {
    const missing = KIT_TIPS.flatMap((t) => t.links).filter((k) => !partnerKeys().includes(k))
    expect(missing).toEqual([])
  })

  it('상담 id와 칩이 겹치지 않는다', () => {
    expect(new Set(KIT_TIPS.map((t) => t.id)).size).toBe(KIT_TIPS.length)
    expect(new Set(KIT_TIPS.map((t) => t.chip)).size).toBe(KIT_TIPS.length)
  })

  it('품목마다 상담이 하나 이상 있다', () => {
    for (const g of KIT_GROUPS) expect(KIT_TIPS.some((t) => t.group === g.id), g.id).toBe(true)
  })

  it('상담 12개가 스펙 표의 id와 같다', () => {
    expect(KIT_TIPS.map((t) => t.id)).toEqual([
      'sweat-hand', 'thin-grip', 'thick-grip', 'new-racket',
      'weak-ankle', 'running-shoes', 'wide-foot',
      'sweat-eyes', 'sweat-wrist',
      'eye-guard',
      'sore-calf', 'dead-ball',
    ])
  })
})

describe('partners.json', () => {
  it('url은 비었거나 https://link.coupang.com/ 로 시작한다', () => {
    const bad = allItems().filter((it) => it.url && !it.url.startsWith('https://link.coupang.com/'))
    expect(bad.map((it) => `${it.key}: ${it.name}`)).toEqual([])
  })

  it('url이 있으면 name도 있다', () => {
    expect(allItems().filter((it) => it.url && !it.name.trim())).toEqual([])
  })
})

describe('picksFor', () => {
  it('url이 빈 항목은 빼고 키 순서대로 최대 3개', () => {
    const keys = partnerKeys()
    const picks = picksFor(keys)
    expect(picks.length).toBeLessThanOrEqual(3)
    expect(picks.every((p) => p.url.startsWith('https://link.coupang.com/'))).toBe(true)
    const order = picks.map((p) => keys.indexOf(p.key))
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('보여 줄 상품이 없으면 빈 배열', () => {
    expect(picksFor([])).toEqual([])
  })
})

describe('상담 문구 사실 확인', () => {
  const tip = (id: string) => KIT_TIPS.find((t) => t.id === id)!
  const text = (id: string) => [tip(id).a, ...tip(id).tries, tip(id).look].join(' ')
  it('교체용 그립은 판다(원그립을 못 구한다고 하지 않는다)', () => {
    expect(text('new-racket')).not.toMatch(/따로 팔지 않/)
  })
  it('보호안경을 일반 안경 위에 쓰라고 하지 않는다', () => {
    expect(text('eye-guard')).not.toMatch(/안경 위에/)
  })
  it('렛은 상대를 칠 위험이 있을 때 요청한다', () => {
    expect(text('eye-guard')).not.toMatch(/내 몸 쪽으로/)
  })
})
