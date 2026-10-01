# ApplySwipe — AI-Powered Job Discovery & Application Engine

[![Version](https://img.shields.io/badge/version-1.0.0-indigo.svg)](https://applyswipe.io)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-darkgreen.svg)](https://prisma.io/)
[![Zero Hallucinations](https://img.shields.io/badge/Grounded%20AI-Zero%20Hallucinations-emerald.svg)]()

> **The modern AI-powered job application platform.**  
> Create your verified career profile once. Discover roles through Tinder-style swiping. Let grounded AI tailor your resume, draft personalized cover letters, and prepare/submit applications through legal ATS API integrations.

---

## Table of Contents

1. [Product Vision](#product-vision)
2. [Key Features](#key-features)
3. [Architecture Overview](#architecture-overview)
4. [Technology Stack](#technology-stack)
5. [Folder Structure](#folder-structure)
6. [Database Schema & Models](#database-schema--models)
7. [AI Engine & Anti-Hallucination Guarantees](#ai-engine--anti-hallucination-guarantees)
8. [Job-Source Adapter Architecture](#job-source-adapter-architecture)
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
Application Automation (ATS API / Form Handoff)
           ↓
Full Lifecycle Kanban Tracker
```

---

## 2. Key Features

- **Tinder-Style Swiping Experience (`/dashboard/discover`):**
  - Smooth physics-based Framer Motion card stack.
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
  - Status lanes: `READY_FOR_REVIEW`, `SUBMITTED`, `INTERVIEW`, `OFFER`, `REJECTED`.
  - Detailed timeline tracking (`Discovered` → `Viewed` → `Materials Prepared` → `Submitted` → `Interview`).
  - Strict distinction: Never pretends an application was submitted when it was only prepared.

- **Autonomous AI Autopilot (`/dashboard/autopilot`):**
  - Target roles, minimum AI match score (e.g. 85%+), workplace preference, minimum salary threshold, daily application limits (e.g. 10/day), and company blocklists.
  - Two operational modes: **Review Everything** (requires confirmation) vs **Smart Apply** (submits high matches via official API).
  - Telemetry: Displays jobs scanned, matched, prepared, submitted, and queued for review.

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

ApplySwipe follows a modular full-stack architecture built with Next.js App Router and TypeScript, with a dedicated Python FastAPI microservice for ATS integrations and advanced automation:

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
│  ├── Job Source Adapters     │ │   ├── Google Gemini 1.5     │
│  ├── Autopilot Engine        │ │   └── Intelligent Engine    │
│  ├── S3 / Local Storage      │ │       (Zero API keys req.)  │
│  ├── Resend / SMTP Email     │ │   ├── Dedicated Prompts     │
│  └── Stripe / Paystack Gate  │ │   └── Anti-Hallucination    │
└──────────────┬───────────────┘ └─────────────┬───────────────┘
               │                               │
               ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Data Layer & Background Automation Service                 │
│  ├── Prisma ORM / PostgreSQL Schema (23 Normalized Models)  │
│  ├── Atomic Persistent JSON/SQL Store                       │
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
│   │   ├── jobs/                 # ATS adapters (Greenhouse, Lever, Feeds)
│   │   ├── applications/         # Application automation agent
│   │   ├── storage/              # Storage abstraction (Local + S3)
│   │   ├── email/                # Email abstraction (Resend + SMTP + Console)
│   │   ├── payments/             # Payments abstraction (Stripe + Paystack)
│   │   └── queue/                # Background job queue worker
│   ├── services/
│   │   └── autopilot/            # Autopilot execution engine
│   └── types/                    # Shared TypeScript interfaces & enums
└── tests/
    ├── unit/                     # Matcher & anti-hallucination tests
    └── integration/              # E2E pipeline & application agent tests
```

---

## 6. Database Schema & Models

The Prisma schema (`prisma/schema.prisma`) defines 23 normalized models:

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
| `Job` | Aggregated positions with salary, skills, ATS type, and remote flag |
| `JobSource` | Connected ATS providers (Greenhouse, Lever, Feeds) |
| `JobInteraction` | User engagement tracking (`VIEWED`, `PASSED`, `SAVED`, `APPLIED`) |
| `SavedJob` | Bookmarked job postings with candidate notes |
| `Application` | Tracked application instance with status, mode, and method |
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

## 8. Job-Source Adapter Architecture

ApplySwipe uses a pluggable adapter system defined by `JobSourceAdapter`:
```typescript
interface JobSourceAdapter {
  name: string;
  type: "API" | "ATS" | "FEED" | "RSS";
  fetchJobs(params?: JobSourceParams): Promise<Partial<Job>[]>;
}
```

Pre-built adapters:
1. `GreenhouseAtsAdapter`: Connects to official Greenhouse board endpoints.
2. `LeverAtsAdapter`: Ingests from official Lever postings APIs.
3. `PermittedFeedAdapter`: Polls permitted developer job feeds.

---

## 9. Application Automation & Legal Limitations

ApplySwipe is engineered for ethical, legally compliant application management:
- **No CAPTCHA Bypasses:** The application agent never circumvents CAPTCHA, MFA, cloud security protections, or terms of service.
- **Status Truthfulness (Rule 40):** An application is only marked `SUBMITTED` when verified via official ATS API confirmation. If an employer uses an external custom form, ApplySwipe marks the state `READY_FOR_REVIEW` and generates materials for seamless candidate handoff.

---

## 10. Environment Variables

Copy `.env.example` to `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/applyswipe"
AUTH_SECRET="applyswipe-super-secret-jwt-key-change-in-production"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Optional AI Providers
OPENAI_API_KEY=""
GEMINI_API_KEY=""

# Storage & Email
S3_BUCKET="applyswipe-documents"
RESEND_API_KEY=""

# Payments
STRIPE_SECRET_KEY=""
PAYSTACK_SECRET_KEY=""
```

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

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 12. Testing

Run the Vitest test suite:
```bash
npm test
```
Tests cover:
- Match scoring calculation & missing skill detection
- Anti-hallucination resume validator against unverified claims
- End-to-end application agent state transitions and document generation

---

## 13. Production Build & Deployment

Run type checking and production build:
```bash
npm run typecheck
npm run build
npm start
```

---

## 14. Security & Privacy Sovereignty

- **HTTP-Only Session Cookies:** Protected with HMAC-SHA256 tokens and secure expiration flags.
- **Password Protection:** Salted Bcrypt hashing with cost factor 10.
- **Strict User Privacy:** Candidate resumes and career records are never shared with external model trainers.
- **GDPR / CCPA Ready:** Full JSON export and immediate account deletion supported via Settings.
