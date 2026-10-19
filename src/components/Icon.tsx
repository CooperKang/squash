import type { Route } from '../router'

const PATHS: Record<Route, string> = {
  home: 'M4 11 12 4l8 7v9h-5v-6H9v6H4z',
  about: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5v.01M11 11h1v6h1',
  rules: 'M5 3h14v18H5zM5 9h14M12 9v12M5 15h7',
  gear: 'M9 3c3.3 0 6 2.9 6 6.5S12.3 16 9 16 3 13.1 3 9.5 5.7 3 9 3Zm2.6 12.4L19 21m-1.5-6a2.5 2.5 0 1 0 0 .01',
  finder: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM15.5 15.5 20 20',
  live: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  giyeok: 'M4 4h16v16h-7v-9H4z',
  game: 'M6 8h12a4 4 0 0 1 4 4v1a4 4 0 0 1-7 2.6h-6A4 4 0 0 1 2 13v-1a4 4 0 0 1 4-4Zm1 2v4m-2-2h4m6.5-.5v.01m2 2v.01',
}

export function RouteIcon({ id, className }: { id: Route; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[id]} />
    </svg>
  )
}

export function Arrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </svg>
  )
}

export function External({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  )
}
