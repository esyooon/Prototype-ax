import { useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Info, Paperclip, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { useAssets } from "../context/AssetContext";
import type { AssetType } from "../data/types";

// ─── Types ───────────────────────────────────────────────────────────────────

type DiagAnswer = "yes" | "no" | "unknown" | null;
type ReviewResult = "AUTO_REGISTER" | "OPERATION_REVIEW" | "DEEP_REVIEW" | "AUTO_REJECT";

interface FormData {
  assetType: AssetType | null;
  name: string;
  description: string;
  useCases: string;
  limitations: string;
  visibility: string;
  // step 3 automation fields
  trigger: string;
  connectedServices: string;
  processingSteps: string;
  operations: string[];
  // step 3 other type fields (generic)
  genericContent: string;
  // step 5
  envSelections: string[];
  hasCost: DiagAnswer;
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
  "자산 유형", "기본 정보", "심의 기준본", "자가진단", "실행 환경", "사전검사"
];

const ASSET_TYPES: { type: AssetType; label: string; desc: string; badge: { bg: string; text: string } }[] = [
  { type: "PROMPT",     label: "프롬프트",              desc: "LLM에 전달할 지시 템플릿",                    badge: { bg: "bg-blue-50",    text: "text-blue-600"   } },
  { type: "ASSISTANT",  label: "맞춤형 AI",              desc: "특정 역할과 지식베이스를 가진 AI 어시스턴트", badge: { bg: "bg-violet-50",  text: "text-violet-600" } },
  { type: "AUTOMATION", label: "자동화",                 desc: "트리거 조건으로 실행되는 반복 워크플로우",    badge: { bg: "bg-orange-50",  text: "text-orange-600" } },
  { type: "APP",        label: "앱",                     desc: "AI 기능이 포함된 웹 앱 또는 API 서비스",      badge: { bg: "bg-emerald-50", text: "text-emerald-600"} },
  { type: "MCP",        label: "시스템 연결 도구(MCP)",  desc: "AI가 외부 시스템에 안전하게 접근하는 도구",   badge: { bg: "bg-cyan-50",    text: "text-cyan-600"   } },
  { type: "OTHER",      label: "기타",                   desc: "위 유형에 속하지 않는 AI 관련 자산",          badge: { bg: "bg-gray-100",   text: "text-gray-600"   } },
];

const VISIBILITY_OPTIONS = ["나만 사용", "소속 팀", "특정 부서", "파일럿 사용자", "전 임직원"];

const ENV_OPTIONS = [
  "Gemini Enterprise", "Claude Team", "GitHub Copilot",
  "Gemini API", "Claude API", "브라우저", "별도 서버",
  "AI 모델 미사용", "기타", "잘 모르겠음",
];

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

const DEMO_FORM: Partial<FormData> = {
  assetType: "AUTOMATION",
  name: "주간 업무보고 자동 취합",
  description: "팀원의 주간 업무를 모아 완료·진행·이슈로 정리하고 보고서 초안을 생성합니다.",
  useCases: "매주 금요일 팀원 주간보고를 자동으로 수집해 보고서 초안을 작성하고, 담당자가 검토 후 Google Docs에 반영합니다.",
  limitations: "",
  visibility: "파일럿 사용자",
  trigger: "매주 금요일 오후 5시 (예약 실행)",
  connectedServices: "Google Forms, Google Sheets, Google Docs, Gemini API",
  processingSteps: "1. 폼 응답 수집\n2. 주간 업무 분류\n3. 통합 문서 초안 생성\n4. 사용자 확인\n5. 문서 반영",
  operations: ["읽기", "문서 생성·수정"],
  envSelections: ["Google Apps Script", "Gemini API"],
  hasCost: "yes",
};

const DEMO_DIAG: DiagState = { q1: "no", q2: "yes", q3: "yes", q4: "yes", q5: "no", q6: "yes" };

// ─── Pre-check logic ─────────────────────────────────────────────────────────

function runPreCheck(
  form: FormData,
  diag: DiagState
): { result: ReviewResult; reasons: string[]; costReview: boolean; operatorCheck: boolean } {
  const reasons: string[] = [];
  let result: ReviewResult = "AUTO_REGISTER";

  if (diag.q1 === "yes") { reasons.push("개인정보 또는 중요 회사 정보 처리"); result = "DEEP_REVIEW"; }
  if (diag.q2 === "yes") { reasons.push("회사 밖 AI API 전송"); result = "DEEP_REVIEW"; }
  if (diag.q4 === "yes") { reasons.push("문서 생성·수정"); result = "DEEP_REVIEW"; }
  if (diag.q5 === "yes") { reasons.push("사용자 확인 없는 자동 실행"); result = "DEEP_REVIEW"; }
  if (diag.q6 === "yes") { reasons.push("예약 실행"); result = "DEEP_REVIEW"; }
  if (diag.q3 === "yes" && result === "AUTO_REGISTER") { reasons.push("사내 문서 읽기"); result = "OPERATION_REVIEW"; }
  else if (diag.q3 === "yes") { reasons.push("사내 문서 읽기"); }

  const costReview =
    form.envSelections.includes("Gemini API") ||
    form.envSelections.includes("Claude API") ||
    form.hasCost === "yes";

  const operatorCheck = form.envSelections.includes("잘 모르겠음");

  return { result, reasons, costReview, operatorCheck };
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

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-foreground">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
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
    visibility: "소속 팀", trigger: "", connectedServices: "", processingSteps: "",
    operations: [], genericContent: "", envSelections: [], hasCost: null,
  });
  const [diag, setDiag] = useState<DiagState>({ q1: null, q2: null, q3: null, q4: null, q5: null, q6: null });
  const [submitted, setSubmitted] = useState(false);
  const [tooltipKey, setTooltipKey] = useState<string | null>(null);

  function patchForm(patch: Partial<FormData>) { setForm(prev => ({ ...prev, ...patch })); }
  function fillDemo() { patchForm(DEMO_FORM as FormData); setDiag(DEMO_DIAG); }

  function canAdvance(): boolean {
    if (step === 1) return form.assetType !== null;
    if (step === 2) return form.name.trim().length > 0 && form.description.trim().length > 0 && form.visibility !== "";
    if (step === 3) {
      if (form.assetType === "AUTOMATION") return form.trigger.trim().length > 0 && form.connectedServices.trim().length > 0;
      return true;
    }
    if (step === 4) return Object.values(diag).every(v => v !== null);
    if (step === 5) return form.envSelections.length > 0 && form.hasCost !== null;
    return true;
  }

  function handleSubmit() {
    dispatch({ type: "UPDATE_STATUS", id: "asset-005", status: "REVIEW_PENDING" });
    dispatch({ type: "SET_CATALOG_VISIBILITY", id: "asset-005", showOnCatalog: false });
    setSubmitted(true);
    toast.success("등록 신청이 완료되었습니다.", { description: "정밀 심의 대기 상태로 접수되었습니다.", duration: 4000 });
  }

  const check = step === 6 ? runPreCheck(form, diag) : null;

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

      <div className="mt-6 flex gap-6 items-start max-w-[900px]">
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {step === 1 && <Step1 form={form} patchForm={patchForm} />}
          {step === 2 && <Step2 form={form} patchForm={patchForm} fillDemo={fillDemo} />}
          {step === 3 && <Step3 form={form} patchForm={patchForm} />}
          {step === 4 && <Step4 diag={diag} setDiag={setDiag} tooltipKey={tooltipKey} setTooltipKey={setTooltipKey} />}
          {step === 5 && <Step5 form={form} patchForm={patchForm} />}
          {step === 6 && check && <Step6 check={check} form={form} onSubmit={handleSubmit} />}

          {/* Navigation */}
          {step < 6 && (
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
          {step === 6 && (
            <div className="flex items-center justify-start pt-2">
              <button
                onClick={() => setStep(5)}
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
            <DiagSummaryPanel diag={diag} form={form} currentStep={step} />
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

// ─── Step 2: 기본 정보 ────────────────────────────────────────────────────────

function Step2({ form, patchForm, fillDemo }: { form: FormData; patchForm: (p: Partial<FormData>) => void; fillDemo: () => void }) {
  return (
    <>
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
          <Field label="어떤 업무를 해결하나요?" required>
            <textarea className={textareaCls} rows={3} value={form.description} onChange={e => patchForm({ description: e.target.value })} placeholder="이 자산이 어떤 문제를 해결하는지 간단히 설명해 주세요." />
          </Field>
          <Field label="사용 예시" hint="실제 사용 시나리오나 대표 사례를 입력하세요.">
            <textarea className={textareaCls} rows={3} value={form.useCases} onChange={e => patchForm({ useCases: e.target.value })} placeholder="예: 팀장이 금요일마다 팀원 보고를 수동으로 취합하는 시간을 줄이기 위해 사용합니다." />
          </Field>
          <Field label="알려진 한계" hint="기능 제한, 정확도 이슈, 주의 사항 등을 미리 공유해 주세요.">
            <textarea className={textareaCls} rows={2} value={form.limitations} onChange={e => patchForm({ limitations: e.target.value })} placeholder="예: 보고서 개수가 10개를 초과하면 오류가 발생할 수 있습니다." />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="초기 공개 범위">
        <div className="flex flex-wrap gap-2 mt-1">
          {VISIBILITY_OPTIONS.map(v => (
            <button
              key={v}
              onClick={() => patchForm({ visibility: v })}
              className={`h-8 px-3.5 rounded-full text-[12px] border font-medium transition-colors ${
                form.visibility === v
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

// ─── Step 3: 심의 기준본 ──────────────────────────────────────────────────────

function Step3({ form, patchForm }: { form: FormData; patchForm: (p: Partial<FormData>) => void }) {
  const toggleOp = (op: string) => {
    const ops = form.operations.includes(op)
      ? form.operations.filter(o => o !== op)
      : [...form.operations, op];
    patchForm({ operations: ops });
  };

  return (
    <>
      <div className="bg-muted/40 border border-border rounded-md px-4 py-3 text-[12px] text-muted-foreground">
        심의 기준본은 자산의 실제 내용이나 실행 구조를 확인하기 위한 자료입니다. API 키·비밀번호는 절대 입력하지 마세요.
        <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-medium"><AlertTriangle size={11} /> API 키·비밀번호 입력 금지</span>
      </div>

      {form.assetType === "AUTOMATION" && (
        <SectionCard title="자동화 기준본">
          <div className="flex flex-col gap-4">
            <Field label="실행 트리거" required>
              <input className={inputCls} value={form.trigger} onChange={e => patchForm({ trigger: e.target.value })} placeholder="예: 매주 금요일 오후 5시 (예약 실행)" />
            </Field>
            <Field label="연결 서비스" required hint="쉼표로 구분해 입력하세요.">
              <input className={inputCls} value={form.connectedServices} onChange={e => patchForm({ connectedServices: e.target.value })} placeholder="예: Google Forms, Google Sheets, Gemini API" />
            </Field>
            <Field label="처리 단계" hint="각 단계를 순서대로 입력하세요.">
              <textarea className={textareaCls} rows={5} value={form.processingSteps} onChange={e => patchForm({ processingSteps: e.target.value })} placeholder={"1. 폼 응답 수집\n2. 주간 업무 분류\n3. 통합 문서 초안 생성\n4. 사용자 확인\n5. 문서 반영"} />
            </Field>
            <Field label="읽기·생성·수정 동작">
              <div className="flex flex-wrap gap-2">
                {["읽기", "문서 생성·수정", "메일 발송", "일정 등록", "삭제"].map(op => (
                  <button key={op} onClick={() => toggleOp(op)}
                    className={`h-7 px-3 rounded-full text-[11px] border font-medium transition-colors ${
                      form.operations.includes(op)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:bg-muted"
                    }`}>{op}</button>
                ))}
              </div>
            </Field>
            <Field label="코드 또는 워크플로 첨부">
              <DemoFileCard name="weekly_report.gs" size="12 KB" type="Google Apps Script" />
            </Field>
          </div>
        </SectionCard>
      )}

      {form.assetType === "PROMPT" && (
        <SectionCard title="프롬프트 기준본">
          <div className="flex flex-col gap-4">
            <Field label="전체 원문" required>
              <textarea className={textareaCls} rows={6} placeholder="프롬프트 전체 내용을 입력하세요." />
            </Field>
            <Field label="입력 변수" hint="변수명과 설명을 입력하세요.">
              <textarea className={textareaCls} rows={3} placeholder="예: {{고객_문의}}: 고객이 보낸 문의 내용" />
            </Field>
            <Field label="출력 예시">
              <textarea className={textareaCls} rows={3} placeholder="예상 출력 예시를 입력하세요." />
            </Field>
          </div>
        </SectionCard>
      )}

      {form.assetType === "ASSISTANT" && (
        <SectionCard title="맞춤형 AI 기준본">
          <div className="flex flex-col gap-4">
            <Field label="시스템 지시문" required>
              <textarea className={textareaCls} rows={5} placeholder="AI에게 전달할 시스템 지시문을 입력하세요." />
            </Field>
            <Field label="연결 문서" hint="쉼표로 구분해 입력하세요.">
              <input className={inputCls} placeholder="예: 취업규칙, 복리후생 가이드" />
            </Field>
            <Field label="실행 링크">
              <input className={inputCls} placeholder="https://" />
            </Field>
          </div>
        </SectionCard>
      )}

      {form.assetType === "APP" && (
        <SectionCard title="앱 기준본">
          <div className="flex flex-col gap-4">
            <Field label="앱 유형" required>
              <div className="flex gap-3">
                {["브라우저 실행형", "백엔드 연동형"].map(t => (
                  <button key={t} className="h-8 px-4 rounded border border-border text-[12px] hover:bg-muted transition-colors">{t}</button>
                ))}
              </div>
            </Field>
            <Field label="실행 링크"><input className={inputCls} placeholder="https://" /></Field>
            <Field label="데이터 저장 여부"><input className={inputCls} placeholder="예: 사용자 입력 데이터를 DB에 저장" /></Field>
            <Field label="외부 통신"><input className={inputCls} placeholder="예: 외부 API 호출 여부와 대상" /></Field>
          </div>
        </SectionCard>
      )}

      {form.assetType === "MCP" && (
        <SectionCard title="MCP 기준본">
          <div className="flex flex-col gap-4">
            <Field label="연결 시스템" required><input className={inputCls} placeholder="예: Jira, GitHub, 사내 DB" /></Field>
            <Field label="제공 기능"><textarea className={textareaCls} rows={3} placeholder="예: 이슈 조회, PR 상태 확인" /></Field>
            <Field label="기능별 권한"><textarea className={textareaCls} rows={2} placeholder="예: 읽기 전용, 쓰기 포함" /></Field>
            <Field label="인증 방식"><input className={inputCls} placeholder="예: OAuth 2.0, API 토큰" /></Field>
          </div>
        </SectionCard>
      )}

      {form.assetType === "OTHER" && (
        <SectionCard title="기타 자산 기준본">
          <div className="flex flex-col gap-4">
            <Field label="실제 구성" required><textarea className={textareaCls} rows={4} placeholder="자산의 구성과 동작 방식을 설명하세요." /></Field>
            <Field label="사용 방법"><textarea className={textareaCls} rows={3} placeholder="이 자산을 사용하는 방법을 설명하세요." /></Field>
            <Field label="기존 유형에 포함되지 않는 이유"><textarea className={textareaCls} rows={2} placeholder="왜 기존 유형에 해당하지 않는지 설명해 주세요." /></Field>
          </div>
        </SectionCard>
      )}
    </>
  );
}

// ─── Step 4: 자가진단 ─────────────────────────────────────────────────────────

function Step4({
  diag, setDiag, tooltipKey, setTooltipKey,
}: {
  diag: DiagState;
  setDiag: React.Dispatch<React.SetStateAction<DiagState>>;
  tooltipKey: string | null;
  setTooltipKey: (k: string | null) => void;
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

// ─── Step 5: 실행 환경과 라이선스 ─────────────────────────────────────────────

function Step5({ form, patchForm }: { form: FormData; patchForm: (p: Partial<FormData>) => void }) {
  const toggleEnv = (env: string) => {
    const sel = form.envSelections.includes(env)
      ? form.envSelections.filter(e => e !== env)
      : [...form.envSelections, env];
    patchForm({ envSelections: sel });
  };

  return (
    <SectionCard title="실행 환경과 라이선스">
      <div className="flex flex-col gap-5">
        <Field label="이 자산은 어디에서 실행되나요?" required hint="해당하는 항목을 모두 선택하세요.">
          <div className="flex flex-wrap gap-2 mt-1">
            {ENV_OPTIONS.map(env => (
              <button
                key={env}
                onClick={() => toggleEnv(env)}
                className={`h-8 px-3.5 rounded-full text-[12px] border font-medium transition-colors ${
                  form.envSelections.includes(env)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-muted"
                }`}
              >
                {env}
              </button>
            ))}
          </div>
        </Field>

        <Field label="어떤 계정이나 라이선스가 필요한가요?">
          <input
            className={inputCls}
            placeholder="예: Google Workspace, Gemini API 프로젝트"
            value={form.envSelections.length > 0 ? form.envSelections.filter(e => !["브라우저", "별도 서버", "AI 모델 미사용", "기타", "잘 모르겠음"].includes(e)).join(", ") : ""}
            readOnly
          />
          <p className="text-[11px] text-muted-foreground mt-1">위에서 선택한 항목이 자동으로 표시됩니다.</p>
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

// ─── Step 6: 사전검사 결과 ────────────────────────────────────────────────────

const RESULT_CONFIG: Record<ReviewResult, { label: string; color: string; icon: React.ReactNode; desc: string }> = {
  AUTO_REGISTER:    { label: "자동 등록",  color: "text-green-700 bg-green-50 border-green-200",    icon: <CheckCircle2 size={18} />, desc: "별도 심의 없이 즉시 등록됩니다." },
  OPERATION_REVIEW: { label: "운영 심의",  color: "text-blue-700 bg-blue-50 border-blue-200",        icon: <Info size={18} />,          desc: "운영팀이 검토 후 등록 여부를 결정합니다." },
  DEEP_REVIEW:      { label: "정밀 심의",  color: "text-orange-700 bg-orange-50 border-orange-200",  icon: <AlertTriangle size={18} />, desc: "보안·거버넌스팀의 심층 심의가 진행됩니다." },
  AUTO_REJECT:      { label: "자동 반려",  color: "text-red-700 bg-red-50 border-red-200",            icon: <XCircle size={18} />,       desc: "현재 정책에 따라 등록이 불가합니다." },
};

function Step6({
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

function DiagSummaryPanel({ diag, form, currentStep }: { diag: DiagState; form: FormData; currentStep: number }) {
  const flags: string[] = [];
  if (diag.q1 === "yes") flags.push("개인정보 처리");
  if (diag.q2 === "yes") flags.push("외부 AI 전송");
  if (diag.q3 === "yes") flags.push("사내 문서 읽기");
  if (diag.q4 === "yes") flags.push("문서 수정/메일");
  if (diag.q5 === "yes") flags.push("자동 실행");
  if (diag.q6 === "yes") flags.push("반복 실행");
  if (currentStep >= 5 && form.envSelections.includes("잘 모르겠음")) flags.push("환경 미확인");

  const deepFlags = flags.filter(f => f !== "사내 문서 읽기" && f !== "환경 미확인");

  const previewResult: ReviewResult =
    deepFlags.length > 0 ? "DEEP_REVIEW"
    : flags.includes("사내 문서 읽기") ? "OPERATION_REVIEW"
    : "AUTO_REGISTER";

  const cfg = RESULT_CONFIG[previewResult];

  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-[11px] font-semibold text-foreground">현재까지 감지된 검토 사항</p>
      </div>
      <div className="px-4 py-3">
        {flags.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">아직 감지된 항목이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {flags.map(f => (
              <li key={f} className="flex items-center gap-1.5 text-[11px] text-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        )}
        {flags.length > 0 && (
          <div className={`mt-3 flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-medium border ${cfg.color}`}>
            <Clock size={10} />
            예상: {cfg.label}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Demo file card ───────────────────────────────────────────────────────────

function DemoFileCard({ name, size, type }: { name: string; size: string; type: string }) {
  return (
    <div className="flex items-center gap-3 p-3 border border-border rounded-md bg-muted/30 w-fit">
      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Paperclip size={13} className="text-primary" />
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
