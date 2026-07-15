import { useState } from "react";
import { Shield, CheckCircle2, AlertTriangle, Info, DollarSign } from "lucide-react";
import { useAssets } from "../context/AssetContext";
import { getAssetById } from "../data/store";
import type { AIAsset } from "../data/types";

// ─── Policy definitions ───────────────────────────────────────────────────────

interface Policy {
  id: string;
  name: string;
  target: string;
  condition: string;
  result: string;
  resultColor: string;
  policyVersion: string;
  active: boolean;
  icon: React.ReactNode;
  // Simulation logic: check if asset matches
  matches: (asset: AIAsset) => { triggered: boolean; detail: string };
}

const POLICIES: Policy[] = [
  {
    id: "p1",
    name: "외부 데이터 전송",
    target: "모든 자산 유형",
    condition: "외부 AI 또는 서비스로 사내 데이터를 전송",
    result: "정밀 심의",
    resultColor: "text-orange-600 bg-orange-50 border-orange-200",
    policyVersion: "v2025.2",
    active: true,
    icon: <Shield size={14} className="text-orange-500" />,
    matches: (a) => ({
      triggered: a.dataHandling.externalTransfer,
      detail: a.dataHandling.externalTransfer
        ? `외부 전송 감지 — ${a.executionEnvironment.join(", ")}`
        : "외부 전송 없음",
    }),
  },
  {
    id: "p2",
    name: "문서 수정·삭제·발송",
    target: "쓰기 권한 포함 자산",
    condition: "문서 수정, 삭제, 메일 발송, 일정 등록 동작 포함",
    result: "정밀 심의",
    resultColor: "text-orange-600 bg-orange-50 border-orange-200",
    policyVersion: "v2025.2",
    active: true,
    icon: <AlertTriangle size={14} className="text-orange-500" />,
    matches: (a) => {
      const hasWrite = a.permissionLevel.some(p => /수정|생성|발송|등록|삭제/.test(p));
      return {
        triggered: hasWrite,
        detail: hasWrite
          ? `쓰기 권한 감지 — ${a.permissionLevel.filter(p => /수정|생성|발송|등록|삭제/.test(p)).join(", ")}`
          : "쓰기 권한 없음",
      };
    },
  },
  {
    id: "p3",
    name: "예약·반복 실행",
    target: "자동화, 스케줄러 유형",
    condition: "예약 실행 또는 트리거 기반 반복 실행 설정",
    result: "정밀 심의",
    resultColor: "text-orange-600 bg-orange-50 border-orange-200",
    policyVersion: "v2025.2",
    active: true,
    icon: <AlertTriangle size={14} className="text-orange-500" />,
    matches: (a) => ({
      triggered: !!a.scheduledExecution,
      detail: a.scheduledExecution
        ? `예약 실행 감지 — ${a.scheduledExecution}`
        : "예약 실행 없음",
    }),
  },
  {
    id: "p4",
    name: "사내 데이터 읽기 전용",
    target: "사내 시스템 연결 자산",
    condition: "쓰기 동작 없이 사내 시스템 또는 문서를 조회",
    result: "간편 심의",
    resultColor: "text-blue-600 bg-blue-50 border-blue-200",
    policyVersion: "v2025.1",
    active: true,
    icon: <Info size={14} className="text-blue-500" />,
    matches: (a) => {
      const hasRead  = a.permissionLevel.some(p => p.includes("읽기"));
      return {
        triggered: hasRead,
        detail: hasRead
          ? `읽기 권한 감지 — ${a.permissionLevel.filter(p => p.includes("읽기")).join(", ")}`
          : "사내 데이터 접근 없음",
      };
    },
  },
  {
    id: "p5",
    name: "종량제 API + 상한 없음",
    target: "API 비용 발생 자산",
    condition: "종량제 API 사용 또는 월 실행 상한 미확인",
    result: "비용 검토 추가",
    resultColor: "text-blue-600 bg-blue-50 border-blue-200",
    policyVersion: "v2025.2",
    active: true,
    icon: <DollarSign size={14} className="text-blue-500" />,
    matches: (a) => {
      const isCostBased = a.cost.measurementType === "ACTUAL" || a.cost.measurementType === "ESTIMATED";
      return {
        triggered: isCostBased,
        detail: isCostBased
          ? `종량제 API 사용 — ${a.cost.display}`
          : "추가 비용 없음",
      };
    },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      {title && <div className="px-5 py-3 border-b border-border"><h3 className="text-[13px] font-semibold text-foreground">{title}</h3></div>}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PolicyManagementScreen() {
  const { assets } = useAssets();
  const [selectedId, setSelectedId] = useState<string | null>("p1");

  const demo = getAssetById(assets, "asset-005")!;
  const selected = POLICIES.find(p => p.id === selectedId) ?? null;

  // Compute combined result for asset-005 across all policies
  function getCombinedResult(asset: AIAsset) {
    const deep  = POLICIES.slice(0, 3).some(p => p.matches(asset).triggered);
    const op    = POLICIES[3].matches(asset).triggered;
    const cost  = POLICIES[4].matches(asset).triggered;

    const path = deep ? "정밀 심의" : op ? "간편 심의" : "자동 등록";
    return { path, cost, matchCount: POLICIES.filter(p => p.matches(asset).triggered).length };
  }

  const combinedResult = getCombinedResult(demo);

  return (
    <div className="px-10 py-8">
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-foreground tracking-tight">정책 관리</h1>
        <p className="text-[13px] text-muted-foreground mt-1">심의 경로를 결정하는 자동화 정책을 확인합니다.</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Left: policy list */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {POLICIES.map(policy => {
            const isSelected = selectedId === policy.id;
            const assetMatch = policy.matches(demo);
            return (
              <button
                key={policy.id}
                onClick={() => setSelectedId(isSelected ? null : policy.id)}
                className={`text-left w-full border rounded-md p-4 transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border bg-card hover:border-primary/30 hover:bg-muted/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      {policy.icon}
                      <span className="text-[13px] font-semibold text-foreground">{policy.name}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${policy.resultColor}`}>
                        {policy.result}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2">
                      <div className="text-[11px]">
                        <span className="text-muted-foreground">적용 대상: </span>
                        <span className="text-foreground">{policy.target}</span>
                      </div>
                      <div className="text-[11px]">
                        <span className="text-muted-foreground">정책 버전: </span>
                        <span className="text-foreground font-mono" style={{ fontFamily: "'DM Mono', monospace" }}>{policy.policyVersion}</span>
                      </div>
                      <div className="text-[11px] col-span-2">
                        <span className="text-muted-foreground">조건: </span>
                        <span className="text-foreground">{policy.condition}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {/* active badge */}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      policy.active ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-100 text-gray-500 border border-gray-200"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${policy.active ? "bg-green-500" : "bg-gray-400"}`} />
                      {policy.active ? "활성" : "비활성"}
                    </span>
                    {/* asset-005 match indicator */}
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                      assetMatch.triggered ? "text-orange-600" : "text-muted-foreground/50"
                    }`}>
                      {assetMatch.triggered ? <CheckCircle2 size={10} /> : <span className="w-2.5 h-2.5 rounded-full border border-muted-foreground/30 inline-block" />}
                      asset-005 {assetMatch.triggered ? "해당" : "미해당"}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: simulation panel */}
        <div className="w-[320px] flex-shrink-0 sticky top-0 flex flex-col gap-3">
          <SectionCard title="시뮬레이션 대상">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-semibold text-orange-600">자동화</span>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-foreground leading-snug">주간 업무보고 자동 취합</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">asset-005 · 이성윤</p>
              </div>
            </div>
          </SectionCard>

          {selected && (
            <SectionCard title="선택된 정책 적용 결과">
              {(() => {
                const match = selected.matches(demo);
                return (
                  <div className="flex flex-col gap-3">
                    <div className={`flex items-center gap-2 p-2.5 rounded border text-[12px] font-medium ${
                      match.triggered ? selected.resultColor : "bg-green-50 text-green-700 border-green-200"
                    }`}>
                      {match.triggered
                        ? <AlertTriangle size={13} />
                        : <CheckCircle2 size={13} />}
                      {match.triggered ? `적용 → ${selected.result}` : "미적용 — 해당 없음"}
                    </div>
                    <p className="text-[12px] text-foreground">{match.detail}</p>
                    {match.triggered && (
                      <div className="text-[11px] text-muted-foreground bg-muted/30 rounded px-3 py-2">
                        정책 버전 <span className="font-mono text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{selected.policyVersion}</span>이 적용됩니다.
                      </div>
                    )}
                  </div>
                );
              })()}
            </SectionCard>
          )}

          <SectionCard title="전체 정책 적용 결과">
            <div className="flex flex-col gap-2">
              {POLICIES.map(p => {
                const m = p.matches(demo);
                return (
                  <div key={p.id} className="flex items-center gap-2 text-[11px]">
                    <span className={m.triggered ? "text-orange-500" : "text-muted-foreground/40"}>
                      {m.triggered ? "▶" : "—"}
                    </span>
                    <span className={m.triggered ? "text-foreground font-medium" : "text-muted-foreground/50"}>{p.name}</span>
                  </div>
                );
              })}
              <div className="mt-2 pt-2 border-t border-border flex flex-col gap-1.5">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] font-semibold self-start ${
                  combinedResult.path === "정밀 심의"
                    ? "bg-orange-50 text-orange-700 border border-orange-200"
                    : combinedResult.path === "간편 심의"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "bg-green-50 text-green-700 border border-green-200"
                }`}>
                  {combinedResult.path}
                </div>
                {combinedResult.cost && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] bg-blue-50 text-blue-700 border border-blue-200 self-start">
                    비용 검토 추가
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {combinedResult.matchCount}개 정책 적용 — asset-005의 실제 심의 결과와 일치
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
