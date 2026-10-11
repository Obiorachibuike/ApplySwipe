/**
 * Match precomputation CLI.
 *
 *   npm run jobs:match
 *   npx tsx scripts/jobs-match.ts --user=<userId>
 *   npx tsx scripts/jobs-match.ts --max-users=50
 *
 * Precomputes (and caches) job match scores per user and enriches jobs that have
 * no extracted skills yet. Deterministic work only - the AI re-rank stage is
 * bounded and cached, never a per-job LLM call.
 */
import { runJobMatching } from "@/workers/job-matching";

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

  const summary = await runJobMatching({
    userIds: typeof args.user === "string" ? [args.user] : undefined,
    maxUsers: args["max-users"] ? Number(args["max-users"]) : undefined,
  });

  console.log("\n=== Job matching summary ===");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Job matching failed:", error);
  process.exit(1);
});
