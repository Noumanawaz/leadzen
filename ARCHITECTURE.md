# Lead Management SaaS — Architecture

## Overview

Multi-tenant B2B lead management platform with a separate **platform admin** surface.

| Layer | Stack |
|-------|--------|
| Frontend | Next.js (App Router), TypeScript, Tailwind, shadcn/ui, TanStack Query |
| Backend | NestJS, TypeScript, REST (`/api`), Prisma 7 |
| Database | **Neon Postgres** (pooled `DATABASE_URL` + direct `DIRECT_URL` for migrations) |
| Cache / queues | Redis (Docker Compose), BullMQ sequence worker |
| AI | Groq (`GROQ_API_KEY`, `GROQ_MODEL`) |
| Billing | Stripe test/live keys + webhook secret |
| Email | Gmail OAuth (`GOOGLE_*`) |

## Folder conventions

### Backend (`backend/src`)

- `config/` — typed env validation (Zod)
- `database/` — Prisma client + Neon `pg` adapter
- `common/` — guards, decorators, encryption, rate limit, observability
- `modules/<domain>/` — Nest feature modules

### Frontend (`frontend/src`)

- `app/**/page.tsx` — **thin routes only**
- `features/<name>/components/` — page UI
- `components/ui/` — shadcn primitives
- `components/layout/` — app shell / admin shell
- `lib/api/client.ts` — API fetch helper

## Tenancy & security

1. Every tenant row is scoped by `organization_id`.
2. Organization is resolved from authenticated membership (`X-Organization-Id`) — never trusted from body alone.
3. Workspace roles: `owner | admin | manager | member` via `PermissionService`.
4. Platform admin is a separate `platform_admins` row seeded only from `ADMIN_EMAIL_ALLOWLIST` — **tenant owner ≠ platform admin**.
5. Admin APIs live under `/api/admin/*` and require `AuthGuard` + `LoadPlatformAdminGuard` + `PlatformAdminGuard`.
6. Global Redis-backed rate limit (`RATE_LIMIT_*`) with in-memory fallback.
7. Gmail OAuth `state` is a short-lived JWT with `purpose: gmail_oauth`.
8. Impersonation requires a written reason, is audited, and returns a **15m read-only support token** (never a tenant owner session).
9. GDPR export/delete via `/api/v1/privacy/*` (org admins); retention via `DATA_RETENTION_DAYS`.

## Providers & ledgers

| Concern | Service |
|---------|---------|
| RBAC | `PermissionService` |
| Credits | `CreditService` (row lock / transactional debit) |
| Usage | `UsageService` (append-only; provider cost separate) |
| Outreach | `OutreachRouter` + suppressions |
| Sequences | BullMQ worker + in-process fallback |
| AI | `AiProvider` / `GroqProvider` + `ai_requests` |
| Flags | `FeatureFlagsService` (global + org override) |
| Audit | `AuditService` (append-only) |

## Queue topology

- Redis URL: `REDIS_URL` (default `redis://localhost:6379`)
- Queue: `sequence-steps` (BullMQ). If Redis is down at boot, sequences tick in-process every 30s.

## Env vars (names only)

`DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `FRONTEND_URL`, `PORT`, `JWT_*`, `ADMIN_EMAIL_ALLOWLIST`, `TOKEN_ENCRYPTION_KEY`, `STRIPE_*`, `GOOGLE_*`, `GROQ_*`, `RATE_LIMIT_*`, `SENTRY_DSN`, `OTEL_ENABLED`, `DATA_RETENTION_DAYS`

## Phase status

| Phase | Status | Notes |
|-------|--------|-------|
| 0 Foundation scaffold | Complete | |
| 1 Auth / RBAC / ledgers | Complete | |
| 2 CRM | Complete (API) | UI thin: lists only — no kanban/deals/lead detail |
| 3 Billing | Complete | Needs `STRIPE_WEBHOOK_SECRET` for live webhooks |
| 4 Communications | Complete (API) | Gmail UI done; WhatsApp/SMS/Phone stubs have **no UI** |
| 5 Automation | Complete | Sequences UI; campaigns/rules mostly API |
| 6 AI | Complete | Groq model `openai/gpt-oss-20b` |
| 7 Platform admin | Complete | Allowlist + `/admin/*` |
| 8 Hardening | Complete | Rate limits, GDPR APIs, regression tests |

**Plan phases 0–8 are done.** Remaining work is UI depth (comms channels, CRM boards, inbox) — see plan backlog todos `ui-*`.

## Local setup

1. Neon: set `DATABASE_URL` + `DIRECT_URL` in `backend/.env`
2. `docker compose up -d` — Redis
3. Backend: `npm run prisma:generate && npm run prisma:deploy` (or migrate)
4. Backend: `npm run start:dev` (port 4000)
5. Frontend: `npm run dev` (port 3000)

## Testing gate

Each phase must pass its automated tests before the next phase starts. Phase 8 adds rate-limit, OAuth state, credit concurrency, and admin isolation regression suites.
