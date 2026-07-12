import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, AlertTriangle, X, Shield, Database, Zap, Clock } from "lucide-react";
import { useAssets } from "../context/AssetContext";
import { getReviewPendingAssets } from "../data/store";
import { ASSET_STATUS_LABELS, ASSET_STATUS_CHIP, REVIEW_PATH_LABELS } from "../data/types";
import type { AIAsset, AssetStatus } from "../data/types";

// ─── Filter ───────────────────────────────────────────────────────────────────

type Filter = "all" | "operation" | "deep" | "cost" | "resubmit";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all",       label: "전체"        },
  { id: "operation", label: "운영 심의"   },
  { id: "deep",      label: "정밀 심의"   },
  { id: "cost",      label: "비용 검토"   },
  { id: "resubmit",  label: "보완 재제출" },
];

function applyFilter(assets: AIAsset[], filter: Filter): AIAsset[] {
  if (filter === "all")       return assets;
  if (filter === "operation") return assets.filter(a => a.review.stage === "OPERATION_REVIEW");
  if (filter === "deep")      return assets.filter(a => a.review.stage === "DEEP_REVIEW");
  if (filter === "cost")      return assets.filter(a => a.review.additionalReviews.includes("비용 검토"));
  if (filter === "resubmit")  return assets.filter(a => a.status === "RESUBMITTED" || a.status === "REVISION_REQUESTED");
  return assets;
}

// ─── Infer self-diagnosis from asset data ────────────────────────────────────

function inferDiagnosis(asset: AIAsset) {
  return [
    { q: "개인정보나 중요한 회사 정보를 다루나요?",     ans: asset.dataHandling.sensitivity.includes("개인정보") ? "예" : "아니오" },
    { q: "회사 밖의 AI나 서비스로 데이터를 보내나요?",  ans: asset.dataHandling.externalTransfer ? "예" : "아니오" },
    { q: "회사 시스템이나 문서를 계정 권한으로 읽나요?", ans: asset.permissionLevel.some(p => p.includes("읽기")) ? "예" : "아니오" },
    { q: "메일 발송, 문서 수정, 삭제, 일정 등록 등을 하나요?", ans: asset.permissionLevel.some(p => /수정|생성|발송|등록|삭제/.test(p)) ? "예" : "아니오" },
    { q: "사람 확인 없이 자동으로 실행되나요?",         ans: !asset.humanConfirmationRequired ? "예" : "아니오" },
    { q: "정해진 시간이나 조건에 따라 반복 실행되나요?", ans: asset.scheduledExecution ? "예" : "아니오" },
  ];
}

// ─── Shared components ────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      {title && <div className="px-5 py-3 border-b border-border"><h3 className="text-[13px] font-semibold text-foreground">{title}</h3></div>}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-[12px]">
      <span className="text-muted-foreground w-24 flex-shrink-0">{label}</span>
      <span className="text-foreground font-medium flex-1">{typeof value === "string" ? value : value}</span>
    </div>
  );
}

// ─── Default revision notes ───────────────────────────────────────────────────

const DEFAULT_REVISION_NOTES = [
  "AI 요약 결과를 사용자 확인 후 문서에 반영해 주세요.",
  "실행당 보고서를 최대 10개로 제한해 주세요.",
  "AX기획팀 파일럿 범위로 시작해 주세요.",
];

const DEFAULT_APPROVAL_CONDITIONS = [
  "AX기획팀 한정",
  "파일럿 기간 4주",
  "실행당 보고서 최대 10개",
  "월 실행 상한 20회",
  "사용자 확인 후 문서 반영",
  "4주 후 재검토",
];

