import { createContext, useContext, useReducer, type ReactNode } from "react";
import type { AIAsset, AssetStatus } from "../data/types";
import { INITIAL_ASSETS } from "../data/assets";
import {
  applyStatusUpdate,
  applyCatalogVisibility,
  applyFavoriteToggle,
  applyIncrementUsage,
} from "../data/store";

// ─── State ───────────────────────────────────────────────────────────────────

interface CheckingInfo {
  previousStatus: AssetStatus;
  errorType: string;
  reportedAt: string;
}

interface ContextState {
  assets: AIAsset[];
  recentIds: string[];
  revisionNotes: Record<string, string[]>;
  approvalConditions: Record<string, string[]>;
  checkingInfo: Record<string, CheckingInfo>;
}

const INITIAL_STATE: ContextState = {
  assets: INITIAL_ASSETS,
  recentIds: [],
  revisionNotes: {},
  approvalConditions: {},
  checkingInfo: {},
};

// ─── Actions ─────────────────────────────────────────────────────────────────

type AssetAction =
  | { type: "UPDATE_STATUS"; id: string; status: AssetStatus }
  | { type: "TOGGLE_FAVORITE"; id: string }
  | { type: "SET_CATALOG_VISIBILITY"; id: string; showOnCatalog: boolean }
  | { type: "INCREMENT_USAGE"; id: string }
  | { type: "ADD_RECENT"; id: string }
  | { type: "SET_REVISION_NOTES"; id: string; notes: string[] }
  | { type: "SET_APPROVAL_CONDITIONS"; id: string; conditions: string[] }
  | { type: "PATCH_ASSET"; id: string; patch: Partial<Pick<AIAsset, "status" | "showOnCatalog" | "visibility" | "version">> }
  | { type: "REPORT_ERROR"; id: string; errorType: string }
  | { type: "DEMO_RESET" };

// ─── Reducer ─────────────────────────────────────────────────────────────────

function assetReducer(state: ContextState, action: AssetAction): ContextState {
  switch (action.type) {
    case "UPDATE_STATUS":
      return { ...state, assets: applyStatusUpdate(state.assets, action.id, action.status) };
    case "TOGGLE_FAVORITE":
      return { ...state, assets: applyFavoriteToggle(state.assets, action.id) };
    case "SET_CATALOG_VISIBILITY":
      return { ...state, assets: applyCatalogVisibility(state.assets, action.id, action.showOnCatalog) };
    case "INCREMENT_USAGE":
      return { ...state, assets: applyIncrementUsage(state.assets, action.id) };
    case "ADD_RECENT": {
      const next = [action.id, ...state.recentIds.filter((id) => id !== action.id)].slice(0, 3);
      return { ...state, recentIds: next };
    }
    case "SET_REVISION_NOTES":
      return { ...state, revisionNotes: { ...state.revisionNotes, [action.id]: action.notes } };
    case "SET_APPROVAL_CONDITIONS":
      return { ...state, approvalConditions: { ...state.approvalConditions, [action.id]: action.conditions } };
    case "PATCH_ASSET":
      return {
        ...state,
        assets: state.assets.map(a =>
          a.id === action.id
            ? { ...a, ...action.patch, lastUpdated: new Date().toISOString().split("T")[0] }
            : a
        ),
      };
    case "REPORT_ERROR": {
      const prev = state.assets.find(a => a.id === action.id);
      const previousStatus = prev?.status ?? "PUBLISHED";
      return {
        ...state,
        checkingInfo: {
          ...state.checkingInfo,
          [action.id]: { previousStatus, errorType: action.errorType, reportedAt: new Date().toISOString().split("T")[0] },
        },
        assets: applyStatusUpdate(state.assets, action.id, "CHECKING"),
      };
    }
    case "DEMO_RESET": {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { "asset-005": _ci, ...restChecking } = state.checkingInfo;
      return {
        ...state,
        assets: state.assets.map(a =>
          a.id === "asset-005"
            ? {
                ...a,
                status: "REVIEW_PENDING",
                showOnCatalog: false,
                version: "1.0.0",
                visibility: "AX기획팀 파일럿 신청",
                isFavorite: false,
                usage: { ...a.usage, totalCount: 0 },
                lastUpdated: new Date().toISOString().split("T")[0],
              }
            : a
        ),
        recentIds: state.recentIds.filter(id => id !== "asset-005"),
        revisionNotes: { ...state.revisionNotes, "asset-005": [] },
        approvalConditions: { ...state.approvalConditions, "asset-005": [] },
        checkingInfo: restChecking,
      };
    }
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface AssetContextValue {
  assets: AIAsset[];
  recentIds: string[];
  revisionNotes: Record<string, string[]>;
  approvalConditions: Record<string, string[]>;
  checkingInfo: Record<string, CheckingInfo>;
  dispatch: React.Dispatch<AssetAction>;
}

const AssetContext = createContext<AssetContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AssetProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(assetReducer, INITIAL_STATE);
  return (
    <AssetContext.Provider value={{
      assets: state.assets,
      recentIds: state.recentIds,
      revisionNotes: state.revisionNotes,
      approvalConditions: state.approvalConditions,
      checkingInfo: state.checkingInfo,
      dispatch,
    }}>
      {children}
    </AssetContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAssets(): AssetContextValue {
  const ctx = useContext(AssetContext);
  if (!ctx) throw new Error("useAssets must be used within <AssetProvider>");
  return ctx;
}
