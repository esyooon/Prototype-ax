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

export interface TypeFieldRiskResult {
  result: ReviewPath;
  reasons: string[];
}

function describeTriggeredValue(field: AssetTypeField, value: unknown): string {
  if (field.risk.type !== "conditional") return "";
  const { triggerValues } = field.risk;
  const values = Array.isArray(value) ? value : [value];
  const labels: string[] = [];
  for (const v of values) {
    if (!triggerValues.includes(v as string | boolean)) continue;
    labels.push(field.options?.find((o) => o.value === v)?.label ?? String(v));
  }
  return labels.join(", ");
}

export function calculateTypeFieldRisk(
  assetType: AssetType,
  typeFields: Record<string, unknown>
): TypeFieldRiskResult {
  const schema = ASSET_TYPE_FIELD_SCHEMAS[assetType];
  let result: ReviewPath = "AUTO_REGISTER";
  const reasons: string[] = [];

  for (const field of schema.fields) {
    if (field.risk.type === "none") continue;
    if (!isFieldRiskTriggered(field, typeFields[field.key])) continue;

    const tier = field.risk.tier;
    const tierLabel = tier === "정밀" ? "정밀 심의" : "간편 심의";
    reasons.push(
      field.risk.type === "conditional"
        ? `${field.label}: ${describeTriggeredValue(field, typeFields[field.key])} → ${tierLabel}`
        : `${field.label} → ${tierLabel}`
    );
    result = maxReviewPath(result, RISK_TIER_TO_REVIEW_PATH[tier]);
  }

  return { result, reasons };
}
