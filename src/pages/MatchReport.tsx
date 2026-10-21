import { formatDuration, type MatchSummary } from '../game/matchStats'

export function MatchReport({ summary: s, rally = false }: { summary: MatchSummary; rally?: boolean }) {
  return (
    <section className="mt-4 rounded-2xl bg-court p-4 text-ink" aria-label={rally ? '이번 랠리 기록' : '경기 기록'}>
      <h3 className="text-[15px] font-extrabold">{rally ? '이번 랠리 기록' : '경기 기록'}</h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
        <div><dt className="text-muted">{rally ? '랠리 시간' : '경기 진행'}</dt><dd className="font-bold">{formatDuration(s.seconds)}</dd></div>
        <div><dt className="text-muted">누적 타구</dt><dd className="font-bold">{s.hits}회</dd></div>
        {!rally && <><div><dt className="text-muted">공이 오간 시간</dt><dd className="font-bold">{formatDuration(s.rallySeconds)}</dd></div><div><dt className="text-muted">완료 랠리 / 최장 타구</dt><dd className="font-bold">{s.points}회 / {s.bestRally}회</dd></div></>}
      </dl>
      {s.mode === 'realistic' && <table className="mt-4 w-full text-right text-[11px] tabular-nums">
        <caption className="sr-only">선수별 이동·칼로리·체력 기록</caption>
        <thead><tr className="border-b border-ink/10"><th className="pb-2 text-left font-normal text-muted">선수별 현황</th><th className="pb-2">나</th><th className="pb-2">상대</th></tr></thead>
        <tbody>
          <tr><th className="pt-2 text-left font-normal">이동 거리</th><td className="pt-2">{s.you.distance.toFixed(1)}m</td><td className="pt-2">{s.cpu.distance.toFixed(1)}m</td></tr>
          <tr className="font-bold text-teal-deep"><th className="pt-2 text-left">예상 총 칼로리</th><td className="pt-2">{s.you.calories.toFixed(1)} kcal</td><td className="pt-2">{s.cpu.calories.toFixed(1)} kcal</td></tr>
          <tr className="text-muted"><th className="pt-1 text-left font-normal">활동분</th><td className="pt-1">{s.you.activeCalories.toFixed(1)}</td><td className="pt-1">{s.cpu.activeCalories.toFixed(1)}</td></tr>
          <tr className="text-muted"><th className="pt-1 text-left font-normal">안정 시 대사분</th><td className="pt-1">{s.you.restCalories.toFixed(1)}</td><td className="pt-1">{s.cpu.restCalories.toFixed(1)}</td></tr>
          <tr><th className="pt-2 text-left font-normal">체력 소모 / 회복</th><td className="pt-2">{Math.round(s.you.spent)} / {Math.round(s.you.recovered)}</td><td className="pt-2">{Math.round(s.cpu.spent)} / {Math.round(s.cpu.recovered)}</td></tr>
        </tbody>
      </table>}
      <p className="mt-3 text-[10px] leading-relaxed text-muted">타구는 서브를 포함한 양쪽의 타격 합계예요. 충전·일시정지 시간은 제외해요.</p>
      {s.mode === 'realistic' && <p className="mt-2 text-[10px] leading-relaxed text-muted">체력은 게임 단위이며 칼로리는 70kg 성인의 실제 운동 환산 추정치예요. 총 칼로리에 안정 시 대사량(1 MET)이 이미 포함돼요. 개인 기초대사량 측정치나 게임 조작자의 실제 소모량은 아니에요.</p>}
    </section>
  )
}
