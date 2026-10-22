// 빌드 전용 진입점이라 화면 갱신(fast refresh)과 무관하다
// oxlint-disable react/only-export-components
import { renderToString } from 'react-dom/server'
import App from './App'
import { preloaded } from './data/live'
import { setSsrHash } from './router'

export { SEO_PAGES, SITE, REGION_SLUG } from './seo'
export { GLOSSARY, CATEGORIES } from './data/glossary'
export { WARMUP, COOLDOWN, FOAM_ROLLER } from './data/stretches'
export { DISCLOSURE } from './data/partners'

/** 빌드할 때 화면 하나를 HTML로 그린다(검색엔진과 AI가 자바스크립트 없이 읽게) */
export function render(hash: string, data: Record<string, unknown> = {}) {
  setSsrHash(hash)
  Object.assign(preloaded, data)
  return renderToString(<App />)
}
