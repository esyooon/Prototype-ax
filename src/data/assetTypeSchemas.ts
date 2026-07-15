import type { AssetType, ReviewPath } from "./types";

// ─── 유형별 등록 항목 스키마 ──────────────────────────────────────────────────
// 자산 등록 화면(AssetRegisterScreen)의 유형별 "심의 기준본" 입력 폼을 데이터로
// 뽑아낸 것 — 이번 단계(B1)는 이 데이터 정의만 한다. 실제 렌더링은 B2, 값을
// calculateReviewPath 결과와 합산해 심의 경로를 계산하는 건 B3에서 한다.
//
// 이 스키마는 두 소비처를 염두에 두고 설계했다:
//   - B2(자동 렌더): assetType으로 스키마를 찾아 fields를 순회하며 inputType에
//     맞는 입력 요소를 그린다. options/placeholder/required가 그대로 폼 UI가 된다.
//   - B3(위험 합산): 각 필드의 현재 입력값을 risk 신호와 대조해서 트리거 여부를
//     판정하고, 트리거된 필드 중 가장 높은 tier를 RISK_TIER_TO_REVIEW_PATH로
//     변환해 calculateReviewPath와 같은 어휘(간편/정밀)로 합류시킨다.

// ─── 입력 타입 ─────────────────────────────────────────────────────────────

export type FieldInputType =
  | "text"
  | "textarea"
  | "url"
  | "select"
  | "multiselect"
  | "radio"
  | "checkbox"
  | "file";

// ─── 위험 신호 ─────────────────────────────────────────────────────────────
// none: 위험 아님.
// always: 이 필드가 채워지면(필수 텍스트류) / 체크되면(checkbox) 무조건 위험.
// conditional: 특정 값일 때만 위험 — condition에 사람이 읽을 조건을,
//   triggerValues에 실제로 위험을 발동시키는 값(들)을 명시한다.
// reject: "위험"이 아니라 "자격 미달" — 심의 강도(간편/정밀)를 매기는 대상이
//   아니라 애초에 등록 자격이 없는 조합이다. 이 신호가 걸리면 위험도 계산
//   자체를 건너뛰고 즉시 자동 반려(AUTO_REJECT)로 간다(reviewPolicy.ts 참고).
//   reason은 왜 반려됐는지, guidance는 어떻게 고치면 재등록할 수 있는지를
//   등록자가 그대로 읽을 수 있는 문장으로 담는다 — 반려는 막다른 골목이
//   아니라 항상 "고치는 법"을 동반해야 한다는 원칙 때문이다.
//
// tier는 심의 강도다. calculateReviewPath의 ReviewPath와 맞춰뒀다:
//   "간편" = OPERATION_REVIEW(간편 심의) — 예: 사내 데이터 읽기
//   "정밀" = DEEP_REVIEW(정밀 심의)     — 예: 되돌릴 수 없는 변경·자율 실행
export type RiskTier = "간편" | "정밀";

export const RISK_TIER_TO_REVIEW_PATH: Record<RiskTier, ReviewPath> = {
  간편: "OPERATION_REVIEW",
  정밀: "DEEP_REVIEW",
};

export type RiskSignal =
  | { type: "none" }
  | { type: "always"; tier: RiskTier; condition: string; triggerValues?: undefined }
  | { type: "conditional"; tier: RiskTier; condition: string; triggerValues: (string | boolean)[] }
  | { type: "reject"; condition: string; triggerValues: (string | boolean)[]; reason: string; guidance: string };

// ─── 필드 / 스키마 ──────────────────────────────────────────────────────────

export interface FieldOption {
  value: string;
  label: string;
}

export interface AssetTypeField {
  key: string;
  label: string;
  inputType: FieldInputType;
  required: boolean;
  risk: RiskSignal;
  options?: FieldOption[]; // select / multiselect / radio 전용
  placeholder?: string;
  hint?: string; // 필드 아래에 보조 설명으로 표시
  groupLabel?: string; // 이 필드 위에 그룹 제목으로 표시 (연속된 체크박스 묶음의 첫 필드에 지정)
  groupNote?: string; // 이 필드 아래에 그룹 전체 안내문으로 표시 (묶음의 마지막 필드에 지정)
}

