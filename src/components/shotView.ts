import type { Sim, Vec } from '../game/physics'

export type View = { yaw: number; pitch: number }

/** 바닥에 놓는 수건·테이프(게임 좌표: x 가운데 0, z 앞벽 0) */
export type FloorTarget = { x0: number; x1: number; z0: number; z1: number; label?: string }
export const VIEWS: Record<'diag' | 'back' | 'side' | 'top', View & { label: string }> = {
  diag: { yaw: 0.62, pitch: 0.38, label: '비스듬히' },
  back: { yaw: 0, pitch: 0.2, label: '뒤에서' },
  side: { yaw: Math.PI / 2, pitch: 0.12, label: '옆에서' },
  top: { yaw: 0.0001, pitch: 1.5, label: '위에서' },
}

export const HIT_NAME = { front: '앞벽', side: '옆벽', back: '뒷벽', floor: '바닥' } as const

/** 공이 닿은 곳 목록(앞벽에 맞기 전의 벽부터 두 번째 바운드까지, end초까지만) */
export function contacts(sim: Sim, end = Infinity) {
  const out: { hit: keyof typeof HIT_NAME; at: Vec; t: number; label: string }[] = []
  let floors = 0
  for (const e of sim.events) {
    if (e.t > end + 1e-9) break
    if (e.hit === 'floor' && e.afterFront) floors++
    const h = e.at.y < 0.25 && e.hit !== 'floor' ? '닉 근처' : `${e.at.y.toFixed(1)}m`
    out.push({ hit: e.hit, at: e.at, t: e.t, label: e.hit === 'floor' ? `${floors}번째 바운드` : `${HIT_NAME[e.hit]} ${h}` })
    if (floors >= 2) break
  }
  return out
}

