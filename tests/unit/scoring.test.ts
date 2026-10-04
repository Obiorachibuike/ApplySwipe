import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_MATCH_WEIGHTS,
  getMatchWeights,
  hardFilterReason,
  recommendationFor,
  scoreJob,
} from "@/jobs/matching/score";
import { rankJobs } from "@/jobs/matching/ranking";
import type { Job, Profile, UserPreference } from "@/types";

const profile: Profile = {
  id: "p1",
  userId: "u1",
  targetRoles: ["Senior Full Stack Engineer"],
  skills: [
    { id: "s1", profileId: "p1", name: "React", level: "EXPERT", createdAt: "", updatedAt: "" },
    { id: "s2", profileId: "p1", name: "TypeScript", level: "EXPERT", createdAt: "", updatedAt: "" },
    { id: "s3", profileId: "p1", name: "Node.js", level: "ADVANCED", createdAt: "", updatedAt: "" },
    { id: "s4", profileId: "p1", name: "PostgreSQL", level: "ADVANCED", createdAt: "", updatedAt: "" },
  ],
  experiences: [
    {
      id: "e1",
      profileId: "p1",
      company: "TechCorp",
      role: "Senior Engineer",
      isCurrent: true,
      startDate: "2019-01-01",
      description: "Full stack engineering",
      achievements: [],
      technologies: ["React", "TypeScript", "Node.js"],
      createdAt: "",
      updatedAt: "",
    },
  ],
  educations: [],
  projects: [],
  certifications: [],
  preferredIndustries: [],
  preferredEmploymentTypes: ["Full-time"],
  salaryCurrency: "USD",
  minSalary: 150000,
  onboardingCompleted: true,
  remotePreference: "Remote",
  city: "Lisbon",
  country: "Portugal",
  createdAt: "",
  updatedAt: "",
};

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "j1",
    provider: "GREENHOUSE",
    source: "Greenhouse",
    title: "Senior Full Stack Engineer",
    company: "Linear",
    description: "React, TypeScript, Node.js and PostgreSQL. Fully remote.",
    location: "Remote - EU",
    remote: true,
    workplaceType: "REMOTE",
    employmentType: "Full-time",
    seniority: "Senior",
    salaryMin: 180000,
    salaryMax: 220000,
    salaryCurrency: "USD",
    salaryInterval: "YEAR",
    skills: ["React", "TypeScript", "Node.js", "PostgreSQL"],
    sourceUrl: "https://boards.greenhouse.io/linear/jobs/1",
    applicationUrl: "https://boards.greenhouse.io/linear/jobs/1",
    applicationType: "API_SUPPORTED",
    atsProvider: "GREENHOUSE",
    isReported: false,
    isActive: true,
    postedAt: "2026-10-01T00:00:00.000Z",
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

const preferences: UserPreference = {
  id: "pref1",
  userId: "u1",
  targetRoles: ["Full Stack Engineer"],
  experienceLevel: "Senior",
  minSalary: 150000,
  salaryCurrency: "USD",
  remoteOnly: true,
  preferredLocations: ["EU"],
  employmentTypes: ["Full-time"],
  excludedCompanies: ["Acme Corp"],
  createdAt: "",
  updatedAt: "",
};

afterEach(() => {
  delete process.env.MATCH_WEIGHTS_JSON;
});

