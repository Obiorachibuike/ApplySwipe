-- Baseline migration for ApplySwipe (Prisma 5, PostgreSQL).
-- Generated from prisma/schema.prisma as of the pre-ingestion-upgrade schema so that
-- fresh databases can be provisioned with `prisma migrate deploy`.
-- Existing deployments that already created these tables out-of-band can mark this
-- migration as applied with:  npx prisma migrate resolve --applied 0_init

CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "InteractionType" AS ENUM ('VIEWED', 'PASSED', 'SAVED', 'APPLIED');
CREATE TYPE "ApplicationStatus" AS ENUM ('SAVED', 'PREPARING', 'READY_FOR_REVIEW', 'SUBMITTING', 'SUBMITTED', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "ApplicationMode" AS ENUM ('MANUAL', 'REVIEW_EVERYTHING', 'SMART_APPLY', 'AUTOPILOT');
CREATE TYPE "AutomationCapability" AS ENUM ('API_SUPPORTED', 'FORM_SUPPORTED', 'MANUAL_REQUIRED', 'USER_CONFIRMATION_REQUIRED');
CREATE TYPE "AtsProvider" AS ENUM ('GREENHOUSE', 'LEVER', 'WORKDAY', 'CUSTOM_API', 'MANUAL');
CREATE TYPE "DocumentType" AS ENUM ('TAILORED_RESUME', 'COVER_LETTER', 'PORTFOLIO', 'OTHER');
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');
CREATE TYPE "NotificationType" AS ENUM ('JOB_MATCH', 'APPLICATION_SUBMITTED', 'NEEDS_REVIEW', 'INTERVIEW', 'AUTOPILOT_SUMMARY', 'SYSTEM');
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'PAST_DUE', 'TRIALING');
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'PAYSTACK');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
CREATE TYPE "AIProvider" AS ENUM ('OPENAI', 'GEMINI', 'LOCAL_ENGINE');
CREATE TYPE "AIOperation" AS ENUM ('JOB_ANALYSIS', 'MATCH_SCORING', 'RESUME_TAILORING', 'COVER_LETTER', 'APPLICATION_ANSWER', 'VALIDATION');
CREATE TABLE "User" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "resetToken" TEXT,
    "resetTokenExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "city" TEXT,
    "targetRoles" JSONB,
    "experienceLevel" TEXT,
    "preferredIndustries" JSONB,
    "preferredEmploymentTypes" JSONB,
    "remotePreference" TEXT,
    "minSalary" INTEGER,
    "salaryCurrency" TEXT NOT NULL DEFAULT 'USD',
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");
CREATE INDEX "Profile_userId_idx" ON "Profile"("userId");
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "yearsExperience" INTEGER DEFAULT 1,
    "level" "SkillLevel" NOT NULL DEFAULT 'INTERMEDIATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Skill_profileId_idx" ON "Skill"("profileId");
CREATE INDEX "Skill_name_idx" ON "Skill"("name");
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "profileId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "location" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "achievements" JSONB,
    "technologies" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Experience_profileId_idx" ON "Experience"("profileId");
CREATE INDEX "Experience_company_idx" ON "Experience"("company");
CREATE TABLE "Education" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "profileId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER,
    "gpa" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Education_profileId_idx" ON "Education"("profileId");
CREATE TABLE "Project" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "technologies" JSONB,
    "url" TEXT,
    "githubUrl" TEXT,
    "highlights" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Project_profileId_idx" ON "Project"("profileId");
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "credentialId" TEXT,
    "credentialUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Certification_profileId_idx" ON "Certification"("profileId");
CREATE TABLE "Resume" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT,
    "rawText" TEXT,
    "parsedData" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Resume_userId_idx" ON "Resume"("userId");
CREATE TABLE "ResumeVersion" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "resumeId" TEXT NOT NULL,
    "jobId" TEXT,
    "versionType" TEXT NOT NULL DEFAULT 'MASTER',
    "title" TEXT NOT NULL,
    "targetRole" TEXT,
    "summary" TEXT NOT NULL,
    "skills" JSONB NOT NULL,
    "experienceHighlights" JSONB NOT NULL,
    "fullContent" TEXT NOT NULL,
    "matchScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ResumeVersion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ResumeVersion_resumeId_idx" ON "ResumeVersion"("resumeId");
CREATE INDEX "ResumeVersion_jobId_idx" ON "ResumeVersion"("jobId");
CREATE TABLE "Job" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "externalId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'applyswipe-feed',
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "companyLogo" TEXT,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "employmentType" TEXT NOT NULL DEFAULT 'Full-time',
    "experienceLevel" TEXT DEFAULT 'Mid-Senior',
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT NOT NULL DEFAULT 'USD',
    "skills" JSONB NOT NULL,
    "applicationUrl" TEXT NOT NULL,
    "applicationType" "AutomationCapability" NOT NULL DEFAULT 'MANUAL_REQUIRED',
    "atsProvider" "AtsProvider" NOT NULL DEFAULT 'MANUAL',
    "isReported" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Job_externalId_key" ON "Job"("externalId");
