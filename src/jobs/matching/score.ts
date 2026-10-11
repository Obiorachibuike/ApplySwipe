import { compareSkills, extractSkills } from "./skills";
import { annualizeSalary } from "@/jobs/ingestion/normalize";
import type { Job, MatchRecommendation, Profile, UserPreference } from "@/types";

/**
 * Stage 1 - deterministic matching.
 *
 * Configurable weights (defaults):
 *   skills      35%
 *   experience  20%
 *   location    15%
 *   employment  10%
 *   salary      10%
 *   seniority   10%
 *
 * The result is a 0-100 score with a concise user-facing reason. It never calls
 * an LLM: stage 2 (AI re-ranking) only runs on the top slice of already ranked
 * jobs - see ./ai-rerank.ts.
 */

export interface MatchWeights {
  skills: number;
  experience: number;
  location: number;
  employment: number;
  salary: number;
  seniority: number;
}

export const DEFAULT_MATCH_WEIGHTS: MatchWeights = {
  skills: 35,
  experience: 20,
  location: 15,
  employment: 10,
  salary: 10,
  seniority: 10,
};

/** Weights can be overridden per deployment with MATCH_WEIGHTS_JSON. */
export function getMatchWeights(): MatchWeights {
  const raw = process.env.MATCH_WEIGHTS_JSON;
  if (!raw) return { ...DEFAULT_MATCH_WEIGHTS };
  try {
    const parsed = JSON.parse(raw) as Partial<MatchWeights>;
    const merged = { ...DEFAULT_MATCH_WEIGHTS, ...parsed };
    const total = Object.values(merged).reduce((acc, value) => acc + (Number(value) || 0), 0);
    if (total <= 0) return { ...DEFAULT_MATCH_WEIGHTS };
    return merged;
  } catch {
    return { ...DEFAULT_MATCH_WEIGHTS };
  }
}

export interface ProfileSnapshot {
  profile: Profile | null;
  preferences?: UserPreference | null;
}

export interface MatchBreakdown {
  skills: number;
  experience: number;
  location: number;
  employment: number;
  salary: number;
  seniority: number;
}

export interface JobMatchResult {
  score: number;
  breakdown: MatchBreakdown;
  matchedSkills: string[];
  missingSkills: string[];
  reason: string;
  concerns: string[];
  recommendation: MatchRecommendation;
  stage: "DETERMINISTIC";
}

const SENIORITY_EXPECTED_YEARS: Record<string, number> = {
  Intern: 0,
  Entry: 1,
  Junior: 2,
  Mid: 3,
  "Mid-Senior": 4,
  Senior: 5,
  Lead: 6,
  Staff: 7,
  Principal: 8,
  Executive: 10,
};

/** Total years of professional experience derived from the profile. */
export function estimateYearsOfExperience(profile: Profile | null | undefined): number {
  if (!profile?.experiences?.length) return 0;
  const now = Date.now();
  const total = profile.experiences.reduce((acc, experience) => {
    const start = new Date(experience.startDate).getTime();
    const end = experience.endDate ? new Date(experience.endDate).getTime() : now;
    if (!Number.isFinite(start)) return acc;
    const years = Math.max(0, (end - start) / (1000 * 60 * 60 * 24 * 365));
    return acc + years;
  }, 0);
  return Math.round(total * 10) / 10;
}

export function profileSkills(profile: Profile | null | undefined): string[] {
  const skills = (profile?.skills || []).map((skill) => skill.name).filter(Boolean);
  const technologies = (profile?.experiences || []).flatMap((experience) =>
    Array.isArray(experience.technologies) ? experience.technologies : []
  );
  const projectTech = (profile?.projects || []).flatMap((project) =>
    Array.isArray(project.technologies) ? project.technologies : []
  );
  return Array.from(new Set([...skills, ...technologies, ...projectTech]));
}

