# AGENTS.md

This file provides guidance to Qoder (qoder.com) when working with code in this repository.

`wdm-admin` is the admin web console (管理端) of a wholesale platform: a Vue 3 + Vite + TypeScript + Naive UI SPA, one of four sibling apps under `../` (polyrepo; `wdm-backend` is the FastAPI backend).

## Build, Test, and Development Commands

- `npm run dev` — Vite dev server at `http://localhost:9021` (host `0.0.0.0`, no auto-open).
- `npm run build` — production bundle (no type-check; output to `dist/`).
- `npm run build:check` — `vue-tsc --noEmit` then build; run before merging.
- `npm run type-check` — type-check only. This is the main correctness gate; every change must pass it.
- `npm run preview` — serve the built bundle.

There is no test framework. For UI changes, run `npm run dev` and exercise the affected pages manually.

## High-Level Architecture

### Data flow: views → API facade → http client → (mock adapter | real backend)

The app has one HTTP entrypoint. Views import **only** from `@/api` (the facade in `src/api/index.ts`), which groups backend resources into typed objects (`productApi`, `orderApi`, `financeApi`, etc.). The facade calls the thin wrappers in `src/api/http.ts` (`get`/`post`/`put`/`del`), which wrap a single shared Axios instance.

Two things in `http.ts` are easy to miss:
1. **The response interceptor unwraps the `{code, message, data}` envelope** — the backend (`wdm-backend/app/core/response.py` middleware) wraps every `/api/v1` JSON response in `{code, message, data}` (`code: 200` on success; errors keep HTTP 4xx/5xx with `code` = HTTP status). The interceptor returns the inner `data` field, so facade methods receive the payload directly, never the envelope or an `AxiosResponse`. Typed wrappers (`get<T, T>`) enforce this at the call site. The mock adapter emits the same envelope (`buildResponse` in `adapter.ts`).
2. **Mock mode swaps the Axios adapter**, not the base URL. When `VITE_API_BASE_URL` is empty, `http.defaults.adapter` is replaced by `mockAdapter` (`src/api/mock/adapter.ts`), an in-memory router that pattern-matches method+path against `services.ts`/`services2.ts`. This means the entire app — interceptors, auth headers, error handling — runs identically in mock and real mode; only the transport differs. The default `baseURL` is `/api/v1`.

### Mock layer split

The mock backend is split into two parallel halves purely for file-size management, not by domain boundary:
- `services.ts` / `db.ts` — core resources: auth, products, customers, sales, orders, prices, finance, dashboard.
- `services2.ts` / `db2.ts` — secondary resources: categories, customer levels, SPU/SKU, audit logs.

Both are wired into the same route table in `adapter.ts`. To add an endpoint, update in order: `src/types/index.ts` → `src/api/index.ts` → `src/api/mock/adapter.ts` → `services.ts`/`services2.ts` → `db.ts`/`db2.ts`.

### Auth & routing

- `useAuthStore` (`stores/auth.ts`) persists tokens to `localStorage` under keys `wdm_admin_access` / `wdm_admin_refresh`. The request interceptor attaches `Authorization: Bearer <token>`; a `401` response triggers `auth.logout()` + redirect to `/login`. A `fetchMe` failure falls back to a default admin user so mock mode always works.
- `router.beforeEach` guards all non-`public` routes and sets `document.title`. The router nests page routes under layout-group parents (`/products`, `/customers`, …) that share `MainLayout.vue`.
- The sidebar `menuOptions` in `MainLayout.vue` is **hard-coded and separate** from the router table — keep both in sync when adding/removing routes.

### Types

`src/types/index.ts` holds all domain types in one flat file, kept aligned with `wdm-backend` Pydantic schemas. Domain enums (`OrderStatus`, `CustomerLevel`, `PriceStrategyType`, …) are defined as string-union types here and surfaced to the UI exclusively through label/color maps in `src/utils/dict.ts` — never inline Chinese labels in components.

### State

Pinia stores: `auth.ts` (tokens + user) and `app.ts` (sidebar collapse, persisted to `localStorage`). Most page state lives locally in the view component, not in a store.

## Coding Style & Naming Conventions

- TypeScript strict mode, 2-space indent; components use `<script setup lang="ts">`.
- Path alias `@` → `src`. Vue APIs (`ref`, `computed`, `watch`, …) and Naive UI composables (`useDialog`, `useMessage`, `useNotification`, `useLoadingBar`) are **auto-imported** via `unplugin-auto-import`; Naive UI components are auto-resolved via `NaiveUiResolver`. The generated `auto-imports.d.ts` and `components.d.ts` are gitignored — never hand-edit them; they regenerate on dev/build.
- Naming: pages `ProductListPage.vue`, stores `useAuthStore` in `stores/auth.ts`, API facade objects `productApi`/`orderApi`. Views import only from `@/api`.
- No linter/formatter is configured; match surrounding code style.

## Build Configuration Notes

- Manual chunks split `naive-ui`, `echarts`/`vue-echarts`, and `vue`/`vue-router`/`pinia` into separate vendor bundles.
- The dev server proxies `/api` → `VITE_API_PROXY_TARGET` when that env var is set (for pointing at a live FastAPI backend while keeping the frontend on 9021).
- The theme primary color is red (`#dc2626`), configured globally in `App.vue` via `n-config-provider` theme overrides.

## Environment

The app runs on the in-memory mock backend by default. Set `VITE_API_BASE_URL` (in `.env`, or override via gitignored `.env.local`) to hit a real backend; leaving it empty enables mock mode. See `.env` for all available variables (`VITE_API_BASE_URL`, `VITE_API_PROXY_TARGET`, `VITE_APP_TITLE`).

## Commit & Pull Request Guidelines

- Commits follow `type: summary`, e.g. `init: wdm-admin (Vue 3 + Vite + Naive UI)`. Keep subjects short and imperative.
- PRs: describe the change and linked issue, include screenshots for UI changes, and confirm `npm run build:check` passes.

## Agent-Specific Notes

- Price isolation is the core invariant: prices resolve server-side by customer/level; never filter or recompute prices in the frontend.

## API-First UI Workflow

- Before adding or modifying any page/UI, first check Apifox for the corresponding interface (path, method, request body, response fields).
- If the interface exists, constrain the UI, types, and API facade strictly to the Apifox fields; do not invent extra fields.
- If the interface does not exist in Apifox, do not silently mock or guess the contract. Stop and tell the user which interface/path is missing so they can add it first.
