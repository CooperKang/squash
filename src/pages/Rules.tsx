import { useState } from 'react'
import { Card, PageHead, Section } from '../components/ui'
import { href } from '../router'

type Spot = 'tin' | 'service' | 'out' | 'short' | 'half' | 'box' | 't'

const SPOTS: Record<Spot, { name: string; body: string }> = {
  tin: { name: '틴 (Tin)', body: '앞벽 맨 아래 48cm 높이의 띠. 테니스의 네트 같은 곳으로, 공이 여기에 맞으면 친 사람이 점수를 잃어요.' },
  service: { name: '서비스 라인', body: '앞벽 1.78m 높이 선. 서브는 반드시 이 선보다 위, 아웃 라인보다 아래에 맞아야 해요.' },
  out: { name: '아웃 라인', body: '앞벽 4.57m에서 시작해 옆벽을 따라 뒷벽 2.13m로 내려오는 선. 선에 맞거나 넘으면 아웃이에요.' },
  short: { name: '쇼트 라인', body: '앞벽에서 5.44m 떨어진 바닥 선. 서브한 공은 이 선 뒤, 상대 쪽 뒤 코트에 떨어져야 해요.' },
  half: { name: '하프 코트 라인', body: '쇼트 라인에서 뒷벽까지 코트를 좌우로 나누는 선. 서브가 떨어질 쪽을 정해요.' },
  box: { name: '서비스 박스', body: '1.6m × 1.6m 사각형. 서브하는 사람은 한 발을 이 안에 두고 쳐야 해요(선을 밟으면 안 돼요).' },
  t: { name: 'T', body: '쇼트 라인과 하프 코트 라인이 만나는 곳. 코트 어디로든 가장 빨리 갈 수 있는 자리라 치고 나서 돌아오는 곳이에요.' },
}

