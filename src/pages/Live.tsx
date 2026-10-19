import { useEffect, useMemo, useState } from 'react'
import { External } from '../components/Icon'
import { Card, PageHead } from '../components/ui'
import {
  ago,
  countryName,
  dateRange,
  eventState,
  loadData,
  loadLiveResults,
  mergeMatches,
  findVideo,
  roundLabel,
  youtubeSearch,
  tierLabel,
  type Calendar,
  type Korea,
  type Match,
  type PsaEvent,
  type Rankings,
  type Results,
  type Video,
  type Videos,
} from '../data/live'

type Tab = 'world' | 'korea' | 'results' | 'rankings'
const TABS: { id: Tab; label: string }[] = [
  { id: 'world', label: '세계 대회' },
  { id: 'korea', label: '국내 대회' },
  { id: 'results', label: '최근 결과' },
  { id: 'rankings', label: '세계 랭킹' },
]

function tabFromHash(): Tab {
  const t = location.hash.split('?tab=')[1]
  return TABS.some((x) => x.id === t) ? (t as Tab) : 'world'
}

type State<T> = { data: T | null; error: boolean }
function useData<T>(name: string) {
  const [s, setS] = useState<State<T>>({ data: null, error: false })
  useEffect(() => {
    let alive = true
    loadData<T>(name)
      .then((data) => alive && setS({ data, error: false }))
      .catch(() => alive && setS({ data: null, error: true }))
    return () => {
      alive = false
    }
  }, [name])
  return s
}

export default function Live() {
  const [tab, setTab] = useState<Tab>(tabFromHash)
  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const calendar = useData<Calendar>('calendar.json')
  const korea = useData<Korea>('korea.json')
  const results = useData<Results>('results.json')
  const videos = useData<Videos>('videos.json')
  const [playing, setPlaying] = useState<Video | null>(null)
  const rankings = useData<Rankings>('rankings.json')

  // 결과는 접속할 때 PSA에서 한 번 더 받아 최신 경기까지 합친다
  const [fresh, setFresh] = useState<Match[] | null>(null)
  useEffect(() => {
    loadLiveResults()
      .then(setFresh)
      .catch(() => setFresh(null))
  }, [])
  const matches = useMemo(() => mergeMatches(results.data?.matches ?? [], fresh ?? []), [results.data, fresh])

  const pick = (t: Tab) => {
    setTab(t)
    history.replaceState(null, '', `#/live?tab=${t}`)
  }

  const updated = [calendar.data?.updated, korea.data?.updated, results.data?.updated, rankings.data?.updated].filter(Boolean).sort()[0]

  return (
    <>
      <PageHead eyebrow="LIVE BOARD" title="대회 현황판">
        PSA 월드 투어와 대한스쿼시연맹 대회 일정, 최근 경기 결과, 세계 랭킹을 모았어요. 몇 시간마다 자동으로 새로 받아 오고, 경기 결과는 화면을 열 때 PSA에서 바로 한 번 더 확인해요.
      </PageHead>

      <div className="mx-auto max-w-6xl px-4">
        <LiveNow calendar={calendar.data} korea={korea.data} onPick={pick} />

        <div className="sticky top-14 z-20 -mx-4 mt-8 bg-court/90 px-4 py-3 backdrop-blur md:top-16">
          <div role="tablist" aria-label="현황판 보기" className="flex gap-1.5 overflow-x-auto rounded-2xl bg-white p-1.5 [scrollbar-width:none]">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => pick(t.id)}
                className="shrink-0 grow rounded-xl px-4 py-2.5 text-[14.5px] font-bold text-muted transition aria-selected:bg-ink aria-selected:text-white"
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-right text-[12px] text-muted">
            {updated ? `데이터 갱신 ${ago(updated)}` : ''}
            {fresh ? ' · 경기 결과는 방금 확인' : ''}
          </p>
        </div>

        <div className="mt-4" role="tabpanel">
          {tab === 'world' && <WorldEvents s={calendar} />}
          {tab === 'korea' && <KoreaEvents s={korea} />}
          {tab === 'results' && (
            <ResultsView matches={matches} videos={videos.data?.videos ?? []} onPlay={setPlaying} loading={!results.data && !results.error && !fresh} />
          )}
          {tab === 'rankings' && <RankingsView s={rankings} korea={korea.data} />}
        </div>
      </div>
      {playing && <Player video={playing} onClose={() => setPlaying(null)} />}
    </>
  )
}

