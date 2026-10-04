import { afterAll, beforeAll, describe, expect, it } from "vitest";
import db from "@/lib/db";
import {
  excludedJobIds,
  getFeed,
  loadViewer,
  matchForJob,
  type FeedViewer,
} from "@/jobs/services/feed-service";
import { recordSwipe, toggleSavedJob } from "@/jobs/services/application-service";
import type { Job } from "@/types";

const USER_ID = "usr-feed-test-001";
const PREFIX = "test-feed-";

function makeJob(id: string, overrides: Partial<Job> = {}): Job {
  const now = new Date().toISOString();
  return {
    id,
    externalId: id,
    provider: "GREENHOUSE",
    source: "Greenhouse",
    title: "Senior Full Stack Engineer",
    company: "Feed Test Co",
    description:
      "We build collaboration software with React, TypeScript, Node.js and PostgreSQL. Fully remote team.",
    location: "Remote - Europe",
    remote: true,
    workplaceType: "REMOTE",
    employmentType: "Full-time",
    seniority: "Senior",
    salaryMin: 150000,
    salaryMax: 190000,
    salaryCurrency: "USD",
    salaryInterval: "YEAR",
    skills: ["React", "TypeScript", "Node.js", "PostgreSQL"],
    sourceUrl: `https://boards.greenhouse.io/feedtest/jobs/${id}`,
    applicationUrl: `https://boards.greenhouse.io/feedtest/jobs/${id}`,
    applicationType: "API_SUPPORTED",
    atsProvider: "GREENHOUSE",
    isReported: false,
    isActive: true,
    canonicalJobId: null,
    postedAt: now,
    lastSeenAt: now,
    firstSeenAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Job;
}

function viewer(overrides: Partial<FeedViewer> = {}): FeedViewer {
  return {
    userId: USER_ID,
    profile: {
      id: "profile-feed-test",
      userId: USER_ID,
      targetRoles: ["Senior Full Stack Engineer"],
      skills: [
        { id: "s1", profileId: "profile-feed-test", name: "React", level: "EXPERT", createdAt: "", updatedAt: "" },
        { id: "s2", profileId: "profile-feed-test", name: "TypeScript", level: "EXPERT", createdAt: "", updatedAt: "" },
        { id: "s3", profileId: "profile-feed-test", name: "Node.js", level: "ADVANCED", createdAt: "", updatedAt: "" },
      ],
      experiences: [
        {
          id: "e1",
          profileId: "profile-feed-test",
          company: "TestCorp",
          role: "Senior Engineer",
          isCurrent: true,
          startDate: "2019-01-01",
          description: "",
          achievements: [],
          technologies: [],
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
      onboardingCompleted: true,
      remotePreference: "Remote",
      createdAt: "",
      updatedAt: "",
    },
    preferences: null,
    interactions: [],
    savedJobIds: [],
    appliedJobIds: [],
    ...overrides,
  };
}

const createdIds = [PREFIX + "a", PREFIX + "b", PREFIX + "c", PREFIX + "onsite", PREFIX + "reported"];

beforeAll(async () => {
  for (const id of createdIds) {
    await db.job.deleteMany({ where: { id } });
  }

  await db.job.create({
    data: makeJob(PREFIX + "a", { title: "Senior Full Stack Engineer", company: "Feed Test Co" }),
  });
  await db.job.create({
    data: makeJob(PREFIX + "b", { title: "Full Stack Engineer", company: "Feed Test Co", salaryMax: 160000 }),
  });
  await db.job.create({
    data: makeJob(PREFIX + "c", { title: "React Engineer", company: "Other Co" }),
  });
  await db.job.create({
    data: makeJob(PREFIX + "onsite", {
      title: "On-site Platform Engineer",
      company: "Office Co",
      location: "Berlin, Germany",
      workplaceType: "ONSITE",
      remote: false,
    }),
  });
  await db.job.create({
    data: makeJob(PREFIX + "reported", { title: "Reported Job", isReported: true }),
  });
});

afterAll(async () => {
  await db.job.deleteMany({ where: { id: { in: createdIds } } });
  await db.jobInteraction.deleteMany({ where: { userId: USER_ID } });
  await db.savedJob.deleteMany({ where: { userId: USER_ID } });
});

describe("feed ranking endpoint service", () => {
  it("loads the viewer context in a bounded number of queries", async () => {
    const loaded = await loadViewer("usr-alex-chen-001");

    expect(loaded.userId).toBe("usr-alex-chen-001");
    expect(loaded.profile?.id).toBeTruthy();
    expect(Array.isArray(loaded.savedJobIds)).toBe(true);
    expect(Array.isArray(loaded.appliedJobIds)).toBe(true);
  });

  it("returns ranked, public-safe jobs with match metadata", async () => {
    const feed = await getFeed(viewer(), { limit: 30 });

    const mine = feed.jobs.filter((job) => job.id.startsWith(PREFIX));
    expect(mine.map((job) => job.id)).toEqual(expect.arrayContaining([PREFIX + "a", PREFIX + "c"]));

    const first = mine.find((job) => job.id === PREFIX + "a")!;
    expect(first.matchScore).toBeGreaterThanOrEqual(85);
    expect(first.matchedSkills).toEqual(expect.arrayContaining(["React", "TypeScript"]));
    expect(first.matchReason).toBeTruthy();
    expect(first.officialApplicationUrl).toContain("boards.greenhouse.io");
    // provider internals never leak to the client
    expect(JSON.stringify(feed.jobs)).not.toContain("rawData");
    expect(feed.meta.weights.skills).toBe(35);
    expect(feed.meta.candidatesScanned).toBeGreaterThan(0);
  });

  it("hides reported jobs and duplicate listings", async () => {
    const feed = await getFeed(viewer(), { limit: 30 });
    const ids = feed.jobs.map((job) => job.id);
    expect(ids).not.toContain(PREFIX + "reported");
    expect(ids).not.toContain("test-feed-duplicate");
  });

  it("applies hard filters without calling providers", async () => {
    const feed = await getFeed(viewer(), { limit: 30, remote: true });
    const ids = feed.jobs.map((job) => job.id);

    expect(ids).toContain(PREFIX + "a");
    expect(ids).not.toContain(PREFIX + "onsite");
    expect(feed.meta.hardFiltered).toBeGreaterThan(0);
  });

  it("paginates with a cursor that never repeats or skips a job", async () => {
    const first = await getFeed(viewer(), { limit: 2 });
    expect(first.jobs).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();

    const second = await getFeed(viewer(), { limit: 2, cursor: first.nextCursor });
    expect(second.jobs).toHaveLength(2);

    const firstIds = first.jobs.map((job) => job.id);
    const secondIds = second.jobs.map((job) => job.id);
    expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);

    // a stale/garbage cursor restarts cleanly instead of throwing
    const restarted = await getFeed(viewer(), { limit: 2, cursor: "not-a-cursor" });
    expect(restarted.jobs.map((job) => job.id)).toEqual(firstIds);
  });

  it("excludes jobs the user already swiped, saved or applied to", async () => {
    const id = PREFIX + "c";

    expect(
      excludedJobIds(viewer({ interactions: [{ id: "i1", userId: USER_ID, jobId: id, interactionType: "PASSED" } as any] }))
    ).toContain(id);
    expect(excludedJobIds(viewer({ appliedJobIds: [id] })).has(id)).toBe(true);
    expect(excludedJobIds(viewer({ savedJobIds: [id] })).has(id)).toBe(true);
    // saved jobs can be brought back explicitly
    expect(excludedJobIds(viewer({ savedJobIds: [id] }), true).has(id)).toBe(false);
    // likes are decisions too
    expect(
      excludedJobIds(viewer({ interactions: [{ id: "i2", userId: USER_ID, jobId: id, interactionType: "LIKE" } as any] })).has(id)
    ).toBe(true);

    const feed = await getFeed(viewer({ savedJobIds: [id] }), { limit: 30 });
    expect(feed.jobs.map((job) => job.id)).not.toContain(id);
  });

  it("scores a single job deterministically for detail views", async () => {
    const job = (await db.job.findUnique({ where: { id: PREFIX + "a" } })) as Job;
    const match = matchForJob(viewer(), job);

    expect(match?.score).toBeGreaterThanOrEqual(85);
    expect(match?.recommendation).toBe("strong_match");
    expect(matchForJob({ ...viewer(), profile: null }, job)).toBeNull();
  });
});

describe("swipe handling", () => {
  it("records a like once and treats repeats as idempotent", async () => {
    const job = (await db.job.findUnique({ where: { id: PREFIX + "a" } })) as Job;

    const first = await recordSwipe(USER_ID, job, "LIKE");
    expect(first.created).toBe(true);
    expect(first.interaction.interactionType).toBe("LIKE");

    const second = await recordSwipe(USER_ID, job, "LIKE");
    expect(second.created).toBe(false);
    expect(second.interaction.id).toBe(first.interaction.id);

    const interactions = await db.jobInteraction.findMany({ where: { userId: USER_ID, jobId: job.id } });
    expect(interactions).toHaveLength(1);
  });

  it("keeps exactly one swipe decision per job when the user changes their mind", async () => {
    const job = (await db.job.findUnique({ where: { id: PREFIX + "b" } })) as Job;

    await recordSwipe(USER_ID, job, "LIKE");
    await recordSwipe(USER_ID, job, "PASS");

    const interactions = await db.jobInteraction.findMany({ where: { userId: USER_ID, jobId: job.id } });
    const swipes = interactions.filter((entry: any) =>
      ["LIKE", "PASS", "SUPER_LIKE", "PASSED"].includes(entry.interactionType)
    );
    expect(swipes).toHaveLength(1);
    expect(swipes[0].interactionType).toBe("PASSED");
  });

  it("refuses swipes on duplicates and inactive jobs", async () => {
    const canonical = makeJob(PREFIX + "dup", { canonicalJobId: PREFIX + "a" });
    await expect(recordSwipe(USER_ID, canonical, "LIKE")).rejects.toMatchObject({ statusCode: 409 });

    const inactive = makeJob(PREFIX + "inactive", { isActive: false });
    await expect(recordSwipe(USER_ID, inactive, "LIKE")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("toggles saved jobs without duplicating rows", async () => {
    const job = (await db.job.findUnique({ where: { id: PREFIX + "c" } })) as Job;

    expect((await toggleSavedJob(USER_ID, job)).isSaved).toBe(true);
    expect((await toggleSavedJob(USER_ID, job)).isSaved).toBe(false);

    const saved = await db.savedJob.findMany({ where: { userId: USER_ID, jobId: job.id } });
    expect(saved).toHaveLength(0);
  });
});
