import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle2, AlertTriangle,
  RotateCcw, Star, MessageSquareWarning, Users, Building2,
  Activity, TrendingUp, PlusCircle, StopCircle, Bot, Package,
} from "lucide-react";
import { useAssets } from "../context/AssetContext";
import { ASSET_STATUS_LABELS, ASSET_STATUS_CHIP } from "../data/types";
import type { AIAsset, AssetStatus, IssueTicket, SelfDiagnosisAnswers, DiagQuestionAnswer } from "../data/types";
import { DIAG_QUESTION_TEXT, DIAG_QUESTION_ORDER } from "../data/reviewPolicy";

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

// ─── 일반 사용자 empty state ──────────────────────────────────────────────────
// 일반 사용자는 등록이 아니라 사용만 하는 역할이므로, 등록한 자산이 없는 게
// 정상 상태다.

function MyAssetsEmptyState({ onNavigate }: { onNavigate?: (menu: string) => void }) {
  return (
    <div className="px-10 py-8">
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-foreground tracking-tight">내 자산</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          내가 등록한 AI 자산의 상태와 활용 현황을 관리합니다.
        </p>
      </div>

      <div className="bg-card border border-border rounded-md">
        <div className="flex flex-col items-center justify-center py-24 gap-3 px-6 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Package size={20} className="text-muted-foreground" />
          </div>
          <p className="text-[14px] font-medium text-foreground">아직 등록한 자산이 없어요</p>
          <p className="text-[13px] text-muted-foreground">
            AI Playground에서 자산을 사용해보거나, 직접 등록해보세요
          </p>
          {onNavigate && (
            <button
              onClick={() => onNavigate("asset-register")}
              className="mt-2 flex items-center gap-1.5 h-9 px-4 rounded bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
            >
              <PlusCircle size={14} /> 자산 등록하러 가기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MyAssetsScreen({
  role, onOpenDetail, onNavigate,
}: {
  role: "user" | "registrant" | "operator";
  onOpenDetail?: (id: string) => void;
  onNavigate?: (menu: string) => void;
}) {
  const { assets, revisionNotes, approvalConditions, checkingInfo, tickets, dispatch } = useAssets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [correctionApplied, setCorrectionApplied] = useState(false);

  // 일반 사용자는 자산을 등록하지 않고 사용만 하는 역할이라, 등록한 자산이
  // 없는 게 정상이다 — 등록자/운영자 화면은 그대로 두고 이 역할만 분기한다.
  if (role === "user") {
    return <MyAssetsEmptyState onNavigate={onNavigate} />;
  }

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
        tickets={tickets[selectedAsset.id] ?? []}
        onReplyTicket={(ticketId, reply) => dispatch({ type: "REPLY_TICKET", assetId: selectedAsset.id, ticketId, reply })}
        onApplyTicket={(ticketId) => dispatch({ type: "APPLY_TICKET", assetId: selectedAsset.id, ticketId })}
        onApplyAssetUpdate={(patch) => dispatch({ type: "PATCH_ASSET", id: selectedAsset.id, patch })}
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
  asset, approvalConditions, checkingInfo, tickets, onReplyTicket, onApplyTicket, onApplyAssetUpdate, onViewInPlayground, onBack,
}: {
  asset: AIAsset;
  approvalConditions: string[];
  checkingInfo?: { previousStatus: AssetStatus; errorType: string; reportedAt: string };
  tickets: IssueTicket[];
  onReplyTicket: (ticketId: string, reply: string) => void;
  onApplyTicket: (ticketId: string) => void;
  onApplyAssetUpdate: (patch: { description: string; version: string }) => void;
  onViewInPlayground?: () => void;
  onBack: () => void;
}) {
  const chip = ASSET_STATUS_CHIP[asset.status];
  const stage = getJourneyStage(asset.status);
  const detail = getStatusDetail(asset, { revisionNotes: [], checkingInfo });
  const u = asset.usage;
  const [ticketListOpen, setTicketListOpen] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);

  const usageMetrics = [
    { icon: <Users size={14} className="text-primary" />,               label: "누적 사용자",                   value: `${u.totalCount.toLocaleString()}명` },
    { icon: <TrendingUp size={14} className="text-blue-500" />,         label: "최근 30일 사용자",               value: `${u.recentUsers}명` },
    ...(u.actionCount != null ? [{ icon: <Activity size={14} className="text-indigo-500" />, label: `${asset.usageActionLabel} 횟수`, value: `${u.actionCount}회` }] : []),
    { icon: <Building2 size={14} className="text-teal-500" />,          label: "사용 부서",                     value: `${u.departmentCount}개` },
    ...(u.favoriteCount != null ? [{ icon: <Star size={14} className="text-amber-500" />, label: "즐겨찾기",      value: `${u.favoriteCount}명` }] : []),
    ...(u.issueCount != null ? [{ icon: <MessageSquareWarning size={14} className="text-red-400" />, label: "오류 제보", value: `${u.issueCount}건`, onClick: () => setTicketListOpen(true) }] : []),
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
                <div
                  key={m.label}
                  onClick={m.onClick}
                  className={`bg-muted/30 rounded-md p-3 flex flex-col gap-1.5 ${
                    m.onClick ? "cursor-pointer hover:bg-muted/60 transition-colors" : ""
                  }`}
                >
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
                onClick={() => setUpdateModalOpen(true)}
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

      {ticketListOpen && (
        <TicketListModal
          asset={asset}
          tickets={tickets}
          onClose={() => setTicketListOpen(false)}
          onReply={onReplyTicket}
          onApplyVersion={(ticketId) => {
            onApplyTicket(ticketId);
            toast.info("업데이트 화면으로 이동", {
              description: "새 버전이 반영되었습니다. (데모 — 실제 등록 화면 이동 없음)",
              duration: 3000,
            });
          }}
        />
      )}

      {updateModalOpen && (
        <AssetUpdateModal
          asset={asset}
          onClose={() => setUpdateModalOpen(false)}
          onApply={onApplyAssetUpdate}
        />
      )}
    </div>
  );
}

// ─── 오류 제보 티켓 목록 (등록자 수신함) ────────────────────────────────────────

const TICKET_STATUS_BADGE: Record<IssueTicket["status"], { label: string; cls: string }> = {
  OPEN:     { label: "미답변",   cls: "bg-orange-50 text-orange-600" },
  ANSWERED: { label: "답변 완료", cls: "bg-green-50 text-green-700" },
  APPLIED:  { label: "반영 완료", cls: "bg-primary/10 text-primary" },
};

function TicketListModal({
  asset, tickets, onClose, onReply, onApplyVersion,
}: {
  asset: AIAsset;
  tickets: IssueTicket[];
  onClose: () => void;
  onReply: (ticketId: string, reply: string) => void;
  onApplyVersion: (ticketId: string) => void;
}) {
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  function handleSendReply(ticketId: string) {
    if (!replyText.trim()) return;
    onReply(ticketId, replyText.trim());
    setOpenReplyId(null);
    setReplyText("");
    toast.success("답변이 발송되었습니다.", { description: "(데모 — 실제 발송 없음)", duration: 2500 });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-card rounded-lg shadow-xl w-[520px] max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">오류 제보 티켓</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{asset.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-[20px] leading-none">×</button>
        </div>

        <div className="px-6 py-4 flex flex-col gap-3">
          {tickets.length === 0 ? (
            <p className="text-[12px] text-muted-foreground text-center py-8">접수된 티켓이 없습니다.</p>
          ) : (
            tickets.map(t => (
              <div key={t.id} className="border border-border rounded-md p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${TICKET_STATUS_BADGE[t.status].cls}`}>
                    {TICKET_STATUS_BADGE[t.status].label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{t.createdAt}</span>
                </div>

                <pre className="text-[11px] text-foreground whitespace-pre-wrap leading-relaxed font-sans bg-muted/30 rounded p-2.5">
                  {t.summary}
                </pre>

                {t.reply && (
                  <div className="text-[11px] text-foreground bg-primary/5 border border-primary/20 rounded p-2.5">
                    <p className="text-[10px] text-primary font-medium mb-1">보낸 답변</p>
                    {t.reply}
                  </div>
                )}

                {openReplyId === t.id ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={3}
                      placeholder="사용자에게 보낼 답변을 입력하세요."
                      className="w-full px-2.5 py-2 rounded border border-border bg-background text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => { setOpenReplyId(null); setReplyText(""); }}
                        className="flex-1 h-8 rounded border border-border text-[12px] text-foreground hover:bg-muted transition-colors">
                        취소
                      </button>
                      <button onClick={() => handleSendReply(t.id)}
                        className="flex-1 h-8 rounded bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors">
                        보내기
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setOpenReplyId(t.id); setReplyText(t.reply ?? ""); }}
                      className="flex-1 h-8 rounded border border-border text-[12px] text-foreground hover:bg-muted transition-colors"
                    >
                      답변 보내기
                    </button>
                    {t.status === "APPLIED" ? (
                      <span className="flex-1 h-8 flex items-center justify-center rounded bg-primary/5 text-[12px] text-primary font-medium">
                        반영됨 · v{t.appliedVersion}
                      </span>
                    ) : (
                      <button
                        onClick={() => onApplyVersion(t.id)}
                        className="flex-1 h-8 rounded border border-border text-[12px] text-foreground hover:bg-muted transition-colors"
                      >
                        버전 반영
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 자산 업데이트: 좌우 비교 ────────────────────────────────────────────────────
// 왼쪽 = 게시 중인 내용(심의 통과본, 읽기 전용) / 오른쪽 = 수정 중인 내용(편집
// 가능, 달라진 항목은 테두리·배경으로 하이라이트). 자가진단 답이나 연결 목록이
// 바뀌면 "동작 변경"(제출 → 변경분 심의 → 반영, 기존 버전 게시 유지)으로,
// 그 외 내용만 바뀌면 "내용 수정"(검사 → 반영, 즉시 반영)으로 갈라진다.
// 전부 mock — 실제 AI·저장 로직 없음. "즉시 반영"만 PATCH_ASSET으로 실제
// description·version을 갱신해 좌우 비교가 다음에도 의미 있게 보이도록 한다.

const updateModalInputCls = "w-full h-8 px-3 rounded border border-border bg-background text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";
const updateModalTextareaCls = "w-full px-3 py-2 rounded border border-border bg-background text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none";

const MOCK_CONNECTED_ITEMS: string[] = ["Google Sheets", "Gemini API"];
const MOCK_NEW_CONNECTED_ITEM = "Slack";
const FALLBACK_DIAG: SelfDiagnosisAnswers = { q1: "no", q2: "no", q3: "no", q4: "no", q5: "no", q6: "no" };
const DIAG_ANSWER_LABEL: Record<DiagQuestionAnswer, string> = { yes: "예", no: "아니오", unknown: "잘 모르겠음" };

function bumpVersion(version: string): string {
  const parts = version.split(".").map(Number);
  while (parts.length < 3) parts.push(0);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join(".");
}

function UpdateJourney({ steps, note, tone }: { steps: string[]; note: string; tone: "success" | "warning" }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                {i + 1}
              </div>
              <span className="text-[11px] text-foreground whitespace-nowrap">{s}</span>
            </div>
            {i < steps.length - 1 && <div className="w-6 h-px bg-border mx-2 flex-shrink-0" />}
          </div>
        ))}
      </div>
      <p className={`text-[11px] ${tone === "warning" ? "text-orange-600" : "text-green-700"}`}>{note}</p>
    </div>
  );
}

function AssetUpdateModal({
  asset, onClose, onApply,
}: {
  asset: AIAsset;
  onClose: () => void;
  onApply: (patch: { description: string; version: string }) => void;
}) {
  const originalDiag = asset.selfDiagnosis ?? FALLBACK_DIAG;

  const [description, setDescription] = useState(asset.description);
  const [connectedItems, setConnectedItems] = useState<string[]>(MOCK_CONNECTED_ITEMS);
  const [diagAnswers, setDiagAnswers] = useState<SelfDiagnosisAnswers>(originalDiag);
  const [whatChanged, setWhatChanged] = useState("");

  const descriptionChanged = description.trim() !== asset.description.trim();
  const connectionAdded = connectedItems.length > MOCK_CONNECTED_ITEMS.length;
  const diagChanged = DIAG_QUESTION_ORDER.some(k => diagAnswers[k] !== originalDiag[k]);
  const isBehaviorChange = diagChanged || connectionAdded;

  const summary = [
    connectionAdded ? `연결 문서 ${connectedItems.length - MOCK_CONNECTED_ITEMS.length}건 추가` : "연결 목록 변화 없음",
    diagChanged ? "자가진단 답 변화 있음" : "자가진단 답 변화 없음",
    "→",
    isBehaviorChange ? "동작 변경, 심의 후 반영 예상" : "내용 수정, 즉시 반영 예상",
  ].join(" / ");

  function handleSubmit() {
    if (!whatChanged.trim()) return;
    if (isBehaviorChange) {
      onClose();
      toast.warning("변경분 심의가 접수되었습니다.", {
        description: "심의가 끝날 때까지 기존 버전이 그대로 게시됩니다.",
        duration: 3500,
      });
    } else {
      const nextVersion = bumpVersion(asset.version);
      onApply({ description, version: nextVersion });
      onClose();
      toast.success("변경사항이 반영되었습니다.", {
        description: `v${nextVersion}으로 즉시 반영되었습니다.`,
        duration: 3500,
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-card rounded-lg shadow-xl w-full max-w-[980px] max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">자산 업데이트</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{asset.name} · 현재 v{asset.version}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-[20px] leading-none">×</button>
        </div>

        <div className="px-6 py-5 grid grid-cols-2 gap-5">
          {/* 왼쪽: 게시 중인 내용 (읽기 전용) */}
          <div className="flex flex-col gap-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">게시 중인 내용 (심의 통과본)</p>
            <div className="border border-border rounded-md p-3 bg-muted/20">
              <p className="text-[11px] text-muted-foreground mb-1">설명</p>
              <p className="text-[12px] text-foreground leading-relaxed">{asset.description}</p>
            </div>
            <div className="border border-border rounded-md p-3 bg-muted/20">
              <p className="text-[11px] text-muted-foreground mb-1.5">연결 목록</p>
              <div className="flex flex-wrap gap-1.5">
                {MOCK_CONNECTED_ITEMS.map(item => (
                  <span key={item} className="px-2 py-0.5 rounded text-[11px] bg-muted text-foreground">{item}</span>
                ))}
              </div>
            </div>
            <div className="border border-border rounded-md p-3 bg-muted/20">
              <p className="text-[11px] text-muted-foreground mb-1.5">자가진단 답</p>
              <ul className="flex flex-col gap-1.5">
                {DIAG_QUESTION_ORDER.map(k => (
                  <li key={k} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-muted-foreground">{DIAG_QUESTION_TEXT[k]}</span>
                    <span className="text-foreground font-medium flex-shrink-0">{DIAG_ANSWER_LABEL[originalDiag[k]]}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 오른쪽: 수정하는 내용 (편집 가능, 달라진 부분 하이라이트) */}
          <div className="flex flex-col gap-4">
            <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">수정하는 내용</p>
            <div className={`border rounded-md p-3 transition-colors ${descriptionChanged ? "border-primary bg-primary/5" : "border-border"}`}>
              <p className="text-[11px] text-muted-foreground mb-1">설명</p>
              <textarea className={updateModalTextareaCls} rows={3} value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className={`border rounded-md p-3 transition-colors ${connectionAdded ? "border-primary bg-primary/5" : "border-border"}`}>
              <p className="text-[11px] text-muted-foreground mb-1.5">연결 목록</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {connectedItems.map(item => (
                  <span
                    key={item}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      MOCK_CONNECTED_ITEMS.includes(item) ? "bg-muted text-foreground" : "bg-primary/15 text-primary font-medium"
                    }`}
                  >
                    {item}
                  </span>
                ))}
              </div>
              {!connectionAdded && (
                <button
                  onClick={() => setConnectedItems(prev => [...prev, MOCK_NEW_CONNECTED_ITEM])}
                  className="h-7 px-3 rounded border border-dashed border-border text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                >
                  + {MOCK_NEW_CONNECTED_ITEM} 연결 (데모)
                </button>
              )}
            </div>
            <div className={`border rounded-md p-3 transition-colors ${diagChanged ? "border-primary bg-primary/5" : "border-border"}`}>
              <p className="text-[11px] text-muted-foreground mb-1.5">자가진단 답</p>
              <div className="flex flex-col gap-2">
                {DIAG_QUESTION_ORDER.map(k => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-foreground flex-1">{DIAG_QUESTION_TEXT[k]}</span>
                    <div className="flex gap-1 flex-shrink-0">
                      {(["yes", "no", "unknown"] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setDiagAnswers(prev => ({ ...prev, [k]: opt }))}
                          className={`h-6 px-2 rounded-full text-[10px] border font-medium transition-colors ${
                            diagAnswers[k] === opt
                              ? opt !== originalDiag[k]
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-foreground/80 text-background border-foreground/80"
                              : "bg-card border-border text-foreground hover:bg-muted"
                          }`}
                        >
                          {DIAG_ANSWER_LABEL[opt]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 변경 사항 (AI가 정리한 내용) */}
        <div className="px-6">
          <div className="border border-border rounded-md p-4 bg-muted/20">
            <span className="inline-flex items-center gap-1 mb-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
              <Bot size={10} /> AI가 정리한 내용입니다
            </span>
            <p className="text-[12px] text-foreground leading-relaxed">{summary}</p>
          </div>
        </div>

        {/* 무엇이 바뀌었나요 */}
        <div className="px-6 pt-4">
          <label className="text-[12px] font-medium text-foreground">
            무엇이 바뀌었나요? <span className="text-red-500">*</span>
          </label>
          <input
            className={`${updateModalInputCls} mt-1.5`}
            value={whatChanged}
            onChange={e => setWhatChanged(e.target.value)}
            placeholder="예: 연결 문서를 추가하고 설명을 보완했습니다."
          />
          <p className="text-[11px] text-muted-foreground mt-1">이 내용은 변경 이력에 기록됩니다.</p>
        </div>

        {/* 분기: 내용 수정(2단계, 즉시 반영) / 동작 변경(3단계, 심의) */}
        <div className="px-6 pt-5">
          {isBehaviorChange ? (
            <UpdateJourney
              steps={["제출", "변경분 심의", "반영"]}
              note="동작 변경 — 심의가 끝날 때까지 기존 버전이 게시된 상태로 유지됩니다."
              tone="warning"
            />
          ) : (
            <UpdateJourney
              steps={["검사", "반영"]}
              note="내용 수정 — 검사를 통과하면 즉시 반영됩니다."
              tone="success"
            />
          )}
        </div>

        <div className="px-6 py-5 flex gap-2">
          <button onClick={onClose} className="flex-1 h-9 rounded border border-border text-[13px] text-foreground hover:bg-muted transition-colors">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!whatChanged.trim()}
            className="flex-1 h-9 rounded bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isBehaviorChange ? "제출하기" : "반영하기"}
          </button>
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
          <p className="text-[10px] text-muted-foreground mb-1">현재 처리</p>
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
