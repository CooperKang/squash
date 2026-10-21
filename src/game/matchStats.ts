export type PlayerSummary = {
  distance: number
  calories: number
  restCalories: number
  activeCalories: number
  spent: number
  recovered: number
}
export type MatchSummary = {
  mode: 'classic' | 'realistic'
  seconds: number
  rallySeconds: number
  hits: number
  points: number
  bestRally: number
  you: PlayerSummary
  cpu: PlayerSummary
}

export function rallySummary(total: MatchSummary, start: MatchSummary, hits: number): MatchSummary {
  const delta = (a: PlayerSummary, b: PlayerSummary) => Object.fromEntries(Object.entries(a).map(([key, value]) => [key, Math.max(0, value - b[key as keyof PlayerSummary])])) as PlayerSummary
  const seconds = Math.max(0, total.rallySeconds - start.rallySeconds)
  return { mode: total.mode, seconds, rallySeconds: seconds, hits, points: 1, bestRally: hits, you: delta(total.you, start.you), cpu: delta(total.cpu, start.cpu) }
}

export const formatDuration = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds + 1e-6))
  return `${Math.floor(whole / 60)}분 ${whole % 60}초`
}
