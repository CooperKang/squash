import { useState } from 'react'
import { Card, LevelBadge, PageHead, Section } from '../components/ui'
import { CourtPath, PathLegend } from '../components/CourtPath'
import { SHOTS, type ShotInfo } from '../data/shots'
import { hashParam, href, setHashParam } from '../router'

const GROUPS: ShotInfo['group'][] = ['기본', '앞 코트', '벽을 쓰는 샷', '타법']

export default function Shots() {
  const [id, setId] = useState(() => {
    const s = hashParam('s')
    return SHOTS.some((x) => x.id === s) ? s! : SHOTS[0].id
  })
  const shot = SHOTS.find((s) => s.id === id)!

  const pick = (next: string) => {
    setId(next)
    setHashParam('shots', 's', next)
  }

  return (
    <>
      <PageHead eyebrow="SHOTS" title="기술과 샷 이름">
        코치가 "보스트 쳐 봐요"라고 할 때 바로 떠오르게, 샷마다 공이 어느 벽을 어떤 순서로 맞는지 그림으로 정리했어요. 오른손잡이가 오른쪽(포핸드 쪽)에서 치는 그림이고, 백핸드는 좌우를 바꿔
        보면 돼요.
      </PageHead>

      <Section kicker="PICK A SHOT" title="샷 고르기">
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <div className="space-y-4">
            {GROUPS.map((g) => (
              <div key={g}>
                <p className="text-[13px] font-semibold text-muted">{g}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {SHOTS.filter((s) => s.group === g).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={s.id === id}
                      onClick={() => pick(s.id)}
                      className="rounded-full border border-line bg-card px-3.5 py-2 text-[15px] font-semibold transition hover:border-teal/50 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Card className="p-4 md:p-6">
            <div className="grid gap-6 md:grid-cols-[minmax(0,280px)_1fr]">
              <div>
                <CourtPath key={shot.id} points={shot.path} label={`${shot.name}의 공 길`} className="mx-auto max-w-[280px]" />
                <div className="mt-2">
                  <PathLegend points={shot.path} />
                </div>
              </div>
              <div aria-live="polite">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[26px] font-extrabold tracking-[-0.01em]">{shot.name}</h3>
                  <LevelBadge level={shot.level} />
                </div>
                <p className="mt-0.5 text-[14px] text-muted">{shot.en}</p>
                <p className="mt-3 text-[16px] leading-relaxed">{shot.what}</p>

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

      <Section kicker="READING THE PICTURE" title="그림 보는 법">
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <h3 className="font-extrabold">위는 앞벽, 아래는 바닥</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted">앞벽을 위로 펼쳐 바닥 그림 위에 붙였어요. 앞벽의 흰 동그라미가 공이 맞은 높이예요.</p>
          </Card>
          <Card>
            <h3 className="font-extrabold">숫자는 맞는 순서</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted">흰 동그라미는 벽, 검은 점은 바닥, 빨간 점은 닉(옆벽과 바닥의 모서리)이에요.</p>
          </Card>
          <Card>
            <h3 className="font-extrabold">게임에서 써 보기</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
              <a href={href('game')} className="font-semibold text-teal underline underline-offset-4">
                터치 스쿼시
              </a>
              에서 옆벽 가까이 뒤쪽으로 공이 오면 보스트 버튼이 나타나요.
            </p>
          </Card>
        </div>
      </Section>
    </>
  )
}
