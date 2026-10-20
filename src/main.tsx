import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { hashForPath } from './seo'

// 검색으로 /squash/rules/ 같은 정적 주소에 들어오면 앱 주소(#/rules)로 바꿔 연다
if (!location.hash) {
  const hash = hashForPath(location.pathname, import.meta.env.BASE_URL)
  if (hash) history.replaceState(null, '', import.meta.env.BASE_URL + hash)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
