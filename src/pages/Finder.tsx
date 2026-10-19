import { useMemo, useState } from 'react'
import { External } from '../components/Icon'
import { Card, PageHead, Section } from '../components/ui'
import { won } from '../format'
import { RACKETS, RACKETS_UPDATED } from '../data/rackets'
import { recommend, type Answers } from '../data/recommend'
import { LEVEL_LABEL, STYLE_LABEL, type Racket, type Style } from '../data/types'

type Q<K extends keyof Answers> = { key: K; title: string; options: { value: Answers[K]; label: string; hint: string }[] }

const QUESTIONS: [Q<'level'>, Q<'style'>, Q<'feel'>, Q<'budget'>] = [
  {
    key: 'level',
    title: '스쿼시를 얼마나 쳤나요?',
    options: [
      { value: 'beg', label: '이제 막 시작', hint: '레슨 중이거나 1년 미만' },
      { value: 'mid', label: '랠리가 돼요', hint: '게임을 꾸준히 하는 동호인' },
      { value: 'adv', label: '대회에 나가요', hint: '기술을 골라 쓰는 수준' },
    ],
  },
  {
    key: 'style',
    title: '어떻게 이기고 싶나요?',
    options: [
      { value: 'power', label: '세게 몰아붙이기', hint: '뒤쪽 깊은 드라이브, 강한 공격' },
      { value: 'control', label: '정확하게 놓기', hint: '드롭, 보스트, 코너 공략' },
      { value: 'speed', label: '빠르게 끊기', hint: '발리와 빠른 템포' },
      { value: 'allround', label: '두루두루', hint: '아직 잘 모르겠어요' },
    ],
  },
  {
    key: 'feel',
    title: '라켓은 어떤 느낌이 좋아요?',
    options: [
      { value: 'light', label: '가볍고 빠르게', hint: '손목으로 휙휙' },
      { value: 'stable', label: '묵직하고 안정적', hint: '빗맞아도 덜 흔들리게' },
    ],
  },
  {
    key: 'budget',
    title: '예산은요?',
    options: [
      { value: 150000, label: '15만 원까지', hint: '가성비 좋은 입문·할인 모델' },
      { value: 230000, label: '23만 원까지', hint: '주력 라인 대부분' },
      { value: 0, label: '상관없어요', hint: '선수 시그니처까지' },
    ],
  },
]

export default function Finder() {
  const [answers, setAnswers] = useState<Partial<Answers>>({})
  const [step, setStep] = useState(0)
  const done = step >= QUESTIONS.length
  const result = useMemo(() => (done ? recommend(RACKETS, answers as Answers) : []), [done, answers])

  return (
    <>
      <PageHead eyebrow="RACKET FINDER" title="내 스타일에 맞는 라켓">
        네 가지 질문에 답하면 영산스포츠에서 파는 스쿼시 라켓 {RACKETS.length}개 중에서 어울리는 라켓을 골라 드려요. 마음에 들면 바로 구매 페이지로 갈 수 있어요.
      </PageHead>

      <section className="mx-auto max-w-6xl px-4">
        <Card className="p-5 md:p-8">
          <div className="flex gap-1.5" aria-hidden="true">
            {QUESTIONS.map((_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-teal' : i === step ? 'bg-ink' : 'bg-silver-soft'}`} />
            ))}
          </div>
          {!done ? (
            <Question
              key={step}
              q={QUESTIONS[step]}
              n={step + 1}
              selected={answers[QUESTIONS[step].key]}
              onPick={(v) => {
                setAnswers({ ...answers, [QUESTIONS[step].key]: v })
                setStep(step + 1)
              }}
              onBack={step > 0 ? () => setStep(step - 1) : undefined}
            />
          ) : (
            <div className="mt-6">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-wide text-[11px] tracking-[0.2em] text-teal">YOUR PICKS</p>
                <span className="text-[13px] text-muted">
                  {LEVEL_LABEL[answers.level!]} · {STYLE_LABEL[answers.style!]} · {answers.feel === 'light' ? '가벼운 라켓' : '안정적인 라켓'} ·{' '}
                  {answers.budget ? `${won(answers.budget)}까지` : '예산 무관'}
                </span>
                <button type="button" onClick={() => setStep(0)} className="ml-auto rounded-full border border-line px-3.5 py-1.5 text-[13px] font-semibold hover:border-ink">
                  다시 고르기
                </button>
              </div>
              <h2 className="mt-2 text-[24px] font-extrabold md:text-[28px]">이런 라켓이 잘 맞을 거예요</h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.map((s, i) => (
                  <RacketCard key={s.racket.id} r={s.racket} rank={i + 1} reasons={s.reasons} />
                ))}
              </ul>
              <p className="mt-4 text-[13px] text-muted">
                라켓 성향은 제조사 라인별 일반적인 특징을 바탕으로 한 참고 정보예요. 살 수 있다면 매장에서 직접 휘둘러 보는 게 가장 정확해요.
              </p>
            </div>
          )}
        </Card>
      </section>

      <Catalog />
    </>
  )
}

