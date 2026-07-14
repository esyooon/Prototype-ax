import { useState } from "react";
import {
  LayoutGrid,
  FlaskConical,
  Wrench,
  BookOpen,
  PlusSquare,
  Package,
  ClipboardList,
  History,
  ShieldCheck,
  RefreshCw,
  BarChart2,
  CreditCard,
  ChevronDown,
  ChevronRight,
  User,
  Database,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Toaster } from "sonner";
import { AssetProvider, useAssets } from "../context/AssetContext";
import PlaygroundScreen from "../components/PlaygroundScreen";
import AssetDetailScreen from "../components/AssetDetailScreen";
import MyToolsScreen from "../components/MyToolsScreen";
import PlaygroundGuideScreen from "../components/PlaygroundGuideScreen";
import AssetRegisterScreen from "../components/AssetRegisterScreen";
import MyAssetsScreen from "../components/MyAssetsScreen";
import GovernanceScreen from "../components/GovernanceScreen";
import PolicyManagementScreen from "../components/PolicyManagementScreen";
import ReReviewScreen from "../components/ReReviewScreen";
import {
  getCatalogAssets,
  getReviewPendingAssets,
  countByType,
  countByCostType,
} from "../data/store";
import {
  ASSET_STATUS_LABELS,
  ASSET_TYPE_LABELS,
  REVIEW_PATH_LABELS,
  COST_MEASUREMENT_LABELS,
  ASSET_STATUS_CHIP,
} from "../data/types";
import type { AIAsset, AssetType } from "../data/types";

// ─── Types ───────────────────────────────────────────────────────────────────

type Role = "user" | "registrant" | "operator";

type MenuItem = { id: string; label: string; icon: React.ReactNode };
type MenuSection = { id: string; label: string; items: MenuItem[]; devOnly?: boolean };

// ─── Nav config ──────────────────────────────────────────────────────────────

const MENU_SECTIONS: MenuSection[] = [
  {
    id: "governance", label: "Governance",
    items: [
      { id: "review-pending", label: "심의 대기",        icon: <ClipboardList size={15} /> },
      { id: "review-history", label: "심의 이력",        icon: <History size={15} />       },
      { id: "policy-mgmt",    label: "정책 관리",        icon: <ShieldCheck size={15} />   },
      { id: "re-review",      label: "재심의·차단 관리", icon: <RefreshCw size={15} />     },
    ],
  },
  {
    id: "dashboard", label: "Dashboard",
    items: [
      { id: "usage-overview", label: "전사 활용 현황", icon: <BarChart2 size={15} />  },
      { id: "cost-license",   label: "비용·라이선스",  icon: <CreditCard size={15} /> },
    ],
  },
  {
    id: "playground", label: "Playground",
    items: [
      { id: "ai-playground",    label: "AI Playground",    icon: <FlaskConical size={15} /> },
      { id: "my-tools",         label: "내 도구함",         icon: <Wrench size={15} />       },
      { id: "my-assets",        label: "내 자산",           icon: <Package size={15} />      },
      { id: "asset-register",   label: "자산 등록",         icon: <PlusSquare size={15} />   },
      { id: "playground-guide", label: "Playground 가이드", icon: <BookOpen size={15} />     },
    ],
  },
  {
    id: "dev", label: "개발자 도구 (임시)", devOnly: true,
    items: [{ id: "data-check", label: "데이터 확인", icon: <Database size={15} /> }],
  },
];

const ROLE_LABELS: Record<Role, string> = {
  user: "일반 사용자", registrant: "등록자", operator: "거버넌스 운영자",
};

const ROLE_VISIBLE_SECTIONS: Record<Role, string[]> = {
  user:       ["playground"],
  registrant: ["playground"],
  operator:   ["governance", "dashboard", "playground", "dev"],
};

const PAGE_TITLES: Record<string, string> = {
  "review-pending":    "심의 대기",
  "review-history":    "심의 이력",
  "policy-mgmt":       "정책 관리",
  "re-review":         "재심의·차단 관리",
  "usage-overview":    "전사 활용 현황",
  "cost-license":      "비용·라이선스",
  "ai-playground":     "AI Playground",
  "my-tools":          "내 도구함",
  "my-assets":         "내 자산",
  "asset-register":    "자산 등록",
  "playground-guide":  "Playground 가이드",
  "data-check":        "데이터 확인 (임시)",
};

