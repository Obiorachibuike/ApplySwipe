-- Multi-source job ingestion upgrade (part 1/2): new enum values.
--
-- PostgreSQL requires `ALTER TYPE ... ADD VALUE` to be committed before the new
-- labels can be used, so the enum additions live in their own migration.
-- Both migrations are additive - no data is dropped.

ALTER TYPE "InteractionType" ADD VALUE IF NOT EXISTS 'LIKE';
ALTER TYPE "InteractionType" ADD VALUE IF NOT EXISTS 'SUPER_LIKE';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'READY';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'APPLIED';