/** Skills advertised by a job (falls back to extracting from the description). */
export function jobSkills(job: Job): string[] {
  const stored = Array.isArray(job.skills) ? job.skills.filter(Boolean) : [];
  if (stored.length > 0) return stored;
  return extractSkills(`${job.title}\n${job.description || ""}`, { limit: 15 });
}

function seniorityScore(profile: Profile | null, preferences: UserPreference | null | undefined, job: Job): number {
  const jobLevel = String(job.seniority || job.experienceLevel || "").toLowerCase();
  const candidateLevel = String(
    preferences?.experienceLevel || profile?.experienceLevel || ""
  ).toLowerCase();

  if (!jobLevel) return 75;
  if (!candidateLevel) {
    const years = estimateYearsOfExperience(profile);
    const expected = SENIORITY_EXPECTED_YEARS[normalizeLevelKey(jobLevel)] ?? 3;
    return years >= expected ? 90 : 70;
  }

  const order = ["intern", "entry", "junior", "mid", "senior", "lead", "staff", "principal", "executive"];
  const jobIndex = order.indexOf(normalizeLevelKey(jobLevel).toLowerCase());
  const candidateIndex = order.indexOf(normalizeLevelKey(candidateLevel).toLowerCase());
  if (jobIndex === -1 || candidateIndex === -1) return 75;

  const distance = Math.abs(jobIndex - candidateIndex);
  if (distance === 0) return 100;
  if (distance === 1) return 85;
  if (distance === 2) return 65;
  return 45;
}

function normalizeLevelKey(value: string): string {
  const lower = value.toLowerCase();
  if (lower.includes("intern")) return "Intern";
  if (lower.includes("entry") || lower.includes("graduate")) return "Entry";
  if (lower.includes("junior") || lower.includes("jr")) return "Junior";
  if (lower.includes("principal") || lower.includes("distinguished")) return "Principal";
  if (lower.includes("staff")) return "Staff";
  if (lower.includes("lead") || lower.includes("manager")) return "Lead";
  if (lower.includes("director") || lower.includes("executive") || lower.includes("vp") || lower.includes("chief"))
    return "Executive";
  if (lower.includes("senior") || lower.includes("sr")) return "Senior";
  if (lower.includes("mid")) return "Mid";
  return value;
}

function experienceScore(profile: Profile | null, job: Job): number {
  const years = estimateYearsOfExperience(profile);
  const levelKey = normalizeLevelKey(String(job.seniority || job.experienceLevel || "Mid"));
  const expected = SENIORITY_EXPECTED_YEARS[levelKey] ?? 3;

  if (expected <= 1) return years >= 1 ? 100 : 85;
  if (years >= expected) return 100;
  if (years <= 0) return 45;
  const ratio = years / expected;
  return Math.max(45, Math.round(ratio * 100));
}

function locationScore(
  profile: Profile | null,
  preferences: UserPreference | null | undefined,
  job: Job
): number {
  const wantsRemote =
    preferences?.remoteOnly === true ||
    String(profile?.remotePreference || "").toLowerCase().includes("remote");

  const workplace = String(job.workplaceType || (job.remote ? "REMOTE" : "UNKNOWN")).toUpperCase();

  if (workplace === "REMOTE") return wantsRemote ? 100 : 90;
  if (workplace === "HYBRID") return wantsRemote ? 70 : 88;
  if (workplace === "ONSITE" || workplace === "UNKNOWN") {
    const locationText = String(job.location || "").toLowerCase();
    const preferredLocations = (preferences?.preferredLocations || []).map((l) => String(l).toLowerCase());
    const candidateCity = String(profile?.city || "").toLowerCase();
    const candidateCountry = String(profile?.country || "").toLowerCase();

    const matchesPreference =
      preferredLocations.some((target) => target && locationText.includes(target)) ||
      (candidateCity && locationText.includes(candidateCity)) ||
      (candidateCountry && locationText.includes(candidateCountry));

    if (matchesPreference) return 95;
    if (!locationText || locationText.includes("not specified")) return 75;
    return wantsRemote ? 50 : 65;
  }

  return 75;
}

