import { aimAt, simulate, type Sim, type Vec } from './physics'
import { newShot, plan, type ShotKind } from './shots'

// 혼자 연습처럼 여러 샷이 이어지는 장면: 한 샷이 끝나 공을 칠 수 있는 곳에서 다음 샷을 친다.

/** 다음 샷을 칠 곳: 한 번 튄 뒤 내려오는 공(bounce) 또는 바닥에 닿기 전 공중(volley) */
export type HitAt = { mode: 'bounce' | 'volley'; y?: [number, number] }

export type Step =
  | { label: string; kind: ShotKind; hit?: HitAt }
  // 나에게 다시 돌아오게 치는 샷(연속 드라이브, 피드 등): 앞벽 조준 범위와 다음에 칠 자리
  | { label: string; to: { x: number; z: number }; front: { x: [number, number]; y: [number, number] }; speed: [number, number]; hit: HitAt }

export type Segment = { label: string; sim: Sim; from: Vec; end: number }

function seeded(text: string) {
  let seed = [...text].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 4294967296, 11)
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

/** 궤적에서 다음에 칠 수 있는 점들 */
function hitPoints(sim: Sim, at: HitAt) {
  const frontT = sim.events.find((e) => e.hit === 'front' && e.afterFront)?.t ?? Infinity
  const floors = sim.events.filter((e) => e.hit === 'floor' && e.afterFront)
  const f1 = floors[0]?.t ?? Infinity
  const f2 = floors[1]?.t ?? Infinity
  const [lo, hi] = at.y ?? (at.mode === 'volley' ? [1.0, 2.0] : [0.35, 1.0])
  const pts = sim.points
  return pts.filter((p, i) => {
    if (p.t <= frontT || p.t >= f2) return false
    if (p.p.y < lo || p.p.y > hi) return false
    if (at.mode === 'volley') return p.t < f1
    const prev = pts[i - 1]
    return p.t > f1 && prev && prev.p.y > p.p.y // 튄 뒤 내려오는 공
  })
}

const mirror = (v: Vec, flip: boolean): Vec => (flip ? { ...v, x: -v.x } : v)

/**
 * 연습 장면을 만든다. backhand면 좌우를 뒤집는다(오른손잡이 백핸드 = 왼쪽).
 * 각 샷은 다음 샷을 칠 때까지만 그리고, 마지막 샷은 두 번째 바운드까지 그린다.
 */
export function buildSequence(id: string, start: Vec, steps: Step[], backhand = false): Segment[] {
  const rand = seeded(id + (backhand ? 'b' : 'f'))
  const out: Segment[] = []
  let from = mirror(start, backhand)
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const last = i === steps.length - 1
    let sim: Sim | null = null
    let next: { p: Vec; t: number } | null = null

    if ('kind' in step) {
      const serve = step.kind.startsWith('serve')
      for (const p of plan(step.kind, from, { by: 'you', serve, samples: 700, rand })) {
        const s = simulate({ p: { ...from }, v: p.v }, newShot('you', step.kind, from, serve), 6, 1 / 240, true)
        const h = hitPoints(s, step.hit ?? { mode: 'bounce' })
        if (last || h.length) {
          sim = s
          next = h[0] ?? null
          break
        }
      }
    } else {
      const to = mirror({ x: step.to.x, y: 0, z: step.to.z }, backhand)
      let best = Infinity
      for (let k = 0; k < 500; k++) {
        const fx = step.front.x[0] + rand() * (step.front.x[1] - step.front.x[0])
        const fy = step.front.y[0] + rand() * (step.front.y[1] - step.front.y[0])
        const speed = step.speed[0] + rand() * (step.speed[1] - step.speed[0])
        const v = aimAt(from, { x: backhand ? -fx : fx, y: fy, z: 0 }, speed)
        const s = simulate({ p: { ...from }, v }, newShot('you', 'drive', from), 6, 1 / 240, true)
        if (s.result !== 'double') continue
        for (const h of hitPoints(s, step.hit)) {
          const d = Math.hypot(h.p.x - to.x, h.p.z - to.z)
          if (d < best) {
            best = d
            sim = s
            next = h
          }
        }
      }
      if (best > 1.2) sim = null // 돌아오게 치는 공을 못 찾음
    }

    if (!sim) break
    const end = !last && next ? next.t : (sim.events.filter((e) => e.hit === 'floor' && e.afterFront)[1]?.t ?? sim.duration)
    // 좌우를 뒤집으면 포핸드와 백핸드도 바뀐다
    const label = backhand ? step.label.replace(/포핸드|백핸드/g, (m) => (m === '포핸드' ? '백핸드' : '포핸드')) : step.label
    out.push({ label, sim, from, end })
    if (!next) break
    from = { ...next.p }
  }
  return out
}
