# MoneyMind AI

An AI-powered personal finance workspace: a precise ledger, budget and goal tracking, and a
grounded copilot that answers questions about **your** numbers with citations.

> **Status: Phase 3 — Core Finance.** Authentication, PostgreSQL persistence, a workspace-scoped
> ledger, categories, budgets, goals, dashboard and analytics are live. AI chat, RAG and documents
> are intentionally **not** built yet; the sidebar labels those phases honestly.

---

## What is live today

| Area | State |
| --- | --- |
| Marketing landing page | ✅ Product story, architecture, security, roadmap |
| Accounts | ✅ Register, sign in, sign out, sign out everywhere |
| Sessions | ✅ Short-lived access JWT + rotating HttpOnly refresh cookie |
| Profile | ✅ Name, time zone, locale, active sessions and revocation |
| Database | ✅ PostgreSQL + Prisma migrations (users, workspaces, memberships, sessions) |
| Protected app | ✅ Finance routes behind a session bootstrap |
| Dashboard | ✅ Live totals, deltas, cash flow, spending mix, budgets, goals, recent activity |
| Transactions | ✅ Search, type/category/date filters, sort, pagination, create/edit/delete |
| Categories | ✅ Starter + custom income/expense categories, colours and icons |
| Budgets | ✅ Monthly per-category envelopes with live spend, remaining and status |
| Goals | ✅ Savings targets with contribution history and archive/reopen |
| Analytics | ✅ Month totals, savings rate, trend, category shares, top merchants |
| API | ✅ Express 5, auth + finance routes, readiness probe, rate limits, CORS, error envelope |
| Shared contracts | ✅ Zod schemas used by the API and web forms |
| Tests | ✅ 107 tests across shared, API and web |
| AI chat / RAG / documents | ⛔ Phases 4–5 |

The API reports its own capabilities at `GET /api/v1/meta`, and the SPA derives its phase badges
from the shared phase list rather than hardcoding them.

---

## Requirements

- **Node.js ≥ 22** (verified with Node 26.1.0)
- **npm ≥ 10** (verified with npm 11.13.0)
- **PostgreSQL 16** for the auth flows and API integration tests
- Docker is optional locally; required for the containerized stack

---

## Quick start

```powershell
npm install
Copy-Item apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` and supply at minimum:

```dotenv
DATABASE_URL=postgresql://moneymind:your-password@localhost:5432/moneymind?schema=public
JWT_ACCESS_SECRET=<at least 32 random characters>
JWT_REFRESH_SECRET=<a different 32+ character secret>
```

Generate independent secrets with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Then create the schema and start the stack:

```powershell
npm run db:migrate -w @moneymind/api
npm run dev
```

Open:

- Web: <http://localhost:5173>
- API health: <http://localhost:4000/api/v1/health>
- API readiness (includes PostgreSQL): <http://localhost:4000/api/v1/ready>
- API capability map: <http://localhost:4000/api/v1/meta>

`npm run dev` builds the shared package once, then runs the shared watcher, API and web client
together. Vite proxies `/api` to the API, so there are no CORS surprises in development.

### Test database

Integration tests run against a dedicated database and never touch development data:

```powershell
$env:DATABASE_URL="postgresql://moneymind:your-password@localhost:5432/moneymind_test?schema=public"
npm run db:deploy -w @moneymind/api
npm test
```

`apps/api/vitest.config.ts` supplies long fixed test secrets and disables auth rate limiting for the
suite; only PostgreSQL needs to be running.

### Environment files

| File | Purpose |
| --- | --- |
| `apps/api/.env` | Database URL, JWT secrets, cookie and rate-limit settings |
| `apps/web/.env.local` | Optional `VITE_API_URL` when not using the Vite proxy |
| `.env` | Docker Compose values (Postgres, ports, CORS, secrets) |

Every API variable is validated at startup with Zod; invalid configuration fails fast with a
readable error. See [`apps/api/.env.example`](./apps/api/.env.example).

---

## Scripts

Run from the repository root:

