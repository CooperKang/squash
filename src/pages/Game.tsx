import { useEffect, useRef, useState } from 'react'
import { Engine, type HudState } from '../game/engine'
import type { Difficulty } from '../game/physics'
import { HINTS, type RuleKey } from '../game/hints'
import { href } from '../router'

const DIFF: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: '쉬움' },
  { id: 'normal', label: '보통' },
  { id: 'hard', label: '어려움' },
]

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const [hud, setHud] = useState<HudState | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [sound, setSound] = useState(true)
  const [askRules, setAskRules] = useState(true)
  // 사라질 때도 글자가 남아 있게 마지막으로 물어본 규칙을 기억한다
  const [lastHint, setLastHint] = useState<RuleKey | null>(null)
  const [reading, setReading] = useState<RuleKey | null>(null)
  const [dismissed, setDismissed] = useState<RuleKey | null>(null)
  if (hud?.hint && hud.hint !== lastHint) setLastHint(hud.hint)
  const asking = !!hud?.hint && hud.hint !== dismissed && !reading

  useEffect(() => {
    const canvas = canvasRef.current!
    const engine = new Engine(canvas, setHud)
    engineRef.current = engine
    if (import.meta.env.DEV) Object.assign(window, { __squash: engine })
    engine.start()
    const ro = new ResizeObserver(() => engine.resize())
    ro.observe(canvas)
    return () => {
      ro.disconnect()
      engine.stop()
    }
  }, [])

  useEffect(() => {
    if (engineRef.current) engineRef.current.difficulty = difficulty
  }, [difficulty])
  useEffect(() => {
    if (engineRef.current) engineRef.current.sound = sound
  }, [sound])
  useEffect(() => {
    if (engineRef.current) engineRef.current.askRules = askRules
  }, [askRules])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'b' || e.key === 'B') engineRef.current?.boast()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const openHint = (k: RuleKey) => {
    setReading(k)
    engineRef.current?.pause()
  }
  const closeHint = () => {
    setReading(null)
    engineRef.current?.resume()
  }

  const local = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top] as const
  }

  const showMenu = !hud || hud.phase === 'ready' || hud.phase === 'over'

  return (
    <section className="mx-auto max-w-5xl px-0 md:px-4 md:pt-6" aria-label="스쿼시 게임">
      <div className="relative h-[calc(100dvh-56px-76px-env(safe-area-inset-bottom))] min-h-[420px] overflow-hidden bg-ink md:h-[min(78vh,720px)] md:rounded-[28px]">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 size-full touch-none select-none md:cursor-none"
          onPointerDown={(e) => {
            e.preventDefault()
            engineRef.current?.tap(...local(e))
          }}
          onPointerMove={(e) => e.pointerType === 'mouse' && engineRef.current?.pointerMove(...local(e))}
          onPointerLeave={() => engineRef.current?.pointerLeave()}
          aria-label="공이 날아오면 공을 눌러 치세요"
        />

        {hud && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 md:p-4">
            <ScoreChip label="나" value={hud.score.you} serving={hud.server === 'you'} accent />
            <div className="mt-1 flex flex-col items-center gap-1.5">
              <div className="rounded-full bg-black/45 px-3 py-1.5 text-center text-[12px] font-semibold text-white/90 backdrop-blur">
                랠리 {hud.rally} · 최고 {hud.bestRally}
              </div>
              {hud.lastShot && hud.phase === 'rally' && (
                <div className="rounded-full bg-white/85 px-3 py-1 text-[12px] font-bold text-ink">
                  {hud.lastShot.by === 'you' ? '나' : '상대'}: {hud.lastShot.name}
                </div>
              )}
            </div>
            <ScoreChip label="상대" value={hud.score.cpu} serving={hud.server === 'cpu'} />
          </div>
        )}

        {hud?.phase === 'serve-you' && !hud.hint && (
          <p className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-[14px] font-semibold text-white/85">
            내 서브예요. 떠오른 공을 눌러 치세요
          </p>
        )}

        {hud?.boastSide != null && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault()
              engineRef.current?.boast()
            }}
            className={`absolute bottom-6 grid size-[76px] place-items-center rounded-full border-2 border-white/80 bg-teal text-[15px] font-extrabold text-white shadow-xl active:scale-95 ${hud.boastSide > 0 ? 'right-4' : 'left-4'}`}
          >
            보스트
            <span className="sr-only">: 옆벽으로 쳐서 앞 구석에 떨어뜨리기</span>
          </button>
        )}

        {lastHint && (
          <div
            className={`absolute inset-x-0 bottom-4 flex justify-center px-3 transition duration-500 ${asking ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
            aria-hidden={!asking}
          >
            <div className="flex items-center gap-1 rounded-full bg-white/95 py-1.5 pr-1.5 pl-4 text-[14px] text-ink shadow-xl">
              <span className="font-semibold">{HINTS[lastHint].name}, 궁금하세요?</span>
              <button type="button" onClick={() => openHint(lastHint)} tabIndex={asking ? 0 : -1} className="ml-1 rounded-full bg-teal px-3.5 py-1.5 text-[13px] font-bold text-white">
                보기
              </button>
              <button
                type="button"
                onClick={() => setDismissed(lastHint)}
                tabIndex={asking ? 0 : -1}
                aria-label="닫기"
                className="grid size-8 place-items-center rounded-full text-[18px] leading-none text-muted"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {reading && (
          <div className="absolute inset-0 z-10 flex items-end justify-center bg-ink/55 p-3 md:items-center" role="dialog" aria-modal="true" aria-labelledby="hint-title">
            <div className="w-full max-w-md rounded-[26px] bg-white p-6 text-ink shadow-2xl">
              <p className="text-[13px] font-semibold text-teal">게임을 잠깐 멈췄어요</p>
              <h2 id="hint-title" className="mt-1 text-[24px] font-extrabold">
                {HINTS[reading].name}
              </h2>
              <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-ink/80">
                {HINTS[reading].body.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-teal" />
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex items-center gap-3">
                <button type="button" autoFocus onClick={closeHint} className="flex-1 rounded-2xl bg-teal py-3 text-[16px] font-bold text-white transition hover:bg-teal-deep">
                  계속하기
                </button>
                <a href={reading === 'boast' ? `${href('shots')}?s=boast` : href('rules')} className="text-[14px] font-semibold text-muted underline underline-offset-4">
                  {reading === 'boast' ? '기술 더 보기' : '규칙 전체 보기'}
                </a>
              </div>
            </div>
          </div>
        )}

        {showMenu && (
          <div className="absolute inset-0 grid place-items-center bg-ink/70 p-5 backdrop-blur-[2px]">
            <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-[26px] bg-white p-6 text-ink shadow-2xl">
              {hud?.result ? (
                <>
                  <p className="font-wide text-[11px] tracking-[0.2em] text-teal">GAME</p>
                  <h2 className="mt-2 text-[28px] font-extrabold">{hud.result === 'you' ? '이겼어요!' : '아쉽게 졌어요'}</h2>
                  <p className="mt-1 text-[15px] text-muted">
                    {hud.score.you} : {hud.score.cpu} · 최고 랠리 {hud.bestRally}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-wide text-[11px] tracking-[0.2em] text-teal">MINI GAME</p>
                  <h2 className="mt-2 text-[26px] font-extrabold leading-tight">터치 스쿼시</h2>
                  <p className="mt-3 text-[14px] leading-relaxed text-muted">공 둘레에 청록 링이 보이면 공을 눌러 치세요. 누르는 곳이 샷을 정해요.</p>
                  <ShotPad />
                  <ul className="mt-3 space-y-1 text-[13.5px] leading-relaxed text-muted">
                    <li>· 옆벽 가까이 뒤쪽으로 공이 오면 보스트 버튼이 나와요(PC는 B 키).</li>
                    <li>· 뒤쪽 허리 높이에서 제때 칠수록 샷이 예리하게 들어가요. 11점 먼저 내면 이겨요.</li>
                  </ul>
                </>
              )}
              <fieldset className="mt-5">
                <legend className="text-[13px] font-semibold text-muted">난이도</legend>
                <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-2xl bg-court p-1">
                  {DIFF.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      aria-pressed={difficulty === d.id}
                      onClick={() => setDifficulty(d.id)}
                      className="rounded-xl py-2 text-[14px] font-semibold text-muted aria-pressed:bg-ink aria-pressed:text-white"
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="mt-3 flex items-center gap-2 text-[14px] text-muted">
                <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} className="size-4 accent-teal" />
                효과음
              </label>
              <label className="mt-2 flex items-center gap-2 text-[14px] text-muted">
                <input type="checkbox" checked={askRules} onChange={(e) => setAskRules(e.target.checked)} className="size-4 accent-teal" />
                점수가 날 때 관련 규칙 물어보기
              </label>
              <button
                type="button"
                onClick={() => engineRef.current?.newMatch()}
                className="mt-5 w-full rounded-2xl bg-teal py-3.5 text-[16px] font-bold text-white transition hover:bg-teal-deep active:scale-[0.99]"
              >
                {hud?.result ? '다시 하기' : '시작하기'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function ScoreChip({ label, value, serving, accent }: { label: string; value: number; serving: boolean; accent?: boolean }) {
  return (
    <div className={`min-w-[84px] rounded-2xl px-3.5 py-2 text-white shadow-lg ${accent ? 'bg-teal' : 'bg-ink/85'}`}>
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-white/80">
        {label}
        {serving && <span className="rounded-full bg-white/20 px-1.5 text-[10px] text-white">서브</span>}
      </div>
      <div className="font-wide text-[26px] leading-tight">{value}</div>
    </div>
  )
}

/** 공의 어디를 누르면 어떤 샷이 나가는지(오른쪽 벽 가까운 공 기준) */
function ShotPad() {
  const cells = [
    ['드롭', '드롭', '크로스 드롭'],
    ['드라이브', '드라이브', '크로스'],
    ['로브', '로브', '크로스 로브'],
  ]
  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="relative grid size-[150px] shrink-0 grid-cols-3 grid-rows-3 overflow-hidden rounded-[26px] border-2 border-teal-bright bg-court text-[11px] leading-tight font-bold text-ink">
        {cells.flat().map((c, i) => (
          <span key={i} className={`grid place-items-center text-center ${i % 3 === 2 ? 'text-teal-deep' : ''}`}>
            {i === 4 ? '' : c}
          </span>
        ))}
        <span className="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" aria-hidden="true" />
      </div>
      <p className="text-[13px] leading-relaxed text-muted">
        공이 <b className="text-ink">오른쪽 벽</b> 가까이 있을 때예요. 가운데는 벽을 따라 가는 스트레이트, 벽 쪽 옆면은 크로스, 윗면은 드롭(높은 공은 킬), 아랫면은 로브. 왼쪽 벽이면 좌우가 바뀌어요.
      </p>
    </div>
  )
}