export default function Rules() {
  const [spot, setSpot] = useState<Spot>('tin')
  return (
    <>
      <PageHead eyebrow="RULES" title="경기 규칙">
        세계스쿼시연맹(WSF) 단식 규칙을 기준으로 꼭 알아야 할 것만 추렸어요. 동호회 경기도 대부분 같은 규칙을 써요.
      </PageHead>

      <Section kicker="THE COURT" title="코트의 선과 이름">
        <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
          <Card className="p-3 md:p-5">
            <CourtDiagram active={spot} onPick={setSpot} />
            <p className="mt-2 text-center text-[13px] text-muted">그림의 선이나 이름을 누르면 설명이 바뀌어요.</p>
          </Card>
          <div className="space-y-2">
            {(Object.keys(SPOTS) as Spot[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSpot(k)}
                aria-pressed={spot === k}
                className="block w-full rounded-[20px] border border-line/80 bg-card px-5 py-3.5 text-left transition aria-pressed:border-teal aria-pressed:bg-teal-soft"
              >
                <span className="text-[16px] font-extrabold">{SPOTS[k].name}</span>
                {spot === k && <span className="mt-1 block text-[14.5px] leading-relaxed text-ink/80">{SPOTS[k].body}</span>}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section kicker="SCORING" title="점수: PAR 11">
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <p className="font-wide text-[30px] text-teal">11</p>
            <h3 className="mt-1 font-extrabold">랠리 포인트</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted">서브권과 상관없이 랠리를 이긴 쪽이 1점. 11점을 먼저 내면 그 게임을 가져가요.</p>
          </Card>
          <Card>
            <p className="font-wide text-[30px] text-teal">10:10</p>
            <h3 className="mt-1 font-extrabold">듀스</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted">10:10이 되면 2점 차가 날 때까지 계속해요. 12:10, 15:13처럼 끝나요.</p>
          </Card>
          <Card>
            <p className="font-wide text-[30px] text-teal">3/5</p>
            <h3 className="mt-1 font-extrabold">게임 수</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted">프로와 공식 대회는 5게임 중 3게임 선승제가 보통이에요. 동호회는 3게임 중 2게임도 많이 해요.</p>
          </Card>
        </div>
      </Section>

      <Section kicker="SERVE" title="서브">
        <ol className="grid gap-3 md:grid-cols-2">
          {[
            '첫 서브는 라켓을 돌려 정해요. 랠리를 이긴 사람이 다음 서브를 넣어요.',
            '서브권을 가져오면 좌우 서비스 박스 중 원하는 쪽에서 시작하고, 서브권을 지키는 동안 박스를 번갈아 바꿔요.',
            '한 발은 서비스 박스 안 바닥에 닿아 있어야 해요. 선을 밟으면 풋 폴트예요.',
            '공은 앞벽의 서비스 라인과 아웃 라인 사이에 바로 맞아야 해요. 옆벽부터 맞히면 안 돼요.',
            '앞벽에서 튄 공이 상대 쪽 뒤 코트(쇼트 라인 뒤, 하프 코트 라인 너머)에 떨어져야 해요. 받는 사람이 바닥에 떨어지기 전에 쳐도 돼요.',
            '스쿼시는 세컨드 서브가 없어요. 폴트하면 바로 상대 점수, 서브권도 넘어가요.',
          ].map((t, i) => (
            <li key={i} className="flex gap-3 rounded-[20px] border border-line/80 bg-card p-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink font-wide text-[11px] text-white">{i + 1}</span>
              <span className="text-[15px] leading-relaxed">{t}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section kicker="RALLY" title="랠리에서 점수를 잃는 경우">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['낫 업 (Not up)', '공이 바닥에 두 번 튀기 전에 치지 못했어요. 라켓에 두 번 맞아도(더블 히트) 마찬가지.'],
            ['다운 (Down)', '친 공이 앞벽에 닿기 전에 바닥에 떨어졌거나 틴에 맞았어요.'],
            ['아웃 (Out)', '공이 아웃 라인에 닿거나 넘었어요. 선도 아웃이에요.'],
            ['몸에 맞음', '상대가 친 공이 앞벽에 가기 전에 내 몸에 맞으면, 상황에 따라 렛이나 스트로크가 돼요.'],
          ].map(([t, b]) => (
            <Card key={t}>
              <h3 className="text-[17px] font-extrabold">{t}</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{b}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section kicker="INTERFERENCE" title="렛과 스트로크">
        <p className="max-w-3xl text-[16px] leading-relaxed text-muted">
          스쿼시는 두 사람이 같은 공간을 쓰기 때문에 서로 길을 막는 일이 생겨요. 이때는 바로 멈추고 “렛 플리즈(Let, please)”라고 요청해요. 심판(또는 서로의 합의)이 셋 중 하나로 판정해요.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Verdict tag="LET" title="렛 — 다시 하기" color="bg-silver text-ink">
            방해가 있었지만, 상대가 비키려고 최선을 다했고 나도 공을 받을 수 있었던 경우. 점수 없이 그 랠리를 다시 해요.
          </Verdict>
          <Verdict tag="STROKE" title="스트로크 — 내 점수" color="bg-teal text-white">
            상대가 비킬 수 있었는데 안 비켰거나, 내가 치면 바로 득점이 될 공을 상대가 막은 경우. 요청한 사람이 1점을 얻어요.
          </Verdict>
          <Verdict tag="NO LET" title="노 렛 — 상대 점수" color="bg-ink text-white">
            방해가 없었거나, 있었더라도 어차피 공을 받지 못했을 경우. 요청한 사람이 랠리를 잃어요.
          </Verdict>
        </div>
        <Card className="mt-4 bg-teal-soft/60">
          <h3 className="font-extrabold">안전이 먼저예요</h3>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink/80">
            상대가 가까이 있는데 휘두르면 위험해요. 라켓에 사람이 맞을 것 같으면 스윙을 멈추고 렛을 요청하세요. 규칙도 이런 경우를 보호해요.
          </p>
        </Card>
      </Section>

      <Section kicker="CLUB GAME" title="여럿이 칠 때는 ㄱ자 게임">
        <a
          href={href('giyeok')}
          className="flex flex-col gap-1 rounded-[24px] border border-line/80 bg-card p-5 transition hover:border-teal/50 md:flex-row md:items-center md:justify-between md:p-6"
        >
          <span className="text-[15px] leading-relaxed text-muted">
            동호회나 레슨 뒤 자유 시간에는 뒤 코트 한쪽을 대기 자리로 비우고 돌아가며 쳐요. 규칙과 순서를 코트 그림으로 정리했어요.
          </span>
          <span className="shrink-0 text-[15px] font-bold text-teal">ㄱ자 게임 알아보기</span>
        </a>
      </Section>

      <Section kicker="ETIQUETTE" title="코트 매너">
        <ul className="grid gap-2 text-[15px] md:grid-cols-2">
          {[
            '코트 문은 랠리가 끝난 뒤에 열어요. 밖에서도 유리를 두드리지 않아요.',
            '심판이 없으면 내 쪽 판정(낫 업, 다운)은 스스로 솔직하게 말해요.',
            '친 다음에는 상대가 공으로 갈 수 있게 길을 비켜 줘요.',
            '경기 전 5분 정도 서로 번갈아 공을 데우며 몸을 풀어요.',
          ].map((t) => (
            <li key={t} className="flex gap-2.5 rounded-[18px] bg-card p-4">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal" />
              {t}
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}

function Verdict({ tag, title, color, children }: { tag: string; title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border border-line/80 bg-card p-5">
      <span className={`inline-block rounded-full px-3 py-1 font-wide text-[10px] tracking-[0.15em] ${color}`}>{tag}</span>
      <h3 className="mt-3 text-[18px] font-extrabold">{title}</h3>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{children}</p>
    </div>
  )
}

// 왼쪽은 위에서 본 바닥, 오른쪽은 정면에서 본 앞벽(축척 1m = 30)
function CourtDiagram({ active, onPick }: { active: Spot; onPick: (s: Spot) => void }) {
  const S = 30
  const W = 6.4 * S
  const L = 9.75 * S
  const short = 5.44 * S
  const box = 1.6 * S
  const on = (s: Spot) => (active === s ? '#00707d' : '#c8402f')
  const sw = (s: Spot) => (active === s ? 5 : 2.5)
  const hit = (s: Spot) => ({ onClick: () => onPick(s), style: { cursor: 'pointer' } })

  const wallX = W + 46
  const wallH = 4.57 * S
  const fy = (m: number) => 20 + wallH + 10 - m * S

  return (
    <svg viewBox={`-14 -6 ${wallX + W + 28} ${L + 40}`} className="w-full" role="img" aria-label="스쿼시 코트 바닥과 앞벽의 선">
      {/* 바닥 */}
      <text x={W / 2} y={8} textAnchor="middle" fontSize="11" fill="#5e6668">
        앞벽 ↑ · 위에서 본 바닥
      </text>
      <rect x="0" y="16" width={W} height={L} fill="#ecdcbc" stroke="#141618" strokeWidth="2" />
      <line x1="0" y1={16 + short} x2={W} y2={16 + short} stroke={on('short')} strokeWidth={sw('short')} {...hit('short')} />
      <line x1={W / 2} y1={16 + short} x2={W / 2} y2={16 + L} stroke={on('half')} strokeWidth={sw('half')} {...hit('half')} />
      {[0, W - box].map((x) => (
        <rect
          key={x}
          x={x}
          y={16 + short}
          width={box}
          height={box}
          fill={active === 'box' ? 'rgb(0 112 125 / 0.15)' : 'transparent'}
          stroke={on('box')}
          strokeWidth={sw('box')}
          {...hit('box')}
        />
      ))}
      <circle cx={W / 2} cy={16 + short} r={active === 't' ? 11 : 7} fill={active === 't' ? '#00707d' : '#141618'} {...hit('t')} />
      <text x={W / 2 + 12} y={16 + short - 8} fontSize="12" fontWeight="700" fill="#141618" {...hit('t')}>
        T
      </text>
      <text x={W / 2} y={16 + L - 10} textAnchor="middle" fontSize="10" fill="#5e6668">
        뒷벽
      </text>

      {/* 앞벽 */}
      <text x={wallX + W / 2} y={8} textAnchor="middle" fontSize="11" fill="#5e6668">
        정면에서 본 앞벽
      </text>
      <rect x={wallX} y={16} width={W} height={wallH + 14} fill="#f6f7f7" stroke="#141618" strokeWidth="2" />
      <rect
        x={wallX}
        y={fy(0.48)}
        width={W}
        height={0.48 * S}
        fill={active === 'tin' ? 'rgb(0 112 125 / 0.3)' : '#d4d6d6'}
        {...hit('tin')}
      />
      <line x1={wallX} y1={fy(0.48)} x2={wallX + W} y2={fy(0.48)} stroke={on('tin')} strokeWidth={sw('tin')} {...hit('tin')} />
      <line x1={wallX} y1={fy(1.78)} x2={wallX + W} y2={fy(1.78)} stroke={on('service')} strokeWidth={sw('service')} {...hit('service')} />
      <line x1={wallX} y1={fy(4.57)} x2={wallX + W} y2={fy(4.57)} stroke={on('out')} strokeWidth={sw('out')} {...hit('out')} />
      {[
        [0.48, '틴 0.48m', 'tin'],
        [1.78, '서비스 1.78m', 'service'],
        [4.57, '아웃 4.57m', 'out'],
      ].map(([m, label, s]) => (
        <text key={label as string} x={wallX + 6} y={fy(m as number) - 5} fontSize="10.5" fontWeight="600" fill="#141618" {...hit(s as Spot)}>
          {label}
        </text>
      ))}
      {/* 옆벽 아웃 라인 측면도 */}
      <text x={wallX + W / 2} y={L - 70} textAnchor="middle" fontSize="11" fill="#5e6668">
        옆벽(옆에서 본 모습)
      </text>
      <rect x={wallX} y={L - 60} width={W} height={84} fill="#f6f7f7" stroke="#141618" strokeWidth="1.5" />
      <line x1={wallX} y1={L - 52} x2={wallX + W} y2={L + 4} stroke={on('out')} strokeWidth={sw('out')} {...hit('out')} />
      <text x={wallX + 4} y={L + 18} fontSize="9.5" fill="#5e6668">
        앞 4.57m
      </text>
      <text x={wallX + W - 4} y={L + 18} textAnchor="end" fontSize="9.5" fill="#5e6668">
        뒤 2.13m
      </text>
    </svg>
  )
}
