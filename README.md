# ApplySwipe — AI-Powered Job Discovery & Application Engine

[![Version](https://img.shields.io/badge/version-1.0.0-indigo.svg)](https://applyswipe.io)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-darkgreen.svg)](https://prisma.io/)
[![Zero Hallucinations](https://img.shields.io/badge/Grounded%20AI-Zero%20Hallucinations-emerald.svg)]()

> **The modern AI-powered job application platform.**  
> Create your verified career profile once. Discover roles through Tinder-style swiping. Let grounded AI tailor your resume, draft personalized cover letters, and prepare applications for official employer career pages — with honest, never-faked submission status.

---

## Table of Contents

1. [Product Vision](#product-vision)
2. [Key Features](#key-features)
3. [Architecture Overview](#architecture-overview)
4. [Technology Stack](#technology-stack)
5. [Folder Structure](#folder-structure)
6. [Database Schema & Models](#database-schema--models)
7. [AI Engine & Anti-Hallucination Guarantees](#ai-engine--anti-hallucination-guarantees)
8. [Job Aggregation & Multi-Source Ingestion](#job-aggregation--multi-source-ingestion)
9. [Application Automation & Legal Limitations](#application-automation--legal-limitations)
10. [Environment Variables](#environment-variables)
11. [Local Development Setup](#local-development-setup)
12. [Testing](#testing)
13. [Production Build & Deployment](#production-build--deployment)
14. [Security & Privacy Sovereignty](#security--privacy-sovereignty)

---

## 1. Product Vision

ApplySwipe transforms the grueling manual job hunt into a fluid, tactile, and intelligent experience. Traditional job seekers spend countless hours retyping the same work experience into disparate job boards and generic forms.

**The ApplySwipe Workflow:**
```
Career Profile (Single Source of Truth)
           ↓
Grounded AI Match Evaluation (0-100% Match)
           ↓
Swipe Right (Apply) / Swipe Left (Pass) / Swipe Up (Save)
           ↓
Job-Specific Tailored Resume (Grounded, No Hallucinations)
           ↓
Personalized Cover Letter & Answer Assistant
           ↓
Materials Prepared + Official Application Handoff
           ↓
Full Lifecycle Kanban Tracker
```

---

## 2. Key Features

- **Multi-Source Job Aggregation:**
  - Adzuna + Greenhouse + Lever adapters behind one `JobProvider` interface, with a
    database-driven company list (no hard-coded employers).
  - Normalization (HTML, location, salary, employment type, seniority, skills), two-level
    deduplication and per-provider freshness so the feed never shows stale or duplicate jobs.
  - Background workers with locking, retry/backoff, provider health monitoring and a
    sync history visible in the admin console.

- **Tinder-Style Swiping Experience (`/dashboard/discover`):**
  - Smooth physics-based Framer Motion card stack with keyboard shortcuts (← pass, → apply, ↑ save).
  - Cursor-paginated feed, hard filters (remote, salary, employment type, provider) and a
    transparent match breakdown (skills 35 / experience 20 / location 15 / employment 10 /
    salary 10 / seniority 10) with matched & missing skills — no invented scores.
  - Source transparency: provider label plus the employer's official application link.
  - Mobile touch drag gestures: Swipe Left = Pass, Swipe Right = Apply, Swipe Up = Save.
  - Desktop keyboard ergonomic shortcuts: `←` Pass, `→` Apply, `↑` Save.
  - Dynamic AI Match percentage badge, salary brackets, and transparent "Why You Match" breakdowns.

- **AI Job Matching Engine:**
  - Evaluates candidate profile vs job description across Skills, Seniority, Education, and Location.
  - Transparently lists **matching skills**, **missing skills**, and potential concerns.
  - Clearly labeled as an AI estimate grounded in evidence, never an absolute truth.

- **Grounded AI Resume Tailoring (Anti-Hallucination Engine):**
  - Reorders verified skills to front-load requirements of each specific employer.
  - Emphasizes relevant achievements and aligns terminology without exaggerating or inventing qualifications.
  - **Zero-Hallucination Constraint:** Compares generated content against profile facts; rejects any unverified employer or credential.
  - Maintains separate **Master Resume** and **Tailored Resumes** with side-by-side comparison.

- **Automated Cover Letters & Application QA:**
  - 3-4 paragraph concise, company-specific cover letters.
  - AI Application Assistant answers complex questions (e.g. *"Describe your experience with React"* or *"Why do you want to work here?"*) grounded in actual past projects.
  - Supports inline editing, copying, and markdown download.

- **Full Lifecycle Application Kanban Tracker (`/dashboard/applications`):**
  - Status lanes: `READY` / `READY_FOR_REVIEW` (materials prepared) → `APPLIED`
    (you confirmed the employer submission) → `INTERVIEW`, `OFFER`, `REJECTED`.
  - Detailed timeline tracking (`Discovered` → `Viewed` → `Materials Prepared` → `Submitted` → `Interview`).
  - Strict distinction: Never pretends an application was submitted when it was only prepared.

- **Autonomous AI Autopilot (`/dashboard/autopilot`):**
  - Target roles, minimum AI match score (e.g. 85%+), workplace preference, minimum salary threshold, daily application limits (e.g. 10/day), and company blocklists.
  - Two operational modes: **Review Everything** (always waits for the candidate) vs
    **Smart Apply** (prepares materials for high-match roles and queues them for one-click
    handoff to the employer's official application page). Neither mode fabricates a submission.
  - Telemetry: Displays jobs scanned, matched, prepared and queued for review.

- **10-Step Multi-Step Onboarding (`/onboarding`):**
  - Step 1: Basic Information
  - Step 2: Career Targets & Seniority
  - Step 3: Verified Technical Skills Registry
  - Step 4: Work Experience & Chronology
  - Step 5: Academic Education
  - Step 6: Projects & Open-Source Repositories
  - Step 7: Certifications & Licenses
  - Step 8: Resume Upload & Structured Parsing
  - Step 9: Compensation & Workplace Preferences
  - Step 10: "Your AI Career Profile is Ready" celebration

- **Admin Console (`/admin`):**
  - System health monitoring (Database, AI Engine, Automation Adapters).
  - Telemetry on total users, jobs, applications, and ATS sources.
  - AI Token Usage tracker with precise input/output token counts and estimated dollar costs.

---

## 3. Architecture Overview

ApplySwipe follows a modular full-stack architecture built with Next.js App Router and TypeScript, with an optional Python FastAPI microservice (resume parsing + ATS capability checks). Job aggregation runs in background workers, never inside a user request:

```
┌─────────────────────────────────────────────────────────────┐
│                   Next.js 14 App Router                     │
│  ├── Marketing Landing Page (Tailwind + Framer Motion)      │
│  ├── Auth & Cookie Session Management (Jose + Bcrypt)       │
│  ├── 10-Step Onboarding Flow                                │
│  ├── Discovery Swiper & Application Tracker                 │
│  └── API Route Handlers (REST + Zod Validation)             │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│  Service & Storage Layers    │ │   AI Abstraction Layer      │
│  ├── Application Agent       │ │   ├── OpenAI GPT-4o         │
│  ├── Job/Feed Services       │ │   ├── Google Gemini 1.5     │
│  ├── Autopilot Engine        │ │   └── Intelligent Engine    │
│  ├── S3 / Local Storage      │ │       (Zero API keys req.)  │
│  ├── Resend / SMTP Email     │ │   ├── Dedicated Prompts     │
│  └── Stripe / Paystack Gate  │ │   └── Anti-Hallucination    │
└──────────────┬───────────────┘ └─────────────┬───────────────┘
               │                               │
               ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Data Layer & Background Automation Service                 │
│  ├── Prisma ORM / PostgreSQL Schema (27 Normalized Models)  │
│  ├── Atomic Persistent JSON/SQL Store                       │
│  ├── Workers: sync · expiration · matching (locks + health) │
│  └── Python FastAPI Microservice (python-service/main.py)   │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Technology Stack

- **Frontend:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Framer Motion, Lucide React, Canvas Confetti.
- **Backend:** Next.js Route Handlers, Zod Validation, Jose (JWT), Bcrypt.js.
- **Database:** PostgreSQL & Prisma ORM 5.22, with atomic persistent fallback for zero-daemon environments.
- **Microservices:** Python 3.11, FastAPI, Uvicorn, Pydantic.
- **Testing:** Vitest unit, integration, and anti-hallucination tests.

---

## 5. Folder Structure

```
ApplySwipe/
├── data/
│   └── applyswipe.json           # Atomic persistent database store
├── prisma/
│   ├── schema.prisma             # Full Prisma 23-model PostgreSQL schema
│   └── seed.js                   # Seed script (20 jobs, demo users, apps)
├── python-service/
│   ├── main.py                   # FastAPI ATS automation microservice
│   ├── requirements.txt
│   └── README.md
├── src/
│   ├── app/
│   │   ├── (marketing)/page.tsx  # High-converting landing page (12 sections)
│   │   ├── (auth)/               # Login, Register, Forgot/Reset Password
│   │   ├── onboarding/page.tsx   # 10-step career profile wizard
│   │   ├── dashboard/
│   │   │   ├── discover/         # Tinder-style swipe interface
│   │   │   ├── applications/     # Kanban pipeline & [id] detail view
│   │   │   ├── profile/          # Persistent career profile editor
│   │   │   ├── resumes/          # Resume variants vault
│   │   │   ├── autopilot/        # Autonomous application control center
│   │   │   ├── analytics/        # Factual analytics & charts
│   │   │   └── settings/         # AI models, privacy, data export
│   │   ├── admin/page.tsx        # Telemetry, users, jobs, AI token costs
│   │   └── api/                  # REST API route handlers
│   ├── components/
│   │   ├── ui/                   # Button, Card, Badge, Dialog, Progress, Toast
│   │   └── landing/              # Header, Footer
│   ├── lib/
│   │   ├── db.ts                 # Prisma-compatible persistent repository
│   │   ├── auth/                 # JWT session, cookie handling, password hashing
│   │   ├── ai/                   # Provider abstraction, prompts, anti-hallucination validator
│   │   ├── jobs/                 # Legacy job helpers (superseded by src/jobs)
│   │   ├── rate-limit.ts         # Token-bucket limiter for feed/search
│   │   ├── logger.ts             # JSON logger with secret redaction
│   │   ├── applications/         # Application preparation agent
│   │   ├── storage/              # Storage abstraction (Local + S3)
│   │   ├── email/                # Email abstraction (Resend + SMTP + Console)
│   │   ├── payments/             # Payments abstraction (Stripe + Paystack)
│   │   └── queue/                # In-process background queue
│   ├── jobs/                     # Multi-source job aggregation
│   │   ├── providers/            # JobProvider interface + Adzuna/Greenhouse/Lever adapters
│   │   ├── ingestion/            # normalize, deduplicate, freshness, provider-state, ingest, expire
│   │   ├── matching/             # skills dictionary, weighted scoring, ranking, AI re-rank
│   │   └── services/             # job/feed/application/provider services
│   ├── workers/                  # job-sync, job-expiration, job-matching, scheduler
│   ├── services/
│   │   └── autopilot/            # Autopilot execution engine
│   └── types/                    # Shared TypeScript interfaces & enums
├── scripts/
│   ├── workers.ts                # Standalone scheduler process (npm run workers)
│   ├── jobs-sync.ts              # CLI sync (--provider, --dry-run, --max-sources, ...)
│   ├── jobs-expire.ts            # CLI freshness sweep
│   ├── jobs-match.ts             # CLI matching/enrichment worker
│   ├── backfill-jobs.ts          # Idempotent data upgrade for pre-ingestion rows
│   └── seed-job-sources.ts       # Demo Greenhouse/Lever boards
└── tests/
    ├── setup/                    # Test DB copy + offline env (no provider keys needed)
    ├── unit/                     # Adapters, normalization, dedupe, freshness, scoring, security
    └── integration/              # Feed, ingestion pipeline, application agent
```

---

## 6. Database Schema & Models

The Prisma schema (`prisma/schema.prisma`) defines 27 normalized models (PostgreSQL):

| Model | Purpose |
|---|---|
| `User` | User identity, credentials, roles (`USER`, `ADMIN`), verification status |
| `Profile` | Persistent single source of truth (headline, bio, location, salary) |
| `Skill` | Normalized candidate skills with category, years, and level |
| `Experience` | Employment records with dates, achievements, technologies |
| `Education` | Academic history, degrees, fields of study |
| `Project` | Engineering projects, live URLs, GitHub repositories |
| `Certification` | Professional credentials (AWS, GCP, etc.) |
| `Resume` | Master resume records and raw text |
| `ResumeVersion` | Job-specific tailored resume variants with target role and score |
| `Job` | Canonical aggregated position: provider, normalized location/salary/employment/seniority, skills, fingerprint, `sources[]`, freshness (`firstSeenAt`/`lastSeenAt`/`seenCount`), `isActive` |
| `JobSource` | Configured company source per provider (Greenhouse board token, Lever slug, Adzuna profile) + sync state |
| `ProviderState` | Per-provider health: status, lock, last sync/success/error, consecutive failures, cadence |
| `ProviderSyncRun` | Sync history with per-run statistics and error messages |
| `JobMatchScore` | Cached deterministic/AI match scores per user + job |
| `JobInteraction` | User engagement tracking (`VIEWED`, `PASSED`, `SAVED`, `APPLIED`) |
| `SavedJob` | Bookmarked job postings with candidate notes |
| `Application` | Tracked application (status, mode, `submissionMethod`, `appliedAt`, match explanation) |
| `ApplicationAnswer` | AI-generated answers to employer questions |
| `ApplicationDocument` | Tailored resumes, cover letters, and supporting assets |
| `ApplicationEvent` | Comprehensive audit timeline events for each application |
| `UserPreference` | Targeting preferences (roles, remote, minimum salary) |
| `AutopilotSetting` | Autopilot controls (limits, minimum match, excluded list) |
| `Notification` | System, interview, and match alerts |
| `Subscription` | Pro and Enterprise subscription management |
| `Payment` | Stripe and Paystack payment records |
| `AIUsage` | Token consumption and cost telemetry tracker |
| `AuditLog` | Security and access audit logging |

---

## 7. AI Engine & Anti-Hallucination Guarantees

### Strict Grounding Rules
1. **Never Fabricate Qualifications:** ApplySwipe will **never** invent employers, job titles, certifications, academic degrees, or unlisted skill proficiencies.
2. **Missing Skill Flagging:** If an employer requires a skill not present in your profile, the AI engine flags it transparently under `missingSkills` instead of falsely claiming it.
3. **Automated Verification:** The `ResumeValidator` verifies that every employer and technology in the generated output matches your verified profile before saving.

### Configurable Model Abstraction
- **Intelligent Local Engine (Default):** Runs immediately with zero configuration and zero API keys required.
- **OpenAI GPT-4o:** Enable by providing `OPENAI_API_KEY`.
- **Google Gemini 1.5:** Enable by providing `GEMINI_API_KEY`.

---

## 8. Job Aggregation & Multi-Source Ingestion

ApplySwipe aggregates jobs from official, documented APIs into **one canonical
`Job` table** that the whole product reads from. Providers are pluggable through
a single interface (`src/jobs/providers/types.ts`):

```typescript
interface JobProvider {
  name: ProviderName;                 // "ADZUNA" | "GREENHOUSE" | "LEVER"
  label: string;                      // shown to users ("Adzuna", "Company career page")
  requiresSource: boolean;            // Greenhouse/Lever need a configured company
  supportsSearch: boolean;            // Adzuna searches, ATS boards list
  search(params, context): Promise<NormalizedJob[]>;
  getJob(externalId, context): Promise<NormalizedJob | null>;
}
```

Shipped providers:

| Provider | Auth | Source configuration | Notes |
| --- | --- | --- | --- |
| **Adzuna** | `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` (server-side only) | optional search profiles (`ADZUNA_DEFAULT_QUERY`) | aggregated listings; salaries flagged when *predicted*; always `MANUAL_REQUIRED` |
| **Greenhouse** | none (public board API) | one `JobSource` row per company + board token | official employer postings |
| **Lever** | none (public postings API) | one `JobSource` row per company + slug | official employer postings |

Only these three providers exist. Companies are **never hard-coded**: Greenhouse
board tokens and Lever slugs live in the database (`JobSource`) and are managed
from the admin console (`/admin` → Job Sources) or `POST /api/admin/sources`.

### Ingestion pipeline

```
provider.search() ─► normalize ─► dedupe (L1/L2) ─► upsert ─► freshness sweep ─► provider health
```

1. **Normalize** (`src/jobs/ingestion/normalize.ts`) – HTML cleanup (`<script>`
   bodies dropped, block tags become newlines, escaped markup decoded), location
   + workplace type (remote/hybrid/on-site), salary (range, currency, interval,
   annualized, predicted flag), employment type, seniority, and deterministic
   skill extraction from a curated dictionary. Validation rejects payloads
   without a title, safe URLs or a usable description.
2. **Deduplicate** (`deduplicate.ts`) –
   - **Level 1**: same `provider + externalId` → update in place (swipes, saved
     jobs, applications and documents stay attached).
   - **Level 2**: same fingerprint (`company + normalized title + normalized
     location + application domain`, aggregator hosts ignored) → merge into the
     canonical row and attach the extra provider as an alternative source.
     Duplicates are never shown in the feed.
3. **Freshness** (`freshness.ts`) – every sync refreshes `lastSeenAt`, and a job
   that stops being returned is deactivated (`isActive = false`) after its
   provider window; records are **never deleted**, so application history
   survives. A job that reappears is reactivated automatically.

| Provider | Freshness window | Sync interval |
| --- | --- | --- |
| Adzuna | 48 h (`JOB_FRESHNESS_ADZUNA_HOURS`) | every 2 h (`JOB_SYNC_INTERVAL_ADZUNA_MIN`) |
| Greenhouse | 72 h (`JOB_FRESHNESS_GREENHOUSE_HOURS`) | every 6 h |
| Lever | 72 h (`JOB_FRESHNESS_LEVER_HOURS`) | every 6 h |

### Workers & scheduling

| Worker | Cadence | Entry point |
| --- | --- | --- |
| Job sync | 15 min tick, per-provider due check | `runScheduledJobSync()` / `POST /api/cron/jobs/sync` |
| Job expiration | 12 h | `runJobExpiration()` / `POST /api/cron/jobs/expire` |
| Matching + AI enrichment | 6 h | `runJobMatching()` / `POST /api/cron/jobs/match` |

Runs are protected by a per-provider lock (`JOB_SYNC_LOCK_TTL_MS`), every
provider failure is recorded on the provider health state, and one broken
provider never blocks the others. Three ways to run them:

- **In-process scheduler** (default): `src/instrumentation.ts` starts the
  scheduler once per process – `JOBS_SCHEDULER_ENABLED=false` to disable.
- **Dedicated process**: `npm run workers` (recommended for containers/cron-less hosts).
- **External cron / platform scheduler**: `POST /api/cron/jobs/{sync|expire|match}`
  with `Authorization: Bearer $CRON_SECRET`.

### API surface

| Endpoint | Purpose |
| --- | --- |
| `GET /api/jobs/feed` | Personalized swipe feed (auth, cursor pagination, hard filters, match scores, diversity cap) |
| `GET /api/jobs/search` | Search the local normalized database (`q`, location, provider, employment, salary, remote) |
| `GET /api/jobs/:id` | Job detail + deterministic match breakdown |
| `POST /api/jobs/:id/swipe` | `{ action: "LIKE" \| "PASS" \| "SUPER_LIKE" }` – idempotent, 409 on duplicates/inactive |
| `POST /api/jobs/:id/apply` | Prepare an application (materials only – see §9) |
| `POST /api/jobs/:id/save` · `/pass` | Quick actions used by the swipe UI |
| `POST /api/applications/:id/apply-confirmation` | The user confirms they applied on the employer site → status `APPLIED` |
| `GET/PATCH /api/admin/providers`, `POST /api/admin/providers/sync` | Provider health, enable/disable, "sync now" |
| `GET /api/admin/sync-runs` | Sync history with per-run statistics and errors |
| `GET/POST/PATCH /api/admin/sources` | Company source CRUD (board token / slug validation, duplicate detection) |
| `GET/PATCH/POST /api/admin/jobs` | Job directory, deactivate/report, manual insert |
| `POST /api/cron/jobs/:task` | Scheduler entry points (`sync`, `expire`, `match`) |

### CLI

```bash
npm run jobs:seed-sources                 # demo Greenhouse/Lever boards (Linear, Figma, Mistral, Netflix)
npm run jobs:backfill                     # idempotent backfill for pre-upgrade rows (provider, fingerprint, searchText, health rows)
npm run jobs:sync                         # all providers
npm run jobs:sync:adzuna                  # one provider
npm run jobs:sync:dry                     # fetch + normalize, never write
npm run jobs:expire                       # freshness sweep
npm run jobs:match -- --user alex@applyswipe.io
npm run workers                           # standalone scheduler process
```

---

## 9. Application Automation & Legal Limitations

ApplySwipe is engineered for ethical, legally compliant application management:

- **No CAPTCHA bypasses, no MFA circumvention, no ToS violations.** The
  application agent only prepares materials; it never drives a browser through
  an employer's protected flow.
- **Status truthfulness (Rule 40).** ApplySwipe only reports what actually
  happened:
  - Preparing materials → `PREPARING` / `READY` / `READY_FOR_REVIEW`.
  - The agent **never** sets `SUBMITTED`, never invents an
    `externalApplicationId`, and always returns
    `requiresManualHandoff: true`.
  - The one path to `APPLIED` is the candidate confirming their own submission
    on the employer's site: `POST /api/applications/:id/apply-confirmation`
    (recorded with `submissionMethod: "USER_CONFIRMED_EXTERNAL"`, `appliedAt` and
    an audit event + notification).
- **Official application pages only.** `resolveOfficialApplicationUrl()` prefers
  a non-aggregator source reference, then the job's own application URL, and
  falls back to the source URL. Aggregator redirects (Adzuna/Indeed/LinkedIn/
  Glassdoor) are never presented as the employer's page, and every outbound URL
  is validated (`https`/`http` only) before it reaches the UI.
- **Transparency in the UI.** Cards show the provider label ("Adzuna", "Company
  career page"), the official link and the match breakdown, so the candidate
  always knows where an application is going and how the score was computed.

---

## 10. Environment Variables

Copy `.env.example` to `.env`. Only the first block is required for local
development – every job-provider value is optional.

```env
# Core
DATABASE_URL="postgresql://user:password@localhost:5432/applyswipe"
AUTH_SECRET="applyswipe-super-secret-jwt-key-change-in-production"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
APPLYSWIPE_DB_FILE="data/applyswipe.json"   # JSON store used by dev/test

# Job providers (server-side only)
ADZUNA_APP_ID=""  ADZUNA_APP_KEY=""  ADZUNA_COUNTRY="gb"
ADZUNA_DEFAULT_QUERY="software engineer"  ADZUNA_MAX_PAGES_PER_SYNC="2"
JOBS_HTTP_TIMEOUT_MS="12000"  JOBS_HTTP_RETRIES="2"

# Freshness / cadence (defaults shown)
JOB_FRESHNESS_ADZUNA_HOURS="48"
JOB_FRESHNESS_GREENHOUSE_HOURS="72"
JOB_FRESHNESS_LEVER_HOURS="72"
JOB_SYNC_INTERVAL_ADZUNA_MIN="120"
JOB_SYNC_INTERVAL_GREENHOUSE_MIN="360"
JOB_SYNC_INTERVAL_LEVER_MIN="360"
JOB_FEED_HORIZON_DAYS="45"

# Matching
MATCH_WEIGHTS_JSON='{"skills":35,"experience":20,"location":15,"employment":10,"salary":10,"seniority":10}'
JOB_AI_RERANK_ENABLED="true"  JOB_AI_RERANK_TOP="20"

# Rate limiting
RATE_LIMIT_FEED_BURST="30"  RATE_LIMIT_FEED_PER_MINUTE="60"

# Workers / cron
JOBS_SCHEDULER_ENABLED="true"
CRON_SECRET=""                     # required in production for /api/cron/jobs/*
JOBS_ALLOW_UNPROTECTED_CRON="false"

# Optional AI providers (the grounded local engine is the default)
OPENAI_API_KEY=""  GEMINI_API_KEY=""

# Storage / email / payments
S3_BUCKET="applyswipe-documents"  RESEND_API_KEY=""
STRIPE_SECRET_KEY=""  PAYSTACK_SECRET_KEY=""
```

Secrets are read in server modules only: provider API keys never appear in API
responses, client bundles or logs (the logger redacts `*_KEY`, `*_SECRET`,
`*_TOKEN`, `*_PASSWORD`). The admin console shows the *names* of missing
environment variables, never their values.

---

## 11. Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed Database
```bash
npm run seed
```
Seeds 20 realistic tech jobs across Linear, Vercel, Stripe, Supabase, Datadog, Anthropic, Acme Corp, etc., along with a complete candidate profile and admin credentials:
- **Demo Candidate:** `alex@applyswipe.io` / `password123`
- **System Admin:** `admin@applyswipe.io` / `admin123`

### 3. Configure job sources & ingest

```bash
# Optional: add demo Greenhouse/Lever boards (companies are DB rows, not code)
npm run jobs:seed-sources

# Upgrade existing local data to the multi-source model (idempotent)
npm run jobs:backfill

# Verify provider connectivity without writing anything
npm run jobs:sync:dry

# Real syncs
npm run jobs:sync:greenhouse
npm run jobs:sync:lever
npm run jobs:sync:adzuna           # needs ADZUNA_APP_ID / ADZUNA_APP_KEY
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

The in-process scheduler is enabled by default, so jobs keep refreshing while
`npm run dev` is running. To run the scheduler separately instead:
`npm run workers` (and set `JOBS_SCHEDULER_ENABLED="false"` in `.env`).

---

## 12. Testing

```bash
npm test          # vitest run
npm run typecheck # tsc --noEmit
npm run lint      # next lint
```

The suite is fully offline: provider HTTP calls are mocked and the integration
tests run against a throwaway copy of the JSON store
(`tests/setup/global-setup.ts` → `data/applyswipe.test.json`), so PostgreSQL and
provider credentials are not required.

| Area | Files | What is verified |
| --- | --- | --- |
| Provider adapters | `tests/unit/providers/{adzuna,greenhouse,lever}.test.ts` | response mapping, missing-field payloads, credential handling, 404/429/5xx mapping, retries + backoff |
| Normalization | `tests/unit/normalize.test.ts` | HTML/entity cleanup, remote/hybrid/on-site detection, salary parsing + annualization (no invented ranges), employment/seniority, unsafe URL rejection |
| Deduplication | `tests/unit/deduplicate.test.ts` | level-1 identity, fingerprint stability, aggregator-domain handling, inactive/merged exclusions, source-ref merging (cap 10) |
| Freshness | `tests/unit/freshness.test.ts` | per-provider windows, env overrides, `EXPIRED` vs `NOT_SEEN`, feed horizon, scheduler due checks |
| Matching | `tests/unit/matcher.test.ts`, `tests/unit/scoring.test.ts` | 35/20/15/10/10/10 weights + overrides, strong/weak scoring, hard-filter reasons, recommendation bands, company diversity cap |
| Feed & swipes | `tests/integration/feed.test.ts` | ranking metadata, `rawData` never serialized, exclusions (passed/liked/saved/applied), cursor pagination (no repeats, stale cursor restart), idempotent swipes, 409 on duplicates/inactive |
| Ingestion pipeline | `tests/integration/ingest.test.ts`, `tests/integration/pipeline.test.ts` | L1 update in place, L2 merge, deactivation without deletion, provider health + sync-run history, provider lock release, failure isolation, Adzuna credentials in-request only |
| Security | `tests/unit/security.test.ts` | URL scheme validation, official-URL resolution, no provider secrets in output, token-bucket rate limiter |
| Applications | `tests/integration/workflow.test.ts`, `tests/unit/validator.test.ts` | materials generation, `READY_FOR_REVIEW` truthfulness (never `SUBMITTED`/`APPLIED`), anti-hallucination resume validator |

---

## 13. Production Build & Deployment

```bash
npm run build
npm run start
```

### Requirements

1. **PostgreSQL** – set `DATABASE_URL` and apply the migrations:
   ```bash
   npx prisma migrate deploy
   ```
   The ingestion upgrade adds provider columns, the level-2 dedupe fingerprint,
   `salaryIsPredicted`, `ProviderState`/`ProviderSyncRun` tables and the
   supporting indexes (`20261004000000_job_ingestion_enums`,
   `20261004000100_job_ingestion_upgrade`). The development/test JSON store is
   an adapter over the same models, so no migration is needed for local runs.
2. **Secrets** – `AUTH_SECRET` and (for external cron) `CRON_SECRET`. Adzuna needs
   `ADZUNA_APP_ID`/`ADZUNA_APP_KEY`; Greenhouse/Lever boards are public.
3. **A scheduler** – pick exactly one:
   - in-process: leave `JOBS_SCHEDULER_ENABLED="true"` (single instance only),
   - dedicated: `npm run workers` (set `JOBS_SCHEDULER_ENABLED="false"`),
   - platform cron: `POST /api/cron/jobs/{sync|expire|match}` with
     `Authorization: Bearer $CRON_SECRET` every 15 min / 12 h / 6 h.
   The cron endpoints return **503** in production when `CRON_SECRET` is unset,
   so an unprotected deployment cannot be triggered by strangers.
4. **Node 18+** (developed on Node 22) and a host that can reach
   `api.adzuna.com`, `boards-api.greenhouse.io` and `api.lever.co`.

### Operational notes

- Adding a company is a data operation: `POST /api/admin/sources` with
  `{ provider: "GREENHOUSE", companyName, boardToken }` (or `LEVER` + slug).
  Nobody edits code to track a new employer.
- Provider health, sync history and "sync now" live in the admin console
  (`/admin` → Providers), backed by `ProviderState` / `ProviderSyncRun`.
- Feed performance: `/api/jobs/feed` never calls a provider or an LLM. It reads
  the local database (indexed on `provider`, `isActive`, `postedAt`,
  `fingerprint`, `canonicalJobId`), scores with a pure function, and AI
  re-ranking only ever touches the top `JOB_AI_RERANK_TOP` slice with a
  12-hour cache.
- Jobs are deactivated, never deleted, so applications and swipe history remain
  intact.

---

## 14. Security & Privacy Sovereignty

- **HTTP-only session cookies:** HMAC-SHA256 (Jose) tokens with secure expiration flags; `requireAuth()` on every user endpoint and `requireAdmin()` on the whole `/api/admin/*` surface.
- **Server-only secrets:** provider API keys (Adzuna) and LLM keys are read in server modules. `/api/admin/providers` returns configuration *state* and the names of missing env vars, never values. The JSON logger redacts `*_KEY`, `*_SECRET`, `*_TOKEN`, `*_PASSWORD`.
- **Sanitized provider HTML:** descriptions are converted to plain text (`<script>`/`<style>` bodies dropped, entities decoded, length capped) before storage and before serialization. Nothing from a provider is ever rendered with `dangerouslySetInnerHTML`.
- **Validated outbound URLs:** a job only keeps `http(s)` URLs; `javascript:`, `data:` and malformed values are rejected at ingest time and re-checked on serialization. The UI opens official employer pages in a new tab with `noopener,noreferrer`.
- **Rate limiting:** token-bucket limiter on the feed and search endpoints (`RATE_LIMIT_FEED_*`, `RATE_LIMIT_SEARCH_*`) with `429` + `Retry-After` and `x-ratelimit-*` headers.
- **Protected cron surface:** `/api/cron/jobs/*` requires `Authorization: Bearer $CRON_SECRET` and returns `503` in production when the secret is unset (`JOBS_ALLOW_UNPROTECTED_CRON` is a local-development escape hatch only).
- **Provider isolation & idempotency:** per-provider locks, bounded retries with backoff, tolerated `429`s, and failures confined to one provider/source. Duplicate protection is enforced in the database layer (L1 + L2) so retries can never create duplicate jobs, and swipes are idempotent (`409` for duplicate/inactive listings).
- **Data sovereignty:** all aggregation data lives in your own PostgreSQL database (or the local JSON store for development). Nothing is proxied through ApplySwipe: the browser talks to your deployment and the browser opens the employer page directly.
- **Honest failure modes:** when a provider is misconfigured or down, the feed keeps serving the jobs already in the database, the provider is flagged in the admin console, and the failed sync is recorded — user-facing features never silently degrade into fabricated data.

---

## 15. ApplySwipe Color System & Visual Identity

ApplySwipe utilizes a modern **Indigo + Violet** brand identity rather than the typical generic blue/green job-board look, reflecting a high-tier AI product aesthetic.

### Color Tokens

| Purpose | Light Mode | Dark Mode |
|---|---|---|
| **Background** | `#F7F8FC` | `#05070D` |
| **Card** | `#FFFFFF` | `#0D1322` |
| **Card Hover** | `#F1F3F9` | `#131C31` |
| **Primary** | `#5B5CE2` | `#6366F1` |
| **Primary Hover** | `#4F46E5` | `#818CF8` |
| **Secondary** | `#7C3AED` | `#8B5CF6` |
| **Like / Apply** | `#16A34A` | `#22C55E` |
| **Like Hover** | `#15803D` | `#4ADE80` |
| **Pass** | `#E11D48` | `#FB7185` |
| **Text** | `#111827` | `#F8FAFC` |
| **Secondary Text** | `#64748B` | `#94A3B8` |
| **Border** | `#E2E8F0` | `rgba(255, 255, 255, 0.08)` |

### Brand Gradients
- **Standard Brand Gradient:** `linear-gradient(135deg, #6366F1, #8B5CF6)`
- **Premium Brand Gradient:** `linear-gradient(135deg, #6366F1 0%, #7C3AED 50%, #A855F7 100%)` (used for logo, key headings, AI badges, and selected states).

### Action Buttons
- **Like / Apply Button:**
  - *Light Mode:* Background `#16A34A`, Text `#FFFFFF`, Hover `#15803D`, Box Shadow `0 8px 25px rgba(22, 163, 74, 0.25)`.
  - *Dark Mode:* Background `#22C55E`, Text `#052E16`, Hover `#4ADE80`, Box Shadow `0 8px 30px rgba(34, 197, 94, 0.25)`.
  - Subtle light sweep highlight animation on hover.
- **Pass Button:**
  - *Light Mode:* Background `#FFF1F2`, Text `#E11D48`, subtle rose glow `0 8px 24px rgba(225, 29, 72, 0.20)`.
  - *Dark Mode:* Background `rgba(244, 63, 94, 0.12)`, Text `#FB7185`, subtle rose glow `0 8px 24px rgba(251, 113, 133, 0.25)`.

### Job Cards
- *Light Mode:* Background `#FFFFFF`, Border `1px solid #E2E8F0`, Shadow `0 10px 30px rgba(15, 23, 42, 0.06)`.
- *Dark Mode:* Background `#0D1322`, Border `1px solid rgba(255, 255, 255, 0.08)`, Shadow `0 15px 45px rgba(0, 0, 0, 0.35)`.
- *Hover:* Card shifts smoothly toward `#131C31` (Dark Mode) or `#F1F3F9` (Light Mode) with a subtle indigo border (`rgba(99, 102, 241, 0.35)` / `rgba(91, 92, 226, 0.35)`).