| Script | What it does |
| --- | --- |
| `npm run dev` | Shared watcher + API (`:4000`) + web (`:5173`) |
| `npm run build` | Production builds for shared, API and web |
| `npm run typecheck` | Strict TypeScript across all workspaces |
| `npm run lint` | ESLint flat config |
| `npm test` | Vitest suites for shared, API and web |
| `npm run test:coverage` | Coverage reports per workspace |
| `npm run format` | Prettier write (includes Tailwind class sorting) |
| `npm run format:check` | Prettier check used by CI |
| `npm run clean` | Remove build output and coverage |

API database helpers:

```powershell
npm run prisma:generate -w @moneymind/api  # regenerate the Prisma client
npm run db:migrate -w @moneymind/api       # create/apply a dev migration
npm run db:deploy -w @moneymind/api        # apply committed migrations (CI/production)
npm run db:studio -w @moneymind/api        # inspect data in Prisma Studio
```

> If you run a single workspace directly after a fresh install, build shared first:
> `npm run build -w @moneymind/shared`.

---

## Project structure

```text
moneymind-ai/
├── apps/
│   ├── api/                 # Express 5 + TypeScript, testable app factory
│   │   ├── prisma/          # schema + committed migrations
│   │   └── src/
│   │       ├── config/      # validated env, pino logger
│   │       ├── db/          # Prisma singleton + readiness probe
│   │       ├── lib/         # AppError, response envelopes, tokens
│   │       ├── middleware/  # request ID, auth, validation, errors
│   │       ├── modules/     # auth service, routes, mappers, cookies
│   │       ├── routes/      # /api/v1 router, health + meta
│   │       ├── app.ts       # composable app (no listen)
│   │       └── server.ts    # listen, DB check, graceful shutdown
│   └── web/                 # React 19 + Vite 8 + Tailwind 4
│       └── src/
│           ├── components/  # ui primitives, layout, landing, auth, dashboard
│           ├── pages/       # landing, dashboard, login, register, profile, 404
│           ├── providers/   # theme, TanStack Query, auth session
│           ├── lib/         # typed API client, error mapping, redirect safety
│           └── index.css    # OKLCH design tokens
├── packages/
│   └── shared/              # Zod contracts, constants, money utilities
├── docs/
│   ├── ARCHITECTURE.md      # full target design + ADRs
│   └── ROADMAP.md           # phase-by-phase implementation checklist
├── .github/workflows/ci.yml # quality gate (with PostgreSQL) + Docker builds
├── docker-compose.yml       # Postgres, migrations, Qdrant, API, web
└── package.json             # npm workspaces + root scripts
```

---

## API surface (Phase 2)

All responses use an envelope:

```json
{ "data": { "status": "ok" } }
```

