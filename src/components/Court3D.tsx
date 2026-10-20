import { useEffect, useRef, useState } from 'react'
import { COURT } from '../game/physics'
import type { Segment } from '../game/sequence'
import { contacts, type FloorTarget, type View } from './shotView'

// 게임과 같은 물리로 굴린 샷을 3D 코트에 그린다. 좌표는 게임과 같다:
// x 가운데 0 기준 좌우, y 바닥에서 높이(화면에서는 "높이(Z축)"로 부른다), z 앞벽 0 ~ 뒷벽 9.75.
// 샷 하나(기술 백과)도, 이어지는 여러 샷(혼자 연습)도 같은 방법으로 그린다.

const W = COURT.halfWidth
const L = COURT.length
const TARGET = { x: 0, y: 1.7, z: 4.9 }

type V3 = [number, number, number]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: V3): V3 => {
  const m = Math.hypot(...a)
  return [a[0] / m, a[1] / m, a[2] / m]
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const m = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return reduced
}

export function Court3D({
  segments,
  targets = [],
  view,
  label,
  onViewChange,
}: {
  segments: Segment[]
  targets?: FloorTarget[]
  view: View
  label: string
  onViewChange?: (v: View) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()
  const [sticks, setSticks] = useState(true)
  const [slow, setSlow] = useState(true)
  const state = useRef({ view, t0: 0, drag: null as null | { x: number; y: number; view: View } })
  const single = segments.length === 1

  useEffect(() => {
    state.current.view = view
  }, [view])
  useEffect(() => {
    state.current.t0 = performance.now()
  }, [segments])

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    // 샷마다 시작 시각을 이어 붙인다
    const starts: number[] = []
    let total = 0
    for (const s of segments) {
      starts.push(total)
      total += s.end
    }
    const hits = segments.map((s) => contacts(s.sim, s.end))

    const draw = (now: number) => {
      const r = canvas.getBoundingClientRect()
      const dpr = Math.min(2, devicePixelRatio || 1)
      if (canvas.width !== Math.round(r.width * dpr)) {
        canvas.width = Math.round(r.width * dpr)
        canvas.height = Math.round(r.height * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const w = r.width
      const h = r.height
      const { yaw, pitch } = state.current.view
      const dist = 14.5
      const cam: V3 = [TARGET.x + dist * Math.sin(yaw) * Math.cos(pitch), TARGET.y + dist * Math.sin(pitch), TARGET.z + dist * Math.cos(yaw) * Math.cos(pitch)]
      const f = norm(sub([TARGET.x, TARGET.y, TARGET.z], cam))
      const right = norm(cross(f, [0, 1, 0]))
      const up = cross(right, f)
      const F = Math.min(w * 1.55, h * 1.25)
      const P = (x: number, y: number, z: number) => {
        const d = sub([x, y, z], cam)
        const zc = Math.max(0.2, dot(d, f))
        return [w / 2 + (F * dot(d, right)) / zc, h / 2 + 10 - (F * dot(d, up)) / zc] as const
      }
      const poly = (ps: (readonly [number, number])[], fill: string, stroke?: string, lw = 1) => {
        ctx.beginPath()
        ps.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
        ctx.closePath()
        ctx.fillStyle = fill
        ctx.fill()
        if (stroke) {
          ctx.strokeStyle = stroke
          ctx.lineWidth = lw
          ctx.stroke()
        }
      }
      const line = (a: readonly [number, number], b: readonly [number, number], color: string, lw = 1.5, dash: number[] = []) => {
        ctx.beginPath()
        ctx.setLineDash(dash)
        ctx.moveTo(a[0], a[1])
        ctx.lineTo(b[0], b[1])
        ctx.strokeStyle = color
        ctx.lineWidth = lw
        ctx.stroke()
        ctx.setLineDash([])
      }
      const text = (s: string, at: readonly [number, number], color = '#141618', size = 11, align: CanvasTextAlign = 'left', weight = 700) => {
        ctx.font = `${weight} ${size}px 'Pretendard Variable', Pretendard, sans-serif`
        ctx.textAlign = align
        ctx.lineWidth = 3
        ctx.strokeStyle = 'rgb(255 255 255 / 0.85)'
        ctx.strokeText(s, at[0], at[1])
        ctx.fillStyle = color
        ctx.fillText(s, at[0], at[1])
      }
      const path = (pts: { p: { x: number; y: number; z: number } }[], color: string, lw: number, floor = false) => {
        ctx.beginPath()
        pts.forEach((q, i) => {
          const [x, y] = P(q.p.x, floor ? 0 : q.p.y, q.p.z)
          if (i) ctx.lineTo(x, y)
          else ctx.moveTo(x, y)
        })
        ctx.strokeStyle = color
        ctx.lineWidth = lw
        ctx.lineJoin = 'round'
        ctx.stroke()
      }
      const person = (x: number, z: number, alpha: number) => {
        const foot = P(x, 0, z + 0.35)
        const head = P(x, 1.75, z + 0.35)
        ctx.strokeStyle = `rgb(20 22 24 / ${alpha})`
        ctx.lineWidth = Math.max(4, (foot[1] - head[1]) * 0.18)
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(foot[0], foot[1])
        ctx.lineTo(head[0], head[1])
        ctx.stroke()
        ctx.lineCap = 'butt'
      }

      ctx.clearRect(0, 0, w, h)
      const H = 5.4
      // 바닥과 바닥 선
      poly([P(-W, 0, 0), P(W, 0, 0), P(W, 0, L), P(-W, 0, L)], '#ecdcbc', '#141618', 1.5)
      line(P(-W, 0, COURT.shortLine), P(W, 0, COURT.shortLine), '#c8402f')
      line(P(0, 0, COURT.shortLine), P(0, 0, L), '#c8402f')
      for (const s of [-1, 1]) {
        line(P(s * (W - 1.6), 0, COURT.shortLine), P(s * (W - 1.6), 0, COURT.shortLine + 1.6), '#c8402f')
        line(P(s * (W - 1.6), 0, COURT.shortLine + 1.6), P(s * W, 0, COURT.shortLine + 1.6), '#c8402f')
      }
      // 바닥에 놓는 수건·테이프 표시
      for (const t of targets) {
        poly([P(t.x0, 0.01, t.z0), P(t.x1, 0.01, t.z0), P(t.x1, 0.01, t.z1), P(t.x0, 0.01, t.z1)], 'rgb(242 194 48 / 0.4)', '#b8901a', 1.2)
        if (t.label) text(t.label, P((t.x0 + t.x1) / 2, 0, (t.z0 + t.z1) / 2), '#6b5310', 10, 'center')
      }
      // 앞벽: 틴, 서비스 라인, 아웃 라인
      poly([P(-W, 0, 0), P(W, 0, 0), P(W, H, 0), P(-W, H, 0)], 'rgb(246 247 247 / 0.92)', '#141618', 1.5)
      poly([P(-W, 0, 0), P(W, 0, 0), P(W, COURT.tin, 0), P(-W, COURT.tin, 0)], '#cfd2d2')
      for (const y of [COURT.tin, COURT.serviceLine, COURT.frontOut]) line(P(-W, y, 0), P(W, y, 0), '#c8402f', y === COURT.tin ? 2 : 1.5)
      // 옆벽과 뒷벽은 비쳐 보이게, 비스듬한 아웃 라인
      for (const s of [-1, 1]) {
        poly([P(s * W, 0, 0), P(s * W, H, 0), P(s * W, H, L), P(s * W, 0, L)], 'rgb(220 226 225 / 0.18)', 'rgb(20 22 24 / 0.35)', 1)
        line(P(s * W, COURT.frontOut, 0), P(s * W, COURT.backOut, L), '#c8402f', 1.5)
      }
      poly([P(-W, 0, L), P(W, 0, L), P(W, 2.8, L), P(-W, 2.8, L)], 'rgb(220 226 225 / 0.14)', 'rgb(20 22 24 / 0.3)', 1)
      line(P(-W, COURT.backOut, L), P(W, COURT.backOut, L), '#c8402f', 1.5)
      // 오른쪽·왼쪽 표시(포핸드/백핸드를 바꿔 볼 때 헷갈리지 않게)
      text('오른쪽', P(W, 0, L + 0.3), '#5e6668', 10, 'center', 600)
      text('왼쪽', P(-W, 0, L + 0.3), '#5e6668', 10, 'center', 600)

      // 높이 자: 앞벽 왼쪽 모서리에 1m 눈금
      for (let m = 1; m <= 4; m++) {
        const a = P(-W, m, 0)
        line(a, [a[0] - 6, a[1]], '#5e6668', 1.2)
        text(`${m}m`, [a[0] - 8, a[1] + 4], '#5e6668', 10, 'right', 600)
      }
      text('높이(Z축)', P(-W, 4.9, 0), '#5e6668', 10, 'right', 700)

      const k = slow ? 0.45 : 1
      const loop = total / k + 1.2
      const tAll = reduced ? total : Math.min(total, (((now - state.current.t0) / 1000) % loop) * k)
      // 지금 치고 있는 샷
      let cur = segments.length - 1
      for (let i = 0; i < segments.length; i++)
        if (tAll < starts[i] + segments[i].end) {
          cur = i
          break
        }

      segments.forEach((s, i) => {
        if (i > cur) return
        const tNow = i < cur ? s.end : tAll - starts[i]
        const shown = s.sim.points.filter((p) => p.t <= tNow)
        const faded = i < cur && !single
        person(s.from.x, s.from.z, i === cur ? 0.55 : 0.18)
        path(shown, faded ? 'rgb(20 22 24 / 0.1)' : 'rgb(20 22 24 / 0.22)', 2, true)
        if (sticks && !faded)
          shown.forEach((p, j) => {
            if (j % 6 || p.p.y < 0.2) return
            line(P(p.p.x, p.p.y, p.p.z), P(p.p.x, 0, p.p.z), 'rgb(0 112 125 / 0.35)', 1, [2, 3])
          })
        path(shown, faded ? 'rgb(0 112 125 / 0.3)' : '#00707d', faded ? 2 : 3)
        hits[i]
          .filter((c) => c.t <= tNow)
          .forEach((c, j) => {
            const at = P(c.at.x, c.at.y, c.at.z)
            ctx.beginPath()
            ctx.arc(at[0], at[1], c.hit === 'floor' ? 4 : 6, 0, Math.PI * 2)
            ctx.fillStyle = c.hit === 'floor' ? (faded ? 'rgb(20 22 24 / 0.3)' : '#141618') : '#ffffff'
            ctx.fill()
            if (c.hit !== 'floor') {
              ctx.strokeStyle = faded ? 'rgb(0 112 125 / 0.35)' : '#00707d'
              ctx.lineWidth = 2.5
              ctx.stroke()
            }
            if (single) text(`${j + 1}`, [at[0] + 8, at[1] - 6], '#141618', 12, 'left', 800)
          })
        if (i === cur && !reduced) {
          const b = shown[shown.length - 1]
          if (b) {
            const [bx, by] = P(b.p.x, b.p.y, b.p.z)
            ctx.beginPath()
            ctx.arc(bx, by, 6, 0, Math.PI * 2)
            ctx.fillStyle = '#141618'
            ctx.fill()
            ctx.beginPath()
            ctx.arc(bx - 1.5, by - 1.5, 1.6, 0, Math.PI * 2)
            ctx.fillStyle = '#f2c230'
            ctx.fill()
          }
        }
      })
      if (!single) {
        ctx.font = "800 13px 'Pretendard Variable', Pretendard, sans-serif"
        ctx.textAlign = 'left'
        ctx.fillStyle = '#141618'
        ctx.fillText(`${cur + 1}/${segments.length}  ${segments[cur]?.label ?? ''}`, 14, 22)
      }
      if (!reduced) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [segments, targets, single, sticks, slow, reduced, view])

  const down = (e: React.PointerEvent) => {
    state.current.drag = { x: e.clientX, y: e.clientY, view: { ...state.current.view } }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    const d = state.current.drag
    if (!d) return
    const next = {
      yaw: d.view.yaw - (e.clientX - d.x) * 0.008,
      pitch: e.pointerType === 'mouse' ? Math.max(0.02, Math.min(1.52, d.view.pitch + (e.clientY - d.y) * 0.006)) : d.view.pitch,
    }
    state.current.view = next
    if (reduced) onViewChange?.(next)
  }
  const up = () => {
    if (state.current.drag) onViewChange?.(state.current.view)
    state.current.drag = null
  }
  const replay = () => {
    state.current.t0 = performance.now()
  }

  return (
    <div>
      <canvas
        ref={ref}
        className="block aspect-[4/3.4] w-full cursor-grab touch-pan-y rounded-[20px] bg-[#f3f4f4] active:cursor-grabbing"
        role="img"
        aria-label={label}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">
        <span>끌어서 돌려 보세요</span>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={sticks} onChange={(e) => setSticks(e.target.checked)} className="size-4 accent-teal" />
          높이 막대
        </label>
        {!reduced && (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} className="size-4 accent-teal" />
            느리게
          </label>
        )}
        {!reduced && (
          <button type="button" onClick={replay} className="font-semibold text-teal underline underline-offset-4">
            다시 보기
          </button>
        )}
      </div>
    </div>
  )
}

/** 보는 방향 버튼 + 포핸드/백핸드 전환 */
export function ViewControls({
  view,
  views,
  onView,
  backhand,
  onHand,
}: {
  view: View
  views: (View & { label: string })[]
  onView: (v: View) => void
  backhand: boolean
  onHand: (b: boolean) => void
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex rounded-full bg-court p-0.5" role="group" aria-label="포핸드 또는 백핸드">
        {[false, true].map((b) => (
          <button
            key={String(b)}
            type="button"
            aria-pressed={backhand === b}
            onClick={() => onHand(b)}
            className="rounded-full px-3 py-1.5 text-[13px] font-bold text-muted aria-pressed:bg-ink aria-pressed:text-white"
          >
            {b ? '백핸드' : '포핸드'}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="보는 방향">
        {views.map((v) => (
          <button
            key={v.label}
            type="button"
            onClick={() => onView({ yaw: v.yaw, pitch: v.pitch })}
            aria-pressed={view.yaw === v.yaw && view.pitch === v.pitch}
            className="rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold text-muted aria-pressed:border-teal aria-pressed:bg-teal-soft aria-pressed:text-teal-deep"
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  )
}
