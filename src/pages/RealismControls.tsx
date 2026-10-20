import { useEffect, useRef } from 'react'
import type { CourtPoint, RealismHud } from '../game/realism'

export function RealismControls({ state: s, onMove, onT, onHelp }: { state: RealismHud; onMove: (p: CourtPoint) => void; onT: () => void; onHelp: () => void }) {
  const selectedPower = (0.25 + s.charge * 0.75) * s.maxPower
  const position = (p: CourtPoint) => ({ cx: (p.x + 3.2) * 10, cy: p.z * 10 })
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 text-white">
      {s.charging && (
        <div
          className="mx-auto mb-3 max-w-[260px] rounded-2xl bg-ink/95 px-4 py-3 shadow-xl"
          role="meter"
          aria-label="타격 파워"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(selectedPower * 100)}
        >
          <div className="flex justify-between text-[12px] font-bold">
            <span>놓으면 스윙</span>
            <span>파워 {Math.round(selectedPower * 100)}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
            <div className={`h-full rounded-full transition-[width] duration-75 ${s.charge > 0.85 ? 'bg-dot' : 'bg-teal-bright'}`} style={{ width: `${selectedPower * 100}%` }} />
          </div>
        </div>
      )}
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-[22px] bg-ink/90 p-3 shadow-xl backdrop-blur-md">
        <button
          type="button"
          aria-label="미니 코트에서 이동할 위치 선택"
          className="pointer-events-auto relative h-[98px] w-16 shrink-0 touch-none overflow-hidden rounded-lg border border-white/25 bg-white/10"
          onKeyDown={(e) => {
            const delta = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, -0.5], ArrowDown: [0, 0.5] }[e.key]
            if (delta) {
              e.preventDefault()
              onMove({ x: s.target.x + delta[0], z: s.target.z + delta[1] })
            }
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onT()
            }
          }}
          onPointerDown={(e) => {
            e.preventDefault()
            const r = e.currentTarget.getBoundingClientRect()
            onMove({ x: ((e.clientX - r.left) / r.width) * 6.4 - 3.2, z: ((e.clientY - r.top) / r.height) * 9.75 })
          }}
        >
          <svg viewBox="0 0 64 98" className="size-full" aria-hidden="true">
            <path d="M0 54.4H64M32 54.4V98" fill="none" stroke="white" opacity=".4" />
            <circle cx="32" cy="56" r="9" fill="#19a3ae" opacity=".2" />
            <text x="32" y="59" textAnchor="middle" fill="white" fontSize="9">
              T
            </text>
            <circle {...position(s.target)} r="4" fill="none" stroke="#19a3ae" strokeDasharray="2 2" />
            <circle {...position(s.cpuAt)} r="4" fill="#f2c230" />
            <circle {...position(s.youAt)} r="4" fill="#19a3ae" stroke="white" strokeWidth="1.5" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="font-bold text-teal-bright">{s.atT ? 'T존 · 짧게 움직이기 좋아요' : 'T로 돌아가 체력을 아끼세요'}</span>
            <button
              type="button"
              onClick={onHelp}
              aria-label="현실모드 조작 안내"
              className="pointer-events-auto grid size-9 place-items-center rounded-full border border-white/30 font-bold"
            >
              ?
            </button>
          </div>
          {[
            { label: '나', value: s.you, distance: s.youDistance, color: 'bg-teal-bright' },
            { label: '상대', value: s.cpu, distance: s.cpuDistance, color: 'bg-dot' },
          ].map((a) => (
            <div key={a.label} className="mt-1.5" role="meter" aria-label={`${a.label} 체력`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(a.value)}>
              <div className="flex justify-between text-[11px]">
                <span>
                  {a.label} · {Math.round(a.distance)}m
                </span>
                <span>{Math.round(a.value)}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/20">
                <div className={`h-full rounded-full transition-[width] duration-100 ${a.value < 30 ? 'bg-tin' : a.color}`} style={{ width: `${a.value}%` }} />
              </div>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[10px] text-white/65">최대 파워 {Math.round(s.maxPower * 100)}%</span>
            <button type="button" onClick={onT} className="pointer-events-auto min-h-11 rounded-xl bg-teal px-3 text-[12px] font-bold text-white">
              T로 복귀
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const STEPS = [
  {
    title: '누르고, 채우고, 놓으면 스윙',
    body: 'PC는 마우스를, 모바일은 손가락을 누르고 있으면 파워가 차요. 공이 청록 링 안에 올 때 원하는 지점에서 놓으세요. 공은 계속 움직이니 미리 충전해도 좋아요.',
    hint: '안쪽은 보스트 · 벽 쪽은 크로스 · 가운데는 드라이브',
  },
  {
    title: '공을 따라 이동하고 T로 돌아오기',
    body: '선수가 공 쪽으로 자동 이동하고, 친 뒤에는 T로 복귀해요. 아래 미니 코트를 누르면 기다릴 위치를 직접 정할 수 있고, T로 복귀 버튼으로 빠르게 중앙을 챙길 수 있어요.',
    hint: '청록 점은 나 · 노란 점은 상대 · 점선 원은 이동 목표',
  },
  {
    title: '강타와 먼 이동은 체력을 써요',
    body: '나와 상대 모두 멀리 달리고 강하게 칠수록 지쳐요. T에서 기다리면 더 잘 회복해요. 피곤해지면 PC 라켓 커서가 무거워져요. 모바일은 손가락 위치를 그대로 따르고, 선수의 이동과 최대 파워가 줄어요.',
    hint: '점수 사이에는 일부 회복 · 긴 경기의 피로는 남아요',
  },
]

export function RealismCoach({ step, onNext, onClose }: { step: number; onNext: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('[data-next]')?.focus()
  }, [step])
  const s = STEPS[step]
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-ink/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="realism-coach-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
        if (e.key === 'Tab') {
          const buttons = ref.current?.querySelectorAll<HTMLButtonElement>('button')
          if (!buttons) return
          const first = buttons[0],
            last = buttons[buttons.length - 1]
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            last.focus()
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }}
    >
      <div ref={ref} className="my-auto w-full max-w-sm rounded-[28px] bg-white p-6 text-ink shadow-2xl">
        <p className="text-[12px] font-extrabold tracking-widest text-teal">현실모드 · {step + 1} / 3</p>
        <div className="my-5 rounded-2xl bg-court p-5" aria-hidden="true">
          {step === 0 ? (
            <>
              <div className="flex justify-between text-[12px] font-bold text-teal">
                <span>누르고 있기</span>
                <span>놓으면 스윙 ↗</span>
              </div>
              <div className="mt-3 h-3 rounded-full bg-ink/10">
                <div className="h-full w-2/3 rounded-full bg-teal-bright" />
              </div>
            </>
          ) : step === 1 ? (
            <div className="flex items-center justify-center gap-5 text-[26px] font-extrabold text-teal">
              <span>●</span>
              <span>→</span>
              <span className="grid size-12 place-items-center rounded-full bg-teal/10">T</span>
              <span>←</span>
              <span className="text-dot">●</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-[14px] font-bold text-teal">
              <span>체력</span>
              <div className="h-3 flex-1 rounded-full bg-ink/10">
                <div className="h-full w-2/5 rounded-full bg-teal-bright" />
              </div>
              <span>T에서 회복</span>
            </div>
          )}
        </div>
        <h2 id="realism-coach-title" className="text-[23px] font-extrabold leading-snug">
          {s.title}
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">{s.body}</p>
        <p className="mt-3 rounded-xl bg-teal-soft px-3 py-2 text-[12px] font-semibold leading-relaxed text-teal-deep">{s.hint}</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-3 text-[13px] font-semibold text-muted">
            건너뛰기
          </button>
          <button type="button" data-next onClick={onNext} className="min-h-11 flex-1 rounded-xl bg-teal px-4 text-[14px] font-bold text-white">
            {step === 2 ? '이제 준비됐어요' : '다음'}
          </button>
        </div>
      </div>
    </div>
  )
}
