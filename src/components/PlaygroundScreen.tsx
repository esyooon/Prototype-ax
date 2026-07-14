import { useMemo } from "react";
import { toast } from "sonner";
import {
  Search,
  Star,
  Users,
  Copy,
  ExternalLink,
  PlayCircle,
  Link2,
  BookOpenText,
  Settings2,
  Clock,
  PlusCircle,
  ChevronRight,
  Sparkles,
  Building2,
} from "lucide-react";
import { useAssets } from "../context/AssetContext";
import { getCatalogAssets, getFeaturedAssets } from "../data/store";
import type { AIAsset, AssetType } from "../data/types";
import TrustBadges from "./TrustBadges";

// ─── 상수 ────────────────────────────────────────────────────────────────────

const TYPE_FILTERS: { value: AssetType | null; label: string }[] = [
  { value: null,          label: "전체"                   },
  { value: "PROMPT",      label: "프롬프트"               },
  { value: "ASSISTANT",   label: "맞춤형 AI"              },
  { value: "AUTOMATION",  label: "자동화"                 },
  { value: "APP",         label: "앱"                     },
  { value: "MCP",         label: "시스템 연결 도구(MCP)"  },
  { value: "OTHER",       label: "기타"                   },
];

const TYPE_BADGE: Record<AssetType, { bg: string; text: string }> = {
  PROMPT:     { bg: "bg-blue-50",    text: "text-blue-600"   },
  ASSISTANT:  { bg: "bg-violet-50",  text: "text-violet-600" },
  AUTOMATION: { bg: "bg-orange-50",  text: "text-orange-600" },
  APP:        { bg: "bg-emerald-50", text: "text-emerald-600"},
  MCP:        { bg: "bg-cyan-50",    text: "text-cyan-600"   },
  OTHER:      { bg: "bg-gray-100",   text: "text-gray-600"   },
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  "복사하기":  <Copy size={13} />,
  "바로 접속": <ExternalLink size={13} />,
  "사용 방법": <Settings2 size={13} />,
  "실행하기":  <PlayCircle size={13} />,
  "연결 방법": <Link2 size={13} />,
  "자료 확인": <BookOpenText size={13} />,
  "내용 확인": <BookOpenText size={13} />,
};

