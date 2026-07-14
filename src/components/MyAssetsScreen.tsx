import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle2, AlertTriangle,
  RotateCcw, Star, MessageSquareWarning, Users, Building2,
  Activity, TrendingUp, PlusCircle, StopCircle,
} from "lucide-react";
import { useAssets } from "../context/AssetContext";
import { ASSET_STATUS_LABELS, ASSET_STATUS_CHIP } from "../data/types";
import type { AIAsset, AssetStatus } from "../data/types";

// ─── Demo registrant ID ───────────────────────────────────────────────────────

const DEMO_REGISTRANT_ID = "demo-registrant-001";

const PRE_PUBLISH_STATUSES = new Set<AssetStatus>([
  "DRAFT", "AUTO_CHECK", "REVIEW_PENDING", "IN_REVIEW",
  "REVISION_REQUESTED", "RESUBMITTED",
]);

// ─── Journey (3단계 바) + 상세줄 ───────────────────────────────────────────────
// 상단 진행 바는 "제출 → 심의 중 → 심의 완료" 3단계로 고정한다. 보완요청·재제출·
// 조건부승인·확인중·사용중지 같은 세부 상태는 배지를 늘리는 대신 바 아래
// 상세줄 하나로 표시한다 — 바는 한 번 지나가는 여정, 상세줄은 지금 상태.
// 확인 중/사용 중지는 게시 후 운영 상태이므로 바를 "심의 완료"에 멈춰 둔 채
// 상세줄만 바꾼다(바가 뒤로 가는 것처럼 보이면 등록자가 혼란스러워한다).

const JOURNEY_LABELS = ["제출", "심의 중", "심의 완료"] as const;

function getJourneyStage(status: AssetStatus): 1 | 2 | 3 {
  if (status === "DRAFT" || status === "AUTO_CHECK") return 1;
  if ((["REVIEW_PENDING", "IN_REVIEW", "REVISION_REQUESTED", "RESUBMITTED"] as AssetStatus[]).includes(status)) return 2;
  return 3;
}

type DetailTone = "neutral" | "warning" | "danger" | "success";
interface StatusDetail { text: string; tone: DetailTone; org: string }
interface StatusDetailCtx {
  revisionNotes: string[];
  checkingInfo?: { previousStatus: AssetStatus; errorType: string; reportedAt: string };
}

function getStatusDetail(asset: AIAsset, ctx: StatusDetailCtx): StatusDetail {
  switch (asset.status) {
    case "DRAFT":
      return { text: "작성 중 — 아직 제출 전입니다.", tone: "neutral", org: "등록자 본인" };
    case "AUTO_CHECK":
      return { text: "자동 사전검사 진행 중", tone: "neutral", org: "시스템" };
    case "REVIEW_PENDING":
      return { text: "심의 대기 중", tone: "neutral", org: "거버넌스 운영팀" };
    case "IN_REVIEW":
      return { text: "심의 진행 중", tone: "neutral", org: "거버넌스 운영팀" };
    case "REVISION_REQUESTED": {
      const reason = ctx.revisionNotes[0] ?? "보완이 필요합니다.";
      return { text: `결과 | 보완 요청 | 사유: ${reason}`, tone: "warning", org: "등록자 본인" };
    }
    case "RESUBMITTED":
      return { text: "재제출 완료 — 재심의 대기 중", tone: "neutral", org: "거버넌스 운영팀" };
    case "CONDITIONAL_APPROVAL":
      return { text: "결과 | 조건부 승인 | 승인 조건 이행 여부를 확인하세요.", tone: "success", org: "등록자 본인" };
    case "PUBLISHED":
      return { text: "정상 게시 중", tone: "success", org: "—" };
    case "CHECKING": {
      const info = ctx.checkingInfo;
      return {
        text: `확인 중 — 오류 제보 접수, 점검 중${info?.errorType ? ` (${info.errorType})` : ""}`,
        tone: "warning",
        org: "거버넌스 운영팀",
      };
    }
    case "SUSPENDED": {
      const info = ctx.checkingInfo;
      return {
        text: `사용 중지 — 사유: ${info?.errorType ? `${info.errorType} 점검 결과 조치` : "운영팀 점검 결과 조치"}`,
        tone: "danger",
        org: "거버넌스 운영팀",
      };
    }
    case "RETIRED":
      return { text: "폐기됨", tone: "neutral", org: "—" };
    default:
      return { text: "처리 중", tone: "neutral", org: "거버넌스 운영팀" };
  }
}

