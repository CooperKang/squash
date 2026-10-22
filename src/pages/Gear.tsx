import { useEffect, useState } from 'react'
import { href } from '../router'
import { Arrow } from '../components/Icon'
import { Card, PageHead, Section } from '../components/ui'
import { loadData, type Rankings } from '../data/live'

const WEIGHTS = [
  { range: '110g 이하', name: '초경량', feel: '손목으로 빠르게 다루는 라켓. 발리와 앞쪽 터치가 날카로워요. 대신 빗맞으면 흔들리고 스윙을 제대로 해야 힘이 실려요.', who: '중·상급, 빠른 템포를 좋아하는 사람' },
  { range: '115~120g', name: '경량', feel: '요즘 가장 많이 쓰는 무게대. 빠르면서도 어느 정도 안정감이 있어요. 프로 선수들도 이 구간이 많아요.', who: '초급을 지난 대부분의 사람' },
  { range: '125~130g', name: '중량', feel: '공을 맞힐 때 덜 흔들리고 힘이 쉽게 실려요. 스윙이 아직 작아도 공이 뒤까지 잘 가요.', who: '입문자, 힘으로 밀어 치는 스타일' },
  { range: '135g 이상', name: '무거운 편', feel: '안정감이 크지만 오래 치면 팔이 지치고 반응이 느려져요. 요즘은 잘 안 쓰는 편이에요.', who: '라켓 무게로 공을 보내고 싶은 사람' },
]

const BALANCE = [
  { name: '헤드 라이트', body: '무게가 손잡이 쪽에 있어 라켓 끝이 가볍게 느껴져요. 손목을 빨리 쓸 수 있어 발리, 앞쪽 공 처리, 방어에 유리해요.', tip: '컨트롤·속도' },
  { name: '이븐', body: '가운데쯤에 무게가 있어 공격과 수비가 고르게 돼요. 처음 사는 라켓으로 무난해요. Response 115가 이븐 밸런스예요.', tip: '올라운드' },
  { name: '헤드 헤비', body: '무게가 헤드 쪽에 있어 스윙에 관성이 붙어요. 같은 힘으로도 공이 묵직하게 나가 뒤쪽 드라이브가 쉬워요.', tip: '파워·안정' },
]

const SHAPE = [
  { name: '티어드롭(오픈 스로트)', body: '헤드와 샤프트가 매끄럽게 이어져 줄이 길어요. 스윗스폿이 넓고 반발력이 커서 파워가 잘 나와요.', who: '파워, 관용성이 필요한 입문자' },
  { name: '클래식(클로즈드 스로트)', body: '헤드 아래에 브리지가 있는 전통적인 모양. 줄이 짧고 촘촘해 공을 오래 잡아 주는 느낌, 원하는 곳에 정확히 놓기 좋아요.', who: '정교한 컨트롤을 원하는 중·상급' },
]

const BRANDS = [
  { name: 'Harrow', origin: '미국', style: '가볍고 빠른 프레임이 강점. 선수 시그니처 모델이 많고, 같은 브랜드 안에서도 Vapor(컨트롤), Reflex·Response(파워), Meta(입문)처럼 성격이 뚜렷하게 나뉘어요.' },
  { name: 'Tecnifibre', origin: '프랑스', style: '정상급 선수들이 많이 쓰는 브랜드. Carboflex는 클래식 모양의 컨트롤 라켓 대명사, X-Top은 헤드에 무게를 더해 안정감을 높였어요.' },
  { name: 'Dunlop', origin: '영국', style: '공(대회 공인구)으로도 유명한 브랜드. FX·Sonic Core는 티어드롭 모양에 반발력이 좋아 파워형, 입문자용 가성비 모델도 많아요.' },
  { name: 'Head', origin: '오스트리아', style: 'Speed(빠른 스윙, 올라운드), Extreme(파워), Radical(컨트롤)처럼 라인이 나뉘어요. 단단하고 정확한 타구감이 특징.' },
  { name: 'Karakal', origin: '영국', style: '아주 가벼운 라켓(90~100g대)으로 유명해요. 무게 대비 가격이 좋아 빠른 라켓을 처음 써 보기 좋아요.' },
  { name: 'Prince', origin: '미국', style: '오래된 라켓 브랜드. 넓은 스윗스폿과 관용성이 좋은 모델이 많고 가격대가 넓어요.' },
  { name: 'Salming', origin: '스웨덴', style: '신발로 잘 알려진 브랜드. Cannone는 이름처럼 파워형, Feather는 가벼운 버전이에요.' },
  { name: 'Wilson', origin: '미국', style: '입문용 가성비 라켓을 찾을 때 자주 보이는 브랜드. 튼튼하고 무난해요.' },
]

