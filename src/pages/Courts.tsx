import { useEffect, useMemo, useState } from "react";
import { Card, PageHead, Section } from "../components/ui";
import { loadData } from "../data/live";

// public/data/courts.json의 모양(scripts/fetch-courts.mjs가 만든다)
type Facility = "shower" | "toilet" | "parking" | "locker";
type Court = {
  id: string;
  name: string;
  region: string | null;
  district: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  courts: number | null;
  capacity: number | null;
  facilities: Record<Facility, boolean | null>;
  rental: string | null;
  type: "공공" | "민간";
  restricted?: boolean;
  phone: string | null;
  link: string | null;
  source: string;
};
type CourtsData = {
  updated?: string;
  asOf: string;
  sources: { name: string; url: string; note: string }[];
  courts: Court[];
};

const REGIONS = [
  "서울",
  "경기",
  "인천",
  "강원",
  "충북",
  "충남",
  "대전",
  "세종",
  "전북",
  "전남",
  "광주",
  "경북",
  "경남",
  "대구",
  "울산",
  "부산",
  "제주",
];
const FACILITY_LABEL: Record<Facility, string> = {
  shower: "샤워",
  toilet: "화장실",
  parking: "주차",
  locker: "락커",
};
const PAGE = 24;

type Sort = "courts" | "name" | "near";

/** 바깥 자료의 링크는 http(s)만 연다 */
function safeUrl(u: string | null) {
  return u && /^https?:\/\//i.test(u) ? u : null;
}

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.hypot(x, y) * 6371;
}

