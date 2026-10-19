import { href, type Route } from '../router'
import { Arrow, RouteIcon } from '../components/Icon'
import { FrameStripe } from '../components/ui'

const TILES: { id: Route; title: string; body: string }[] = [
  { id: 'about', title: '스쿼시란?', body: '네 벽으로 둘러싸인 코트에서 벽에 공을 번갈아 치는 실내 라켓 스포츠예요.' },
  { id: 'rules', title: '경기 규칙', body: '서브, 틴, 렛·스트로크, 11점 랠리 포인트까지 코트 그림과 함께 정리했어요.' },
  { id: 'giyeok', title: 'ㄱ자 게임', body: '동호회에서 여럿이 돌아가며 치는 3/4 코트 게임. 어디로 치면 실점인지 코트에서 눌러 봐요.' },
  { id: 'gear', title: '장비 고르기', body: '라켓 무게와 밸런스, 브랜드별 성향, 공의 점 색깔이 뜻하는 것.' },
  { id: 'finder', title: '내 라켓 찾기', body: '네 가지 질문에 답하면 영산스포츠 판매 라켓 중에서 골라 드려요.' },
  { id: 'live', title: '대회 현황판', body: 'PSA 월드 투어와 국내 대회 일정, 최근 결과와 세계 랭킹.' },
  { id: 'game', title: '터치 스쿼시', body: '날아오는 공을 직접 눌러 치는 미니 게임. PC는 마우스, 폰은 터치로.' },
]

export default function Home() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pt-10 pb-6 md:grid-cols-[1.15fr_1fr] md:pt-16">
        <div>
          <p className="font-wide text-[11px] tracking-[0.22em] text-teal">SQUASH 101</p>
          <h1 className="mt-4 text-[40px] leading-[1.08] font-extrabold tracking-[-0.03em] md:text-[64px]">
            벽을 치는 순간,
            <br />
            <span className="text-teal">스쿼시</span>가 시작돼요
          </h1>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-muted">
            처음 코트에 들어서는 사람을 위한 안내서예요. 규칙과 장비를 익히고, 나에게 맞는 라켓을 찾고, 세계 대회 소식까지 한곳에서 봐요.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <a href={href('about')} className="inline-flex items-center gap-2 rounded-2xl bg-ink px-5 py-3.5 text-[15px] font-bold text-white transition hover:bg-teal-deep">
              처음부터 알아보기 <Arrow className="size-4" />
            </a>
            <a href={href('game')} className="inline-flex items-center gap-2 rounded-2xl border border-ink/15 bg-white px-5 py-3.5 text-[15px] font-bold transition hover:border-teal hover:text-teal">
              게임부터 해보기
            </a>
          </div>
        </div>
        <HeroRacket />
      </section>

      <div className="mx-auto max-w-6xl px-4">
        <FrameStripe className="my-8" />
      </div>

      <section className="mx-auto max-w-6xl px-4" aria-label="메뉴">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map((t, i) => (
            <li key={t.id}>
              <a
                href={href(t.id)}
                className="group flex h-full flex-col rounded-[24px] border border-line/80 bg-card p-5 transition hover:-translate-y-0.5 hover:border-teal/40 hover:shadow-[0_20px_40px_-28px_rgb(0_77_87/0.6)] md:p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-2xl bg-teal-soft text-teal">
                    <RouteIcon id={t.id} className="size-6" />
                  </span>
                  <span className="font-wide text-[11px] text-muted/70">0{i + 1}</span>
                </div>
                <h2 className="mt-5 text-[20px] font-extrabold">{t.title}</h2>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{t.body}</p>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-[14px] font-bold text-teal">
                  열기 <Arrow className="size-4 transition group-hover:translate-x-0.5" />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

// Response 115의 색(실버 프레임, 틸 그래픽, 검정 링, 흰 그립)으로 그린 라켓
function HeroRacket() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[440px]">
      <div className="absolute inset-[8%] rounded-full bg-teal-soft" />
      <svg viewBox="0 0 400 400" className="relative size-full drop-shadow-[0_30px_40px_rgb(0_0_0/0.18)]" role="img" aria-label="실버와 청록색 스쿼시 라켓 그림">
        <defs>
          <linearGradient id="frame" x1="0" x2="1">
            <stop offset="0" stopColor="#b9bebd" />
            <stop offset="0.5" stopColor="#e6e9e8" />
            <stop offset="1" stopColor="#aeb3b2" />
          </linearGradient>
          <clipPath id="head">
            <path d="M200 40c62 0 104 52 104 118 0 52-30 92-74 112l-30 14-30-14c-44-20-74-60-74-112C96 92 138 40 200 40Z" />
          </clipPath>
        </defs>
        <g transform="translate(200 186) scale(0.84) translate(-200 -200) rotate(-28 200 200)">
          <g clipPath="url(#head)" stroke="#141618" strokeOpacity="0.28" strokeWidth="1.4">
            {Array.from({ length: 14 }, (_, i) => (
              <line key={`v${i}`} x1={110 + i * 14} y1="30" x2={110 + i * 14} y2="300" />
            ))}
            {Array.from({ length: 18 }, (_, i) => (
              <line key={`h${i}`} x1="90" y1={52 + i * 14} x2="310" y2={52 + i * 14} />
            ))}
          </g>
          <path
            d="M200 40c62 0 104 52 104 118 0 52-30 92-74 112l-30 14-30-14c-44-20-74-60-74-112C96 92 138 40 200 40Z"
            fill="none"
            stroke="url(#frame)"
            strokeWidth="15"
          />
          <path d="M112 112c10-30 30-52 58-62" fill="none" stroke="#00707d" strokeWidth="15" strokeLinecap="round" />
          <path d="M288 196c-8 26-26 46-48 58" fill="none" stroke="#00707d" strokeWidth="15" strokeLinecap="round" />
          <path d="M184 276 196 360h8l12-84" fill="url(#frame)" />
          <text x="200" y="330" textAnchor="middle" fontFamily="Michroma" fontSize="8" fill="#00707d" transform="rotate(-90 200 330)">
            RESPONSE115
          </text>
          <rect x="190" y="356" width="20" height="14" rx="3" fill="#141618" />
          <rect x="191" y="368" width="18" height="78" rx="6" fill="#ffffff" stroke="#d9dddc" />
          {Array.from({ length: 6 }, (_, i) => (
            <line key={i} x1="191" y1={376 + i * 12} x2="209" y2={370 + i * 12} stroke="#e3e6e5" strokeWidth="2" />
          ))}
        </g>
        <circle cx="318" cy="300" r="20" fill="#141618" />
        <circle cx="311" cy="292" r="3.2" fill="#f2c230" />
        <circle cx="322" cy="289" r="3.2" fill="#f2c230" />
      </svg>
    </div>
  )
}
