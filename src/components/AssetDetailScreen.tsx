import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Star, Users, CalendarDays, BarChart2,
  Copy, ExternalLink, PlayCircle, Link2, BookOpenText, Settings2,
  AlertTriangle, CheckCircle2, XCircle, ShieldAlert,
  ChevronRight, Clock, ArrowRight, Layers,
  MessageSquarePlus, Bot,
} from "lucide-react";
import { useAssets } from "../context/AssetContext";
import { getAssetById } from "../data/store";
import type { AIAsset, AssetType, CostMeasurementType, IssueTicket } from "../data/types";
import { ASSET_TYPE_LABELS } from "../data/types";
import TrustBadges from "./TrustBadges";

// ─── 상수 ────────────────────────────────────────────────────────────────────

const TYPE_BADGE: Record<AssetType, { bg: string; text: string }> = {
  PROMPT:     { bg: "bg-blue-50",    text: "text-blue-600"   },
  ASSISTANT:  { bg: "bg-violet-50",  text: "text-violet-600" },
  AUTOMATION: { bg: "bg-orange-50",  text: "text-orange-600" },
  APP:        { bg: "bg-emerald-50", text: "text-emerald-600"},
  MCP:        { bg: "bg-cyan-50",    text: "text-cyan-600"   },
  OTHER:      { bg: "bg-gray-100",   text: "text-gray-600"   },
};

const COST_SENTENCE: Record<CostMeasurementType, string> = {
  LICENSE:   "회사 보유 라이선스 내 사용",
  ACTUAL:    "사용량에 따라 비용 발생",
  ESTIMATED: "테스트 결과를 기준으로 비용 추정",
  PROXY:     "사용자 수와 실행 횟수로 사용량 관리",
  NONE:      "추가 AI 실행비용 없음",
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  "복사하기":  <Copy size={15} />,
  "바로 접속": <ExternalLink size={15} />,
  "사용 방법": <Settings2 size={15} />,
  "실행하기":  <PlayCircle size={15} />,
  "연결 방법": <Link2 size={15} />,
  "자료 확인": <BookOpenText size={15} />,
  "내용 확인": <BookOpenText size={15} />,
};

// ─── 오류 제보 처리 이력 (mock) ───────────────────────────────────────────────
// 제보 원문·대화 내용은 노출하지 않고, 유형과 반영 버전만 보여준다.
const REPORT_HISTORY = [
  { type: "동작 오류",     version: "v1.2" },
  { type: "결과 부정확",   version: "v1.1" },
  { type: "사용 방법 문의", version: "v1.1" },
];

// ─── 변경 이력 생성 ──────────────────────────────────────────────────────────

interface ChangelogEntry { version: string; date: string; note: string }

function buildChangelog(asset: AIAsset): ChangelogEntry[] {
  const [major, minor] = asset.version.split(".").map(Number);
  const mid = asset.createdAt.replace(/(\d{4}-\d{2}).*/, "$1-15");

  if (major >= 1 && minor >= 2) {
    return [
      { version: `v${major}.${minor}`, date: asset.lastUpdated, note: "출력 형식과 추출 기준 개선" },
      { version: `v${major}.1`,        date: mid,               note: "입력 예시와 주의사항 추가" },
      { version: `v${major}.0`,        date: asset.createdAt,   note: "최초 게시" },
    ];
  }
  if (major >= 1 && minor >= 1) {
    return [
      { version: `v${major}.${minor}`, date: asset.lastUpdated, note: "사용 조건 및 설명 보완" },
      { version: `v${major}.0`,        date: asset.createdAt,   note: "최초 게시" },
    ];
  }
  if (major === 2) {
    return [
      { version: "v2.0", date: asset.lastUpdated, note: "연결 문서 확장 및 플랫폼 업그레이드" },
      { version: "v1.0", date: asset.createdAt,   note: "최초 게시" },
    ];
  }
  return [
    { version: `v${major}.0`, date: asset.createdAt, note: "최초 게시" },
  ];
}

// ─── 프롬프트 원문 생성 ──────────────────────────────────────────────────────

function buildMockPrompt(asset: AIAsset): string {
  const ts = asset.typeSpecific as Record<string, string[]>;
  const inputs  = (ts.inputFields  ?? []).map((f) => `{{${f}}}`).join(", ");
  const outputs = (ts.outputFields ?? []).map((o, i) => `${i + 1}. ${o}`).join("\n");
  const cautions = asset.usageConditions.map((c) => `• ${c}`).join("\n");
  return `[역할]\n${asset.description}\n\n[입력]\n${inputs}\n\n[출력 형식]\n${outputs}\n\n[주의사항]\n${cautions || "• 결과는 담당자가 검토 후 사용하세요"}`;
}