function getExpectedDeadline(asset: AIAsset): string {
  const days = asset.review.stage === "DEEP_REVIEW" ? 7 : asset.review.stage === "OPERATION_REVIEW" ? 3 : 1;
  const base = new Date(asset.createdAt);
  base.setDate(base.getDate() + days);
  return base.toISOString().split("T")[0];
}

const TONE_CLS: Record<DetailTone, string> = {
  neutral: "bg-muted/40 text-foreground border-border",
  warning: "bg-orange-50 text-orange-700 border-orange-200",
  danger:  "bg-red-50 text-red-700 border-red-200",
  success: "bg-green-50 text-green-700 border-green-200",
};

function JourneyBar({ stage }: { stage: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center">
      {JOURNEY_LABELS.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done   = n < stage;
        const active = n === stage;
        return (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 ${
                done   ? "bg-primary text-primary-foreground"
                : active ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                : "bg-muted text-muted-foreground"
              }`}>
                {done ? <CheckCircle2 size={13} /> : n}
              </div>
              <span className={`text-[12px] whitespace-nowrap ${active ? "font-semibold text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}>
                {label}
              </span>
            </div>
            {i < JOURNEY_LABELS.length - 1 && (
              <div className={`w-10 h-px mx-2 flex-shrink-0 ${n < stage ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusDetailLine({ detail }: { detail: StatusDetail }) {
  return (
    <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded border text-[12px] font-medium ${TONE_CLS[detail.tone]}`}>
      {(detail.tone === "warning" || detail.tone === "danger") && <AlertTriangle size={13} className="flex-shrink-0" />}
      {detail.tone === "success" && <CheckCircle2 size={13} className="flex-shrink-0" />}
      <span>{detail.text}</span>
    </div>
  );
}

function nextActionLabel(status: AssetStatus): { text: string; urgent: boolean } {
  const map: Partial<Record<AssetStatus, { text: string; urgent: boolean }>> = {
    REVIEW_PENDING:       { text: "심의 결과 대기",      urgent: false },
    IN_REVIEW:            { text: "심의 진행 중",         urgent: false },
    REVISION_REQUESTED:   { text: "보완 요청 확인 필요",  urgent: true  },
    RESUBMITTED:          { text: "재심의 대기",           urgent: false },
    CONDITIONAL_APPROVAL: { text: "조건 확인",             urgent: false },
    PUBLISHED:            { text: "게시됨",                urgent: false },
    CHECKING:             { text: "오류 제보 확인 대기",   urgent: false },
    SUSPENDED:            { text: "원인 파악 후 재등록 검토", urgent: true },
  };
  return map[status] ?? { text: "처리 중", urgent: false };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      {title && (
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function MetricRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-[11px] text-muted-foreground flex-shrink-0">{label}</span>
      <span className="text-[12px] font-semibold text-foreground text-right">
        {value}
        {sub && <span className="text-[10px] font-normal text-muted-foreground ml-1">{sub}</span>}
      </span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MyAssetsScreen({ onOpenDetail }: { onOpenDetail?: (id: string) => void }) {
  const { assets, revisionNotes, approvalConditions, checkingInfo, dispatch } = useAssets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [correctionApplied, setCorrectionApplied] = useState(false);

  const myAssets = assets.filter(a => a.registrantUserId === DEMO_REGISTRANT_ID);
  const publishedAssets = myAssets.filter(a => a.status === "PUBLISHED" || a.status === "CONDITIONAL_APPROVAL");
  const inReviewAssets  = myAssets.filter(a => PRE_PUBLISH_STATUSES.has(a.status));
  const recentUserSum   = publishedAssets.reduce((s, a) => s + a.usage.recentUsers, 0);

  const selectedAsset = selectedId ? myAssets.find(a => a.id === selectedId) ?? null : null;

  function handleApplyCorrection(asset: AIAsset) {
    dispatch({ type: "PATCH_ASSET", id: asset.id, patch: { version: "1.1.0" } });
    setCorrectionApplied(true);
    toast.success("보완 내용이 반영되었습니다.", { description: "버전이 v1.1로 업데이트되었습니다.", duration: 2500 });
  }

  function handleResubmit(asset: AIAsset) {
    dispatch({ type: "UPDATE_STATUS", id: asset.id, status: "RESUBMITTED" });
    toast.success("재제출이 완료되었습니다.", { description: "재심의 대기 상태로 접수되었습니다.", duration: 3000 });
    setCorrectionApplied(false);
  }

  if (selectedAsset) {
    const isPrePublish = PRE_PUBLISH_STATUSES.has(selectedAsset.status);
    if (isPrePublish) {
      return (
        <PrePublishDetail
          asset={selectedAsset}
          revisionNotes={revisionNotes[selectedAsset.id] ?? []}
          approvalConditions={approvalConditions[selectedAsset.id] ?? []}
          checkingInfo={checkingInfo[selectedAsset.id]}
          correctionApplied={correctionApplied}
          onApplyCorrection={() => handleApplyCorrection(selectedAsset)}
          onResubmit={() => handleResubmit(selectedAsset)}
          onBack={() => { setSelectedId(null); setCorrectionApplied(false); }}
        />
      );
    }
    return (
      <PublishedDetail
        asset={selectedAsset}
        approvalConditions={approvalConditions[selectedAsset.id] ?? []}
        checkingInfo={checkingInfo[selectedAsset.id]}
        onViewInPlayground={onOpenDetail ? () => { onOpenDetail(selectedAsset.id); setSelectedId(null); } : undefined}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  const summaryCards = [
    { label: "내가 등록한 자산", value: myAssets.length, unit: "개",  note: "전체" },
    { label: "현재 게시 중",     value: publishedAssets.length, unit: "개", note: "PUBLISHED / 조건부 승인" },
    { label: "심의 진행 중",     value: inReviewAssets.length,  unit: "개", note: "심의 대기 · 심의 중 포함" },
    { label: "최근 30일 사용자", value: recentUserSum,           unit: "명", note: "게시 자산 합산" },
  ];

  return (
    <div className="px-10 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-foreground tracking-tight">내 자산</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          내가 등록한 AI 자산의 상태와 활용 현황을 관리합니다.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {summaryCards.map(card => (
          <div key={card.label} className="bg-card border border-border rounded-md px-5 py-4">
            <p className="text-[11px] text-muted-foreground">{card.label}</p>
            <p className="text-[28px] font-semibold text-foreground leading-tight mt-1">
              {card.value}
              <span className="text-[14px] font-normal text-muted-foreground ml-1">{card.unit}</span>
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">{card.note}</p>
          </div>
        ))}
      </div>

      {/* Asset grid */}
      <div className="grid grid-cols-4 gap-4">
        {myAssets.map(asset => {
          const isPrePublish = PRE_PUBLISH_STATUSES.has(asset.status);
          const chip = ASSET_STATUS_CHIP[asset.status];
          return (
            <div
              key={asset.id}
              onClick={() => setSelectedId(asset.id)}
              className="bg-card border border-border rounded-md overflow-hidden cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
            >
              {/* Card header */}
              <div className="px-4 pt-4 pb-3 border-b border-border/60">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                    {asset.assetTypeLabel}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${chip.bg} ${chip.text}`}>
                    {ASSET_STATUS_LABELS[asset.status]}
                  </span>
                </div>
                <h3 className="text-[13px] font-semibold text-foreground leading-snug">{asset.name}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5" style={{ fontFamily: "'DM Mono', monospace" }}>
                  v{asset.version} · {asset.visibility}
                </p>
              </div>

              {/* Card body */}
              <div className="px-4 py-3">
                {isPrePublish ? (
                  <PrePublishCardBody asset={asset} />
                ) : (
                  <PublishedCardBody asset={asset} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Asset card bodies ────────────────────────────────────────────────────────

function PrePublishCardBody({ asset }: { asset: AIAsset }) {
  const next = nextActionLabel(asset.status);
  return (
    <div className="flex flex-col gap-2">
      {asset.review.additionalReviews.length > 0 && (
        <div className="flex items-start justify-between text-[11px]">
          <span className="text-muted-foreground">추가 검토</span>
          <span className="text-blue-600 font-medium">{asset.review.additionalReviews.join(", ")}</span>
        </div>
      )}
      <div className="flex items-start justify-between text-[11px]">
        <span className="text-muted-foreground">담당 조직</span>
        <span className="text-foreground font-medium">{asset.ownerDepartment}</span>
      </div>
      <div className="mt-1 pt-2 border-t border-border/60">
        <span className={`flex items-center gap-1.5 text-[11px] ${next.urgent ? "text-orange-600 font-medium" : "text-muted-foreground"}`}>
          {next.urgent && <AlertTriangle size={11} />}
          {next.text}
        </span>
        <p className="text-[10px] text-muted-foreground mt-0.5">접수일: {asset.createdAt}</p>
      </div>
    </div>
  );
}

function PublishedCardBody({ asset }: { asset: AIAsset }) {
  const u = asset.usage;
  return (
    <div className="flex flex-col gap-0">
      <MetricRow label="누적 사용자"    value={`${u.totalCount.toLocaleString()}명`} />
      <MetricRow label="최근 30일"      value={`${u.recentUsers}명`} />
      {u.actionCount != null && (
        <MetricRow label={asset.usageActionLabel + " 횟수"} value={`${u.actionCount}회`} />
      )}
      <MetricRow label="사용 부서"      value={`${u.departmentCount}개`} />
      {u.favoriteCount != null && (
        <MetricRow label="즐겨찾기" value={`${u.favoriteCount}명`} />
      )}
      {u.issueCount != null && (
        <MetricRow label="오류 제보" value={`${u.issueCount}건`} />
      )}
      <p className="text-[10px] text-muted-foreground/70 mt-2 pt-1.5 border-t border-border/40">
        측정 기준: {u.measurementBasis}
      </p>
    </div>
  );
}

// ─── Pre-publish detail view ──────────────────────────────────────────────────

function PrePublishDetail({
  asset, revisionNotes, approvalConditions, checkingInfo, correctionApplied,
  onApplyCorrection, onResubmit, onBack,
}: {
  asset: AIAsset;
  revisionNotes: string[];
  approvalConditions: string[];
  checkingInfo?: { previousStatus: AssetStatus; errorType: string; reportedAt: string };
  correctionApplied: boolean;
  onApplyCorrection: () => void;
  onResubmit: () => void;
  onBack: () => void;
}) {
  const stage = getJourneyStage(asset.status);
  const detail = getStatusDetail(asset, { revisionNotes, checkingInfo });
  const chip = ASSET_STATUS_CHIP[asset.status];

  return (
    <div className="px-10 py-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft size={13} /> 목록으로
      </button>
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-[20px] font-semibold text-foreground tracking-tight">{asset.name}</h1>
        <span className={`inline-flex items-center px-2.5 py-1 rounded text-[12px] font-medium ${chip.bg} ${chip.text}`}>
          {ASSET_STATUS_LABELS[asset.status]}
        </span>
        <span className="text-[11px] text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
          v{asset.version}
        </span>
      </div>
      <p className="text-[12px] text-muted-foreground mb-6">{asset.category} · {asset.assetTypeLabel}</p>

      <div className="flex gap-6 items-start max-w-[960px]">
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <SectionCard title="진행 상황">
            <JourneyBar stage={stage} />
            <StatusDetailLine detail={detail} />
          </SectionCard>

          {/* REVISION_REQUESTED */}
          {asset.status === "REVISION_REQUESTED" && revisionNotes.length > 0 && (
            <SectionCard title="운영자 보완 요청">
              <div className="flex flex-col gap-2 mb-4">
                {revisionNotes.map((note, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-[12px] text-foreground">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-[10px] font-semibold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    {note}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 pt-3 border-t border-border">
                {!correctionApplied ? (
                  <button
                    onClick={onApplyCorrection}
                    className="h-8 px-4 rounded border border-primary/40 text-primary text-[12px] font-medium hover:bg-primary/5 transition-colors"
                  >
                    보완 내용 반영 (데모)
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-[12px] text-green-600">
                    <CheckCircle2 size={13} /> 보완 내용 반영 완료 — v1.1
                  </div>
                )}
                <button
                  onClick={onResubmit}
                  disabled={!correctionApplied}
                  className="flex items-center gap-1.5 h-8 px-4 rounded bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <RotateCcw size={12} /> 재제출
                </button>
              </div>
            </SectionCard>
          )}

          {/* RESUBMITTED */}
          {asset.status === "RESUBMITTED" && (
            <SectionCard>
              <div className="flex items-center gap-2 text-[12px] text-foreground">
                <CheckCircle2 size={14} className="text-green-600" />
                재제출이 완료되었습니다. 거버넌스 운영팀의 재심의 결과를 기다리고 있습니다.
              </div>
            </SectionCard>
          )}

          {/* CONDITIONAL_APPROVAL: show conditions */}
          {asset.status === "CONDITIONAL_APPROVAL" && approvalConditions.length > 0 && (
            <SectionCard title="승인 조건">
              <ul className="flex flex-col gap-1.5">
                {approvalConditions.map((c, i) => (
                  <li key={i} className="flex items-center gap-2 text-[12px] text-foreground">
                    <CheckCircle2 size={12} className="text-green-600 flex-shrink-0" /> {c}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          <SectionCard title="자산 정보">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-[12px]">
              {[
                { label: "유형",      value: asset.assetTypeLabel },
                { label: "카테고리",  value: asset.category },
                { label: "공개 범위", value: asset.visibility },
                { label: "실행 환경", value: asset.executionEnvironment.join(", ") },
                { label: "비용",      value: asset.cost.display },
              ].map(r => (
                <div key={r.label} className="flex gap-3">
                  <span className="text-muted-foreground w-20 flex-shrink-0">{r.label}</span>
                  <span className="text-foreground font-medium">{r.value}</span>
                </div>
              ))}
            </div>
            {asset.review.reasons.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-[11px] text-muted-foreground mb-1.5">심의 사유</p>
                <div className="flex flex-wrap gap-1.5">
                  {asset.review.reasons.map(r => (
                    <span key={r} className="inline-flex px-2 py-0.5 bg-orange-50 text-orange-700 text-[10px] rounded border border-orange-100">{r}</span>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right: status panel */}
        <div className="w-[220px] flex-shrink-0">
          <StatusPanel asset={asset} detail={detail} />
        </div>
      </div>
    </div>
  );
}

// ─── Published detail view ────────────────────────────────────────────────────

function PublishedDetail({
  asset, approvalConditions, checkingInfo, onViewInPlayground, onBack,
}: {
  asset: AIAsset;
  approvalConditions: string[];
  checkingInfo?: { previousStatus: AssetStatus; errorType: string; reportedAt: string };
  onViewInPlayground?: () => void;
  onBack: () => void;
}) {
  const chip = ASSET_STATUS_CHIP[asset.status];
  const stage = getJourneyStage(asset.status);
  const detail = getStatusDetail(asset, { revisionNotes: [], checkingInfo });
  const u = asset.usage;

  const usageMetrics = [
    { icon: <Users size={14} className="text-primary" />,               label: "누적 사용자",                   value: `${u.totalCount.toLocaleString()}명` },
    { icon: <TrendingUp size={14} className="text-blue-500" />,         label: "최근 30일 사용자",               value: `${u.recentUsers}명` },
    ...(u.actionCount != null ? [{ icon: <Activity size={14} className="text-indigo-500" />, label: `${asset.usageActionLabel} 횟수`, value: `${u.actionCount}회` }] : []),
    { icon: <Building2 size={14} className="text-teal-500" />,          label: "사용 부서",                     value: `${u.departmentCount}개` },
    ...(u.favoriteCount != null ? [{ icon: <Star size={14} className="text-amber-500" />, label: "즐겨찾기",      value: `${u.favoriteCount}명` }] : []),
    ...(u.issueCount != null ? [{ icon: <MessageSquareWarning size={14} className="text-red-400" />, label: "오류 제보", value: `${u.issueCount}건` }] : []),
  ];

  return (
    <div className="px-10 py-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft size={13} /> 목록으로
      </button>
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-[20px] font-semibold text-foreground tracking-tight">{asset.name}</h1>
        <span className={`inline-flex items-center px-2.5 py-1 rounded text-[12px] font-medium ${chip.bg} ${chip.text}`}>
          {ASSET_STATUS_LABELS[asset.status]}
        </span>
        <span className="text-[11px] text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
          v{asset.version}
        </span>
      </div>
      <p className="text-[12px] text-muted-foreground mb-6">{asset.category} · {asset.assetTypeLabel} · {asset.visibility}</p>

      <div className="flex gap-6 items-start max-w-[960px]">
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* 진행 상황: 바는 심의 완료에 멈춘 채, 게시 후 운영 상태는 상세줄로만 표시 */}
          <SectionCard title="진행 상황">
            <JourneyBar stage={stage} />
            <StatusDetailLine detail={detail} />
          </SectionCard>

          {/* Usage metrics */}
          <SectionCard title="활용 현황">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {usageMetrics.map(m => (
                <div key={m.label} className="bg-muted/30 rounded-md p-3 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    {m.icon}
                    <span className="text-[11px] text-muted-foreground">{m.label}</span>
                  </div>
                  <p className="text-[18px] font-semibold text-foreground leading-tight">{m.value}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              측정 기준: {u.measurementBasis} · 마지막 업데이트: {asset.lastUpdated}
            </p>
          </SectionCard>

          {/* Conditional approval conditions */}
          {asset.status === "CONDITIONAL_APPROVAL" && approvalConditions.length > 0 && (
            <SectionCard title="승인 조건">
              <ul className="flex flex-col gap-1.5">
                {approvalConditions.map((c, i) => (
                  <li key={i} className="flex items-center gap-2 text-[12px] text-foreground">
                    <CheckCircle2 size={12} className="text-green-600 flex-shrink-0" /> {c}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {/* Asset info */}
          <SectionCard title="자산 정보">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-[12px]">
              {[
                { label: "유형",      value: asset.assetTypeLabel },
                { label: "카테고리",  value: asset.category },
                { label: "공개 범위", value: asset.visibility },
                { label: "실행 환경", value: asset.executionEnvironment.join(", ") },
                { label: "비용",      value: asset.cost.display },
              ].map(r => (
                <div key={r.label} className="flex gap-3">
                  <span className="text-muted-foreground w-20 flex-shrink-0">{r.label}</span>
                  <span className="text-foreground font-medium">{r.value}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Right: management panel */}
        <div className="w-[220px] flex-shrink-0 flex flex-col gap-3">
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-[11px] font-semibold text-foreground">상태 관리</p>
            </div>
            <div className="px-4 py-4 flex flex-col gap-2.5">
              <button
                onClick={() => toast.info("새 버전 등록", { description: "자산 등록 화면에서 새 버전을 등록하세요.", duration: 3000 })}
                className="w-full flex items-center gap-2 h-9 px-3 rounded bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors"
              >
                <PlusCircle size={13} /> 자산 업데이트
              </button>
              <button
                onClick={() => toast.warning("게시 중지 요청", { description: "거버넌스 운영팀에 게시 중지 요청이 접수됩니다.", duration: 3000 })}
                className="w-full flex items-center gap-2 h-9 px-3 rounded border border-border text-foreground text-[12px] font-medium hover:bg-muted/30 transition-colors"
              >
                <StopCircle size={13} className="text-muted-foreground" /> 게시 중지 요청
              </button>
              {onViewInPlayground && (
                <button
                  onClick={onViewInPlayground}
                  className="w-full flex items-center gap-2 h-9 px-3 rounded border border-border text-foreground text-[12px] font-medium hover:bg-muted/30 transition-colors"
                >
                  Playground에서 확인
                </button>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-md overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-[11px] font-semibold text-foreground">게시 정보</p>
            </div>
            <div className="px-4 py-4 flex flex-col gap-2.5 text-[11px]">
              {[
                { label: "등록일",    value: asset.createdAt },
                { label: "업데이트", value: asset.lastUpdated },
                { label: "정책 버전", value: asset.review.policyVersion },
              ].map(r => (
                <div key={r.label}>
                  <p className="text-muted-foreground text-[10px]">{r.label}</p>
                  <p className="text-foreground font-medium mt-0.5">{r.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Status panel ─────────────────────────────────────────────────────────────
// "표시할 것" 4개(현재상태/예상처리기한/담당조직/할일)는 반드시 포함하고,
// 심의 경로(운영/정밀 등 내부 라벨)만 들어낸다 — 내부 경로는 운영자 화면에서만 다룬다.

function StatusPanel({ asset, detail }: { asset: AIAsset; detail: StatusDetail }) {
  const chip = ASSET_STATUS_CHIP[asset.status];
  const next = nextActionLabel(asset.status);
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-[11px] font-semibold text-foreground">처리 현황</p>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">현재 상태</p>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${chip.bg} ${chip.text}`}>
            {ASSET_STATUS_LABELS[asset.status]}
          </span>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">예상 처리기한</p>
          <p className="text-[12px] text-foreground font-medium">{getExpectedDeadline(asset)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">담당 조직</p>
          <p className="text-[12px] text-foreground font-medium">{detail.org}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">할 일</p>
          <p className={`text-[12px] font-medium ${next.urgent ? "text-orange-600" : "text-foreground"}`}>{next.text}</p>
        </div>
        {asset.review.additionalReviews.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">추가 검토</p>
            {asset.review.additionalReviews.map(r => (
              <span key={r} className="text-[11px] text-blue-600">{r}</span>
            ))}
          </div>
        )}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">접수일</p>
          <p className="text-[12px] text-foreground">{asset.createdAt}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">정책 버전</p>
          <p className="text-[11px] text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
            {asset.review.policyVersion}
          </p>
        </div>
      </div>
    </div>
  );
}
