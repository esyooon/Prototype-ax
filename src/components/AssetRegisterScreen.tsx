import { useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Info, Paperclip, Image as ImageIcon, CheckCircle2, AlertTriangle, XCircle, Clock, Sparkles, Bot } from "lucide-react";
import { useAssets } from "../context/AssetContext";
import type { AssetType, ReviewPath, SelfDiagnosisAnswers } from "../data/types";
import { calculateReviewPath } from "../data/reviewPolicy";
import { ASSET_TYPE_FIELD_SCHEMAS, type AssetTypeField } from "../data/assetTypeSchemas";
import { ASSET_TYPE_LABELS } from "../data/types";

// ─── Types ───────────────────────────────────────────────────────────────────

type DiagAnswer = "yes" | "no" | "unknown" | null;
type ReviewResult = ReviewPath;

interface FormData {
  assetType: AssetType | null;
  name: string;
  description: string;
  useCases: string;
  limitations: string;
  visibility: string;
  // step 3 automation fields (레거시 — OriginZone의 AI 초안 채우기가 아직 씀)
  trigger: string;
  processingSteps: string;
  operations: string[];
  // step 3 other type fields (generic)
  genericContent: string;
  // step 3 유형별 필드 (B1 스키마 렌더러가 채움) — key는 AssetTypeField.key
  typeFields: Record<string, unknown>;
  // step 3 통합: "이 자산이 무엇을 사용하나요?" (구 연결 서비스 + 실행 환경)
  usageSelections: string[];
  hasCost: DiagAnswer;
  // origin zone (step 2 상단) — 유형별 원문. 자가진단 힌트 스캔에도 쓰인다.
  originContent: string;
  originFileName: string;
  originLink: string;
  aiDraftApplied: boolean;
}

interface DiagState {
  q1: DiagAnswer; // 개인정보
  q2: DiagAnswer; // 외부 AI 전송
  q3: DiagAnswer; // 문서 읽기
  q4: DiagAnswer; // 문서 수정/메일/일정
  q5: DiagAnswer; // 자동 실행
  q6: DiagAnswer; // 반복 실행
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  "자산 유형", "기본 정보", "자산 내용", "자가진단", "사전검사"
];

const ASSET_TYPES: { type: AssetType; label: string; desc: string; badge: { bg: string; text: string } }[] = [
  { type: "PROMPT",     label: "프롬프트",              desc: "LLM에 전달할 지시 템플릿",                    badge: { bg: "bg-blue-50",    text: "text-blue-600"   } },
  { type: "ASSISTANT",  label: "맞춤형 AI",              desc: "특정 역할과 지식베이스를 가진 AI 어시스턴트", badge: { bg: "bg-violet-50",  text: "text-violet-600" } },
  { type: "AUTOMATION", label: "자동화",                 desc: "트리거 조건으로 실행되는 반복 워크플로우",    badge: { bg: "bg-orange-50",  text: "text-orange-600" } },
  { type: "APP",        label: "앱",                     desc: "AI 기능이 포함된 웹 앱 또는 API 서비스",      badge: { bg: "bg-emerald-50", text: "text-emerald-600"} },
  { type: "MCP",        label: "시스템 연결 도구(MCP)",  desc: "AI가 외부 시스템에 안전하게 접근하는 도구",   badge: { bg: "bg-cyan-50",    text: "text-cyan-600"   } },
  { type: "OTHER",      label: "기타",                   desc: "위 유형에 속하지 않는 AI 관련 자산",          badge: { bg: "bg-gray-100",   text: "text-gray-600"   } },
];

// ─── "이 자산이 무엇을 사용하나요?" (구 3단계 연결 서비스 + 5단계 실행 환경 통합) ──
// 다중선택 결과에서 필요한 계정·라이선스를 자동 추론해 읽기전용으로 보여준다
// (등록자가 직접 입력하지 않음). calculateReviewPath의 costReview/operatorCheck도
// 이 선택지 값을 그대로 입력받는다 — reviewPolicy.ts 참고.
const USAGE_OPTIONS = [
  "Gemini Enterprise", "Claude", "GitHub Copilot",
  "Google Docs·Sheets·Forms", "브라우저", "별도 서버", "기타",
];

const REQUIRED_LICENSE_BY_USAGE: Partial<Record<string, string>> = {
  "Gemini Enterprise": "Google Workspace 계정",
  "Claude": "Claude Team/Enterprise 계정",
  "GitHub Copilot": "GitHub Copilot 라이선스",
  "Google Docs·Sheets·Forms": "Google Workspace 계정",
  "별도 서버": "사내 서버 접근 권한",
};

function deriveRequiredLicenses(usageSelections: string[]): string[] {
  const licenses = new Set<string>();
  usageSelections.forEach((u) => {
    const lic = REQUIRED_LICENSE_BY_USAGE[u];
    if (lic) licenses.add(lic);
  });
  return Array.from(licenses);
}

