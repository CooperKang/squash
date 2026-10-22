// 빌드한 앱의 화면마다 정적 HTML을 만든다. 네이버처럼 자바스크립트를 잘 돌리지 않는 검색엔진과
// AI 크롤러도 내용을 읽을 수 있게 하고, 주소마다 제목·설명·미리보기 이미지를 단다.
// 순서: vite build → vite build --ssr src/entry-server.tsx --outDir dist-ssr → node scripts/prerender.mjs
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const DIST = 'dist'
const ssr = await import(pathToFileURL(join(process.cwd(), 'dist-ssr/entry-server.js')).href)
const { SEO_PAGES, SITE, REGION_SLUG: REGIONS, GLOSSARY, CATEGORIES, WARMUP, COOLDOWN, FOAM_ROLLER, DISCLOSURE, render } = ssr

const template = await readFile(join(DIST, 'index.html'), 'utf8')
const courts = JSON.parse(await readFile(join(DIST, 'data/courts.json'), 'utf8'))
const today = new Date().toISOString().slice(0, 10)
const OG = { url: `${SITE.url}og.png`, w: 1200, h: 630, alt: '스쿼시 코트: 규칙, 기술, 연습, 라켓, 스쿼시장 찾기' }

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const jsonLd = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`

const WEBSITE = {
  '@type': 'WebSite',
  '@id': `${SITE.url}#website`,
  name: SITE.name,
  alternateName: ['SQUASH COURT', '스쿼시코트'],
  url: SITE.url,
  description: SITE.description,
  inLanguage: 'ko-KR',
  author: { '@type': 'Person', name: 'JaeHa Kang', url: 'https://github.com/CooperKang' },
}

function head({ title, description, url, crumbs = [] }) {
  const graph = [
    WEBSITE,
    { '@type': 'WebPage', '@id': `${url}#page`, url, name: title, description, inLanguage: 'ko-KR', isPartOf: { '@id': `${SITE.url}#website` }, dateModified: today },
  ]
  if (crumbs.length)
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [{ name: SITE.name, url: SITE.url }, ...crumbs].map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
    })
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE.name}" />`,
    `<meta property="og:locale" content="ko_KR" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${OG.url}" />`,
    `<meta property="og:image:width" content="${OG.w}" />`,
    `<meta property="og:image:height" content="${OG.h}" />`,
    `<meta property="og:image:alt" content="${OG.alt}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${OG.url}" />`,
    `<link rel="sitemap" type="application/xml" href="${SITE.url}sitemap.xml" />`,
    `<link rel="alternate" type="text/plain" title="llms.txt" href="${SITE.url}llms.txt" />`,
    jsonLd({ '@context': 'https://schema.org', '@graph': graph }),
  ].join('\n    ')
}

const withHead = (html, h) => html.replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, h)

async function write(path, html) {
  const file = join(DIST, path, 'index.html')
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, html)
}