export interface AssetTypeSchema {
  assetType: AssetType;
  subtypeLabel?: string; // 예: ASSISTANT의 "링크형 어시스턴트"
  fields: AssetTypeField[];
}

// ─── B3용 판정 헬퍼 ─────────────────────────────────────────────────────────
// 필드 하나의 현재 값이 그 필드의 risk 신호를 발동시키는지만 판정한다.
// 여러 필드를 합산해 최종 tier를 고르는 로직 자체는 B3의 몫이다.
export function isFieldRiskTriggered(field: AssetTypeField, value: unknown): boolean {
  if (field.risk.type === "none") return false;

  if (field.risk.type === "always") {
    if (field.inputType === "checkbox") return value === true;
    if (Array.isArray(value)) return value.length > 0;
    return typeof value === "string" ? value.trim().length > 0 : value != null;
  }

  // conditional / reject — 둘 다 triggerValues 매칭 방식은 동일하다.
  if (Array.isArray(value)) {
    return value.some((v) =>
      (field.risk.type === "conditional" || field.risk.type === "reject") && field.risk.triggerValues.includes(v as string)
    );
  }
  return (
    (field.risk.type === "conditional" || field.risk.type === "reject") &&
    field.risk.triggerValues.includes(value as string | boolean)
  );
}

// ─── 프롬프트 ───────────────────────────────────────────────────────────────

const PROMPT_SCHEMA: AssetTypeSchema = {
  assetType: "PROMPT",
  fields: [
    {
      key: "promptText",
      label: "프롬프트 원문",
      inputType: "textarea",
      required: true,
      risk: { type: "none" },
      placeholder: "프롬프트 전체 내용을 입력하세요.",
    },
    {
      key: "verifiedModel",
      label: "검증한 모델",
      inputType: "select",
      required: false,
      risk: { type: "none" },
      options: [
        { value: "GEMINI", label: "Gemini" },
        { value: "CLAUDE", label: "Claude" },
        { value: "COPILOT", label: "Copilot" },
      ],
    },
    {
      key: "variablePlaceholder",
      label: "변수 자리 표시",
      inputType: "text",
      required: false,
      risk: { type: "none" },
      placeholder: "예: {{고객_문의}}",
    },
  ],
};

// ─── 링크형 어시스턴트 ──────────────────────────────────────────────────────

const ASSISTANT_SCHEMA: AssetTypeSchema = {
  assetType: "ASSISTANT",
  subtypeLabel: "링크형 어시스턴트",
  fields: [
    {
      key: "accessLink",
      label: "접속 링크",
      inputType: "url",
      required: true,
      risk: { type: "none" },
      placeholder: "https://",
    },
    {
      key: "platform",
      label: "실행 플랫폼",
      inputType: "select",
      required: false,
      risk: { type: "none" },
      options: [
        { value: "GEMINI_GEM", label: "Gemini Gem" },
        { value: "NOTEBOOKLM", label: "NotebookLM" },
        { value: "OTHER", label: "기타" },
      ],
    },
    {
      key: "hasConnectedSource",
      label: "연결 소스 문서 유무",
      inputType: "radio",
      required: false,
      options: [
        { value: "YES", label: "예" },
        { value: "NO", label: "아니오" },
      ],
      // 연결 문서를 "읽는" 행위는 사내 데이터 읽기와 성격이 같아 간편 심의 강도로 분류.
      risk: { type: "conditional", tier: "간편", condition: "연결 소스 문서 유무 = 예", triggerValues: ["YES"] },
    },
    {
      key: "instructions",
      label: "지시문",
      inputType: "textarea",
      required: false,
      risk: { type: "none" },
      placeholder: "AI에게 전달할 지시문을 입력하세요.",
    },
  ],
};

// ─── 자동화 ─────────────────────────────────────────────────────────────────

