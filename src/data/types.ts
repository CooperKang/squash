export type Style = 'power' | 'control' | 'speed' | 'allround' | 'junior'
export type Level = 'beg' | 'mid' | 'adv' | 'all' | 'junior'

export type Racket = {
  id: string
  brand: string
  model: string
  line: string
  style: Style
  level: Level
  weightG: number | null
  priceKRW: number
  listPriceKRW: number | null
  url: string
  image: string
}

export const STYLE_LABEL: Record<Style, string> = {
  power: '파워',
  control: '컨트롤',
  speed: '스피드',
  allround: '올라운드',
  junior: '주니어',
}

export const LEVEL_LABEL: Record<Level, string> = {
  beg: '입문',
  mid: '중급',
  adv: '상급',
  all: '전 레벨',
  junior: '어린이',
}
