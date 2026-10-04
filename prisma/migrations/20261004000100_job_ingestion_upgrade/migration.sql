-- Multi-source job ingestion upgrade (part 2/2): provider columns, health tables
-- and indexes. All statements are additive; existing rows are preserved.

ALTER TABLE "Job" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "Job" ADD COLUMN "originalLocation" TEXT;
ALTER TABLE "Job" ADD COLUMN "workplaceType" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "Job" ADD COLUMN "seniority" TEXT DEFAULT 'Mid';
ALTER TABLE "Job" ADD COLUMN "salaryInterval" TEXT DEFAULT 'YEAR';
ALTER TABLE "Job" ADD COLUMN "salaryIsPredicted" BOOLEAN;
ALTER TABLE "Job" ADD COLUMN "searchText" TEXT;
ALTER TABLE "Job" ADD COLUMN "sourceUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Job" ADD COLUMN "fingerprint" TEXT;
ALTER TABLE "Job" ADD COLUMN "canonicalJobId" TEXT;
ALTER TABLE "Job" ADD COLUMN "sources" JSONB;
ALTER TABLE "Job" ADD COLUMN "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Job" ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Job" ADD COLUMN "seenCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Job" ADD COLUMN "rawData" JSONB;
ALTER TABLE "JobSource" ADD COLUMN "provider" TEXT;
ALTER TABLE "JobSource" ADD COLUMN "companyName" TEXT;
ALTER TABLE "JobSource" ADD COLUMN "boardToken" TEXT;
ALTER TABLE "JobSource" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "JobSource" ADD COLUMN "lastSuccessAt" TIMESTAMP(3);
ALTER TABLE "JobSource" ADD COLUMN "lastErrorAt" TIMESTAMP(3);
ALTER TABLE "JobSource" ADD COLUMN "lastError" TEXT;
ALTER TABLE "JobSource" ADD COLUMN "jobsImported" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Application" ADD COLUMN "appliedAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN "resumeId" TEXT;
ALTER TABLE "Application" ADD COLUMN "coverLetterId" TEXT;
CREATE TABLE "ProviderState" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "jobsImported" INTEGER NOT NULL DEFAULT 0,
    "activeJobs" INTEGER NOT NULL DEFAULT 0,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 120,
    "freshnessHours" INTEGER NOT NULL DEFAULT 48,
    "lockOwner" TEXT,
    "lockExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ProviderState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProviderState_provider_key" ON "ProviderState"("provider");
CREATE INDEX "ProviderState_provider_idx" ON "ProviderState"("provider");
CREATE INDEX "ProviderState_status_idx" ON "ProviderState"("status");
CREATE INDEX "ProviderState_lockExpiresAt_idx" ON "ProviderState"("lockExpiresAt");
CREATE TABLE "ProviderSyncRun" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL DEFAULT 'scheduler',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "stats" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ProviderSyncRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProviderSyncRun_provider_idx" ON "ProviderSyncRun"("provider");
CREATE INDEX "ProviderSyncRun_status_idx" ON "ProviderSyncRun"("status");
CREATE INDEX "ProviderSyncRun_startedAt_idx" ON "ProviderSyncRun"("startedAt");
CREATE INDEX "ProviderSyncRun_provider_startedAt_idx" ON "ProviderSyncRun"("provider", "startedAt");
CREATE TABLE "JobMatchScore" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT NOT NULL DEFAULT 'DETERMINISTIC',
    "reason" TEXT,
    "matchedSkills" JSONB,
    "missingSkills" JSONB,
    "recommendation" TEXT,
    "breakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "JobMatchScore_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "JobMatchScore_userId_jobId_key" ON "JobMatchScore"("userId", "jobId");
