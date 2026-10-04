/**
 * Loaded before every test file (see vitest.config.ts).
 * Keeps the ingestion + feed tests fully offline and isolated.
 */
process.env.APPLYSWIPE_DB_FILE = process.env.APPLYSWIPE_DB_FILE || "data/applyswipe.test.json";
process.env.JOBS_SCHEDULER_ENABLED = process.env.JOBS_SCHEDULER_ENABLED || "false";
process.env.ADZUNA_APP_ID = process.env.ADZUNA_APP_ID || "test-app-id";
process.env.ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY || "test-app-key";
process.env.ADZUNA_BASE_URL = process.env.ADZUNA_BASE_URL || "https://api.adzuna.test/v1/api/jobs";
process.env.GREENHOUSE_BASE_URL = process.env.GREENHOUSE_BASE_URL || "https://boards-api.greenhouse.test";
process.env.LEVER_BASE_URL = process.env.LEVER_BASE_URL || "https://api.lever.test";
process.env.JOB_AI_RERANK_ENABLED = process.env.JOB_AI_RERANK_ENABLED || "false";
