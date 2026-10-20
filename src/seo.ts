// 검색엔진·링크 미리보기·AI가 읽는 페이지 정보. 빌드할 때 이 주소마다 정적 HTML을 만든다(scripts/prerender.mjs).
// path는 /squash/ 아래 실제 주소, hash는 앱 안에서 그 화면의 주소.

export const SITE = {
  name: '스쿼시 코트',
  url: 'https://cooperkang.github.io/squash/',
  description: '스쿼시 규칙, 샷과 기술 용어, 혼자 하는 연습법과 스트레칭, 나에게 맞는 라켓 찾기, 전국 스쿼시장 찾기, 국내외 대회 현황까지 한곳에 모은 한국어 스쿼시 안내서.',
}

export type SeoPage = { path: string; hash: string; title: string; description: string }

export const SEO_PAGES: SeoPage[] = [
  {
    path: '',
    hash: '#/',
    title: '스쿼시 코트 | 스쿼시 규칙·기술·연습·라켓·스쿼시장 찾기',
    description: SITE.description,
  },
  {
    path: 'about/',
    hash: '#/about',
    title: '스쿼시란? 처음 시작하는 사람을 위한 스쿼시 소개 | 스쿼시 코트',
    description: '스쿼시가 어떤 운동인지, 코트와 공, 처음 시작할 때 알아 둘 것과 칼로리·운동 효과를 쉽게 정리했어요.',
  },
  {
    path: 'rules/',
    hash: '#/rules',
    title: '스쿼시 규칙 한눈에 보기: 서브, 득점, 렛과 스트로크 | 스쿼시 코트',
    description: '스쿼시 경기 규칙을 그림과 함께 정리했어요. 서브 규칙과 서비스 폴트, PAR 11점제와 듀스, 아웃 라인과 틴, 렛·스트로크 판정까지.',
  },
  {
    path: 'giyeok/',
    hash: '#/giyeok',
    title: '스쿼시 ㄱ자 게임 규칙과 요령 | 스쿼시 코트',
    description: '코트 절반만 쓰는 스쿼시 미니게임 ㄱ자 게임의 규칙, 점수 내는 법, 연습 효과와 요령을 정리했어요.',
  },
  {
    path: 'shots/',
    hash: '#/shots',
    title: '스쿼시 기술 백과: 드라이브, 보스트, 드롭, 로브, 백월 샷 3D로 보기 | 스쿼시 코트',
    description: '스쿼시 샷 15가지를 3D 궤적으로 보여 주고, 포핸드·백핸드별로 치는 법을 설명해요. 스키드 보스트, 니크, 발리 등 기술 용어 사전도 있어요.',
  },
  {
    path: 'practice/',
    hash: '#/practice?tab=warmup',
    title: '스쿼시 운동 전 스트레칭: 고관절·종아리·발목 동적 스트레칭 | 스쿼시 코트',
    description: '스쿼시 치기 전 10분 동적 스트레칭. 고관절, 종아리, 허벅지, 발목, 코어를 깨우는 동작을 움직이는 그림과 따라 하기 타이머로 안내해요.',
  },
  {
    path: 'practice/drills/',
    hash: '#/practice?tab=drills',
    title: '스쿼시 혼자 연습하는 법: 공 하나로 하는 드릴 12가지 | 스쿼시 코트',
    description: '혼자 공 하나로 하는 스쿼시 연습법. 드라이브 연속, 드롭·보스트, 크로스, 8자 발리까지 3D 그림과 입문·초급·중급 팁으로 설명해요.',
  },
  {
    path: 'practice/cooldown/',
    hash: '#/practice?tab=cooldown',
    title: '스쿼시 운동 후 스트레칭과 폼롤러 루틴 | 스쿼시 코트',
    description: '스쿼시 후 종아리, 햄스트링, 고관절, 허리, 팔뚝을 푸는 정적 스트레칭과 폼롤러 사용법을 움직이는 그림으로 보여 줘요.',
  },
  {
    path: 'practice/plan/',
    hash: '#/practice?tab=plan',
    title: '스쿼시 수준별 연습 루틴과 팁 (입문·초급·중급) | 스쿼시 코트',
    description: '스쿼시 입문자, 초급자, 중급자에게 맞는 연습 팁과 혼자 하는 연습 루틴을 정리했어요.',
  },
  {
    path: 'gear/',
    hash: '#/gear',
    title: '스쿼시 장비 가이드: 라켓, 공, 신발, 고글 고르는 법 | 스쿼시 코트',
    description: '스쿼시 라켓 무게와 밸런스, 공 종류(더블 옐로 닷 등), 실내화와 고글까지 스쿼시 장비 고르는 법을 정리했어요.',
  },
  {
    path: 'finder/',
    hash: '#/finder',
    title: '스쿼시 라켓 추천: 몇 가지 질문으로 나에게 맞는 라켓 찾기 | 스쿼시 코트',
    description: '구력, 플레이 스타일, 힘과 예산을 고르면 맞는 스쿼시 라켓을 추천해요. 헤드, 테크니파이버, 던롭, 하로우 등 국내 판매 라켓 비교.',
  },
  {
    path: 'live/',
    hash: '#/live',
    title: '스쿼시 대회 일정·결과·세계 랭킹 (PSA, 국내 대회) | 스쿼시 코트',
    description: 'PSA 월드 투어 대회 일정과 최근 경기 결과, 세계 랭킹, 대한스쿼시연맹 국내 대회 일정을 자동으로 모아 보여 줘요.',
  },
  {
    path: 'courts/',
    hash: '#/courts',
    title: '전국 스쿼시장 찾기: 코트 수, 샤워·주차, 정식 코트 | 스쿼시 코트',
    description: '서울, 경기, 부산 등 전국 스쿼시장 300여 곳의 코트 수와 시설(샤워, 화장실, 주차), 공인 정식 코트, 학교·회사 전용 여부를 지역별로 찾아요.',
  },
  {
    path: 'game/',
    hash: '#/game',
    title: '스쿼시 미니 게임: 터치로 치는 스쿼시 | 스쿼시 코트',
    description: '라켓이 공을 때리는 곳을 터치해 드라이브, 크로스, 보스트, 드롭을 치는 스쿼시 게임. 실제 규칙(PAR 11)과 물리로 랠리를 해요.',
  },
]

/** 지역별 스쿼시장 정적 페이지 주소(/squash/courts/seoul/) */
export const REGION_SLUG: Record<string, string> = {
  서울: 'seoul',
  경기: 'gyeonggi',
  인천: 'incheon',
  강원: 'gangwon',
  충북: 'chungbuk',
  충남: 'chungnam',
  대전: 'daejeon',
  세종: 'sejong',
  전북: 'jeonbuk',
  전남: 'jeonnam',
  광주: 'gwangju',
  경북: 'gyeongbuk',
  경남: 'gyeongnam',
  대구: 'daegu',
  울산: 'ulsan',
  부산: 'busan',
  제주: 'jeju',
}

/** 정적 주소(/squash/rules/)로 들어오면 앱의 해시 주소로 바꾼다 */
export function hashForPath(pathname: string, base: string) {
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : ''
  if (!rest) return null
  const path = rest.endsWith('/') ? rest : `${rest}/`
  return SEO_PAGES.find((p) => p.path === path)?.hash ?? null
}