function Question<K extends keyof Answers>({
  q,
  n,
  selected,
  onPick,
  onBack,
}: {
  q: Q<K>
  n: number
  selected: Answers[K] | undefined
  onPick: (v: Answers[K]) => void
  onBack?: () => void
}) {
  return (
    <fieldset className="mt-6">
      <legend className="w-full">
        <span className="font-wide text-[11px] tracking-[0.2em] text-teal">Q{n}</span>
        <span className="mt-1 block text-[22px] font-extrabold md:text-[26px]">{q.title}</span>
      </legend>
      <div className={`mt-5 grid gap-2.5 ${q.options.length === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : q.options.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
        {q.options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onPick(o.value)}
            aria-pressed={selected === o.value}
            className="rounded-[20px] border-2 border-line/80 bg-white p-4 text-left transition hover:border-teal aria-pressed:border-teal aria-pressed:bg-teal-soft md:p-5"
          >
            <span className="block text-[17px] font-extrabold">{o.label}</span>
            <span className="mt-1 block text-[14px] text-muted">{o.hint}</span>
          </button>
        ))}
      </div>
      {onBack && (
        <button type="button" onClick={onBack} className="mt-4 text-[14px] font-semibold text-muted underline-offset-4 hover:underline">
          ← 이전 질문
        </button>
      )}
    </fieldset>
  )
}

function RacketCard({ r, rank, reasons }: { r: Racket; rank?: number; reasons?: string[] }) {
  const mine = r.id === '18762'
  return (
    <li className="h-full">
      <a
        href={r.url}
        target="_blank"
        rel="noreferrer"
        className={`group flex h-full flex-col overflow-hidden rounded-[22px] border bg-white transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-24px_rgb(0_0_0/0.45)] ${mine ? 'border-teal ring-2 ring-teal/20' : 'border-line/80'}`}
      >
        <div className="relative aspect-[16/9] bg-white sm:aspect-[4/3]">
          <img src={r.image} alt={`${r.brand} ${r.model}`} loading="lazy" className="size-full object-contain p-3" referrerPolicy="no-referrer" />
          {rank && <span className="absolute top-3 left-3 grid size-8 place-items-center rounded-full bg-ink font-wide text-[12px] text-white">{rank}</span>}
          {mine && <span className="absolute top-3 right-3 rounded-full bg-teal px-2.5 py-1 text-[11px] font-bold text-white">이 사이트의 색</span>}
        </div>
        <div className="flex flex-1 flex-col border-t border-line/60 p-4">
          <p className="font-wide text-[11px] tracking-[0.12em] text-muted">{r.brand.toUpperCase()}</p>
          <p className="mt-1 text-[16px] leading-snug font-extrabold">{r.model}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] font-semibold">
            <span className="rounded-full bg-teal-soft px-2 py-0.5 text-teal-deep">{STYLE_LABEL[r.style]}</span>
            {r.weightG && <span className="rounded-full bg-court px-2 py-0.5 text-muted">{r.weightG}g</span>}
            <span className="rounded-full bg-court px-2 py-0.5 text-muted">{LEVEL_LABEL[r.level]}</span>
          </div>
          {reasons && reasons.length > 0 && (
            <ul className="mt-3 space-y-1 text-[13px] text-ink/75">
              {reasons.slice(0, 3).map((t) => (
                <li key={t}>✓ {t}</li>
              ))}
            </ul>
          )}
          <div className="mt-auto flex items-end justify-between pt-4">
            <div>
              {r.listPriceKRW && r.listPriceKRW > r.priceKRW && <p className="text-[12px] text-muted line-through">{won(r.listPriceKRW)}</p>}
              <p className="text-[17px] font-extrabold">{won(r.priceKRW)}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-xl bg-ink px-3 py-2 text-[13px] font-bold text-white group-hover:bg-teal">
              구매하기 <External className="size-3.5" />
            </span>
          </div>
        </div>
      </a>
    </li>
  )
}

const SORTS = {
  popular: '추천순',
  low: '낮은 가격',
  high: '높은 가격',
  light: '가벼운 순',
}

function Catalog() {
  const brands = useMemo(() => [...new Set(RACKETS.map((r) => r.brand))].sort(), [])
  const [brand, setBrand] = useState<string>('all')
  const [style, setStyle] = useState<Style | 'all'>('all')
  const [sort, setSort] = useState<keyof typeof SORTS>('popular')
  const list = useMemo(() => {
    const l = RACKETS.filter((r) => (brand === 'all' || r.brand === brand) && (style === 'all' || r.style === style))
    if (sort === 'low') return [...l].sort((a, b) => a.priceKRW - b.priceKRW)
    if (sort === 'high') return [...l].sort((a, b) => b.priceKRW - a.priceKRW)
    if (sort === 'light') return [...l].sort((a, b) => (a.weightG ?? 999) - (b.weightG ?? 999))
    return l
  }, [brand, style, sort])

  return (
    <Section kicker="ALL RACKETS" title="영산스포츠 스쿼시 라켓 전체">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {['all', ...brands].map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={brand === b}
              onClick={() => setBrand(b)}
              className="shrink-0 rounded-full border border-line bg-white px-3.5 py-1.5 text-[13.5px] font-semibold text-muted aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white"
            >
              {b === 'all' ? '전체 브랜드' : b}
            </button>
          ))}
        </div>
        <div className="flex gap-2 md:ml-auto">
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as Style | 'all')}
            className="rounded-xl border border-line bg-white px-3 py-2 text-[14px] font-semibold"
            aria-label="성향"
          >
            <option value="all">모든 성향</option>
            {(Object.keys(STYLE_LABEL) as Style[]).map((s) => (
              <option key={s} value={s}>
                {STYLE_LABEL[s]}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)} className="rounded-xl border border-line bg-white px-3 py-2 text-[14px] font-semibold" aria-label="정렬">
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="mt-3 text-[13px] text-muted">
        {list.length}개 · 가격은 {RACKETS_UPDATED} 영산스포츠(ysretail.com) 기준이에요. 실제 가격과 재고는 구매 페이지에서 확인해 주세요.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 lg:grid-cols-4">
        {list.map((r) => (
          <RacketCard key={r.id} r={r} />
        ))}
      </ul>
    </Section>
  )
}