function getActionToast(asset: AIAsset): string {
  switch (asset.assetType) {
    case "PROMPT":     return "프롬프트가 클립보드에 복사되었습니다.";
    case "ASSISTANT":  return "외부 서비스 접속을 시뮬레이션합니다. (데모)";
    case "AUTOMATION": return "사용 방법 안내를 불러옵니다. (데모)";
    case "APP":        return "앱 실행을 시뮬레이션합니다. (데모)";
    case "MCP":        return "연결 방법 안내를 불러옵니다. (데모)";
    default:           return "자료를 불러옵니다. (데모)";
  }
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface PlaygroundScreenProps {
  onOpenDetail: (assetId: string) => void;
  searchQuery: string;
  typeFilter: AssetType | null;
  onSearchChange: (q: string) => void;
  onTypeFilterChange: (t: AssetType | null) => void;
  officialOnly: boolean;
  onOfficialToggle: (v: boolean) => void;
  onNavigate?: (menu: string) => void;
  onOpenBadgeGuide?: () => void;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function PlaygroundScreen({
  onOpenDetail,
  searchQuery,
  typeFilter,
  onSearchChange,
  onTypeFilterChange,
  officialOnly,
  onOfficialToggle,
  onNavigate,
  onOpenBadgeGuide,
}: PlaygroundScreenProps) {
  const { assets, recentIds, dispatch } = useAssets();

  const catalogAssets  = useMemo(() => getCatalogAssets(assets), [assets]);
  const featuredAssets = useMemo(() => getFeaturedAssets(assets), [assets]);

  const isFiltering = searchQuery.trim() !== "" || typeFilter !== null || officialOnly;

  const filteredAssets = useMemo(() => {
    let result = catalogAssets;
    if (officialOnly) result = result.filter((a) => a.trustTier === "OFFICIAL");
    if (typeFilter) result = result.filter((a) => a.assetType === typeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          a.assetTypeLabel.toLowerCase().includes(q) ||
          a.usageConditions.some((c) => c.toLowerCase().includes(q))
      );
    }
    return result;
  }, [catalogAssets, typeFilter, searchQuery, officialOnly]);

  const recentAssets = useMemo(
    () => recentIds.map((id) => assets.find((a) => a.id === id)).filter(Boolean) as AIAsset[],
    [recentIds, assets]
  );

  function handleAction(asset: AIAsset) {
    dispatch({ type: "ADD_RECENT",      id: asset.id });
    dispatch({ type: "INCREMENT_USAGE", id: asset.id });
    toast.success(getActionToast(asset), { description: asset.name, duration: 2500 });
  }

  function handleFavorite(asset: AIAsset) {
    dispatch({ type: "TOGGLE_FAVORITE", id: asset.id });
    toast(asset.isFavorite ? "즐겨찾기에서 제거했습니다." : "즐겨찾기에 추가했습니다.", { duration: 1800 });
  }

  return (
    <div className="px-10 py-8">
      {/* ── 페이지 헤더 ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-foreground tracking-tight">AI Playground</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            동료가 만든 AI 자산을 업무별로 찾고 바로 활용해 보세요.
          </p>
        </div>
        <button
          onClick={() => onNavigate?.("asset-register")}
          className="flex items-center gap-1.5 h-9 px-4 rounded bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors flex-shrink-0"
        >
          <PlusCircle size={14} /> 내 AI 자산 등록
        </button>
      </div>

      {/* ── 검색 ── */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="어떤 업무를 해결하고 싶으신가요?"
          className="w-full h-10 pl-9 pr-20 rounded-md border border-border bg-card text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground hover:text-foreground"
          >
            지우기
          </button>
        )}
      </div>

      {/* ── 유형 필터 ── */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => { onTypeFilterChange(f.value); onOfficialToggle(false); }}
            className={`h-7 px-3 rounded-full text-[12px] font-medium border transition-colors whitespace-nowrap ${
              typeFilter === f.value && !officialOnly
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}

        {/* 공식 자산 필터 (유형 필터와 상호배타) */}
        <span className="w-px h-4 bg-border mx-0.5" aria-hidden />
        <button
          onClick={() => { onOfficialToggle(!officialOnly); onTypeFilterChange(null); }}
          className={`flex items-center gap-1 h-7 px-3 rounded-full text-[12px] font-medium border transition-colors whitespace-nowrap ${
            officialOnly
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-foreground border-border hover:bg-muted"
          }`}
        >
          <Building2 size={12} /> 공식
        </button>

        {isFiltering && (
          <button
            onClick={() => { onTypeFilterChange(null); onSearchChange(""); onOfficialToggle(false); }}
            className="h-7 px-3 rounded-full text-[12px] font-medium border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors"
          >
            필터 초기화
          </button>
        )}
      </div>

      {/* ── 검색/필터 활성 시 결과만 표시 ── */}
      {isFiltering ? (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Search size={13} className="text-muted-foreground" />
            <span className="text-[13px] font-medium text-foreground">검색 결과</span>
            <span className="text-[12px] text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
              {filteredAssets.length}개
            </span>
          </div>
          {filteredAssets.length > 0 ? (
            <AssetGrid assets={filteredAssets} onAction={handleAction} onFavorite={handleFavorite} onOpenDetail={onOpenDetail} onOpenBadgeGuide={onOpenBadgeGuide} />
          ) : (
            <EmptySearchState query={searchQuery} />
          )}
        </section>
      ) : (
        <>
          {/* ── 최근 사용 ── */}
          <section className="mb-8">
            <SectionHeader icon={<Clock size={14} />} title="최근 사용" />
            {recentAssets.length > 0 ? (
              <AssetGrid assets={recentAssets} onAction={handleAction} onFavorite={handleFavorite} onOpenDetail={onOpenDetail} onOpenBadgeGuide={onOpenBadgeGuide} />
            ) : (
              <div className="bg-card border border-border rounded-md px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <Clock size={14} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-foreground">아직 사용한 AI 자산이 없습니다.</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">자산을 사용하면 이곳에서 다시 찾을 수 있습니다.</p>
                </div>
              </div>
            )}
          </section>

          {/* ── 추천 자산 ── */}
          <section className="mb-8">
            <SectionHeader icon={<Sparkles size={14} />} title="추천 자산" description="업무별로 바로 쓸 수 있는 AI 자산을 모았습니다." />
            <AssetGrid assets={featuredAssets} onAction={handleAction} onFavorite={handleFavorite} onOpenDetail={onOpenDetail} onOpenBadgeGuide={onOpenBadgeGuide} featured />
          </section>

          {/* ── 전체 자산 ── */}
          <section>
            <SectionHeader
              icon={<ChevronRight size={14} />}
              title="전체 자산"
              description={`게시된 AI 자산 ${catalogAssets.length}개`}
            />
            <AssetGrid assets={catalogAssets} onAction={handleAction} onFavorite={handleFavorite} onOpenDetail={onOpenDetail} onOpenBadgeGuide={onOpenBadgeGuide} />
          </section>
        </>
      )}
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-[14px] font-semibold text-foreground">{title}</span>
      {description && <span className="text-[12px] text-muted-foreground ml-1">{description}</span>}
    </div>
  );
}

// ─── AssetGrid ────────────────────────────────────────────────────────────────

function AssetGrid({
  assets,
  onAction,
  onFavorite,
  onOpenDetail,
  onOpenBadgeGuide,
  featured,
}: {
  assets: AIAsset[];
  onAction: (a: AIAsset) => void;
  onFavorite: (a: AIAsset) => void;
  onOpenDetail: (id: string) => void;
  onOpenBadgeGuide?: () => void;
  featured?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 2xl:grid-cols-4 gap-4">
      {assets.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          onAction={onAction}
          onFavorite={onFavorite}
          onOpenDetail={onOpenDetail}
          onOpenBadgeGuide={onOpenBadgeGuide}
          featured={featured}
        />
      ))}
    </div>
  );
}

// ─── AssetCard ────────────────────────────────────────────────────────────────

function AssetCard({
  asset,
  onAction,
  onFavorite,
  onOpenDetail,
  onOpenBadgeGuide,
  featured,
}: {
  asset: AIAsset;
  onAction: (a: AIAsset) => void;
  onFavorite: (a: AIAsset) => void;
  onOpenDetail: (id: string) => void;
  onOpenBadgeGuide?: () => void;
  featured?: boolean;
}) {
  const badge = TYPE_BADGE[asset.assetType];
  const visibleBadges = asset.cardBadges.slice(0, 2);
  const actionIcon = ACTION_ICONS[asset.usageActionLabel];

  function handleCardClick(e: React.MouseEvent) {
    if ((e.target as Element).closest("button")) return;
    onOpenDetail(asset.id);
  }

  return (
    <div
      onClick={handleCardClick}
      className={`relative flex flex-col bg-card border rounded-md cursor-pointer transition-all hover:shadow-sm hover:border-primary/30 group ${
        featured ? "border-primary/20" : "border-border"
      }`}
    >
      {featured && <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/30 rounded-t-md" />}

      <div className="flex-1 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${badge.bg} ${badge.text}`}>
            {asset.assetTypeLabel}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onFavorite(asset); }}
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors hover:bg-muted ${
              asset.isFavorite ? "text-yellow-400" : "text-muted-foreground/40 hover:text-muted-foreground"
            }`}
          >
            <Star size={13} fill={asset.isFavorite ? "currentColor" : "none"} />
          </button>
        </div>

        <h3 className="text-[14px] font-semibold text-foreground mb-1 leading-snug group-hover:text-primary transition-colors line-clamp-1">
          {asset.name}
        </h3>
        <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2 mb-2.5">
          {asset.description}
        </p>
        <div className="flex items-center gap-1 mb-2.5">
          <Users size={11} className="text-muted-foreground/60 flex-shrink-0" />
          <span className="text-[11px] text-muted-foreground truncate">
            {asset.ownerName} · {asset.ownerDepartment}
          </span>
        </div>
        <div className="mb-2.5">
          <TrustBadges asset={asset} onBadgeClick={onOpenBadgeGuide} />
        </div>
        {visibleBadges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {visibleBadges.map((b) => (
              <span key={b} className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">
                {b}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/20 rounded-b-md">
        <span className="text-[11px] text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
          사용 {asset.usage.totalCount.toLocaleString()}건
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onAction(asset); }}
          className="flex items-center gap-1.5 h-7 px-3 rounded bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors"
        >
          {actionIcon}
          {asset.usageActionLabel}
        </button>
      </div>
    </div>
  );
}

// ─── 빈 상태 ─────────────────────────────────────────────────────────────────

function EmptySearchState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 bg-card border border-border rounded-md">
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
        <Search size={16} className="text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="text-[13px] font-medium text-foreground">
          {query ? `"${query}"에 해당하는 자산을 찾지 못했습니다.` : "조건에 맞는 자산이 없습니다."}
        </p>
        <p className="text-[12px] text-muted-foreground mt-1">검색어나 필터를 변경해 보세요.</p>
      </div>
    </div>
  );
}
