import { useEffect, useState } from 'react'

// GitHub Pages에서 새로고침해도 깨지지 않게 해시 주소(#/rules)로 화면을 나눈다
export type Route = 'home' | 'about' | 'rules' | 'gear' | 'finder' | 'live' | 'game'

export const ROUTES: { id: Route; label: string; short: string }[] = [
  { id: 'home', label: '처음', short: '처음' },
  { id: 'about', label: '스쿼시란', short: '소개' },
  { id: 'rules', label: '경기 규칙', short: '규칙' },
  { id: 'gear', label: '장비', short: '장비' },
  { id: 'finder', label: '라켓 찾기', short: '라켓' },
  { id: 'live', label: '대회 현황', short: '현황' },
  { id: 'game', label: '게임', short: '게임' },
]

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
