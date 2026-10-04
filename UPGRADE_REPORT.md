# ApplySwipe — Multi-Source Job Aggregation Upgrade Report

_Branch: `arena/01a10881-applyswipe` · Date: 2026-10-04_

## Verification status

| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` (`tsc --noEmit`) | ✅ clean |
| Lint | `npm run lint` (next/core-web-vitals) | ✅ 0 errors (5 pre-existing `exhaustive-deps` warnings) |
| Tests | `npm test` (vitest) | ✅ **14 files / 101 tests** |
| Build | `npm run build` | ✅ compiled successfully, 33 routes |
| Runtime smoke test | `npm run dev` + HTTP calls | ✅ see §9 |
| Data upgrade | `npm run jobs:backfill`, `jobs:seed-sources` | ✅ 20 jobs + 3 sources migrated, 4 demo boards added |
| Provider sync | `npm run jobs:sync:dry` / `:greenhouse` | ⚠️ blocked in this sandbox (no outbound HTTPS, see §8) — verified against mocked transports instead |

## 1. Providers

| Provider | Auth | Source configuration | Application type |
| --- | --- | --- | --- |
| **Adzuna** | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` (server-only) | optional stored search profiles, else `ADZUNA_DEFAULT_QUERY` | `MANUAL_REQUIRED` (aggregator redirect → never the official page) |
| **Greenhouse** | none (public board API) | one `JobSource` row per company (`boardToken`) | `API_SUPPORTED` |
| **Lever** | none (public postings API) | one `JobSource` row per company (slug) | `API_SUPPORTED` |

Exactly three providers exist; companies are database rows, never code. The
shared contract lives in `src/jobs/providers/types.ts`
(`JobProvider { name, label, requiresSource, supportsSearch, search, getJob }`),
the registry in `src/jobs/providers/index.ts`, and the shared HTTP client
(`fetchJson`, timeouts, retries with backoff, `Retry-After`, error taxonomy
`CONFIG | HTTP | RATE_LIMIT | MALFORMED | NETWORK`) in `src/jobs/providers/http.ts`.

Legacy `src/lib/jobs/adapter.ts` (Greenhouse/Lever/PermittedFeed stubs) is no
longer used by any ingestion path and is kept only as a compatibility shim.

## 2. Files created

**Pipeline** (`src/jobs/`)
- `providers/{types,http,adzuna,greenhouse,lever,index}.ts`
- `ingestion/{normalize,deduplicate,freshness,provider-state,ingest,expire}.ts`
- `matching/{skills,score,ranking,ai-rerank}.ts`
- `services/{job-service,feed-service,application-service,provider-service}.ts`

**Workers** (`src/workers/`) — `job-sync.ts`, `job-expiration.ts`,
`job-matching.ts`, `scheduler.ts`; boot hook `src/instrumentation.ts` +
`src/instrumentation-node.ts` (Node-only half, so the edge compiler never
resolves `fs`/`crypto`).

**API** — `api/jobs/feed`, `api/jobs/search`, `api/jobs/[id]/swipe`,
`api/admin/{providers,providers/sync,sync-runs}`, `api/cron/jobs/[task]`,
`api/applications/[id]/apply-confirmation`.

**Tooling** — `scripts/{jobs-sync,jobs-expire,jobs-match,backfill-jobs,seed-job-sources,workers}.ts`,
`src/lib/logger.ts` (JSON logs + secret redaction), `src/lib/rate-limit.ts`
(token bucket), `.eslintrc.json`, `next.config.mjs`, `tests/setup/*`,
`tests/unit/{normalize,deduplicate,freshness,scoring,security}.test.ts`,
`tests/unit/providers/{adzuna,greenhouse,lever}.test.ts`,
`tests/integration/{feed,ingest,pipeline}.test.ts`.

## 3. Files modified

- **Data model** — `prisma/schema.prisma` (27 models), `src/types/index.ts`
  (`Job` provider/fingerprint/freshness/`salaryIsPredicted` fields, `FeedJob`
  match metadata, `MatchAnalysis` component scores, `ProviderState`,
  `ProviderSyncRun`, `JobMatchScore`).
- **Endpoints** — `api/jobs/route.ts`, `api/jobs/[id]/{route,apply,pass,save}`,
  `api/admin/{jobs,sources,stats}`, `api/applications/[id]/route.ts`.
- **UI** — `dashboard/discover/page.tsx` (feed API, cursor prefetch, filters,
  apply modal + official link + “I’ve submitted it”), `dashboard/applications/page.tsx`
  (`APPLIED` stage), `dashboard/applications/[id]/page.tsx` (official link +
  confirmation instead of fake submit), `admin/page.tsx` (Providers tab: health
  cards, sync-now, sync history; Sources tab: add/pause company),
  `(auth)/{login,verify-email}`, `(marketing)/page.tsx`, `onboarding/page.tsx`
  (lint fixes).