export default function Courts() {
  const [data, setData] = useState<CourtsData | null>(null);
  const [error, setError] = useState(false);
  const [region, setRegion] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hideRestricted, setHideRestricted] = useState(true);
  const [publicOnly, setPublicOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("courts");
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState<"idle" | "busy" | "denied">("idle");
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    loadData<CourtsData>("courts.json").then(setData, () => setError(true));
  }, []);

  const base = useMemo(
    () =>
      (data?.courts ?? []).filter(
        (c) =>
          (!hideRestricted || !c.restricted) &&
          (!publicOnly || c.type === "공공"),
      ),
    [data, hideRestricted, publicOnly],
  );

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of base)
      if (c.region) m.set(c.region, (m.get(c.region) ?? 0) + 1);
    return m;
  }, [base]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const l = base.filter(
      (c) =>
        (!region || c.region === region) &&
        (!q ||
          `${c.name} ${c.address ?? ""} ${c.district ?? ""}`
            .toLowerCase()
            .includes(q)),
    );
    const dist = (c: Court) =>
      here && c.lat != null && c.lng != null
        ? km(here, { lat: c.lat, lng: c.lng })
        : Infinity;
    return l
      .map((c) => ({ c, d: dist(c) }))
      .sort((a, b) =>
        sort === "near"
          ? a.d - b.d
          : sort === "courts"
            ? (b.c.courts ?? 0) - (a.c.courts ?? 0) ||
              a.c.name.localeCompare(b.c.name, "ko")
            : a.c.name.localeCompare(b.c.name, "ko"),
      );
  }, [base, region, query, sort, here]);

  const totalCourts = list.reduce((s, { c }) => s + (c.courts ?? 0), 0);
  const unknownCourts = list.filter(({ c }) => c.courts == null).length;

  const pickRegion = (r: string | null) => {
    setRegion(r);
    setShown(PAGE);
  };

  const locate = () => {
    if (!navigator.geolocation) return setLocating("denied");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setHere({ lat: p.coords.latitude, lng: p.coords.longitude });
        setSort("near");
        setRegion(null);
        setLocating("idle");
        setShown(PAGE);
      },
      () => setLocating("denied"),
      { timeout: 10000, maximumAge: 600000 },
    );
  };

  return (
    <>
      <PageHead eyebrow="COURTS" title="코트 찾기">
        전국 스쿼시장의 위치와 코트 수를 지역별로 모았어요. 대관이나 일일 입장
        조건은 센터마다 달라서, 가기 전에 전화로 확인하는 게 가장 정확해요.
      </PageHead>

      <Section kicker="FILTER" title="어디에서 칠까요">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="지역">
          <RegionChip
            label="전국"
            count={base.length}
            active={!region}
            onClick={() => pickRegion(null)}
          />
          {REGIONS.map((r) => (
            <RegionChip
              key={r}
              label={r}
              count={counts.get(r) ?? 0}
              active={region === r}
              onClick={() => pickRegion(r)}
            />
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
            placeholder="센터 이름이나 동네로 찾기 (예: 강남, 체육센터)"
            className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-[16px] outline-none focus:border-teal"
            aria-label="센터 이름이나 동네로 찾기"
          />
          <button
            type="button"
            onClick={locate}
            disabled={locating === "busy"}
            className="rounded-2xl bg-ink px-5 py-3 text-[15px] font-bold text-white transition hover:bg-teal-deep disabled:opacity-60"
          >
            {locating === "busy"
              ? "위치 찾는 중…"
              : here
                ? "내 위치 다시 찾기"
                : "내 주변 코트"}
          </button>
        </div>
        {locating === "denied" && (
          <p className="mt-2 text-[14px] text-tin">
            위치를 가져오지 못했어요. 브라우저의 위치 권한을 허용하거나 지역을
            직접 골라 주세요.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-muted">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hideRestricted}
              onChange={(e) => setHideRestricted(e.target.checked)}
              className="size-4 accent-teal"
            />
            회원·주민 전용으로 보이는 곳 숨기기
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={publicOnly}
              onChange={(e) => setPublicOnly(e.target.checked)}
              className="size-4 accent-teal"
            />
            공공 시설만
          </label>
          <label className="flex items-center gap-2">
            정렬
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-xl border border-line bg-card px-2.5 py-1.5 text-[14px] text-ink"
            >
              <option value="courts">코트 많은 순</option>
              <option value="name">이름순</option>
              <option value="near" disabled={!here}>
                가까운 순{here ? "" : " (내 주변 코트를 먼저 눌러 주세요)"}
              </option>
            </select>
          </label>
        </div>
      </Section>

      <Section
        kicker="AT A GLANCE"
        title={`${region ?? (here && sort === "near" ? "내 주변" : "전국")} 현황`}
      >
        {error ? (
          <Card>
            <p className="text-[15px] text-muted">
              코트 목록을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.
            </p>
          </Card>
        ) : !data ? (
          <Card>
            <p className="text-[15px] text-muted">
              코트 목록을 불러오는 중이에요…
            </p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Stat value={list.length} unit="곳" label="스쿼시장" />
              <Stat
                value={totalCourts}
                unit="면"
                label={
                  unknownCourts
                    ? `코트 (${unknownCourts}곳은 코트 수 모름)`
                    : "코트"
                }
              />
              <Stat
                value={totalCourts * 2}
                unit="명"
                label="동시에 칠 수 있는 인원 (단식 기준 추정)"
              />
            </div>

            <ul className="mt-5 grid gap-3 md:grid-cols-2">
              {list.slice(0, shown).map(({ c, d }) => (
                <CourtCard
                  key={c.id}
                  c={c}
                  distance={Number.isFinite(d) ? d : null}
                />
              ))}
            </ul>
            {list.length === 0 && (
              <p className="mt-4 text-[15px] text-muted">
                조건에 맞는 곳이 없어요. 검색어를 지우거나 다른 지역을 골라
                보세요.
              </p>
            )}
            {list.length > shown && (
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE)}
                className="mt-4 w-full rounded-2xl border border-line bg-card py-3 text-[15px] font-bold transition hover:border-teal hover:text-teal"
              >
                {Math.min(PAGE, list.length - shown)}곳 더 보기 ({shown}/
                {list.length})
              </button>
            )}
          </>
        )}
      </Section>

      <Section kicker="ABOUT THE DATA" title="자료에 대해">
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <h3 className="font-extrabold">샤워·화장실·주차 정보</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
              시설 정보와 수용 인원을 공개한 전국 자료가 아직 없어요. 센터
              안내에 분명히 적힌 경우에만 표시하고, 나머지는 추측하지 않고 비워
              뒀어요. 동시 이용 인원은 코트 한 면에 두 명(단식)으로 계산한
              값이에요.
            </p>
          </Card>
          <Card>
            <h3 className="font-extrabold">출처와 갱신</h3>
            <ul className="mt-1.5 space-y-1.5 text-[15px] leading-relaxed text-muted">
              {data?.sources.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-ink underline underline-offset-4"
                  >
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[14px] text-muted">
              {data ? `${data.asOf} 기준. ` : ""}목록은 3시간마다 새로 받아요.
              공공·민간, 회원 전용 여부는 이름으로 짐작한 값이라 틀릴 수 있어요.
            </p>
          </Card>
        </div>
      </Section>
    </>
  );
}

function RegionChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="rounded-full border border-line bg-card px-3.5 py-1.5 text-[14px] font-semibold transition hover:border-teal/50 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white"
    >
      {label} <span className="font-normal opacity-60">{count}</span>
    </button>
  );
}

function Stat({
  value,
  unit,
  label,
}: {
  value: number;
  unit: string;
  label: string;
}) {
  return (
    <div className="rounded-[20px] border border-line/80 bg-card p-4">
      <p className="text-[26px] font-extrabold tracking-[-0.02em] md:text-[34px]">
        {value.toLocaleString("ko-KR")}
        <span className="ml-0.5 text-[15px] font-bold text-muted">{unit}</span>
      </p>
      <p className="mt-0.5 text-[12.5px] leading-snug text-muted md:text-[13.5px]">
        {label}
      </p>
    </div>
  );
}

function CourtCard({ c, distance }: { c: Court; distance: number | null }) {
  const known = (Object.keys(FACILITY_LABEL) as Facility[]).filter(
    (f) => c.facilities[f] != null,
  );
  const where = [c.name, c.district].filter(Boolean).join(" ");
  return (
    <li className="flex flex-col rounded-[22px] border border-line/80 bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[17px] font-extrabold leading-snug">{c.name}</h3>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">
            {c.address ?? `${c.region ?? ""} ${c.district ?? ""}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[22px] font-extrabold leading-none text-teal">
            {c.courts ?? "?"}
            <span className="ml-0.5 text-[13px] font-bold text-muted">면</span>
          </p>
          {distance != null && (
            <p className="mt-1 text-[12.5px] text-muted">
              {distance < 10 ? distance.toFixed(1) : Math.round(distance)}km
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[12.5px] font-semibold">
        <span
          className={`rounded-full px-2.5 py-0.5 ${c.type === "공공" ? "bg-teal-soft text-teal-deep" : "bg-silver-soft text-ink"}`}
        >
          {c.type}
        </span>
        {c.restricted && (
          <span className="rounded-full bg-[#fbecea] px-2.5 py-0.5 text-tin">
            회원·주민 전용일 수 있음
          </span>
        )}
        {c.courts != null && (
          <span className="rounded-full bg-court px-2.5 py-0.5 text-muted">
            동시 {c.courts * 2}명
          </span>
        )}
        {known.map((f) => (
          <span
            key={f}
            className={`rounded-full px-2.5 py-0.5 ${c.facilities[f] ? "bg-teal-soft text-teal-deep" : "bg-court text-muted line-through"}`}
          >
            {FACILITY_LABEL[f]}
          </span>
        ))}
      </div>
      {c.rental && (
        <p className="mt-2.5 rounded-xl bg-court px-3 py-2 text-[13.5px] leading-relaxed">
          {c.rental}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 text-[14px] font-semibold">
        {c.phone && (
          <a
            href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}
            className="rounded-xl bg-ink px-3.5 py-2 text-white transition hover:bg-teal-deep"
          >
            {c.phone}
          </a>
        )}
        {c.lat != null && c.lng != null && (
          <a
            href={`https://map.kakao.com/link/map/${encodeURIComponent(c.name)},${c.lat},${c.lng}`}
            target="_blank"
            rel="noreferrer"
            className="text-teal underline underline-offset-4"
          >
            카카오맵
          </a>
        )}
        <a
          href={`https://map.naver.com/p/search/${encodeURIComponent(where)}`}
          target="_blank"
          rel="noreferrer"
          className="text-teal underline underline-offset-4"
        >
          네이버 지도
        </a>
        {safeUrl(c.link) && (
          <a
            href={safeUrl(c.link)!}
            target="_blank"
            rel="noreferrer"
            className="text-muted underline underline-offset-4"
          >
            SNS
          </a>
        )}
        {safeUrl(c.source) && (
          <a
            href={safeUrl(c.source)!}
            target="_blank"
            rel="noreferrer"
            className="text-muted underline underline-offset-4"
          >
            출처
          </a>
        )}
      </div>
    </li>
  );
}
