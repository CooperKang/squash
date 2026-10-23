import { RealismCoach, RealismControls } from './RealismControls'
import type { GameMode } from '../game/realism'
import type { WorkoutHud } from '../game/workout'
import type { MatchSummary } from '../game/matchStats'
import { MatchReport } from './MatchReport'
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

// 아래 메뉴가 보이는 폭(lg 미만)에서는 게임을 화면 전체로 띄운다
const IMMERSIVE = '(max-width: 1023.98px)'

export default function Game() {
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [immersive, setImmersive] = useState(false)
  const engineRef = useRef<Engine | null>(null)
  const [hud, setHud] = useState<HudState | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [mode, setMode] = useState<GameMode>('classic')
  const [coach, setCoach] = useState<number | null>(null)
  const [rallyReport, setRallyReport] = useState<MatchSummary | null>(null)
  const [showMatchTotals, setShowMatchTotals] = useState(false)
  const activePointer = useRef<number | null>(null)
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
    if (engineRef.current) engineRef.current.mode = mode
  }, [mode])

  useEffect(() => {
    const cancel = () => {
      activePointer.current = null
      engineRef.current?.cancelCharge()
    }
    window.addEventListener('blur', cancel)
    document.addEventListener('visibilitychange', cancel)
    const preventDrag = (e: Event) => { if (activePointer.current !== null) e.preventDefault() }
    document.addEventListener('selectstart', preventDrag)
    document.addEventListener('dragstart', preventDrag)
    return () => {
      window.removeEventListener('blur', cancel)
      document.removeEventListener('visibilitychange', cancel)
      document.removeEventListener('selectstart', preventDrag)
      document.removeEventListener('dragstart', preventDrag)
    }
  }, [])

  useEffect(() => {
    if (!immersive) return
    const root = document.documentElement
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = ''
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    }
  }, [immersive])

  const enterImmersive = () => {
    if (immersive || !window.matchMedia(IMMERSIVE).matches) return
    setImmersive(true)
    // 안드로이드는 주소창까지 숨긴다. 아이폰 사파리는 지원하지 않아 화면을 덮는 것으로 끝낸다
    sectionRef.current?.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {})
  }
  const exitImmersive = () => {
    activePointer.current = null
    setRallyReport(null)
    setReading(null)
    setCoach(null)
    engineRef.current?.quit()
    setImmersive(false)
  }

  const openCoach = () => {
    engineRef.current?.pause()
    setCoach(0)
  }
  const closeCoach = () => {
    try {
      localStorage.setItem('squash.realismCoach.v2', 'seen')
    } catch {
      /* 저장 없이도 플레이 가능 */
    }
    setCoach(null)
    engineRef.current?.resume()
  }
  const selectMode = (next: GameMode) => {
    setMode(next)
    if (engineRef.current) engineRef.current.mode = next
    if (next === 'realistic') {
      let seen = false
      try {
        seen = localStorage.getItem('squash.realismCoach.v2') === 'seen'
      } catch {
        /* 첫 안내 표시 */
      }
      if (!seen) openCoach()
    }
  }

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

  const blockDrag = !showMenu && coach === null && rallyReport === null && reading === null
  const modeChoices = (
    <fieldset className="mb-5">
      <legend className="sr-only">게임 모드</legend>
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-court p-1">
        {([
          { id: 'classic', label: '기본모드' },
          { id: 'realistic', label: '현실모드' },
        ] as const).map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            onClick={() => selectMode(m.id)}
            className="min-h-11 rounded-xl text-[14px] font-bold text-muted aria-pressed:bg-teal aria-pressed:text-white"
          >
            {m.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
  const options = (
    <>
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
    </>
  )

  return (
    <section
      ref={sectionRef}
      className={
        immersive
          ? 'fixed inset-0 z-50 flex flex-col bg-ink pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]'
          : 'mx-auto max-w-5xl px-0 md:px-4 md:pt-6'
      }
      aria-label="스쿼시 게임"
    >
      {immersive && (
        <div className="flex h-11 shrink-0 items-center px-2">
          <button type="button" onClick={exitImmersive} className="flex min-h-11 items-center gap-1 rounded-full px-3 text-[14px] font-bold text-white/85 active:bg-white/10">
            <span aria-hidden="true" className="text-[18px] leading-none">‹</span> 나가기
          </button>
        </div>
      )}
      <div className={immersive ? 'relative min-h-0 flex-1 overflow-hidden bg-ink' : 'relative h-[calc(100dvh-56px-76px-env(safe-area-inset-bottom))] min-h-[420px] overflow-hidden bg-ink md:h-[min(78vh,720px)] md:rounded-[28px]'} style={blockDrag ? { userSelect: 'none', WebkitUserSelect: 'none' } : undefined} onDragStart={(e) => { if (blockDrag) e.preventDefault() }}>
        <div className="contents" inert={coach !== null || rallyReport !== null}>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 size-full touch-none select-none md:cursor-none"
            onPointerDown={(e) => {
              if (e.button !== 0 || activePointer.current !== null) return
              e.preventDefault()
              window.getSelection()?.removeAllRanges()
              activePointer.current = e.pointerId
              e.currentTarget.setPointerCapture(e.pointerId)
              engineRef.current?.press(...local(e), e.pointerType)
            }}
            onPointerMove={(e) => {
              if (e.pointerType === 'mouse' || activePointer.current === e.pointerId) engineRef.current?.pointerMove(...local(e), e.pointerType)
            }}
            onPointerUp={(e) => {
              if (activePointer.current !== e.pointerId) return
              e.preventDefault()
              engineRef.current?.release(...local(e))
              activePointer.current = null
              if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
            }}
            onPointerCancel={() => {
              activePointer.current = null
              engineRef.current?.cancelCharge()
            }}
            onLostPointerCapture={() => {
              activePointer.current = null
              engineRef.current?.cancelCharge()
            }}
            onPointerLeave={() => engineRef.current?.pointerLeave()}
            aria-label={mode === 'realistic' ? '누르고 파워를 모은 뒤 놓아서 공을 치세요' : '공이 날아오면 공을 눌러 치세요'}
          />

          {hud && (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 md:p-4">
              <ScoreChip label="나" value={hud.score.you} serving={hud.server === 'you'} accent energy={hud.realism?.you} workout={hud.realism?.youWorkout} />
              <div className="mt-1 flex flex-col items-center gap-1.5">
                <div className="rounded-full bg-black/45 px-3 py-1.5 text-center text-[12px] font-semibold text-white/90 backdrop-blur">
                  랠리 {hud.rally} · 최고 {hud.bestRally}
                </div>
                {hud.status && (
                  <div
                    className={`rounded-full px-3 py-1 text-[12px] font-extrabold ${hud.status === 'deuce' ? 'bg-dot text-ink' : hud.status === 'game-ball-you' ? 'bg-teal-bright text-white' : 'bg-tin text-white'}`}
                    aria-live="polite"
                  >
                    {hud.status === 'deuce' ? '듀스' : hud.status === 'game-ball-you' ? '게임볼 · 나' : '게임볼 · 상대'}
                  </div>
                )}
                {hud.lastShot && hud.phase === 'rally' && (
                  <div className="rounded-full bg-white/85 px-3 py-1 text-[12px] font-bold text-ink">
                    {hud.lastShot.by === 'you' ? '나' : '상대'}: {hud.lastShot.name}
                  </div>
                )}
                {hud.realism && <p className="max-w-[112px] text-center text-[9px] leading-snug text-ink/70">70kg 기준<br />실제 운동 환산 추정</p>}
              </div>
              <ScoreChip label="상대" value={hud.score.cpu} serving={hud.server === 'cpu'} energy={hud.realism?.cpu} workout={hud.realism?.cpuWorkout} />
            </div>
          )}

          {hud?.phase === 'serve-you' && !hud.hint && (
            <p
              className={`pointer-events-none absolute inset-x-0 px-3 text-center text-[13px] font-semibold ${mode === 'realistic' ? `${hud.lastRally ? 'top-52' : 'top-40'} mx-auto max-w-[300px] rounded-full bg-ink/65 py-2 text-white` : 'bottom-5 text-white/85'}`}
            >
              {mode === 'realistic' ? '내 서브 · 공을 누르면 멈춰요. 파워를 정하고 놓으세요' : '내 서브예요. 떠오른 공을 눌러 치세요'}
            </p>
          )}
          {hud?.realism && hud.lastRally && !showMenu && hud.phase !== 'rally' && (
            <button type="button" className="absolute inset-x-0 top-40 mx-auto w-fit rounded-full bg-ink/80 px-4 py-2 text-[12px] font-bold text-white" onClick={() => { engineRef.current?.pause(); setShowMatchTotals(false); setRallyReport(hud.lastRally) }}>
              이번 랠리 {hud.lastRally.hits}타 · {Math.floor(hud.lastRally.seconds)}초 · 기록 보기
            </button>
          )}

          {lastHint && (
            <div
              // 현실모드에서는 아래 가운데의 위치·체력 패널과 겹치지 않게 그 위에 띄운다
              className={`absolute inset-x-0 flex justify-center px-3 transition duration-500 ${hud?.realism ? 'bottom-[104px] md:bottom-[176px]' : 'bottom-4'} ${asking ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
              aria-hidden={!asking}
            >
              <div className="flex items-center gap-1 rounded-full bg-white/95 py-1.5 pr-1.5 pl-4 text-[14px] text-ink shadow-xl">
                <span className="font-semibold">{HINTS[lastHint].name}, 궁금하세요?</span>
                <button
                  type="button"
                  onClick={() => openHint(lastHint)}
                  tabIndex={asking ? 0 : -1}
                  className="ml-1 rounded-full bg-teal px-3.5 py-1.5 text-[13px] font-bold text-white"
                >
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
                {!hud?.result && modeChoices}
                {hud?.result ? (
                  <>
                    <p className="font-wide text-[11px] tracking-[0.2em] text-teal">GAME</p>
                    <h2 className="mt-2 text-[28px] font-extrabold">{hud.result === 'you' ? '이겼어요!' : '아쉽게 졌어요'}</h2>
                    <p className="mt-1 text-[15px] text-muted">
                      {hud.score.you} : {hud.score.cpu} · 이번 경기 최장 {hud.summary.bestRally}타
                    </p>
                    <MatchReport summary={hud.summary} />
                  </>
                ) : (
                  <>
                    <p className="font-wide text-[11px] tracking-[0.2em] text-teal">MINI GAME</p>
                    <h2 className="mt-2 text-[26px] font-extrabold leading-tight">{mode === 'realistic' ? '현실모드' : '터치 스쿼시'}</h2>
                    <p className="mt-3 text-[14px] leading-relaxed text-muted">
                      {mode === 'realistic'
                        ? '강약을 조절하고 체력을 관리하며 랠리를 이어가 보세요. 공을 누르면 잠깐 멈추고, 파워를 정한 뒤 놓으면 스윙해요. 이동과 T 복귀는 자동이에요.'
                        : '공 둘레에 청록 링이 보이면 공을 눌러 치세요. 누르는 곳이 샷을 정해요.'}
                    </p>
                    {mode === 'classic' ? (
                      <ShotPad />
                    ) : (
                      <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-teal-soft p-3 text-center text-[11px] font-bold leading-relaxed text-teal-deep">
                        <span>
                          공 안쪽
                          <br />
                          보스트
                        </span>
                        <span>
                          가운데
                          <br />
                          드라이브
                        </span>
                        <span>
                          벽 쪽<br />
                          크로스
                        </span>
                      </div>
                    )}
                    <ul hidden={mode === 'realistic'} className="mt-3 space-y-1 text-[13.5px] leading-relaxed text-muted">
                      <li>
                        {mode === 'realistic'
                          ? '· 공을 누르면 잠깐 멈추고, 놓으면 스윙해요. 공으로 이동하고 친 뒤 T로 돌아가는 동작은 자동이에요.'
                          : '· 쉬움 모드는 링이 보일 때 누르면 그 순간 멈추고, 공을 크게 보여 줘요. 칸마다 적힌 샷을 골라 누르면 그 샷이 나가요.'}
                      </li>
                      <li>· 상대는 공이 올 곳을 미리 읽고 스텝을 밟아 가서 실제 선수처럼 런지하고 휘둘러요.</li>
                      <li>· 뒤쪽 허리 높이에서 제때 칠수록 샷이 예리하게 들어가요. 11점 먼저 내면 이겨요.</li>
                    </ul>
                  </>
                )}
                {mode === 'realistic' && !hud?.result && (
                  <p className="mt-3 text-[11px] leading-relaxed text-muted">예상 칼로리는 70kg 성인의 실제 운동 환산치이며 안정 시 대사량을 포함해요. 이동·강타·랠리에 따라 달라지며, 게임 조작자의 실제 소모량은 아니에요. <a href="https://pacompendium.com/sports/" target="_blank" rel="noreferrer" className="underline underline-offset-2">MET 기준</a></p>
                )}
                {mode === 'realistic' && !hud?.result && (
                  <button type="button" onClick={openCoach} className="mt-3 text-[13px] font-bold text-teal underline underline-offset-4">
                    조작 방법 다시 보기
                  </button>
                )}
                {hud?.result ? <details className="mt-4 text-[13px] text-muted"><summary className="cursor-pointer font-bold">다음 경기 설정</summary>{modeChoices}{options}</details> : options}
                <button
                  type="button"
                  onClick={() => {
                    // 누른 순간에 소리를 켠다(브라우저 정책)
                    engineRef.current?.unlockAudio()
                    enterImmersive()
                    engineRef.current?.newMatch()
                  }}
                  className="mt-5 w-full rounded-2xl bg-teal py-3.5 text-[16px] font-bold text-white transition hover:bg-teal-deep active:scale-[0.99]"
                >
                  {hud?.result ? '다시 하기' : '시작하기'}
                </button>
              </div>
            </div>
          )}
          {hud?.realism && !showMenu && <RealismControls state={hud.realism} onHelp={openCoach} />}
        </div>
        {coach !== null && <RealismCoach step={coach} onClose={closeCoach} onNext={() => (coach === 2 ? closeCoach() : setCoach(coach + 1))} />}
        {rallyReport && <div className="absolute inset-0 z-20 grid place-items-center bg-ink/65 p-4" role="dialog" aria-modal="true" aria-label="이번 랠리 결과" onKeyDown={(e) => { if (e.key === 'Escape') { setRallyReport(null); engineRef.current?.resume() } }}>
          <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-[26px] bg-white p-4">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-court p-1" role="group" aria-label="기록 범위">
              <button type="button" aria-pressed={!showMatchTotals} className="rounded-lg py-2 text-[13px] font-bold text-muted aria-pressed:bg-teal aria-pressed:text-white" onClick={() => setShowMatchTotals(false)}>이번 랠리</button>
              <button type="button" aria-pressed={showMatchTotals} className="rounded-lg py-2 text-[13px] font-bold text-muted aria-pressed:bg-teal aria-pressed:text-white" onClick={() => setShowMatchTotals(true)}>경기 누적</button>
            </div>
            <MatchReport summary={showMatchTotals && hud ? hud.summary : rallyReport} rally={!showMatchTotals} />
            <button type="button" autoFocus className="mt-4 w-full rounded-2xl bg-teal py-3 font-bold text-white" onClick={() => { setRallyReport(null); engineRef.current?.resume() }}>계속하기</button>
          </div>
        </div>}
      </div>
    </section>
  )
}

function ScoreChip({ label, value, serving, accent, energy, workout }: { label: string; value: number; serving: boolean; accent?: boolean; energy?: number; workout?: WorkoutHud }) {
  return (
    <div className={`min-w-[84px] rounded-2xl px-3.5 py-2 text-white shadow-lg ${accent ? 'bg-teal' : 'bg-ink/85'}`}>
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-white/80">
        {label}
        {serving && <span className="rounded-full bg-white/20 px-1.5 text-[10px] text-white">서브</span>}
      </div>
      <div className="font-wide text-[26px] leading-tight">{value}</div>
      {energy != null && workout && (
        <div className="mt-1.5 border-t border-white/20 pt-1.5 text-[10px] leading-relaxed tabular-nums" aria-label={`${label} 운동 정보`}>
          <div role="meter" aria-label={`${label} 남은 체력`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(energy)}>
            체력 {Math.round(energy)}%
            <div className="my-1 h-1 overflow-hidden rounded-full bg-white/20"><div className={`h-full rounded-full ${energy < 30 ? 'bg-dot' : 'bg-white/90'}`} style={{ width: `${energy}%` }} /></div>
          </div>
          <div className="text-white/75">{energy < 20 ? '탈진 · 범위 축소' : energy < 40 ? '지침 · 속도 저하' : workout.intensity}</div>
          <div>예상 {workout.calories.toFixed(1)} kcal</div>
        </div>
      )}
    </div>
  )
}

/** 라켓으로 공의 어디를 때리면 어떤 샷이 나가는지(오른쪽 벽 가까운 공 기준) */
function ShotPad() {
  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="relative grid size-[156px] shrink-0 grid-cols-3 grid-rows-3 overflow-hidden rounded-[30px] border-2 border-teal-bright bg-court text-[11px] leading-tight font-bold text-ink">
        <span className="row-span-3 grid place-items-center border-r border-teal-bright/50 bg-teal-soft text-teal-deep">보스트</span>
        <span className="grid place-items-end justify-center pb-1">드롭</span>
        <span className="grid place-items-end justify-center border-l border-teal-bright/50 pb-1 text-center">
          크로스
          <br />
          드롭
        </span>
        <span className="grid place-items-start justify-center pt-1">드라이브</span>
        <span className="grid place-items-center border-l border-teal-bright/50">크로스</span>
        <span className="grid place-items-start justify-center pt-1">로브</span>
        <span className="grid place-items-start justify-center border-l border-teal-bright/50 pt-1 text-center">
          크로스
          <br />
          로브
        </span>
        <span className="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" aria-hidden="true" />
      </div>
      <p className="text-[13px] leading-relaxed text-muted">
        누른 곳이 <b className="text-ink">라켓이 공을 때리는 곳</b>이에요. 공이 오른쪽 벽 가까이 있으면 왼쪽을 때리면 오른쪽 벽으로 가는 보스트, 가운데는 벽을 따라 가는 드라이브,
        오른쪽을 때리면 크로스. 윗부분은 낮게(드롭), 아랫부분은 높게(로브). 왼쪽 벽이면 좌우가 바뀌어요.
      </p>
    </div>
  )
}