function employmentScore(
  preferences: UserPreference | null | undefined,
  profile: Profile | null,
  job: Job
): number {
  const preferred = [
    ...(preferences?.employmentTypes || []),
    ...(profile?.preferredEmploymentTypes || []),
  ]
    .map((value) => String(value).toLowerCase())
    .filter(Boolean);

  if (preferred.length === 0) return 80;
  const jobType = String(job.employmentType || "").toLowerCase();
  if (!jobType) return 70;
  return preferred.some((type) => jobType.includes(type) || type.includes(jobType)) ? 100 : 55;
}

function salaryScore(
  preferences: UserPreference | null | undefined,
  profile: Profile | null,
  job: Job
): number {
  const target = preferences?.minSalary || profile?.minSalary || null;
  const jobMin = annualizeSalary(job.salaryMin, job.salaryInterval) ?? job.salaryMin ?? null;
  const jobMax = annualizeSalary(job.salaryMax, job.salaryInterval) ?? job.salaryMax ?? null;

  if (!jobMin && !jobMax) return 70; // no compensation data - stay neutral
  if (!target) return 85;

  const best = Math.max(jobMax || 0, jobMin || 0);
  const worst = Math.min(jobMax || 0, jobMin || 0) || best;

  if (best >= target * 1.15) return 100;
  if (best >= target) return 90;
  if (worst >= target) return 80;
  if (best >= target * 0.85) return 65;
  return 40;
}

function buildReason(input: {
  job: Job;
  score: number;
  matched: string[];
  missing: string[];
  concerns: string[];
  years: number;
}): string {
  const { job, score, matched, missing, years, concerns } = input;
  const matchedText = matched.slice(0, 3).join(", ");
  const missingText = missing.slice(0, 2).join(", ");

  if (score >= 85) {
    return `Strong match: your verified background covers ${matchedText || "the core requirements"}${
      years ? ` with ${years} years of experience` : ""
    } for ${job.title}.${missingText ? ` Watch: ${missingText}.` : ""}`;
  }
  if (score >= 70) {
    return `Good match for ${job.title}: you bring ${matchedText || "transferable skills"}${
      missingText ? `, while ${missingText} would need ramp-up` : ""
    }.${concerns[0] ? ` ${concerns[0]}` : ""}`;
  }
  if (score >= 55) {
    return `Possible match: some overlap (${matchedText || "general engineering skills"}) but ${
      missingText || "the required stack"
    } is not on your profile yet.`;
  }
  return `Weak match: this role leans on ${missing.slice(0, 3).join(", ") || "skills outside your profile"}.`;
}

export function recommendationFor(score: number): MatchRecommendation {
  if (score >= 85) return "strong_match";
  if (score >= 70) return "good_match";
  if (score >= 55) return "possible_match";
  return "weak_match";
}

/**
 * Scores one job against a candidate profile using the weighted, configurable
 * deterministic model. Pure function - safe to call per candidate in the feed.
 */
