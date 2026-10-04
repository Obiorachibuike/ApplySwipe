/**
 * Freshness / expiration CLI.
 *
 *   npm run jobs:expire
 *   npx tsx scripts/jobs-expire.ts --dry-run
 *   npx tsx scripts/jobs-expire.ts --provider=ADZUNA
 *
 * Deactivates jobs that providers stopped returning (or that expired) without
 * deleting anything.
 */
import { runJobExpiration } from "@/workers/job-expiration";

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

  const result = await runJobExpiration({
    dryRun: args["dry-run"] === true,
    providers: typeof args.provider === "string" ? [args.provider.toUpperCase()] : undefined,
    limit: args.limit ? Number(args.limit) : undefined,
  });

  console.log("\n=== Job expiration summary ===");
  console.log(
    JSON.stringify(
      {
        dryRun: result.dryRun,
        evaluated: result.evaluated,
        deactivated: result.deactivated,
        expired: result.expired,
        notSeen: result.notSeen,
        byProvider: result.byProvider,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Job expiration failed:", error);
  process.exit(1);
});