- **AI + application flow** — `src/lib/ai/provider.ts` (`analyzeMatch` now
  delegates to the deterministic engine), `src/lib/applications/agent.ts`
  (never claims submission), `src/services/autopilot/index.ts` (telemetry
  wording), `src/lib/db.ts` (new tables), `package.json` (scripts + tsx/eslint
  devDeps), `.gitignore`, `.env.example`, `README.md` (§8–§14 rewritten/expanded),
  `data/applyswipe.json` (backfilled dev dataset), `tests/*`.

## 4. Migrations

`prisma/migrations/`
- `20261004000000_job_ingestion_enums/migration.sql` — new enum values
  (`JobProviderName`, `WorkplaceType`, `SyncRunStatus`, application statuses).
- `20261004000100_job_ingestion_upgrade/migration.sql` — additive columns on
  `Job` (`provider`, `originalLocation`, `workplaceType`, `seniority`,
  `salaryInterval`, **`salaryIsPredicted`**, `searchText`, `sourceUrl`,
  `fingerprint`, `canonicalJobId`, `sources`, `firstSeenAt`, `lastSeenAt`,
  `seenCount`, `rawData`), `JobSource` provider/sync columns, `Application`
  `appliedAt`/`resumeId`/`coverLetterId`, new tables `ProviderState`,
  `ProviderSyncRun`, `JobMatchScore`, plus indexes on `provider`, `isActive`,
  `postedAt`, `fingerprint`, `canonicalJobId`, provider/lock state.
- `0_init/migration.sql` — baseline (pre-existing).

> The Prisma CLI could not run in this sandbox (engine download blocked), so the
> SQL was generated and reviewed by hand; it has **not** been executed against a
> live PostgreSQL. The JSON store used by dev/tests mirrors the same shape.
> `npm run jobs:backfill` is the data equivalent for existing rows (idempotent).

## 5. Environment variables

All documented in `.env.example` and README §10.

- **Core**: `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `APPLYSWIPE_DB_FILE`.
- **Provider keys**: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `ADZUNA_COUNTRY`,
  `ADZUNA_DEFAULT_QUERY`, `ADZUNA_DEFAULT_LOCATION`, `ADZUNA_MAX_PAGES_PER_SYNC`,
  `ADZUNA_BASE_URL`, `GREENHOUSE_BASE_URL`, `LEVER_BASE_URL`.
- **HTTP**: `JOBS_HTTP_TIMEOUT_MS`, `JOBS_HTTP_RETRIES`.
- **Freshness/cadence**: `JOB_FRESHNESS_{ADZUNA,GREENHOUSE,LEVER}_HOURS`
  (48/72/72), `JOB_SYNC_INTERVAL_{ADZUNA,GREENHOUSE,LEVER}_MIN` (120/360/360),
  `JOB_SYNC_LOCK_TTL_MS`, `JOB_FEED_HORIZON_DAYS`.
- **Matching**: `MATCH_WEIGHTS_JSON`, `JOB_MATCH_KEEP_PER_USER`,
  `JOB_AI_RERANK_{ENABLED,TOP,CACHE_HOURS,MAX_PER_RUN}`.
- **Rate limits**: `RATE_LIMIT_{FEED,SEARCH}_{BURST,PER_MINUTE}`.
- **Workers/cron**: `JOBS_SCHEDULER_{ENABLED,TICK_MS,BOOT_DELAY_MS}`,
  `JOBS_EXPIRATION_INTERVAL_MS`, `JOBS_MATCHING_INTERVAL_MS`, `CRON_SECRET`,
  `JOBS_ALLOW_UNPROTECTED_CRON`.
- Existing app vars (AI keys, S3, Resend, Stripe/Paystack, Redis) unchanged.

## 6. Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/jobs/feed` | auth, cursor pagination (`cursor`,`limit`≤30), `remote`, `minScore`, `employmentType`, `provider`, `query`, `location`, `includeSaved`; excludes passed/liked/super-liked/applied (and saved); returns ranked jobs + `meta` (weights, scanned/hard-filtered counts, nextCursor) |
| GET | `/api/jobs/search` | searches the **local** normalized DB only (`q`, location, provider, employment, salary, remote, page/limit) |
| GET | `/api/jobs/:id` | detail + deterministic match breakdown |
| POST | `/api/jobs/:id/swipe` | `{ action: LIKE \| PASS \| SUPER_LIKE }`, idempotent, `409` for duplicates/inactive, `400` for unknown action |
| POST | `/api/jobs/:id/apply` | prepare materials (never submits) |
| POST | `/api/jobs/:id/save`, `/pass` | quick actions used by the swipe UI |
| POST | `/api/applications/:id/apply-confirmation` | user-confirmed external submission → `APPLIED` + `appliedAt` + event/notification |
| GET/PATCH | `/api/admin/providers` | provider health, enable/disable |
| POST | `/api/admin/providers/sync` | admin “sync now” (lock-protected) |
| GET | `/api/admin/sync-runs` | sync history with stats/errors |
| GET/POST/PATCH | `/api/admin/sources` | company source CRUD/validation |
| GET/PATCH/POST | `/api/admin/jobs` | job directory, report/deactivate, manual insert |
| GET | `/api/admin/stats` | telemetry incl. provider summary + scheduler status |
| GET/POST | `/api/cron/jobs/{sync\|expire\|match}` | `CRON_SECRET` protected; GET reports due/protection state; 503 in production without a secret |

