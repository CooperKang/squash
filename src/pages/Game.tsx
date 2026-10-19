import { useEffect, useRef, useState } from 'react'
import { Engine, type HudState } from '../game/engine'
import type { Difficulty } from '../game/physics'

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
            <div className="mt-1 rounded-full bg-black/45 px-3 py-1.5 text-center text-[12px] font-semibold text-white/90 backdrop-blur">
              랠리 {hud.rally} · 최고 {hud.bestRally}
            </div>
            <ScoreChip label="상대" value={hud.score.cpu} serving={hud.server === 'cpu'} />
          </div>
        )}

        {hud?.phase === 'serve-you' && (
          <p className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-[14px] font-semibold text-white/85">
            내 서브예요. 떠오른 공을 눌러 치세요
          </p>
        )}

        {showMenu && (
          <div className="absolute inset-0 grid place-items-center bg-ink/70 p-5 backdrop-blur-[2px]">
            <div className="w-full max-w-sm rounded-[26px] bg-white p-6 text-ink shadow-2xl">
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
                  <ul className="mt-3 space-y-1.5 text-[14px] leading-relaxed text-muted">
                    <li>· 공 둘레에 청록 링이 보이면 공을 눌러 치세요.</li>
                    <li>· 공의 <b className="text-ink">왼쪽</b>을 치면 오른쪽으로, <b className="text-ink">아래쪽</b>을 치면 높이 날아가요.</li>
                    <li>· 윗부분을 치면 낮게 깔리지만 틴(빨간 선 아래)에 걸릴 수 있어요.</li>
                    <li>· 뒤쪽 허리 높이에서 칠수록 정확해요. 11점 먼저 내면 이겨요.</li>
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
