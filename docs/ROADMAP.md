# MoneyMind AI — Implementation Roadmap

**Current status:** Phase 3 complete · Phase 4 next  
**Companion document:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) — the binding design contract.

Each phase is a runnable, deployable increment. A phase is done only when its exit criteria pass
in CI and the previous phase's tests still pass. Nothing is marked complete because the code
"looks done".

---

## Status at a glance

| Phase | Name | Status | Exit gate |
| --- | --- | --- | --- |
| 1 | Foundation | ✅ Complete | Format, lint, types, tests and build pass; landing + dashboard preview; live health API |
| 2 | Authentication + Database | ✅ Complete | Register/login/refresh/logout against Postgres; session isolation tests; protected routes |
| 3 | Core Finance | ✅ Complete | Transaction/category/budget/goal CRUD, dashboard and analytics; workspace isolation + invariant tests |
| 4 | AI / LLM | ⏳ Next | Grounded streaming chat with typed tools and quotas |
| 5 | RAG + Vector DB | Planned | Upload → parse → embed → hybrid search with citations; tenant isolation proven |
| 6 | AI Copilot | Planned | Multi-step agent tasks with confirmation gates and audit trail |
| 7 | Premium UI + 3D | Planned | Motion/a11y/performance budgets met; optional 3D behind a flag |
| 8 | Testing + Security | Planned | E2E, AI evals, load and security audits signed off |
| 9 | Deployment | Planned | CI/CD, monitoring, backups and a completed restore drill |

---

## Working agreements

- **One phase, one contract.** A phase may add UI for what the API already supports; it may not
  build UI against an imagined endpoint.
- **Money is integer minor units** everywhere. Floats are rejected in review.
- **Every query is workspace-scoped.** An endpoint without an IDOR test is not done.
- **AI cannot bypass authorization.** Tools receive the authenticated principal server-side.
- **No fake auth, no fake data in production paths.** Empty states are explicit about gating.
- **Docs move with code.** Schema, endpoint or threat-model changes update `ARCHITECTURE.md` in the
  same PR.
- **A bug fix ships with a regression test.**

---

## Phase 1 — Foundation ✅

### Delivered

- [x] npm-workspaces monorepo (`apps/api`, `apps/web`, `packages/shared`) with strict TypeScript.
- [x] Shared Zod contracts, app constants, exact money helpers (13 tests).
- [x] Express 5 app factory: request IDs, pino logs, Helmet, CORS allowlist, compression, body
      limits, rate limiting, `/api/v1/health`, `/api/v1/meta`, 404/error envelope, graceful
      shutdown (11 tests).
- [x] React 19 + Vite 8 + Tailwind 4 SPA: landing page, dashboard shell, theme system,
      reduced-motion-aware animation, loading/empty/error states, live API status card, login
      phase notice, 404, error boundary (6 tests).
- [x] shadcn-style primitives (button, card, badge, input, skeleton, separator) and design tokens.
- [x] Dockerfiles (API + Nginx web), Compose with Postgres/Qdrant, CI quality + Docker jobs.
- [x] ESLint, Prettier, Vitest, coverage configuration, VS Code settings.
- [x] `ARCHITECTURE.md`, this roadmap, README.
- [x] Verified locally: format check, lint, typecheck, 30 tests, production build.
- [x] Docker images defined; **not built locally** (Docker unavailable in the dev environment),
      built by CI.

### Deliberately absent

Authentication, database, transactions, budgets, goals, analytics, AI, RAG, uploads, search,
and any real financial data.

---

## Phase 2 — Authentication + Database ✅

**Goal:** A real account system backed by PostgreSQL, with secure sessions and protected app
routes. A user can register, sign in, refresh, sign out and reach an empty workspace that belongs
only to them.

### 2.1 Database foundation

- [x] Prisma 6.19 pinned in `apps/api`; schema at `apps/api/prisma/schema.prisma`.
- [x] Models for Phase 2: `User`, `Workspace`, `Membership`, `Session` (enum `WorkspaceRole`).
      Verification tokens were deferred with email verification.
- [x] UUIDv7 primary keys (database default `uuid(7)`), `timestamptz(3)` timestamps, snake_case
      table/column mappings and indexes on session lookup and membership scope.
- [x] Initial migration `20261025180940_init`; `migrate dev` locally, `migrate deploy` in CI and
      the Compose migration job.
- [x] `DATABASE_URL` in validated env; startup checks the connection and fails fast when missing.
- [x] `GET /api/v1/ready` runs `SELECT 1` and returns `503` with `checks.database = "down"`.
- [x] One Prisma client per process, disconnected during graceful shutdown.

### 2.2 Password and token primitives

