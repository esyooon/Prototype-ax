import type { AIAsset, AssetStatus } from "./types";

// ─── 카탈로그 조회 (일반 사용자용) ──────────────────────────────────────────
// showOnCatalog === true && (PUBLISHED or CONDITIONAL_APPROVAL)
export function getCatalogAssets(assets: AIAsset[]): AIAsset[] {
  return assets.filter(
    (a) =>
      a.showOnCatalog &&
      (a.status === "PUBLISHED" || a.status === "CONDITIONAL_APPROVAL")
  );
}

// ─── 대표 자산 (isFeatured + 카탈로그 노출 조건 동시 만족) ──────────────────
export function getFeaturedAssets(assets: AIAsset[]): AIAsset[] {
  return getCatalogAssets(assets).filter((a) => a.isFeatured);
}

// ─── 등록자 본인 자산 ────────────────────────────────────────────────────────
export function getRegistrantAssets(assets: AIAsset[], ownerName: string): AIAsset[] {
  return assets.filter((a) => a.ownerName === ownerName);
}

// ─── 심의 중인 자산 (Governance 화면용) ─────────────────────────────────────
export function getReviewPendingAssets(assets: AIAsset[]): AIAsset[] {
  return assets.filter((a) =>
    (["REVIEW_PENDING", "IN_REVIEW", "REVISION_REQUESTED", "RESUBMITTED"] as AssetStatus[]).includes(a.status)
  );
}

// ─── 단건 조회 ───────────────────────────────────────────────────────────────
export function getAssetById(assets: AIAsset[], id: string): AIAsset | undefined {
  return assets.find((a) => a.id === id);
}

// ─── 유형별 집계 ─────────────────────────────────────────────────────────────
export function countByType(assets: AIAsset[]): Record<string, number> {
  return assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.assetType] = (acc[a.assetType] ?? 0) + 1;
    return acc;
  }, {});
}

// ─── 비용 측정 방식별 집계 ──────────────────────────────────────────────────
export function countByCostType(assets: AIAsset[]): Record<string, number> {
  return assets.reduce<Record<string, number>>((acc, a) => {
    const k = a.cost.measurementType;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

// ─── 상태 업데이트 (불변 패턴 — Context reducer에서 사용) ───────────────────
export function applyStatusUpdate(
  assets: AIAsset[],
  id: string,
  status: AssetStatus
): AIAsset[] {
  return assets.map((a) =>
    a.id === id
      ? { ...a, status, lastUpdated: new Date().toISOString().split("T")[0] }
      : a
  );
}

// ─── 카탈로그 노출 토글 ──────────────────────────────────────────────────────
export function applyCatalogVisibility(
  assets: AIAsset[],
  id: string,
  showOnCatalog: boolean
): AIAsset[] {
  return assets.map((a) =>
    a.id === id
      ? { ...a, showOnCatalog, lastUpdated: new Date().toISOString().split("T")[0] }
      : a
  );
}

// ─── 즐겨찾기 토글 ──────────────────────────────────────────────────────────
export function applyFavoriteToggle(assets: AIAsset[], id: string): AIAsset[] {
  return assets.map((a) =>
    a.id === id ? { ...a, isFavorite: !a.isFavorite } : a
  );
}

// ─── 사용 횟수 증가 (세션 내) ─────────────────────────────────────────────
export function applyIncrementUsage(assets: AIAsset[], id: string): AIAsset[] {
  return assets.map((a) =>
    a.id === id
      ? { ...a, usage: { ...a.usage, totalCount: a.usage.totalCount + 1 } }
      : a
  );
}
