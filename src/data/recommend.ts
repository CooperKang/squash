import type { Racket, Style } from './types'

export type Answers = {
  level: 'beg' | 'mid' | 'adv'
  style: Exclude<Style, 'junior'>
  feel: 'light' | 'stable'
  budget: number // 원, 0이면 상관없음
}

// 무게 기준(프레임 무게, g). 가벼울수록 빠르고 무거울수록 안정적이다
const IDEAL_WEIGHT: Record<Answers['level'], Record<Answers['feel'], number>> = {
  beg: { light: 125, stable: 130 },
  mid: { light: 115, stable: 125 },
  adv: { light: 110, stable: 120 },
}

const STYLE_NEAR: Record<Style, Style[]> = {
  power: ['allround'],
  control: ['allround'],
  speed: ['allround', 'control'],
  allround: ['power', 'control', 'speed'],
  junior: [],
}

export type Scored = { racket: Racket; score: number; reasons: string[] }

export function scoreRacket(r: Racket, a: Answers): Scored {
  const reasons: string[] = []
  if (r.style === 'junior') return { racket: r, score: -999, reasons }
  let score = 0

  if (r.style === a.style) {
    score += 40
    reasons.push(`${styleWord(a.style)} 성향 라인`)
  } else if (STYLE_NEAR[a.style].includes(r.style)) score += 18

  if (r.weightG != null) {
    const diff = Math.abs(r.weightG - IDEAL_WEIGHT[a.level][a.feel])
    score += Math.max(0, 30 - diff * 2.5)
    if (diff <= 5) reasons.push(`${r.weightG}g, ${a.feel === 'light' ? '가볍게 휘두르기 좋은' : '안정감 있는'} 무게`)
  } else score += 8

  if (r.level === 'all' || r.level === a.level) {
    score += 20
    if (r.level === a.level) reasons.push(`${a.level === 'beg' ? '입문자' : a.level === 'mid' ? '중급자' : '상급자'}에게 맞는 라인`)
  } else if (a.level === 'beg' && r.level === 'adv') score -= 15
  else score += 6

  if (a.budget > 0) {
    if (r.priceKRW <= a.budget) {
      score += 10
    } else score -= Math.min(40, ((r.priceKRW - a.budget) / 10000) * 4)
  }
  if (r.listPriceKRW && r.listPriceKRW > r.priceKRW) {
    score += 2
    reasons.push(`${Math.round((1 - r.priceKRW / r.listPriceKRW) * 100)}% 할인 중`)
  }
  return { racket: r, score, reasons }
}

export function recommend(rackets: Racket[], a: Answers, count = 6): Scored[] {
  const seen = new Set<string>()
  return rackets
    .map((r) => scoreRacket(r, a))
    .filter((s) => s.score > 0)
    .sort((x, y) => y.score - x.score || x.racket.priceKRW - y.racket.priceKRW)
    .filter((s) => {
      // 같은 라인·같은 무게의 색상 차이 모델은 하나만 보여 준다
      const key = `${s.racket.brand}|${s.racket.line}|${s.racket.weightG}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, count)
}

function styleWord(s: Style) {
  return { power: '파워', control: '컨트롤', speed: '스피드', allround: '올라운드', junior: '주니어' }[s]
}
