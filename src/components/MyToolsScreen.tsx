import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Clock, Star, LayoutGrid, Search, Copy, ExternalLink, PlayCircle, Link2, BookOpenText, Settings2 } from "lucide-react";
import { useAssets } from "../context/AssetContext";
import { getCatalogAssets } from "../data/store";
import type { AIAsset, AssetType } from "../data/types";

type Tab = "recent" | "favorite" | "all";

const TYPE_BADGE: Record<AssetType, { bg: string; text: string }> = {
  PROMPT:     { bg: "bg-blue-50",    text: "text-blue-600"   },
  ASSISTANT:  { bg: "bg-violet-50",  text: "text-violet-600" },
  AUTOMATION: { bg: "bg-orange-50",  text: "text-orange-600" },
  APP:        { bg: "bg-emerald-50", text: "text-emerald-600"},
  MCP:        { bg: "bg-cyan-50",    text: "text-cyan-600"   },
  OTHER:      { bg: "bg-gray-100",   text: "text-gray-600"   },
};

const TYPE_FILTERS: { value: AssetType | null; label: string }[] = [
  { value: null,         label: "전체"                  },
  { value: "PROMPT",     label: "프롬프트"              },
  { value: "ASSISTANT",  label: "맞춤형 AI"             },
  { value: "AUTOMATION", label: "자동화"                },
  { value: "APP",        label: "앱"                    },
  { value: "MCP",        label: "시스템 연결 도구(MCP)" },
  { value: "OTHER",      label: "기타"                  },
];

const ACTION_ICONS: Record<string, React.ReactNode> = {
  "복사하기":  <Copy size={12} />,
  "바로 접속": <ExternalLink size={12} />,
  "사용 방법": <Settings2 size={12} />,
  "실행하기":  <PlayCircle size={12} />,
  "연결 방법": <Link2 size={12} />,
  "자료 확인": <BookOpenText size={12} />,
  "내용 확인": <BookOpenText size={12} />,
};

export default function MyToolsScreen({ onOpenDetail }: { onOpenDetail: (id: string) => void }) {
  const { assets, recentIds, dispatch } = useAssets();
  const [tab,        setTab]        = useState<Tab>("recent");
  const [typeFilter, setTypeFilter] = useState<AssetType | null>(null);
  const [query,      setQuery]      = useState("");

  const catalogAssets = useMemo(() => getCatalogAssets(assets), [assets]);

  const baseList = useMemo(() => {
    if (tab === "recent")   return recentIds.map(id => assets.find(a => a.id === id)).filter(Boolean) as AIAsset[];
    if (tab === "favorite") return catalogAssets.filter(a => a.isFavorite);
    return catalogAssets;
  }, [tab, recentIds, assets, catalogAssets]);

  const filtered = useMemo(() => {
    let list = baseList;
    if (typeFilter) list = list.filter(a => a.assetType === typeFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
    }
    return list;
  }, [baseList, typeFilter, query]);

  function handleAction(asset: AIAsset) {
    dispatch({ type: "ADD_RECENT",      id: asset.id });
    dispatch({ type: "INCREMENT_USAGE", id: asset.id });
    toast.success("사용 기록에 추가되었습니다.", { description: asset.name, duration: 2000 });
  }

  function handleFavorite(asset: AIAsset) {
    dispatch({ type: "TOGGLE_FAVORITE", id: asset.id });
    toast(asset.isFavorite ? "즐겨찾기에서 제거했습니다." : "즐겨찾기에 추가했습니다.", { duration: 1800 });
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "recent",   label: "최근 사용",  icon: <Clock  size={13} />, count: recentIds.length },
    { id: "favorite", label: "즐겨찾기",   icon: <Star   size={13} />, count: catalogAssets.filter(a => a.isFavorite).length },
    { id: "all",      label: "전체",       icon: <LayoutGrid size={13} />, count: catalogAssets.length },
  ];

  return (
    <div className="px-10 py-8">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-foreground tracking-tight">내 도구함</h1>
        <p className="text-[13px] text-muted-foreground mt-1">최근에 사용하거나 즐겨찾기한 AI 자산을 확인합니다.</p>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-1 border-b border-border mb-5">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon}
            {t.label}
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-normal ${
              tab === t.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`} style={{ fontFamily: "'DM Mono', monospace" }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* 검색 + 필터 */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="자산 검색"
            className="w-full h-8 pl-8 pr-3 rounded border border-border bg-card text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.label}
              onClick={() => setTypeFilter(f.value)}
              className={`h-7 px-2.5 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap ${
                typeFilter === f.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="grid grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map(asset => (
            <ToolCard
              key={asset.id}
              asset={asset}
              isRecent={recentIds.includes(asset.id)}
              onOpenDetail={onOpenDetail}
              onAction={handleAction}
              onFavorite={handleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ToolCard({
  asset,
  isRecent,
  onOpenDetail,
  onAction,
  onFavorite,
}: {
  asset: AIAsset;
  isRecent: boolean;
  onOpenDetail: (id: string) => void;
  onAction: (a: AIAsset) => void;
  onFavorite: (a: AIAsset) => void;
}) {
  const badge = TYPE_BADGE[asset.assetType];

  return (
    <div
      onClick={() => onOpenDetail(asset.id)}
      className="flex flex-col bg-card border border-border rounded-md cursor-pointer hover:shadow-sm hover:border-primary/30 transition-all group"
    >
      <div className="flex-1 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${badge.bg} ${badge.text}`}>
            {asset.assetTypeLabel}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onFavorite(asset); }}
            className={`w-6 h-6 flex items-center justify-center rounded hover:bg-muted transition-colors ${
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
        {isRecent && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock size={10} /> 최근 사용
          </span>
        )}
      </div>
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/20 rounded-b-md">
        <span className="text-[11px] text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
          사용 {asset.usage.totalCount.toLocaleString()}건
        </span>
        <button
          onClick={e => { e.stopPropagation(); onAction(asset); }}
          className="flex items-center gap-1.5 h-7 px-3 rounded bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors"
        >
          {ACTION_ICONS[asset.usageActionLabel]}
          {asset.usageActionLabel}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const msgs: Record<Tab, { title: string; desc: string }> = {
    recent:   { title: "최근 사용한 자산이 없습니다.", desc: "AI Playground에서 자산을 사용하면 이곳에 표시됩니다." },
    favorite: { title: "즐겨찾기한 자산이 없습니다.", desc: "자산 카드의 ★ 버튼을 눌러 즐겨찾기에 추가해 보세요." },
    all:      { title: "조건에 맞는 자산이 없습니다.", desc: "검색어나 유형 필터를 변경해 보세요." },
  };
  const m = msgs[tab];
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 bg-card border border-border rounded-md">
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
        {tab === "recent" ? <Clock size={16} className="text-muted-foreground" />
          : tab === "favorite" ? <Star size={16} className="text-muted-foreground" />
          : <Search size={16} className="text-muted-foreground" />}
      </div>
      <div className="text-center">
        <p className="text-[13px] font-medium text-foreground">{m.title}</p>
        <p className="text-[12px] text-muted-foreground mt-1">{m.desc}</p>
      </div>
    </div>
  );
}