CREATE INDEX "JobMatchScore_userId_idx" ON "JobMatchScore"("userId");
CREATE INDEX "JobMatchScore_jobId_idx" ON "JobMatchScore"("jobId");
CREATE INDEX "JobMatchScore_score_idx" ON "JobMatchScore"("score");
CREATE INDEX "JobMatchScore_updatedAt_idx" ON "JobMatchScore"("updatedAt");
ALTER TABLE "ProviderSyncRun" ADD CONSTRAINT "ProviderSyncRun_provider_fkey" FOREIGN KEY ("provider") REFERENCES "ProviderState"("provider") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "JobMatchScore" ADD CONSTRAINT "JobMatchScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "JobMatchScore" ADD CONSTRAINT "JobMatchScore_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE Cascade ON UPDATE CASCADE;
CREATE INDEX "Job_canonicalJobId_idx" ON "Job"("canonicalJobId");
CREATE INDEX "Job_fingerprint_idx" ON "Job"("fingerprint");
CREATE INDEX "Job_isActive_postedAt_idx" ON "Job"("isActive", "postedAt");
CREATE INDEX "Job_isActive_provider_idx" ON "Job"("isActive", "provider");
CREATE INDEX "Job_lastSeenAt_idx" ON "Job"("lastSeenAt");
CREATE INDEX "Job_provider_idx" ON "Job"("provider");
CREATE INDEX "Job_seniority_idx" ON "Job"("seniority");
CREATE INDEX "Job_workplaceType_idx" ON "Job"("workplaceType");
CREATE UNIQUE INDEX "Job_provider_externalId_key" ON "Job"("provider", "externalId");
DROP INDEX "Job_externalId_key";
CREATE INDEX "JobSource_active_idx" ON "JobSource"("active");
CREATE INDEX "JobSource_provider_idx" ON "JobSource"("provider");
CREATE UNIQUE INDEX "JobSource_provider_boardToken_key" ON "JobSource"("provider", "boardToken");

-- ---------------------------------------------------------------------------
-- Data backfill for records that existed before the ingestion upgrade.
-- Nothing is deleted: legacy rows are labelled LEGACY and keep their user links
-- (swipes, saved jobs, applications, resume versions).
-- ---------------------------------------------------------------------------
UPDATE "Job" SET "provider" = 'LEGACY' WHERE "provider" IS NULL OR "provider" = '';
UPDATE "Job" SET "sourceUrl" = "applicationUrl" WHERE "sourceUrl" IS NULL OR "sourceUrl" = '';
UPDATE "Job" SET
    "workplaceType" = CASE WHEN "remote" THEN 'REMOTE' ELSE 'UNKNOWN' END
WHERE "workplaceType" IS NULL OR "workplaceType" = 'UNKNOWN';
UPDATE "Job" SET "firstSeenAt" = COALESCE("firstSeenAt", "createdAt"), "lastSeenAt" = COALESCE("lastSeenAt", "updatedAt");
UPDATE "Job" SET "seniority" = "experienceLevel" WHERE "experienceLevel" IS NOT NULL AND ("seniority" IS NULL OR "seniority" = 'Mid');
UPDATE "Job" SET "searchText" = lower(concat_ws(' ', "title", "company", "location", coalesce("skills"::text, '')));

UPDATE "JobSource" SET "active" = "isActive" WHERE "active" IS DISTINCT FROM "isActive";
UPDATE "JobSource" SET "provider" = 'GREENHOUSE' WHERE "provider" IS NULL AND lower("name") LIKE '%greenhouse%';
UPDATE "JobSource" SET "provider" = 'LEVER' WHERE "provider" IS NULL AND lower("name") LIKE '%lever%';
UPDATE "JobSource" SET "provider" = 'ADZUNA' WHERE "provider" IS NULL AND lower("name") LIKE '%adzuna%';
UPDATE "JobSource" SET "companyName" = "name" WHERE "companyName" IS NULL AND "provider" = 'GREENHOUSE' AND "active" = true AND "boardToken" IS NOT NULL;
UPDATE "JobSource" SET "jobsImported" = "jobCount" WHERE "jobsImported" = 0 AND "jobCount" > 0;

-- Note: `fingerprint` (level 2 dedupe key) is intentionally left NULL for legacy
-- rows. Backfill it with `npm run jobs:backfill` which computes the canonical
-- fingerprint in application code.
