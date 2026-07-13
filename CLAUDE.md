# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

DAOU AX Platform Prototype — a client-only React/Vite demo of an internal "AI Asset Hub" (사내 AI 자산 관리 플랫폼). It was generated/edited via Figma Make and has no backend: all data lives in a single in-memory dataset and a React Context reducer. Design target is desktop, 1920×1080 (min supported width 1440px).

## Commands

- `npm i` — install dependencies
- `npm run dev` — start Vite dev server
- `npm run build` — production build (`vite build`)

There is no lint script, no test runner, and no `tsconfig.json` in the repo — type checking happens implicitly through the editor/Vite's esbuild transform only, not as a separate CI-able step. Do not assume `npm run lint` or `npm test` exist.

## Architecture

### Entry & shell

- `src/main.tsx` mounts `src/app/App.tsx`.
- `App.tsx` contains almost the entire app shell: header, role switcher, collapsible sidebar nav, and a big `switch`-like conditional in `AppShell` that renders one screen component based on `activeMenu` state. There is no router — navigation is plain `useState` (`activeMenu`, `detailAssetId`) lifted in `AppShell`, passed down via props/callbacks (`onNavigate`, `onOpenDetail`, `onBack`).
- **Role-based visibility is a demo affordance, not auth.** `role` (`"user" | "registrant" | "operator"`) is a `useState` in `AppShell` switched via a dropdown in the header — anyone can flip roles. `ROLE_VISIBLE_SECTIONS` filters which sidebar sections show per role; screens themselves don't re-check role.
- Sidebar sections: **Governance** (operator-only screens), **Dashboard** (`usage-overview`, `cost-license` — not implemented, fall through to a generic `PlaceholderScreen`), **Playground** (user/registrant-facing), and a `devOnly` **개발자 도구** section exposing `DataCheckScreen` (defined inline at the bottom of `App.tsx`) for inspecting the raw asset dataset/aggregates.

### Data model — the core abstraction

- `src/data/types.ts` defines the single shared `AIAsset` shape used across every screen (asset type/status/review-path enums, cost/usage/review sub-objects, Korean UI label maps, and status→badge-color maps). Read this file first when touching any asset-related screen.
- `src/data/assets.ts` holds `INITIAL_ASSETS`: 12 hardcoded sample `AIAsset` objects covering all `AssetType` values (PROMPT/ASSISTANT/AUTOMATION/APP incl. CLIENT_APP & BACKEND_APP subtypes/MCP/OTHER) and various `AssetStatus`/`ReviewPath` combinations. This is the only data source — there is no API layer, and screens must not hardcode per-asset content; they derive everything from this shared dataset.
- `src/data/store.ts` is a pure-function query/update layer over `AIAsset[]` (`getCatalogAssets`, `getFeaturedAssets`, `getReviewPendingAssets`, `countByType`, `applyStatusUpdate`, etc.). These are used both for read-side filtering and as the immutable-update helpers called from the reducer.
- `src/context/AssetContext.tsx` wraps `INITIAL_ASSETS` in a `useReducer`-based `AssetProvider`/`useAssets()` hook — the single source of truth for asset state across the whole app (status transitions, favorites, catalog visibility, usage counts, revision notes, approval conditions, "checking"/error-report info, and a `DEMO_RESET` action that resets `asset-005` for repeatable demos). Any screen that mutates asset state must go through `dispatch`, not local copies.

### Screens (`src/components/`)

Each top-level nav item maps to one screen component, all reading/writing through `useAssets()`:

- `PlaygroundScreen` — main catalog/browse view for the "user" role (search, type filter, featured assets); opens `AssetDetailScreen` via `onOpenDetail`.
- `AssetDetailScreen` — full-page asset detail; content sections branch dynamically by `assetType`/`subtype` (prompt text, assistant links, automation steps, app I/O, MCP tool description, etc.) per the spec in `src/imports/pasted_text/ai-platform-layout-update.md`. Never shows internal review fields (`review.stage`, `review.reasons`, `policyVersion`) to end users.
- `MyToolsScreen` — recent/favorite/all tools view for a user.
- `MyAssetsScreen` — registrant's own assets + submission tracking timeline (`TRACKING_STEPS` mapped from `AssetStatus`).
- `AssetRegisterScreen` — multi-step registration wizard incl. a self-diagnosis questionnaire (`src/data/diagQuestions.ts`) that determines a simulated `ReviewPath` outcome.
- `PlaygroundGuideScreen` — static help/guide content, no shared state.
- `GovernanceScreen` — operator queue of assets pending review (`getReviewPendingAssets`), filterable by review path.
- `PolicyManagementScreen` — read-only simulation of policy rules (`POLICIES[]`, each with a `matches(asset)` predicate) against current asset data; not persisted/editable.
- `ReReviewScreen` — operator flow for assets reported as broken (`status === "CHECKING"`), resolving to `PUBLISHED`/`SUSPENDED` via `dispatch`.

Sidebar items `review-history`, `usage-overview`, and `cost-license` are **not implemented** — they render the generic `PlaceholderScreen` in `App.tsx`.

### UI kit & styling

- `src/app/components/ui/*` is a shadcn/ui-derived component set (Radix primitives + `class-variance-authority` + Tailwind) — treat as vendored library code, follow existing patterns rather than hand-rolling new primitives.
- Tailwind v4 is configured via the Vite plugin (`@tailwindcss/vite`) — no `tailwind.config.js`; theme tokens live in `src/styles/theme.css`/`globals.css`. Korean is the primary UI language; do not introduce English section headers (an explicit constraint carried over from the design spec).
- `vite.config.ts` defines a custom `figma-asset-resolver` plugin resolving `figma:asset/*` imports to `src/assets/` — required because some vendored components import Figma-exported images this way. The React/Tailwind Vite plugins must not be removed even if Tailwind looks unused, per the comment in that file.

## Notes for future work

- `src/imports/pasted_text/` contains the original Korean feature-spec prompts (e.g. `ai-platform-layout-update.md`, `ai-asset-data-structure.json`) that drove past generations — check there for intent/rationale before redesigning a screen or the data shape.
- Explicitly out of scope per the last spec pass: real backend/Supabase, real SSO, real external API calls, and persisted registration/review data — actions like "복사하기"/"바로 접속"/error reports are simulated with `sonner` toasts and local state only.
