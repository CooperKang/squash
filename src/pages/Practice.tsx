import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, LevelBadge, PageHead, Section } from '../components/ui'
import { Court3D, ViewControls } from '../components/Court3D'
import { VIEWS, type View } from '../components/shotView'
import { DRILLS, ROUTINES, TIPS, type Drill } from '../data/drills'
import { LEVELS, SHOTS, type Level } from '../data/shots'
import { COOLDOWN, COOLDOWN_VIDEOS, FOAM_ROLLER, ROLLER_TIPS, WARMUP, WARMUP_VIDEOS, type Stretch, type Video } from '../data/stretches'
import { MOVES } from '../data/stretchMoves'
import { StretchFigure } from '../components/StretchFigure'
import { buildSequence } from '../game/sequence'
import { Arrow } from '../components/Icon'
import { hashParam, href, setHashParams } from '../router'

const RECORD_KEY = 'squash.drillRecords'

/** 백핸드로 볼 때 설명의 좌우와 포핸드·백핸드를 바꾼다 */
const PAIRS: Record<string, string> = { 오른쪽: '왼쪽', 왼쪽: '오른쪽', 포핸드: '백핸드', 백핸드: '포핸드' }
const mirrorText = (s: string, on: boolean) => (on ? s.replace(/오른쪽|왼쪽|포핸드|백핸드/g, (m) => PAIRS[m]) : s)

type Tab = 'warmup' | 'drills' | 'cooldown' | 'plan'
const TABS: { id: Tab; label: string }[] = [
  { id: 'warmup', label: '운동 전 스트레칭' },
  { id: 'drills', label: '연습 방법' },
  { id: 'cooldown', label: '운동 후 스트레칭' },
  { id: 'plan', label: '수준별 팁·루틴' },
]

