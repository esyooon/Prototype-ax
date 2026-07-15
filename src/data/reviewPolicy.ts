import type { AIAsset, AssetType, DiagQuestionAnswer, ReviewPath, SelfDiagnosisAnswers } from "./types";
import { maxReviewPath } from "./types";
import { ASSET_TYPE_FIELD_SCHEMAS, isFieldRiskTriggered, RISK_TIER_TO_REVIEW_PATH } from "./assetTypeSchemas";
import type { AssetTypeField } from "./assetTypeSchemas";

// ─── 심의 경로 계산 (공용) ───────────────────────────────────────────────────
// 등록 시 자동 사전검사(AssetRegisterScreen)와 운영자의 경로 재계산
// (GovernanceScreen) 두 곳에서 동일하게 사용한다. 기준이 갈라지면 등록자에게
// 안내된 결과와 운영자가 실제로 보는 결과가 달라질 수 있어 반드시 이 함수
// 하나로 공용화한다. 위험도 = 위험 동작(q1·q2·q4·q5·q6) − 브레이크(비용/환경
// 확인 여부)로 계산한다.

export interface ReviewCalcResult {
  result: ReviewPath;
  reasons: string[];
  costReview: boolean;
  operatorCheck: boolean;
}

export interface ReviewCalcContext {
  envSelections?: string[];
  hasCost?: DiagQuestionAnswer | null;
}

export function calculateReviewPath(
  diag: SelfDiagnosisAnswers,
  ctx: ReviewCalcContext = {}
): ReviewCalcResult {
  const reasons: string[] = [];
  let result: ReviewPath = "AUTO_REGISTER";

  if (diag.q1 === "yes") { reasons.push("개인정보 또는 중요 회사 정보 처리"); result = "DEEP_REVIEW"; }
  if (diag.q2 === "yes") { reasons.push("회사 밖 AI API 전송"); result = "DEEP_REVIEW"; }
  if (diag.q4 === "yes") { reasons.push("문서 생성·수정"); result = "DEEP_REVIEW"; }
  if (diag.q5 === "yes") { reasons.push("사용자 확인 없는 자동 실행"); result = "DEEP_REVIEW"; }
  if (diag.q6 === "yes") { reasons.push("예약 실행"); result = "DEEP_REVIEW"; }
  if (diag.q3 === "yes" && result === "AUTO_REGISTER") { reasons.push("사내 문서 읽기"); result = "OPERATION_REVIEW"; }
  else if (diag.q3 === "yes") { reasons.push("사내 문서 읽기"); }

  // "이 자산이 무엇을 사용하나요?" 통합 선택지 기준 — 유료 AI/개발 도구를
  // 선택하면 비용 검토, "기타"(용도 불명확)를 선택하면 운영자 확인 대상.
  const costReview =
    (ctx.envSelections?.includes("Gemini Enterprise") ?? false) ||
    (ctx.envSelections?.includes("Claude") ?? false) ||
    (ctx.envSelections?.includes("GitHub Copilot") ?? false) ||
    ctx.hasCost === "yes";

  const operatorCheck = ctx.envSelections?.includes("기타") ?? false;

  return { result, reasons, costReview, operatorCheck };
}

// ─── 실제 데이터 → 자가진단 6문항 환산 ───────────────────────────────────────
// 등록자의 자가진단 응답과 별개로, 자산의 실제 데이터(dataHandling/permissionLevel
// 등)를 기준으로 같은 6문항 답을 산출한다. 운영자가 "실제 데이터 기준으로
// 다시 계산하면 결과가 달라지는가"를 확인할 때 사용한다.
export function inferDiagnosisFromAsset(asset: AIAsset): SelfDiagnosisAnswers {
  return {
    q1: asset.dataHandling.sensitivity.includes("개인정보") ? "yes" : "no",
    q2: asset.dataHandling.externalTransfer ? "yes" : "no",
    q3: asset.permissionLevel.some((p) => p.includes("읽기")) ? "yes" : "no",
    q4: asset.permissionLevel.some((p) => /수정|생성|발송|등록|삭제/.test(p)) ? "yes" : "no",
    q5: asset.humanConfirmationRequired ? "no" : "yes",
    q6: asset.scheduledExecution ? "yes" : "no",
  };
}

export const DIAG_QUESTION_TEXT: Record<keyof SelfDiagnosisAnswers, string> = {
  q1: "개인정보나 중요한 회사 정보를 다루나요?",
  q2: "회사 밖의 AI나 서비스로 데이터를 보내나요?",
  q3: "회사 시스템이나 문서를 계정 권한으로 읽나요?",
  q4: "메일 발송, 문서 수정, 삭제, 일정 등록 같은 동작을 하나요?",
  q5: "사람이 확인하지 않아도 다음 단계까지 자동으로 실행되나요?",
  q6: "정해진 시간이나 조건에 따라 반복 실행되나요?",
};

