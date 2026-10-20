import { useEffect, useMemo, useRef, useState } from 'react'
import { L, R, segEnds, timeline, type Figure, type Move, type Name, type Seg } from './rig'

const INK = '#141618'
const FAR = '#a3abad'
const FOCUS = '#19a3ae'
const FOCUS_FAR = '#8fd0d5'

type Props = { move: Move; label: string; onStep?: (step: number) => void; className?: string }

/** 막대 인형이 동작을 되풀이한다. 화면에 보일 때만 움직이고, 움직임 줄이기 설정이면 멈춰 둔다 */
export function StretchFigure({ move, label, onStep, className }: Props) {
  const tl = useMemo(() => timeline(move), [move])
  const box = useMemo(() => bounds(move, tl), [move, tl])
  const ref = useRef<HTMLDivElement>(null)
  const [time, setTime] = useState(0)
  const [visible, setVisible] = useState(false)
  const [paused, setPaused] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  const lastStep = useRef(-1)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver !== 'function') return setVisible(true)
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '80px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || paused) return
    let raf = 0
    let prev = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - prev) / 1000)
      prev = now
      setTime((t) => (t + dt) % tl.total)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible, paused, tl])

  const { fig, step } = tl.at(time)
  useEffect(() => {
    if (step !== lastStep.current) {
      lastStep.current = step
      onStep?.(step)
    }
  }, [step, onStep])

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <svg viewBox={`${box.x} ${-box.y1} ${box.w} ${box.h}`} className="h-full w-full" role="img" aria-label={`${label} 동작 그림`}>
        <Scene fig={fig} move={move} />
      </svg>
      {move.caption && <span className="absolute top-2.5 left-3 text-[12px] font-semibold text-muted">{move.caption}</span>}
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? '움직임 보기' : '움직임 멈추기'}
        className="absolute right-2 bottom-2 grid size-8 place-items-center rounded-full bg-white/85 text-ink shadow-sm ring-1 ring-line hover:bg-white"
      >
        {paused ? (
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
            <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
            <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor" />
          </svg>
        )}
      </button>
    </div>
  )
}

/** 한 바퀴 동안 인형과 소품이 지나는 곳을 모두 담는 화면 */
function bounds(move: Move, tl: ReturnType<typeof timeline>) {
  let x0 = Infinity
  let x1 = -Infinity
  let y1 = 0
  const n = 48
  for (let i = 0; i < n; i++) {
    const { fig } = tl.at((tl.total * i) / n)
    for (const [k, v] of Object.entries(fig.p)) {
      const r = k === 'head' ? L.head : R
      x0 = Math.min(x0, v.x - r)
      x1 = Math.max(x1, v.x + r)
      y1 = Math.max(y1, v.y + r)
    }
    if (fig.racket > 0.05) {
      const tip = racketTip(fig)
      x0 = Math.min(x0, tip.x - 8)
      x1 = Math.max(x1, tip.x + 8)
      y1 = Math.max(y1, tip.y + 8)
    }
    if (fig.roller) {
      x0 = Math.min(x0, -fig.roller.r)
      x1 = Math.max(x1, fig.roller.r)
    }
  }
  if (move.wall != null) x1 = Math.max(x1, move.wall + 6)
  if (move.bar != null) x0 = Math.min(x0, move.bar - 4)
  const pad = 8
  // 서 있는 사람이 화면 높이의 3/4쯤 되게: 동작마다 크기가 들쭉날쭉하지 않도록 최소 크기를 둔다
  let w = Math.max(x1 - x0 + pad * 2, 150)
  let h = Math.max(y1 + pad + 6, 124)
  // 카드에서 같은 비율로 보이게 4:3으로 맞춘다
  if (w / h < 4 / 3) w = (h * 4) / 3
  else h = (w * 3) / 4
  const cx = (x0 + x1) / 2
  return { x: cx - w / 2, y1: h - 6, w, h }
}

function racketTip(fig: Figure) {
  const { handA: h, fingersA: f } = fig.p
  const dx = f.x - h.x
  const dy = f.y - h.y
  const d = Math.hypot(dx, dy) || 1
  return { x: h.x + (dx / d) * 30, y: h.y + (dy / d) * 30 }
}

const flip = (y: number) => -y

