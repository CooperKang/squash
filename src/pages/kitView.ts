import { KIT_GROUPS, KIT_TIPS, type KitGroupId } from '../data/kit'

/** 주소의 g(품목)·c(상담) 값으로 보여 줄 품목과 스크롤할 상담을 정한다. 없는 값은 무시한다 */
export function kitView(g: string | null, c: string | null): { group: KitGroupId | 'all'; focus: string | null } {
  const tip = KIT_TIPS.find((t) => t.id === c)
  if (tip) return { group: tip.group, focus: tip.id }
  const group = KIT_GROUPS.find((x) => x.id === g)?.id
  return { group: group ?? 'all', focus: null }
}
