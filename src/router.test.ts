import { describe, expect, it } from 'vitest'
import { sectionTabs } from './router'
import { SEO_PAGES } from './seo'
import { KIT_GROUPS } from './data/kit'
import { kitView } from './pages/kitView'

describe('소모품 상담 주소', () => {
  it('kit은 장비 섹션 탭이다', () => {
    expect(sectionTabs('kit').map((r) => r.id)).toEqual(['gear', 'finder', 'kit'])
  })

  it('SEO_PAGES에 소모품 페이지 6개', () => {
    const kit = SEO_PAGES.filter((p) => p.path.startsWith('kit/')).map((p) => [p.path, p.hash])
    expect(kit).toEqual([
      ['kit/', '#/kit'],
      ['kit/grip/', '#/kit?g=grip'],
      ['kit/shoes/', '#/kit?g=shoes'],
      ['kit/sweat/', '#/kit?g=sweat'],
      ['kit/protect/', '#/kit?g=protect'],
      ['kit/recovery/', '#/kit?g=recovery'],
    ])
  })

  it('KIT_GROUPS의 path가 모두 SEO_PAGES에 있다', () => {
    for (const g of KIT_GROUPS) expect(SEO_PAGES.some((p) => p.path === g.path), g.path).toBe(true)
  })

  it('없는 id는 전체로', () => {
    expect(kitView('foo', 'bar')).toEqual({ group: 'all', focus: null })
  })

  it('상담 id로 들어오면 그 품목을 고른다', () => {
    expect(kitView(null, 'weak-ankle')).toEqual({ group: 'shoes', focus: 'weak-ankle' })
  })

  it('품목만 주면 그 품목', () => {
    expect(kitView('grip', null)).toEqual({ group: 'grip', focus: null })
  })
})