// ─── 내 문의 상태 (사용자 쪽 3단계 표시) ──────────────────────────────────────
// OPEN="AI 안내 완료", ANSWERED="등록자 확인 중", APPLIED="반영됨(버전)".
const TICKET_USER_STATUS: Record<IssueTicket["status"], { label: string; cls: string }> = {
  OPEN:     { label: "AI 안내 완료",   cls: "bg-muted text-muted-foreground" },
  ANSWERED: { label: "등록자 확인 중", cls: "bg-blue-50 text-blue-600" },
  APPLIED:  { label: "반영됨",         cls: "bg-primary/10 text-primary" },
};

function ticketUserStatusLabel(t: IssueTicket): string {
  const base = TICKET_USER_STATUS[t.status].label;
  return t.status === "APPLIED" ? `${base} (v${t.appliedVersion})` : base;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function AssetDetailScreen({
  assetId,
  onBack,
  onOpenBadgeGuide,
}: {
  assetId: string;
  onBack: () => void;
  onOpenBadgeGuide?: () => void;
}) {
  const { assets, tickets, dispatch } = useAssets();
  const asset = getAssetById(assets, assetId);
  const myTickets = tickets[assetId] ?? [];

  const [issueModalOpen,   setIssueModalOpen]   = useState(false);
  const [simOpen,          setSimOpen]          = useState(false);
  const [historyOpen,      setHistoryOpen]      = useState(false);

  if (!asset) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 py-32">
        <div className="text-[15px] font-medium text-foreground">자산을 찾을 수 없습니다.</div>
        <p className="text-[13px] text-muted-foreground">ID '{assetId}'에 해당하는 자산이 없습니다.</p>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 h-9 px-4 rounded border border-border text-[13px] font-medium hover:bg-muted transition-colors"
        >
          <ArrowLeft size={14} /> 목록으로 돌아가기
        </button>
      </div>
    );
  }

  const badge = TYPE_BADGE[asset.assetType];

  function handleAction() {
    if (asset!.id === "asset-005" && asset!.usageActionLabel === "실행하기") {
      setSimOpen(true);
      return;
    }
    dispatch({ type: "ADD_RECENT",       id: asset!.id });
    dispatch({ type: "INCREMENT_USAGE",  id: asset!.id });
    const msg =
      asset!.assetType === "PROMPT"
        ? "프롬프트가 클립보드에 복사되었습니다."
        : asset!.assetType === "ASSISTANT"
        ? "외부 서비스 접속을 시뮬레이션합니다. (데모)"
        : asset!.assetType === "APP"
        ? "앱 실행을 시뮬레이션합니다. (데모)"
        : asset!.assetType === "MCP"
        ? "연결 방법 안내를 불러옵니다. (데모)"
        : "자료를 불러옵니다. (데모)";
    toast.success(msg, { description: asset!.name, duration: 2500 });
  }

  function handleFavorite() {
    dispatch({ type: "TOGGLE_FAVORITE", id: asset!.id });
    toast(asset!.isFavorite ? "즐겨찾기에서 제거했습니다." : "즐겨찾기에 추가했습니다.", { duration: 1800 });
  }

  return (
    <div className="min-h-full">
      {/* ── 뒤로가기 ── */}
      <div className="px-10 pt-7 pb-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <ArrowLeft size={13} /> AI Playground으로 돌아가기
        </button>

        {/* ── 자산 헤더 ── */}
        <div className="flex items-start justify-between gap-6 pb-6 border-b border-border">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-medium ${badge.bg} ${badge.text}`}>
                {asset.assetTypeLabel}
              </span>
              {asset.subtype && (
                <>
                  <ChevronRight size={12} className="text-muted-foreground/40" />
                  <span className="text-[11px] text-muted-foreground">{asset.subtype}</span>
                </>
              )}
              <span className="text-[11px] text-muted-foreground ml-1"
                style={{ fontFamily: "'DM Mono', monospace" }}>
                {asset.version}
              </span>
            </div>
            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
              <h1 className="text-[24px] font-semibold text-foreground tracking-tight">
                {asset.name}
              </h1>
              <TrustBadges asset={asset} size="md" onBadgeClick={onOpenBadgeGuide} />
            </div>
            <p className="text-[14px] text-muted-foreground leading-relaxed max-w-2xl">
              {asset.description}
            </p>
            <div className="flex items-center gap-5 mt-3 text-[12px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <Users size={12} /> {asset.ownerName} · {asset.ownerDepartment}
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarDays size={12} /> 최근 업데이트 {asset.lastUpdated}
              </span>
              <span className="flex items-center gap-1.5">
                <BarChart2 size={12} /> 누적 {asset.usage.totalCount.toLocaleString()}회 사용
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2열 본문 ── */}
      <div className="flex gap-8 items-start px-10 pt-7 pb-16">

        {/* ── 왼쪽 콘텐츠 ── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* 자산 소개 */}
          <Section title="자산 소개">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[13px]">
              <InfoRow label="카테고리"   value={asset.category} />
              <InfoRow label="공개 범위"  value={asset.visibility} />
              <InfoRow label="실행 환경"  value={asset.executionEnvironment.join(" · ") || "별도 환경 없음"} />
              {asset.scheduledExecution && (
                <InfoRow label="예약 실행" value={asset.scheduledExecution} />
              )}
            </div>
          </Section>

          {/* 유형별 핵심 영역 */}
          <TypeSpecificSection asset={asset} onAction={handleAction} />

          {/* 알려진 한계 */}
          {asset.knownLimitations.length > 0 && (
            <Section title="알려진 한계">
              <ul className="space-y-2">
                {asset.knownLimitations.map((lim, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-foreground">
                    <AlertTriangle size={13} className="text-orange-400 mt-0.5 flex-shrink-0" />
                    {lim}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* 변경 이력 */}
          <Section title="변경 이력">
            <div className="space-y-3">
              {buildChangelog(asset).map((entry, i) => (
                <div key={`${entry.version}-${i}`} className="flex items-start gap-3 text-[13px]">
                  <span
                    className="text-[11px] font-semibold text-primary bg-secondary px-2 py-0.5 rounded mt-0.5 flex-shrink-0"
                    style={{ fontFamily: "'DM Mono', monospace" }}
                  >
                    {entry.version}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-foreground">{entry.note}</span>
                    <span className="text-muted-foreground text-[11px] ml-2">{entry.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* 등록자 정보 */}
          <Section title="등록자 정보">
            <div className="space-y-1.5 text-[13px]">
              <div className="font-medium text-foreground">{asset.ownerName}</div>
              <div className="text-muted-foreground">{asset.ownerDepartment}</div>
              <div className="text-muted-foreground">등록일 {asset.createdAt}</div>
              <div className="relative w-fit">
                <button
                  onClick={() => setHistoryOpen((v) => !v)}
                  className="inline-flex items-center px-2 py-0.5 rounded text-[11px] text-muted-foreground bg-muted hover:bg-muted/70 transition-colors"
                >
                  오류 제보 3건 중 3건 반영
                </button>
                {historyOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setHistoryOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 w-56 bg-card border border-border rounded-md shadow-lg py-1.5">
                      <div className="px-3 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        처리 이력
                      </div>
                      {REPORT_HISTORY.map((h, i) => (
                        <div key={i} className="px-3 py-1.5 text-[12px] text-foreground flex items-center justify-between gap-2">
                          <span>{h.type}</span>
                          <span className="text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>→ {h.version} 반영</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </Section>
        </div>

        {/* ── 오른쪽 패널 (sticky) ── */}
        <aside className="w-[440px] flex-shrink-0 sticky top-0 max-h-[calc(100vh-56px)] overflow-y-auto">
          <div className="bg-card border border-border rounded-md overflow-hidden pb-1">

            {/* 사용 버튼 */}
            <div className="p-5 border-b border-border">
              <button
                onClick={handleAction}
                className="w-full flex items-center justify-center gap-2 h-10 rounded bg-primary text-primary-foreground text-[14px] font-medium hover:bg-primary/90 transition-colors"
              >
                {ACTION_ICONS[asset.usageActionLabel] ?? null}
                {asset.usageActionLabel}
              </button>
              <button
                onClick={handleFavorite}
                className={`w-full flex items-center justify-center gap-2 h-9 rounded border mt-2 text-[13px] font-medium transition-colors ${
                  asset.isFavorite
                    ? "border-yellow-300 text-yellow-600 bg-yellow-50 hover:bg-yellow-100"
                    : "border-border text-foreground hover:bg-muted"
                }`}
              >
                <Star size={13} fill={asset.isFavorite ? "currentColor" : "none"} />
                {asset.isFavorite ? "즐겨찾기 추가됨" : "즐겨찾기 추가"}
              </button>
            </div>

            {/* 사용 전 확인 */}
            <div className="px-5 pt-4 pb-2 border-b border-border">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                사용 전 확인
              </p>
              <div className="space-y-3">
                <PanelRow label="필요한 계정·라이선스">
                  <ul className="space-y-0.5">
                    {asset.requiredLicenses.map((r) => (
                      <li key={r} className="text-[12px] text-foreground">{r}</li>
                    ))}
                  </ul>
                </PanelRow>
                <PanelRow label="사용 가능 범위">
                  <span className="text-[12px] text-foreground">{asset.visibility}</span>
                </PanelRow>
                {asset.usageConditions.length > 0 && (
                  <PanelRow label="사용 조건">
                    <ul className="space-y-0.5">
                      {asset.usageConditions.map((c) => (
                        <li key={c} className="flex items-start gap-1.5 text-[12px] text-foreground">
                          <span className="mt-1 w-1 h-1 rounded-full bg-muted-foreground flex-shrink-0" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </PanelRow>
                )}
              </div>
            </div>

            {/* 데이터 처리 */}
            <div className="px-5 pt-4 pb-2 border-b border-border">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                데이터 처리
              </p>
              <div className="space-y-3">
                <PanelRow label="처리 데이터">
                  <span className="text-[12px] text-foreground">{asset.dataHandling.summary}</span>
                </PanelRow>
                <PanelRow label="민감도">
                  <span className="text-[12px] text-foreground">{asset.dataHandling.sensitivity}</span>
                </PanelRow>
                <PanelRow label="외부 전송">
                  {asset.dataHandling.externalTransfer ? (
                    <span className="flex items-center gap-1.5 text-[12px] text-orange-600">
                      <ShieldAlert size={12} /> 외부 AI 서비스로 전송됩니다
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[12px] text-green-600">
                      <CheckCircle2 size={12} /> 외부 전송 없음
                    </span>
                  )}
                </PanelRow>
                <PanelRow label="저장">
                  <span className="text-[12px] text-foreground">{asset.dataHandling.storage}</span>
                </PanelRow>
                {asset.permissionLevel.length > 0 && (
                  <PanelRow label="필요한 권한">
                    <ul className="space-y-0.5">
                      {asset.permissionLevel.map((p) => (
                        <li key={p} className="text-[12px] text-foreground">{p}</li>
                      ))}
                    </ul>
                  </PanelRow>
                )}
                <PanelRow label="사용자 확인">
                  {asset.humanConfirmationRequired ? (
                    <span className="flex items-center gap-1.5 text-[12px] text-foreground">
                      <CheckCircle2 size={12} className="text-primary" /> 사용자 확인 단계 포함
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <XCircle size={12} /> 자동 처리
                    </span>
                  )}
                </PanelRow>
              </div>
            </div>

            {/* 비용 */}
            <div className="px-5 pt-4 pb-4 border-b border-border">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                비용
              </p>
              <div className="text-[13px] font-medium text-foreground mb-1">
                {COST_SENTENCE[asset.cost.measurementType]}
              </div>
              <div className="text-[12px] text-muted-foreground">{asset.cost.note}</div>
            </div>

            {/* 내 문의 (사용자가 넣은 문의의 진행 상태) */}
            {myTickets.length > 0 && (
              <div className="px-5 pt-4 pb-4 border-b border-border">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  내 문의
                </p>
                <div className="flex flex-col gap-2">
                  {myTickets.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">{t.createdAt}</span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${TICKET_USER_STATUS[t.status].cls}`}>
                        {ticketUserStatusLabel(t)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 액션 */}
            <div className="px-5 pt-3 pb-4 space-y-2">
              <button
                onClick={() => setIssueModalOpen(true)}
                className="w-full flex items-center gap-2 h-8 px-3 rounded border border-border text-[12px] text-foreground hover:bg-muted transition-colors"
              >
                <MessageSquarePlus size={13} className="text-muted-foreground" /> 문제가 있나요?
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* ── 모달: 문제가 있나요? (버튼 분기형 안내 → 신고 폼) ── */}
      {issueModalOpen && (
        <IssueHelpModal
          asset={asset}
          onClose={() => setIssueModalOpen(false)}
          onSubmitted={(summary) => {
            dispatch({ type: "REPORT_ERROR", id: asset.id, errorType: "결과가 부정확함" });
            dispatch({
              type: "SUBMIT_TICKET",
              assetId: asset.id,
              assetName: asset.name,
              assetVersion: asset.version,
              summary,
            });
          }}
        />
      )}
      {/* ── 모달: 실행 시뮬레이션 ── */}
      {simOpen && (
        <ExecutionSimModal
          asset={asset}
          onClose={() => setSimOpen(false)}
          onComplete={() => {
            dispatch({ type: "ADD_RECENT",      id: asset.id });
            dispatch({ type: "INCREMENT_USAGE", id: asset.id });
          }}
        />
      )}
    </div>
  );
}