export const DIAG_QUESTION_ORDER = Object.keys(DIAG_QUESTION_TEXT) as (keyof SelfDiagnosisAnswers)[];

// ─── 유형별 등록 필드 위험 합산 (B3) ─────────────────────────────────────────
// B1(assetTypeSchemas)의 risk 신호 + isFieldRiskTriggered로 현재 입력값이 위험을
// 발동시키는 필드를 모두 걷어, 그중 가장 높은 tier를 이 유형 자체의 심의 경로로
// 삼는다. 자가진단(calculateReviewPath)과는 완전히 다른 입력(유형별 필드 값)에서
// 계산되므로 별도 함수로 두고, 호출부(AssetRegisterScreen의 runPreCheck)가 두
// 결과를 maxReviewPath로 합산한다 — 자가진단이 낮게 나와도 유형별 필드에서 더
// 높은 위험이 발동되면 항상 그쪽이 최종 결과를 덮어쓴다(반대는 안 됨).

// 반려 사유 3종 세트 — 등록자 보호 원칙: 반려는 막다른 골목이 아니므로 "왜"와
// "어떻게 고치나"를 항상 함께 준다. resubmittable은 항상 true로 둔다(이 게이트는
// 영구 차단이 아니라 조건을 바꾸면 풀리는 자격 판정이라서다).
export interface RejectInfo {
  reason: string;
  guidance: string;
  resubmittable: true;
}

export interface TypeFieldRiskResult {
  result: ReviewPath;
  reasons: string[];
  reject?: RejectInfo;
}

function describeTriggeredValue(field: AssetTypeField, value: unknown): string {
  if (field.risk.type !== "conditional" && field.risk.type !== "reject") return "";
  const { triggerValues } = field.risk;
  const values = Array.isArray(value) ? value : [value];
  const labels: string[] = [];
  for (const v of values) {
    if (!triggerValues.includes(v as string | boolean)) continue;
    labels.push(field.options?.find((o) => o.value === v)?.label ?? String(v));
  }
  return labels.join(", ");
}

// 필드 하나의 위험 사유 문구를 만든다("필드명: 값 → 정밀 심의" / "필드명 → 정밀
// 심의"). 등록 화면(runPreCheck)과 심의 화면(자산 원문 블록)이 같은 문구를 쓰도록
// 공용화한다 — 같은 스키마, 다른 화면이라도 사유 표현은 갈라지면 안 된다.
export function describeFieldRisk(field: AssetTypeField, value: unknown): string {
  if (field.risk.type === "none") return field.label;
  if (field.risk.type === "reject") return `${field.label}: ${describeTriggeredValue(field, value)} → 자동 반려`;
  const tierLabel = field.risk.tier === "정밀" ? "정밀 심의" : "간편 심의";
  return field.risk.type === "conditional"
    ? `${field.label}: ${describeTriggeredValue(field, value)} → ${tierLabel}`
    : `${field.label} → ${tierLabel}`;
}

export function calculateTypeFieldRisk(
  assetType: AssetType,
  typeFields: Record<string, unknown>
): TypeFieldRiskResult {
  const schema = ASSET_TYPE_FIELD_SCHEMAS[assetType];

  // 자격 축 게이트 — 위험도(간편/정밀) 계산보다 먼저 본다. 하나라도 걸리면
  // 위험 합산 없이 즉시 자동 반려로 끝낸다(규정이 이미 판단을 끝낸 영역이라
  // "더 위험한 다른 필드가 있으니 정밀로 낮춘다" 같은 타협이 있을 수 없다).
  for (const field of schema.fields) {
    if (field.risk.type !== "reject") continue;
    if (!isFieldRiskTriggered(field, typeFields[field.key])) continue;

    return {
      result: "AUTO_REJECT",
      reasons: [field.risk.reason],
      reject: { reason: field.risk.reason, guidance: field.risk.guidance, resubmittable: true },
    };
  }

  // 위험 축 — 자격 미달이 아닌 나머지 필드만 간편/정밀로 합산한다.
  let result: ReviewPath = "AUTO_REGISTER";
  const reasons: string[] = [];

  for (const field of schema.fields) {
    if (field.risk.type === "none" || field.risk.type === "reject") continue;
    if (!isFieldRiskTriggered(field, typeFields[field.key])) continue;

    reasons.push(describeFieldRisk(field, typeFields[field.key]));
    result = maxReviewPath(result, RISK_TIER_TO_REVIEW_PATH[field.risk.tier]);
  }

  return { result, reasons };
}
