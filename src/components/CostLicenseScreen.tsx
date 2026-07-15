import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell,
} from "recharts";

// ─── Mock 데이터 (실제 API 연동 없음) ─────────────────────────────────────────
// 총 배정 예산 / 실결제 누계 / 잔여 예산은 서로 정확히 합산이 맞도록 고정한다.

const TOTAL_BUDGET = 499_363_200;
const TOTAL_PAID = 119_840_239;
const REMAINING = TOTAL_BUDGET - TOTAL_PAID; // 379,522,961
const BURN_RATE_PCT = Math.round((TOTAL_PAID / TOTAL_BUDGET) * 100); // 24
const THIS_MONTH_EXPECTED = 35_736_075;

function formatWon(n: number): string {
  return `₩${Math.round(n).toLocaleString("ko-KR")}`;
}

function formatWonShort(n: number): string {
  if (n >= 100_000_000) return `₩${(n / 100_000_000).toFixed(1)}억`;
  return `₩${Math.round(n / 10_000).toLocaleString("ko-KR")}만`;
}

// ─── 블록 1: KPI 카드 ─────────────────────────────────────────────────────────

const KPI_CARDS: { label: string; value: string; emphasize?: boolean; tone?: "primary" | "warn" }[] = [
  { label: "총 배정 예산",       value: formatWon(TOTAL_BUDGET) },
  { label: "실결제 누계",        value: formatWon(TOTAL_PAID) },
  { label: "잔여 예산",          value: formatWon(REMAINING), emphasize: true, tone: "primary" },
  { label: "소진율",             value: `${BURN_RATE_PCT}%`,  emphasize: true, tone: "warn" },
  { label: "이번 달 예상 차감",  value: formatWon(THIS_MONTH_EXPECTED) },
];

function KpiCard({ card }: { card: (typeof KPI_CARDS)[number] }) {
  if (card.emphasize) {
    const toneCls =
      card.tone === "warn"
        ? "border-orange-200 bg-orange-50"
        : "border-primary/30 bg-primary/5";
    const valueCls = card.tone === "warn" ? "text-orange-600" : "text-primary";
    return (
      <div className={`rounded-md border px-5 py-4 ${toneCls}`}>
        <p className="text-[11px] text-muted-foreground">{card.label}</p>
        <p className={`text-[26px] font-bold leading-tight mt-1 ${valueCls}`}>{card.value}</p>
      </div>
    );
  }
  return (
    <div className="bg-card border border-border rounded-md px-5 py-4">
      <p className="text-[11px] text-muted-foreground">{card.label}</p>
      <p className="text-[20px] font-semibold text-foreground leading-tight mt-1">{card.value}</p>
    </div>
  );
}

// ─── 블록 2: 예산 소진 추이 ───────────────────────────────────────────────────
// 실적(1~6월, 누적) + 6월 이후를 최근 월간 증가 속도로 연장한 예측 점선.

const START_YEAR = 2026;

const MONTHLY_ACTUAL = [
  15_000_000,
  33_120_000,
  52_480_000,
  74_150_000,
  98_260_000,
  119_840_239, // 실결제 누계와 정확히 일치
];

function monthLabel(absoluteMonthIndex: number): { year: number; month: number; label: string } {
  const year = START_YEAR + Math.floor((absoluteMonthIndex - 1) / 12);
  const month = ((absoluteMonthIndex - 1) % 12) + 1;
  return { year, month, label: `${month}월` };
}

// 최근 월간 증가 속도(5월 → 6월)를 "현재 페이스"로 사용
const MONTHLY_PACE = MONTHLY_ACTUAL[5] - MONTHLY_ACTUAL[4];

interface TrendPoint { label: string; actual: number | null; forecast: number | null }

const trendData: TrendPoint[] = MONTHLY_ACTUAL.map((v, i) => ({
  label: monthLabel(i + 1).label,
  actual: v,
  forecast: i === MONTHLY_ACTUAL.length - 1 ? v : null, // 마지막 실적점을 예측선과 이어붙임
}));

