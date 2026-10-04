/**
 * Seeds demo job sources so the ingestion pipeline can be exercised locally.
 *
 *   npm run jobs:seed-sources
 *
 * These are public ATS boards that expose an official, documented JSON API
 * (Greenhouse boards API / Lever postings API). They are DEMO configuration -
 * production companies are added through the admin console or the
 * `POST /api/admin/sources` endpoint, never hard-coded in application logic.
 */
import db from "@/lib/db";
import { createJobSource, listJobSources } from "@/jobs/services/provider-service";

const DEMO_SOURCES = [
  { provider: "GREENHOUSE", companyName: "Linear", boardToken: "linear" },
  { provider: "GREENHOUSE", companyName: "Figma", boardToken: "figma" },
  { provider: "LEVER", companyName: "Mistral AI", boardToken: "mistral" },
  { provider: "LEVER", companyName: "Netflix", boardToken: "netflix" },
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const existing = await listJobSources();
  const created: string[] = [];

  for (const source of DEMO_SOURCES) {
    const already = existing.find(
      (entry) =>
        String(entry.provider || "").toUpperCase() === source.provider &&
        String(entry.boardToken || "").toLowerCase() === source.boardToken.toLowerCase()
    );
    if (already) continue;

    created.push(`${source.provider}:${source.boardToken}`);
    if (dryRun) continue;

    try {
      await createJobSource({ ...source, active: true, config: { demo: true } });
    } catch (error) {
      console.warn(`Skipped ${source.boardToken}: ${(error as Error).message}`);
    }
  }

  const total = (await db.jobSource.findMany({})).length;

  console.log("\n=== Demo job sources ===");
  console.log(JSON.stringify({ dryRun, created, totalSources: total }, null, 2));
  console.log(
    "\nRun `npm run jobs:sync:greenhouse` (and :lever) to ingest. Verify each board token is correct for the company you want to track."
  );
}

main().catch((error) => {
  console.error("Seeding job sources failed:", error);
  process.exit(1);
});
