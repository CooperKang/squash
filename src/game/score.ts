// PAR 11: 랠리를 이긴 쪽이 1점과 서브권을 가져간다. 10:10부터는 2점 차가 나야 끝난다
export type Score = { you: number; cpu: number }

export function winner(s: Score): 'you' | 'cpu' | null {
  const top = Math.max(s.you, s.cpu)
  if (top < 11 || Math.abs(s.you - s.cpu) < 2) return null
  return s.you > s.cpu ? 'you' : 'cpu'
}

export type Status = 'deuce' | 'game-ball-you' | 'game-ball-cpu' | null

/** 듀스(10:10부터 동점) 또는 다음 1점이면 끝나는 게임볼 */
export function status(s: Score): Status {
  if (winner(s)) return null
  if (s.you >= 10 && s.you === s.cpu) return 'deuce'
  if (s.you >= 10 && s.you > s.cpu) return 'game-ball-you'
  if (s.cpu >= 10 && s.cpu > s.you) return 'game-ball-cpu'
  return null
}
