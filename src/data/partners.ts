// 소모품 상담에 붙이는 쿠팡 파트너스 상품. 목록은 partners.json에서 손으로 고친다(코드를 몰라도 됨).
// url은 파트너스 사이트의 링크 생성으로 만든 https://link.coupang.com/... 주소만 쓴다(kit.test.ts가 확인).
import data from './partners.json'

export type PartnerKey = keyof typeof data
export type PartnerItem = { name: string; url: string; note: string }

export const PARTNERS: Record<PartnerKey, { label: string; search: string; items: PartnerItem[] }> = data

/** 경제적 이해관계 표시. 쿠팡 권장 문구 그대로, 페이지 첫 부분과 링크 묶음 위에 쓴다 */
export const DISCLOSURE = '이 게시물은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.'

const isPartnerUrl = (url: string) => url.startsWith('https://link.coupang.com/')

/** 상담에 걸린 키 순서대로, 파트너스 링크가 있는 상품만 최대 max개(아직 안 바꾼 일반 쿠팡 주소는 감춘다) */
export function picksFor(keys: PartnerKey[], max = 3) {
  return keys
    .flatMap((key) => PARTNERS[key].items.filter((it) => isPartnerUrl(it.url)).map((it) => ({ ...it, key })))
    .slice(0, max)
}
