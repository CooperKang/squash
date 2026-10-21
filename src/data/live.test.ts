import { describe, expect, it } from 'vitest'
import { findVideo, isStale, type Match, type Video } from './live'

const match = (a: string, b: string, date = '2026-10-16T18:00:00Z'): Match => ({
  id: 1,
  tournament: 'CIB Egyptian Squash Open 2026',
  round: 'Final',
  date,
  players: [
    { name: a, country: 'EGY', games: 3, scores: [] },
    { name: b, country: 'PER', games: 2, scores: [] },
  ],
})

const videos: Video[] = [
  { id: 'a', title: '🇪🇬 Orfi v El Hammamy 🇪🇬 | Egyptian Open 2026 | FINAL HIGHLIGHTS', published: '2026-10-17T08:45:20+00:00' },
  { id: 'b', title: '🇪🇬 Asal v Elias 🇵🇪 | Egyptian Open 2026 | FINAL HIGHLIGHTS', published: '2026-10-17T08:45:17+00:00' },
  { id: 'c', title: 'COURTSIDE: Rivalries Renewed 🔥 Orfi V El Hammamy and Elias V Asal 🤯', published: '2026-10-16T16:03:17+00:00' },
]

describe('findVideo', () => {
  it('두 선수 성이 모두 들어간 하이라이트를 찾는다(악센트 무시)', () => {
    expect(findVideo(match('Mostafa Asal', 'Diego Elías'), videos)?.id).toBe('b')
    expect(findVideo(match('Amina Orfi', 'Hania El Hammamy'), videos)?.id).toBe('a')
  })

  it('경기 전에 올라온 프리뷰는 고르지 않는다', () => {
    expect(findVideo(match('Mostafa Asal', 'Diego Elias', '2026-10-17T07:00:00Z'), videos.slice(2))).toBeNull()
  })

  it('한 달 지난 같은 대진 영상은 고르지 않는다', () => {
    expect(findVideo(match('Mostafa Asal', 'Diego Elias', '2026-09-01T18:00:00Z'), videos)).toBeNull()
  })

  it('이름이 없는 선수가 있으면 찾지 않는다', () => {
    expect(findVideo(match('Mostafa Asal', '미정'), videos)).toBeNull()
  })
})

describe('isStale', () => {
  const now = Date.parse('2026-10-21T00:00:00Z')

  it('7일 안에 갱신된 파일은 그대로 보여준다', () => {
    expect(isStale('2026-10-14T12:00:00Z', now)).toBe(false)
  })

  it('7일 넘게 갱신되지 않았거나 시각이 없으면 멈춘 것으로 본다', () => {
    expect(isStale('2026-10-13T23:00:00Z', now)).toBe(true)
    expect(isStale(undefined, now)).toBe(true)
  })
})