/** 그린 화면에서 본문 글만 뽑는다(llms-full.txt용) */
function textOf(html) {
  const main = html.match(/<main>([\s\S]*)<\/main>/)?.[1] ?? html
  return main
    .replace(/<(svg|script|style|button|canvas)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<h([1-3])[^>]*>/g, (_, n) => `\n\n${'#'.repeat(Number(n) + 1)} `)
    .replace(/<\/(p|li|h[1-6]|div|tr|section|dt|dd)>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ---------- 앱 화면 ----------
const urls = []
const texts = []
for (const page of SEO_PAGES) {
  const url = SITE.url + page.path
  let body = ''
  try {
    body = render(page.hash, { 'courts.json': courts })
  } catch (e) {
    console.warn(`미리 그리기 실패(빈 화면으로 둠): ${page.path || '/'} ${e.message}`)
  }
  const crumbs = page.path ? [{ name: page.title.split(' | ')[0], url }] : []
  const html = withHead(template, head({ title: page.title, description: page.description, url, crumbs })).replace('<div id="root"></div>', `<div id="root">${body}</div>`)
  await write(page.path, html)
  urls.push({ url, priority: page.path ? 0.8 : 1 })
  if (body) texts.push({ page, url, text: textOf(body) })
}
// 없는 주소는 앱 껍데기로(앱이 처음 화면을 연다)
await writeFile(join(DIST, '404.html'), withHead(template, head({ title: SEO_PAGES[0].title, description: SITE.description, url: SITE.url })))

// ---------- 지역별 스쿼시장(정적 페이지) ----------
const FAC = { shower: '샤워', toilet: '화장실', parking: '주차', locker: '락커' }
const ACCESS = { 학교: '학교 시설(외부인 이용 제한 가능)', 회사: '회사 전용', 아파트: '아파트 주민 시설', 기관: '기관 시설' }

function courtRow(c) {
  const facts = [
    c.courts ? `코트 ${c.courts}면` : null,
    c.certified ? '대한스쿼시연맹 공인(정식 규격)' : c.nonstandard ? '정식 규격 아님' : null,
    c.type,
    c.access ? (ACCESS[c.access] ?? c.access) : null,
    c.capacity ? `수용 ${c.capacity}명` : null,
    Object.entries(c.facilities ?? {})
      .filter(([, v]) => v)
      .map(([k]) => FAC[k])
      .join('·') || null,
  ].filter(Boolean)
  return { facts, line: `${c.name}${c.address ? ` (${c.address})` : ''}: ${facts.join(', ') || '정보 없음'}${c.phone ? `, 전화 ${c.phone}` : ''}` }
}

const regionLinks = []
for (const [ko, slug] of Object.entries(REGIONS)) {
  const list = courts.courts.filter((c) => c.region === ko).sort((a, b) => (b.courts ?? 0) - (a.courts ?? 0) || a.name.localeCompare(b.name, 'ko'))
  if (!list.length) continue
  const url = `${SITE.url}courts/${slug}/`
  const title = `${ko} 스쿼시장 ${list.length}곳: 코트 수, 시설, 정식 코트 | ${SITE.name}`
  const description = `${ko} 지역 스쿼시장 ${list.length}곳의 주소, 코트 수, 샤워·주차 등 시설, 공인 정식 코트와 학교·회사 전용 여부를 정리했어요.`
  const items = list
    .map((c) => {
      const { facts } = courtRow(c)
      return `<li><h2>${esc(c.name)}</h2>${c.address ? `<p class="addr">${esc(c.address)}</p>` : ''}${facts.length ? `<p>${facts.map((f) => `<span>${esc(f)}</span>`).join('')}</p>` : ''}${c.phone ? `<p class="addr">전화 ${esc(c.phone)}</p>` : ''}</li>`
    })
    .join('\n')
  const others = Object.entries(REGIONS)
    .filter(([k]) => k !== ko && courts.courts.some((c) => c.region === k))
    .map(([k, s]) => `<a href="../${s}/">${k}</a>`)
    .join(' ')
  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="${SITE.url}favicon.svg" />
    ${head({
      title,
      description,
      url,
      crumbs: [
        { name: '전국 스쿼시장 찾기', url: `${SITE.url}courts/` },
        { name: `${ko} 스쿼시장`, url },
      ],
    })}
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
    <style>
      body { margin: 0; background: #e9eceb; color: #141618; font-family: 'Pretendard Variable', Pretendard, system-ui, sans-serif; word-break: keep-all; }
      main { max-width: 760px; margin: 0 auto; padding: 32px 16px 64px; }
      a { color: #00707d; }
      h1 { font-size: 28px; margin: 8px 0 6px; }
      .lead { color: #5e6668; line-height: 1.6; margin: 0 0 18px; }
      .cta { display: inline-block; background: #141618; color: #fff; border-radius: 12px; padding: 10px 16px; font-weight: 700; text-decoration: none; }
      ol { list-style: none; padding: 0; margin: 20px 0; display: grid; gap: 10px; }
      li { background: #fff; border: 1px solid #cfd4d3; border-radius: 16px; padding: 14px 16px; }
      li h2 { font-size: 17px; margin: 0 0 4px; }
      li p { margin: 4px 0 0; font-size: 14px; }
      .addr { color: #5e6668; }
      li span { display: inline-block; background: #d4ebed; color: #004d57; border-radius: 999px; padding: 2px 8px; margin: 2px 4px 0 0; font-size: 12.5px; font-weight: 600; }
      nav { line-height: 2; font-size: 14px; }
      nav a { margin-right: 8px; }
      footer { color: #5e6668; font-size: 13px; line-height: 1.6; }
    </style>
  </head>
  <body>
    <main>
      <p><a href="${SITE.url}">${SITE.name}</a> › <a href="${SITE.url}courts/">전국 스쿼시장 찾기</a></p>
      <h1>${ko} 스쿼시장 ${list.length}곳</h1>
      <p class="lead">${esc(description)} 코트가 많은 순서예요. 지도와 거리순 정렬, 시설 필터는 앱에서 볼 수 있어요.</p>
      <a class="cta" href="${SITE.url}#/courts">앱에서 지도와 필터로 찾기</a>
      <ol>
${items}
      </ol>
      <nav aria-label="다른 지역"><strong>다른 지역</strong><br />${others}</nav>
      <footer><p>자료: ${courts.sources.map((s) => `<a href="${s.url}">${esc(s.name)}</a>`).join(', ')} (${esc(courts.asOf)} 기준). 운영 시간과 대관 가능 여부는 바뀔 수 있으니 방문 전에 전화로 확인하세요.</p></footer>
    </main>
  </body>
</html>
`
  await write(`courts/${slug}/`, html)
  urls.push({ url, priority: 0.6 })
  regionLinks.push({ ko, url, n: list.length, list })
}

// ---------- sitemap.xml ----------
await writeFile(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.url}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`,
)

// ---------- llms.txt: AI가 이 사이트를 이해하고 인용하도록 요약과 목차 ----------
const llms = `# ${SITE.name}

> ${SITE.description}

한국어로 된 스쿼시 안내 사이트입니다. 규칙과 기술 용어는 국제 규칙(World Squash)과 국내에서 쓰는 말을 기준으로 정리했고, 스쿼시장과 대회 정보는 공개 자료를 모아 주기적으로 갱신합니다. 인용할 때는 각 페이지 주소를 출처로 남겨 주세요.

## 페이지
${SEO_PAGES.map((p) => `- [${p.title.split(' | ')[0]}](${SITE.url}${p.path}): ${p.description}`).join('\n')}

## 지역별 스쿼시장
${regionLinks.map((r) => `- [${r.ko} 스쿼시장 ${r.n}곳](${r.url})`).join('\n')}

## 전체 내용
- [llms-full.txt](${SITE.url}llms-full.txt): 모든 페이지의 본문, 용어 사전, 스트레칭 방법, 전국 스쿼시장 목록을 글로 모은 파일
`
await writeFile(join(DIST, 'llms.txt'), llms)

const stretchText = (title, items) =>
  `### ${title}\n` + items.map((s) => `- ${s.name} (${s.parts.join(', ')}, ${s.dose}): ${s.how.join(' ')}${s.caution ? ` 주의: ${s.caution}` : ''}`).join('\n')

const full = [
  `# ${SITE.name} 전체 내용\n\n${SITE.description}\n출처: ${SITE.url} (${today} 기준)`,
  ...texts.map(({ page, url, text }) => `## ${page.title.split(' | ')[0]}\n주소: ${url}\n\n${text}`),
  `## 스쿼시 용어 사전\n주소: ${SITE.url}shots/\n\n` +
    CATEGORIES.map(
      (cat) =>
        `### ${cat}\n` +
        GLOSSARY.filter((t) => t.cat === cat)
          .map((t) => `- ${t.term}${t.en ? ` (${t.en})` : ''}: ${t.body}`)
          .join('\n'),
    ).join('\n\n'),
  `## 스트레칭\n주소: ${SITE.url}practice/\n\n` +
    [stretchText('운동 전 동적 스트레칭', WARMUP), stretchText('운동 후 정적 스트레칭', COOLDOWN), stretchText('폼롤러', FOAM_ROLLER)].join('\n\n'),
  `## 전국 스쿼시장 목록\n(${courts.asOf} 기준, 자료: ${courts.sources.map((s) => s.name).join(', ')})\n\n` +
    regionLinks.map((r) => `### ${r.ko} (${r.n}곳)\n주소: ${r.url}\n` + r.list.map((c) => `- ${courtRow(c).line}`).join('\n')).join('\n\n'),
].join('\n\n')
await writeFile(join(DIST, 'llms-full.txt'), full + '\n')

// 쿠팡 파트너스 경제적 이해관계 표시: 소모품 상담 페이지마다 문구가 첫 쿠팡 링크보다 앞에 있고, 쿠팡 링크는 모두 sponsored
const disclosureErrors = []
for (const page of SEO_PAGES.filter((p) => p.path.startsWith('kit/'))) {
  const html = await readFile(join(DIST, page.path, 'index.html'), 'utf8')
  // 첫 부분의 문구 상자(id="kit-disclosure")가 첫 상담과 첫 쿠팡 링크보다 앞에 있어야 한다
  const box = html.indexOf('id="kit-disclosure"')
  const text = html.indexOf(DISCLOSURE, box)
  const firstTip = html.indexOf('<article')
  const firstLink = html.indexOf('href="https://link.coupang.com/')
  const before = (i) => i < 0 || text < i
  if (box < 0 || text < 0 || text - box > 300 || !before(firstTip) || !before(firstLink))
    disclosureErrors.push(`${page.path}: 첫 부분에 대가성 문구 상자가 없거나 상담·쿠팡 링크보다 뒤에 있어요`)
  for (const a of html.match(/<a [^>]*href="https:\/\/link\.coupang\.com\/[^>]*>/g) ?? [])
    if (!/rel="sponsored/.test(a)) disclosureErrors.push(`${page.path}: rel="sponsored"가 없는 쿠팡 링크 ${a}`)
}
if (disclosureErrors.length) {
  console.error(disclosureErrors.join('\n'))
  process.exit(1)
}

await rm('dist-ssr', { recursive: true, force: true })
console.log(`정적 페이지 ${urls.length}개, llms-full ${Math.round(full.length / 1000)}k자`)