## 7. Background jobs

| Worker | Cadence | Idempotency / safety |
| --- | --- | --- |
| Job sync | 15 min tick, per-provider due check (Adzuna 2 h, Greenhouse 6 h, Lever 6 h) | DB provider lock with TTL, L1/L2 dedupe, `fetched/inserted/updated/duplicates/failed/deactivated` stats, per-source error capture |
| Job expiration | 12 h | deactivates (`isActive=false`) jobs past `expiresAt` or their provider freshness window; **never deletes**; grace window for brand-new jobs |
| Matching + AI enrichment | 6 h | recomputes per-user match scores (top-N), caches AI re-rank (12 h) with a signature check |

Entry points: in-process scheduler (`src/instrumentation.ts`), standalone
process (`npm run workers`), cron endpoints, and admin “sync now”.

## 8. Limitations

- **No live provider call was possible in this sandbox** (outbound TLS to
  `boards-api.greenhouse.io`/`api.lever.co`/`api.adzuna.com` fails), so real
  Adzuna/Greenhouse/Lever responses were not exercised. The adapters, the full
  ingest pipeline and the workers are covered by tests that inject a mocked
  `fetchImpl` (`tests/integration/pipeline.test.ts`), and the scheduler was
  observed running in `npm run dev` (recording provider failures and history
  correctly).
- **Prisma migrations unexecuted** (CLI engine unavailable). The JSON store is
  the runtime for dev/tests; PostgreSQL is deployed via `prisma migrate deploy`.
- **Feed reads the full active job set into memory** for ranking (single query,
  no N+1, no provider/LLM call). With the JSON store that is fine; a Prisma +
  `groupBy`/indexed pagination pushdown is the natural next step for very large
  corpora.
- `providerHealthReport()` (admin only) filters jobs in memory per provider —
  fine at current scale, replaceable with `job.count`/`groupBy`.
- **AI re-ranking runs through the grounded local engine** unless
  `OPENAI_API_KEY`/`GEMINI_API_KEY` are set; it is bounded (`JOB_AI_RERANK_TOP`)
  and cached.
- `python-service` (`/api/v1/parse-resume`, `/api/v1/verify-ats`) is unchanged and
  optional; the TypeScript pipeline works without it.
- `next@14.2.25` has a known advisory outstanding (unchanged from before).
- Legacy demo jobs have no provider of their own; `jobs:backfill` labels them
  `LEGACY` (or infers from their source label) and gives them fingerprints.

## 9. Deployment requirements

1. **PostgreSQL** + `npx prisma migrate deploy` (three migrations, additive).
2. **Secrets**: `AUTH_SECRET`; `CRON_SECRET` if cron endpoints are exposed;
   `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` for Adzuna (Greenhouse/Lever need none).
3. **Exactly one scheduler**: in-process (`JOBS_SCHEDULER_ENABLED=true`, single
   instance), a dedicated `npm run workers` process (recommended), or platform
   cron hitting `/api/cron/jobs/{sync,expire,match}` every 15 min / 12 h / 6 h.
4. **Node 18+** (developed on Node 22) with outbound HTTPS to the three provider
   hosts; no inbound requirement beyond the app itself.
5. Seeding: `npm run seed` (demo data) → `npm run jobs:seed-sources` (demo
   boards) → `npm run jobs:backfill` (idempotent data upgrade) → `npm run jobs:sync`.

### Runtime smoke test performed

`npm run dev` (0.0.0.0:3000) + HTTP: `/` 200 · `/api/jobs/feed` 401 unauth →
login → 200 (20 scanned, 8 ranked, cursor, correct weights, no `rawData`,
official employer URL) · `/api/jobs/search?q=react` 200 · `POST
/api/jobs/job-loom-20/swipe` 400/200/200 (idempotent, feed shrank 8→7, exactly
one interaction row) · admin 403 for a non-admin · providers/sources/sync-runs/
stats 200 · cron GET + POST expire 200 (`evaluated: 20, deactivated: 0`) ·
`/dashboard/discover`, `/dashboard/applications`, `/admin` 200.
