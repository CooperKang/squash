import { useEffect, useState } from 'react'

// GitHub Pages에서 새로고침해도 깨지지 않게 해시 주소(#/rules)로 화면을 나눈다
export type Route = 'home' | 'about' | 'rules' | 'giyeok' | 'shots' | 'practice' | 'gear' | 'finder' | 'live' | 'courts' | 'game'

// parent가 있는 화면은 메뉴 대신 그 섹션 위의 작은 탭으로 들어간다
export const ROUTES: { id: Route; label: string; short: string; parent?: Route; desktopOnly?: boolean }[] = [
  { id: 'home', label: '처음', short: '처음' },
  { id: 'about', label: '스쿼시란', short: '소개', desktopOnly: true },
  { id: 'rules', label: '경기 규칙', short: '규칙' },
  { id: 'giyeok', label: 'ㄱ자 게임', short: 'ㄱ자', parent: 'rules' },
  { id: 'shots', label: '기술', short: '기술' },
  { id: 'practice', label: '혼자 연습', short: '연습', parent: 'shots' },
  { id: 'gear', label: '장비', short: '장비' },
  { id: 'finder', label: '라켓 찾기', short: '라켓', parent: 'gear' },
  { id: 'live', label: '대회 현황', short: '현황' },
  { id: 'courts', label: '코트 찾기', short: '코트' },
  { id: 'game', label: '게임', short: '게임' },
]

export const NAV = ROUTES.filter((r) => r.id !== 'home' && !r.parent)
export const MOBILE_NAV = NAV.filter((r) => !r.desktopOnly)

/** 지금 화면이 속한 섹션의 탭(섹션 첫 화면 + 하위 화면). 하위 화면이 없으면 빈 배열 */
export function sectionTabs(route: Route) {
  const top = ROUTES.find((r) => r.id === route)?.parent ?? route
  const kids = ROUTES.filter((r) => r.parent === top)
  return kids.length ? [ROUTES.find((r) => r.id === top)!, ...kids] : []
}

export function inSection(route: Route, id: Route) {
  return route === id || ROUTES.find((r) => r.id === route)?.parent === id
}

function parse(): Route {
  const id = location.hash.replace(/^#\/?/, '').split('?')[0]
  return ROUTES.some((r) => r.id === id) ? (id as Route) : 'home'
}

export function href(route: Route) {
  return route === 'home' ? '#/' : `#/${route}`
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(parse)
  useEffect(() => {
    const onHash = () => {
      setRoute(parse())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return route
}

/** #/shots?s=boast 같은 주소의 값 */
export function hashParam(name: string) {
  const q = location.hash.split('?')[1] ?? ''
  return new URLSearchParams(q).get(name)
}

/** 화면을 다시 그리지 않고 주소의 값만 바꾼다(공유·새로고침용) */
export function setHashParam(route: Route, name: string, value: string) {
  history.replaceState(null, '', `${href(route)}?${name}=${encodeURIComponent(value)}`)
}