// ─── TypeSpecificSection ─────────────────────────────────────────────────────

function TypeSpecificSection({ asset, onAction }: { asset: AIAsset; onAction: () => void }) {
  switch (asset.assetType) {
    case "PROMPT":     return <PromptSection     asset={asset} onAction={onAction} />;
    case "ASSISTANT":  return <AssistantSection  asset={asset} onAction={onAction} />;
    case "AUTOMATION": return <AutomationSection asset={asset} onAction={onAction} />;
    case "APP":
      return asset.subtype === "CLIENT_APP"
        ? <ClientAppSection  asset={asset} onAction={onAction} />
        : <BackendAppSection asset={asset} onAction={onAction} />;
    case "MCP":   return <McpSection   asset={asset} onAction={onAction} />;
    case "OTHER": return <OtherSection asset={asset} onAction={onAction} />;
    default:      return null;
  }
}

// ── PROMPT ───────────────────────────────────────────────────────────────────

function PromptSection({ asset, onAction }: { asset: AIAsset; onAction: () => void }) {
  const [copied, setCopied] = useState(false);
  const ts = asset.typeSpecific as Record<string, string[]>;
  const promptText = buildMockPrompt(asset);

  function handleCopy() {
    onAction();
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <Section title="프롬프트 원문">
      <div className="space-y-4">
        {/* 입력 변수 */}
        {(ts.inputFields ?? []).length > 0 && (
          <div>
            <p className="text-[12px] font-medium text-muted-foreground mb-2">입력 변수</p>
            <div className="flex flex-wrap gap-2">
              {(ts.inputFields ?? []).map((f) => (
                <span key={f}
                  className="px-2.5 py-1 rounded bg-blue-50 border border-blue-100 text-[12px] font-medium text-blue-700"
                  style={{ fontFamily: "'DM Mono', monospace" }}>
                  {`{{${f}}}`}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 프롬프트 원문 */}
        <div className="relative">
          <pre
            className="text-[12px] text-foreground bg-muted/40 border border-border rounded-md p-5 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto"
            style={{ fontFamily: "'DM Mono', monospace" }}
          >
            {promptText}
          </pre>
          <button
            onClick={handleCopy}
            className={`absolute top-3 right-3 flex items-center gap-1.5 h-7 px-2.5 rounded text-[11px] font-medium border transition-colors ${
              copied
                ? "bg-green-50 border-green-200 text-green-600"
                : "bg-card border-border text-foreground hover:bg-muted"
            }`}
          >
            <Copy size={12} />
            {copied ? "복사됨" : "전체 복사"}
          </button>
        </div>

        {/* 출력 예시 */}
        {(ts.outputFields ?? []).length > 0 && (
          <div>
            <p className="text-[12px] font-medium text-muted-foreground mb-2">출력 항목</p>
            <div className="space-y-1">
              {(ts.outputFields ?? []).map((o, i) => (
                <div key={i} className="flex items-center gap-2 text-[13px] text-foreground">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  {o}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 추천 실행 환경 */}
        <div>
          <p className="text-[12px] font-medium text-muted-foreground mb-2">추천 실행 환경</p>
          <div className="flex gap-2 flex-wrap">
            {asset.executionEnvironment.map((e) => (
              <span key={e} className="px-2.5 py-1 rounded bg-muted text-[12px] text-foreground border border-border">{e}</span>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

// ── ASSISTANT ────────────────────────────────────────────────────────────────

function AssistantSection({ asset, onAction }: { asset: AIAsset; onAction: () => void }) {
  const ts = asset.typeSpecific as Record<string, string | string[]>;
  return (
    <Section title="사용 방법">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted/30 rounded-md p-4 border border-border">
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">실행 플랫폼</p>
            <p className="text-[14px] font-semibold text-foreground">{String(ts.platform ?? asset.subtype ?? "—")}</p>
          </div>
          <div className="bg-muted/30 rounded-md p-4 border border-border">
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">필요 계정</p>
            <p className="text-[13px] text-foreground">{asset.requiredLicenses.join(", ") || "—"}</p>
          </div>
        </div>

        {(ts.connectedDocuments as string[] | undefined)?.length && (
          <div>
            <p className="text-[12px] font-medium text-muted-foreground mb-2">연결 문서</p>
            <div className="flex flex-wrap gap-2">
              {(ts.connectedDocuments as string[]).map((d) => (
                <span key={d} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted border border-border text-[12px] text-foreground">
                  <Layers size={11} className="text-muted-foreground" /> {d}
                </span>
              ))}
            </div>
          </div>
        )}

        {(ts.exampleQuestions as string[] | undefined)?.length && (
          <div>
            <p className="text-[12px] font-medium text-muted-foreground mb-2">질문 예시</p>
            <div className="space-y-2">
              {(ts.exampleQuestions as string[]).map((q, i) => (
                <div key={i} className="flex items-start gap-2 text-[13px] text-foreground bg-secondary/50 rounded px-3 py-2">
                  <span className="text-primary font-medium flex-shrink-0">Q.</span> {q}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onAction}
          className="flex items-center gap-2 h-9 px-4 rounded bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
        >
          <ExternalLink size={14} /> 바로 접속 (데모)
        </button>
      </div>
    </Section>
  );
}

// ── AUTOMATION ───────────────────────────────────────────────────────────────

function AutomationSection({ asset, onAction }: { asset: AIAsset; onAction: () => void }) {
  const ts = asset.typeSpecific as Record<string, unknown>;
  const steps = (ts.processingSteps as string[] | undefined) ?? [];
  const services = (ts.connectedServices as string[] | undefined) ?? [];
  return (
    <Section title="실행 흐름">
      <div className="space-y-5">
        {steps.length > 0 && (
          <div>
            <p className="text-[12px] font-medium text-muted-foreground mb-3">단계별 처리 과정</p>
            <div className="flex items-start gap-0 flex-wrap">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-0">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-[11px] font-semibold text-primary">
                      {i + 1}
                    </div>
                    <span className="text-[12px] text-foreground text-center mt-1.5 max-w-[80px]">{step}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <ArrowRight size={14} className="text-muted-foreground/60 mx-2 mt-[-18px]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {services.length > 0 && (
          <div>
            <p className="text-[12px] font-medium text-muted-foreground mb-2">연결 서비스</p>
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <span key={s} className="px-2.5 py-1 rounded bg-muted border border-border text-[12px] text-foreground">{s}</span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {asset.scheduledExecution && (
            <div className="flex items-center gap-2 text-[13px] text-foreground bg-orange-50 border border-orange-100 rounded-md px-3 py-2.5">
              <Clock size={13} className="text-orange-500 flex-shrink-0" />
              <span><span className="font-medium">예약 실행:</span> {asset.scheduledExecution}</span>
            </div>
          )}
          {(ts.monthlyExecutionLimit as number | undefined) && (
            <div className="flex items-center gap-2 text-[13px] text-foreground bg-muted/40 border border-border rounded-md px-3 py-2.5">
              <BarChart2 size={13} className="text-muted-foreground flex-shrink-0" />
              <span>월 최대 {ts.monthlyExecutionLimit as number}회 실행</span>
            </div>
          )}
        </div>

        <button
          onClick={onAction}
          className="flex items-center gap-2 h-9 px-4 rounded bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
        >
          {ACTION_ICONS[asset.usageActionLabel] ?? null}
          {asset.usageActionLabel}
        </button>
      </div>
    </Section>
  );
}

// ── CLIENT APP ───────────────────────────────────────────────────────────────

function ClientAppSection({ asset, onAction }: { asset: AIAsset; onAction: () => void }) {
  const ts = asset.typeSpecific as Record<string, string | string[]>;
  return (
    <Section title="사용 방법">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <InfoRow label="앱 유형"     value="브라우저 실행형 앱" />
          <InfoRow label="외부 통신"   value={asset.dataHandling.externalTransfer ? "있음" : "없음"} />
          <InfoRow label="데이터 저장" value={asset.dataHandling.storage} />
        </div>
        {(ts.inputFields as string[] | undefined)?.length && (
          <div>
            <p className="text-[12px] font-medium text-muted-foreground mb-2">입력값</p>
            <div className="flex flex-wrap gap-2">
              {(ts.inputFields as string[]).map((f) => (
                <span key={f} className="px-2.5 py-1 rounded bg-secondary text-[12px] text-foreground border border-secondary">{f}</span>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={onAction}
          className="flex items-center gap-2 h-9 px-4 rounded bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
        >
          <PlayCircle size={14} /> 앱 실행하기 (데모)
        </button>
      </div>
    </Section>
  );
}

// ── BACKEND APP ──────────────────────────────────────────────────────────────

function BackendAppSection({ asset, onAction }: { asset: AIAsset; onAction: () => void }) {
  const ts = asset.typeSpecific as Record<string, string | string[]>;
  return (
    <Section title="사용 방법">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <InfoRow label="앱 유형"       value="백엔드 연동형 앱" />
          <InfoRow label="로그인 필요"   value="사내 계정 필요" />
          <InfoRow label="서버 처리"     value="있음" />
          <InfoRow label="외부 API"      value={asset.dataHandling.externalTransfer ? "사용" : "미사용"} />
          <InfoRow label="원본 파일 보관" value={asset.dataHandling.storage} />
        </div>
        {(ts.inputFormats as string[] | undefined)?.length && (
          <div>
            <p className="text-[12px] font-medium text-muted-foreground mb-2">지원 입력 형식</p>
            <div className="flex gap-2">
              {(ts.inputFormats as string[]).map((f) => (
                <span key={f} className="px-2.5 py-1 rounded bg-muted border border-border text-[12px] font-medium text-foreground">{f}</span>
              ))}
            </div>
          </div>
        )}
        {(ts.outputFields as string[] | undefined)?.length && (
          <div>
            <p className="text-[12px] font-medium text-muted-foreground mb-2">분석 결과 항목</p>
            <ul className="space-y-1">
              {(ts.outputFields as string[]).map((o, i) => (
                <li key={i} className="flex items-center gap-2 text-[13px] text-foreground">
                  <CheckCircle2 size={12} className="text-primary flex-shrink-0" /> {o}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          onClick={onAction}
          className="flex items-center gap-2 h-9 px-4 rounded bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
        >
          <PlayCircle size={14} /> 앱 실행하기 (데모)
        </button>
      </div>
    </Section>
  );
}

// ── MCP ──────────────────────────────────────────────────────────────────────

function McpSection({ asset, onAction }: { asset: AIAsset; onAction: () => void }) {
  const ts = asset.typeSpecific as Record<string, string | string[]>;
  const features = (ts.features as string[] | undefined) ?? [];
  const systems  = (ts.connectedSystems as string[] | undefined) ?? [];
  return (
    <Section title="시스템 연결 정보">
      <div className="space-y-5">
        <div className="bg-cyan-50 border border-cyan-100 rounded-md px-4 py-3 text-[13px] text-cyan-800">
          이 자산은 사내 시스템과 AI를 연결하는 도구입니다. 기존에 접근 권한이 있는 데이터만 조회합니다.
        </div>

        {systems.length > 0 && (
          <div>
            <p className="text-[12px] font-medium text-muted-foreground mb-2">연결 대상 시스템</p>
            <div className="flex flex-wrap gap-2">
              {systems.map((s) => (
                <span key={s} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-50 border border-cyan-100 text-[12px] text-cyan-700">
                  <Link2 size={11} /> {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {features.length > 0 && (
          <div>
            <p className="text-[12px] font-medium text-muted-foreground mb-2">제공 기능</p>
            <div className="space-y-1.5">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-[13px] text-foreground">
                  <CheckCircle2 size={13} className="text-primary flex-shrink-0" /> {f}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <InfoRow label="인증 방식"       value={String(ts.authMethod ?? "회사 계정 OAuth")} />
          <InfoRow label="조회 로그"       value="저장됨" />
          <InfoRow label="쓰기·삭제 권한"  value="없음 (읽기 전용)" />
        </div>

        <button
          onClick={onAction}
          className="flex items-center gap-2 h-9 px-4 rounded bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
        >
          <Link2 size={14} /> 연결 방법 안내 (데모)
        </button>
      </div>
    </Section>
  );
}

// ── OTHER ────────────────────────────────────────────────────────────────────

function OtherSection({ asset, onAction }: { asset: AIAsset; onAction: () => void }) {
  const ts = asset.typeSpecific as Record<string, unknown>;
  const contents = (ts.contents as string[] | undefined) ?? [];
  const testCounts = ts.testCounts as Record<string, number> | undefined;
  return (
    <Section title="자산 구성">
      <div className="space-y-4">
        {contents.length > 0 && (
          <ul className="space-y-1.5">
            {contents.map((c, i) => (
              <li key={i} className="flex items-center gap-2 text-[13px] text-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" /> {c}
              </li>
            ))}
          </ul>
        )}
        {testCounts && (
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(testCounts).map(([k, v]) => (
              <div key={k} className="bg-muted/30 border border-border rounded px-3 py-2.5">
                <div className="text-[20px] font-semibold text-foreground">{v}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{k.replace(/([A-Z])/g, " $1").trim()}</div>
              </div>
            ))}
          </div>
        )}
        <div className="text-[13px] text-muted-foreground">
          이 자산은 직접 실행하지 않고 다른 AI 자산이나 담당자가 활용하는 기반 자산입니다.
        </div>
        <button
          onClick={onAction}
          className="flex items-center gap-2 h-9 px-4 rounded bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
        >
          <BookOpenText size={14} /> {asset.usageActionLabel}
        </button>
      </div>
    </Section>
  );
}

// ─── 공용 레이아웃 ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="px-6 py-3.5 border-b border-border">
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
      <p className="text-[13px] text-foreground">{value}</p>
    </div>
  );
}

function PanelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      {children}
    </div>
  );
}

// ─── 문제가 있나요? 안내 모달 (버튼 분기형 MVP — 자유 대화형 아님) ─────────────
// 창 상태는 step 하나로만 관리한다: menu(초기) → access|howto|checkPrompt(버튼선택)
// → report(신고폼). checkPrompt에서 "아니오"는 access로 되돌리고 신고로 넘어가지
// 않는다 — 신고 폼은 로그인 확인("예")을 거친 경우에만 열린다.

type IssueStep = "menu" | "access" | "howto" | "checkPrompt" | "report";

function buildIssueSummary(asset: AIAsset): string {
  const ts = asset.typeSpecific as Record<string, string[]>;
  const inputSample  = (ts.inputFields  ?? [])[0] ?? "입력값";
  const outputSample = (ts.outputFields ?? [])[0] ?? "결과";
  return [
    "[AI가 정리한 신고 내용]",
    "선택한 문의: 결과가 이상해요",
    "환경 확인: 필요 계정으로 로그인된 상태에서 재현됨 (예)",
    "",
    `입력 예시: ${inputSample} 항목에 평소와 같은 값을 입력함`,
    `출력 예시: ${outputSample} 결과가 예상과 다르게 표시됨`,
  ].join("\n");
}

function IssueHelpModal({
  asset, onClose, onSubmitted,
}: {
  asset: AIAsset;
  onClose: () => void;
  onSubmitted: (summary: string) => void;
}) {
  const [step, setStep] = useState<IssueStep>("menu");
  const [detail, setDetail] = useState(() => buildIssueSummary(asset));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmitted(detail);
    onClose();
    toast.success("문의가 접수되었습니다.", {
      description: `${asset.name} 등록자에게 전달되었습니다.`,
      duration: 3000,
    });
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-card rounded-lg shadow-xl w-[440px] max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-muted-foreground">
              {asset.name} · v{asset.version}에 대한 문의
            </p>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-[20px] leading-none flex-shrink-0">×</button>
          </div>
          <span className="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
            <Bot size={11} /> AI가 안내합니다
          </span>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {step === "menu" && (
            <>
              <p className="text-[13px] text-foreground leading-relaxed">
                어디서 막히셨어요? 지금 상황을 알려주세요.
              </p>
              <div className="flex flex-col gap-2">
                <button onClick={() => setStep("access")}
                  className="w-full h-9 px-3 rounded border border-border text-[13px] text-foreground hover:bg-muted transition-colors text-left">
                  접속이 안 돼요
                </button>
                <button onClick={() => setStep("howto")}
                  className="w-full h-9 px-3 rounded border border-border text-[13px] text-foreground hover:bg-muted transition-colors text-left">
                  어떻게 쓰는지 모르겠어요
                </button>
                <button onClick={() => setStep("checkPrompt")}
                  className="w-full h-9 px-3 rounded border border-border text-[13px] text-foreground hover:bg-muted transition-colors text-left">
                  결과가 이상해요
                </button>
              </div>
            </>
          )}

          {step === "access" && (
            <>
              <p className="text-[13px] font-medium text-foreground">필요 계정·권한 안내</p>
              <div className="bg-muted/30 rounded-md p-3 border border-border">
                <p className="text-[11px] text-muted-foreground mb-1">필요 계정</p>
                <p className="text-[13px] text-foreground">
                  {asset.requiredLicenses.join(", ") || "별도 계정이 필요하지 않습니다."}
                </p>
              </div>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                위 계정으로 로그인돼 있는지 확인해 주세요. 계정이 없다면 담당 조직({asset.ownerDepartment})에 접근 권한을 요청하세요.
              </p>
              <button onClick={() => setStep("menu")} className="self-start text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                ← 다른 문제 선택하기
              </button>
            </>
          )}

          {step === "howto" && (
            <>
              <p className="text-[13px] font-medium text-foreground">사용 예시·가이드</p>
              <pre className="text-[12px] text-foreground bg-muted/30 border border-border rounded-md p-3 whitespace-pre-wrap leading-relaxed font-sans">
                {buildMockPrompt(asset)}
              </pre>
              <button onClick={() => setStep("menu")} className="self-start text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                ← 다른 문제 선택하기
              </button>
            </>
          )}

          {step === "checkPrompt" && (
            <>
              <p className="text-[13px] text-foreground">필요 계정으로 로그인돼 있나요?</p>
              <div className="flex gap-2">
                <button onClick={() => setStep("report")}
                  className="h-9 px-4 rounded bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors">
                  예
                </button>
                <button onClick={() => setStep("access")}
                  className="h-9 px-4 rounded border border-border text-[13px] text-foreground hover:bg-muted transition-colors">
                  아니오
                </button>
              </div>
            </>
          )}

          {step === "report" && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <span className="inline-flex items-center gap-1 self-start px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                <Bot size={11} /> AI가 정리한 내용입니다
              </span>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 rounded border border-border bg-background text-[12px] text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                내용을 확인하고 필요하면 수정한 뒤 제출하세요. 제출하면 이 자산의 등록자에게 전달됩니다.
              </p>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose}
                  className="flex-1 h-9 rounded border border-border text-[13px] text-foreground hover:bg-muted transition-colors">
                  취소
                </button>
                <button type="submit"
                  className="flex-1 h-9 rounded bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors">
                  제출
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── 실행 시뮬레이션 모달 ─────────────────────────────────────────────────────

const SIM_STEPS = [
  "주간보고 7건 수집 완료",
  "완료·진행·이슈 분류 완료",
  "통합 문서 초안 생성",
  "사용자 확인 대기",
];

function ExecutionSimModal({ asset, onClose, onComplete }: {
  asset: AIAsset;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [done, setDone] = useState(false);

  function handleApply() {
    onComplete();
    setDone(true);
    toast.success("문서에 반영되었습니다.", { description: asset.name, duration: 2500 });
    setTimeout(onClose, 1500);
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-card rounded-lg shadow-xl w-[440px]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-[15px] font-semibold text-foreground">실행 시뮬레이션</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-[20px] leading-none">×</button>
        </div>
        <div className="px-6 py-5">
          <p className="text-[12px] text-muted-foreground mb-4">{asset.name} · 실제 Google Docs 및 Gemini API는 호출하지 않습니다.</p>
          <div className="flex flex-col gap-3 mb-5">
            {SIM_STEPS.map((step, i) => {
              const isDone    = i < SIM_STEPS.length - 1;
              const isCurrent = i === SIM_STEPS.length - 1;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    done ? "bg-primary" : isDone ? "bg-green-600" : "bg-primary ring-4 ring-primary/20"
                  }`}>
                    {(done || isDone) ? (
                      <CheckCircle2 size={13} className="text-white" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <span className={`text-[13px] ${isCurrent && !done ? "font-semibold text-foreground" : "text-foreground"}`}>
                    {step}
                    {isCurrent && !done && (
                      <span className="ml-2 text-[11px] font-normal text-primary">← 현재</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          {!done ? (
            <button
              onClick={handleApply}
              className="w-full h-10 rounded bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors"
            >
              문서에 반영
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 h-10 rounded bg-green-50 border border-green-200 text-[13px] font-medium text-green-700">
              <CheckCircle2 size={15} /> 완료되었습니다.
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── Modal overlay ────────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