// ─── Modals ───────────────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function RevisionModal({
  assetName, onSubmit, onClose,
}: { assetName: string; onSubmit: (notes: string[]) => void; onClose: () => void }) {
  const [notes, setNotes] = useState<string[]>(DEFAULT_REVISION_NOTES);
  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-card border border-border rounded-lg w-[520px] shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-semibold text-foreground">보완 요청</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          <p className="text-[12px] text-muted-foreground">
            <strong className="text-foreground">{assetName}</strong>에 대한 보완 요청 내용을 확인하고 전송하세요.
          </p>
          <div className="flex flex-col gap-2">
            {notes.map((note, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-[10px] font-semibold flex items-center justify-center mt-0.5">{i + 1}</span>
                <input
                  className="flex-1 h-8 px-2.5 rounded border border-border bg-background text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  value={note}
                  onChange={e => setNotes(prev => prev.map((n, j) => j === i ? e.target.value : n))}
                />
              </div>
            ))}
          </div>
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-md text-[11px] text-orange-700 flex items-start gap-2">
            <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
            보완 요청 전송 시 자산 상태가 <strong>보완 요청</strong>으로 변경되고 등록자에게 안내됩니다.
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="h-8 px-4 rounded border border-border text-[12px] text-foreground hover:bg-muted transition-colors">취소</button>
          <button
            onClick={() => onSubmit(notes.filter(n => n.trim()))}
            className="h-8 px-4 rounded bg-orange-500 text-white text-[12px] font-medium hover:bg-orange-600 transition-colors"
          >
            보완 요청 전송
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function ApprovalModal({
  assetName, onSubmit, onClose,
}: { assetName: string; onSubmit: (conditions: string[]) => void; onClose: () => void }) {
  const [conditions, setConditions] = useState<string[]>(DEFAULT_APPROVAL_CONDITIONS);
  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-card border border-border rounded-lg w-[480px] shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-semibold text-foreground">조건부 승인</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          <p className="text-[12px] text-muted-foreground">
            <strong className="text-foreground">{assetName}</strong>의 승인 조건을 확인하세요.
          </p>
          <div className="flex flex-col gap-2">
            {conditions.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-green-600 flex-shrink-0" />
                <input
                  className="flex-1 h-8 px-2.5 rounded border border-border bg-background text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  value={c}
                  onChange={e => setConditions(prev => prev.map((cc, j) => j === i ? e.target.value : cc))}
                />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            승인 후 카탈로그 공개 범위: <strong className="text-foreground">AX기획팀</strong> (파일럿)
          </p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="h-8 px-4 rounded border border-border text-[12px] text-foreground hover:bg-muted transition-colors">취소</button>
          <button
            onClick={() => onSubmit(conditions.filter(c => c.trim()))}
            className="h-8 px-4 rounded bg-green-600 text-white text-[12px] font-medium hover:bg-green-700 transition-colors"
          >
            조건부 승인
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function GovernanceScreen() {
  const { assets, dispatch } = useAssets();
  const [filter, setFilter]     = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reviewAssets = getReviewPendingAssets(assets);
  const filtered     = applyFilter(reviewAssets, filter);
  const selected     = selectedId ? assets.find(a => a.id === selectedId) ?? null : null;

  if (selected) {
    return (
      <DetailView
        asset={selected}
        onBack={() => setSelectedId(null)}
        onDispatch={dispatch}
      />
    );
  }

  return (
    <div className="px-10 py-8">
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-foreground tracking-tight">심의 대기</h1>
        <p className="text-[13px] text-muted-foreground mt-1">심의가 필요한 AI 자산을 검토하고 처리합니다.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-5">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
              filter === f.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-normal ${
              filter === f.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`} style={{ fontFamily: "'DM Mono', monospace" }}>
              {applyFilter(reviewAssets, f.id).length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["자산명", "유형", "등록자", "현재 상태", "처리 경로", "주요 사유", "추가 검토", "접수일"].map(h => (
                <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3 first:pl-5 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-14 text-[13px] text-muted-foreground">
                  해당 조건의 자산이 없습니다.
                </td>
              </tr>
            ) : filtered.map(asset => {
              const chip  = ASSET_STATUS_CHIP[asset.status];
              const reasons = asset.review.reasons.slice(0, 2);
              const extra   = asset.review.reasons.length - 2;
              return (
                <tr
                  key={asset.id}
                  onClick={() => setSelectedId(asset.id)}
                  className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3">
                    <p className="text-[13px] font-medium text-foreground">{asset.name}</p>
                    <p className="text-[11px] text-muted-foreground">{asset.category}</p>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">{asset.assetTypeLabel}</td>
                  <td className="px-4 py-3">
                    <p className="text-[12px] text-foreground">{asset.ownerName}</p>
                    <p className="text-[11px] text-muted-foreground">{asset.ownerDepartment}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${chip.bg} ${chip.text}`}>
                      {ASSET_STATUS_LABELS[asset.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-foreground whitespace-nowrap">
                    {REVIEW_PATH_LABELS[asset.review.stage]}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {reasons.map(r => (
                        <span key={r} className="inline-flex px-1.5 py-0.5 bg-orange-50 text-orange-700 text-[10px] rounded border border-orange-100 whitespace-nowrap">
                          {r}
                        </span>
                      ))}
                      {extra > 0 && <span className="text-[10px] text-muted-foreground">+{extra}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {asset.review.additionalReviews.length > 0 ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded border border-blue-100">
                        {asset.review.additionalReviews[0]}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">{asset.createdAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Detail view ──────────────────────────────────────────────────────────────

function DetailView({
  asset, onBack, onDispatch,
}: {
  asset: AIAsset;
  onBack: () => void;
  onDispatch: ReturnType<typeof useAssets>["dispatch"];
}) {
  const [modal, setModal] = useState<"revision" | "approval" | null>(null);
  const chip = ASSET_STATUS_CHIP[asset.status];
  const diagnosis = inferDiagnosis(asset);

  function handleApprove() {
    onDispatch({ type: "PATCH_ASSET", id: asset.id, patch: { status: "PUBLISHED", showOnCatalog: true } });
    toast.success("자산이 승인되어 게시되었습니다.", { duration: 3000 });
    onBack();
  }

  function handleRevisionSubmit(notes: string[]) {
    onDispatch({ type: "SET_REVISION_NOTES", id: asset.id, notes });
    onDispatch({ type: "UPDATE_STATUS", id: asset.id, status: "REVISION_REQUESTED" });
    setModal(null);
    toast.success("보완 요청이 전송되었습니다.", { description: "등록자에게 안내됩니다.", duration: 3000 });
    onBack();
  }

  function handleApprovalSubmit(conditions: string[]) {
    onDispatch({ type: "SET_APPROVAL_CONDITIONS", id: asset.id, conditions });
    onDispatch({ type: "PATCH_ASSET", id: asset.id, patch: {
      status: "CONDITIONAL_APPROVAL", showOnCatalog: true,
      visibility: "AX기획팀", version: "1.1.0",
    }});
    setModal(null);
    toast.success("조건부 승인이 완료되었습니다.", { description: "카탈로그에 공개됩니다.", duration: 3000 });
    onBack();
  }

  function handleReject() {
    onDispatch({ type: "UPDATE_STATUS", id: asset.id, status: "RETIRED" });
    toast("자산이 반려 처리되었습니다.", { duration: 2500 });
    onBack();
  }

  return (
    <div className="px-10 py-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft size={13} /> 심의 목록으로
      </button>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-[20px] font-semibold text-foreground tracking-tight">{asset.name}</h1>
        <span className={`inline-flex items-center px-2.5 py-1 rounded text-[12px] font-medium ${chip.bg} ${chip.text}`}>
          {ASSET_STATUS_LABELS[asset.status]}
        </span>
        <span className="text-[11px] text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>v{asset.version}</span>
      </div>

      <div className="flex gap-6 items-start">
        {/* Left: detail sections */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* 기본 정보 */}
          <SectionCard title="기본 정보">
            <div className="flex flex-col gap-2.5">
              <InfoRow label="설명" value={asset.description} />
              <InfoRow label="등록자" value={`${asset.ownerName} · ${asset.ownerDepartment}`} />
              <InfoRow label="유형" value={asset.assetTypeLabel} />
              <InfoRow label="공개 범위" value={asset.visibility} />
              <InfoRow label="등록일" value={asset.createdAt} />
            </div>
          </SectionCard>

          {/* 심의 기준본 요약 */}
          {asset.assetType === "AUTOMATION" && (
            <SectionCard title="심의 기준본 요약">
              <div className="flex flex-col gap-2.5 text-[12px]">
                {(asset.typeSpecific as { connectedServices?: string[]; processingSteps?: string[] }).connectedServices && (
                  <InfoRow
                    label="연결 서비스"
                    value={((asset.typeSpecific as { connectedServices: string[] }).connectedServices).join(", ")}
                  />
                )}
                {(asset.typeSpecific as { processingSteps?: string[] }).processingSteps && (
                  <div className="flex gap-3">
                    <span className="text-muted-foreground w-24 flex-shrink-0">처리 단계</span>
                    <ol className="flex flex-col gap-1">
                      {((asset.typeSpecific as { processingSteps: string[] }).processingSteps).map((s, i) => (
                        <li key={i} className="text-foreground">{i + 1}. {s}</li>
                      ))}
                    </ol>
                  </div>
                )}
                <InfoRow label="권한" value={asset.permissionLevel.join(", ")} />
                {asset.scheduledExecution && (
                  <InfoRow label="예약 실행" value={asset.scheduledExecution} />
                )}
              </div>
            </SectionCard>
          )}

          {/* 자가진단 */}
          <SectionCard title="자가진단">
            <div className="flex flex-col gap-2">
              {diagnosis.map((d, i) => (
                <div key={i} className="flex items-start gap-3 text-[12px]">
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[11px] font-medium ${
                    d.ans === "예"
                      ? "bg-red-50 text-red-600 border border-red-100"
                      : "bg-green-50 text-green-700 border border-green-100"
                  }`}>{d.ans}</span>
                  <span className="text-foreground pt-0.5">{d.q}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 자동 사전검사 결과 */}
          <SectionCard title="자동 사전검사 결과">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded text-[12px] text-orange-700 font-medium">
                <AlertTriangle size={12} /> {REVIEW_PATH_LABELS[asset.review.stage]}
              </div>
              {asset.review.additionalReviews.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded text-[12px] text-blue-700">
                  {asset.review.additionalReviews.join(", ")} 필요
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {asset.review.reasons.map(r => (
                <span key={r} className="inline-flex items-center px-2 py-0.5 bg-orange-50 text-orange-700 text-[11px] rounded border border-orange-100">
                  {r}
                </span>
              ))}
            </div>
          </SectionCard>

          {/* 데이터 취급 + 실행 환경 */}
          <SectionCard title="데이터 취급 및 실행 환경">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-[12px]">
                <Database size={12} className="text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground w-24">민감도</span>
                <span className="text-foreground font-medium">{asset.dataHandling.sensitivity}</span>
              </div>
              <div className="flex items-center gap-2 text-[12px]">
                <Shield size={12} className={`flex-shrink-0 ${asset.dataHandling.externalTransfer ? "text-red-500" : "text-green-600"}`} />
                <span className="text-muted-foreground w-24">외부 전송</span>
                <span className={`font-medium ${asset.dataHandling.externalTransfer ? "text-red-600" : "text-green-700"}`}>
                  {asset.dataHandling.externalTransfer ? "있음" : "없음"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[12px]">
                <Zap size={12} className="text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground w-24">실행 환경</span>
                <span className="text-foreground font-medium">{asset.executionEnvironment.join(", ")}</span>
              </div>
              {asset.scheduledExecution && (
                <div className="flex items-center gap-2 text-[12px]">
                  <Clock size={12} className="text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground w-24">예약 실행</span>
                  <span className="text-foreground font-medium">{asset.scheduledExecution}</span>
                </div>
              )}
              <InfoRow label="비용" value={`${asset.cost.display} — ${asset.cost.note}`} />
            </div>
          </SectionCard>
        </div>

        {/* Right: action panel */}
        <div className="w-[260px] flex-shrink-0 sticky top-0 flex flex-col gap-3">
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-[12px] font-semibold text-foreground">운영자 처리</p>
            </div>
            <div className="px-4 py-4 flex flex-col gap-2">
              <button
                onClick={handleApprove}
                disabled={asset.status === "PUBLISHED"}
                className="w-full h-9 rounded bg-green-600 text-white text-[12px] font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                승인
              </button>
              <button
                onClick={() => setModal("approval")}
                disabled={asset.status === "CONDITIONAL_APPROVAL" || asset.status === "PUBLISHED"}
                className="w-full h-9 rounded bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                조건부 승인
              </button>
              <button
                onClick={() => setModal("revision")}
                disabled={asset.status === "REVISION_REQUESTED"}
                className="w-full h-9 rounded bg-orange-500 text-white text-[12px] font-medium hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                보완 요청
              </button>
              <button
                onClick={handleReject}
                className="w-full h-9 rounded border border-red-200 text-red-600 text-[12px] font-medium hover:bg-red-50 transition-colors"
              >
                반려
              </button>
            </div>
          </div>

          {/* Asset meta panel */}
          <div className="bg-card border border-border rounded-md px-4 py-4 flex flex-col gap-2.5">
            <p className="text-[11px] font-semibold text-foreground mb-1">자산 요약</p>
            {[
              { label: "처리 경로", value: REVIEW_PATH_LABELS[asset.review.stage] },
              { label: "정책 버전", value: asset.review.policyVersion },
              { label: "접수일",   value: asset.createdAt },
            ].map(r => (
              <div key={r.label} className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="text-foreground font-medium" style={{ fontFamily: r.label === "정책 버전" ? "'DM Mono', monospace" : undefined }}>{r.value}</span>
              </div>
            ))}
            {asset.review.additionalReviews.length > 0 && (
              <div className="pt-2 border-t border-border">
                {asset.review.additionalReviews.map(r => (
                  <span key={r} className="inline-flex items-center gap-1 text-[11px] text-blue-600">
                    <Shield size={10} /> {r}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {modal === "revision" && (
        <RevisionModal assetName={asset.name} onSubmit={handleRevisionSubmit} onClose={() => setModal(null)} />
      )}
      {modal === "approval" && (
        <ApprovalModal assetName={asset.name} onSubmit={handleApprovalSubmit} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