const DIAG_QUESTIONS: { key: keyof DiagState; q: string; example: string; why: string }[] = [
  {
    key: "q1",
    q: "개인정보나 중요한 회사 정보를 다루나요?",
    example: "예: 직원 이름·연락처, 계약 금액, 고객 정보",
    why: "민감한 정보가 외부에 유출되거나 부적절하게 처리될 위험이 있어 심의가 필요합니다.",
  },
  {
    key: "q2",
    q: "회사 밖의 AI나 서비스로 데이터를 보내나요?",
    example: "예: Gemini API 호출, OpenAI API 전송, 외부 SaaS 연동",
    why: "외부 서비스로 사내 데이터가 전송되면 데이터 주권과 보안 정책을 검토해야 합니다.",
  },
  {
    key: "q3",
    q: "회사 시스템이나 문서를 계정 권한으로 읽나요?",
    example: "예: Google Drive 문서 조회, Confluence 페이지 읽기",
    why: "사내 자산에 접근하는 경우 권한 범위와 감사 추적이 필요합니다.",
  },
  {
    key: "q4",
    q: "메일 발송, 문서 수정, 삭제, 일정 등록 같은 동작을 하나요?",
    example: "예: 이메일 자동 발송, 문서 내용 수정, 캘린더 일정 생성",
    why: "쓰기 동작은 되돌리기 어려운 변경을 일으킬 수 있어 더 엄격한 검토가 필요합니다.",
  },
  {
    key: "q5",
    q: "사람이 확인하지 않아도 다음 단계까지 자동으로 실행되나요?",
    example: "예: AI가 판단해서 직접 메일 발송, 승인 없이 문서 등록",
    why: "완전 자동 실행은 오작동 시 영향 범위가 커서 별도 안전장치가 필요합니다.",
  },
  {
    key: "q6",
    q: "정해진 시간이나 조건에 따라 반복 실행되나요?",
    example: "예: 매일 오전 9시 실행, 폼 제출 시 자동 트리거",
    why: "반복 실행은 누적 영향이 크고 모니터링 체계가 필요합니다.",
  },
];

// ─── 원문 존: 유형별 mock 원문 / AI 초안 ──────────────────────────────────────
// 파일 첨부·링크 입력은 실제 내용을 읽을 수 없으므로, 첨부·입력 시점에 해당
// 유형에 맞는 mock 원문을 대신 채운다. 자가진단 힌트 스캔(작업 2)도 이 원문을
// 기준으로 한다.
const MOCK_ORIGIN_TEXT: Partial<Record<AssetType, string>> = {
  AUTOMATION: "회의가 끝나면 녹취록을 정리해서 결정사항과 담당자별 할 일을 팀 채널로 메일로 보내고, 완료된 항목은 자동으로 삭제 처리합니다. 문서 수정 이력도 함께 남깁니다.",
  ASSISTANT: "이 어시스턴트는 사내 규정 문서를 검색해 질문에 답합니다. 문서 수정 권한은 없으며 읽기 전용으로 동작합니다.",
};

const AI_DRAFT_BY_TYPE: Partial<Record<AssetType, { description: string; useCases: string; processingSteps?: string }>> = {
  AUTOMATION: {
    description: "회의록을 붙여넣으면 결정사항·할 일을 분리합니다.",
    useCases: "입력: 회의 녹취록 붙여넣기\n출력: 결정사항 3건, 담당자별 할 일 목록",
    processingSteps: "1. 원문 텍스트 분석\n2. 결정사항 추출\n3. 담당자·기한 매칭\n4. 요약본 생성\n5. 사용자 확인",
  },
  PROMPT: {
    description: "고객 문의를 유형별로 분류하고 답변 초안을 작성합니다.",
    useCases: "입력: 고객 문의 원문\n출력: 문의 유형, 답변 초안, 확인 필요 사항",
  },
  ASSISTANT: {
    description: "연결된 문서를 바탕으로 질문에 답합니다.",
    useCases: '입력: "재택근무 신청 방법은?"\n출력: 관련 규정 조항과 요약 답변',
  },
};

// ─── 작성 중 스캔 힌트 (자가진단 힌트) ─────────────────────────────────────────
// 원문(원문 존에서 채워진 form.originContent)에 특정 표현이 있으면 해당 문항
// 옆에 힌트만 띄운다. 답은 절대 미리 체크하지 않는다 — 등록자가 직접 판단.
const SCAN_HINTS: Partial<Record<keyof DiagState, { keyword: string; phrase: string }[]>> = {
  q4: [
    { keyword: "보내", phrase: "메일로 보내" },
    { keyword: "삭제", phrase: "삭제" },
    { keyword: "수정", phrase: "수정" },
  ],
};

function getScanHints(key: keyof DiagState, originContent: string): string[] {
  const rules = SCAN_HINTS[key];
  if (!rules || !originContent.trim()) return [];
  const hints: string[] = [];
  for (const rule of rules) {
    if (originContent.includes(rule.keyword) && !hints.includes(rule.phrase)) {
      hints.push(rule.phrase);
    }
  }
  return hints;
}