export function scoreJob(
  profile: Profile | null,
  job: Job,
  options: { preferences?: UserPreference | null; weights?: MatchWeights } = {}
): JobMatchResult {
  const weights = options.weights || getMatchWeights();
  const preferences = options.preferences;

  const candidateSkills = profileSkills(profile);
  const requiredSkills = jobSkills(job);
  const { matched, missing, score: skillsScore } = compareSkills(candidateSkills, requiredSkills);

  const breakdown: MatchBreakdown = {
    skills: skillsScore,
    experience: experienceScore(profile, job),
    location: locationScore(profile, preferences, job),
    employment: employmentScore(preferences, profile, job),
    salary: salaryScore(preferences, profile, job),
    seniority: seniorityScore(profile, preferences, job),
  };

  const weightTotal =
    weights.skills + weights.experience + weights.location + weights.employment + weights.salary + weights.seniority;

  const weighted =
    breakdown.skills * weights.skills +
    breakdown.experience * weights.experience +
    breakdown.location * weights.location +
    breakdown.employment * weights.employment +
    breakdown.salary * weights.salary +
    breakdown.seniority * weights.seniority;

  const score = Math.max(0, Math.min(100, Math.round(weighted / (weightTotal || 1))));

  const concerns: string[] = [];
  if (missing.length > 0) concerns.push(`Not on your profile yet: ${missing.slice(0, 3).join(", ")}.`);
  if (String(job.workplaceType).toUpperCase() === "ONSITE" && preferences?.remoteOnly)
    concerns.push(`Located in ${job.location} and not remote.`);
  if ((job.salaryMax || job.salaryMin) && preferences?.minSalary) {
    const jobMax = annualizeSalary(job.salaryMax, job.salaryInterval) ?? job.salaryMax ?? 0;
    if (jobMax && jobMax < preferences.minSalary)
      concerns.push("Posted salary is below your minimum target.");
  }

  const years = estimateYearsOfExperience(profile);

  return {
    score,
    breakdown,
    matchedSkills: matched,
    missingSkills: missing,
    reason: buildReason({ job, score, matched, missing, concerns, years }),
    concerns,
    recommendation: recommendationFor(score),
    stage: "DETERMINISTIC",
  };
}

export interface HardFilterInput {
  job: Job;
  profile: Profile | null;
  preferences?: UserPreference | null;
  options?: {
    remote?: boolean;
    employmentType?: string;
    provider?: string;
    salaryMin?: number;
    location?: string;
    query?: string;
    skills?: string[];
  };
}

/** Returns the reason a job must be excluded from a feed, or null when it passes. */
export function hardFilterReason({ job, profile, preferences, options }: HardFilterInput): string | null {
  const excluded = (preferences?.excludedCompanies || []).map((company) => String(company).toLowerCase());
  if (excluded.some((company) => company && job.company.toLowerCase().includes(company))) {
    return "COMPANY_EXCLUDED";
  }

  const wantsRemote = options?.remote ?? preferences?.remoteOnly === true;
  const workplace = String(job.workplaceType || (job.remote ? "REMOTE" : "UNKNOWN")).toUpperCase();
  if (wantsRemote && workplace !== "REMOTE") return "NOT_REMOTE";

  if (options?.employmentType) {
    const target = options.employmentType.toLowerCase();
    if (!String(job.employmentType || "").toLowerCase().includes(target)) return "EMPLOYMENT_TYPE";
  } else if (preferences?.employmentTypes?.length) {
    const types = preferences.employmentTypes.map((type) => String(type).toLowerCase());
    const jobType = String(job.employmentType || "").toLowerCase();
    if (jobType && !types.some((type) => jobType.includes(type) || type.includes(jobType))) {
      return "EMPLOYMENT_TYPE";
    }
  }

  const salaryFloor = options?.salaryMin ?? preferences?.minSalary ?? undefined;
  if (salaryFloor) {
    const jobMax = annualizeSalary(job.salaryMax, job.salaryInterval) ?? job.salaryMax ?? null;
    // Only exclude when the provider actually published a salary below target.
    if (jobMax !== null && jobMax > 0 && jobMax < salaryFloor * 0.85) return "SALARY_BELOW_MIN";
  }

  if (options?.provider) {
    if (String(job.provider || "").toUpperCase() !== options.provider.toUpperCase()) return "PROVIDER";
  }

  if (options?.query) {
    const haystack = `${job.title} ${job.company} ${(job.searchText || job.description || "").slice(0, 2000)}`.toLowerCase();
    if (!haystack.includes(options.query.toLowerCase())) return "QUERY";
  }

  if (options?.skills?.length) {
    const jobSkillSet = jobSkills(job).map((skill) => skill.toLowerCase());
    const hasAll = options.skills.every((skill) =>
      jobSkillSet.some((candidate) => candidate.includes(skill.toLowerCase()))
    );
    if (!hasAll) return "SKILLS";
  }

  if (options?.location) {
    const location = (job.location || "").toLowerCase();
    if (!location.includes(options.location.toLowerCase())) return "LOCATION";
  }

  return null;
}