const AUTOMATION_SCHEMA: AssetTypeSchema = {
  assetType: "AUTOMATION",
  fields: [
    {
      key: "touchedServices",
      label: "대상 서비스",
      inputType: "multiselect",
      required: false,
      risk: { type: "none" },
      options: [
        { value: "GOOGLE_WORKSPACE", label: "Google Workspace" },
        { value: "SLACK", label: "Slack" },
        { value: "INTERNAL_SYSTEM", label: "사내 시스템" },
        { value: "OTHER", label: "기타" },
      ],
    },
    {
      key: "doesRead",
      label: "문서·데이터 조회",
      inputType: "checkbox",
      required: false,
      groupLabel: "수행 동작",
      // 조회는 사내 데이터 읽기와 성격이 같아 간편 심의 강도로 분류.
      risk: { type: "always", tier: "간편", condition: "체크 시 간편 심의 — 사내 문서·데이터 읽기" },
    },
    {
      key: "doesSend",
      label: "메일·메시지 발송",
      inputType: "checkbox",
      required: false,
      risk: { type: "always", tier: "정밀", condition: "체크 시 항상 위험 — 되돌릴 수 없는 발송 동작" },
    },
    {
      key: "doesModify",
      label: "문서·데이터 수정",
      inputType: "checkbox",
      required: false,
      risk: { type: "always", tier: "정밀", condition: "체크 시 항상 위험 — 되돌릴 수 없는 변경 동작" },
    },
    {
      key: "doesDelete",
      label: "문서·데이터 삭제",
      inputType: "checkbox",
      required: false,
      risk: { type: "always", tier: "정밀", condition: "체크 시 항상 위험 — 되돌릴 수 없는 삭제 동작" },
      groupNote: "조회만 하는 경우 간편 심의, 발송·수정·삭제 동작이 있는 경우 정밀 심의 대상으로 분류될 수 있습니다.",
    },
    {
      key: "executionMode",
      label: "실행 방식",
      inputType: "select",
      required: false,
      options: [
        { value: "MANUAL", label: "수동" },
        { value: "SCHEDULED", label: "예약" },
        { value: "TRIGGERED", label: "트리거" },
      ],
      // 자율 실행(예약·트리거)은 사람 확인 없이 진행되므로 정밀 심의.
      risk: { type: "conditional", tier: "정밀", condition: "실행 방식 = 예약 또는 트리거", triggerValues: ["SCHEDULED", "TRIGGERED"] },
    },
    {
      key: "filePayload",
      label: "파일 본체",
      inputType: "file",
      required: false,
      risk: { type: "none" },
    },
    {
      key: "installGuide",
      label: "설치법",
      inputType: "textarea",
      required: false,
      risk: { type: "none" },
      placeholder: "설치·설정 방법을 입력하세요.",
    },
  ],
};

// ─── 앱 ─────────────────────────────────────────────────────────────────────

const APP_SCHEMA: AssetTypeSchema = {
  assetType: "APP",
  fields: [
    {
      key: "hostingLocation",
      label: "호스팅 위치",
      inputType: "select",
      required: false,
      risk: { type: "none" },
      options: [
        { value: "BROWSER", label: "브라우저(클라이언트)" },
        { value: "INTERNAL_SERVER", label: "사내 서버" },
        { value: "EXTERNAL_CLOUD", label: "외부 클라우드" },
      ],
    },
    {
      key: "storesInputData",
      label: "입력 데이터 저장 여부",
      inputType: "radio",
      required: false,
      options: [
        { value: "YES", label: "예" },
        { value: "NO", label: "아니오" },
      ],
      risk: { type: "conditional", tier: "정밀", condition: "입력 데이터 저장 여부 = 예", triggerValues: ["YES"] },
    },
    {
      key: "externalNetworkRequest",
      label: "외부 네트워크 요청",
      inputType: "radio",
      required: false,
      options: [
        { value: "YES", label: "예" },
        { value: "NO", label: "아니오" },
      ],
      risk: { type: "conditional", tier: "정밀", condition: "외부 네트워크 요청 = 예", triggerValues: ["YES"] },
    },
    {
      key: "htmlFile",
      label: "HTML 파일",
      inputType: "file",
      required: false,
      risk: { type: "none" },
    },
    {
      key: "builderTool",
      label: "제작 도구",
      inputType: "text",
      required: false,
      risk: { type: "none" },
      placeholder: "예: React, Google Apps Script",
    },
  ],
};

