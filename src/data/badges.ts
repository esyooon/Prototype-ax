import type { AIAsset } from "./types";

// ─── 신뢰 배지 3종 체계 ──────────────────────────────────────────────────────
// 심의(REVIEWED)  — 게시된 모든 자산에 기본으로 붙는 안전 표시
// 검증(VERIFIED)  — 많은 동료가 실제로 쓰는 자산에 붙는 품질 표시 (일부 자산)
// 공식(OFFICIAL)  — AX기획팀이 만든 예시 자산 전용
//
// 검증과 공식은 asset.trustTier(단일 값)에서 나오므로 한 자산에 동시에 붙을 수
// 없다. 심의는 게시 상태에서 파생되며, 검증/공식은 심의 옆에 추가로 붙는다.

export type TrustBadgeKind = "REVIEWED" | "VERIFIED" | "OFFICIAL";

export interface TrustBadgeMeta {
  kind: TrustBadgeKind;
  label: string;    // 배지에 표시되는 짧은 텍스트
  fullName: string; // 가이드에 표시되는 풀네임
  meaning: string;  // 가이드 설명
  cls: string;      // Tailwind 색상 클래스
}

export const TRUST_BADGE_META: Record<TrustBadgeKind, TrustBadgeMeta> = {
  REVIEWED: {
    kind: "REVIEWED",
    label: "심의",
    fullName: "심의 통과",
    meaning: "운영자가 안전을 확인한 자산입니다",
    cls: "bg-green-50 text-green-700 border-green-200",
  },
  VERIFIED: {
    kind: "VERIFIED",
    label: "검증",
    fullName: "활용 검증",
    meaning: "많은 동료가 실제로 쓰고 있는 자산입니다",
    cls: "bg-blue-50 text-blue-700 border-blue-200",
  },
  OFFICIAL: {
    kind: "OFFICIAL",
    label: "공식",
    fullName: "공식 예시",
    meaning: "AX기획팀이 제작한 예시 자산입니다",
    cls: "bg-primary/10 text-primary border-primary/30",
  },
};

// 가이드에서 3종을 순서대로 나열할 때 사용
export const TRUST_BADGE_ORDER: TrustBadgeKind[] = ["REVIEWED", "VERIFIED", "OFFICIAL"];

export function isPublished(asset: AIAsset): boolean {
  return asset.status === "PUBLISHED" || asset.status === "CONDITIONAL_APPROVAL";
}

// 자산에 붙는 신뢰 배지 목록. 심의가 항상 먼저, 그다음 검증 또는 공식(둘 중 하나).
export function getTrustBadges(asset: AIAsset): TrustBadgeKind[] {
  const badges: TrustBadgeKind[] = [];
  if (isPublished(asset)) badges.push("REVIEWED");
  if (asset.trustTier === "VERIFIED") badges.push("VERIFIED");
  else if (asset.trustTier === "OFFICIAL") badges.push("OFFICIAL");
  return badges;
}
