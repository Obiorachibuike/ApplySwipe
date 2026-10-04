import type { Job, Profile, UserPreference } from "@/types";
import { jobSkills, profileSkills, scoreJob, type JobMatchResult } from "./score";

/**
 * Ranking + diversity.
 *
 *   active jobs  ->  hard filtering  ->  deterministic skill scoring
 *                ->  lexical (vector-style) similarity  ->  diversity  ->  page
 *
 * The AI re-ranking stage runs afterwards, on the top slice only
 * (`./ai-rerank.ts`).
 */

export interface RankedJob {
  job: Job;
  match: JobMatchResult;
  /** Cheap lexical similarity in [0,1] used as a stand-in for embedding search. */
  similarity: number;
}

export interface RankOptions {
  maxPerCompany?: number;
  /** Reserve slots for fresher jobs so the feed does not repeat one employer. */
  freshnessBoost?: boolean;
  pageSize?: number;
}

const STOP_WORDS = new Set([
  "and", "the", "for", "with", "you", "your", "our", "are", "will", "that", "this", "have", "has",
  "from", "they", "their", "who", "what", "when", "where", "which", "into", "about", "over", "more",
  "than", "them", "been", "being", "were", "was", "not", "but", "can", "may", "must", "should",
  "would", "could", "also", "any", "all", "use", "using", "work", "working", "role", "team", "teams",
  "job", "jobs", "company", "candidate", "candidates", "experience", "years", "skills", "ability",
]);

function tokenize(value: string): string[] {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

/**
 * Cosine similarity between the candidate profile text and the job text.
 *
 * This is a deterministic, dependency-free stand-in for embedding/vector
 * search: it is cheap enough to run per candidate and gives the ranking a
 * semantic-ish signal beyond exact skill overlap. Swapping in real embeddings
 * later only changes this function.
 */
export function lexicalSimilarity(profileText: string, jobText: string): number {
  const profileTokens = tokenize(profileText);
  const jobTokens = tokenize(jobText);
  if (profileTokens.length === 0 || jobTokens.length === 0) return 0;

  const profileCounts = new Map<string, number>();
  for (const token of profileTokens) profileCounts.set(token, (profileCounts.get(token) || 0) + 1);
  const jobCounts = new Map<string, number>();
  for (const token of jobTokens) jobCounts.set(token, (jobCounts.get(token) || 0) + 1);

  let dot = 0;
  jobCounts.forEach((count, token) => {
    const profileCount = profileCounts.get(token);
    if (profileCount) dot += Math.min(count, profileCount);
  });

  const profileMagnitude = Math.sqrt(
    Array.from(profileCounts.values()).reduce((acc, value) => acc + value * value, 0)
  );
  const jobMagnitude = Math.sqrt(
    Array.from(jobCounts.values()).reduce((acc, value) => acc + value * value, 0)
  );

  if (profileMagnitude === 0 || jobMagnitude === 0) return 0;
  return Math.min(1, dot / (profileMagnitude * jobMagnitude));
}

export function profileText(profile: Profile | null): string {
  if (!profile) return "";
  return [
    profile.headline,
    profile.bio,
    profile.experienceLevel,
    (profile.targetRoles || []).join(" "),
    (profile.preferredIndustries || []).join(" "),
    profileSkills(profile).join(" "),
    (profile.experiences || [])
      .map((experience) => `${experience.role} ${experience.description}`)
      .join(" "),
    (profile.projects || []).map((project) => `${project.name} ${project.description}`).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 6000);
}

export function jobText(job: Job): string {
  return [job.title, job.company, job.location, jobSkills(job).join(" "), (job.description || "").slice(0, 4000)]
    .filter(Boolean)
    .join(" ");
}

/**
 * Ranks candidate jobs for a user: weighted deterministic score with a small
 * lexical-similarity nudge, then diversity limits per company.
 */
export function rankJobs(
  jobs: Job[],
  profile: Profile | null,
  preferences: UserPreference | null | undefined,
  options: RankOptions = {}
): RankedJob[] {
  const maxPerCompany = options.maxPerCompany ?? 3;
  const profileBlob = profileText(profile);

  const ranked: RankedJob[] = jobs.map((job) => {
    const match = scoreJob(profile, job, { preferences });
    const similarity = lexicalSimilarity(profileBlob, jobText(job));
    const blended = Math.round(match.score * 0.92 + similarity * 100 * 0.08);
    return {
      job,
      match: { ...match, score: Math.max(0, Math.min(100, blended)) },
      similarity,
    };
  });

  const timestamp = (job: Job) => {
    const value = job.postedAt || job.lastSeenAt || job.createdAt;
    const time = value ? new Date(value).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
  };

  ranked.sort((a, b) => {
    if (b.match.score !== a.match.score) return b.match.score - a.match.score;
    return timestamp(b.job) - timestamp(a.job);
  });

  // Diversity: cap how many openings from one company appear in a page.
  const perCompany = new Map<string, number>();
  const selected: RankedJob[] = [];
  const overflow: RankedJob[] = [];

  for (const entry of ranked) {
    const company = entry.job.company.toLowerCase();
    const count = perCompany.get(company) || 0;
    if (count >= maxPerCompany) {
      overflow.push(entry);
      continue;
    }
    perCompany.set(company, count + 1);
    selected.push(entry);
  }

  const diversified = [...selected, ...overflow];

  if (options.pageSize) {
    return diversified.slice(0, options.pageSize);
  }
  return diversified;
}
