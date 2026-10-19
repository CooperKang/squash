import { ROUTES, href, useRoute, type Route } from './router'
import { RouteIcon } from './components/Icon'
import Home from './pages/Home'
import About from './pages/About'
import Rules from './pages/Rules'
import Gear from './pages/Gear'
import Finder from './pages/Finder'
import Live from './pages/Live'
import Game from './pages/Game'

const PAGES: Record<Route, () => React.JSX.Element> = {
  home: Home,
  about: About,
  rules: Rules,
  gear: Gear,
  finder: Finder,
  live: Live,
  game: Game,
}

export default function App() {
  const route = useRoute()
  const Page = PAGES[route]
  return (
    <div className="min-h-dvh pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-court/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 md:h-16">
          <a href={href('home')} className="flex items-center gap-2.5" aria-label="스쿼시 코트 처음 화면">
            <Logo />
            <span className="font-wide text-[13px] tracking-[0.18em] text-ink">
              SQUASH<span className="text-teal">COURT</span>
            </span>
          </a>
          <nav className="ml-auto hidden md:block" aria-label="주 메뉴">
            <ul className="flex items-center gap-1">
              {ROUTES.slice(1).map((r) => (
                <li key={r.id}>
                  <a
                    href={href(r.id)}
                    aria-current={route === r.id ? 'page' : undefined}
                    className="rounded-full px-3.5 py-2 text-[15px] font-semibold text-muted transition hover:text-ink aria-[current=page]:bg-ink aria-[current=page]:text-white"
                  >
                    {r.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <a href="https://cooperkang.github.io/" className="ml-auto text-[13px] font-medium text-muted underline-offset-4 hover:underline md:ml-2">
            서비스 허브
          </a>
        </div>
      </header>

      <main>
        <Page key={route} />
      </main>

      {route !== 'game' && (
        <footer className="mx-auto mt-16 flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4 pb-10 text-[13px] text-muted">
          <span>
            만든 사람 <a className="underline underline-offset-4" href="https://github.com/CooperKang">JaeHa Kang</a>
          </span>
          <a className="underline underline-offset-4" href="https://github.com/CooperKang/squash">소스 코드</a>
          <span>라켓 정보와 가격은 판매처 기준이며 바뀔 수 있어요.</span>
        </footer>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="주 메뉴">
        <ul className="grid grid-cols-6">
          {ROUTES.slice(1).map((r) => (
            <li key={r.id}>
              <a
                href={href(r.id)}
                aria-current={route === r.id ? 'page' : undefined}
                className="flex h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-semibold text-muted aria-[current=page]:text-teal"
              >
                <RouteIcon id={r.id} className="size-[22px]" />
                {r.short}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#141618" />
      <ellipse cx="15" cy="12.5" rx="7.2" ry="8.6" fill="none" stroke="#C9CDCC" strokeWidth="2.4" />
      <path d="M10 14.5c3-1 7-1 10 0" stroke="#19A3AE" strokeWidth="1.6" fill="none" />
      <rect x="13.9" y="20.6" width="2.2" height="8" rx="1" fill="#C9CDCC" />
      <circle cx="24.6" cy="24.4" r="2.6" fill="#ffffff" />
      <circle cx="23.8" cy="23.6" r="0.7" fill="#F2C230" />
    </svg>
  )
}