// 내 기록은 이 브라우저에만 남는다(다른 기기와 공유되지 않음)
function loadRecords(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(RECORD_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

export default function Practice() {
  const [tab, setTab] = useState<Tab>(() => {
    const t = hashParam('tab') as Tab | null
    return t && TABS.some((x) => x.id === t) ? t : 'drills'
  })
  const choose = (t: Tab) => {
    setTab(t)
    setHashParams('practice', { tab: t })
  }

  return (
    <>
      <PageHead eyebrow="SOLO PRACTICE" title="혼자 연습">
        빈 코트와 공 하나로 하는 연습, 그리고 연습 앞뒤의 스트레칭을 모았어요. 위의 탭에서 보고 싶은 것을 골라 주세요.
      </PageHead>

      <div className="sticky top-14 z-20 border-b border-line/60 bg-court/90 backdrop-blur md:top-16">
        <div className="mx-auto max-w-6xl px-4 py-2.5">
          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap" role="tablist" aria-label="혼자 연습">
            {TABS.map((t) => (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                onClick={() => choose(t.id)}
                className="rounded-xl border border-line bg-card px-3.5 py-2 text-[14.5px] font-bold text-muted transition aria-selected:border-ink aria-selected:bg-ink aria-selected:text-white"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'drills' && <Drills />}
        {tab === 'warmup' && <Warmup />}
        {tab === 'cooldown' && <Cooldown />}
        {tab === 'plan' && (
          <Plan
            onDrill={(id) => {
              setHashParams('practice', { tab: 'drills', d: id })
              setTab('drills')
            }}
          />
        )}
      </div>
    </>
  )
}

// ---------- 연습 방법 ----------

function Drills() {
  const [level, setLevel] = useState<Level | null>(null)
  const [id, setId] = useState(() => {
    const d = hashParam('d')
    return DRILLS.some((x) => x.id === d) ? d! : DRILLS[0].id
  })
  const [records, setRecords] = useState(loadRecords)
  const panel = useRef<HTMLDivElement>(null)
  const list = DRILLS.filter((d) => !level || d.level === level)
  const drill = DRILLS.find((d) => d.id === id)!

  const pick = (next: string) => {
    setId(next)
    setHashParams('practice', { tab: 'drills', d: next })
    // 좁은 화면에서는 목록 아래의 내용으로 내려 준다
    if (matchMedia('(max-width: 1023px)').matches) panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const save = (key: string, n: number | null) => {
    const next = { ...records }
    if (n == null) delete next[key]
    else next[key] = n
    setRecords(next)
    try {
      localStorage.setItem(RECORD_KEY, JSON.stringify(next))
    } catch {
      // 저장이 막힌 브라우저에서는 이 화면에서만 기억한다
    }
  }

  return (
    <Section kicker="DRILLS" title="연습 방법">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="수준">
        {[null, ...LEVELS].map((l) => (
          <button
            key={l ?? 'all'}
            type="button"
            aria-pressed={level === l}
            onClick={() => setLevel(l)}
            className="rounded-full border border-line bg-card px-3.5 py-1.5 text-[14px] font-semibold transition aria-pressed:border-teal aria-pressed:bg-teal-soft aria-pressed:text-teal-deep"
          >
            {l ?? '전체'} <span className="font-normal opacity-60">{DRILLS.filter((d) => !l || d.level === l).length}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-2 self-start sm:grid-cols-3 lg:grid-cols-1" role="tablist" aria-label="연습 목록">
          {list.map((d) => (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={d.id === id}
              onClick={() => pick(d.id)}
              className="flex flex-col items-start gap-1 rounded-[18px] border border-line/80 bg-card p-3 text-left transition hover:border-teal/50 aria-selected:border-ink aria-selected:bg-ink aria-selected:text-white lg:p-3.5"
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-[15px] leading-snug font-extrabold">{d.name}</span>
                <LevelBadge level={d.level} />
              </span>
              <span className="text-[12.5px] leading-snug opacity-70">{d.focus}</span>
            </button>
          ))}
        </div>

        <div ref={panel} className="min-w-0 scroll-mt-32">
          <DrillPanel key={drill.id} drill={drill} records={records} onSave={save} />
        </div>
      </div>
    </Section>
  )
}

function DrillPanel({ drill: d, records, onSave }: { drill: Drill; records: Record<string, number>; onSave: (key: string, n: number | null) => void }) {
  const [backhand, setBackhand] = useState(false)
  const [view, setView] = useState<View>(d.id === 'figure8' || d.id === 'volley' ? VIEWS.back : VIEWS.diag)
  const segments = useMemo(() => buildSequence(d.id, d.start, d.sequence, backhand), [d, backhand])
  const targets = useMemo(() => (d.targets ?? []).map((t) => (backhand ? { ...t, x0: -t.x1, x1: -t.x0 } : t)), [d, backhand])
  const related = SHOTS.filter((s) => s.drill === d.id)
  const key = `${d.id}${backhand ? ':back' : ''}`
  const record = records[key]

  return (
    <Card className="p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[23px] font-extrabold">{d.name}</h3>
        <LevelBadge level={d.level} />
      </div>
      <p className="mt-1 text-[14.5px] font-semibold text-teal-deep">{d.focus}</p>

      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_1fr]">
        <div className="min-w-0">
          <ViewControls view={view} views={Object.values(VIEWS)} onView={setView} backhand={backhand} onHand={setBackhand} />
          {segments.length ? (
            <Court3D segments={segments} targets={targets} view={view} onViewChange={setView} label={`${d.name}(${backhand ? '백핸드' : '포핸드'}) 연습에서 공이 오가는 길`} />
          ) : (
            <p className="text-[15px] text-muted">이 연습의 그림을 만들지 못했어요.</p>
          )}
          <ol className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[13.5px] text-muted">
            {segments.map((s, i) => (
              <li key={i}>
                <b className="text-ink">{i + 1}</b> {s.label}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <p className="text-[15px] leading-relaxed">
            <b>자리</b> {mirrorText(d.setup, backhand)}
          </p>
          <ol className="mt-3 space-y-2">
            {d.steps.map((s, i) => (
              <li key={s} className="flex gap-2.5 text-[15px] leading-relaxed">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-bold text-white">{i + 1}</span>
                {mirrorText(s, backhand)}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 rounded-2xl bg-teal-soft/60 p-4">
            <div>
              <p className="text-[13px] font-semibold text-teal-deep">목표</p>
              <p className="text-[15px] font-bold">{d.goal}</p>
            </div>
            <label className="flex items-center gap-2 text-[14px] text-ink/80">
              {backhand ? '백핸드 ' : '포핸드 '}
              {d.measure === 'ratio' ? '기록 10개 중' : '최고 연속'}
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={record ?? ''}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
                  onSave(key, v === '' ? null : Math.min(d.measure === 'ratio' ? 10 : 9999, Number(v)))
                }}
                className="w-16 rounded-xl border border-line bg-white px-2.5 py-1.5 text-right text-[15px] font-bold"
                aria-label={`${d.name} ${backhand ? '백핸드' : '포핸드'} 내 기록`}
              />
              개
            </label>
          </div>
          {related.length > 0 && (
            <p className="mt-3 text-[14px] text-muted">
              관련 샷:{' '}
              {related.map((s, i) => (
                <span key={s.id}>
                  {i > 0 && ', '}
                  <a href={`${href('shots')}?s=${s.id}${backhand ? '&hand=back' : ''}`} className="font-semibold text-teal underline underline-offset-4">
                    {s.name}
                  </a>
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

// ---------- 스트레칭 ----------

function Warmup() {
  return (
    <>
      <Section kicker="BEFORE" title="운동 전 동적 스트레칭">
        <p className="max-w-3xl text-[15.5px] leading-relaxed text-muted">
          스쿼시는 런지와 급정지, 방향 전환이 많아요. 운동 전에는 오래 버티는 스트레칭보다 몸을 움직이며 데우는 동적 스트레칭으로 고관절, 종아리, 허벅지, 발목, 코어를 깨워요. 전체
          10~12분이에요.
        </p>
        <FollowAlong items={WARMUP} title="운동 전 스트레칭 따라 하기" />
        <StretchList items={WARMUP} />
      </Section>
      <Videos title="영상으로 따라 하기" videos={WARMUP_VIDEOS} />
    </>
  )
}

function Cooldown() {
  return (
    <>
      <Section kicker="AFTER" title="운동 후 정적 스트레칭">
        <p className="max-w-3xl text-[15.5px] leading-relaxed text-muted">
          운동이 끝나면 숨을 고른 뒤, 많이 쓴 근육을 20~30초씩 천천히 늘여요. 반동 없이, 아프지 않고 시원한 정도까지만 해요.
        </p>
        <FollowAlong items={COOLDOWN} title="운동 후 스트레칭 따라 하기" />
        <StretchList items={COOLDOWN} />
      </Section>
      <Section kicker="FOAM ROLLER" title="폼롤러로 풀기">
        <ul className="mb-4 flex flex-wrap gap-2 text-[14px]">
          {ROLLER_TIPS.map((t) => (
            <li key={t} className="rounded-full bg-card px-3.5 py-1.5 text-ink/80">
              {t}
            </li>
          ))}
        </ul>
        <FollowAlong items={FOAM_ROLLER} title="폼롤러 따라 하기" />
        <StretchList items={FOAM_ROLLER} />
        <a href="#/kit?c=sore-calf" className="mt-4 inline-flex items-center gap-1.5 text-[14.5px] font-bold text-teal hover:text-teal-deep">
          종아리가 자주 뭉친다면: 폼롤러 고르는 법 <Arrow className="size-3.5" />
        </a>
      </Section>
      <Videos title="영상으로 따라 하기" videos={COOLDOWN_VIDEOS} />
    </>
  )
}

function StretchList({ items }: { items: Stretch[] }) {
  return (
    <>
      <p className="mt-5 flex items-center gap-2 text-[13px] text-muted">
        <span className="inline-block h-1.5 w-5 rounded-full bg-teal-bright" aria-hidden />
        청록색이 늘어나거나 힘이 들어가는 곳이에요. 그림이 지금 보여 주는 설명은 진하게 표시돼요.
      </p>
      <ol className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map((s, i) => (
          <StretchCard key={s.name} s={s} n={i + 1} />
        ))}
      </ol>
    </>
  )
}

function StretchCard({ s, n }: { s: Stretch; n: number }) {
  const [step, setStep] = useState(0)
  const move = MOVES[s.name]
  return (
    <li className="flex flex-col overflow-hidden rounded-[20px] border border-line/80 bg-card">
      {move && <StretchFigure move={move} label={s.name} onStep={setStep} className="aspect-[4/3] w-full border-b border-line/60 bg-[#f6f8f7]" />}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[16.5px] font-extrabold">
            <span className="mr-1.5 text-teal">{n}</span>
            {s.name}
          </h3>
          <span className="shrink-0 text-[13px] font-semibold text-muted">{s.dose}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {s.parts.map((p) => (
            <span key={p} className="rounded-full bg-teal-soft px-2 py-0.5 text-[12px] font-semibold text-teal-deep">
              {p}
            </span>
          ))}
        </div>
        <ol className="mt-2.5 space-y-1.5 text-[14.5px] leading-relaxed">
          {s.how.map((h, k) => {
            const on = move && s.how.length > 1 && Math.min(step, s.how.length - 1) === k
            return (
              <li key={h} className={`flex gap-2 transition-colors ${!move || s.how.length < 2 || on ? 'text-ink' : 'text-ink/45'}`}>
                {s.how.length > 1 && (
                  <span
                    className={`mt-[3px] grid size-[18px] shrink-0 place-items-center rounded-full text-[11px] font-bold ${on ? 'bg-teal text-white' : 'bg-silver-soft text-muted'}`}
                  >
                    {k + 1}
                  </span>
                )}
                <span>{h}</span>
              </li>
            )
          })}
        </ol>
        {s.caution && <p className="mt-2.5 rounded-xl bg-[#fbecea] px-3 py-2 text-[13px] text-tin">{s.caution}</p>}
      </div>
    </li>
  )
}

/** 동작을 차례로 보여 주며 시간을 재는 따라 하기 */
function FollowAlong({ items, title }: { items: Stretch[]; title: string }) {
  const [st, setSt] = useState({ i: 0, left: items[0].seconds, running: false, done: false })
  const { i, left, running, done } = st

  // 1초마다 줄이고, 다 되면 다음 동작으로 넘어간다
  useEffect(() => {
    if (!running) return
    const t = setInterval(
      () =>
        setSt((p) => {
          if (p.left > 1) return { ...p, left: p.left - 1 }
          if (p.i + 1 < items.length) return { ...p, i: p.i + 1, left: items[p.i + 1].seconds }
          return { ...p, left: 0, running: false, done: true }
        }),
      1000,
    )
    return () => clearInterval(t)
  }, [running, items])

  const go = (n: number) => {
    const k = Math.max(0, Math.min(items.length - 1, n))
    setSt((p) => ({ ...p, i: k, left: items[k].seconds, done: false }))
  }
  const toggle = () => setSt((p) => (p.done ? { i: 0, left: items[0].seconds, running: true, done: false } : { ...p, running: !p.running }))
  const s = items[i]
  const total = items.reduce((a, b) => a + b.seconds, 0)

  return (
    <div className="mt-5 rounded-[24px] bg-ink p-5 text-white md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[16px] font-extrabold">{title}</h3>
        <span className="text-[13px] text-white/60">
          {items.length}가지 · 약 {Math.round(total / 60)}분
        </span>
      </div>
      {done ? (
        <p className="mt-4 text-[22px] font-extrabold" aria-live="polite">
          끝! 수고했어요.
        </p>
      ) : (
        <div className="mt-4 grid items-center gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          {MOVES[s.name] && <StretchFigure key={s.name} move={MOVES[s.name]} label={s.name} className="aspect-[4/3] w-full max-w-[15rem] overflow-hidden rounded-2xl bg-white" />}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3" aria-live="polite">
            <p className="font-wide text-[44px] leading-none text-teal-bright tabular-nums">
              {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
            </p>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-white/60">
                {i + 1}/{items.length} · {s.dose}
              </p>
              <p className="text-[20px] font-extrabold">{s.name}</p>
              <p className="mt-0.5 text-[14px] text-white/75">{s.how[0]}</p>
            </div>
          </div>
        </div>
      )}
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-teal-bright transition-[width]" style={{ width: `${done ? 100 : ((i + 1 - left / s.seconds) / items.length) * 100}%` }} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => go(i - 1)} className="rounded-xl bg-white/10 px-4 py-2.5 text-[14px] font-bold hover:bg-white/20">
          이전
        </button>
        <button type="button" onClick={toggle} className="rounded-xl bg-teal px-5 py-2.5 text-[14px] font-bold hover:bg-teal-bright">
          {done ? '처음부터' : running ? '잠깐 멈춤' : '시작'}
        </button>
        <button type="button" onClick={() => go(i + 1)} className="rounded-xl bg-white/10 px-4 py-2.5 text-[14px] font-bold hover:bg-white/20">
          다음
        </button>
      </div>
    </div>
  )
}

function Videos({ title, videos }: { title: string; videos: Video[] }) {
  return (
    <Section kicker="VIDEOS" title={title}>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v) => (
          <li key={v.id}>
            <a
              href={`https://www.youtube.com/watch?v=${v.id}`}
              target="_blank"
              rel="noreferrer"
              className="group block overflow-hidden rounded-[20px] border border-line/80 bg-card"
            >
              <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" loading="lazy" className="aspect-video w-full object-cover" />
              <div className="p-3.5">
                <p className="text-[14.5px] leading-snug font-bold group-hover:text-teal">{v.title}</p>
                <p className="mt-1 text-[13px] text-muted">{v.channel} · 유튜브</p>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </Section>
  )
}

// ---------- 수준별 팁·루틴 ----------

function Plan({ onDrill }: { onDrill: (id: string) => void }) {
  const [level, setLevel] = useState<Level>('입문')
  const total = ROUTINES[level].reduce((s, [, m]) => s + m, 0)
  return (
    <>
      <Section kicker="TIPS" title="수준별 팁">
        <div className="mb-4 flex gap-1 rounded-2xl bg-card p-1 sm:inline-flex" role="group" aria-label="내 수준">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={level === l}
              onClick={() => setLevel(l)}
              className="flex-1 rounded-xl px-4 py-1.5 text-[15px] font-semibold text-muted aria-pressed:bg-ink aria-pressed:text-white"
            >
              {l}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TIPS[level].map((t) => (
            <Card key={t.title}>
              <h3 className="text-[17px] font-extrabold">{t.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{t.body}</p>
            </Card>
          ))}
        </div>
      </Section>
      <Section kicker="ROUTINE" title={`${level} ${total}분 루틴`}>
        <Card>
          <ol className="flex flex-col gap-2 md:flex-row md:gap-0">
            {ROUTINES[level].map(([id, min], i) => {
              const d = DRILLS.find((x) => x.id === id)
              return (
                <li key={id} className="flex flex-1 items-center gap-3 md:flex-col md:items-start md:gap-1 md:border-l md:border-line md:px-4 md:first:border-l-0 md:first:pl-0">
                  <span className="font-wide text-[13px] text-teal">{min}분</span>
                  {d ? (
                    <button type="button" onClick={() => onDrill(d.id)} className="text-left text-[15px] font-semibold underline-offset-4 hover:underline">
                      {i + 1}. {d.name}
                    </button>
                  ) : (
                    <span className="text-[15px] font-semibold">{i + 1}. 공 데우기, 동적 스트레칭</span>
                  )}
                </li>
              )
            })}
          </ol>
        </Card>
      </Section>
    </>
  )
}
