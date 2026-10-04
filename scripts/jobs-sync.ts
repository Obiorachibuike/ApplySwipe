/**
 * Job ingestion CLI.
 *
 * Usage:
 *   npm run jobs:sync                      # every configured provider
 *   npm run jobs:sync:adzuna               # Adzuna only
 *   npm run jobs:sync:greenhouse           # Greenhouse boards only
 *   npm run jobs:sync:lever                # Lever companies only
 *   npx tsx scripts/jobs-sync.ts --provider=ADZUNA --dry-run
 *   npx tsx scripts/jobs-sync.ts --limit-per-source=25 --max-sources=2
 *
 * The same workers are used by `npm run` scripts, the admin console and the
 * cron endpoints - there is exactly one ingestion implementation.
 */
import { runJobSync } from "@/workers/job-sync";
import { listProviders } from "@/jobs/providers";
import { getMissingEnv } from "@/jobs/providers";

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [key, value] = raw.replace(/^--/, "").split("=");
    args[key] = value === undefined ? true : value;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const providerArg = typeof args.provider === "string" ? args.provider.toUpperCase() : undefined;

  if (providerArg && !listProviders().includes(providerArg as never)) {
    console.error(`Unknown provider "${providerArg}". Supported: ${listProviders().join(", ")}`);
    process.exit(1);
  }

  if (providerArg) {
    const missing = getMissingEnv(providerArg);
    if (missing.length > 0) {
      console.error(
        `${providerArg} is not configured. Set ${missing.join(", ")} in .env before syncing.`
      );
      process.exit(1);
    }
  }

  const summary = await runJobSync({
    providers: providerArg ? [providerArg] : undefined,
    triggeredBy: "cli",
    dryRun: args["dry-run"] === true,
    maxSources: args["max-sources"] ? Number(args["max-sources"]) : undefined,
    limitPerSource: args["limit-per-source"] ? Number(args["limit-per-source"]) : undefined,
    skipExpiry: args["skip-expiry"] === true,
  });

  console.log("\n=== Job sync summary ===");
  console.log(
    JSON.stringify(
      {
        triggeredBy: summary.triggeredBy,
        durationMs: summary.durationMs,
        totals: summary.totals,
        providers: summary.providers.map((stats) => ({
          provider: stats.provider,
          status: stats.status,
          fetched: stats.fetched,
          inserted: stats.inserted,
          updated: stats.updated,
          duplicates: stats.duplicates,
          failed: stats.failed,
          deactivated: stats.deactivated,
          errors: stats.errors,
          sourcesProcessed: stats.sourcesProcessed,
        })),
      },
      null,
      2
    )
  );

  const allFailed = summary.providers.every((stats) => stats.status === "FAILED");
  process.exit(allFailed ? 1 : 0);
}

main().catch((error) => {
  console.error("Job sync failed:", error);
  process.exit(1);
});