Errors return:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect.",
    "requestId": "6d1d0e2e-..."
  }
}
```

Every response carries `x-request-id`; clients can surface it in support reports.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Service identity and API prefix |
| GET | `/api/v1/health` | Liveness, uptime, version |
| GET | `/api/v1/ready` | Readiness incl. PostgreSQL (`503` when down) |
| GET | `/api/v1/meta` | Phase and feature capability discovery |
| POST | `/api/v1/auth/register` | Create user + personal workspace + OWNER membership |
| POST | `/api/v1/auth/login` | Verify credentials, issue access + refresh session |
| POST | `/api/v1/auth/refresh` | Rotate refresh token (reuse revokes every session) |
| POST | `/api/v1/auth/logout` | Revoke the current session and clear the cookie |
| POST | `/api/v1/auth/logout-all` | Revoke every session for the account |
| GET | `/api/v1/auth/me` | Current user, workspace and session |
| PATCH | `/api/v1/auth/me` | Update name, time zone and locale |
| GET | `/api/v1/auth/sessions` | List active sessions with the current one flagged |
| DELETE | `/api/v1/auth/sessions/:sessionId` | Revoke one owned session |

```powershell
curl.exe http://localhost:4000/api/v1/health
curl.exe http://localhost:4000/api/v1/ready
curl.exe http://localhost:4000/api/v1/meta
```

### Session model

- Access token: 15-minute HS256 JWT (`sub`, `sid`, `jti`), kept **in memory** in the browser.
- Refresh token: 48 random bytes, HMAC-SHA256 hashed at rest, rotated on every refresh.
- Cookie: `mm_refresh`, `HttpOnly`, `SameSite=Strict`, `Path=/api/v1/auth`, 30 days,
  `Secure` in production.
- Replaying a rotated token revokes every session for that user (fail-closed).
- Cross-tab refreshes are serialized with the Web Locks API so rotation stays single-use.
- Auth endpoints are rate limited (default 20 requests per 15 minutes; successful logins skip the
  counter).

Security baseline: Helmet, CORS allowlist, per-IP rate limiting, request IDs, 1 MB body limit,
strict Zod validation with unknown-field rejection, redacted structured logs, no stack traces in
production, and graceful shutdown.

---

## Testing

```powershell
npm test
```

- **Shared (24):** money parsing/formatting, exact arithmetic, auth/validation contracts.
- **API (32):** supertest integration against PostgreSQL — register, login, refresh rotation,
  replay revocation, logout, logout-all, profile updates, session listing/revocation, IDOR,
  validation errors, 401s, health/ready/meta, CORS, security headers.
- **Web (6):** theme toggle, drawer focus trap, landing render, navigation and API-status states.

API tests run serially against `moneymind_test`; see [Test database](#test-database). CI provisions
PostgreSQL, generates the Prisma client, applies migrations, then runs the same gates plus a
production dependency audit and Docker image builds.

**Dependency note:** the root `package.json` overrides `deepmerge-ts` to `^8.0.2` because the
Prisma 6.19 CLI pins an affected 7.x release (GHSA-ggr8-5vv4-36mx). `prisma generate`, migrations
and the full suite are verified with the override, and `npm audit --omit=dev --audit-level=high`
reports no vulnerabilities.

---

## Docker (optional)

Docker Compose runs a production-like stack: Postgres, a one-shot migration job, Qdrant, the API
and Nginx-served web app.

```powershell
Copy-Item .env.example .env
# Fill in JWT_ACCESS_SECRET, JWT_REFRESH_SECRET and DATABASE_URL (see comments in the file)
docker compose up --build
```

- Web: <http://localhost:8080>
- API: <http://localhost:4000/api/v1/health>
- Nginx proxies `/api` to the API, applies a strict CSP and serves the SPA with fallback.
- The `migrate` service applies committed Prisma migrations before the API starts.

Qdrant is provisioned but unused until Phase 5. The images are built in CI; they were not built
locally during development because Docker was unavailable in this environment.

---

## Documentation

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — system design, data model, API contract, AI/RAG
  architecture, security threat model, testing and deployment strategy.
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — phase checklists and exit criteria, starting with
  Phase 4 now that the finance core is live.

---

## Roadmap

| Phase | Focus |
| --- | --- |
| 1 ✅ | Foundation |
| 2 ✅ | Authentication + PostgreSQL |
| 3 ✅ | Categories, transactions, budgets, goals, dashboard, analytics |
| 4 | LLM abstraction, streaming chat, tool calling, insights |
| 5 | Document ingestion, Qdrant, hybrid RAG, citations |
| 6 | Agentic copilot, safe writes, proactive recommendations |
| 7 | Premium UI polish, optional 3D, accessibility and performance |
| 8 | E2E, AI evals, load and security testing |
| 9 | CI/CD, observability, backups, runbooks |

### Phase 2 boundaries

Deliberately deferred: email verification, password reset, MFA/passkeys, OAuth, multiple
workspaces in the UI, breach-list screening and audit-log persistence. The schema and service
boundaries leave room for them without rework.

### Phase 3 boundaries

Delivered as a single-currency workspace ledger without bank accounts: amounts are positive minor
units, direction comes from the transaction type, and budgets are per expense category per month.
Deliberately deferred: accounts and opening balances, transfers, net worth, CSV import and
`ImportBatch` tracking, idempotency keys, FX conversion, audit-log persistence, URL-synced filters
and bulk actions.

---

## Engineering principles

- **Money is never a float.** Integer minor units, `BIGINT` storage, decimal strings on the wire.
- **Contracts at the edges.** One shared Zod package defines HTTP payloads and AI tool arguments.
- **Workspace-scoped by default.** Every financial query will require a workspace ID from the
  session, never from the request body.
- **AI is grounded.** Retrieval precedes generation; numbers come from SQL; writes need explicit
  human confirmation.
- **Every phase ends runnable.** No fake auth, no placeholder endpoints presented as live.