- [x] Argon2id hashing via `@node-rs/argon2` with 64 MiB memory, `t=3`, `p=1`.
- [x] Password policy: 12–128 characters; shared Zod schema enforced on client and server.
- [x] Access JWT: 15 minutes, `sub`, `sid`, `jti`, `iat`, `exp`, HS256, independent env secret.
- [x] Refresh token: 48 random bytes, HMAC-SHA256 hash at rest, rotation on every refresh.
- [x] Refresh cookie: `HttpOnly`, `SameSite=Strict`, `Secure` in production,
      `Path=/api/v1/auth`, 30-day max age.
- [x] Reuse detection revokes every session for the user; failed refresh clears the cookie.
- [x] Dummy-hash verification for unknown accounts to reduce timing differences; no tokens or
      password hashes in logs or responses.

### 2.3 Auth API

- [x] `POST /auth/register` — lowercase email, user + personal workspace + OWNER membership +
      session in one transaction.
- [x] `POST /auth/login` — verify credentials, issue access + refresh session.
- [x] `POST /auth/refresh` — rotate token, revoke predecessor, detect reuse and revoke all.
- [x] `POST /auth/logout` — revoke the current session and clear the cookie (idempotent).
- [x] `POST /auth/logout-all` — revoke every session for the user.
- [x] `GET /auth/me` — user, active workspace and current session; no password hash.
- [x] `PATCH /auth/me` — display name, IANA time zone and locale.
- [x] `GET /auth/sessions` and `DELETE /auth/sessions/:sessionId` — list and revoke owned
      sessions; foreign session IDs return `404`.
- [x] Shared Zod request/response schemas in `packages/shared` (no duplicated client types).
- [x] Auth rate limiting (default 20 requests per 15 minutes, successful logins skip the counter)
      and uniform `INVALID_CREDENTIALS` responses.

### 2.4 Authorization layer

- [x] `requireAuth` middleware: parse bearer token, verify signature/expiry and session state,
      attach principal.
- [x] Revoked sessions are rejected immediately by `/auth/me` and session routes even while their
      access token would still be time-valid.
- [x] IDOR test: another user's session cannot be listed or revoked.
- [ ] `requireWorkspace` middleware and full role policy are deferred to Phase 3, when the first
      workspace-scoped finance resources exist.

### 2.5 Web auth experience

- [x] Real login and register forms with React Hook Form + shared Zod schemas.
- [x] In-memory access token; silent refresh on boot and once on 401; no token in `localStorage`.
- [x] Refresh calls are single-flight inside a tab and serialized across tabs with Web Locks.
- [x] `ProtectedRoute` and `PublicOnlyRoute` with an explicit loading state; the intended
      destination is preserved and validated against open redirects.
- [x] Sign-out clears the query cache, in-memory token and session state.
- [x] `/login`, `/register` and `/profile` pages with loading, error, success and validation
      states; accessible labels and live error announcements.
- [x] Dashboard and shared shell show the real user, workspace name, role and currency.
- [x] Profile page lists active sessions, flags the current device and supports revoking others or
      signing out everywhere.