function Scene({ fig, move }: { fig: Figure; move: Move }) {
  const p = fig.p
  const focus = new Set(move.focus)
  const front = move.view === 'front'
  const line = (s: Seg, w: number, far: boolean) => {
    const [a, b] = segEnds(s)
    const on = focus.has(s)
    return (
      <line key={s} x1={p[a].x} y1={flip(p[a].y)} x2={p[b].x} y2={flip(p[b].y)} stroke={on ? (far ? FOCUS_FAR : FOCUS) : far ? FAR : INK} strokeWidth={w} strokeLinecap="round" />
    )
  }
  const limbW = R * 2
  const farLeg: Seg[] = ['thighB', 'shinB', 'footB']
  const farArm: Seg[] = ['upperB', 'foreB', 'palmB']
  const nearLeg: Seg[] = ['thighA', 'shinA', 'footA']
  const nearArm: Seg[] = ['upperA', 'foreA', 'palmA']
  const far = !front
  const dot = (n: Name, r: number, color: string) => <circle cx={p[n].x} cy={flip(p[n].y)} r={r} fill={color} />

  return (
    <g>
      {move.top ? (
        <rect x={-38} y={-118} width={76} height={122} rx={8} fill="#d4ebed" />
      ) : (
        <>
          {move.mat && <rect x={-200} y={-1.5} width={400} height={3} rx={1.5} fill="#d4ebed" />}
          <line x1={-400} y1={0} x2={400} y2={0} stroke="#c9cdcc" strokeWidth={1.5} />
        </>
      )}
      {move.wall != null && <rect x={move.wall} y={-140} width={6} height={140} fill="#dfe2e1" stroke="#c9cdcc" strokeWidth={1} />}
      {move.bar != null && <line x1={move.bar} y1={-62} x2={move.bar} y2={0} stroke="#c9cdcc" strokeWidth={3} strokeLinecap="round" />}
      {farArm.map((s) => line(s, limbW * 0.9, far))}
      {farLeg.map((s) => line(s, limbW, far))}
      {fig.roller && <Roller {...fig.roller} />}
      {front && <line x1={p.hipA.x} y1={flip(p.hipA.y)} x2={p.hipB.x} y2={flip(p.hipB.y)} stroke={INK} strokeWidth={limbW + 1} strokeLinecap="round" />}
      {front && (
        <line
          x1={p.shoulderA.x}
          y1={flip(p.shoulderA.y)}
          x2={p.shoulderB.x}
          y2={flip(p.shoulderB.y)}
          stroke={focus.has('upperA') ? FOCUS : INK}
          strokeWidth={limbW}
          strokeLinecap="round"
        />
      )}
      <Torso fig={fig} on={focus.has('torso')} w={limbW + 3} />
      <line x1={p.shoulder.x} y1={flip(p.shoulder.y)} x2={p.neck.x} y2={flip(p.neck.y)} stroke={INK} strokeWidth={limbW - 1} strokeLinecap="round" />
      {dot('head', L.head, INK)}
      {fig.racket > 0.05 && <Racket fig={fig} />}
      {nearLeg.map((s) => line(s, limbW, false))}
      {nearArm.map((s) => line(s, limbW * 0.9, false))}
    </g>
  )
}

/** 몸통: 등이 휘면 곡선으로 */
function Torso({ fig, on, w }: { fig: Figure; on: boolean; w: number }) {
  const { hip: a, shoulder: b } = fig.p
  const c = { x: 2 * fig.spine.x - (a.x + b.x) / 2, y: 2 * fig.spine.y - (a.y + b.y) / 2 }
  return <path d={`M${a.x} ${flip(a.y)} Q${c.x} ${flip(c.y)} ${b.x} ${flip(b.y)}`} fill="none" stroke={on ? FOCUS : INK} strokeWidth={w} strokeLinecap="round" />
}

function Roller({ c, r, turn }: { c: { x: number; y: number }; r: number; turn: number }) {
  return (
    <g transform={`translate(${c.x} ${flip(c.y)}) rotate(${(turn * 180) / Math.PI})`}>
      <circle r={r} fill="#f2c230" stroke="#c99e1c" strokeWidth={1} />
      <circle r={r * 0.35} fill="#fff6d6" />
      <line x1={r * 0.45} y1={0} x2={r - 1} y2={0} stroke="#c99e1c" strokeWidth={1.4} strokeLinecap="round" />
    </g>
  )
}

function Racket({ fig }: { fig: Figure }) {
  const h = fig.p.handA
  const tip = racketTip(fig)
  const dx = tip.x - h.x
  const dy = tip.y - h.y
  const ang = (Math.atan2(-dy, dx) * 180) / Math.PI
  const mid = { x: h.x + dx * 0.36, y: h.y + dy * 0.36 }
  return (
    <g opacity={fig.racket}>
      <line x1={h.x} y1={flip(h.y)} x2={mid.x} y2={flip(mid.y)} stroke="#5e6668" strokeWidth={2.2} strokeLinecap="round" />
      <ellipse
        cx={(mid.x + tip.x) / 2 + dx * 0.04}
        cy={flip((mid.y + tip.y) / 2 + dy * 0.04)}
        rx={11}
        ry={8}
        transform={`rotate(${ang} ${(mid.x + tip.x) / 2 + dx * 0.04} ${flip((mid.y + tip.y) / 2 + dy * 0.04)})`}
        fill="none"
        stroke="#00707d"
        strokeWidth={2.2}
      />
    </g>
  )
}
