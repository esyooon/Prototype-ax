export type AssetType = "PROMPT" | "ASSISTANT" | "AUTOMATION" | "APP" | "MCP" | "OTHER";

export type AppSubtype = "CLIENT_APP" | "BACKEND_APP";

export type AssetStatus =
  | "DRAFT"
  | "AUTO_CHECK"
  | "REVIEW_PENDING"
  | "IN_REVIEW"
  | "REVISION_REQUESTED"
  | "RESUBMITTED"
  | "CONDITIONAL_APPROVAL"
  | "PUBLISHED"
  | "CHECKING"
  | "SUSPENDED"
  | "RETIRED";

export type ReviewPath = "AUTO_REGISTER" | "OPERATION_REVIEW" | "DEEP_REVIEW" | "AUTO_REJECT";

export type CostMeasurementType = "LICENSE" | "ACTUAL" | "ESTIMATED" | "PROXY" | "NONE";

export interface DataHandling {
  summary: string;
  sensitivity: string;
  externalTransfer: boolean;
  storage: string;
}

export interface Cost {
  measurementType: CostMeasurementType;
  display: string;
  note: string;
}

export interface AssetUsage {
  totalCount: number;
  recentUsers: number;
  departmentCount: number;
  actionCount?: number;
  favoriteCount?: number;
  issueCount?: number;
  measurementBasis: string;
}

export interface Review {
  stage: ReviewPath;
  reasons: string[];
  additionalReviews: string[];
  policyVersion: string;
}

export interface AIAsset {
  id: string;
  registrantUserId?: string;
  name: string;
  assetType: AssetType;
  assetTypeLabel: string;
  subtype?: string;
  category: string;
  description: string;

  ownerName: string;
  ownerDepartment: string;
  operatorName?: string;
  operatorDepartment?: string;

  status: AssetStatus;
  showOnCatalog: boolean;
  isFeatured: boolean;
  visibility: string;
  version: string;

  createdWith: string[];
  executionEnvironment: string[];
  requiredLicenses: string[];

  usageActionLabel: string;
  usageConditions: string[];
  cardBadges: string[];

  dataHandling: DataHandling;

  permissionLevel: string[];
  humanConfirmationRequired: boolean;
  scheduledExecution?: string;

  knownLimitations: string[];

  cost: Cost;
  usage: AssetUsage;
  review: Review;

  createdAt: string;
  lastUpdated: string;
  isFavorite: boolean;

  typeSpecific: Record<string, unknown>;
}

// ─── UI 레이블 ───────────────────────────────────────────────────────────────

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  DRAFT: "작성 중",
  AUTO_CHECK: "자동 사전검사 중",
  REVIEW_PENDING: "심의 대기",
  IN_REVIEW: "심의 중",
  REVISION_REQUESTED: "보완 요청",
  RESUBMITTED: "재제출",
  CONDITIONAL_APPROVAL: "조건부 승인",
  PUBLISHED: "게시",
  CHECKING: "확인 중",
  SUSPENDED: "사용 중지",
  RETIRED: "폐기",
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  PROMPT: "프롬프트",
  ASSISTANT: "맞춤형 AI",
  AUTOMATION: "자동화",
  APP: "앱",
  MCP: "시스템 연결 도구(MCP)",
  OTHER: "기타",
};

export const REVIEW_PATH_LABELS: Record<ReviewPath, string> = {
  AUTO_REGISTER: "자동 등록",
  OPERATION_REVIEW: "운영 심의",
  DEEP_REVIEW: "정밀 심의",
  AUTO_REJECT: "자동 반려",
};

export const COST_MEASUREMENT_LABELS: Record<CostMeasurementType, string> = {
  LICENSE: "라이선스 내 사용",
  ACTUAL: "실측 (API 사용량)",
  ESTIMATED: "추정치",
  PROXY: "대체 지표",
  NONE: "추가 비용 없음",
};

export const ASSET_STATUS_CHIP: Record<AssetStatus, { bg: string; text: string }> = {
  DRAFT:                { bg: "bg-gray-100",    text: "text-gray-600"   },
  AUTO_CHECK:           { bg: "bg-blue-50",     text: "text-blue-600"   },
  REVIEW_PENDING:       { bg: "bg-yellow-50",   text: "text-yellow-700" },
  IN_REVIEW:            { bg: "bg-orange-50",   text: "text-orange-600" },
  REVISION_REQUESTED:   { bg: "bg-red-50",      text: "text-red-600"    },
  RESUBMITTED:          { bg: "bg-purple-50",   text: "text-purple-600" },
  CONDITIONAL_APPROVAL: { bg: "bg-teal-50",     text: "text-teal-600"   },
  PUBLISHED:            { bg: "bg-green-50",    text: "text-green-700"  },
  CHECKING:             { bg: "bg-blue-50",     text: "text-blue-600"   },
  SUSPENDED:            { bg: "bg-red-100",     text: "text-red-700"    },
  RETIRED:              { bg: "bg-gray-200",    text: "text-gray-500"   },
};