const PAGE_SECTION_LABELS: Record<string, string> = {
  "review-pending":    "Governance",
  "review-history":    "Governance",
  "policy-mgmt":       "Governance",
  "re-review":         "Governance",
  "usage-overview":    "Dashboard",
  "cost-license":      "Dashboard",
  "ai-playground":     "Playground",
  "my-tools":          "Playground",
  "my-assets":         "Playground",
  "asset-register":    "Playground",
  "playground-guide":  "Playground",
  "data-check":        "개발자 도구",
};

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AssetProvider>
      <AppShell />
      <Toaster position="bottom-right" richColors />
    </AssetProvider>
  );
}

// ─── Shell ───────────────────────────────────────────────────────────────────

function AppShell() {
  const { dispatch: assetDispatch } = useAssets();
  const [role,              setRole]              = useState<Role>("user");
  const [activeMenu,        setActiveMenu]        = useState<string>("ai-playground");
  const [roleDropdownOpen,  setRoleDropdownOpen]  = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Detail navigation
  const [detailAssetId, setDetailAssetId] = useState<string | null>(null);

  // Playground filter state lifted here so it survives detail → back navigation
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter,  setTypeFilter]  = useState<AssetType | null>(null);
  const [officialOnly, setOfficialOnly] = useState(false);

  // 배지 클릭 → Playground 가이드로 이동하면서 "배지 안내" 섹션으로 스크롤
  const [guideScrollTarget, setGuideScrollTarget] = useState<string | null>(null);

  const visibleSections = MENU_SECTIONS.filter((s) =>
    ROLE_VISIBLE_SECTIONS[role].includes(s.id)
  );

  const ROLE_DEFAULT_MENU: Record<Role, string> = {
    user: "ai-playground",
    registrant: "my-assets",
    operator: "review-pending",
  };

  function handleRoleChange(newRole: Role) {
    setRole(newRole);
    setRoleDropdownOpen(false);
    setDetailAssetId(null);
    setActiveMenu(ROLE_DEFAULT_MENU[newRole]);
  }

  function handleMenuChange(id: string) {
    setActiveMenu(id);
    setDetailAssetId(null);  // reset detail when switching menus
    setGuideScrollTarget(null);  // 사이드바로 가이드를 열 때는 강제 스크롤하지 않음
  }

  function handleOpenDetailFromMyAssets(assetId: string) {
    setActiveMenu("ai-playground");
    setDetailAssetId(assetId);
  }

  function handleOpenBadgeGuide() {
    setDetailAssetId(null);
    setActiveMenu("playground-guide");
    setGuideScrollTarget("badges");
  }

  function toggleSection(sectionId: string) {
    setCollapsedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }

  const showingDetail  = (activeMenu === "ai-playground" || activeMenu === "my-tools") && detailAssetId !== null;
  const pageTitle      = showingDetail ? "자산 상세" : (PAGE_TITLES[activeMenu] ?? "");
  const sectionLabel   = PAGE_SECTION_LABELS[activeMenu] ?? "";

  return (
    <div
      className="flex flex-col h-screen w-full bg-background overflow-hidden"
      style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-30 h-14 bg-card border-b border-border flex items-center px-0 flex-shrink-0">
        {/* Logo */}
        <div className="w-60 flex-shrink-0 flex items-center gap-2.5 px-5 h-full border-r border-border">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center flex-shrink-0">
            <LayoutGrid size={14} color="white" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-foreground leading-tight tracking-tight">
              DAOU AX Platform
            </div>
            <div className="text-[10px] text-muted-foreground leading-tight"
              style={{ fontFamily: "'DM Mono', monospace" }}>
              AI Asset Hub
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-between px-6 min-w-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span>{sectionLabel}</span>
            {sectionLabel && <ChevronRight size={12} className="text-muted-foreground/60" />}
            <span className="text-foreground font-medium">{pageTitle}</span>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* 역할 전환기 */}
            <div className="relative">
              <button
                onClick={() => setRoleDropdownOpen((v) => !v)}
                className="flex items-center gap-2 h-8 px-3 rounded border border-border bg-background hover:bg-muted transition-colors text-[12px] font-medium text-foreground whitespace-nowrap"
              >
                <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
                  <User size={11} className="text-primary" />
                </div>
                {ROLE_LABELS[role]}
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>

              {roleDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setRoleDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-card border border-border rounded shadow-lg py-1">
                    <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      데모 역할 선택
                    </div>
                    {(["user", "registrant", "operator"] as Role[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => handleRoleChange(r)}
                        className={`w-full text-left px-3 py-2 text-[13px] hover:bg-muted transition-colors flex items-center justify-between ${
                          role === r ? "text-primary font-medium" : "text-foreground"
                        }`}
                      >
                        {ROLE_LABELS[r]}
                        {role === r && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {role === "operator" && (
              <button
                onClick={() => {
                  assetDispatch({ type: "DEMO_RESET" });
                  import("sonner").then(({ toast }) =>
                    toast("Demo Reset 완료", { description: "asset-005가 초기 상태로 복구되었습니다.", duration: 3000 })
                  );
                }}
                className="h-7 px-3 rounded border border-dashed border-muted-foreground/40 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors whitespace-nowrap"
              >
                Demo Reset
              </button>
            )}
            <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[11px] font-semibold text-primary flex-shrink-0">
              김
            </div>
          </div>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 pt-14 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className="fixed left-0 top-14 bottom-0 w-60 bg-card border-r border-border flex flex-col z-20 overflow-y-auto flex-shrink-0">
          <nav className="flex-1 py-3">
            {visibleSections.map((section, idx) => {
              const isCollapsed = collapsedSections[section.id];
              return (
                <div key={section.id} className={idx > 0 ? "mt-1" : ""}>
                  <button
                    onClick={() => toggleSection(section.id)}
                    className={`w-full flex items-center justify-between px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest transition-colors ${
                      section.devOnly
                        ? "text-orange-400 hover:text-orange-500"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {section.label}
                    {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                  </button>

                  {!isCollapsed && (
                    <ul className="mt-0.5 mb-2">
                      {section.items.map((item) => {
                        const isActive = activeMenu === item.id;
                        return (
                          <li key={item.id}>
                            <button
                              onClick={() => handleMenuChange(item.id)}
                              className={`w-full flex items-center gap-2.5 px-4 py-2 text-[13px] transition-colors relative ${
                                isActive
                                  ? "text-primary font-medium bg-secondary"
                                  : "text-foreground hover:bg-muted"
                              }`}
                            >
                              {isActive && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r" />
                              )}
                              <span className={isActive ? "text-primary" : "text-muted-foreground"}>
                                {item.icon}
                              </span>
                              {item.label}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {section.devOnly && !isCollapsed && (
                    <div className="mx-4 mb-2 px-2 py-1 rounded bg-orange-50 border border-orange-100">
                      <p className="text-[10px] text-orange-400 leading-snug">
                        개발 확인용 — 최종 서비스 미포함
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="border-t border-border px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[11px] font-semibold text-primary flex-shrink-0">
                김
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-medium text-foreground truncate">김다우</div>
                <div className="text-[11px] text-muted-foreground truncate">{ROLE_LABELS[role]}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 ml-60 overflow-y-auto">
          {activeMenu === "data-check" ? (
            <DataCheckScreen />
          ) : showingDetail ? (
            <AssetDetailScreen
              assetId={detailAssetId!}
              onBack={() => setDetailAssetId(null)}
              onOpenBadgeGuide={handleOpenBadgeGuide}
            />
          ) : activeMenu === "ai-playground" ? (
            <PlaygroundScreen
              onOpenDetail={setDetailAssetId}
              searchQuery={searchQuery}
              typeFilter={typeFilter}
              onSearchChange={setSearchQuery}
              onTypeFilterChange={setTypeFilter}
              officialOnly={officialOnly}
              onOfficialToggle={setOfficialOnly}
              onNavigate={handleMenuChange}
              onOpenBadgeGuide={handleOpenBadgeGuide}
            />
          ) : activeMenu === "my-tools" ? (
            <MyToolsScreen onOpenDetail={setDetailAssetId} />
          ) : activeMenu === "playground-guide" ? (
            <PlaygroundGuideScreen
              scrollTarget={guideScrollTarget}
              onScrolled={() => setGuideScrollTarget(null)}
            />
          ) : activeMenu === "asset-register" ? (
            <AssetRegisterScreen onNavigate={handleMenuChange} />
          ) : activeMenu === "my-assets" ? (
            <MyAssetsScreen onOpenDetail={handleOpenDetailFromMyAssets} />
          ) : activeMenu === "review-pending" ? (
            <GovernanceScreen />
          ) : activeMenu === "policy-mgmt" ? (
            <PolicyManagementScreen />
          ) : activeMenu === "re-review" ? (
            <ReReviewScreen />
          ) : (
            <PlaceholderScreen pageTitle={pageTitle} sectionLabel={sectionLabel} />
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Placeholder ─────────────────────────────────────────────────────────────

function PlaceholderScreen({ pageTitle, sectionLabel }: { pageTitle: string; sectionLabel: string }) {
  return (
    <div className="px-10 py-8">
      <div className="mb-8">
        <div className="text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wider"
          style={{ fontFamily: "'DM Mono', monospace" }}>
          {sectionLabel}
        </div>
        <h1 className="text-[22px] font-semibold text-foreground tracking-tight">{pageTitle}</h1>
      </div>
      <div className="bg-card border border-border rounded-md">
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <LayoutGrid size={18} className="text-muted-foreground" />
          </div>
          <p className="text-[13px] text-muted-foreground">이 화면은 다음 단계에서 구현될 예정입니다.</p>
        </div>
      </div>
    </div>
  );
}

// ─── DataCheckScreen ─────────────────────────────────────────────────────────

function DataCheckScreen() {
  const { assets } = useAssets();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const catalogAssets = getCatalogAssets(assets);
  const reviewPending = getReviewPendingAssets(assets);
  const byType        = countByType(assets);
  const byCost        = countByCostType(assets);

  return (
    <div className="px-10 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="text-[11px] font-medium text-orange-400 uppercase tracking-wider"
            style={{ fontFamily: "'DM Mono', monospace" }}>
            개발자 도구 (임시)
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-500 border border-orange-100">
            최종 서비스 미포함
          </span>
        </div>
        <h1 className="text-[22px] font-semibold text-foreground tracking-tight">데이터 확인</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          공통 자산 데이터 구조와 12개 샘플 자산이 정상 등록됐는지 확인합니다.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="전체 자산"         value={assets.length} />
        <StatCard label="게시 자산"         value={catalogAssets.length} accent />
        <StatCard label="심의 중"           value={reviewPending.length} warn />
        <StatCard label="대표 자산 (isFeatured)" value={assets.filter((a) => a.isFeatured).length} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <AggTable title="유형별 자산 수"
          rows={Object.entries(byType).map(([k, v]) => [ASSET_TYPE_LABELS[k as keyof typeof ASSET_TYPE_LABELS] ?? k, String(v)])} />
        <AggTable title="비용 측정 방식별 자산 수"
          rows={Object.entries(byCost).map(([k, v]) => [COST_MEASUREMENT_LABELS[k as keyof typeof COST_MEASUREMENT_LABELS] ?? k, String(v)])} />
      </div>

      <div className="bg-card border border-border rounded-md overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-[13px] font-semibold text-foreground">전체 자산 목록</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">행을 클릭하면 원본 데이터 객체를 확인할 수 있습니다.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["ID", "자산명", "유형", "상태", "심의 경로", "카탈로그", "대표", "등록자"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  expanded={expandedId === asset.id}
                  onToggle={() => setExpandedId((p) => p === asset.id ? null : asset.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, warn }: { label: string; value: number; accent?: boolean; warn?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-md px-5 py-4">
      <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
      <div className={`text-[28px] font-semibold leading-none ${accent ? "text-primary" : warn ? "text-orange-500" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function AggTable({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border">
        <h3 className="text-[12px] font-semibold text-foreground">{title}</h3>
      </div>
      <table className="w-full text-[12px]">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-border last:border-0">
              <td className="px-4 py-2 text-foreground">{k}</td>
              <td className="px-4 py-2 text-right font-semibold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssetRow({ asset, expanded, onToggle }: { asset: AIAsset; expanded: boolean; onToggle: () => void }) {
  const chip = ASSET_STATUS_CHIP[asset.status];
  return (
    <>
      <tr
        className={`border-b border-border cursor-pointer transition-colors ${expanded ? "bg-secondary" : "hover:bg-muted/40"}`}
        onClick={onToggle}
      >
        <td className="px-4 py-2.5 text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{asset.id}</td>
        <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">{asset.name}</td>
        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{asset.assetTypeLabel}</td>
        <td className="px-4 py-2.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${chip.bg} ${chip.text}`}>
            {ASSET_STATUS_LABELS[asset.status]}
          </span>
        </td>
        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{REVIEW_PATH_LABELS[asset.review.stage]}</td>
        <td className="px-4 py-2.5">
          {asset.showOnCatalog ? <CheckCircle2 size={14} className="text-green-500" /> : <XCircle size={14} className="text-muted-foreground/40" />}
        </td>
        <td className="px-4 py-2.5">
          {asset.isFeatured ? <CheckCircle2 size={14} className="text-primary" /> : <XCircle size={14} className="text-muted-foreground/40" />}
        </td>
        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{asset.ownerName} / {asset.ownerDepartment}</td>
      </tr>
      {expanded && (
        <tr className="border-b border-border bg-muted/20">
          <td colSpan={8} className="px-6 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Database size={12} className="text-muted-foreground" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">원본 데이터 객체</span>
            </div>
            <pre className="text-[11px] text-foreground bg-card border border-border rounded p-4 overflow-x-auto leading-relaxed max-h-80"
              style={{ fontFamily: "'DM Mono', monospace" }}>
              {JSON.stringify(asset, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