const BALLS = [
  { dots: ['#f2c230', '#f2c230'], name: '더블 옐로', bounce: '가장 적게 튐', who: '선수·상급자. 공식 대회 공' },
  { dots: ['#f2c230'], name: '싱글 옐로', bounce: '조금 더 튐', who: '중급 동호인' },
  { dots: ['#d43b2e'], name: '레드', bounce: '잘 튐, 조금 큼', who: '초급, 랠리 연습' },
  { dots: ['#2f6fd1'], name: '블루', bounce: '가장 잘 튐, 큼', who: '처음 배우는 사람, 어린이' },
]

export default function Gear() {
  return (
    <>
      <PageHead eyebrow="EQUIPMENT" title="장비 고르기">
        라켓은 무게, 밸런스, 헤드 모양 세 가지로 성격이 거의 정해져요. 이 세 가지를 알면 매장에서 라켓을 볼 때 무엇을 봐야 할지 보여요.
      </PageHead>

      <Section kicker="01 · WEIGHT" title="라켓 무게">
        <p className="max-w-3xl text-[15.5px] leading-relaxed text-muted">
          라켓 이름의 숫자는 대개 줄을 매기 전 프레임 무게(g)예요. Response <b className="text-ink">115</b>도 115g이라는 뜻이에요. 줄과 그립을 감으면 25~30g쯤 더 무거워져요.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {WEIGHTS.map((w, i) => (
            <Card key={w.range}>
              <div className="flex items-end gap-1" aria-hidden="true">
                {[0, 1, 2, 3].map((k) => (
                  <span key={k} className={`w-3 rounded-sm ${k <= i ? 'bg-teal' : 'bg-silver-soft'}`} style={{ height: 10 + k * 7 }} />
                ))}
              </div>
              <p className="mt-3 font-wide text-[17px]">{w.range}</p>
              <h3 className="text-[15px] font-extrabold text-teal">{w.name}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{w.feel}</p>
              <p className="mt-3 rounded-xl bg-court px-3 py-2 text-[13px] font-semibold">추천: {w.who}</p>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-[14px] text-muted">
          가벼운 라켓이 무조건 좋은 건 아니에요. 가벼울수록 스윙이 정확해야 힘이 실려서, 처음엔 125g 안팎으로 시작하고 실력이 붙으면 가벼운 쪽으로 옮기는 사람이 많아요.
        </p>
      </Section>

      <Section kicker="02 · BALANCE" title="밸런스: 무게가 어디에 있나">
        <BalanceBar />
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {BALANCE.map((b) => (
            <Card key={b.name}>
              <span className="rounded-full bg-teal-soft px-2.5 py-1 text-[12px] font-bold text-teal-deep">{b.tip}</span>
              <h3 className="mt-3 text-[18px] font-extrabold">{b.name}</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{b.body}</p>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-[14px] text-muted">
          무게와 밸런스는 함께 봐야 해요. 아주 가벼운 라켓은 헤드 헤비로 만들어 힘을 보태는 경우가 많아서, 같은 115g이라도 휘둘러 보면 느낌이 꽤 달라요.
        </p>
      </Section>

      <Section kicker="03 · HEAD SHAPE" title="헤드 모양">
        <div className="grid gap-3 md:grid-cols-2">
          {SHAPE.map((s, i) => (
            <Card key={s.name} className="flex gap-5">
              <HeadShape open={i === 0} />
              <div>
                <h3 className="text-[18px] font-extrabold">{s.name}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{s.body}</p>
                <p className="mt-3 text-[13px] font-semibold text-teal-deep">추천: {s.who}</p>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section kicker="04 · BRANDS" title="브랜드별 성향">
        <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
          브랜드마다 잘 만드는 쪽이 조금씩 달라요. 다만 같은 브랜드도 라인마다 성격이 다르니 브랜드보다 <b className="text-ink">모델의 무게·밸런스·모양</b>을 먼저 보세요.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BRANDS.map((b) => (
            <Card key={b.name} className={b.name === 'Harrow' ? 'border-teal ring-2 ring-teal/15' : ''}>
              <p className="font-wide text-[15px]">{b.name}</p>
              <p className="text-[12.5px] text-muted">{b.origin}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink/80">{b.style}</p>
            </Card>
          ))}
        </div>
        <ProRackets />
      </Section>

      <Section kicker="05 · BALL" title="공의 점 색깔">
        <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
          스쿼시공은 점 색깔로 탄성을 구분해요. 덜 튀는 공일수록 랠리가 짧아지고 어려워져요. 동호인이 처음부터 더블 옐로를 쓰면 공이 금방 죽어서 랠리가 잘 안 돼요.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {BALLS.map((b) => (
            <Card key={b.name} className="text-center">
              <svg viewBox="0 0 60 60" className="mx-auto size-16" aria-hidden="true">
                <circle cx="30" cy="30" r="26" fill="#141618" />
                {b.dots.map((c, i) => (
                  <circle key={i} cx={b.dots.length === 2 ? 22 + i * 16 : 30} cy="22" r="4.5" fill={c} />
                ))}
              </svg>
              <h3 className="mt-2 font-extrabold">{b.name}</h3>
              <p className="text-[13px] text-teal-deep">{b.bounce}</p>
              <p className="mt-1 text-[13px] text-muted">{b.who}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section kicker="06 · MORE" title="그 밖의 장비">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <h3 className="font-extrabold">스트링</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
              얇은 줄(1.10~1.18mm)은 반발력과 감각이, 굵은 줄(1.20mm 이상)은 내구성이 좋아요. 장력은 보통 25~28파운드, 낮을수록 공이 잘 나가고 높을수록 정확해요.
            </p>
          </Card>
          <Card>
            <h3 className="font-extrabold">그립</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
              땀이 많으면 타월 그립, 얇게 쥐고 싶으면 오버그립 한 겹. 미끄러지기 시작하면 바로 바꿔요. 손이 작으면 기본 그립을 벗기고 오버그립만 감기도 해요.
            </p>
            <a href="#/kit?g=grip" className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-bold text-teal hover:text-teal-deep">
              그립 고민 상담 <Arrow className="size-3.5" />
            </a>
          </Card>
          <Card>
            <h3 className="font-extrabold">신발</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
              바닥에 자국이 안 남는 논마킹 실내화가 필수예요. 옆으로 자주 멈추니 러닝화보다 접지력과 발목 지지가 좋은 코트화가 안전해요.
            </p>
            <a href="#/kit?g=shoes" className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-bold text-teal hover:text-teal-deep">
              신발 고민 상담 <Arrow className="size-3.5" />
            </a>
          </Card>
          <Card>
            <h3 className="font-extrabold">보호안경</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
              공이 눈에 딱 맞는 크기라 맞으면 크게 다칠 수 있어요. 주니어 대회와 복식에서는 의무예요. 동호인도 쓰기를 권해요.
            </p>
            <a href="#/kit?c=eye-guard" className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-bold text-teal hover:text-teal-deep">
              보호안경 고민 상담 <Arrow className="size-3.5" />
            </a>
          </Card>
        </div>
        <a id="finder-cta" href={href('finder')} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-teal px-5 py-3.5 text-[15px] font-bold text-white hover:bg-teal-deep">
          내 스타일에 맞는 라켓 찾기 <Arrow className="size-4" />
        </a>
      </Section>
      <FinderFab />
    </>
  )
}

/** 화면을 내리는 동안 늘 떠 있는 라켓 찾기 버튼. 맨 아래 같은 버튼이 보이면 숨는다 */
function FinderFab() {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const el = document.getElementById('finder-cta')
    if (!el) return
    const io = new IntersectionObserver(([e]) => setHidden(e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <a
      href={href('finder')}
      aria-hidden={hidden}
      tabIndex={hidden ? -1 : 0}
      className={`fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom)+14px)] z-30 inline-flex items-center gap-2 rounded-full bg-teal py-3.5 pr-4 pl-5 text-[15px] font-bold text-white shadow-[0_14px_30px_-12px_rgb(0_77_87/0.75)] transition duration-300 hover:bg-teal-deep lg:right-8 lg:bottom-8 ${hidden ? 'pointer-events-none translate-y-4 opacity-0' : 'opacity-100'}`}
    >
      나에게 맞는 라켓 찾기 <Arrow className="size-4" />
    </a>
  )
}

function BalanceBar() {
  return (
    <svg viewBox="0 0 640 120" className="w-full max-w-3xl" role="img" aria-label="라켓 밸런스: 손잡이 쪽, 가운데, 헤드 쪽">
      <ellipse cx="520" cy="60" rx="100" ry="46" fill="none" stroke="#c9cdcc" strokeWidth="10" />
      <rect x="90" y="54" width="330" height="12" rx="4" fill="#c9cdcc" />
      <rect x="20" y="50" width="80" height="20" rx="6" fill="#fff" stroke="#cfd4d3" />
      <rect x="96" y="49" width="14" height="22" rx="3" fill="#141618" />
      {[
        { x: 230, label: '헤드 라이트' },
        { x: 345, label: '이븐' },
        { x: 450, label: '헤드 헤비' },
      ].map((p) => (
        <g key={p.label}>
          <path d={`M${p.x - 9} 100 L${p.x + 9} 100 L${p.x} 84 Z`} fill="#00707d" />
          <text x={p.x} y="117" textAnchor="middle" fontSize="13" fontWeight="700" fill="#141618">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

function HeadShape({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 60 120" className="h-28 w-14 shrink-0" aria-hidden="true">
      {open ? (
        <path d="M30 6c14 0 24 14 24 34 0 22-12 36-22 46v30h-4V86C18 76 6 62 6 40 6 20 16 6 30 6Z" fill="none" stroke="#00707d" strokeWidth="4" />
      ) : (
        <>
          <ellipse cx="30" cy="40" rx="24" ry="34" fill="none" stroke="#00707d" strokeWidth="4" />
          <path d="M22 72h16M30 74v42" stroke="#00707d" strokeWidth="4" />
          <path d="M22 72 30 90 38 72" fill="none" stroke="#00707d" strokeWidth="3" />
        </>
      )}
    </svg>
  )
}

/** 지금 세계 랭킹 상위 선수들이 쓰는 라켓 브랜드(현황판 데이터에서) */
function ProRackets() {
  const [data, setData] = useState<Rankings | null>(null)
  useEffect(() => {
    loadData<Rankings>('rankings.json')
      .then(setData)
      .catch(() => setData(null))
  }, [])
  if (!data) return null
  const players = [...data.male.top, ...data.female.top].filter((p) => p.racket)
  const counts = new Map<string, string[]>()
  for (const p of players) {
    const b = p.racket!.split(/[ ,/]/)[0]
    counts.set(b, [...(counts.get(b) ?? []), p.name])
  }
  const rows = [...counts].sort((a, b) => b[1].length - a[1].length).slice(0, 8)
  const max = rows[0]?.[1].length ?? 1
  return (
    <Card className="mt-5">
      <h3 className="text-[17px] font-extrabold">세계 랭킹 Top 20 선수들은 뭘 쓸까</h3>
      <p className="mt-1 text-[13px] text-muted">남녀 상위 20명의 라켓 후원 브랜드(PSA 선수 정보 기준, 알려진 선수만)</p>
      <ul className="mt-4 space-y-2.5">
        {rows.map(([brand, names]) => (
          <li key={brand} className="grid grid-cols-[88px_1fr] items-center gap-3 text-[14px] md:grid-cols-[110px_1fr]">
            <span className="truncate font-bold">{brand}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-3 rounded-full bg-teal" style={{ width: `${(names.length / max) * 100}%` }} />
                <span className="font-wide text-[12px]">{names.length}</span>
              </div>
              <p className="mt-0.5 truncate text-[12px] text-muted">{names.slice(0, 4).join(', ')}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