// ─── 유형별 필드(B1 스키마) 완성 여부 ─────────────────────────────────────────
// 스키마의 required 필드가 전부 채워졌는지만 본다 — 위험 신호 판정(B3)과는 별개.
function isTypeFieldsComplete(assetType: AssetType, typeFields: Record<string, unknown>): boolean {
  const schema = ASSET_TYPE_FIELD_SCHEMAS[assetType];
  return schema.fields
    .filter((f) => f.required)
    .every((f) => {
      const v = typeFields[f.key];
      if (f.inputType === "checkbox") return typeof v === "boolean";
      if (Array.isArray(v)) return v.length > 0;
      return typeof v === "string" ? v.trim().length > 0 : v != null;
    });
}

const DEMO_FORM: Partial<FormData> = {
  assetType: "AUTOMATION",
  name: "주간 업무보고 자동 취합",
  description: "팀원의 주간 업무를 모아 완료·진행·이슈로 정리하고 보고서 초안을 생성합니다.",
  useCases: "매주 금요일 팀원 주간보고를 자동으로 수집해 보고서 초안을 작성하고, 담당자가 검토 후 Google Docs에 반영합니다.",
  limitations: "",
  visibility: "전 임직원",
  trigger: "매주 금요일 오후 5시 (예약 실행)",
  processingSteps: "1. 폼 응답 수집\n2. 주간 업무 분류\n3. 통합 문서 초안 생성\n4. 사용자 확인\n5. 문서 반영",
  operations: ["읽기", "문서 생성·수정"],
  typeFields: {
    touchedServices: ["GOOGLE_WORKSPACE"],
    doesSend: false,
    doesModify: true,
    doesDelete: false,
    executionMode: "SCHEDULED",
    filePayload: "weekly_report.gs",
    installGuide: "Google Apps Script 프로젝트에 코드를 붙여넣고 매주 금요일 오후 5시 트리거를 설정하세요.",
  },
  usageSelections: ["Gemini Enterprise", "Google Docs·Sheets·Forms"],
  hasCost: "yes",
};

const DEMO_DIAG: DiagState = { q1: "no", q2: "yes", q3: "yes", q4: "yes", q5: "no", q6: "yes" };

// ─── Pre-check logic ─────────────────────────────────────────────────────────
// 실제 계산은 등록·운영자 화면이 공유하는 calculateReviewPath(공용 함수)가
// 담당한다. 여기서는 마법사 단계에서 쓰는 로컬 폼 상태를 그 함수의 입력
// 형태로 변환만 한다.

