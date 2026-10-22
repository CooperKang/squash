import { useEffect, useState } from 'react'
import { hashParam, href } from '../router'
import { Arrow, External } from '../components/Icon'
import { Card, PageHead, Section } from '../components/ui'
import { KIT_GROUPS, KIT_TIPS, type KitGroupId, type KitTip } from '../data/kit'
import { DISCLOSURE, picksFor } from '../data/partners'
import { kitView } from './kitView'

/** 화면을 다시 그리지 않고 주소만 바꾼다. g와 c는 함께 바뀌어야 해서 setHashParams 대신 통째로 쓴다 */
function setKitHash(values: Record<string, string>) {
  history.replaceState(null, '', `${href('kit')}?${new URLSearchParams(values)}`)
}

export default function Kit() {
  const [view, setView] = useState(() => kitView(hashParam('g'), hashParam('c')))

  useEffect(() => {
    if (view.focus) document.getElementById(view.focus)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [view])

  const pickTip = (t: KitTip) => {
    setView({ group: t.group, focus: t.id })
    setKitHash({ g: t.group, c: t.id })
  }
  const pickGroup = (g: KitGroupId | 'all') => {
    setView({ group: g, focus: null })
    setKitHash(g === 'all' ? {} : { g })
  }
  const groups = KIT_GROUPS.filter((g) => view.group === 'all' || g.id === view.group)

  return (
    <>
      <PageHead eyebrow="KIT ADVICE" title="소모품 상담">
        치다 보면 생기는 고민, 의외로 그립 한 겹이나 신발 하나로 풀리는 게 많아요. 내 고민을 골라 보세요. 레슨 때 선생님이 해 주는 이야기처럼 풀어 드릴게요.
      </PageHead>

      <div className="mx-auto max-w-6xl px-4">
        <p id="kit-disclosure" className="rounded-2xl border-2 border-teal bg-teal-soft px-4 py-3 text-[15.5px] leading-relaxed font-bold text-teal-deep">{DISCLOSURE}</p>
      </div>

      <Section kicker="I AM…" title="나는…">
        <div className="flex flex-wrap gap-2">
          {KIT_TIPS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => pickTip(t)}
              aria-pressed={view.focus === t.id}
              className="rounded-full border border-line bg-card px-3.5 py-2 text-[14.5px] font-bold transition hover:border-teal aria-pressed:border-teal aria-pressed:bg-teal aria-pressed:text-white"
            >
              {t.chip}
            </button>
          ))}
        </div>
      </Section>

      <div className="sticky top-14 z-20 border-b border-line/60 bg-court/90 backdrop-blur md:top-16">
        <div className="mx-auto max-w-6xl px-4 py-2.5">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="품목">
            {[{ id: 'all' as const, label: '전체' }, ...KIT_GROUPS].map((g) => (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={view.group === g.id}
                onClick={() => pickGroup(g.id)}
                className="rounded-xl border border-line bg-card px-3.5 py-2 text-[14.5px] font-bold text-muted transition aria-selected:border-ink aria-selected:bg-ink aria-selected:text-white"
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {groups.map((g, i) => (
        <Section key={g.id} id={`kit-${g.id}`} kicker={`${String(i + 1).padStart(2, '0')} · ${g.id.toUpperCase()}`} title={`${g.label} 고민`}>
          <div className="grid gap-4 lg:grid-cols-2">
            {KIT_TIPS.filter((t) => t.group === g.id).map((t) => (
              <TipCard key={t.id} tip={t} focused={view.focus === t.id} />
            ))}
          </div>
        </Section>
      ))}

      <Section title="더 둘러보기">
        <div className="flex flex-wrap gap-3">
          <a href={href('gear')} className="inline-flex items-center gap-2 rounded-2xl border border-line bg-card px-5 py-3.5 text-[15px] font-bold hover:border-teal">
            장비 고르는 법 <Arrow className="size-4" />
          </a>
          <a href={href('finder')} className="inline-flex items-center gap-2 rounded-2xl bg-teal px-5 py-3.5 text-[15px] font-bold text-white hover:bg-teal-deep">
            나에게 맞는 라켓 찾기 <Arrow className="size-4" />
          </a>
        </div>
      </Section>
    </>
  )
}

function TipCard({ tip, focused }: { tip: KitTip; focused: boolean }) {
  const picks = picksFor(tip.links)
  return (
    <article id={tip.id} className="scroll-mt-32">
      <Card className={`h-full ${focused ? 'border-teal ring-2 ring-teal/20' : ''}`}>
        <p className="flex gap-2.5 text-[16.5px] leading-snug font-extrabold">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink font-wide text-[12px] text-white" aria-hidden="true">Q</span>
          {tip.q}
        </p>
        <div className="mt-4 flex gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-teal font-wide text-[12px] text-white" aria-hidden="true">A</span>
          <p className="text-[15px] leading-relaxed">{tip.a}</p>
        </div>

        <h3 className="mt-5 text-[13px] font-extrabold text-teal-deep">이렇게 해 보세요</h3>
        <ul className="mt-1.5 space-y-1.5 text-[14px] leading-relaxed text-muted">
          {tip.tries.map((x) => (
            <li key={x} className="flex gap-2">
              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-teal" aria-hidden="true" />
              {x}
            </li>
          ))}
        </ul>

        <h3 className="mt-5 text-[13px] font-extrabold text-teal-deep">고를 때 볼 것</h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{tip.look}</p>

        {picks.length > 0 && (
          <div className="mt-4 rounded-2xl bg-court p-3">
            <p className="text-[12.5px] leading-snug font-semibold text-teal-deep">{DISCLOSURE}</p>
            <ul className="mt-2.5 space-y-2">
              {picks.map((p) => (
                <li key={p.url}>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="sponsored nofollow noopener"
                    className="group flex items-center justify-between gap-3 rounded-xl border border-line/80 bg-white px-3.5 py-2.5 transition hover:border-teal"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-bold">{p.name}</span>
                      {p.note && <span className="block text-[12.5px] text-muted">{p.note}</span>}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-bold text-teal">
                      쿠팡에서 보기 <External className="size-3.5" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </article>
  )
}