- [x] Onboarding creates a workspace name (defaults to the user's name); base currency starts at
      `USD` and is editable in Phase 3.

### 2.6 Tests and exit criteria

- [x] Dedicated `moneymind_test` PostgreSQL database, migrations applied once, tables truncated
      between test files, serial file execution. Testcontainers were not used because Docker is
      unavailable in this environment.
- [x] Integration: register → login → refresh → reuse detection → logout.
- [x] Integration: duplicate email, validation failures, unknown fields, wrong password, missing,
      malformed and tampered tokens, revoked sessions and cross-user session access.
- [x] Web tests for the shared shell; auth UI is covered by typecheck and the API contract tests.
- [x] **Exit:** format, lint, typecheck, 62 tests and production builds pass; no route returns
      another user's session; required secrets and env values are documented in
      `apps/api/.env.example` and the README.
- [ ] Playwright sign-up → dashboard → sign-out smoke test remains for Phase 8.

### Phase 2 non-goals (deferred, not forgotten)

- [ ] Email verification and password reset endpoints/pages.
- [ ] Breach-list password screening and audit-log persistence.
- [ ] MFA/passkeys and OAuth.
- [ ] Multiple workspaces in the UI and a base-currency onboarding selector.
- [ ] Session-expiry toast (expired sessions currently redirect to `/login` after refresh fails).

---

## Phase 3 — Core Finance ✅

**Goal:** The product becomes useful: categories, transactions, budgets, goals, dashboard and
deterministic analytics over a single workspace currency.

**Delivered**

- [x] Workspace-scoped finance API under `/api/v1/finance` with `requireAuth` +
      `requireActiveSession`; every query filters by `workspaceId`.
- [x] Categories: lazy seeding of starter categories, custom create/rename/recolour/icon,
      case-insensitive uniqueness, system-category delete protection, in-use delete protection.
- [x] Transactions: CRUD, search over description/merchant/notes/category, filters for type,
      category and inclusive date range, ordering and offset pagination with filtered totals.
- [x] Invariants enforced in service + database: positive `amountMinor` (`BIGINT` minor units),
      category/type compatibility, category/workspace match, `YYYY-MM` budget months.
- [x] Budgets: one envelope per expense category per month, live spend/remaining/progress and
      `ON_TRACK` / `NEAR_LIMIT` / `OVER` status.
- [x] Goals: active/archived lifecycle, contributions as the only progress source, history and
      delete, derived saved/remaining/progress never stored.
- [x] Dashboard: month totals, net balance, savings rate, deltas vs. previous month, 6-month cash
      flow, category donut, budget/goal summaries, recent transactions and system status.
- [x] Analytics: month totals, savings rate, 3–24 month trend, category breakdown with shares and
      top merchants, all computed from workspace-scoped ranges in the user's IANA time zone.
- [x] Web: live dashboard, transactions, categories, budgets, goals and analytics pages with
      shared dialogs, Zod-backed forms, skeletons, empty states, retryable errors and responsive
      SVG/CSS charts (no chart dependency).
- [x] Integration tests for CRUD, filters, invariants and cross-workspace isolation; shared
      money/date/schema unit tests.

**Deferred to later phases**

- [ ] Accounts, opening balances, transfers and net worth.
- [ ] CSV import, `ImportBatch`, idempotency keys and partial-failure reporting.
- [ ] Audit-log persistence for finance mutations.
- [ ] FX conversion / multi-currency workspaces.
- [ ] URL-synced filters, bulk actions and optimistic mutations.

### 3.5 Exit criteria

- [x] Ledger invariants covered by integration tests (positivity, category/type, workspace match).
- [x] Analytics match fixtures exactly in minor units with no float arithmetic.
- [x] Every finance endpoint is workspace-scoped and covered by an IDOR-style test.
- [x] All finance views have loading, empty, error and success states.
- [ ] CSV import is idempotent and reports failures row-by-row (deferred with CSV import).

---

## Phase 4 — AI / LLM ⏳

**Goal:** Grounded, streaming chat over the user's ledger using typed, read-only tools.

- [ ] Provider abstraction: `ChatModel` and `EmbeddingModel` interfaces; OpenAI first adapter,
      second provider proven by contract tests, optional local/Ollama adapter.
- [ ] Model config: provider, model, temperature, max tokens, fallback, per-request deadline.
- [ ] Prompt registry with versioned system prompts and policy (data is not instruction).
- [ ] Tool registry with Zod schemas: `get_cash_flow`, `list_transactions`,
      `get_budget_status`, `get_goal_progress`, `explain_metric`.
- [ ] Deterministic metrics computed in SQL/TS and injected as facts; model never does arithmetic.
- [ ] Agent loop with max 5 tool iterations, cancellation and clear failure messages.
- [ ] SSE streaming contract per `ARCHITECTURE.md` §5.4; heartbeat; abort handling.
- [ ] Threads/messages persistence, titles, rolling summary, bounded context.
- [ ] Chat UI: streaming markdown, collapsible tool trace, stop generation, retry, empty and
      error states, keyboard-accessible composer.
- [ ] Deterministic insight generation (spending shifts, budget risk, anomalies) with LLM
      narration validated by schema; dismiss/seen states.
- [ ] Quotas and budgets per user/workspace; token/cost logging without prompt content.
- [ ] Eval harness v1: groundedness, tool schema validity, refusal correctness, latency.
- [ ] **Exit:** questions answer from real ledger data with traceable numbers; no tool can exceed
      the caller's workspace; quotas enforced.

---

## Phase 5 — RAG + Vector DB 📋

**Goal:** Users can upload financial documents and ask questions answered with page-level
citations.

- [ ] Object storage abstraction; 10 MB upload limit; magic-byte allowlist (PDF, DOCX, CSV, TXT).
- [ ] Checksum dedupe, `Document`/`DocumentChunk` models, ingestion status lifecycle.
- [ ] BullMQ + Redis worker: malware scan hook, sandboxed parsing, table-aware extraction,
      sentence-aware chunking (500–800 tokens, 15% overlap).
- [ ] Dense + sparse embeddings, versioned collection names, payload indexes.
- [ ] Qdrant upsert/delete with mandatory `workspaceId` filter; orphan cleanup on delete/reprocess.
- [ ] Hybrid retrieval: dense + sparse, reciprocal rank fusion, rerank, dedupe, max 8 chunks.
- [ ] Prompt-injection defenses: delimited untrusted evidence, sanitized output, no raw HTML.
- [ ] Citations rendered inline and linked to document/page; citation coverage checked.
- [ ] Search UI: query, filters, results with snippets, document status and retry.
- [ ] Ingestion progress UI with failure reasons and reprocess action.
- [ ] Tests: tenant isolation in retrieval, deletion removes vectors, parser fixtures, RRF ranking.
- [ ] **Exit:** cross-tenant retrieval is impossible by test; every answer's citations resolve to
      supplied chunks.

---

## Phase 6 — AI Copilot 📋

**Goal:** Multi-step, proactive assistance with safe writes.

- [ ] Write tools: `create_transaction`, `update_budget`, `create_goal` — Zod-validated, scoped
      server-side.
- [ ] Confirmation cards that show the exact diff before execution; decline leaves no trace.
- [ ] Approval tokens bound to the principal, single-use, short TTL; audit every decision.
- [ ] Agent planning: decompose requests, show step progress, recover from tool errors.
- [ ] Proactive insights feed: weekly digest, budget risk, unusual spend, goal pace — all
      deterministic metrics, LLM narration only.
- [ ] Feedback capture (helpful/dismiss) stored for evaluation, never auto-tuning prompts.
- [ ] Cost controls: per-workspace monthly quota, spend alarms, graceful `AI_BUDGET_EXCEEDED`.
- [ ] **Exit:** a write requested in chat cannot execute without explicit UI confirmation;
      audit trail reconstructs actor, arguments and outcome.

---

## Phase 7 — Premium UI + 3D 📋

- [ ] Motion polish across navigation, lists, charts and chat; consistent easing/durations.
- [ ] Optional R3F scene on the landing hero and/or goal detail: lazy, DPR-capped, paused
      offscreen, static poster fallback, disabled with reduced motion or low-end devices.
- [ ] Responsive pass at 320/768/1024/1440 px; drawer focus trap and scroll lock verified.
- [ ] Accessibility: axe clean, keyboard-only journeys, focus states, live regions, chart tables.
- [ ] Performance: route-level code splitting, image/font optimization, Lighthouse budgets.
- [ ] Visual regression baselines for landing, dashboard, transactions, chat and documents.
- [ ] **Exit:** LCP < 2.5 s p75, CLS < 0.1, INP < 200 ms; a11y ≥ 95; WebGL absence changes
      nothing functional.

---

## Phase 8 — Testing + Security 📋

- [ ] Playwright suite for all critical journeys on seeded data; mobile viewport pass.
- [ ] API coverage ≥ 80% lines; web ≥ 70%; coverage gates in CI.
- [ ] Security: OWASP ZAP baseline, authorization matrix review, dependency/container scanning,
      secret scanning, SBOM.
- [ ] AI evals: prompt injection, citation precision, refusal correctness, tool misuse,
      cost/latency thresholds.
- [ ] Load tests: health, login, transaction list, analytics, mocked AI streaming.
- [ ] Abuse controls validated: rate limits, body limits, upload rejection, quota exhaustion.
- [ ] **Exit:** signed checklist, no high/critical findings open, evals meet agreed thresholds.

---

## Phase 9 — Deployment 📋

- [ ] Environment provisioning (web CDN, API containers, managed Postgres, Qdrant, Redis, storage).
- [ ] CI/CD: immutable images by commit SHA, expand/contract migrations, staged rollout, rollback.
- [ ] Observability: logs, metrics, traces, error tracking, dashboards and alerts per SLO.
- [ ] Backups: PITR, Qdrant snapshots, object lifecycle; **restore drill completed**.
- [ ] Runbooks: rollback, rotate secrets, revoke sessions, restore DB, re-index Qdrant, pause AI.
- [ ] Privacy/ops: data export, account deletion propagation, retention jobs, provider disclosure.
- [ ] **Exit:** production deployment monitored for 7 days; RPO ≤ 24 h / RTO ≤ 4 h verified.

---

## Cross-cutting backlog

- [ ] Dependency update automation (Renovate/Dependabot) and a documented major-upgrade process.
- [ ] Design-token documentation and component gallery.
- [ ] i18n scaffolding (copy externalized, `Intl` formatting already currency-aware).
- [ ] PWA/offline read-only cache (only after data layer stabilizes).
- [ ] Public API tokens and webhooks (only with a real integration use case).
- [ ] MFA/passkeys and OAuth (schema-ready after Phase 2, prioritized by user demand).

---

## Phase 2 first-day checklist

1. Add Prisma + `@prisma/client` to `apps/api`; create `schema.prisma` with the five Phase 2
   models.
2. Generate the initial migration; inspect the SQL; commit it.
3. Extend `apps/api/src/config/env.ts` with `DATABASE_URL`, JWT secrets and token TTLs; update
   `.env.example`.
4. Implement password/token primitives with tests before any route.
5. Build `auth` and `workspaces` modules; mount under `/api/v1`.
6. Add `authenticate`/`requireWorkspace` middleware and an IDOR test helper.
7. Wire the web session provider and real login/register pages.
8. Turn the dashboard preview banner into a real onboarding state.
