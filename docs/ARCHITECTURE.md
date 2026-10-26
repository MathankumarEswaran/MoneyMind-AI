# MoneyMind AI — Architecture & Implementation Plan

**Status:** Phase 3 implemented (core finance) · Phase 4 next  
**Version:** 0.1.0  
**Last updated:** 2026-10-26

This document is the engineering contract for MoneyMind AI. It covers the full target
architecture, not only what exists today. Sections explicitly separate **live today** from
**planned** so the codebase never overstates its capabilities. As of Phase 3, identity,
tenancy, session and core finance models plus the auth and finance APIs and the protected web
routes are live; accounts, transfers, AI and RAG models below remain design targets.

---

## Table of contents

1. [System architecture](#1-system-architecture)
2. [Technology decisions](#2-technology-decisions)
3. [Folder structure](#3-folder-structure)
4. [Database design](#4-database-design)
5. [API design](#5-api-design)
6. [AI / RAG architecture](#6-ai--rag-architecture)
7. [UI and page structure](#7-ui-and-page-structure)
8. [Development phases](#8-development-phases)
9. [Security considerations](#9-security-considerations)
10. [Testing strategy](#10-testing-strategy)
11. [Observability and operations](#11-observability-and-operations)
12. [Deployment](#12-deployment)
13. [Architecture decision records](#13-architecture-decision-records)

---

## 1. System architecture

### 1.1 Guiding principles

1. **Modular monolith first.** One deployable API with hard internal boundaries. Split only when
   a measured bottleneck or team boundary justifies it.
2. **Contracts at the edges.** One Zod schema package defines every HTTP payload, AI tool
   argument and environment variable. The client validates responses; the server validates
   requests.
3. **Money is never a float.** Amounts are integer minor units (`1234` = `$12.34`) represented
   as PostgreSQL `BIGINT` and decimal strings on the wire.
4. **Secure by construction.** Deny by default, scope every query by workspace, never trust a
   client-supplied owner ID.
5. **AI is grounded and auditable.** Retrieval precedes generation. Tools are typed. Writes need
   explicit confirmation. Every answer can point to its evidence.
6. **Every phase ends runnable.** No half-migrated states, no placeholder auth that accepts
   credentials, no dead endpoints presented as live.
7. **Progressive enhancement.** The app works without WebGL. Motion and 3D respect
   `prefers-reduced-motion` and never block content.

### 1.2 Context diagram

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Browser (SPA)                                  │
│  React 19 · Vite · TypeScript · Tailwind 4 · shadcn-style UI · TanStack      │
│  Query · Framer Motion · Recharts · React Three Fiber (Phase 7 only)        │
└───────────────┬─────────────────────────────────────────────┬───────────────┘
                │ HTTPS /api/v1 (JSON, SSE)                    │ static assets
                ▼                                             ▼
┌──────────────────────────────────────┐        ┌───────────────────────────┐
│              API (Express 5)         │        │  Static host / CDN / Nginx │
│                                      │        │  CSP + immutable assets   │
│  middleware: request-id, pino,       │        └───────────────────────────┘
│  helmet, CORS, rate-limit, Zod       │
│                                      │
│  modules: auth · users · workspaces  │
│  accounts · categories · transactions│
│  budgets · goals · analytics         │
│  documents · search · ai · insights  │
│                                      │
│  services: auth, ledger, budgets,    │
│  analytics, ingestion, retrieval,    │
│  agent, insights, jobs               │
└──────┬──────────────┬──────────────┬─┘
       │              │              │
       ▼              ▼              ▼
┌────────────┐  ┌────────────┐  ┌──────────────────────────────┐
│ PostgreSQL │  │   Qdrant   │  │ Object storage (S3-compatible)│
│ Prisma     │  │ dense +    │  │ original documents, short-   │
│ ledger,    │  │ sparse     │  │ lived signed URLs            │
│ auth, chat │  │ vectors    │  └──────────────────────────────┘
└────────────┘  └────────────┘
       │              ▲
       │              │
       ▼              │
┌────────────────────────────────────────────────────────────────┐
│ Redis + BullMQ (Phase 5)  — ingestion, embeddings, insights,   │
│ scheduled reports, retries with exponential backoff             │
└────────────────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────────────┐
│ LLM provider abstraction (Phase 4)                             │
│ OpenAI · Anthropic · local/Ollama — chat, embeddings, streaming │
└────────────────────────────────────────────────────────────────┘
```

### 1.3 Runtime topology

| Environment | Web | API | PostgreSQL | Qdrant | Notes |
| --- | --- | --- | --- | --- | --- |
| Local | Vite `:5173` proxy `/api` | tsx `:4000` | Docker or local `:5432` | Docker `:6333` | PostgreSQL required for auth; Qdrant unused until Phase 5 |
| CI | Build only | Vitest + supertest | PostgreSQL 16 service container | Testcontainers (Phase 5) | Ephemeral, migrated with `prisma migrate deploy` |
| Preview | Static preview per PR | Ephemeral API | Branch database | Shared dev instance with prefixed collections | Synthetic data only |
| Production | CDN/static host | Container | Managed Postgres | Qdrant Cloud / managed | Private networking, backups |

### 1.4 Dependency rules

- `apps/api` and `apps/web` may import `@moneymind/shared`.
- `packages/shared` imports **nothing** from the apps and stays runtime-neutral (no Node or DOM
  APIs).
- Feature modules inside the API never import another feature's repository. Cross-feature work
  goes through a service interface.
- Only `infrastructure/` touches Prisma, Qdrant, S3, Redis or LLM SDKs. Domain services accept
  typed ports.
- The web client never imports server code. API types come from shared schemas.
- No barrel files inside feature modules beyond a single public `index.ts` per module.

### 1.5 Request lifecycle

```text
HTTP request
  → request-id (accept safe client ID or generate UUID)
  → pino-http (structured log, redaction)
  → helmet (headers)
  → CORS allowlist
  → body parser with size limit
  → rate limiter (tighter limits for auth/AI)
  → versioned router (/api/v1)
  → authentication (verify access JWT, load session state)
  → workspace authorization (finance resources resolve context from membership)
  → Zod validation (params, query, body)
  → service (domain rules, transactions)
  → repository (Prisma; finance queries scoped by workspaceId)
  → response envelope { data } or { error }
  → error boundary (mapped status/code, requestId, no stack in prod)
```

### 1.6 Live today (through Phase 3)

- npm-workspaces monorepo with strict TypeScript, ESLint, Prettier, Vitest.
- React SPA with landing page, authenticated shell, theme system, motion and loading/empty/error
  states.
- Express 5 API with `/api/v1/health`, `/api/v1/ready`, `/api/v1/meta`, the full auth surface and
  workspace-scoped finance routes under `/api/v1/finance`.
- PostgreSQL 16 with committed Prisma migrations for `User`, `Workspace`, `Membership`,
  `Session`, `Category`, `Transaction`, `Budget`, `Goal` and `GoalContribution`; UUIDv7 keys and
  `timestamptz(3)` throughout.
- Argon2id credentials, 15-minute HS256 access tokens, opaque rotating refresh cookies, reuse
  detection that revokes every session, and auth-specific rate limits.
- Protected SPA routes with a session bootstrap, profile editing, session listing/revocation and
  sign-out everywhere.
- Core finance: transaction CRUD with search/filter/pagination, sticky custom categories, monthly
  per-category budgets, savings goals with contributions, dashboard aggregates and analytics.
- Security baseline: Helmet, CORS allowlist, rate limiting, request IDs, body limits, redacted
  logs, graceful shutdown.
- Shared Zod contracts (auth, health, meta, money, finance, dates) used by both the API and the
  web forms.
- Dockerfiles, Compose stack with a migration job, CI workflow with a PostgreSQL service, and
  architecture/roadmap documentation.

**Not live:** accounts, transfers, CSV import, net worth, FX, AI, RAG, uploads, email verification,
password reset, MFA and audit-log persistence. Navigation labels these as phase-gated.

---

## 2. Technology decisions

### 2.1 Decision table

| Area | Decision | Rationale | Trade-off / alternative |
| --- | --- | --- | --- |
| Repository | npm workspaces monorepo | Native to the installed toolchain; simple; no extra binary; shared contracts | pnpm is faster but adds a bootstrap dependency; migrate later if needed |
| Language | TypeScript 5.9, strict | One language across the stack, strong contracts | Requires discipline at runtime boundaries; Zod covers that |
| Web | React 19 + Vite 8 | Fast HMR, small config, mature ecosystem | Next.js would add SSR but this app is authenticated-first and SPA-friendly |
| Styling | Tailwind CSS 4 + design tokens | Token-driven theming, fast iteration, small CSS | Utility density; component primitives keep markup sane |
| UI system | shadcn/ui pattern (owned code) | Accessible primitives, full control, no version lock-in | Not a dependency; upgrades are manual |
| Motion | Framer Motion | Declarative, reduced-motion aware, layout animations | Adds JS; keep to meaningful transitions and lazy 3D |
| 3D | React Three Fiber, Phase 7 | Only where it improves comprehension or delight | Strict performance/motion budgets; static fallback |
| Charts | Hand-built SVG + CSS (no chart dependency) | Full control of tokens, responsive, tiny bundle | More code for axes/tooltips; revisit Recharts only if complexity grows |
| Server | Express 5 | Ubiquitous, stable middleware ecosystem, easy hiring | Fastify is faster; Express is sufficient at this scale |
| Validation | Zod 4 | Runtime + static types, shared client/server | Bundle cost on web is small |
| Database | PostgreSQL 16 | ACID ledger, constraints, analytics SQL, mature ops | Managed cost; no NoSQL shortcuts for money |
| ORM | Prisma | Type-safe schema/migrations, good DX | Complex analytics fall back to typed `$queryRaw` |
| Auth | Short-lived JWT access + opaque rotating refresh cookie | Stateless reads, revocable sessions | More moving parts than server sessions; documented below |
| Password hashing | Argon2id | Memory-hard, current best practice | Native dependency; verify container builds |
| Vector DB | Qdrant | Dense + sparse hybrid search, payload filters, self-host or cloud | Operational overhead; Phase 5 only |
| Embeddings | Provider abstraction + versioned collections | Avoid lock-in and silent model drift | Re-embedding job required on model change |
| Queue | BullMQ + Redis, Phase 5 | Retries, backoff, scheduled jobs, ingestion isolation | Another service; not needed before ingestion exists |
| Object storage | S3-compatible, Phase 5 | Durable originals, signed URLs | Local disk only in dev with explicit warning |
| API style | REST + SSE for streaming | Predictable caching/authorization, simple debugging | GraphQL is unnecessary for this surface |
| Testing | Vitest + Testing Library + supertest against real PostgreSQL; Playwright Phase 8; Testcontainers Phase 5 | Fast feedback plus real integration | Database-backed tests need a running Postgres; run serially in CI |
| Containers | Multi-stage Docker + Nginx | Reproducible, small runtime images, CSP at edge | Compose is for local/VPS; managed services in production |
| CI | GitHub Actions | Native, matrix builds, Docker cache | Vendor choice can change; scripts are portable |

### 2.2 Key contract: money

- Storage: PostgreSQL `BIGINT` (`amountMinor`).
- API: decimal **string** (`"123456"`) to avoid JSON precision loss.
- Display: `Intl.NumberFormat` with currency-aware fraction digits (USD 2, JPY 0, KWD 3).
- Calculations: integer/BigInt only. Parsing from user input rounds half away from zero.
- Reporting: convert to workspace base currency using a stored, timestamped FX rate; never
  re-derive historical rates silently.

### 2.3 Why a modular monolith

- The domain is cohesive: users, workspaces, transactions, budgets, goals, documents, chat.
- Transactional consistency between ledger rows, audit logs and insights is easier.
- One deploy, one observability stack, one migration path.
- Boundaries are prepared for extraction (queues, AI worker, ingestion worker) when load
  justifies it.

### 2.4 Version policy

- Node `>=22`, npm `>=10`.
- TypeScript pinned to `5.9.x` for ecosystem stability; revisit after the Express/React type
  ecosystem validates TypeScript 6.
- Dependencies use caret ranges with a committed lockfile; CI runs `npm ci`.
- Major upgrades happen in dedicated PRs with a full test run and changelog note.

---

## 3. Folder structure

### 3.1 Current tree (through Phase 3)

```text
moneymind-ai/
├── .github/workflows/ci.yml      # format, lint, types, tests (PostgreSQL), build, audit
├── .vscode/                      # recommended extensions, format-on-save
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # identity, tenancy, sessions + finance core
│   │   │   └── migrations/       # committed SQL migrations
│   │   ├── src/
│   │   │   ├── __tests__/        # supertest integration suite
│   │   │   ├── config/           # env.ts, logger.ts
│   │   │   ├── db/               # Prisma singleton + readiness probe
│   │   │   ├── lib/              # AppError, response helpers
│   │   │   ├── middleware/       # request-id, auth, validation, error handler
│   │   │   ├── modules/auth/     # service, routes, tokens, password, cookies, mapper
│   │   │   ├── modules/finance/  # categories, transactions, budgets, goals, analytics
│   │   │   ├── routes/           # versioned router, health/meta/ready
│   │   │   ├── types/            # Express augmentation
│   │   │   ├── app.ts            # composable app factory (testable)
│   │   │   └── server.ts         # listen, DB check, signals, graceful shutdown
│   │   ├── .env.example
│   │   ├── Dockerfile            # build, migrate and runner stages
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   └── web/
│       ├── public/               # favicon, CSP-safe theme bootstrap
│       ├── src/
│       │   ├── components/
│       │   │   ├── auth/         # shell, loading, route guards, form field
│       │   │   ├── finance/      # dialogs, charts, progress, month switcher
│       │   │   ├── brand/ dashboard/ landing/ layout/ motion/ ui/
│       │   │   ├── error-boundary.tsx
│       │   │   └── theme-toggle.tsx
│       │   ├── hooks/
│       │   ├── lib/              # API client, finance helpers, schemas, form styles
│       │   ├── pages/            # landing, auth, dashboard, transactions, categories,
│       │   │                     # budgets, goals, analytics, profile, 404
│       │   ├── providers/        # theme, TanStack Query, auth session
│       │   ├── test/
│       │   ├── App.tsx
│       │   ├── index.css         # tokens, base, utilities
│       │   └── main.tsx
│       ├── Dockerfile
│       ├── nginx.conf
│       ├── index.html
│       ├── vite.config.ts
│       └── vitest.config.ts
├── packages/
│   └── shared/
│       └── src/
│           ├── constants.ts      # phases, app metadata
│           ├── lib/money.ts      # exact money helpers + tests
│           ├── lib/dates.ts      # calendar/time-zone helpers + tests
│           ├── schemas/          # auth, common, finance, health, meta
│           └── index.ts
├── docs/
│   ├── ARCHITECTURE.md
│   └── ROADMAP.md
├── scripts/clean.mjs
├── docker-compose.yml            # Postgres, migrate job, Qdrant, API, web
├── eslint.config.js
├── tsconfig.base.json
├── package.json
└── README.md
```

### 3.2 Target API structure (Phases 3–6)

```text
apps/api/src/
├── config/                 # env, logger, AI providers, rate limits
├── modules/
│   ├── auth/               # controller, service, tokens, password, schemas
│   ├── users/
│   ├── workspaces/         # membership + roles + authorization policy
│   ├── accounts/
│   ├── categories/
│   ├── transactions/       # ledger service, csv import, dedupe
│   ├── budgets/
│   ├── goals/
│   ├── analytics/          # SQL aggregations, no LLM math
│   ├── documents/          # upload, parsing, chunking, status
│   ├── search/             # hybrid retrieval, citations
│   ├── ai/                 # chat, tools, agent loop, streaming
│   └── insights/           # scheduled generation + feedback
├── infrastructure/
│   ├── prisma/
│   ├── qdrant/
│   ├── storage/
│   ├── queue/
│   └── llm/                # providers, prompt registry, token counting
├── middleware/             # authenticate, authorize, validate, idempotency
├── lib/                    # errors, result, crypto, dates, pagination
├── jobs/                   # workers and schedules
├── routes/                 # mounts module routers only
├── app.ts
└── server.ts
```

### 3.3 Target web structure

```text
apps/web/src/
├── components/
│   ├── ui/                 # primitives (owned shadcn-style)
│   ├── charts/             # Recharts wrappers + accessible tables
│   ├── layout/             # marketing, auth, app shells
│   ├── finance/            # transaction table, budget cards, goal cards
│   ├── copilot/            # thread, message, tool trace, citations
│   ├── documents/          # upload dropzone, ingestion status
│   └── three/              # lazy R3F scenes (Phase 7)
├── features/               # feature-scoped hooks/queries/components
│   ├── auth/ transactions/ budgets/ goals/ analytics/ copilot/
├── hooks/
├── lib/                    # api client, formatters, query keys
├── pages/                  # route components
├── providers/              # theme, query, session, toast
├── styles/
└── App.tsx
```

### 3.4 Naming conventions

- React components: `PascalCase.tsx`; hooks: `use-kebab-case.ts`.
- API modules: kebab-case folders; exported symbols PascalCase/camelCase.
- Prisma models PascalCase; DB tables/columns snake_case via `@@map`/`@map`.
- Error codes: `SCREAMING_SNAKE_CASE`.
- Environment variables: `SCREAMING_SNAKE_CASE`.
- Test files colocated with the unit under test (`money.test.ts`) or in `__tests__` for API
  integration suites.

---

## 4. Database design

### 4.1 Conventions

- PostgreSQL 16, Prisma migrations committed. No `db push` outside throwaway local databases.
- Primary keys: UUID v7, generated by the database default `@default(uuid(7))` (time-sortable,
  index-friendly) so application code cannot forget to set an ID.
- Timestamps: `timestamptz(3)`, `createdAt` / `updatedAt` on mutable entities.
- Money: `BIGINT` minor units + ISO 4217 `CHAR(3)` currency. No floats.
- Deletes: soft delete (`deletedAt`) for user-owned financial records; append-only audit log.
- Tenancy: every financial row carries `workspaceId`; repositories require it.
- Enums: Prisma/Postgres enums for closed sets; lookup tables only if users can manage values.
- Constraint-first: amount positivity, date ranges, size limits and uniqueness enforced in SQL,
  not only in services.
- Indexes are designed with the queries in Section 4.4, not added speculatively.

### 4.2 Entity–relationship overview

Identity, tenancy and the Phase 3 finance core are live; accounts, transfers, net worth and the AI
models remain targets.

```text
User 1──* Session
User 1──* Membership *──1 Workspace
VerificationToken (deferred with email verification/password reset)
Workspace 1──* Account
Workspace 1──* Category
Workspace 1──* Transaction *──1 Account
                         └──? Category
Workspace 1──* Budget *──1 Category
Workspace 1──* Goal 1──* GoalContribution
Workspace 1──* Document 1──* DocumentChunk
Workspace 1──* ChatThread 1──* ChatMessage
Workspace 1──* AiInsight
Workspace 1──* AuditLog
Account 1──* BalanceSnapshot
```

### 4.3 Models

#### Identity and tenancy — live (Phase 2)

| Model | Key fields | Constraints / notes |
| --- | --- | --- |
| `User` | `id`, `email`, `passwordHash`, `name`, `avatarUrl`, `timezone`, `locale`, `emailVerifiedAt`, `lastLoginAt`, `createdAt`, `updatedAt` | Email normalized to lowercase and `@unique`; `name` ≤ 80 chars; no soft delete until the deletion workflow exists |
| `Session` | `id`, `userId`, `tokenHash` (unique), `userAgent`, `ipAddress`, `expiresAt`, `lastUsedAt`, `rotatedAt`, `revokedAt`, `createdAt` | HMAC-SHA256 of a 48-byte opaque refresh token; the raw token is returned once and never stored; `@@index([userId])`, `@@index([expiresAt])` |
| `Workspace` | `id`, `name`, `baseCurrency`, `createdAt`, `updatedAt` | Created atomically at registration; base currency defaults to `USD` |
| `Membership` | `id`, `userId`, `workspaceId`, `role` (`OWNER`, `ADMIN`, `MEMBER`), `createdAt` | `@@unique([userId, workspaceId])`; registration creates the first row as `OWNER` |

Deferred to a later phase: `VerificationToken` (email verification, password reset) and the
`VIEWER` role, which has no meaning until finance resources exist.

#### Ledger — Phase 3 delivered (subset of the target)

> **Shipped in Phase 3:** `Category`, `Transaction`, `Budget`, `Goal` and `GoalContribution`
> without accounts. Transactions carry no `accountId`, `currency` or `fxRateToBase`; every row
> uses the workspace base currency. Amounts stay positive and direction comes from `type`
> (`INCOME` / `EXPENSE`). Categories are flat (no `parentId`), budgets are one envelope per
> expense category per calendar month, and goals have only `ACTIVE` / `ARCHIVED`. Accounts,
> balance snapshots, transfers, `ImportBatch`, soft deletes, idempotency keys and audit logs
> remain targets.

| Model | Key fields | Constraints / notes |
| --- | --- | --- |
| `Account` | `id`, `workspaceId`, `name`, `type` (`CHECKING`, `SAVINGS`, `CREDIT_CARD`, `CASH`, `INVESTMENT`, `LOAN`), `currency`, `openingBalanceMinor`, `institution`, `archivedAt`, `createdAt`, `deletedAt` | Currency ISO 4217; balance derived |
| `BalanceSnapshot` | `id`, `accountId`, `balanceMinor`, `asOf` | Unique `(accountId, asOf)`; powers net-worth history |
| `Category` | `id`, `workspaceId`, `parentId?`, `name`, `slug`, `kind` (`INCOME`, `EXPENSE`, `TRANSFER`), `icon`, `color`, `isSystem`, `createdAt`, `deletedAt` | Unique `(workspaceId, lower(name), kind)`; circular parents rejected in service |
| `Transaction` | `id`, `workspaceId`, `accountId`, `categoryId?`, `type` (`INCOME`, `EXPENSE`, `TRANSFER`), `amountMinor` (positive), `currency`, `fxRateToBase?`, `occurredAt`, `description`, `merchant?`, `notes?`, `source` (`MANUAL`, `IMPORT`, `RECURRING`, `AI_ADJUSTMENT`), `externalId?`, `transferGroupId?`, `deletedAt`, `createdAt`, `updatedAt` | Check `amountMinor > 0`; transfers have paired legs sharing `transferGroupId`; unique `(workspaceId, source, externalId)` where externalId not null |
| `ImportBatch` (Phase 3.5) | `id`, `workspaceId`, `accountId`, `filename`, `checksum`, `rowCount`, `importedCount`, `failedCount`, `status`, `createdAt` | Idempotent re-upload by checksum |

#### Planning

> **Shipped in Phase 3:** `Budget` is `(workspaceId, categoryId, month)` unique, expense-only,
> with `amountMinor` and cascade deletes. `Goal` is `ACTIVE` / `ARCHIVED` with a positive target;
> `GoalContribution` rows are deposits only (no withdrawals or linked transactions), and progress
> is always derived. Rollover, alert thresholds and weekly/yearly periods are deferred.

| Model | Key fields | Constraints / notes |
| --- | --- | --- |
| `Budget` | `id`, `workspaceId`, `categoryId?` (null = overall), `name`, `period` (`MONTHLY`, `WEEKLY`, `YEARLY`), `startDate` (date), `amountMinor`, `currency`, `rollover`, `alertThreshold` (1–100), `createdAt`, `deletedAt` | Unique active `(workspaceId, categoryId, period, startDate)` via partial index where `deletedAt IS NULL` |
| `Goal` | `id`, `workspaceId`, `name`, `targetMinor`, `currency`, `targetDate?`, `status` (`ACTIVE`, `ACHIEVED`, `PAUSED`, `ARCHIVED`), `linkedAccountId?`, `icon`, `color`, `createdAt`, `deletedAt` | Check `targetMinor > 0` |
| `GoalContribution` | `id`, `goalId`, `amountMinor`, `occurredAt`, `note?`, `transactionId?`, `createdAt` | Positive contributions; withdrawals modeled as negative? **No** — use separate `type` (`DEPOSIT`, `WITHDRAWAL`) to keep signs explicit |

#### Knowledge and AI

| Model | Key fields | Constraints / notes |
| --- | --- | --- |
| `Document` | `id`, `workspaceId`, `uploadedByUserId`, `filename`, `mimeType`, `sizeBytes`, `storageKey`, `checksumSha256`, `status` (`UPLOADED`, `PROCESSING`, `READY`, `FAILED`), `pageCount?`, `error?`, `createdAt`, `deletedAt` | Unique `(workspaceId, checksumSha256)` for dedupe; `storageKey` never exposed directly |
| `DocumentChunk` | `id`, `documentId`, `workspaceId`, `chunkIndex`, `content`, `contentHash`, `tokenCount`, `pageFrom?`, `pageTo?`, `embeddingId` (Qdrant point UUID), `metadata` JSONB | Unique `(documentId, chunkIndex)`; cascade on document delete |
| `ChatThread` | `id`, `workspaceId`, `userId`, `title`, `model`, `summary?`, `createdAt`, `updatedAt`, `archivedAt` | Owner-scoped; workspace membership still checked |
| `ChatMessage` | `id`, `threadId`, `role` (`USER`, `ASSISTANT`, `TOOL`, `SYSTEM`), `content`, `model?`, `promptTokens?`, `completionTokens?`, `citations` JSONB, `toolCalls` JSONB, `createdAt` | Ordered by `(threadId, createdAt, id)` |
| `AiInsight` | `id`, `workspaceId`, `type` (`SPENDING`, `BUDGET`, `GOAL`, `ANOMALY`, `SUMMARY`), `periodStart`, `periodEnd`, `severity`, `title`, `body`, `data` JSONB, `model?`, `status` (`NEW`, `SEEN`, `DISMISSED`), `expiresAt`, `createdAt` | Deterministic metrics stored in `data`; LLM only narrates |
| `IdempotencyKey` | `key`, `userId`, `endpoint`, `requestHash`, `responseStatus`, `responseBody` JSONB, `expiresAt` | Unique `(userId, key, endpoint)`; 24 h TTL |
| `AuditLog` | `id`, `workspaceId?`, `actorUserId?`, `action`, `entityType`, `entityId`, `ipHash?`, `userAgent?`, `metadata` JSONB, `createdAt` | Append-only; no update/delete grants to app role |

### 4.4 Index plan

- `transactions (workspace_id, occurred_at DESC)` — history pagination.
- `transactions (workspace_id, category_id, occurred_at DESC)` — category analytics.
- `transactions (workspace_id, type, occurred_at DESC)` — cash-flow aggregation.
- `categories` unique `(workspace_id, kind, name)`; case-insensitive duplicates rejected in service.
- `budgets` unique `(workspace_id, category_id, month)`.
- `goals (workspace_id, status)`; `goal_contributions (goal_id, occurred_at DESC)`.
- `document_chunks (workspace_id, document_id)`.
- `chat_messages (thread_id, created_at)`.
- `sessions (user_id)`; `sessions (expires_at)`; unique `token_hash`.
- `memberships (workspace_id)`; unique `(user_id, workspace_id)`.
- Search currently uses case-insensitive `contains` predicates over description, merchant, notes
  and category name. pg_trgm / `to_tsvector` stays a future optimisation; Qdrant handles semantic
  document search in Phase 5.

### 4.5 Prisma schema

`apps/api/prisma/schema.prisma` is the single source of truth and is migrated in
`apps/api/prisma/migrations`. The live identity and tenancy excerpt:

```prisma
enum WorkspaceRole {
  OWNER
  ADMIN
  MEMBER
}

model User {
  id              String    @id @default(uuid(7)) @db.Uuid
  email           String    @unique @db.VarChar(254)
  passwordHash    String    @db.VarChar(255)
  name            String    @db.VarChar(80)
  avatarUrl       String?   @db.VarChar(2048)
  timezone        String    @default("UTC") @db.VarChar(64)
  locale          String    @default("en-US") @db.VarChar(16)
  emailVerifiedAt DateTime? @db.Timestamptz(3)
  lastLoginAt     DateTime? @db.Timestamptz(3)
  createdAt       DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt       DateTime  @updatedAt @db.Timestamptz(3)

  memberships Membership[]
  sessions    Session[]

  @@map("users")
}

model Workspace {
  id           String   @id @default(uuid(7)) @db.Uuid
  name         String   @db.VarChar(80)
  baseCurrency String   @default("USD") @db.Char(3)
  createdAt    DateTime @default(now()) @db.Timestamptz(3)
  updatedAt    DateTime @updatedAt @db.Timestamptz(3)

  memberships Membership[]

  @@map("workspaces")
}

model Membership {
  id          String        @id @default(uuid(7)) @db.Uuid
  userId      String        @db.Uuid
  workspaceId String        @db.Uuid
  role        WorkspaceRole @default(MEMBER)
  createdAt   DateTime      @default(now()) @db.Timestamptz(3)

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([userId, workspaceId])
  @@index([workspaceId])
  @@map("memberships")
}

model Session {
  id         String    @id @default(uuid(7)) @db.Uuid
  userId     String    @db.Uuid
  tokenHash  String    @unique @db.VarChar(64)
  userAgent  String?   @db.VarChar(512)
  ipAddress  String?   @db.VarChar(64)
  expiresAt  DateTime  @db.Timestamptz(3)
  lastUsedAt DateTime  @default(now()) @db.Timestamptz(3)
  revokedAt  DateTime? @db.Timestamptz(3)
  rotatedAt  DateTime? @db.Timestamptz(3)
  createdAt  DateTime  @default(now()) @db.Timestamptz(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("sessions")
}
```

The live Phase 3 transaction model below fixes the money and indexing decisions:

```prisma
model Transaction {
  id          String       @id @default(uuid(7)) @db.Uuid
  workspaceId String       @db.Uuid
  categoryId  String?      @db.Uuid
  createdById String?      @db.Uuid
  type        CategoryKind
  amountMinor BigInt
  currency    String       @db.Char(3)
  description String       @db.VarChar(160)
  merchant    String?      @db.VarChar(120)
  notes       String?      @db.VarChar(1000)
  occurredAt  DateTime     @db.Timestamptz(3)
  createdAt   DateTime     @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime     @updatedAt @db.Timestamptz(3)

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  category  Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  createdBy User?     @relation("TransactionCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)

  @@index([workspaceId, occurredAt])
  @@index([workspaceId, type, occurredAt])
  @@index([workspaceId, categoryId, occurredAt])
  @@map("transactions")
}
```

Deleting a category sets `categoryId` to `null` so history survives as uncategorised. Deleting a
transaction is a hard delete; every aggregate is recomputed from remaining rows.

Key rule: **the service layer receives `workspaceId` from the authenticated session, never from
the request body.**

### 4.6 Migrations, seeds and retention

- Migration flow: edit schema → `prisma migrate dev --name ...` locally → review SQL → CI runs
  `prisma migrate deploy` against a disposable database.
- Production uses expand/contract migrations; never drop a column in the same release that stops
  writing it.
- Seed script creates a demo workspace (only in development) and no real PII. Starter finance
  categories are seeded lazily per workspace on first read, so renamed defaults are never
  resurrected.
- Retention: documents deleted by user are removed from object storage and Qdrant within 24 h;
  audit logs retained 1 year (configurable); expired sessions purged nightly.
- Backups: managed Postgres PITR, daily snapshots, quarterly restore drill (Phase 9).

---

## 5. API design

### 5.1 Conventions

- Base path: `/api/v1`. Breaking changes require `/api/v2`.
- Content type: `application/json; charset=utf-8`; uploads use `multipart/form-data`.
- Field naming: camelCase. Dates: ISO 8601 UTC. Dates without time use `YYYY-MM-DD`.
- Successful response: `{ "data": ..., "meta"?: ... }`.
- Error response:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request body is invalid.",
    "details": [{ "path": "amountMinor", "message": "Expected an integer string" }],
    "requestId": "6d1d0e2e-..."
  }
}
```

- Every response includes `x-request-id`; clients surface it in error states and support reports.
- Pagination: cursor-based, opaque base64 cursor derived from `(occurredAt, id)`, default 20, max
  100. Response `meta: { nextCursor, hasMore }`.
- Idempotency: `Idempotency-Key` required for mutation endpoints that move money or create
  duplicates (transaction create/import, goal contributions).
- Timestamps accepted as ISO strings; server stores UTC and returns UTC.
- Validation failures return 400 with field-level details; never echo the full invalid payload.
- Rate limits: global per IP, stricter buckets for login/register/password reset/AI, per-user
  quotas for AI usage.
- Auth: `Authorization: Bearer <accessToken>` on API calls (Phase 2). Refresh cookie is scoped to
  `/api/v1/auth`, `HttpOnly`, `Secure` in production, `SameSite=Strict`.
- Streaming: SSE with `text/event-stream`; heartbeat comments; no caching.

### 5.2 Error codes

Codes marked ✅ are emitted today; the rest are reserved for later phases.

| Code | HTTP | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 422 ✅ | Zod validation failed; `details` holds field-level paths |
| `BAD_REQUEST` | 400 ✅ | Domain/request precondition failed |
| `INVALID_JSON` | 400 ✅ | Malformed JSON body |
| `AUTH_REQUIRED` | 401 ✅ | Missing or malformed `Authorization` header |
| `ACCESS_TOKEN_INVALID` | 401 ✅ | Access JWT failed signature/expiry verification |
| `INVALID_CREDENTIALS` | 401 ✅ | Email/password mismatch (deliberately uniform) |
| `NO_SESSION` | 401 ✅ | Refresh cookie absent or already rotated |
| `SESSION_REVOKED` | 401 ✅ | Session was revoked (including by reuse detection) |
| `SESSION_EXPIRED` | 401 ✅ | Refresh session past `expiresAt` |
| `USER_NOT_FOUND` | 401 ✅ | Token referenced a deleted account |
| `EMAIL_TAKEN` | 409 ✅ | Registration email already exists |
| `SESSION_NOT_FOUND` | 404 ✅ | Session absent or owned by another user |
| `NO_WORKSPACE` | 403 ✅ | Account has no workspace membership |
| `UNAUTHORIZED` | 401 | Generic authorization failure helper |
| `FORBIDDEN` | 403 | Not a workspace member / insufficient role |
| `CORS_NOT_ALLOWED` | 403 ✅ | Origin not allowlisted |
| `NOT_FOUND` | 404 ✅ | Resource absent or not visible to caller |
| `CONFLICT` | 409 | Unique constraint or stale version |
| `PAYLOAD_TOO_LARGE` | 413 | Body or upload exceeds limit |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Upload type not allowed |
| `RATE_LIMITED` | 429 ✅ | Bucket exhausted; `Retry-After` provided |
| `INTERNAL_ERROR` | 500 ✅ | Unexpected failure (no internals leaked) |
| `SERVICE_UNAVAILABLE` | 503 | Dependency down / degraded readiness |
| `AI_BUDGET_EXCEEDED` | 402/429 | User/workspace AI quota exhausted |
| `AI_TOOL_REJECTED` | 409 | User declined a write action |
| `DOCUMENT_PROCESSING_FAILED` | 422 | Parsing/embedding failed |

### 5.3 Endpoint plan

#### Live today (Phases 1–2)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Service metadata, version, API prefix |
| GET | `/api/v1/health` | Liveness, uptime, version, API check |
| GET | `/api/v1/ready` | Readiness incl. PostgreSQL; `503` when the probe fails |
| GET | `/api/v1/meta` | Phase/capability discovery for the SPA |
| POST | `/api/v1/auth/register` | Email + password; atomically creates user, personal workspace, OWNER membership and session |
| POST | `/api/v1/auth/login` | Argon2id verify; returns access token + refresh cookie |
| POST | `/api/v1/auth/refresh` | Rotate refresh token; reuse revokes every session |
| POST | `/api/v1/auth/logout` | Revoke the current session and clear the cookie (idempotent) |
| POST | `/api/v1/auth/logout-all` | Revoke every session for the account |
| GET | `/api/v1/auth/me` | User, active workspace and current session |
| PATCH | `/api/v1/auth/me` | Update name, IANA time zone and locale |
| GET | `/api/v1/auth/sessions` | List active sessions; flags the current device |
| DELETE | `/api/v1/auth/sessions/:sessionId` | Revoke one owned session; foreign IDs return `404` |

#### Deferred auth endpoints (email verification, reset, multi-workspace)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/v1/auth/verify-email` | Consume verification token |
| POST | `/api/v1/auth/forgot-password` | Always 202; no account enumeration |
| POST | `/api/v1/auth/reset-password` | Consume token; revoke all sessions |
| GET/POST | `/api/v1/workspaces` | List/create (post-MVP for multiple) |
| GET/PATCH | `/api/v1/workspaces/:id` | Workspace settings |
| GET/POST/DELETE | `/api/v1/workspaces/:id/members` | Household support later |

#### Phase 3 — finance (delivered)

All routes require an authenticated access token and an active session, and resolve the
workspace from the caller's membership — never from the URL or body.

| Method | Path | Notes |
| --- | --- | --- |
| GET/POST | `/api/v1/finance/categories` | List (`kind`, `includeSystem`) / create; starter categories seeded lazily |
| PATCH/DELETE | `/api/v1/finance/categories/:id` | Rename/recolour/icon; system or in-use categories cannot be deleted |
| GET | `/api/v1/finance/transactions` | Filters: `q`, `type`, `categoryId`, `from`, `to`, `order`, `page`, `limit`; totals in `meta` |
| GET | `/api/v1/finance/transactions/:id` | Workspace-scoped lookup |
| POST | `/api/v1/finance/transactions` | Positive minor units, category/type compatibility |
| PATCH/DELETE | `/api/v1/finance/transactions/:id` | Hard delete; totals and budgets recalculate |
| GET | `/api/v1/finance/summary` | `?month=YYYY-MM` income, expenses, net |
| GET/POST | `/api/v1/finance/budgets` | List for `?month` (with progress) / create |
| PATCH/DELETE | `/api/v1/finance/budgets/:id` | Amount update; delete removes the envelope only |
| GET/POST | `/api/v1/finance/goals` | List (`status`) / create |
| GET/PATCH/DELETE | `/api/v1/finance/goals/:id` | Detail, edit, delete (cascades contributions) |
| GET/POST | `/api/v1/finance/goals/:id/contributions` | History / add contribution |
| DELETE | `/api/v1/finance/goals/:id/contributions/:contributionId` | Remove one contribution |
| GET | `/api/v1/finance/dashboard` | `?month` totals, deltas, trend, breakdown, budgets, goals, recent |
| GET | `/api/v1/finance/analytics` | `?month`, `?months=3..24` trend, breakdown and top merchants |

#### Deferred finance endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET/POST | `/api/v1/accounts` | Accounts and opening balances (future) |
| POST | `/api/v1/transactions/import` | CSV upload, dry-run mode |
| POST | `/api/v1/transactions/bulk` | Categorize/delete/recategorize |
| GET | `/api/v1/analytics/net-worth` | Snapshot series |

#### Phases 4–6 — AI, documents, insights

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/v1/ai/chat` | SSE; body `{ threadId?, message }` |
| GET | `/api/v1/ai/threads` | Paginated |
| GET/DELETE | `/api/v1/ai/threads/:id` | Transcript; delete = soft archive |
| GET | `/api/v1/ai/insights` | Filters `status`, `type` |
| PATCH | `/api/v1/ai/insights/:id` | Mark seen/dismissed |
| POST | `/api/v1/documents` | Multipart upload; 202 + status |
| GET | `/api/v1/documents` | List + ingestion status |
| GET/DELETE | `/api/v1/documents/:id` | Metadata / delete everywhere |
| POST | `/api/v1/documents/:id/reprocess` | Re-queue ingestion |
| GET | `/api/v1/search` | Semantic + keyword hybrid search with citations |

### 5.4 SSE contract (Phase 4)

```text
event: token         data: {"text":"Your dining spend"}
event: tool_start    data: {"tool":"get_cash_flow","callId":"..."}
event: tool_result   data: {"callId":"...","ok":true}
event: citation      data: {"id":"chunk_...","documentId":"...","page":3}
event: done          data: {"messageId":"...","usage":{"prompt":1234,"completion":456}}
event: error         data: {"code":"AI_BUDGET_EXCEEDED","message":"...","requestId":"..."}
```

The client renders tokens incrementally; tool traces are collapsible; citations link to the
source document/page or transaction set.

### 5.5 Example: create transaction (Phase 3)

```http
POST /api/v1/finance/transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "categoryId": "0192a...",
  "type": "EXPENSE",
  "amountMinor": "4299",
  "occurredAt": "2026-10-24",
  "description": "Groceries",
  "merchant": "Whole Foods"
}
```

`201 Created` returns `{ data: { transaction } }` with the category reference expanded. Validation
rejects a category whose kind does not match the transaction type, a category from another
workspace, or a non-positive `amountMinor`. Aggregates are recomputed from rows on every read, so
there is no balance to drift.

---

## 6. AI / RAG architecture

### 6.1 Principles

- **Grounded before generative.** Fetch data first, then generate. If retrieval and tools return
  nothing, the copilot says so.
- **Numbers come from code.** All totals, projections and comparisons are computed in SQL/TS and
  passed to the model as structured facts. The model narrates; it does not do arithmetic.
- **Typed tools only.** Tool I/O validated with Zod; workspace/user IDs injected server-side.
- **Read by default.** Any mutation requires a UI confirmation step and produces an audit entry.
- **Provider-agnostic.** One interface for chat and embeddings; model choice is configuration.
- **Citations are first-class.** Chunks and transaction sets have stable IDs returned with the
  answer.

### 6.2 Provider abstraction

```ts
interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
}

interface ChatChunk {
  type: "text" | "tool_call" | "usage" | "done";
  text?: string;
  toolCall?: { id: string; name: string; arguments: unknown };
  usage?: { promptTokens: number; completionTokens: number };
}

interface ChatModel {
  readonly id: string;
  stream(request: {
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
  }): AsyncIterable<ChatChunk>;
}

interface EmbeddingModel {
  readonly id: string;
  readonly dimensions: number;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][]>;
}
```

Adapters live in `infrastructure/llm/providers/*`; the domain sees only `ChatModel` /
`EmbeddingModel`. Configuration selects provider + model + fallback. A capability matrix (tools,
JSON mode, vision, context window) prevents unsupported calls.

### 6.3 Agent loop

```text
1. Load thread + short summary (bounded memory)
2. Persist user message
3. Classify intent (optional, cheap model) → choose tool candidates
4. Build system prompt (policy + workspace context + exact metrics)
5. Retrieve evidence (RAG) when the question is document/knowledge-oriented
6. Call model with tools (max 5 iterations, max 8k context, 60 s deadline)
7. On tool call: authorize workspace → validate args → execute read tool
                    mutation tool → emit confirmation card, wait for user approval
8. Stream text + citations to client
9. Persist assistant message, citations, tool trace, usage
10. Emit telemetry: latency, tokens, cost, tool success, retrieval hit rate
```

### 6.4 Tool catalogue

| Tool | Kind | Input | Guardrails |
| --- | --- | --- | --- |
| `get_cash_flow` | read | period, granularity | max 24 months |
| `list_transactions` | read | filters, pagination | max 100 rows; no PII fields |
| `get_budget_status` | read | period | deterministic SQL |
| `get_goal_progress` | read | goalId | |
| `search_financial_docs` | read | query, filters | workspace-scoped Qdrant filter |
| `create_transaction` | write | draft payload | confirmation + idempotency |
| `update_budget` | write | budgetId, amountMinor | confirmation + audit |
| `create_goal` | write | name, target, date | confirmation + audit |
| `explain_metric` | read | metric, period | returns precomputed values |

Tools never accept `userId`/`workspaceId` from the model. The executor injects the authenticated
principal and rejects cross-workspace IDs.

### 6.5 Ingestion pipeline (Phase 5)

```text
Upload (10 MB max) → type sniffing + allowlist → checksum dedupe → object storage
   → queue job → malware scan → sandboxed parse (PDF/DOCX/CSV/TXT)
   → normalize text + preserve page/section metadata
   → table-aware extraction (CSV/PDF tables kept as structured rows)
   → chunk 500–800 tokens, 15% overlap, sentence boundaries
   → embed dense + sparse/BM25 representation
   → upsert Qdrant points (UUID = chunk id, payload with workspaceId/documentId/page)
   → mark READY; failures mark FAILED with safe error reason (retryable)
```

Status is always visible in the UI. Re-processing creates new chunks and deletes orphans.
Original files are never rendered as HTML.

### 6.6 Qdrant design

- One collection per environment (`moneymind_chunks_<env>`), not per user.
- Named vectors: `dense` (model-specific dimensions) + `sparse` (BM25/SPLADE).
- Payload indexes on `workspaceId`, `documentId`, `sourceType`, `createdAt`.
- **Mandatory filter:** `workspaceId == principal.workspaceId` for every query. A cross-tenant
  retrieval is a critical defect.
- Point ID = `DocumentChunk.id`; payload includes `chunkId`, `documentId`, `page`, `text`,
  `embeddingModel`, `embeddingVersion`.
- Model changes create a new vector name/version and a backfill job; no mixed-version retrieval.

### 6.7 Retrieval

1. Rewrite/expand the query (cheap model or deterministic rules; keep original for citations).
2. Apply structured filters (date, document type, account) extracted from the question.
3. Hybrid search: dense top 40 + sparse top 40 → reciprocal rank fusion.
4. Rerank top 20 with a cross-encoder or provider reranker.
5. Select up to 8 chunks / ~6k tokens, dedupe near-identical text, keep page metadata.
6. Inject as delimited evidence:

```text
<untrusted_document id="chunk_123" page="4">
...content...
</untrusted_document>
```

7. Answer with inline citation markers; post-process to verify every marker maps to a supplied
   chunk.

### 6.8 Prompt-injection defenses

- Documents and transaction descriptions are **data**, never instructions. System policy states
  this explicitly.
- Strip/neutralize common instruction patterns only as defense in depth; never rely on detection.
- Tools require server-side authorization; the model cannot increase scope.
- Write tools require a human confirmation with a summary of the exact change.
- Output is rendered as sanitized markdown; no raw HTML, no `dangerouslySetInnerHTML`.
- Refuse questions outside the workspace's data (e.g. another user's ledger).
- Evals include a prompt-injection suite (see Section 10).

### 6.9 Insights and recommendations

- Nightly/weekly deterministic jobs compute anomalies, budget pace, goal projections and
  category shifts in SQL.
- The LLM receives exact numbers plus a strict "do not invent numbers" instruction and returns
  schema-validated JSON (`AiInsight`).
- Each insight stores the metrics used, model, prompt version and expiry.
- Recommendations are suggestions, not financial advice; the UI includes a clear disclaimer.
- User feedback (helpful/dismiss) feeds evaluation, not automatic prompt mutation.

### 6.10 Memory

- Short-term: last N messages + rolling summary of the thread (stored in `ChatThread.summary`).
- Long-term user preferences: explicit settings only; no silent profiling.
- Retrieval memory: last cited documents are re-ranked, not blindly trusted.
- Thread deletion removes messages; embeddings of deleted documents are removed from Qdrant.

### 6.11 Model routing and cost control

- Default: small/fast model for classification and summaries; stronger model for final
  reasoning; embeddings model fixed per collection version.
- Per-request budgets: max input tokens, max tool iterations, wall-clock deadline.
- Per-user and per-workspace monthly quotas; graceful `AI_BUDGET_EXCEEDED` errors.
- Fallback provider on timeout/5xx with a single retry, then a clear failure message.
- Log tokens/cost per message (no prompt content in metrics).

### 6.12 AI observability

- Traces per request: retrieval IDs, tool calls, latency per step, token usage, finish reason.
- Dashboards: p50/p95 latency, tool error rate, retrieval empty rate, citation coverage,
  refusal rate, cost per active user.
- Prompt and model versions recorded with each assistant message for reproducibility.

---

## 7. UI and page structure

### 7.1 Route map

| Route | Phase | Layout | Description |
| --- | --- | --- | --- |
| `/` | 1 ✅ | Marketing | Product story, architecture, security, roadmap |
| `/login` | 2 ✅ | Auth (public-only) | Real sign-in form; redirects signed-in users |
| `/register` | 2 ✅ | Auth (public-only) | Account + personal workspace creation |
| `/dashboard` | 2 ✅ | App (protected) | Greets the real user; empty states, live API + DB status |
| `/profile` | 2 ✅ | App (protected) | Name, time zone, locale, active sessions, sign-out everywhere |
| `/forgot-password`, `/reset-password` | Deferred | Auth | Token-based reset (not built) |
| `/transactions` | 3 | App | Filterable ledger, bulk actions, CSV import |
| `/transactions/new`, `/:id` | 3 | App | Create/edit with validation |
| `/categories` | 3 | App | System/custom category management |
| `/budgets` | 3 | App | Period selector, pace, alerts |
| `/goals`, `/goals/:id` | 3 | App | Progress, contributions, projection |
| `/analytics` | 3 | App | Cash flow, categories, net worth, savings rate |
| `/copilot`, `/copilot/:threadId` | 4 | App | Streaming chat, tools, citations |
| `/documents`, `/documents/:id` | 5 | App | Upload, status, semantic search |
| `/settings/profile`, `/security`, `/appearance`, `/data` | Deferred | App | Consolidated settings; Phase 2 exposes `/profile` instead |
| `*` | 1 ✅ | Standalone | 404 |

### 7.2 Design system (live today)

- **Tokens:** OKLCH color variables for light/dark, semantic names (`background`, `card`,
  `primary`, `muted`, `border`, `ring`, chart palette). No hardcoded hex in components.
- **Typography:** Inter Variable, tight tracking on display sizes, tabular numerals for money.
- **Radii:** 0.75 rem base, cards 1–1.5 rem, pills for actions.
- **Surfaces:** layered cards, subtle borders, glass only for sticky nav/overlays, no heavy
  shadows in dark mode.
- **Brand:** emerald→teal→sky gradient mark and accents; violet reserved for AI/secondary accents.
- **Primitives:** Button, Card, Badge, Input, Select, Textarea, Skeleton, Separator, Modal,
  ConfirmDialog; shadcn-compatible structure so the CLI can add more later.
- **Icons:** Lucide, 14–20 px inside components, 1.5–2 px stroke.

### 7.3 States

Every data-bearing view must implement:

1. **Loading:** skeletons matching final layout, not spinners on full pages; preserve layout.
2. **Empty:** explains what will appear, why it matters, and the next action (or the phase gate).
3. **Error:** human message, retry, request ID, and a fallback path (never a blank screen).
4. **Success:** stable layout, no content jump; optimistic updates for low-risk toggles only.
5. **Offline/degraded:** banner with retry; cached data marked stale.

Phase 3 demonstrates every state across the finance views: skeletons for each card/list, contextual
empty states that link to the next action, retryable error panels, and stable success layouts. The
API status card and session bootstrap remain the reference implementations.

### 7.4 Motion guidelines

- Durations: 150–250 ms for controls, 400–700 ms for entrances; easing `[0.22, 1, 0.36, 1]`.
- Animate transform/opacity only. No width/height animation loops.
- Scroll reveals once; stagger ≤ 60 ms; no parallax on text.
- Respect `prefers-reduced-motion` at the component level and via global CSS.
- The mobile drawer is the only large layout animation; it must keep focus and escape behavior.

### 7.5 3D guidelines (Phase 7)

Use R3F only when it earns its cost:

- Landing hero: one lightweight scene (financial orb / particle flow) that visualizes growth,
  lazy-loaded after the LCP, with a static poster fallback.
- Goal detail: optional 3D progress visualization, off by default and disabled on low-end devices.
- Budget: \(\le\) 200 KB gzip for the 3D chunk, DPR capped at 1.5, pause offscreen, no postprocessing
  unless measured, no shadows on mobile.
- No 3D on critical paths (forms, tables, chat).

### 7.6 Responsive behavior

- Mobile-first; minimum supported width 320 px.
- Sidebar becomes a focus-trapped drawer below `lg`.
- Tables collapse to cards or horizontally scroll with sticky first column; never truncate money.
- Charts stack and simplify ticks; provide accessible data tables.
- Touch targets ≥ 44 px; hover-only affordances have visible alternatives.

### 7.7 Accessibility

- WCAG 2.2 AA target: contrast, focus visible, keyboard paths, form labels, error announcements.
- Semantic headings and landmarks; skip link (live).
- Live regions for async status and chat streaming; `aria-busy` for loading.
- Charts include a table equivalent; color is never the only signal.
- Motion respects user preference; no autoplaying video/audio.
- Automated axe checks in Phase 8, manual keyboard/screen-reader passes each phase.

### 7.8 Performance budgets

- LCP < 2.5 s on mid-tier mobile (p75), CLS < 0.1, INP < 200 ms.
- Initial JS target < 250 KB gzip; lazy-load analytics, copilot, documents and 3D.
- Fonts: self-hosted variable Inter, `font-display: swap`; subset where practical.
- No layout shift from health polling; cache static assets immutably.
- Budget checks in Phase 8 (Lighthouse CI).

---

## 8. Development phases

The detailed task list lives in [`docs/ROADMAP.md`](./ROADMAP.md). Summary:

| Phase | Name | Main outcome | Exit criterion |
| --- | --- | --- | --- |
| 1 ✅ | Foundation | Monorepo, design system, app shell, API baseline, docs | Lint/types/tests/build pass; landing + dashboard preview + health API |
| 2 ✅ | Authentication + Database | Prisma schema, migrations, JWT sessions, protected routes, onboarding | Register/login/refresh/logout work against Postgres; auth + IDOR tests pass |
| 3 | Core Finance | Categories, transactions, budgets, goals, dashboard, analytics | Full CRUD + charts; ledger invariants and workspace isolation tested |
| 4 | AI / LLM | Provider abstraction, streaming chat, tool calling, insights | Grounded chat over ledger with typed tools; quotas and evals |
| 5 | RAG + Vector DB | Uploads, parsing, embeddings, Qdrant, hybrid search, citations | User can query own documents; cross-tenant retrieval impossible |
| 6 | AI Copilot | Agentic planning, proactive recommendations, confirmations | Multi-step tasks with safe writes and audit trail |
| 7 | Premium UI + 3D | Motion polish, optional R3F, responsive/a11y refinement | Performance and accessibility budgets met |
| 8 | Testing + Security | E2E, AI evals, load tests, security audit, hardening | Security checklist signed off; coverage gates |
| 9 | Deployment | CI/CD, observability, backups, runbooks | Production deploy with monitoring and restore drill |

**Phase discipline:** do not build Phase 4 UI against an imagined API; Phase 3 already ships the
finance database and HTTP contracts in `packages/shared`. Do not enable AI write tools before audit
logs and confirmation UI exist.

---

## 9. Security considerations

### 9.1 Threat model

| Asset | Actor | Threat | Primary mitigation |
| --- | --- | --- | --- |
| Credentials | External attacker | Credential stuffing, password spraying | Argon2id, rate limit per IP+email, breached-password check, generic errors |
| Session | XSS / network attacker | Token theft, replay | Memory-only access token, HttpOnly/Secure/Strict refresh cookie, rotation + reuse detection |
| Financial data | Another user | IDOR / cross-tenant reads | Workspace-scoped repositories, authorization tests, UUIDs + membership checks |
| Documents | Malicious uploader | Malware, parser exploit, prompt injection | Allowlist, magic-byte check, AV scan, sandboxed parsing, untrusted-content prompts |
| AI tools | Prompt attacker | Unauthorized writes, data exfiltration | Server-side principal, typed tools, confirmation, no cross-workspace retrieval |
| Secrets | Insider / leak | Env files committed, logs | `.gitignore`, secret scanning, redaction, managed secret store |
| Availability | Abuser | Request floods, expensive AI calls | Tiered rate limits, quotas, body limits, timeouts, queue backpressure |

### 9.2 Authentication and sessions (live in Phase 2)

- **Access token:** HS256 JWT, 15 min, `sub` (userId), `sid` (session id), `jti`, `iat`, `exp`.
  Stored in module memory only, sent as `Authorization: Bearer`. Never written to
  `localStorage`/`sessionStorage`.
- **Refresh token:** 48 random bytes (base64url), HMAC-SHA256 hash stored in
  `sessions.token_hash`; the raw value is returned once. Cookie: `HttpOnly`, `Secure` in
  production, `SameSite=Strict`, `Path=/api/v1/auth`, 30-day max age.
- **Rotation:** every refresh issues a new token, marks the predecessor `rotatedAt`/`revokedAt`
  and updates `lastUsedAt`. A retired token is reused ⇒ **every session for that user is
  revoked** (fail-closed) and the cookie is cleared.
- **Password:** Argon2id via `@node-rs/argon2` (64 MiB memory, `t=3`, `p=1`). 12–128 characters.
  Unknown emails still verify against a dummy hash to reduce timing differences. Breached-password
  screening is deferred.
- **Enumeration resistance:** login returns the same `INVALID_CREDENTIALS` message for unknown
  emails and wrong passwords; registration necessarily reveals `EMAIL_TAKEN`.
- **CSRF:** mutations authenticate with bearer tokens, not cookies. The refresh endpoint is the
  only cookie-authenticated call; it is `SameSite=Strict` and only mints tokens.
- **Logout:** revoke the current session and clear the cookie; `logout-all` revokes every session
  for the account. Both are idempotent from the client's perspective.
- **Revocation semantics:** a revoked session's access JWT remains cryptographically valid until
  it expires, but `/auth/me` and session routes check session state and reject immediately.
- **Browser coordination:** the SPA single-flights refresh within a tab and serializes it across
  tabs with the Web Locks API, so two tabs cannot replay one rotated cookie.
- **Deferred:** email verification, password reset, MFA/passkeys, OAuth and audit-log
  persistence. The schema leaves room for them without rework.

### 9.3 Authorization

- Every financial table carries `workspaceId`. A request resolves membership before touching a
  repository.
- Repository methods require `workspaceId` as a mandatory argument; no "find by id only" methods
  for user-owned records.
- Never accept an owner/workspace ID from the request body; derive it from the session.
- Role checks: VIEWER read-only, MEMBER read/write own workspace, ADMIN manage members/settings,
  OWNER transfer/delete workspace.
- Return 404 (not 403) for resources outside the caller's workspace to avoid existence leaks.
- IDOR tests are mandatory for every new endpoint.

### 9.4 Input, transport and API hardening

- Zod validation on params/query/body; strict objects reject unknown keys.
- Body limits (1 MB JSON, 10 MB uploads); timeouts on outbound AI/parser calls.
- Helmet headers live; Nginx adds CSP, frame denial, referrer policy, permissions policy.
- CORS allowlist from env, credentials enabled only for known origins.
- Tiered rate limits: auth 20 requests/15 min/IP (successful logins skip the counter); AI
  20/min/user; global 120/min/IP. Auth limits live in env (`AUTH_RATE_LIMIT_*`).
- Idempotency keys prevent duplicate financial writes.
- Parameterized queries through Prisma; raw SQL reviewed and type-mapped.
- No stack traces, SQL details or internal hostnames in production errors.
- Structured logs redact authorization, cookies, passwords, tokens and API keys.
- Request IDs correlate client reports and server logs.

### 9.5 Data protection

- TLS everywhere; managed Postgres encryption at rest; encrypted backups.
- Secrets via environment from a secret manager (never committed); rotation runbook.
- PII minimization: email/display name only until product needs more; no full account numbers.
- Data export and account deletion workflows in Phase 8/9; deletion propagates to Qdrant and
  object storage.
- Backups tested; RPO 24 h / RTO 4 h target for MVP (tighten later).
- Audit log is append-only and excludes sensitive values.

### 9.6 AI-specific security

- Workspace filter enforced in retrieval and tool execution, not in prompts.
- Documents are untrusted input; instructions inside them are ignored.
- Tool writes require human confirmation; every tool call is logged with actor and arguments
  (redacted).
- Output rendered as sanitized markdown; no raw HTML; links are validated.
- Model provider data retention configured to zero/limited where available; disclose provider in
  privacy policy.
- Prompt-injection eval suite runs in CI for AI changes (Phase 8).
- Per-user AI quotas and spend alarms prevent cost-based denial of service.

### 9.7 Upload security (Phase 5)

- Allowlist: PDF, DOCX, CSV, TXT only; verify magic bytes, not just extension/MIME.
- 10 MB limit; filename sanitized; storage key generated server-side (never user path).
- Malware scan before parsing; parsing in a restricted worker (no network, CPU/memory limits).
- Serve downloads via short-lived signed URLs with `Content-Disposition: attachment`.
- Reject encrypted/password-protected files with a clear error.
- Delete chunks and vectors when a document is deleted.

### 9.8 Frontend security

- Access tokens in memory; refresh token inaccessible to JS.
- CSP restricts scripts to self; theme bootstrap externalized for this reason.
- React escapes by default; no `dangerouslySetInnerHTML`; markdown sanitized.
- External links use `rel="noopener noreferrer"`.
- Dependency audit and lockfile integrity in CI; Renovate/Dependabot later.
- Error boundary avoids leaking stack traces to users.

### 9.9 Infrastructure security

- Multi-stage containers run as non-root where possible; no dev dependencies in runtime.
- Compose uses `no-new-privileges`; production adds read-only root FS and dropped capabilities.
- Database not publicly exposed in production; private networking/TLS.
- Network policy: API → DB/Qdrant/storage; web → API only.
- WAF/DDoS protection at the edge; request size/timeouts.
- Secret scanning + container scanning (Trivy) + SBOM in Phase 8/9.

### 9.10 OWASP mapping

| Risk | Coverage |
| --- | --- |
| A01 Broken access control | Workspace-scoped repositories, 404 on foreign IDs, IDOR tests |
| A02 Cryptographic failures | TLS, Argon2id, hashed refresh tokens, no secrets in logs |
| A03 Injection | Zod, Prisma parameterization, no raw HTML, sanitized markdown |
| A04 Insecure design | Threat model, confirmation gates, quotas, phase reviews |
| A05 Security misconfiguration | Helmet, CSP, non-root containers, env validation, no default secrets |
| A06 Vulnerable components | Lockfile, `npm audit`, container scanning, update policy |
| A07 Auth failures | Rotation, reuse detection, rate limits, enumeration resistance |
| A08 Integrity failures | Signed builds/SBOM, idempotency, audit logs, strict uploads |
| A09 Logging failures | Structured logs, request IDs, audit trail, redaction, alerts |
| A10 SSRF | No user-provided fetch URLs; allowlisted providers; metadata egress blocked |
| LLM01 Prompt injection | Untrusted delimiters, tool authorization, confirmation, evals |
| LLM02 Insecure output | Sanitized markdown, schema validation, no auto-execution |
| LLM06 Sensitive info disclosure | Workspace filters, redaction, provider retention settings |
| LLM08 Excessive agency | Read-only default, typed tools, max iterations, audit |

---

## 10. Testing strategy

### 10.1 Pyramid

```text
        E2E / journey (Playwright)          ~10%
     AI evals + security suites             ~10%
   Integration (API + real Postgres/Qdrant)  ~30%
 Unit (money, schemas, services, components) ~50%
```

### 10.2 Unit tests

- Shared: money parsing/formatting/sums, Zod schemas, pagination cursor helpers.
- API: domain services with in-memory ports; auth token logic; budget math; analytics date
  boundaries; CSV parsing; prompt builders.
- Web: pure formatters, reducers, hooks with mocked API; Testing Library for interactive
  primitives and critical states.
- Rule: every bug fix adds a regression test.

### 10.3 Integration tests

- `supertest` against `createApp()` (live since Phase 1).
- Real PostgreSQL 16 database (`moneymind_test`), migrations applied with `prisma migrate deploy`
  before the suite; tables truncated between test files; files run serially. Testcontainers are
  deferred to Phase 5 — Docker was unavailable in the build environment.
- Auth flow (live): register → login → refresh rotation → reuse detection → logout.
- Auth edge cases (live): duplicate email, validation failures, unknown fields, wrong password,
  missing/malformed/tampered tokens, revoked sessions, cross-user session access (`404`),
  session listing/revocation, profile updates, `/ready` with the database up.
- Ledger invariants (live): positive amounts, category/type compatibility, unknown category and
  cross-workspace access rejected, budget uniqueness, goal contribution progress.
- Analytics (live): fixture transactions compared with expected monthly totals, deltas, category
  shares and merchant ranking, including time-zone day boundaries.
- Qdrant integration (Phase 5): filter isolation, hybrid ranking smoke tests, deletion cleanup.
- Contract tests: shared schemas parse real API responses (health/meta/auth live).

### 10.4 Frontend tests

- Testing Library + jsdom for components/hooks with a mocked `fetch` boundary; MSW is optional
  later if mocking grows.
- States are first-class test cases: loading, empty, error, success, reduced motion.
- Live coverage: theme persistence, mobile drawer focus trap, landing render/navigation, API
  status states, protected-route bootstrap (via typecheck + auth integration).
- Accessibility assertions with `jest-axe` (Phase 8).
- Visual regression for core surfaces (Playwright screenshots) after UI stabilizes (Phase 7).
- No snapshot-only tests for behavior.

### 10.5 End-to-end

- Playwright against a seeded stack in CI (deferred to Phase 8).
- Journeys: sign up → dashboard → edit profile → revoke session → sign out; later add
  account/transaction → budget → analytics; AI chat with cited answer; upload document → search.
- Run on Chromium; WebKit/Firefox nightly; mobile viewport pass per release.
- Kafka-style flake quarantine: no retries hiding real failures; fix or remove.

### 10.6 AI evaluation

- Golden dataset per scenario (synthetic workspaces with known transactions/documents).
- Metrics:
  - Retrieval recall@8 and citation precision.
  - Groundedness (every number traceable; LLM judge + human spot checks).
  - Tool-call schema validity and correct tool selection.
  - Refusal correctness when data is missing.
  - Prompt-injection resistance (documents containing instructions).
  - Latency p50/p95 and cost per request.
- Every prompt/model/retrieval change runs the suite; store results per commit.
- Thresholds gate merges once baseline is stable (Phase 8), not from day one.

### 10.7 Security, performance, accessibility

- `npm audit` + Dependabot/Trivy + secret scanning.
- OWASP ZAP baseline against staging; authorization test matrix for every endpoint.
- k6 load test: health, login, transaction list, AI streaming (mocked provider) in Phase 8.
- Lighthouse CI budgets: performance ≥ 90, accessibility ≥ 95 for marketing/app.
- axe automated + manual keyboard/screen-reader checklist.

### 10.8 CI gates (current and target)

**Live now:** format check → lint → typecheck → unit/integration tests (against a PostgreSQL 16
service container, `prisma migrate deploy`) → production build → production dependency audit →
Docker build.

**Next:** Playwright smoke, API coverage threshold (80% lines), web coverage (70%), AI eval suite
when AI exists. Nightly: full E2E, dependency scan, load test.

### 10.9 Test data

- Factories build valid domain objects with explicit overrides.
- No production data in lower environments; synthetic seed with deterministic IDs.
- Time is injected (clock port) for budget/analytics tests; no sleeps.
- Uploads use tiny fixture files with known checksums.

---

## 11. Observability and operations

- **Logs:** pino JSON in production, pretty in dev; request ID, route, status, latency, user/workspace
  IDs (hashed where appropriate); redaction rules.
- **Metrics (Phase 8):** Prometheus `/metrics` on an internal port/route: request rate, latency
  histogram, error rate, DB pool, queue depth, AI tokens/cost, retrieval hit rate.
- **Tracing (Phase 8):** OpenTelemetry spans for HTTP → service → DB → queue → LLM; propagate
  `traceparent` and request ID.
- **Errors:** Sentry (or equivalent) with release/commit, request ID, no PII; alert on new
  signatures and 5xx spikes.
- **Dashboards:** API golden signals, auth failures, AI cost/latency, ingestion backlog.
- **Alerts:** availability SLO, 5xx rate, p95 latency, queue age, failed ingestion, budget
  exhaustion, backup failure.
- **SLOs (initial):** API availability 99.9% monthly; p95 read < 300 ms; chat first token < 2 s;
  ingestion < 2 min for 10 MB.
- **Runbooks:** rollback, rotate JWT secrets, revoke sessions, restore DB, re-index Qdrant, pause
  AI spend, disable uploads.

---

## 12. Deployment

### 12.1 Targets

| Component | Recommended | Notes |
| --- | --- | --- |
| Web | Static host/CDN (Vercel, Cloudflare Pages, S3+CloudFront) | SPA fallback to `index.html`, immutable assets, CSP headers |
| API | Container platform (Fly.io, Render, ECS/Fargate, Kubernetes) | Stateless, health checks, autoscale on CPU/latency |
| PostgreSQL | Managed (Neon, RDS, Supabase) | PITR, private networking, connection pooling (PgBouncer) |
| Qdrant | Qdrant Cloud or managed VM | Same region as API, snapshots enabled |
| Redis | Managed | Phase 5, private network |
| Storage | S3-compatible | SSE, lifecycle rules, signed URLs |

Docker Compose is provided for local production-like runs and single-VPS deployments. It is not a
high-availability production architecture.

### 12.2 Environments and configuration

- `.env` never committed; `.env.example` documents every variable.
- Validation fails fast on missing/invalid config.
- Separate secrets and databases per environment; Qdrant collection names suffixed by env.
- Preview deployments use synthetic data only.

### 12.3 Release process

1. PR → CI (format, lint, types, tests, build, Docker, audit).
2. Review with security checklist for changed surfaces.
3. Merge to `main` → build immutable images tagged with commit SHA.
4. Run expand migrations → deploy API → deploy web → smoke tests.
5. Monitor error rate/latency for 30 min; rollback image on regression.
6. Contract migrations in a later release.

### 12.4 Data operations

- Backups: daily full + PITR; restore drill quarterly.
- Qdrant snapshots after bulk ingestion and nightly.
- Object storage versioning/lifecycle for deleted documents.
- Secrets rotation every 90 days and on incident.

### 12.5 Current artifacts

- `apps/api/Dockerfile` (multi-stage build, dedicated `migrate` stage, non-root runner, healthcheck).
- `apps/web/Dockerfile` + `apps/web/nginx.conf` (CSP, gzip, SPA fallback, `/api` proxy).
- `docker-compose.yml` (Postgres, one-shot migration job, Qdrant, API, web with healthchecks).
- `.github/workflows/ci.yml` (PostgreSQL service, Prisma generate + migrate, quality gate + Docker).
- Docker is optional for local development; Phases 2–3 were verified with npm scripts against a
  local PostgreSQL 16 instance because Docker was unavailable in the build environment. Container
  images are built in CI.

---

## 13. Architecture decision records

| # | Decision | Status | Consequence |
| --- | --- | --- | --- |
| ADR-001 | npm-workspaces monorepo | Accepted | Shared contracts, one lockfile; slower installs than pnpm |
| ADR-002 | Modular monolith over microservices | Accepted | Simpler transactions/ops; revisit at clear scaling boundary |
| ADR-003 | REST + SSE over GraphQL/WebSockets | Accepted | Cacheable, easy auth; SSE fits token streaming |
| ADR-004 | PostgreSQL + Prisma | Accepted | Strong integrity; raw SQL for heavy analytics |
| ADR-005 | Integer minor units as BIGINT | Accepted | Exact ledger; every consumer must respect string transport |
| ADR-006 | JWT access + opaque rotating refresh | Accepted | Stateless reads, revocable sessions; more auth code |
| ADR-007 | Qdrant with dense + sparse hybrid | Accepted (Phase 5) | Better recall; operational overhead and re-embedding |
| ADR-008 | Provider-agnostic LLM gateway | Accepted (Phase 4) | Portability; lowest-common-denominator features |
| ADR-009 | Tailwind 4 + owned shadcn-style primitives | Accepted | Full control; component upgrades are manual |
| ADR-010 | 3D only in opt-in, lazy surfaces | Accepted (Phase 7) | Protects performance; limits spectacle |
| ADR-011 | No auth or DB code in Phase 1 | Superseded in Phase 2 | Kept Phase 1 honest; Phase 2 added real auth and persistence |
| ADR-012 | External theme bootstrap file for CSP | Accepted | No inline scripts; extra request (cached) |

---

## Appendix A — Phase 2 verification record

Run on Windows with Node 26.1.0, npm 11.13.0 and a local PostgreSQL 16.9 instance:

- `npm run format:check` — clean.
- `npm run lint` — zero errors/warnings.
- `npm run typecheck` — shared, API and web pass.
- `npm test` — shared 24, API 32, web 6 (62 total) pass. The API suite runs against a dedicated
  `moneymind_test` database with migrations applied.
- `npm run build` — shared, API and web production builds pass.
- `npm audit --omit=dev --audit-level=high` — 0 vulnerabilities. `package.json` pins
  `deepmerge-ts@^8.0.2` through an override because Prisma 6.19's CLI pins an affected 7.x
  version; `prisma generate` and `prisma migrate status` were re-verified with the override.
- Manual browser checks against the live stack covered registration → dashboard (user, personal
  workspace and OWNER membership created), duplicate-email `409`, signed-out redirect from a
  protected route, reload with silent refresh (`POST /auth/refresh` 200), profile edit persisted
  across a reload, name validation, session listing, revocation of a second session, wrong
  password `401`, sign-out and sign-out-everywhere (all sessions revoked in PostgreSQL). The
  throwaway verification account was deleted afterwards.
- Docker images are defined but were **not built locally** because Docker is not installed in the
  development environment; CI builds them.

## Appendix B — Phase 3 verification record

Run on Windows with Node 26.1.0, npm 11.13.0 and a local PostgreSQL 16.9 instance (migration `20261025190054_phase3_core_finance` applied to `moneymind` and `moneymind_test`):

- `npm run format:check` — clean.
- `npm run lint` — zero errors/warnings.
- `npm run typecheck` — shared, API and web pass.
- `npm test` — shared 49, API 52, web 6 (107 total) pass.
- `npm run build` — shared, API and web production builds pass.
- `npm audit --omit=dev --audit-level=high` — 0 vulnerabilities.
- Browser QA (authenticated `qa.phase3.*@example.com`, workspace `QA Ledger`, USD, UTC): created `Weekly groceries` (Groceries, Whole Foods, Oct 25 2026, −$42.75) and `Monthly salary` (Salary, Acme Corp, Oct 1 2026, +$2,500.00); verified totals/matches (Income $2,500.00 / Expenses $50.00 after edit / Net $2,450.00), search filtering to groceries, type/category/date filters, sort toggle, pagination (30 seeded → 2 pages, 20/page). Edited/deleted transactions via dialogs. Categories: created custom `QA Hobbies & Fun` (paw-print, #14b8a6), duplicate name rejected, edited/renamed/recoloured, deleted unused custom category. Budgets: created Groceries $200 → edited to $50 (over-budget 128.2%), added Dining $300 then deleted; month navigation verified. Goals: created `Emergency fund` target $5,000 Jun 30 2027; added/deleted contribution, edited target to $6,000 (25% funded), archived/reopened. Analytics: donut/category/merchants and cash-flow trends rendered, trend range and month switcher updated aggregates. Console errors: none (reduced-motion warning only). `GET /api/v1/meta` reports `phase: 3` with finance flags enabled.
- Docker images defined but **not built locally** (Docker unavailable); CI builds them.

### Phase 1 verification record (superseded)

- Shared 13, API 11, web 6 tests; all gates green at the time.
- Lighthouse: landing, dashboard, login and 404 scored 100 for accessibility, best practices and
  SEO; a 390 px viewport had no horizontal overflow and the mobile drawer trapped/restored focus.
