import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useAssets } from "../context/AssetContext";
import { ASSET_STATUS_CHIP, ASSET_STATUS_LABELS } from "../data/types";
import type { AIAsset } from "../data/types";

type Resolution = "no-issue" | "needs-fix" | "critical";

const RESOLUTION_OPTS: { id: Resolution; label: string; desc: string; color: string; resultStatus: "PUBLISHED" | "CONDITIONAL_APPROVAL" | "SUSPENDED" }[] = [
  { id: "no-issue",   label: "문제 없음",  desc: "제보된 오류 재현 불가 — 기존 상태 복귀", color: "bg-green-600 hover:bg-green-700",     resultStatus: "PUBLISHED" },
  { id: "needs-fix",  label: "수정 필요",  desc: "경미한 문제 — 등록자 수정 요청 후 일시 중지", color: "bg-orange-500 hover:bg-orange-600", resultStatus: "SUSPENDED" },
  { id: "critical",   label: "중대 문제",  desc: "심각한 오류 — 즉시 사용 중지 조치",    color: "bg-red-600 hover:bg-red-700",          resultStatus: "SUSPENDED" },
];

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      {title && <div className="px-5 py-3 border-b border-border"><h3 className="text-[13px] font-semibold text-foreground">{title}</h3></div>}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export default function ReReviewScreen() {
  const { assets, checkingInfo, dispatch } = useAssets();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const checkingAssets = assets.filter(a => a.status === "CHECKING");
  const selected = selectedId ? checkingAssets.find(a => a.id === selectedId) ?? null : null;

  function handleResolve(asset: AIAsset, resolution: Resolution) {
    const opt = RESOLUTION_OPTS.find(o => o.id === resolution)!;
    const info = checkingInfo[asset.id];

    // "문제 없음" → 이전 상태로 복귀
    const targetStatus = resolution === "no-issue"
      ? (info?.previousStatus ?? "PUBLISHED")
      : "SUSPENDED";

    // If "문제 없음" restores to CHECKING (edge case), fall back to PUBLISHED
    const finalStatus = targetStatus === "CHECKING" ? "PUBLISHED" : targetStatus;

    dispatch({ type: "UPDATE_STATUS", id: asset.id, status: finalStatus as typeof finalStatus });
    toast.success(`처리 완료: ${opt.label}`, {
      description: `${asset.name} → ${ASSET_STATUS_LABELS[finalStatus as "PUBLISHED" | "CONDITIONAL_APPROVAL" | "SUSPENDED"]}`,
      duration: 3000,
    });
    setSelectedId(null);
  }

  if (selected) {
    const info = checkingInfo[selected.id];
    const chip = ASSET_STATUS_CHIP[selected.status];

    return (
      <div className="px-10 py-8">
        <button onClick={() => setSelectedId(null)} className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft size={13} /> 목록으로
        </button>
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-[20px] font-semibold text-foreground">{selected.name}</h1>
          <span className={`inline-flex items-center px-2.5 py-1 rounded text-[12px] font-medium ${chip.bg} ${chip.text}`}>
            {ASSET_STATUS_LABELS[selected.status]}
          </span>
        </div>

        <div className="flex gap-6 items-start max-w-[860px]">
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            <SectionCard title="상태 변경 이력">
              <div className="flex flex-col gap-3">
                {/* History entry 1: game published/approved */}
                <div className="flex gap-3 text-[12px]">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
                    <CheckCircle2 size={10} className="text-green-600" />
                  </span>
                  <div>
                    <p className="text-foreground font-medium">
                      {info?.previousStatus === "CONDITIONAL_APPROVAL" ? "조건부 승인" : "게시"} 상태
                    </p>
                    <p className="text-muted-foreground text-[11px]">거버넌스 운영팀 · {selected.lastUpdated}</p>
                  </div>
                </div>
                {/* History entry 2: error report */}
                {info && (
                  <div className="flex gap-3 text-[12px]">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center">
                      <AlertTriangle size={10} className="text-orange-600" />
                    </span>
                    <div>
                      <p className="text-foreground font-medium">오류 제보 접수 → 확인 중 전환</p>
                      <p className="text-muted-foreground text-[11px]">
                        일반 사용자 제보 · {info.reportedAt} · 유형: {info.errorType || "미선택"}
                      </p>
                    </div>
                  </div>
                )}
                {/* Current state */}
                <div className="flex gap-3 text-[12px]">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  </span>
                  <div>
                    <p className="text-foreground font-medium">확인 중 — 처리 대기</p>
                    <p className="text-muted-foreground text-[11px]">거버넌스 운영팀 배정 대기</p>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="오류 제보 내용">
              <div className="flex flex-col gap-2 text-[12px]">
                <div className="flex gap-3">
                  <span className="text-muted-foreground w-20 flex-shrink-0">오류 유형</span>
                  <span className="text-foreground font-medium">{info?.errorType || "유형 미선택"}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-muted-foreground w-20 flex-shrink-0">제보일</span>
                  <span className="text-foreground">{info?.reportedAt ?? "—"}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-muted-foreground w-20 flex-shrink-0">이전 상태</span>
                  <span className="text-foreground">{info ? ASSET_STATUS_LABELS[info.previousStatus] : "—"}</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="자산 정보">
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[12px]">
                {[
                  { label: "유형",      value: selected.assetTypeLabel },
                  { label: "등록자",    value: `${selected.ownerName} · ${selected.ownerDepartment}` },
                  { label: "공개 범위", value: <>{selected.visibility} <span className="text-muted-foreground font-normal text-[10px]">(심의 배정)</span></> },
                  { label: "버전",      value: `v${selected.version}` },
                ].map(r => (
                  <div key={r.label} className="flex gap-3">
                    <span className="text-muted-foreground w-20 flex-shrink-0">{r.label}</span>
                    <span className="text-foreground font-medium">{r.value}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* Right: action panel */}
          <div className="w-[240px] flex-shrink-0 sticky top-0">
            <div className="bg-card border border-border rounded-md overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-[12px] font-semibold text-foreground">운영자 처리 결과</p>
              </div>
              <div className="px-4 py-4 flex flex-col gap-2.5">
                {RESOLUTION_OPTS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => handleResolve(selected, opt.id)}
                    className={`w-full flex flex-col items-start gap-0.5 p-3 rounded text-left transition-colors ${opt.color} text-white`}
                  >
                    <span className="text-[12px] font-semibold">{opt.label}</span>
                    <span className="text-[10px] opacity-80">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-10 py-8">
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-foreground tracking-tight">재심의·차단 관리</h1>
        <p className="text-[13px] text-muted-foreground mt-1">오류 제보로 확인 중 상태가 된 자산을 검토하고 처리합니다.</p>
      </div>

      <div className="bg-card border border-border rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["자산명", "유형", "등록자", "오류 유형", "제보일", "이전 상태", ""].map(h => (
                <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3 first:pl-5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {checkingAssets.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-[13px] text-muted-foreground">
                  <CheckCircle2 size={24} className="mx-auto mb-2 text-green-500" />
                  처리 대기 중인 오류 제보가 없습니다.
                </td>
              </tr>
            ) : checkingAssets.map(asset => {
              const info = checkingInfo[asset.id];
              const chip = ASSET_STATUS_CHIP[asset.status];
              return (
                <tr key={asset.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-[13px] font-medium text-foreground">{asset.name}</p>
                    <p className="text-[11px] text-muted-foreground">{asset.category}</p>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-muted-foreground">{asset.assetTypeLabel}</td>
                  <td className="px-4 py-3 text-[12px] text-foreground">{asset.ownerName}</td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-orange-600">{info?.errorType || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-muted-foreground">{info?.reportedAt ?? "—"}</td>
                  <td className="px-4 py-3">
                    {info && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${ASSET_STATUS_CHIP[info.previousStatus].bg} ${ASSET_STATUS_CHIP[info.previousStatus].text}`}>
                        {ASSET_STATUS_LABELS[info.previousStatus]}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedId(asset.id)}
                      className="h-7 px-3 rounded bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors"
                    >
                      처리하기
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
