import { useEffect, useState } from 'react'

// 바닥 좌표(m): x는 왼쪽 옆벽 0 ~ 오른쪽 6.4, z는 앞벽 0 ~ 뒷벽 9.75. 앞벽에 맞는 점은 높이 h도 함께
export type Contact = 'start' | 'front' | 'side' | 'back' | 'floor' | 'nick'
export type PathPoint = { x: number; z: number; h?: number; kind: Contact }
export type Target = { x: number; z: number; w: number; d: number; label?: string }

const W = 6.4
const L = 9.75
const WALL = 4.9 // 앞벽은 이 높이까지 그린다

const KIND_LABEL: Record<Contact, string> = {
  start: '치는 곳',
  front: '앞벽',
  side: '옆벽',
  back: '뒷벽',
  floor: '바닥',
  nick: '닉',
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const m = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return reduced
}

/**
 * 앞벽을 위로 펼치고 그 아래에 위에서 본 바닥을 붙인 그림.
 * 공이 지나간 길과 벽·바닥에 닿은 순서를 보여 주고, 공이 그 길을 따라 움직인다.
 */
export function CourtPath({ points, targets = [], label, className = '' }: { points: PathPoint[]; targets?: Target[]; label: string; className?: string }) {
  const reduced = useReducedMotion()
  const S = 24
  const top = WALL * S
  const X = (m: number) => m * S
  const Z = (m: number) => top + m * S
  const H = (h: number) => top - h * S
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Z(p.z).toFixed(1)}`).join(' ')
  const len = points.reduce((s, p, i) => (i ? s + Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z) : 0), 0)
  const dur = Math.max(1.6, len / 7)
  const fronts = points.filter((p) => p.kind === 'front' && p.h != null)
  const start = points[0]

  return (
    <svg viewBox={`-26 -16 ${X(W) + 52} ${Z(L) + 34}`} className={`block w-full ${className}`} role="img" aria-label={label}>
      {/* 앞벽(펼친 모습) */}
      <rect x="0" y="0" width={X(W)} height={top} fill="#f6f7f7" stroke="#141618" strokeWidth="1.5" />
      <rect x="0" y={H(0.48)} width={X(W)} height={0.48 * S} fill="#d4d6d6" />
      {[0.48, 1.78, 4.57].map((h) => (
        <line key={h} x1="0" x2={X(W)} y1={H(h)} y2={H(h)} stroke="#c8402f" strokeWidth={h === 0.48 ? 2 : 1.5} />
      ))}
      <text x={-6} y={H(0.48) + 4} textAnchor="end" fontSize="9" fill="#5e6668">
        틴
      </text>
      <text x={-6} y={H(1.78) + 3} textAnchor="end" fontSize="9" fill="#5e6668">
        서브
      </text>
      <text x={-6} y={H(4.57) + 3} textAnchor="end" fontSize="9" fill="#5e6668">
        아웃
      </text>
      <text x={X(W / 2)} y={-5} textAnchor="middle" fontSize="10" fill="#5e6668">
        앞벽
      </text>

      {/* 바닥 */}
      <rect x="0" y={top} width={X(W)} height={L * S} fill="#ecdcbc" />
      <line x1="0" x2={X(W)} y1={Z(5.44)} y2={Z(5.44)} stroke="#c8402f" strokeWidth="1.5" />
      <line x1={X(W / 2)} x2={X(W / 2)} y1={Z(5.44)} y2={Z(L)} stroke="#c8402f" strokeWidth="1.5" />
      {[0, W - 1.6].map((x) => (
        <rect key={x} x={X(x)} y={Z(5.44)} width={1.6 * S} height={1.6 * S} fill="none" stroke="#c8402f" strokeWidth="1.5" />
      ))}
      <rect x="0" y={top} width={X(W)} height={L * S} fill="none" stroke="#141618" strokeWidth="2" />
      <text x={X(W / 2)} y={Z(L) + 14} textAnchor="middle" fontSize="10" fill="#5e6668">
        뒷벽
      </text>

      {targets.map((t, i) => (
        <g key={i}>
          <rect x={X(t.x)} y={Z(t.z)} width={t.w * S} height={t.d * S} fill="rgb(242 194 48 / 0.35)" stroke="#b8901a" strokeWidth="1.5" strokeDasharray="4 3" rx="3" />
          {t.label && (
            <text x={X(t.x + t.w / 2)} y={Z(t.z + t.d / 2) + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill="#6b5310">
              {t.label}
            </text>
          )}
        </g>
      ))}

      {/* 앞벽에 맞은 높이: 바닥 그림의 앞벽 지점과 점선으로 잇는다 */}
      {fronts.map((p, i) => (
        <g key={i}>
          <line x1={X(p.x)} x2={X(p.x)} y1={H(p.h!)} y2={top} stroke="#00707d" strokeWidth="1.2" strokeDasharray="3 3" />
          <circle cx={X(p.x)} cy={H(p.h!)} r="6" fill="#ffffff" stroke="#00707d" strokeWidth="2.5" />
        </g>
      ))}

      <path d={d} fill="none" stroke="#00707d" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />

      {points.slice(1).map((p, i) => (
        <g key={i}>
          {p.kind === 'floor' ? (
            <circle cx={X(p.x)} cy={Z(p.z)} r="4" fill="#141618" />
          ) : p.kind === 'nick' ? (
            <circle cx={X(p.x)} cy={Z(p.z)} r="6" fill="#c8402f" stroke="#fff" strokeWidth="1.5" />
          ) : (
            <circle cx={X(p.x)} cy={Z(p.z)} r="5" fill="#ffffff" stroke="#00707d" strokeWidth="2.5" />
          )}
          <text
            x={X(p.x) + (p.x > W - 1 ? -9 : 9)}
            y={Z(p.z) + (p.kind === 'front' ? 13 : 4)}
            textAnchor={p.x > W - 1 ? 'end' : 'start'}
            fontSize="9.5"
            fontWeight="700"
            fill="#141618"
          >
            {i + 1}
          </text>
        </g>
      ))}

      {/* 치는 사람 */}
      <circle cx={X(start.x)} cy={Z(start.z)} r="9" fill="#141618" />
      <text x={X(start.x)} y={Z(start.z) + 3.5} textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff">
        나
      </text>

      {!reduced && (
        <circle r="5" fill="#141618" stroke="#f2c230" strokeWidth="1.5">
          <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={d} />
        </circle>
      )}
    </svg>
  )
}

/** 그림 아래에 붙이는 순서 설명: 1 앞벽(틴 위 낮게) → 2 바닥 … */
export function PathLegend({ points }: { points: PathPoint[] }) {
  return (
    <ol className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
      {points.slice(1).map((p, i) => (
        <li key={i}>
          <b className="text-ink">{i + 1}</b> {KIND_LABEL[p.kind]}
          {p.kind === 'front' && p.h != null ? ` ${p.h.toFixed(1)}m` : ''}
        </li>
      ))}
    </ol>
  )
}
