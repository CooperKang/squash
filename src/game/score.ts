// PAR 11: 랠리를 이긴 쪽이 1점과 서브권을 가져간다. 10:10부터는 2점 차가 나야 끝난다
export type Score = { you: number; cpu: number }

export function winner(s: Score): 'you' | 'cpu' | null {
  const top = Math.max(s.you, s.cpu)
  if (top < 11 || Math.abs(s.you - s.cpu) < 2) return null
  return s.you > s.cpu ? 'you' : 'cpu'
}
