import { useMemo, useState } from 'react'
import { Card, LevelBadge, PageHead, Section } from '../components/ui'
import { Court3D } from '../components/Court3D'
import { VIEWS, contacts } from '../components/shotView'
import { SHOTS, shotSim, type ShotInfo } from '../data/shots'
import { CATEGORIES, GLOSSARY, type Category } from '../data/glossary'
import { hashParam, href, setHashParam } from '../router'

const GROUPS: ShotInfo['group'][] = ['기본 샷', '앞 코트', '보스트와 벽 샷', '서브']

// 높이가 중요한 샷은 옆에서 보는 게 이해가 쉽다
const viewFor = (s: ShotInfo) => (s.kind === 'skid' || s.kind === 'back-wall' || s.kind.includes('lob') ? VIEWS.side : VIEWS.diag)

export default function Shots() {
  const [id, setId] = useState(() => {
    const s = hashParam('s')
    return SHOTS.some((x) => x.id === s) ? s! : SHOTS[0].id
  })
  const shot = SHOTS.find((s) => s.id === id)!
  const [view, setView] = useState<{ yaw: number; pitch: number }>(() => viewFor(shot))
  const sim = useMemo(() => shotSim(shot), [shot])

  const pick = (next: string, scroll = false) => {
    setId(next)
    setHashParam('shots', 's', next)
    setView(viewFor(SHOTS.find((x) => x.id === next)!))
    if (scroll) document.getElementById('viewer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <PageHead eyebrow="ENCYCLOPEDIA" title="기술 백과">
        샷마다 공이 어느 벽을 어떤 높이로, 어떤 순서로 맞는지 3D로 보여 줘요. 게임과 같은 물리로 굴린 공이라 높이(Z축)도 실제처럼 보여요. 오른손잡이가 오른쪽(포핸드 쪽)에서 치는 기준이에요.
      </PageHead>

      <Section kicker="3D SHOTS" title="샷을 3D로 보기" id="viewer">
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <div className="space-y-3 lg:space-y-4">
            {GROUPS.map((g) => (
              <div key={g}>
                <p className="text-[13px] font-semibold text-muted">{g}</p>
                <div className="-mx-4 mt-1.5 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
                  {SHOTS.filter((s) => s.group === g).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={s.id === id}
                      onClick={() => pick(s.id)}
                      className="shrink-0 rounded-full border border-line bg-card px-3.5 py-2 text-[14.5px] font-semibold whitespace-nowrap transition hover:border-teal/50 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Card className="p-3 md:p-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_1fr]">
              <div>
                <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="보는 방향">
                  {Object.values(VIEWS).map((v) => (
                    <button
                      key={v.label}
                      type="button"
                      onClick={() => setView({ yaw: v.yaw, pitch: v.pitch })}
                      aria-pressed={view.yaw === v.yaw && view.pitch === v.pitch}
                      className="rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold text-muted aria-pressed:border-teal aria-pressed:bg-teal-soft aria-pressed:text-teal-deep"
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                {sim ? (
                  <>
                    <Court3D sim={sim} from={shot.from} view={view} onViewChange={setView} label={`${shot.name}: 공이 벽과 바닥에 닿는 순서를 3D로 보여 주는 그림`} />
                    <ol className="mt-3 space-y-1 text-[14px]">
                      {contacts(sim).map((c, i) => (
                        <li key={i} className="flex gap-2">
                          <span className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${c.hit === 'floor' ? 'bg-ink text-white' : 'border-2 border-teal bg-white text-ink'}`}>
                            {i + 1}
                          </span>
                          {c.label}
                        </li>
                      ))}
                    </ol>
                  </>
                ) : (
                  <p className="text-[15px] text-muted">이 샷의 그림을 만들지 못했어요.</p>
                )}
              </div>

              <div aria-live="polite">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[25px] font-extrabold tracking-[-0.01em]">{shot.name}</h3>
                  <LevelBadge level={shot.level} />
                </div>
                <p className="mt-0.5 text-[14px] text-muted">{shot.en}</p>
                <p className="mt-3 text-[15.5px] leading-relaxed">{shot.what}</p>
                <h4 className="mt-5 text-[15px] font-extrabold">언제 치나요</h4>
                <p className="mt-1 text-[15px] leading-relaxed text-ink/80">{shot.when}</p>
                <h4 className="mt-5 text-[15px] font-extrabold">이렇게 쳐요</h4>
                <ol className="mt-2 space-y-2">
                  {shot.how.map((h, i) => (
                    <li key={h} className="flex gap-2.5 text-[15px] leading-relaxed">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-teal text-[12px] font-bold text-white">{i + 1}</span>
                      {h}
                    </li>
                  ))}
                </ol>
                <h4 className="mt-5 text-[15px] font-extrabold">자주 하는 실수</h4>
                <ul className="mt-1.5 space-y-1.5">
                  {shot.mistakes.map((m) => (
                    <li key={m} className="flex gap-2 text-[15px] leading-relaxed text-ink/80">
                      <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-tin" />
                      {m}
                    </li>
                  ))}
                </ul>
                {shot.drill && (
                  <a href={`${href('practice')}?d=${shot.drill}`} className="mt-6 inline-flex rounded-2xl bg-ink px-4 py-3 text-[15px] font-bold text-white transition hover:bg-teal-deep">
                    혼자 연습하는 법 보기
                  </a>
                )}
              </div>
            </div>
          </Card>
        </div>
      </Section>

      <Glossary onShot={(s) => pick(s, true)} />
    </>
  )
}

function Glossary({ onShot }: { onShot: (id: string) => void }) {
  const [cat, setCat] = useState<Category | null>(null)
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const list = GLOSSARY.filter((t) => (!cat || t.cat === cat) && (!query || `${t.term} ${t.en ?? ''} ${t.body}`.toLowerCase().includes(query)))

  return (
    <Section kicker="GLOSSARY" title="용어 사전">
      <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
        분류는 대한스쿼시연맹이 펴낸 『스쿼시론』(김원관 외)의 장 구성을 따랐어요. 설명은 책을 옮긴 것이 아니라 세계스쿼시연맹 규칙과 널리 쓰는 지도 용어를 바탕으로 새로 쓴 거예요.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="용어 찾기 (예: 닉, 렛, 스키드)"
          aria-label="용어 찾기"
          className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-[16px] outline-none focus:border-teal"
        />
        <p className="text-[14px] text-muted">{list.length}개</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="분류">
        {[null, ...CATEGORIES].map((c) => (
          <button
            key={c ?? 'all'}
            type="button"
            aria-pressed={cat === c}
            onClick={() => setCat(c)}
            className="rounded-full border border-line bg-card px-3.5 py-1.5 text-[14px] font-semibold transition aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white"
          >
            {c ?? '전체'}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-6">
        {CATEGORIES.filter((c) => list.some((t) => t.cat === c)).map((c) => (
          <div key={c}>
            <h3 className="text-[17px] font-extrabold">{c}</h3>
            <dl className="mt-2 grid gap-2 md:grid-cols-2">
              {list
                .filter((t) => t.cat === c)
                .map((t) => (
                  <div key={t.term} className="rounded-[18px] border border-line/80 bg-card p-4">
                    <dt className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[16px] font-extrabold">{t.term}</span>
                      {t.en && <span className="text-[13px] text-muted">{t.en}</span>}
                    </dt>
                    <dd className="mt-1 text-[14.5px] leading-relaxed text-ink/80">
                      {t.body}
                      {(t.shot || t.link) && (
                        <span className="mt-2 flex gap-3 text-[13.5px] font-semibold">
                          {t.shot && (
                            <button type="button" onClick={() => onShot(t.shot!)} className="text-teal underline underline-offset-4">
                              3D로 보기
                            </button>
                          )}
                          {t.link && (
                            <a href={href(t.link)} className="text-teal underline underline-offset-4">
                              자세히
                            </a>
                          )}
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        ))}
        {list.length === 0 && <p className="text-[15px] text-muted">찾는 용어가 없어요. 다른 말로 찾아보세요.</p>}
      </div>
    </Section>
  )
}
