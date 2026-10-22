# 소모품 상담 설계

2026-10-22

## 목적

스쿼시를 치며 생기는 고민(손에 땀이 많다, 발목이 약하다, 그립이 얇았으면 좋겠다 등)에 스쿼시 선생님이 상담해 주듯 답하는 팁 콘텐츠를 만든다. 팁을 따르는 데 필요한 소모품에는 쿠팡 파트너스 링크를 붙여 수익을 낸다.

- 주인공은 팁이다. 쇼핑몰처럼 상품을 늘어놓지 않는다. 상담 하나에 링크는 1~2개.
- 쿠팡 파트너스 최종 승인에 낼 "링크가 게시된 페이지" 스크린샷도 이 화면으로 찍는다.
- 라켓 구매는 지금처럼 영산스포츠(라켓 찾기)로 연결하고, 쿠팡은 소모품에만 쓴다.

## 위치와 주소

- 새 화면 `kit`(이름 "소모품 상담", 짧은 이름 "소모품"), `parent: 'gear'`. 장비 섹션 탭이 `장비 | 라켓 찾기 | 소모품 상담`이 된다.
- 앱 주소: `#/kit`, 품목 `#/kit?g=grip`, 상담 하나 `#/kit?c=sweat-hand`(해당 상담으로 스크롤, 공유용).
- 정적 페이지(`src/seo.ts`의 `SEO_PAGES`에 추가, `scripts/prerender.mjs`가 만든다):
  - `kit/` 고민 모아보기
  - `kit/grip/` 그립
  - `kit/shoes/` 신발
  - `kit/sweat/` 머리띠·손목밴드
  - `kit/protect/` 보호안경·발목 보호대
  - `kit/recovery/` 폼롤러·공

## 화면

1. 머리말(`PageHead`): "치다 보면 생기는 고민, 소모품으로 풀리는 것들" 정도의 소개와 대가성 문구 한 줄.
2. 고민 칩: "나는…" 아래에 고민 칩을 늘어놓는다. 누르면 해당 상담으로 스크롤하고 주소의 `c`를 바꾼다.
3. 품목 탭: 전체 / 그립 / 신발 / 땀 / 보호 / 회복. 고르면 `g`를 바꾼다.
4. 상담 카드(품목별로 묶음):
   - **Q.** 고민을 사용자 말투로("레슨 30분만 지나면 라켓이 손에서 돌아요")
   - **A.** 선생님 말투의 답(공감 → 이유 → 해결). 2~4문장.
   - **이렇게 해 보세요**: 물건 없이 할 수 있는 실천 팁 1~3개
   - **고를 때 볼 것**: 기준(예: 드라이·흡수형, 두께 0.6mm 안팎)과 링크 1~2개("쿠팡에서 보기 ↗")
5. 링크 묶음 바로 옆에 작은 대가성 문구.
6. 맨 아래: 장비 고르기, 라켓 찾기로 가는 연결.

## 초기 상담 목록

| id | 품목 | Q | 링크 키 |
|---|---|---|---|
| sweat-hand | grip | 손에 땀이 많아 라켓이 돌아요 | grip-towel, grip-dry |
| thin-grip | grip | 얇게 쥐는 게 좋아요 | grip-dry |
| thick-grip | grip | 손이 커서 그립이 가늘게 느껴져요 | grip-tacky |
| grip-change | grip | 그립은 언제 갈아요? | grip-replacement |
| weak-ankle | shoes | 발목에 힘이 없어 자주 접질려요 | shoes-court, ankle-brace |
| running-shoes | shoes | 러닝화 신고 쳐도 돼요? | shoes-court |
| wide-foot | shoes | 발볼이 넓어 코트화가 아파요 | shoes-wide |
| sweat-eyes | sweat | 땀이 눈에 들어가요 | headband |
| sweat-wrist | sweat | 손목 타고 땀이 흘러요 | wristband |
| eye-guard | protect | 공에 맞을까 무서워요 | goggles |
| sore-calf | recovery | 다음 날 종아리가 뭉쳐요 | foam-roller |
| dead-ball | recovery | 공이 안 튀어서 랠리가 안 돼요 | ball |

그립 상담의 핵심 내용:
- 땀이 많으면: 끈적(택키)형은 젖으면 오히려 미끄럽다. 타월형이나 드라이(흡수)형, 자주 교체.
- 얇은 그립이 좋으면: 원그립(기본 그립)을 벗기고 얇은 그립이나 오버그립 한 겹만.
- 두꺼운 그립이 좋으면: 원그립은 두고 그 위에 오버그립을 덧감는다.

## 데이터

- `src/data/kit.ts`
  - `KIT_GROUPS`: `{ id: 'grip' | 'shoes' | 'sweat' | 'protect' | 'recovery'; label; path }`
  - `KIT_TIPS`: `{ id; group; chip; q; a; tries: string[]; look: string; links: PartnerKey[] }`
- `src/data/partners.ts`
  - `PARTNER_LINKS: Record<PartnerKey, string>`: 링크 키 → 쿠팡 파트너스가 만들어 준 짧은 링크(`https://link.coupang.com/...`).
  - `PARTNER_LABELS: Record<PartnerKey, string>`: 버튼에 쓸 짧은 이름("타월 그립").
  - `DISCLOSURE`: "이 글에는 쿠팡 파트너스 링크가 있어요. 링크로 구매하시면 일정액의 수수료를 받아요."
  - 링크는 파트너스 사이트의 링크 생성으로 만든 것만 쓴다. 파트너스 코드로 주소를 직접 조립하지 않는다(추적이 보장되지 않음).
  - 링크가 빈 문자열이면 버튼만 감추고 팁은 그대로 보여 준다.

## 링크

- `<a href target="_blank" rel="sponsored nofollow noopener">`. 스타일은 기존 바깥 링크(라켓 찾기의 구매 링크)를 따른다.
- 대가성 문구는 머리말과 각 링크 묶음 옆에 둔다.

## 기존 화면에서 연결

- 장비(`Gear.tsx`)의 그립·신발·보호안경 카드 → `#/kit?g=grip` 등.
- 혼자 연습 > 운동 후 스트레칭의 폼롤러 설명 → `#/kit?c=sore-calf`.
- 라켓 찾기 결과 아래 → "그립 고민 상담" `#/kit?g=grip`.

## 테스트

- `src/data/kit.test.ts`
  - 모든 상담의 `links`가 `PARTNER_LINKS`에 있다.
  - 상담 id와 칩이 겹치지 않는다.
  - 모든 품목에 상담이 하나 이상 있고 `SEO_PAGES`에 품목 페이지가 있다.
  - 비어 있지 않은 링크는 `https://link.coupang.com/`로 시작한다.
- `npm run build` 뒤 `dist/kit/index.html`에 대가성 문구와 `rel="sponsored`가 들어 있는지 확인.

## 범위 밖

- 결혼 준비 사이트: 이 틀이 자리 잡은 뒤 따로 설계한다.
- 쿠팡 파트너스 API 연동(최종 승인 뒤 검토).
- 상품 가격·사진 표시(정책상 API로 받아야 하고, 팁 중심이라는 목적과도 맞지 않음).