CREATE INDEX "Job_title_idx" ON "Job"("title");
CREATE INDEX "Job_company_idx" ON "Job"("company");
CREATE INDEX "Job_location_idx" ON "Job"("location");
CREATE INDEX "Job_remote_idx" ON "Job"("remote");
CREATE INDEX "Job_employmentType_idx" ON "Job"("employmentType");
CREATE INDEX "Job_postedAt_idx" ON "Job"("postedAt");
CREATE INDEX "Job_source_idx" ON "Job"("source");
CREATE INDEX "Job_externalId_idx" ON "Job"("externalId");
CREATE INDEX "Job_isActive_idx" ON "Job"("isActive");
CREATE TABLE "JobSource" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "jobCount" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "JobSource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "JobSource_name_key" ON "JobSource"("name");
CREATE INDEX "JobSource_name_idx" ON "JobSource"("name");
CREATE INDEX "JobSource_isActive_idx" ON "JobSource"("isActive");
CREATE TABLE "JobInteraction" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "interactionType" "InteractionType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "JobInteraction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "JobInteraction_userId_jobId_interactionType_key" ON "JobInteraction"("userId", "jobId", "interactionType");
CREATE INDEX "JobInteraction_userId_idx" ON "JobInteraction"("userId");
CREATE INDEX "JobInteraction_jobId_idx" ON "JobInteraction"("jobId");
CREATE INDEX "JobInteraction_interactionType_idx" ON "JobInteraction"("interactionType");
CREATE TABLE "SavedJob" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SavedJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SavedJob_userId_jobId_key" ON "SavedJob"("userId", "jobId");
CREATE INDEX "SavedJob_userId_idx" ON "SavedJob"("userId");
CREATE INDEX "SavedJob_jobId_idx" ON "SavedJob"("jobId");
CREATE TABLE "Application" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PREPARING',
    "mode" "ApplicationMode" NOT NULL DEFAULT 'REVIEW_EVERYTHING',
    "submissionCapability" "AutomationCapability" NOT NULL DEFAULT 'MANUAL_REQUIRED',
    "matchScore" INTEGER,
    "matchExplanation" TEXT,
    "submissionMethod" TEXT,
    "externalApplicationId" TEXT,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "interviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Application_userId_jobId_key" ON "Application"("userId", "jobId");
CREATE INDEX "Application_userId_idx" ON "Application"("userId");
CREATE INDEX "Application_jobId_idx" ON "Application"("jobId");
CREATE INDEX "Application_status_idx" ON "Application"("status");
CREATE INDEX "Application_createdAt_idx" ON "Application"("createdAt");
CREATE TABLE "ApplicationAnswer" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "applicationId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT true,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ApplicationAnswer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ApplicationAnswer_applicationId_idx" ON "ApplicationAnswer"("applicationId");
CREATE TABLE "ApplicationDocument" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "applicationId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL DEFAULT 'TAILORED_RESUME',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ApplicationDocument_applicationId_idx" ON "ApplicationDocument"("applicationId");
CREATE INDEX "ApplicationDocument_type_idx" ON "ApplicationDocument"("type");
CREATE TABLE "ApplicationEvent" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "applicationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ApplicationEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ApplicationEvent_applicationId_idx" ON "ApplicationEvent"("applicationId");
CREATE INDEX "ApplicationEvent_eventType_idx" ON "ApplicationEvent"("eventType");
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "targetRoles" JSONB,
    "experienceLevel" TEXT,
    "minSalary" INTEGER,
    "salaryCurrency" TEXT NOT NULL DEFAULT 'USD',
    "remoteOnly" BOOLEAN NOT NULL DEFAULT false,
    "preferredLocations" JSONB,
    "employmentTypes" JSONB,
    "excludedCompanies" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");
CREATE INDEX "UserPreference_userId_idx" ON "UserPreference"("userId");
CREATE TABLE "AutopilotSetting" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "minMatchScore" INTEGER NOT NULL DEFAULT 80,
    "dailyLimit" INTEGER NOT NULL DEFAULT 10,
    "applicationsToday" INTEGER NOT NULL DEFAULT 0,
    "allowedRoles" JSONB,
    "allowedLocations" JSONB,
    "minSalary" INTEGER DEFAULT 0,
    "employmentTypes" JSONB,
    "excludedCompanies" JSONB,
    "mode" "ApplicationMode" NOT NULL DEFAULT 'REVIEW_EVERYTHING',
    "lastRunAt" TIMESTAMP(3),
    "scannedCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "preparedCount" INTEGER NOT NULL DEFAULT 0,
    "submittedCount" INTEGER NOT NULL DEFAULT 0,
    "needsReviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "AutopilotSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AutopilotSetting_userId_key" ON "AutopilotSetting"("userId");
CREATE INDEX "AutopilotSetting_userId_idx" ON "AutopilotSetting"("userId");
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'JOB_MATCH',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "reference" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");
CREATE INDEX "Payment_reference_idx" ON "Payment"("reference");
CREATE TABLE "AIUsage" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "operation" "AIOperation" NOT NULL,
    "provider" "AIProvider" NOT NULL DEFAULT 'LOCAL_ENGINE',
    "model" TEXT NOT NULL DEFAULT 'gpt-4o',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AIUsage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AIUsage_userId_idx" ON "AIUsage"("userId");
CREATE INDEX "AIUsage_operation_idx" ON "AIUsage"("operation");
CREATE INDEX "AIUsage_createdAt_idx" ON "AIUsage"("createdAt");
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "Education" ADD CONSTRAINT "Education_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "ResumeVersion" ADD CONSTRAINT "ResumeVersion_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "ResumeVersion" ADD CONSTRAINT "ResumeVersion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SetNull ON UPDATE CASCADE;
ALTER TABLE "JobInteraction" ADD CONSTRAINT "JobInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "JobInteraction" ADD CONSTRAINT "JobInteraction_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "SavedJob" ADD CONSTRAINT "SavedJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "SavedJob" ADD CONSTRAINT "SavedJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "ApplicationAnswer" ADD CONSTRAINT "ApplicationAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "AutopilotSetting" ADD CONSTRAINT "AutopilotSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SetNull ON UPDATE CASCADE;