function LiveNow({ calendar, korea, onPick }: { calendar: Calendar | null; korea: Korea | null; onPick: (t: Tab) => void }) {
  const now = [
    ...(calendar?.events ?? [])
      .filter((e) => e.group === 'world' && eventState(e.start, e.end).state === 'live')
      .map((e) => ({ key: `p${e.id}`, title: e.name, sub: `${tierLabel(e.tier)} · ${e.location}`, range: dateRange(e.start, e.end), tab: 'results' as Tab })),
    ...(korea?.events ?? [])
      .filter((e) => eventState(e.start, e.end).state === 'live')
      .map((e) => ({ key: `k${e.idx}`, title: e.title, sub: e.venue, range: dateRange(e.start, e.end), tab: 'korea' as Tab })),
  ]
  const next = (calendar?.events ?? []).find((e) => e.group === 'world' && eventState(e.start, e.end).state === 'upcoming')
  if (!calendar && !korea) return <Skeleton rows={1} />
  return (
    <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
      <div className="rounded-[26px] bg-ink p-5 text-white md:p-6">
        <p className="flex items-center gap-2 font-wide text-[11px] tracking-[0.2em] text-teal-bright">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-bright opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-teal-bright" />
          </span>
          NOW PLAYING
        </p>
        {now.length === 0 ? (
          <p className="mt-3 text-[16px] text-white/75">지금 열리고 있는 주요 대회는 없어요.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/10">
            {now.map((n) => (
              <li key={n.key}>
                <button type="button" onClick={() => onPick(n.tab)} className="w-full py-2.5 text-left">
                  <span className="block text-[17px] font-bold">{n.title}</span>
                  <span className="mt-0.5 block text-[13.5px] text-white/65">
                    {n.range} · {n.sub}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {next && (
        <a href={next.link} target="_blank" rel="noreferrer" className="brushed group rounded-[26px] p-5 text-ink md:p-6">
          <p className="font-wide text-[11px] tracking-[0.2em] text-teal-deep">NEXT · D-{eventState(next.start, next.end).days}</p>
          <p className="mt-3 text-[19px] leading-snug font-extrabold">{next.name}</p>
          <p className="mt-1 text-[14px] text-ink/70">
            {dateRange(next.start, next.end)} · {tierLabel(next.tier)} · {next.location}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-teal-deep group-hover:underline">
            PSA에서 보기 <External className="size-3.5" />
          </span>
        </a>
      )}
    </div>
  )
}

const GROUPS: { id: PsaEvent['group'] | 'all'; label: string }[] = [
  { id: 'world', label: '월드 투어' },
  { id: 'challenger', label: '챌린저' },
  { id: 'satellite', label: '새틀라이트' },
  { id: 'all', label: '전체' },
]

function WorldEvents({ s }: { s: State<Calendar> }) {
  const [group, setGroup] = useState<(typeof GROUPS)[number]['id']>('world')
  const [showDone, setShowDone] = useState(false)
  if (s.error) return <Failed />
  if (!s.data) return <Skeleton rows={6} />
  const list = s.data.events.filter((e) => (group === 'all' || e.group === group) && (showDone || eventState(e.start, e.end).state !== 'done'))
  const byMonth = new Map<string, PsaEvent[]>()
  for (const e of list) {
    const k = e.start.slice(0, 7)
    byMonth.set(k, [...(byMonth.get(k) ?? []), e])
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={group === g.id}
            onClick={() => setGroup(g.id)}
            className="rounded-full border border-line bg-white px-3.5 py-1.5 text-[13.5px] font-semibold text-muted aria-pressed:border-teal aria-pressed:bg-teal aria-pressed:text-white"
          >
            {g.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-[13.5px] text-muted">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-teal" />
          끝난 대회도
        </label>
      </div>
      <p className="mt-3 text-[13px] text-muted">
        {s.data.season} 시즌 · 다이아몬드 &gt; 플래티넘 &gt; 골드 &gt; 실버 &gt; 브론즈 &gt; 코퍼 순으로 큰 대회예요.
      </p>
      {list.length === 0 && <Card className="mt-4 text-muted">해당하는 대회가 없어요.</Card>}
      {[...byMonth].map(([month, events]) => (
        <section key={month} className="mt-6">
          <h3 className="font-wide text-[13px] tracking-[0.15em] text-muted">
            {month.slice(0, 4)}.{month.slice(5)}
          </h3>
          <ul className="mt-2 grid gap-2 md:grid-cols-2">
            {events.map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

function EventRow({ e }: { e: PsaEvent }) {
  const st = eventState(e.start, e.end)
  const kor = e.location.includes('KOR')
  return (
    <li>
      <a
        href={e.link}
        target="_blank"
        rel="noreferrer"
        className={`flex h-full gap-4 rounded-[20px] border bg-card p-4 transition hover:border-teal/50 ${kor ? 'border-teal ring-2 ring-teal/20' : 'border-line/80'}`}
      >
        <div className="w-14 shrink-0 text-center">
          <p className="font-wide text-[15px] leading-tight">{dateRange(e.start, e.end).split(' – ')[0]}</p>
          <p className="mt-1 text-[11px] text-muted">{e.start !== e.end ? `~${dateRange(e.end, e.end)}` : ''}</p>
          <StateBadge state={st.state} days={st.days} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15.5px] leading-snug font-bold">{e.name}</p>
          <p className="mt-1 text-[13px] text-muted">
            {e.location}
            {kor && ' · 한국 개최'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip strong={e.group === 'world'}>{tierLabel(e.tier)}</Chip>
            {e.draws.includes('M') && <Chip>남자</Chip>}
            {e.draws.includes('W') && <Chip>여자</Chip>}
            {e.prize > 0 && <Chip>${Math.round(e.prize / 1000)}k</Chip>}
          </div>
        </div>
      </a>
    </li>
  )
}

function KoreaEvents({ s }: { s: State<Korea> }) {
  const [showDone, setShowDone] = useState(false)
  if (s.error) return <Failed />
  if (!s.data) return <Skeleton rows={5} />
  const list = s.data.events.filter((e) => showDone || eventState(e.start, e.end).state !== 'done')
  const done = s.data.events.filter((e) => eventState(e.start, e.end).state === 'done').reverse()
  return (
    <>
      <div className="flex items-center gap-2">
        <p className="text-[13px] text-muted">
          출처:{' '}
          <a className="underline underline-offset-2" href="http://www.koreasquash.or.kr/competition_list.asp" target="_blank" rel="noreferrer">
            대한스쿼시연맹 대회 일정
          </a>
        </p>
        <label className="ml-auto flex items-center gap-1.5 text-[13.5px] text-muted">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-teal" />
          끝난 대회도
        </label>
      </div>
      <ul className="mt-4 grid gap-2 md:grid-cols-2">
        {list.map((e) => {
          const st = eventState(e.start, e.end)
          return (
            <li key={e.idx + e.title} className="flex gap-4 rounded-[20px] border border-line/80 bg-card p-4">
              <div className="w-14 shrink-0 text-center">
                <p className="font-wide text-[15px] leading-tight">{dateRange(e.start, e.end).split(' – ')[0]}</p>
                <p className="mt-1 text-[11px] text-muted">{e.start !== e.end ? `~${dateRange(e.end, e.end)}` : ''}</p>
                <StateBadge state={st.state} days={st.days} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15.5px] leading-snug font-bold">{e.title}</p>
                <p className="mt-1 text-[13px] text-muted">{e.venue}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Chip strong={e.kind === '국제대회'}>{e.kind}</Chip>
                  {e.status && <Chip>{e.status}</Chip>}
                  {e.apply && st.state === 'upcoming' && e.status.includes('신청') && (
                    <a href={e.apply} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-teal px-2.5 py-1 text-[12px] font-bold text-white">
                      참가 신청 <External className="size-3" />
                    </a>
                  )}
                  {e.result && (
                    <a href={e.result} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[12px] font-bold text-white">
                      결과 PDF <External className="size-3" />
                    </a>
                  )}
                  {st.state !== 'upcoming' && <YoutubeSearch q={`${e.title} 스쿼시`} />}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {!showDone && done.some((e) => e.result) && (
        <section className="mt-8">
          <h3 className="text-[18px] font-extrabold">최근 끝난 대회 결과</h3>
          <ul className="mt-3 divide-y divide-line rounded-[20px] bg-card">
            {done
              .filter((e) => e.result)
              .slice(0, 6)
              .map((e) => (
                <li key={e.idx}>
                  <a href={e.result} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3.5 hover:bg-teal-soft/40">
                    <span className="font-wide text-[12px] text-muted">{dateRange(e.start, e.end)}</span>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{e.title}</span>
                    <External className="size-4 shrink-0 text-muted" />
                  </a>
                  <div className="-mt-1.5 px-4 pb-3">
                    <YoutubeSearch q={`${e.title} 스쿼시`} />
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}
    </>
  )
}

function ResultsView({ matches, videos, onPlay, loading }: { matches: Match[]; videos: Video[]; onPlay: (v: Video) => void; loading: boolean }) {
  const [korOnly, setKorOnly] = useState(false)
  if (loading) return <Skeleton rows={6} />
  const highlights = videos.filter((v) => /highlight/i.test(v.title)).slice(0, 10)
  if (matches.length === 0) return <Failed />
  const list = korOnly ? matches.filter((m) => m.players.some((p) => p.country === 'KOR')) : matches
  const byTournament = new Map<string, Match[]>()
  for (const m of list) byTournament.set(m.tournament, [...(byTournament.get(m.tournament) ?? []), m])
  return (
    <>
      {highlights.length > 0 && (
        <section className="mb-8">
          <div className="flex items-end justify-between">
            <h3 className="text-[18px] font-extrabold">최신 하이라이트</h3>
            <a href="https://www.youtube.com/user/psasquashtv" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-ink">
              PSA SQUASHTV 채널 <External className="size-3.5" />
            </a>
          </div>
          <ul className="-mx-4 mt-3 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
            {highlights.map((v) => (
              <li key={v.id} className="w-[72%] shrink-0 snap-start sm:w-[300px]">
                <button type="button" onClick={() => onPlay(v)} className="group block w-full text-left">
                  <Thumb id={v.id} />
                  <p className="mt-2 line-clamp-2 text-[14px] leading-snug font-semibold">{v.title}</p>
                  <p className="mt-0.5 text-[12px] text-muted">{new Date(v.published).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex items-center">
        <p className="text-[13px] text-muted">PSA 투어 경기 결과, 최근 경기부터</p>
        <label className="ml-auto flex items-center gap-1.5 text-[13.5px] text-muted">
          <input type="checkbox" checked={korOnly} onChange={(e) => setKorOnly(e.target.checked)} className="accent-teal" />
          한국 선수 경기만
        </label>
      </div>
      {list.length === 0 && <Card className="mt-4 text-muted">최근 한국 선수 경기 결과가 없어요.</Card>}
      {[...byTournament].slice(0, 12).map(([name, ms]) => (
        <section key={name} className="mt-6">
          <h3 className="text-[17px] font-extrabold">{name}</h3>
          <ul className="mt-2 grid gap-2 md:grid-cols-2">
            {ms.slice(0, 8).map((m) => (
              <MatchCard key={m.id} m={m} video={findVideo(m, videos)} onPlay={onPlay} />
            ))}
          </ul>
          {ms.length > 8 && <p className="mt-2 text-[13px] text-muted">외 {ms.length - 8}경기</p>}
        </section>
      ))}
    </>
  )
}

function MatchCard({ m, video, onPlay }: { m: Match; video: Video | null; onPlay: (v: Video) => void }) {
  const win = m.players[0].games >= m.players[1]?.games ? 0 : 1
  const final = /final/i.test(m.round) && !/quarter|semi/i.test(m.round)
  const big = /final/i.test(m.round) // 8강 이상
  const surname = (n: string) => n.trim().split(/\s+/).at(-1)
  return (
    <li className={`rounded-[20px] border bg-card p-4 ${final ? 'border-teal' : 'border-line/80'}`}>
      <div className="flex items-center justify-between text-[12px] text-muted">
        <span className={final ? 'font-bold text-teal' : 'font-semibold'}>{roundLabel(m.round)}</span>
        <span>{new Date(m.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</span>
      </div>
      <table className="mt-2 w-full text-[14.5px]">
        <tbody>
          {m.players.map((p, i) => (
            <tr key={i} className={i === win ? 'font-bold' : 'text-muted'}>
              <td className="py-1 pr-2">
                <span className="mr-1.5 inline-block w-9 font-wide text-[10px] text-muted">{p.country ?? ''}</span>
                {p.name}
                {p.country === 'KOR' && <span className="ml-1.5 rounded bg-teal-soft px-1.5 text-[11px] text-teal-deep">한국</span>}
              </td>
              <td className="w-8 text-center font-wide text-[15px]">{p.games}</td>
              <td className="hidden w-28 text-right text-[12px] tracking-wider sm:table-cell">{p.scores.join(' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-right text-[11.5px] tracking-wider text-muted sm:hidden">
        {m.players[0].scores.map((s, i) => `${s}-${m.players[1]?.scores[i] ?? ''}`).join(', ')}
      </p>
      {video ? (
        <button
          type="button"
          onClick={() => onPlay(video)}
          className="mt-3 flex w-full items-center gap-2 rounded-xl bg-ink px-3 py-2.5 text-left text-[13.5px] font-bold text-white hover:bg-teal-deep"
        >
          <PlayIcon className="size-5 shrink-0 text-[#ff3d3d]" />
          하이라이트 보기
        </button>
      ) : (
        big &&
        m.players.length === 2 && (
          <div className="mt-2">
            <YoutubeSearch q={`${surname(m.players[0].name)} v ${surname(m.players[1].name)} ${m.tournament.replace(/\s*\d{4}$/, '')} highlights`} />
          </div>
        )
      )}
    </li>
  )
}

function RankingsView({ s, korea }: { s: State<Rankings>; korea: Korea | null }) {
  const [sex, setSex] = useState<'male' | 'female'>('male')
  if (s.error) return <Failed />
  if (!s.data) return <Skeleton rows={8} />
  const r = s.data[sex]
  const kr = korea?.ranking[sex === 'male' ? 'men' : 'women'] ?? []
  return (
    <>
      <div className="inline-flex gap-1 rounded-2xl bg-white p-1">
        {(['male', 'female'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={sex === k}
            onClick={() => setSex(k)}
            className="rounded-xl px-5 py-2 text-[14px] font-bold text-muted aria-pressed:bg-teal aria-pressed:text-white"
          >
            {k === 'male' ? '남자' : '여자'}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-0 md:p-0">
          <h3 className="px-5 pt-5 text-[17px] font-extrabold">PSA 세계 랭킹 Top 20</h3>
          <ol className="mt-2">
            {r.top.map((p) => (
              <li key={p.id} className="flex items-center gap-3 border-t border-line/60 px-5 py-2.5">
                <span className={`w-7 font-wide text-[15px] ${p.rank <= 3 ? 'text-teal' : ''}`}>{p.rank}</span>
                <Avatar name={p.name} src={p.picture} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold">{p.name}</p>
                  <p className="text-[12.5px] text-muted">
                    {countryName(p.country)}
                    {p.racket && ` · 라켓 ${p.racket}`}
                  </p>
                </div>
                <Change n={p.change} />
                <span className="hidden w-16 text-right text-[13px] text-muted sm:block">{p.points.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </Card>
        <div className="space-y-4">
          <Card>
            <h3 className="text-[17px] font-extrabold">세계 랭킹 속 한국 선수</h3>
            {r.korea.length === 0 ? (
              <p className="mt-2 text-[14px] text-muted">랭킹에 오른 선수가 없어요.</p>
            ) : (
              <ol className="mt-2 space-y-1.5">
                {r.korea.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 text-[14.5px]">
                    <span className="w-12 font-wide text-[13px] text-teal">#{p.rank}</span>
                    <span className="flex-1 font-semibold">{p.name}</span>
                    <Change n={p.change} />
                  </li>
                ))}
              </ol>
            )}
          </Card>
          {kr.length > 0 && (
            <Card>
              <h3 className="text-[17px] font-extrabold">대한스쿼시연맹 랭킹 · 일반부</h3>
              <ol className="mt-2 space-y-1.5">
                {kr.map((p) => (
                  <li key={p.rank + p.name} className="flex items-center gap-3 text-[14.5px]">
                    <span className="w-7 font-wide text-[13px] text-teal">{p.rank}</span>
                    <span className="flex-1 font-semibold">{p.name}</span>
                    <span className="truncate text-[12.5px] text-muted">{p.team}</span>
                    <span className="w-10 text-right text-[13px] text-muted">{p.points}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  const [broken, setBroken] = useState(false)
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
  if (!src || broken)
    return <span className="grid size-9 shrink-0 place-items-center rounded-full bg-silver-soft font-wide text-[10px] text-teal-deep">{initials}</span>
  return <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="size-9 shrink-0 rounded-full bg-silver-soft object-cover" />
}

function Thumb({ id }: { id: string }) {
  return (
    <span className="relative block aspect-video overflow-hidden rounded-2xl bg-ink">
      <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-[1.03]" />
      <span className="absolute inset-0 grid place-items-center bg-black/10 transition group-hover:bg-black/25">
        <span className="grid size-12 place-items-center rounded-full bg-white/95 shadow-lg">
          <PlayIcon className="ml-0.5 size-6 text-ink" />
        </span>
      </span>
    </span>
  )
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
    </svg>
  )
}

function YoutubeSearch({ q }: { q: string }) {
  return (
    <a
      href={youtubeSearch(q)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink"
    >
      <PlayIcon className="size-3.5 text-[#e62117]" />
      유튜브에서 찾기
    </a>
  )
}

/** 페이지 안에서 바로 보는 유튜브 플레이어 */
function Player({ video, onClose }: { video: Video; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label={video.title} className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-3 backdrop-blur-sm md:p-8" onClick={onClose}>
      <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start gap-3 text-white">
          <p className="min-w-0 flex-1 text-[15px] leading-snug font-semibold md:text-[17px]">{video.title}</p>
          <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-white/15 px-3.5 py-1.5 text-[13px] font-bold hover:bg-white/25" autoFocus>
            닫기
          </button>
        </div>
        <div className="aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&playsinline=1`}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="size-full"
          />
        </div>
        <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-white/75 hover:text-white">
          유튜브에서 열기 <External className="size-3.5" />
        </a>
      </div>
    </div>
  )
}

function Change({ n }: { n: number }) {
  if (!n) return <span className="w-9 text-center text-[12px] text-muted/60">–</span>
  // 순위 변동: 음수면 순위가 올랐다는 뜻
  const up = n < 0
  return <span className={`w-9 text-center text-[12px] font-bold ${up ? 'text-teal' : 'text-tin'}`}>{up ? `▲${-n}` : `▼${n}`}</span>
}

function StateBadge({ state, days }: { state: 'upcoming' | 'live' | 'done'; days: number }) {
  if (state === 'live') return <span className="mt-1.5 inline-block rounded-full bg-teal px-2 py-0.5 text-[10.5px] font-bold text-white">진행 중</span>
  if (state === 'done') return <span className="mt-1.5 inline-block rounded-full bg-silver-soft px-2 py-0.5 text-[10.5px] font-semibold text-muted">종료</span>
  return <span className="mt-1.5 inline-block rounded-full bg-ink px-2 py-0.5 text-[10.5px] font-bold text-white">D-{days}</span>
}

function Chip({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${strong ? 'bg-teal-soft text-teal-deep' : 'bg-court text-muted'}`}>{children}</span>
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="grid gap-2 md:grid-cols-2" aria-busy="true" aria-label="불러오는 중">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-[20px] bg-white/70" />
      ))}
    </div>
  )
}

function Failed() {
  return <Card className="text-muted">데이터를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</Card>
}