describe("weighted deterministic matching", () => {
  it("ships the documented default weights", () => {
    expect(DEFAULT_MATCH_WEIGHTS).toEqual({
      skills: 35,
      experience: 20,
      location: 15,
      employment: 10,
      salary: 10,
      seniority: 10,
    });
    expect(Object.values(DEFAULT_MATCH_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("allows deployments to override weights through MATCH_WEIGHTS_JSON", () => {
    process.env.MATCH_WEIGHTS_JSON = JSON.stringify({ skills: 50, salary: 0 });
    const weights = getMatchWeights();
    expect(weights.skills).toBe(50);
    expect(weights.salary).toBe(0);
    expect(weights.experience).toBe(20);

    process.env.MATCH_WEIGHTS_JSON = "{not json";
    expect(getMatchWeights()).toEqual(DEFAULT_MATCH_WEIGHTS);
  });

  it("scores a fully aligned job as a strong match with reasons and skill lists", () => {
    const result = scoreJob(profile, makeJob(), { preferences });

    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.recommendation).toBe("strong_match");
    expect(result.matchedSkills).toEqual(expect.arrayContaining(["React", "TypeScript"]));
    expect(result.missingSkills).toHaveLength(0);
    expect(result.reason).toContain("Senior Full Stack Engineer");
    expect(result.breakdown).toEqual({
      skills: expect.any(Number),
      experience: expect.any(Number),
      location: expect.any(Number),
      employment: expect.any(Number),
      salary: expect.any(Number),
      seniority: expect.any(Number),
    });
    expect(result.stage).toBe("DETERMINISTIC");
  });

  it("scores an unrelated role below the strong-match band and lists gaps", () => {
    const result = scoreJob(
      profile,
      makeJob({
        title: "Embedded Firmware Engineer",
        company: "Hardware Inc",
        skills: ["C++", "RTOS", "FPGA"],
        seniority: undefined,
        description: "On-site firmware work.",
        location: "Austin, TX (On-site)",
        workplaceType: "ONSITE",
        remote: false,
        salaryMin: 60000,
        salaryMax: 70000,
      }),
      { preferences }
    );

    expect(result.score).toBeLessThan(75);
    expect(result.missingSkills).toEqual(expect.arrayContaining(["C++", "RTOS"]));
    expect(result.recommendation).toBe("weak_match");
  });

  it("maps scores onto the recommendation bands used by the UI", () => {
    expect(recommendationFor(90)).toBe("strong_match");
    expect(recommendationFor(85)).toBe("strong_match");
    expect(recommendationFor(71)).toBe("good_match");
    expect(recommendationFor(60)).toBe("possible_match");
    expect(recommendationFor(40)).toBe("weak_match");
  });
});

describe("hard filters", () => {
  it("passes a job that satisfies every preference", () => {
    expect(
      hardFilterReason({
        job: makeJob(),
        profile,
        preferences,
        options: { remote: true, employmentType: "Full-time", query: "engineer" },
      })
    ).toBeNull();
  });

  it("explains each exclusion instead of silently dropping jobs", () => {
    expect(
      hardFilterReason({
        job: makeJob({ company: "Acme Corp" }),
        profile,
        preferences,
      })
    ).toBe("COMPANY_EXCLUDED");

    expect(
      hardFilterReason({
        job: makeJob({ workplaceType: "ONSITE", remote: false }),
        profile,
        preferences,
        options: { remote: true },
      })
    ).toBe("NOT_REMOTE");

    expect(
      hardFilterReason({
        job: makeJob({ employmentType: "Contract" }),
        profile,
        preferences,
        options: { employmentType: "Full-time" },
      })
    ).toBe("EMPLOYMENT_TYPE");

    expect(
      hardFilterReason({
        job: makeJob({ salaryMin: 90000, salaryMax: 100000 }),
        profile,
        preferences,
      })
    ).toBe("SALARY_BELOW_MIN");

    expect(
      hardFilterReason({ job: makeJob(), profile, preferences, options: { provider: "ADZUNA" } })
    ).toBe("PROVIDER");

    expect(
      hardFilterReason({ job: makeJob(), profile, preferences, options: { query: "kotlin" } })
    ).toBe("QUERY");

    expect(
      hardFilterReason({ job: makeJob(), profile, preferences, options: { location: "berlin" } })
    ).toBe("LOCATION");
  });

  it("never excludes a job that simply omits salary data", () => {
    expect(
      hardFilterReason({
        job: makeJob({ salaryMin: undefined, salaryMax: undefined }),
        profile,
        preferences,
      })
    ).toBeNull();
  });
});

describe("ranking and diversity", () => {
  it("orders by blended score and caps openings per company", () => {
    const jobs = [
      makeJob({ id: "a1", title: "Senior Full Stack Engineer", company: "Linear" }),
      makeJob({ id: "a2", title: "Full Stack Engineer", company: "Linear", skills: ["React"] }),
      makeJob({ id: "a3", title: "Frontend Engineer", company: "Linear", skills: ["React"] }),
      makeJob({ id: "a4", title: "Platform Engineer", company: "Linear", skills: ["React"] }),
      makeJob({ id: "b1", title: "Senior React Engineer", company: "Vercel" }),
    ];

    const ranked = rankJobs(jobs, profile, preferences, { maxPerCompany: 2 });

    expect(ranked).toHaveLength(5);
    const firstTwoCompanies = ranked.slice(0, 2).map((entry) => entry.job.company);
    expect(firstTwoCompanies).toEqual(["Linear", "Linear"]);
    // the third Linear opening is pushed behind the other company
    expect(ranked[2].job.company).toBe("Vercel");
    expect(ranked.map((entry) => entry.match.score)).toEqual(
      [...ranked.map((entry) => entry.match.score)].sort((a, b) => b - a)
    );
  });
});
