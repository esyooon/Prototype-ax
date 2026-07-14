import { CheckCircle2, UserCheck, Building2 } from "lucide-react";
import type { AIAsset } from "../data/types";
import { getTrustBadges, TRUST_BADGE_META, type TrustBadgeKind } from "../data/badges";

// 심의: 체크 / 검증: 체크+사람(층 구조) / 공식: 건물(공식 느낌)
const BADGE_ICONS: Record<TrustBadgeKind, (size: number) => React.ReactNode> = {
  REVIEWED: (s) => <CheckCircle2 size={s} />,
  VERIFIED: (s) => <UserCheck size={s} />,
  OFFICIAL: (s) => <Building2 size={s} />,
};

// 자산의 신뢰 배지(심의/검증/공식)를 그리는 공용 컴포넌트.
// 모든 배지는 클릭 가능하며, onBadgeClick으로 Playground 가이드 화면 이동을 연결한다.
export default function TrustBadges({
  asset,
  size = "sm",
  onBadgeClick,
}: {
  asset: AIAsset;
  size?: "sm" | "md";
  onBadgeClick?: () => void;
}) {
  const kinds = getTrustBadges(asset);
  if (kinds.length === 0) return null;

  const iconSize = size === "md" ? 13 : 11;
  const padCls = size === "md" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[10px]";

  return (
    <div className="flex items-center gap-1">
      {kinds.map((kind) => {
        const meta = TRUST_BADGE_META[kind];
        return (
          <button
            key={kind}
            type="button"
            onClick={(e) => { e.stopPropagation(); onBadgeClick?.(); }}
            title={`${meta.fullName} — ${meta.meaning}`}
            className={`inline-flex items-center gap-1 rounded border font-medium transition-colors hover:brightness-95 ${meta.cls} ${padCls}`}
          >
            {BADGE_ICONS[kind](iconSize)}
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