// ─── MCP 커넥터 ─────────────────────────────────────────────────────────────

const MCP_SCHEMA: AssetTypeSchema = {
  assetType: "MCP",
  fields: [
    {
      key: "connectedSystem",
      label: "연결 대상 시스템",
      inputType: "text",
      required: true,
      risk: { type: "none" },
      placeholder: "예: Jira, GitHub, 사내 DB",
    },
    {
      key: "connectionInfo",
      label: "연결 정보 (서버 주소 또는 설정 파일)",
      inputType: "textarea",
      required: true,
      // 공유용 실물 정보 — 다른 직원이 그대로 가져다 쓰는 값이라 그 자체는 위험 신호가 아니다.
      risk: { type: "none" },
      placeholder: "예: https://mcp.internal.daou.co.kr/jira 또는 .mcp.json 내용 붙여넣기",
      hint: "다른 직원이 이 정보로 자신의 AI 클라이언트에 연결합니다.",
    },
    {
      key: "permissionScopeReason",
      label: "권한 범위와 사유",
      inputType: "textarea",
      required: true,
      // 외부 시스템에 대한 권한 부여 자체가 위험이므로, 값이 채워지는 순간 항상 위험.
      risk: { type: "always", tier: "정밀", condition: "필수 항목 — 작성되면 항상 위험(외부 시스템 권한 부여)" },
      placeholder: "예: 이슈 조회 및 상태 변경 권한 — PR 리뷰 자동화를 위해 필요",
    },
    {
      key: "authMethod",
      label: "인증 방식",
      inputType: "select",
      required: false,
      options: [
        { value: "OAUTH", label: "OAuth" },
        { value: "PRIVATE_KEY", label: "개인키" },
        { value: "OTHER", label: "기타" },
      ],
      // 자격 축: 개인키는 "위험도가 높은 인증"이 아니라 "허용되지 않는 인증"이다.
      // 규정이 이미 판단을 끝냈으므로 정밀 심의가 아니라 자동 반려로 간다.
      risk: {
        type: "reject",
        condition: "인증 방식 = 개인키",
        triggerValues: ["PRIVATE_KEY"],
        reason: "개인 키 인증은 사내 보안 가이드 6.4에 따라 등록할 수 없습니다.",
        guidance: "OAuth 등 승인된 인증 방식으로 변경하면 다시 등록할 수 있습니다.",
      },
    },
    {
      key: "prerequisitePermissions",
      label: "필요 사전 권한",
      inputType: "textarea",
      required: false,
      risk: { type: "none" },
      placeholder: "이 커넥터를 쓰기 전에 필요한 권한을 입력하세요.",
    },
  ],
};

// ─── 기타 ───────────────────────────────────────────────────────────────────

const OTHER_SCHEMA: AssetTypeSchema = {
  assetType: "OTHER",
  fields: [
    {
      key: "whyNotFit",
      label: "기존 유형에 왜 안 맞는지",
      inputType: "textarea",
      required: true,
      risk: { type: "none" },
      placeholder: "왜 기존 유형에 해당하지 않는지 설명해 주세요.",
    },
  ],
};

// ─── 전체 ───────────────────────────────────────────────────────────────────

export const ASSET_TYPE_FIELD_SCHEMAS: Record<AssetType, AssetTypeSchema> = {
  PROMPT: PROMPT_SCHEMA,
  ASSISTANT: ASSISTANT_SCHEMA,
  AUTOMATION: AUTOMATION_SCHEMA,
  APP: APP_SCHEMA,
  MCP: MCP_SCHEMA,
  OTHER: OTHER_SCHEMA,
};
