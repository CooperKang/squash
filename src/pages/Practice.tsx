import { useEffect, useState } from 'react'
import { Card, LevelBadge, PageHead, Section } from '../components/ui'
import { CourtPath, PathLegend } from '../components/CourtPath'
import { DRILLS, ROUTINES, TIPS, type Drill } from '../data/drills'
import { LEVELS, SHOTS, type Level } from '../data/shots'
import { hashParam, href, setHashParam } from '../router'

const RECORD_KEY = 'squash.drillRecords'

// 내 기록은 이 브라우저에만 남는다(다른 기기와 공유되지 않음)
function loadRecords(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(RECORD_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

export default function Practice() {
  const focus = hashParam('d')
  const [level, setLevel] = useState<Level>(() => DRILLS.find((d) => d.id === focus)?.level ?? '입문')
  const [records, setRecords] = useState(loadRecords)

  useEffect(() => {
    if (!focus) return
    document.getElementById(`drill-${focus}`)?.scrollIntoView({ block: 'start' })
  }, [focus])

  const save = (id: string, n: number | null) => {
    const next = { ...records }
    if (n == null) delete next[id]
    else next[id] = n
    setRecords(next)
    try {
      localStorage.setItem(RECORD_KEY, JSON.stringify(next))
    } catch {
      // 저장이 막힌 브라우저에서는 이 화면에서만 기억한다
    }
  }

  const choose = (l: Level) => {
    setLevel(l)
    setHashParam('practice', 'level', l)
  }

  const drills = DRILLS.filter((d) => d.level === level)
  const total = ROUTINES[level].reduce((s, [, m]) => s + m, 0)

  return (
    <>
      <PageHead eyebrow="SOLO PRACTICE" title="공 하나로 혼자 연습">
        상대 없이 빈 코트와 공 하나만 있으면 되는 연습이에요. 수준을 고르면 팁, 30분 루틴, 연습 방법이 바뀌어요. 오른손잡이 포핸드 기준이고, 백핸드는 좌우를 바꿔서 같은 방법으로 해요.
      </PageHead>

      <div className="sticky top-14 z-20 border-b border-line/60 bg-court/90 backdrop-blur md:top-16">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <span className="text-[14px] font-semibold text-muted">내 수준</span>
          <div className="flex gap-1 rounded-2xl bg-card p-1" role="group" aria-label="내 수준">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={level === l}
                onClick={() => choose(l)}
                className="rounded-xl px-4 py-1.5 text-[15px] font-semibold text-muted aria-pressed:bg-ink aria-pressed:text-white"
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Section kicker="TIPS" title={`${level}자에게 먼저 필요한 것`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TIPS[level].map((t) => (
            <Card key={t.title}>
              <h3 className="text-[17px] font-extrabold">{t.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{t.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section kicker="ROUTINE" title={`${total}분 루틴`}>
        <Card>
          <ol className="flex flex-col gap-2 md:flex-row md:gap-0">
            {ROUTINES[level].map(([id, min], i) => {
              const d = DRILLS.find((x) => x.id === id)
              return (
                <li key={id} className="flex flex-1 items-center gap-3 md:flex-col md:items-start md:gap-1 md:border-l md:border-line md:px-4 md:first:border-l-0 md:first:pl-0">
                  <span className="font-wide text-[13px] text-teal">{min}분</span>
                  {d ? (
                    <a href={`#drill-${d.id}`} className="text-[15px] font-semibold underline-offset-4 hover:underline" onClick={(e) => {
                      e.preventDefault()
                      document.getElementById(`drill-${d.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}>
                      {i + 1}. {d.name}
                    </a>
                  ) : (
                    <span className="text-[15px] font-semibold">{i + 1}. 공 데우기, 가볍게 몸 풀기</span>
                  )}
                </li>
              )
            })}
          </ol>
        </Card>
      </Section>

      <Section kicker="DRILLS" title="연습 방법">
        <div className="space-y-4">
          {drills.map((d) => (
            <DrillCard key={d.id} drill={d} record={records[d.id]} onSave={(n) => save(d.id, n)} />
          ))}
        </div>
        <p className="mt-6 text-[15px] text-muted">
          샷을 치는 법은{' '}
          <a href={href('shots')} className="font-semibold text-teal underline underline-offset-4">
            기술
          </a>
          에서 그림과 함께 볼 수 있어요.
        </p>
      </Section>
    </>
  )
}

function DrillCard({ drill: d, record, onSave }: { drill: Drill; record?: number; onSave: (n: number | null) => void }) {
  const related = SHOTS.filter((s) => s.drill === d.id)
  return (
    <article id={`drill-${d.id}`} className="scroll-mt-32 rounded-[24px] border border-line/80 bg-card p-4 md:p-6">
      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
        <div>
          <CourtPath points={d.path} targets={d.targets} label={`${d.name} 연습에서 공이 오가는 길`} className="mx-auto max-w-[220px]" />
          <div className="mt-2">
            <PathLegend points={d.path} />
          </div>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[21px] font-extrabold">{d.name}</h3>
            <LevelBadge level={d.level} />
          </div>
          <p className="mt-1 text-[14.5px] font-semibold text-teal-deep">{d.focus}</p>
          <p className="mt-3 text-[15px] leading-relaxed">
            <b>자리</b> {d.setup}
          </p>
          <ol className="mt-3 space-y-2">
            {d.steps.map((s, i) => (
              <li key={s} className="flex gap-2.5 text-[15px] leading-relaxed">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-bold text-white">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 rounded-2xl bg-teal-soft/60 p-4">
            <div>
              <p className="text-[13px] font-semibold text-teal-deep">목표</p>
              <p className="text-[15px] font-bold">{d.goal}</p>
            </div>
            <label className="flex items-center gap-2 text-[14px] text-ink/80">
              {d.measure === 'ratio' ? '내 기록 10개 중' : '내 최고 연속'}
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={record ?? ''}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
                  const n = v === '' ? null : Math.min(d.measure === 'ratio' ? 10 : 9999, Number(v))
                  onSave(n)
                }}
                className="w-16 rounded-xl border border-line bg-white px-2.5 py-1.5 text-right text-[15px] font-bold"
                aria-label={`${d.name} 내 기록`}
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
                  <a href={`${href('shots')}?s=${s.id}`} className="font-semibold text-teal underline underline-offset-4">
                    {s.name}
                  </a>
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
