import { useRef, useState } from 'react'
import { Card, PageHead, Section } from '../components/ui'
import { href } from '../router'

type Side = 'fore' | 'back'
type Pt = { x: number; y: number }

// 바닥 좌표(m): x는 왼쪽 옆벽 0 ~ 오른쪽 6.4, y는 앞벽 0 ~ 뒷벽 9.75
const W = 6.4
const L = 9.75
const SHORT = 5.44

/** 대기 구역(뒤 코트 한쪽)에 떨어졌는지 */
function inWaitZone(p: Pt, side: Side) {
  return p.y > SHORT && (side === 'fore' ? p.x < W / 2 : p.x > W / 2)
}

const SIDES: Record<Side, { label: string; wall: string; wait: string; play: string }> = {
  fore: { label: '포핸드 (기본)', wall: '오른쪽 벽', wait: '왼쪽 뒤', play: '오른쪽 뒤' },
  back: { label: '백핸드', wall: '왼쪽 벽', wait: '오른쪽 뒤', play: '왼쪽 뒤' },
}

export default function Giyeok() {
  const [side, setSide] = useState<Side>('fore')
  const [drop, setDrop] = useState<Pt | null>(null)
  const s = SIDES[side]
  const lost = drop && inWaitZone(drop, side)

  return (
    <>
      <PageHead eyebrow="CONDITIONED GAME" title="ㄱ자 게임">
        코트 하나를 여러 명이 돌아가며 쓰는 동호회·레슨용 게임이에요. 뒤 코트 한쪽을 대기 자리로 비우고, 남은 ㄱ자 모양 공간에서만 쳐요. 3/4 코트 게임, 컨디션 게임이라고도
        불러요.
      </PageHead>

      <Section kicker="THE SHAPE" title="어디에서 치나요">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <Card className="p-3 md:p-5">
            <div className="mb-3 flex justify-center gap-2" role="group" aria-label="게임 방향">
              {(Object.keys(SIDES) as Side[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={side === k}
                  onClick={() => {
                    setSide(k)
                    setDrop(null)
                  }}
                  className="rounded-full border border-line px-4 py-2 text-[14px] font-bold text-muted transition aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white"
                >
                  {SIDES[k].label}
                </button>
              ))}
            </div>
            <Court side={side} drop={drop} onDrop={setDrop} />
            <p className={`mt-2 text-center text-[13px] font-semibold ${drop ? (lost ? 'text-tin' : 'text-teal-deep') : 'font-normal text-muted'}`}>
              {drop ? (lost ? '대기 구역이에요. 공을 보낸 사람이 실점해요.' : 'ㄱ자 안이에요. 그대로 랠리해요.') : '바닥을 누르면 공이 거기 떨어졌을 때 어떻게 되는지 알려줘요.'}
            </p>
          </Card>

          <div className="space-y-3">
            <Card className={drop ? (lost ? 'border-tin/50 bg-[#fbecea]' : 'border-teal/40 bg-teal-soft/60') : ''}>
              {drop ? (
                <div aria-live="polite">
                  <p className={`text-[20px] font-extrabold ${lost ? 'text-tin' : 'text-teal-deep'}`}>{lost ? '공을 보낸 사람 실점' : '그대로 랠리'}</p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ink/80">
                    {lost
                      ? `${s.wait} 대기 구역에 떨어졌어요. 기다리는 사람들이 있는 곳이라, 공을 이쪽으로 보낸 사람이 점수를 잃어요.`
                      : drop.y <= SHORT
                        ? '앞 코트는 둘 다 쓸 수 있어요. 두 번 튀기 전에 받아 치면 돼요.'
                        : `${s.play} 코트는 ㄱ자 안이에요. ${s.wall}을 따라 길게 보내는 공이 가장 많이 오가는 곳이에요.`}
                  </p>
                </div>
              ) : (
                <p className="text-[15px] leading-relaxed text-muted">
                  <b className="text-ink">진한 틸</b>이 쓰는 공간, <b className="text-ink">회색 줄무늬</b>가 대기 구역이에요. 앞벽을 위에 두고 내려다보면 쓰는 공간이 ㄱ자로 보여요.
                </p>
              )}
            </Card>
            <Card>
              <h3 className="font-extrabold">한 줄 규칙</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
                공이 대기 구역에 떨어지면 보낸 사람이 실점해요. 나머지는 보통 경기 규칙(틴, 아웃, 두 번 튀기)과 같아요.
              </p>
            </Card>
            <Card>
              <h3 className="font-extrabold">왜 하나요</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
                코트가 한두 면뿐인 센터에서도 여러 명이 쉬지 않고 돌아가며 칠 수 있어요. 상대가 계속 바뀌어서 처음 보는 공에 익숙해지기도 좋아요.
              </p>
            </Card>
          </div>
        </div>
      </Section>

      <Section kicker="ORDER" title="진행 순서">
        <ol className="grid gap-3 md:grid-cols-2">
          {[
            `기다리는 사람들은 ${s.wait} 구역(서비스 박스 뒤쪽)에 모여 서요.`,
            `도전하는 사람이 ${s.wait} 서비스 박스에서 서브를 넣고, 남아 있던 사람은 ${s.play}에서 받아요.`,
            `서브가 들어가면 ${s.wait} 구역은 비워 둔 채 앞 코트와 ${s.play} 코트에서만 랠리해요.`,
            '공이 대기 구역에 떨어지면 공을 보낸 사람이 점수를 잃어요.',
            `이긴 사람은 ${s.play}에 남아 다음 사람의 서브를 받고, 진 사람은 대기 줄 맨 뒤로 가요.`,
          ].map((t, i) => (
            <li key={i} className="flex gap-3 rounded-[20px] border border-line/80 bg-card p-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink font-wide text-[11px] text-white">{i + 1}</span>
              <span className="text-[15px] leading-relaxed">{t}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
          몇 점을 내면 이기는지, 한 사람이 몇 번까지 연속으로 남을 수 있는지는 코트마다 달라요. 들어가기 전에 먼저 와 있던 사람들에게 물어보세요.
        </p>
      </Section>

      <Section kicker="ROTATION" title="순서 돌려 보기">
        <Rotation side={side} />
      </Section>

      <Section kicker="LEVELS" title="실력에 따라 다르게">
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <h3 className="text-[17px] font-extrabold">초급</h3>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">대기 구역만 피하면 어디로 쳐도 돼요. 공을 맞혀 넘기는 재미를 붙이는 단계예요.</p>
          </Card>
          <Card>
            <h3 className="text-[17px] font-extrabold">중급 이상</h3>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
              {s.wall}에 붙여 길게 치는 스트레이트 드라이브를 서로 주고받아요. 벽을 타고 오는 공, 뒷벽을 맞고 나오는 공을 처리하는 연습이 돼요.
            </p>
          </Card>
          <Card>
            <h3 className="text-[17px] font-extrabold">백핸드 버전</h3>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
              대기 자리를 오른쪽 뒤로 옮기고 왼쪽 벽을 써요. 오른손잡이에게는 백핸드 연습이에요. 좌우가 바뀐 모양이라 ㄴ자 게임이라고 부르는 곳도 있어요.
            </p>
          </Card>
        </div>
      </Section>

      <Section kicker="MANNERS" title="함께 치는 매너">
        <ul className="grid gap-2 text-[15px] md:grid-cols-2">
          {[
            '대기 구역 가까이에서는 스윙을 작게 하거나 멈춰요. 공보다 사람이 먼저예요.',
            '기다리는 사람은 대기 구역 밖으로 나오지 않아요. 구역 밖에 있다가 라켓에 맞으면 본인 책임으로 봐요.',
            '드롭으로 빨리 끝내기보다 길게 주고받아요. 다 같이 많이 치는 게 이 게임의 목적이에요.',
            '처음 온 사람에게는 칠 수 있는 공을 넘겨 주세요. 서브를 놓치면 한두 번 더 기회를 주기도 해요.',
            '서브를 넣을 수 있어야 들어갈 수 있어요. 빈 코트에서 서비스 라인 위로 넘기는 연습을 먼저 해 두세요.',
          ].map((t) => (
            <li key={t} className="flex gap-2.5 rounded-[18px] bg-card p-4">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal" />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-[14.5px] text-muted">
          기본 경기 규칙은{' '}
          <a href={href('rules')} className="font-semibold text-teal underline underline-offset-4">
            경기 규칙
          </a>
          에서 볼 수 있어요.
        </p>
      </Section>

      <Section kicker="SOURCES" title="참고한 글">
        <ul className="space-y-1.5 text-[14px] text-muted">
          {[
            ['스쿼시 ㄱ자 게임(기역자 게임) 하는 법', 'https://blog.naver.com/fallskya/223256454911'],
            ['본스쿼시 삼송역점: 수업 영상과 ㄱ자 게임', 'https://blog.naver.com/bonsquash/223445066981'],
            ['청주 본스쿼시: 스쿼시 기본 연습, 기역자 게임 하기', 'https://blog.naver.com/bon_sqursh/224210419109'],
          ].map(([t, u]) => (
            <li key={u}>
              <a href={u} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-teal">
                {t}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}

// 위에서 본 바닥(앞벽이 위). 축척 1m = 30
function Court({ side, drop, onDrop }: { side: Side; drop: Pt | null; onDrop: (p: Pt) => void }) {
  const S = 30
  const svg = useRef<SVGSVGElement>(null)
  const top = 22
  const X = (m: number) => m * S
  const Y = (m: number) => top + m * S
  const waitX = side === 'fore' ? 0 : W / 2
  const playX = side === 'fore' ? W / 2 : 0
  const serveX = side === 'fore' ? 0 : W - 1.6
  const queue = [0.75, 1.55, 2.35].map((dx) => (side === 'fore' ? dx : W - dx))

  function pick(e: React.PointerEvent<SVGSVGElement>) {
    const el = svg.current
    const m = el?.getScreenCTM()
    if (!el || !m) return
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    const x = p.x / S
    const y = (p.y - top) / S
    if (x < 0 || x > W || y < 0 || y > L) return
    onDrop({ x, y })
  }

  // ㄱ자 테두리: 앞 코트 전체 + 한쪽 뒤 코트
  const shape =
    side === 'fore'
      ? `M0 ${Y(0)} H${X(W)} V${Y(L)} H${X(W / 2)} V${Y(SHORT)} H0 Z`
      : `M0 ${Y(0)} H${X(W)} V${Y(SHORT)} H${X(W / 2)} V${Y(L)} H0 Z`

  return (
    <svg
      ref={svg}
      viewBox={`-8 0 ${X(W) + 16} ${Y(L) + 22}`}
      className="mx-auto block w-full max-w-[300px] cursor-crosshair touch-manipulation select-none"
      onPointerDown={pick}
      role="img"
      aria-label={`ㄱ자 게임 코트. ${SIDES[side].wait} 뒤 코트가 대기 구역이고 나머지에서 쳐요.`}
    >
      <defs>
        <pattern id="wait" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="#dfe2e1" />
          <rect width="3" height="8" fill="#c9cdcc" />
        </pattern>
      </defs>
      <text x={X(W / 2)} y={13} textAnchor="middle" fontSize="11" fill="#5e6668">
        앞벽
      </text>
      <rect x="0" y={Y(0)} width={X(W)} height={L * S} fill="#ecdcbc" />
      <path d={shape} fill="rgb(0 112 125 / 0.22)" />
      <rect x={X(waitX)} y={Y(SHORT)} width={X(W / 2)} height={(L - SHORT) * S} fill="url(#wait)" />

      {/* 코트 선 */}
      <line x1="0" y1={Y(SHORT)} x2={X(W)} y2={Y(SHORT)} stroke="#c8402f" strokeWidth="2" />
      <line x1={X(W / 2)} y1={Y(SHORT)} x2={X(W / 2)} y2={Y(L)} stroke="#c8402f" strokeWidth="2" />
      {[0, W - 1.6].map((x) => (
        <rect key={x} x={X(x)} y={Y(SHORT)} width={1.6 * S} height={1.6 * S} fill="none" stroke="#c8402f" strokeWidth="2" />
      ))}
      <rect x="0" y={Y(0)} width={X(W)} height={L * S} fill="none" stroke="#141618" strokeWidth="2.5" />
      <path d={shape} fill="none" stroke="#00707d" strokeWidth="4" strokeLinejoin="round" />

      {/* 대기하는 사람들 */}
      {queue.map((x, i) => (
        <circle key={i} cx={X(x)} cy={Y(L - 0.6)} r="9" fill="#ffffff" stroke="#5e6668" strokeWidth="2" />
      ))}
      <text x={X(waitX + W / 4)} y={Y(L - 1.35)} textAnchor="middle" fontSize="12" fontWeight="700" fill="#5e6668">
        대기
      </text>

      {/* 서브하는 사람과 받는 사람 */}
      <circle cx={X(serveX + 0.8)} cy={Y(SHORT + 0.8)} r="12" fill="#141618" />
      <text x={X(serveX + 0.8)} y={Y(SHORT + 0.8) + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">
        서브
      </text>
      <circle cx={X(playX + W / 4)} cy={Y(SHORT + 2.4)} r="12" fill="#00707d" />
      <text x={X(playX + W / 4)} y={Y(SHORT + 2.4) + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">
        승자
      </text>
      <text x={X(W / 2)} y={Y(SHORT / 2)} textAnchor="middle" fontSize="13" fontWeight="700" fill="#004d57">
        앞 코트 (함께 써요)
      </text>

      {drop && (
        <g pointerEvents="none">
          <circle cx={X(drop.x)} cy={Y(drop.y)} r="14" fill="none" stroke={inWaitZone(drop, side) ? '#c8402f' : '#00707d'} strokeWidth="2" opacity="0.6">
            <animate attributeName="r" from="6" to="20" dur="0.5s" fill="freeze" />
            <animate attributeName="opacity" from="0.9" to="0" dur="0.5s" fill="freeze" />
          </circle>
          <circle cx={X(drop.x)} cy={Y(drop.y)} r="6" fill="#141618" stroke="#ffffff" strokeWidth="2" />
          <circle cx={X(drop.x) - 1.5} cy={Y(drop.y) - 1.5} r="1.6" fill="#f2c230" />
        </g>
      )}
      <text x={X(W / 2)} y={Y(L) + 15} textAnchor="middle" fontSize="11" fill="#5e6668">
        뒷벽
      </text>
    </svg>
  )
}

const PEOPLE = ['나', '지우', '서준', '하린']

/** 받침에 따라 은/는 */
function eun(name: string) {
  const c = name.charCodeAt(name.length - 1) - 0xac00
  return name + (c >= 0 && c % 28 ? '은' : '는')
}

/** 이긴 사람은 남고, 진 사람은 줄 맨 뒤로 */
function Rotation({ side }: { side: Side }) {
  const [champ, setChamp] = useState(PEOPLE[1])
  const [queue, setQueue] = useState([PEOPLE[0], PEOPLE[2], PEOPLE[3]])
  const [last, setLast] = useState<string | null>(null)
  const [wins, setWins] = useState(0)
  const challenger = queue[0]
  const s = SIDES[side]

  function play(winner: 'champ' | 'challenger') {
    const rest = queue.slice(1)
    if (winner === 'champ') {
      setQueue([...rest, challenger])
      setWins((w) => w + 1)
      setLast(`${champ} 승리. ${eun(challenger)} 줄 맨 뒤로 가요.`)
    } else {
      setQueue([...rest, champ])
      setChamp(challenger)
      setWins(1)
      setLast(`${challenger} 승리. 이제 ${s.play} 자리를 지켜요. ${eun(champ)} 줄 맨 뒤로 가요.`)
    }
  }

  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-3">
        <Slot label={`${s.play}에서 받는 사람`} name={champ} note={wins > 1 ? `${wins}연승 중` : undefined} tone="teal" />
        <Slot label={`${s.wait} 박스에서 서브`} name={challenger} tone="ink" />
        <div>
          <p className="text-[13px] font-semibold text-muted">대기 줄</p>
          <ol className="mt-2 flex flex-wrap gap-1.5">
            {queue.slice(1).map((n) => (
              <li key={n} className="rounded-full border border-line bg-court px-3 py-1 text-[14px] font-semibold">
                {n}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => play('champ')} className="rounded-2xl bg-teal px-4 py-3 text-[15px] font-bold text-white transition hover:bg-teal-deep">
          {champ} 이기기
        </button>
        <button type="button" onClick={() => play('challenger')} className="rounded-2xl bg-ink px-4 py-3 text-[15px] font-bold text-white transition hover:bg-teal-deep">
          {challenger} 이기기
        </button>
      </div>
      <p className="mt-3 min-h-[1.5em] text-[14.5px] text-muted" aria-live="polite">
        {last ?? '누가 이길지 눌러 보세요. 사람이 어떻게 바뀌는지 보여 줘요.'}
      </p>
    </Card>
  )
}

function Slot({ label, name, note, tone }: { label: string; name: string; note?: string; tone: 'teal' | 'ink' }) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <p className={`mt-1 text-[24px] font-extrabold ${tone === 'teal' ? 'text-teal' : 'text-ink'}`}>
        {name}
        {note && <span className="ml-2 align-middle text-[13px] font-semibold text-muted">{note}</span>}
      </p>
    </div>
  )
}