function runPreCheck(
  form: FormData,
  diag: DiagState
): ReturnType<typeof calculateReviewPath> {
  return calculateReviewPath(diag as SelfDiagnosisAnswers, {
    envSelections: form.usageSelections,
    hasCost: form.hasCost,
  });
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      {title && (
        <div className="px-6 py-3.5 border-b border-border">
          <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
        </div>
      )}
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Field({ label, required, children, hint, badge }: { label: string; required?: boolean; children: React.ReactNode; hint?: string; badge?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label className="text-[12px] font-medium text-foreground">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {badge}
      </div>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function AiDraftBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 rounded px-1.5 py-0.5">
      <Sparkles size={10} /> AI 초안 — 확인 후 수정하세요
    </span>
  );
}

const inputCls = "w-full h-8 px-3 rounded border border-border bg-background text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";
const textareaCls = "w-full px-3 py-2 rounded border border-border bg-background text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none";

// ─── Main component ───────────────────────────────────────────────────────────

export default function AssetRegisterScreen({ onNavigate }: { onNavigate?: (menu: string) => void }) {
  const { dispatch } = useAssets();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({
    assetType: null, name: "", description: "", useCases: "", limitations: "",
    visibility: "전 임직원", trigger: "", processingSteps: "",
    operations: [], genericContent: "", typeFields: {}, usageSelections: [], hasCost: null,
    originContent: "", originFileName: "", originLink: "", aiDraftApplied: false,
  });
  const [diag, setDiag] = useState<DiagState>({ q1: null, q2: null, q3: null, q4: null, q5: null, q6: null });
  const [submitted, setSubmitted] = useState(false);
  const [tooltipKey, setTooltipKey] = useState<string | null>(null);

  function patchForm(patch: Partial<FormData>) { setForm(prev => ({ ...prev, ...patch })); }
  function fillDemo() { patchForm(DEMO_FORM as FormData); setDiag(DEMO_DIAG); }

  function canAdvance(): boolean {
    if (step === 1) return form.assetType !== null;
    if (step === 2) return form.name.trim().length > 0 && form.description.trim().length > 0;
    if (step === 3) {
      const usageOk = form.usageSelections.length > 0 && form.hasCost !== null;
      const typeFieldsOk = form.assetType ? isTypeFieldsComplete(form.assetType, form.typeFields) : true;
      return usageOk && typeFieldsOk;
    }
    if (step === 4) return Object.values(diag).every(v => v !== null);
    return true;
  }

  function handleSubmit() {
    dispatch({ type: "UPDATE_STATUS", id: "asset-005", status: "REVIEW_PENDING" });
    dispatch({ type: "SET_CATALOG_VISIBILITY", id: "asset-005", showOnCatalog: false });
    setSubmitted(true);
    toast.success("등록 신청이 완료되었습니다.", { description: "정밀 심의 대기 상태로 접수되었습니다.", duration: 4000 });
  }

  const check = step === 5 ? runPreCheck(form, diag) : null;

  if (submitted) {
    return <SubmittedState onNavigate={onNavigate} assetName={form.name || "자산"} />;
  }

  return (
    <div className="px-10 py-8">
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-foreground tracking-tight">자산 등록</h1>
        <p className="text-[13px] text-muted-foreground mt-1">AI 자산을 등록하고 자동 사전검사를 거쳐 심의를 신청합니다.</p>
      </div>

      {/* Step bar */}
      <StepBar current={step} />

      <div className="mt-6 flex gap-6 items-start max-w-[900px] mx-auto">
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {step === 1 && <Step1 form={form} patchForm={patchForm} />}
          {step === 2 && <Step2 form={form} patchForm={patchForm} fillDemo={fillDemo} />}
          {step === 3 && <Step3 form={form} patchForm={patchForm} />}
          {step === 4 && <Step4 diag={diag} setDiag={setDiag} tooltipKey={tooltipKey} setTooltipKey={setTooltipKey} originContent={form.originContent} />}
          {step === 5 && check && <Step5 check={check} form={form} onSubmit={handleSubmit} />}

          {/* Navigation */}
          {step < 5 && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep(s => Math.max(1, s - 1))}
                disabled={step === 1}
                className="h-8 px-4 rounded border border-border text-[12px] text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                이전
              </button>
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canAdvance()}
                className="flex items-center gap-1.5 h-8 px-5 rounded bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                다음 <ChevronRight size={13} />
              </button>
            </div>
          )}
          {step === 5 && (
            <div className="flex items-center justify-start pt-2">
              <button
                onClick={() => setStep(4)}
                className="h-8 px-4 rounded border border-border text-[12px] text-foreground hover:bg-muted transition-colors"
              >
                이전
              </button>
            </div>
          )}
        </div>

        {/* Side panel: shows live diagnosis summary from step 4 onward */}
        {step >= 4 && (
          <div className="w-[220px] flex-shrink-0 sticky top-0">
            <DiagSummaryPanel diag={diag} form={form} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── StepBar ─────────────────────────────────────────────────────────────────

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center">
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
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px mx-2 flex-shrink-0 ${n < current ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: 자산 유형 ────────────────────────────────────────────────────────

function Step1({ form, patchForm }: { form: FormData; patchForm: (p: Partial<FormData>) => void }) {
  return (
    <SectionCard title="어떤 유형의 AI 자산을 등록하나요?">
      <div className="grid grid-cols-2 gap-3">
        {ASSET_TYPES.map(({ type, label, desc, badge }) => (
          <button
            key={type}
            onClick={() => patchForm({ assetType: type })}
            className={`flex items-start gap-3 p-4 rounded-md border text-left transition-all ${
              form.assetType === type
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border hover:border-primary/40 hover:bg-muted/30"
            }`}
          >
            <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium flex-shrink-0 mt-0.5 ${badge.bg} ${badge.text}`}>
              {label}
            </span>
            <div>
              <p className="text-[12px] text-foreground font-medium">{label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </button>
        ))}
      </div>
      {form.assetType && form.assetType !== "AUTOMATION" && (
        <p className="mt-4 text-[12px] text-muted-foreground bg-muted/40 rounded px-3 py-2">
          이번 데모에서는 <strong>자동화</strong> 유형만 끝까지 완성된 데이터로 진행됩니다. 다른 유형은 양식 구조만 제공됩니다.
        </p>
      )}
    </SectionCard>
  );
}

// ─── 원문 존 (Step2 최상단) ────────────────────────────────────────────────────
// 유형에 따라 하나만 활성화: 프롬프트=텍스트박스, 자동화=파일 첨부, 맞춤형 AI=링크.
// [AI로 초안 채우기]는 실제 AI 연동 없이 유형별 mock 초안을 폼에 채워 넣는다.

function OriginZone({ form, patchForm }: { form: FormData; patchForm: (p: Partial<FormData>) => void }) {
  const [showTip, setShowTip] = useState(false);
  const draft = form.assetType ? AI_DRAFT_BY_TYPE[form.assetType] : undefined;

  if (!form.assetType || !draft) return null;

  function applyAiDraft() {
    if (!draft) return;
    patchForm({
      description: draft.description,
      useCases: draft.useCases,
      ...(draft.processingSteps ? { processingSteps: draft.processingSteps } : {}),
      aiDraftApplied: true,
    });
    toast.success("AI 초안을 채웠습니다.", { description: "내용을 확인하고 필요한 부분을 수정하세요.", duration: 2500 });
  }

  return (
    <SectionCard>
      <div className="flex items-center gap-1.5 mb-3">
        <h3 className="text-[13px] font-semibold text-foreground">원문 붙여넣기</h3>
        <div
          className="relative flex items-center text-muted-foreground hover:text-foreground transition-colors"
          onMouseEnter={() => setShowTip(true)}
          onMouseLeave={() => setShowTip(false)}
        >
          <Info size={12} />
          {showTip && (
            <div className="absolute left-0 top-5 z-10 w-64 bg-foreground text-background text-[11px] leading-relaxed rounded-md px-3 py-2 shadow-lg">
              붙여넣은 원문을 바탕으로 아래 항목의 초안을 대신 작성해드립니다.
            </div>
          )}
        </div>
      </div>

      {form.assetType === "PROMPT" && (
        <textarea
          className={textareaCls}
          rows={5}
          value={form.originContent}
          onChange={e => patchForm({ originContent: e.target.value })}
          placeholder="프롬프트 원문이나 관련 대화 내용을 붙여넣으세요."
        />
      )}

      {form.assetType === "AUTOMATION" && (
        form.originFileName ? (
          <DemoFileCard name={form.originFileName} size="18 KB" type="워크플로 내보내기" />
        ) : (
          <button
            onClick={() => patchForm({ originFileName: "meeting_workflow_export.json", originContent: MOCK_ORIGIN_TEXT.AUTOMATION! })}
            className="flex items-center gap-1.5 h-8 px-4 rounded border border-dashed border-border text-[12px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
          >
            <Paperclip size={12} /> 파일 선택 (데모)
          </button>
        )
      )}

      {form.assetType === "ASSISTANT" && (
        <input
          className={inputCls}
          placeholder="https://"
          value={form.originLink}
          onChange={e => {
            const link = e.target.value;
            patchForm({ originLink: link, originContent: link.trim() ? MOCK_ORIGIN_TEXT.ASSISTANT! : "" });
          }}
        />
      )}

      <button
        onClick={applyAiDraft}
        disabled={!form.originContent.trim()}
        className="mt-3 flex items-center gap-1.5 h-8 px-4 rounded bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <Sparkles size={13} /> AI로 초안 채우기
      </button>
    </SectionCard>
  );
}

// ─── Step 2: 기본 정보 ────────────────────────────────────────────────────────

function Step2({ form, patchForm, fillDemo }: { form: FormData; patchForm: (p: Partial<FormData>) => void; fillDemo: () => void }) {
  return (
    <>
      <OriginZone form={form} patchForm={patchForm} />

      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-semibold text-foreground">기본 정보</h3>
          <button
            onClick={fillDemo}
            className="flex items-center gap-1.5 h-7 px-3 rounded border border-primary/40 text-primary text-[11px] font-medium hover:bg-primary/5 transition-colors"
          >
            데모 정보 불러오기 (asset-005)
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <Field label="자산 이름" required>
            <input className={inputCls} value={form.name} onChange={e => patchForm({ name: e.target.value })} placeholder="예: 주간 업무보고 자동 취합" />
          </Field>
          <Field label="어떤 업무를 해결하나요?" required badge={form.aiDraftApplied ? <AiDraftBadge /> : null}>
            <textarea className={`${textareaCls} ${form.aiDraftApplied ? "bg-primary/5" : ""}`} rows={3} value={form.description} onChange={e => patchForm({ description: e.target.value })} placeholder="이 자산이 어떤 문제를 해결하는지 간단히 설명해 주세요." />
          </Field>
          <Field label="사용 예시" hint="실제 사용 시나리오나 대표 사례를 입력하세요." badge={form.aiDraftApplied ? <AiDraftBadge /> : null}>
            <textarea className={`${textareaCls} ${form.aiDraftApplied ? "bg-primary/5" : ""}`} rows={3} value={form.useCases} onChange={e => patchForm({ useCases: e.target.value })} placeholder="예: 팀장이 금요일마다 팀원 보고를 수동으로 취합하는 시간을 줄이기 위해 사용합니다." />
          </Field>
          <Field label="이미지 첨부" hint="사용 화면 캡처나 참고 이미지를 첨부하세요.">
            <DemoFileCard name="example_screenshot.png" size="482 KB" type="PNG 이미지" icon={<ImageIcon size={13} className="text-primary" />} />
          </Field>
          <Field label="이럴 때는 주의하세요" hint="사용자가 미리 알아야 할 주의사항을 적어주세요.">
            <textarea className={textareaCls} rows={2} value={form.limitations} onChange={e => patchForm({ limitations: e.target.value })} placeholder="예: 보고서 개수가 10개를 넘으면 정확하게 요약되지 않을 수 있어요" />
          </Field>
        </div>
      </SectionCard>

      <p className="text-[12px] text-muted-foreground px-1">
        게시되는 모든 자산은 전 임직원에게 공개됩니다.
      </p>
    </>
  );
}

// ─── Step 3: 심의 기준본 ──────────────────────────────────────────────────────

function Step3({ form, patchForm }: { form: FormData; patchForm: (p: Partial<FormData>) => void }) {
  return (
    <>
      <div className="bg-muted/40 border border-border rounded-md px-4 py-3 text-[12px] text-muted-foreground">
        심의 기준본은 자산의 실제 내용이나 실행 구조를 확인하기 위한 자료입니다. API 키·비밀번호는 절대 입력하지 마세요.
        <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-medium"><AlertTriangle size={11} /> API 키·비밀번호 입력 금지</span>
      </div>

      {form.assetType && <TypeFieldsSection assetType={form.assetType} form={form} patchForm={patchForm} />}

      <UsageSection form={form} patchForm={patchForm} />
    </>
  );
}

// ─── 유형별 필드 렌더러 (B1 스키마 소비) ───────────────────────────────────────
// assetType이 바뀌면 ASSET_TYPE_FIELD_SCHEMAS에서 다른 필드 목록을 읽어오므로
// 자동으로 다른 필드 세트가 그려진다 — 유형별 분기 JSX는 더 이상 여기 없다.

function TypeFieldsSection({
  assetType, form, patchForm,
}: {
  assetType: AssetType;
  form: FormData;
  patchForm: (p: Partial<FormData>) => void;
}) {
  const schema = ASSET_TYPE_FIELD_SCHEMAS[assetType];

  function updateTypeField(key: string, value: unknown) {
    patchForm({ typeFields: { ...form.typeFields, [key]: value } });
  }

  const title = schema.subtypeLabel
    ? `${schema.subtypeLabel} 기준본`
    : `${ASSET_TYPE_LABELS[assetType]} 기준본`;

  return (
    <SectionCard title={title}>
      <div className="flex flex-col gap-4">
        {schema.fields.map((field) => (
          <SchemaField
            key={field.key}
            field={field}
            value={form.typeFields[field.key]}
            onChange={(v) => updateTypeField(field.key, v)}
          />
        ))}
      </div>
    </SectionCard>
  );
}

function SchemaField({
  field, value, onChange,
}: {
  field: AssetTypeField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (field.inputType === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-[12px] text-foreground cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded border-border accent-primary"
        />
        {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
    );
  }

  return (
    <Field label={field.label} required={field.required}>
      {field.inputType === "text" && (
        <input
          className={inputCls}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      )}
      {field.inputType === "url" && (
        <input
          type="url"
          className={inputCls}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? "https://"}
        />
      )}
      {field.inputType === "textarea" && (
        <textarea
          className={textareaCls}
          rows={4}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      )}
      {field.inputType === "select" && (
        <select
          className={inputCls}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">선택하세요</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}
      {field.inputType === "radio" && (
        <div className="flex gap-2">
          {field.options?.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`h-8 px-4 rounded-full text-[12px] border font-medium transition-colors ${
                value === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      {field.inputType === "multiselect" && (
        <div className="flex flex-wrap gap-2">
          {field.options?.map((opt) => {
            const selected = Array.isArray(value) && (value as string[]).includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const current = Array.isArray(value) ? (value as string[]) : [];
                  onChange(selected ? current.filter((v) => v !== opt.value) : [...current, opt.value]);
                }}
                className={`h-7 px-3 rounded-full text-[11px] border font-medium transition-colors ${
                  selected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
      {field.inputType === "file" && (
        value ? (
          <DemoFileCard name={value as string} size="—" type="첨부 파일" />
        ) : (
          <button
            type="button"
            onClick={() => onChange(`${field.key}_demo_file`)}
            className="flex items-center gap-1.5 h-8 px-4 rounded border border-dashed border-border text-[12px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors w-fit"
          >
            <Paperclip size={12} /> 파일 선택 (데모)
          </button>
        )
      )}
    </Field>
  );
}

// ─── 통합 질문: 이 자산이 무엇을 사용하나요? (구 연결 서비스 + 실행 환경) ────────

function UsageSection({ form, patchForm }: { form: FormData; patchForm: (p: Partial<FormData>) => void }) {
  const toggleUsage = (usage: string) => {
    const sel = form.usageSelections.includes(usage)
      ? form.usageSelections.filter(u => u !== usage)
      : [...form.usageSelections, usage];
    patchForm({ usageSelections: sel });
  };

  const requiredLicenses = deriveRequiredLicenses(form.usageSelections);

  return (
    <SectionCard title="실행 환경과 라이선스">
      <div className="flex flex-col gap-5">
        <Field label="이 자산이 무엇을 사용하나요?" required hint="해당하는 항목을 모두 선택하세요.">
          <div className="flex flex-wrap gap-2 mt-1">
            {USAGE_OPTIONS.map(usage => (
              <button
                key={usage}
                onClick={() => toggleUsage(usage)}
                className={`h-8 px-3.5 rounded-full text-[12px] border font-medium transition-colors ${
                  form.usageSelections.includes(usage)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-muted"
                }`}
              >
                {usage}
              </button>
            ))}
          </div>
        </Field>

        <Field label="어떤 계정이나 라이선스가 필요한가요?">
          <input
            className={inputCls}
            value={
              form.usageSelections.length === 0
                ? ""
                : requiredLicenses.length === 0
                ? "별도 라이선스 필요 없음"
                : requiredLicenses.join(", ")
            }
            placeholder="위에서 선택하면 자동으로 표시됩니다."
            readOnly
          />
          <p className="text-[11px] text-muted-foreground mt-1">위에서 선택한 항목을 바탕으로 자동으로 추론됩니다.</p>
        </Field>

        <Field label="별도 API 또는 서버 비용이 발생하나요?" required>
          <div className="flex gap-2">
            {(["yes", "no", "unknown"] as const).map(opt => (
              <button
                key={opt}
                onClick={() => patchForm({ hasCost: opt })}
                className={`h-8 px-4 rounded-full text-[12px] border font-medium transition-colors ${
                  form.hasCost === opt
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-muted"
                }`}
              >
                {opt === "yes" ? "예" : opt === "no" ? "아니오" : "잘 모르겠음"}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">정확한 금액은 입력하지 않아도 됩니다. 비용 발생 여부만 선택하세요.</p>
        </Field>
      </div>
    </SectionCard>
  );
}

// ─── Step 4: 자가진단 ─────────────────────────────────────────────────────────

function Step4({
  diag, setDiag, tooltipKey, setTooltipKey, originContent,
}: {
  diag: DiagState;
  setDiag: React.Dispatch<React.SetStateAction<DiagState>>;
  tooltipKey: string | null;
  setTooltipKey: (k: string | null) => void;
  originContent: string;
}) {
  return (
    <SectionCard title="자가진단">
      <p className="text-[12px] text-muted-foreground mb-5">
        아래 질문에 솔직하게 답해 주세요. 답변에 따라 심의 경로가 자동으로 결정됩니다.
      </p>
      <div className="flex flex-col gap-4">
        {DIAG_QUESTIONS.map(({ key, q, example, why }, i) => {
          const val = diag[key];
          const showTip = tooltipKey === key;
          const scanHints = getScanHints(key, originContent);
          return (
            <div key={key} className="border border-border rounded-md p-4">
              <div className="flex items-start justify-between gap-3 mb-1">
                <p className="text-[13px] font-medium text-foreground">{i + 1}. {q}</p>
                <button
                  onMouseEnter={() => setTooltipKey(key)}
                  onMouseLeave={() => setTooltipKey(null)}
                  className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors relative"
                >
                  <Info size={13} />
                  {showTip && (
                    <div className="absolute right-0 top-5 z-10 w-60 bg-foreground text-background text-[11px] leading-relaxed rounded-md px-3 py-2 shadow-lg">
                      {why}
                    </div>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">{example}</p>
              {scanHints.length > 0 && (
                <div className="mb-3 flex flex-col gap-1.5">
                  <span className="inline-flex items-center gap-1 self-start px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                    <Bot size={10} /> AI가 안내합니다
                  </span>
                  {scanHints.map(h => (
                    <p key={h} className="text-[11px] text-muted-foreground">
                      본문에서 <span className="font-medium text-foreground">'{h}'</span> 표현이 감지됐어요
                    </p>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                {(["yes", "no", "unknown"] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setDiag(prev => ({ ...prev, [key]: opt }))}
                    className={`h-7 px-4 rounded-full text-[11px] border font-medium transition-colors ${
                      val === opt
                        ? opt === "yes"    ? "bg-red-500 text-white border-red-500"
                          : opt === "no"  ? "bg-green-600 text-white border-green-600"
                          :                  "bg-muted text-foreground border-muted-foreground/30"
                        : "bg-card border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    {opt === "yes" ? "예" : opt === "no" ? "아니오" : "잘 모르겠음"}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ─── Step 5: 사전검사 결과 ────────────────────────────────────────────────────

const RESULT_CONFIG: Record<ReviewResult, { label: string; color: string; icon: React.ReactNode; desc: string }> = {
  AUTO_REGISTER:    { label: "자동 등록",  color: "text-green-700 bg-green-50 border-green-200",    icon: <CheckCircle2 size={18} />, desc: "별도 심의 없이 즉시 등록됩니다." },
  OPERATION_REVIEW: { label: "간편 심의",  color: "text-blue-700 bg-blue-50 border-blue-200",        icon: <Info size={18} />,          desc: "운영팀이 검토 후 등록 여부를 결정합니다." },
  DEEP_REVIEW:      { label: "정밀 심의",  color: "text-orange-700 bg-orange-50 border-orange-200",  icon: <AlertTriangle size={18} />, desc: "보안·거버넌스팀의 심층 심의가 진행됩니다." },
  AUTO_REJECT:      { label: "자동 반려",  color: "text-red-700 bg-red-50 border-red-200",            icon: <XCircle size={18} />,       desc: "현재 정책에 따라 등록이 불가합니다." },
};

function Step5({
  check, form, onSubmit,
}: {
  check: ReturnType<typeof runPreCheck>;
  form: FormData;
  onSubmit: () => void;
}) {
  const cfg = RESULT_CONFIG[check.result];
  return (
    <div className="flex flex-col gap-4">
      {/* 검사 진행 표시 */}
      <SectionCard title="자동 사전검사">
        <div className="flex flex-col gap-3">
          {[
            { label: "입력 정보 확인", done: true },
            { label: "자가진단 결과 분석", done: true },
            { label: "실행 환경 검토", done: true },
            { label: "심의 경로 결정", done: true },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2.5 text-[12px] text-foreground">
              <CheckCircle2 size={13} className="text-green-600 flex-shrink-0" />
              {item.label}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 결과 */}
      <div className={`flex items-start gap-4 p-5 rounded-md border ${cfg.color}`}>
        <div className="flex-shrink-0 mt-0.5">{cfg.icon}</div>
        <div>
          <p className="text-[15px] font-semibold">처리 경로: {cfg.label}</p>
          <p className="text-[12px] mt-1 opacity-80">{cfg.desc}</p>
        </div>
      </div>

      {/* 분류 사유 */}
      {check.reasons.length > 0 && (
        <SectionCard title="분류 사유">
          <ul className="flex flex-col gap-1.5">
            {check.reasons.map(r => (
              <li key={r} className="flex items-center gap-2 text-[12px] text-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* 추가 검토 */}
      {(check.costReview || check.operatorCheck) && (
        <SectionCard title="추가 검토">
          <div className="flex flex-col gap-2">
            {check.costReview && (
              <div className="flex items-center gap-2 text-[12px] text-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                비용 검토 필요 — 종량제 API 사용이 감지되었습니다.
              </div>
            )}
            {check.operatorCheck && (
              <div className="flex items-center gap-2 text-[12px] text-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                운영자 확인 필요 — 실행 환경이 불명확합니다.
              </div>
            )}
          </div>
        </SectionCard>
      )}

      <button
        onClick={onSubmit}
        className="w-full h-10 rounded bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors"
      >
        심의 신청하기
      </button>
      <p className="text-[11px] text-muted-foreground text-center">
        제출하면 자산이 심의 대기 상태로 접수되고 카탈로그에는 노출되지 않습니다.
      </p>
    </div>
  );
}

// ─── Diag summary panel ───────────────────────────────────────────────────────

// runPreCheck(=calculateReviewPath)를 그대로 재사용한다 — Step5 최종 결과와
// 계산 로직을 절대 갈라뜨리지 않기 위해서다. diag/form은 부모(AssetRegisterScreen)의
// state이므로 자가진단 버튼을 누르는 즉시 이 컴포넌트가 새 값으로 리렌더되어
// 예상 심의 경로가 실시간으로 바뀐다.
function DiagSummaryPanel({ diag, form }: { diag: DiagState; form: FormData }) {
  const check = runPreCheck(form, diag);
  const cfg = RESULT_CONFIG[check.result];

  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-[11px] font-semibold text-foreground">현재까지 감지된 검토 사항</p>
      </div>
      <div className="px-4 py-3">
        {check.reasons.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">아직 감지된 항목이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {check.reasons.map(r => (
              <li key={r} className="flex items-center gap-1.5 text-[11px] text-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        )}
        {(check.costReview || check.operatorCheck) && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {check.costReview && (
              <li className="flex items-center gap-1.5 text-[11px] text-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                비용 검토 필요
              </li>
            )}
            {check.operatorCheck && (
              <li className="flex items-center gap-1.5 text-[11px] text-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                운영자 확인 필요
              </li>
            )}
          </ul>
        )}
        <div className={`mt-3 flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-medium border ${cfg.color}`}>
          <Clock size={10} />
          예상: {cfg.label}
        </div>
      </div>
    </div>
  );
}

// ─── Demo file card ───────────────────────────────────────────────────────────

function DemoFileCard({ name, size, type, icon }: { name: string; size: string; type: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 p-3 border border-border rounded-md bg-muted/30 w-fit">
      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
        {icon ?? <Paperclip size={13} className="text-primary" />}
      </div>
      <div>
        <p className="text-[12px] font-medium text-foreground">{name}</p>
        <p className="text-[10px] text-muted-foreground">{type} · {size}</p>
      </div>
      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded ml-1">데모</span>
    </div>
  );
}

// ─── Submitted state ──────────────────────────────────────────────────────────

function SubmittedState({ onNavigate, assetName }: { onNavigate?: (menu: string) => void; assetName: string }) {
  return (
    <div className="px-10 py-8">
      <div className="max-w-[560px] mx-auto mt-16 flex flex-col items-center text-center gap-5">
        <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
          <CheckCircle2 size={28} className="text-green-600" />
        </div>
        <div>
          <h2 className="text-[18px] font-semibold text-foreground">등록 신청이 완료되었습니다</h2>
          <p className="text-[13px] text-muted-foreground mt-2">
            <strong>{assetName}</strong>이(가) 정밀 심의 대기 상태로 접수되었습니다.
            심의 완료 후 카탈로그에 공개됩니다.
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center justify-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-md text-[12px] text-orange-700">
            <AlertTriangle size={13} />
            처리 경로: 정밀 심의 · 비용 검토 필요
          </div>
        </div>
        <div className="flex gap-3 mt-2">
          {onNavigate && (
            <button
              onClick={() => onNavigate("my-assets")}
              className="h-9 px-5 rounded bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
            >
              내 자산 확인하기
            </button>
          )}
          {onNavigate && (
            <button
              onClick={() => onNavigate("asset-register")}
              className="h-9 px-5 rounded border border-border text-[13px] text-foreground hover:bg-muted transition-colors"
            >
              다른 자산 등록하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