let burnoutLabel = "";
{
  let cumulative = TOTAL_PAID;
  let idx = MONTHLY_ACTUAL.length + 1; // 7월부터
  while (cumulative < TOTAL_BUDGET && idx < MONTHLY_ACTUAL.length + 60) {
    cumulative += MONTHLY_PACE;
    const m = monthLabel(idx);
    trendData.push({ label: m.label, actual: null, forecast: Math.min(cumulative, TOTAL_BUDGET * 1.02) });
    if (cumulative >= TOTAL_BUDGET) burnoutLabel = `${m.year}년 ${m.month}월`;
    idx += 1;
  }
}

function TrendChart() {
  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trendData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            interval={Math.max(0, Math.floor(trendData.length / 8))}
          />
          <YAxis
            tickFormatter={(v) => formatWonShort(v)}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            formatter={(value: number) => formatWon(value)}
            contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "var(--border)" }}
          />
          <ReferenceLine
            y={TOTAL_BUDGET}
            stroke="#9CA3AF"
            strokeDasharray="4 4"
            label={{ value: `총 배정 ${formatWonShort(TOTAL_BUDGET)}`, position: "insideTopRight", fontSize: 11, fill: "#6B7280" }}
          />
          <Line type="monotone" dataKey="actual" stroke="#1764E8" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} name="실적" />
          <Line type="monotone" dataKey="forecast" stroke="#1764E8" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls name="예측" />
        </LineChart>
      </ResponsiveContainer>
      {burnoutLabel && (
        <p className="text-[11px] text-orange-600 font-medium mt-2 text-center">
          이 속도면 예산 소진 예상: {burnoutLabel}
        </p>
      )}
    </div>
  );
}

// ─── 블록 3: 항목별 비중 ──────────────────────────────────────────────────────

const COST_BREAKDOWN = [
  { name: "SharePoint Plan 1 (600User)", value: 58_000_000, color: "#2563EB" },
  { name: "생성형 AI 솔루션(Gemini)",     value: 35_000_000, color: "#7C3AED" },
  { name: "GitHub Copilot 갱신",          value: 18_500_000, color: "#F97316" },
  { name: "GitHub Copilot 추가",          value: 8_340_239,  color: "#059669" },
].sort((a, b) => b.value - a.value);

function BreakdownChart() {
  return (
    <div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={COST_BREAKDOWN} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tick={{ fontSize: 11, fill: "var(--foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip formatter={(value: number) => formatWon(value)} contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "var(--border)" }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
              {COST_BREAKDOWN.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-2 mt-3">
        {COST_BREAKDOWN.map((item) => {
          const pct = (item.value / TOTAL_PAID) * 100;
          return (
            <div key={item.name} className="flex items-center justify-between text-[12px]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-foreground truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{formatWon(item.value)}</span>
                <span className="text-foreground font-medium w-10 text-right">{pct.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SectionCard ──────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      {title && <div className="px-5 py-3 border-b border-border"><h3 className="text-[13px] font-semibold text-foreground">{title}</h3></div>}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CostLicenseScreen() {
  return (
    <div className="px-10 py-8">
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-foreground tracking-tight">비용·라이선스</h1>
        <p className="text-[13px] text-muted-foreground mt-1">AI 자산 예산 소진 현황과 항목별 비용 비중을 확인합니다.</p>
      </div>

      {/* 블록 1: KPI 스트립 */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {KPI_CARDS.map((card) => (
          <KpiCard key={card.label} card={card} />
        ))}
      </div>

      {/* 블록 2 + 3: 2단 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <SectionCard title="예산 소진 추이">
            <TrendChart />
          </SectionCard>
        </div>
        <div className="col-span-1">
          <SectionCard title="항목별 비중">
            <BreakdownChart />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
