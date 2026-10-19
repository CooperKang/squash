import { href } from '../router'
import { Arrow } from '../components/Icon'
import { Card, PageHead, Section } from '../components/ui'

const FACTS = [
  { k: '9.75 × 6.4m', v: '단식 코트 크기. 테니스 코트의 4분의 1쯤이에요.' },
  { k: '24g 안팎', v: '지름 4cm쯤 되는 속이 빈 고무공. 따뜻해져야 잘 튀어요.' },
  { k: '11점', v: '한 게임. 보통 5게임 중 3게임을 먼저 따면 이겨요.' },
  { k: '45분 ≈ 600kcal', v: '짧은 시간에 운동량이 많은 종목으로 꼽혀요(체중·강도에 따라 달라요).' },
]

const WHY = [
  { t: '날씨와 상관없이', b: '실내 코트라 비가 와도, 밤에도 칠 수 있어요. 둘만 있으면 경기가 돼요.' },
  { t: '짧고 굵은 운동', b: '랠리마다 짧게 달리고 멈추기를 반복해서 심폐 지구력과 순발력이 함께 늘어요.' },
  { t: '머리를 쓰는 경기', b: '공을 상대에게서 멀리 보내고 T(코트 가운데)를 먼저 차지하는 위치 싸움이에요. 체스에 자주 비유돼요.' },
  { t: '혼자서도 연습', b: '벽이 상대가 되어 주니 혼자서 드라이브, 발리를 반복 연습할 수 있어요.' },
]

const HISTORY = [
  { y: '1830년경', t: '영국 해로우 스쿨', b: '라켓츠(rackets)를 하던 학생들이 바람 빠진 말랑한 공으로 치기 시작한 것이 시작으로 알려져 있어요. 공이 찌그러지는(squash) 데서 이름이 왔어요.' },
  { y: '1920~30년대', t: '규칙과 협회', b: '영국에서 코트 규격과 규칙이 정리되고 협회가 생기며 클럽 스포츠로 자리 잡았어요.' },
  { y: '1973년', t: '프로 투어', b: '국제 프로 선수 협회(지금의 PSA)가 만들어져 세계 투어가 열리기 시작했어요.' },
  { y: '2028년', t: '올림픽 정식 종목', b: 'LA 올림픽에서 처음으로 올림픽 정식 종목이 돼요. 국내에서도 관심이 커지고 있어요.' },
]

export default function About() {
  return (
    <>
      <PageHead eyebrow="WHAT IS SQUASH" title="스쿼시란?">
        사방이 벽으로 막힌 코트에서 두 사람이 번갈아 앞벽에 공을 치는 실내 라켓 스포츠예요. 상대가 받기 어려운 곳으로 공을 보내면 점수를 얻어요.
      </PageHead>

      <section className="mx-auto max-w-6xl px-4">
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {FACTS.map((f) => (
            <li key={f.k} className="rounded-[22px] bg-ink p-5 text-white">
              <p className="font-wide text-[17px] leading-tight text-teal-bright md:text-[20px]">{f.k}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-white/75">{f.v}</p>
            </li>
          ))}
        </ul>
      </section>

      <Section kicker="WHY SQUASH" title="이래서 빠져들어요">
        <div className="grid gap-3 md:grid-cols-2">
          {WHY.map((w) => (
            <Card key={w.t}>
              <h3 className="text-[18px] font-extrabold">{w.t}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{w.b}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section kicker="HOW IT FLOWS" title="한 번의 랠리는 이렇게 흘러가요">
        <ol className="grid gap-3 md:grid-cols-4">
          {[
            ['서브', '서비스 박스에 한 발을 딛고 앞벽 서비스 라인 위로 쳐요. 공은 상대 쪽 뒤 코트에 떨어져야 해요.'],
            ['리턴', '받는 사람은 공이 바닥에 한 번 튀기 전이나 튄 뒤에 쳐서 다시 앞벽으로 보내요. 옆벽·뒷벽을 써도 돼요.'],
            ['T로 복귀', '치고 나면 코트 가운데 T 자리로 돌아가 다음 공에 대비해요. 상대가 지나갈 길은 비켜 줘요.'],
            ['득점', '공이 두 번 튀거나, 틴에 걸리거나, 아웃 라인을 넘으면 랠리가 끝나고 이긴 쪽이 1점을 얻어요.'],
          ].map(([t, b], i) => (
            <li key={t} className="relative rounded-[22px] border border-line/80 bg-card p-5">
              <span className="font-wide text-[28px] text-silver">{i + 1}</span>
              <h3 className="mt-1 text-[17px] font-extrabold">{t}</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{b}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section kicker="HISTORY" title="짧은 역사">
        <ol className="relative space-y-6 border-l-2 border-silver pl-6">
          {HISTORY.map((h) => (
            <li key={h.y} className="relative">
              <span className="absolute top-1.5 -left-[31px] size-3.5 rounded-full border-[3px] border-court bg-teal" />
              <p className="font-wide text-[12px] text-teal">{h.y}</p>
              <h3 className="mt-1 text-[18px] font-extrabold">{h.t}</h3>
              <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-muted">{h.b}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section kicker="FIRST VISIT" title="처음 코트에 간다면">
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <h3 className="font-extrabold">챙길 것</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
              바닥 자국이 남지 않는 실내화(논마킹), 땀 닦을 수건, 물. 라켓과 공은 대부분 체육관에서 빌릴 수 있어요. 보호안경을 권해요.
            </p>
          </Card>
          <Card>
            <h3 className="font-extrabold">공 데우기</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
              스쿼시공은 차가우면 거의 튀지 않아요. 시작 전에 2~3분 벽에 세게 쳐서 공을 데우는 게 기본이에요.
            </p>
          </Card>
          <Card>
            <h3 className="font-extrabold">레슨부터</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
              그립과 스윙을 처음에 잘못 익히면 고치기 어려워요. 몇 번이라도 코치에게 기본기를 배우고 시작하면 훨씬 빨리 늘어요.
            </p>
          </Card>
        </div>
        <a href={href('rules')} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-ink px-5 py-3.5 text-[15px] font-bold text-white hover:bg-teal-deep">
          경기 규칙 보러 가기 <Arrow className="size-4" />
        </a>
      </Section>
    </>
  )
}
