import { describe, it, expect } from "vitest";
import { AIService } from "../../src/lib/ai/provider";
import { Profile, Job } from "../../src/types";

describe("Job Matching Engine", () => {
  const mockProfile: Profile = {
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
        startDate: "2020-01-01",
        description: "Full stack engineering",
        achievements: ["Scaled platform"],
        technologies: ["React", "TypeScript", "Node.js"],
        createdAt: "",
        updatedAt: "",
      },
    ],
    educations: [
      {
        id: "ed1",
        profileId: "p1",
        institution: "UC Berkeley",
        degree: "B.S.",
        field: "Computer Science",
        startYear: 2015,
        createdAt: "",
        updatedAt: "",
      },
    ],
    projects: [],
    certifications: [],
    preferredIndustries: [],
    preferredEmploymentTypes: ["Full-time"],
    salaryCurrency: "USD",
    onboardingCompleted: true,
    remotePreference: "Remote",
    createdAt: "",
    updatedAt: "",
  };

  const highMatchJob: Job = {
    id: "j1",
    provider: "GREENHOUSE",
    source: "Greenhouse",
    title: "Senior Full Stack Engineer",
    company: "Linear",
    description: "Looking for React, TypeScript, and Node.js engineer.",
    location: "Remote",
    remote: true,
    employmentType: "Full-time",
    salaryCurrency: "USD",
    skills: ["React", "TypeScript", "Node.js", "PostgreSQL"],
    sourceUrl: "https://boards.greenhouse.io/linear/jobs/4091",
    applicationUrl: "https://boards.greenhouse.io/linear/jobs/4091",
    workplaceType: "REMOTE",
    applicationType: "API_SUPPORTED",
    atsProvider: "GREENHOUSE",
    isReported: false,
    isActive: true,
    postedAt: "",
    createdAt: "",
    updatedAt: "",
  };

  const lowMatchJob: Job = {
    id: "j2",
    provider: "LEGACY",
    source: "Permitted Feed",
    title: "Embedded C++ Firmware Engineer",
    company: "Hardware Inc",
    description: "Requires RTOS, C++, and FPGA design.",
    location: "Austin, TX (On-site)",
    remote: false,
    employmentType: "Full-time",
    salaryCurrency: "USD",
    skills: ["C++", "RTOS", "FPGA", "VHDL"],
    sourceUrl: "https://hardware.inc/jobs/2",
    applicationUrl: "https://hardware.inc/jobs/2",
    workplaceType: "ONSITE",
    applicationType: "MANUAL_REQUIRED",
    atsProvider: "MANUAL",
    isReported: false,
    isActive: true,
    postedAt: "",
    createdAt: "",
    updatedAt: "",
  };

  it("calculates high match percentage when core skills overlap", async () => {
    const response = await AIService.analyzeMatch(mockProfile, highMatchJob);
    expect(response.result.overallMatch).toBeGreaterThanOrEqual(85);
    expect(response.result.matchingSkills).toContain("React");
    expect(response.result.matchingSkills).toContain("TypeScript");
    expect(response.result.missingSkills.length).toBe(0);
  });

  it("calculates low match percentage and reports missing skills for mismatched role", async () => {
    const response = await AIService.analyzeMatch(mockProfile, lowMatchJob);
    expect(response.result.overallMatch).toBeLessThan(75);
    expect(response.result.missingSkills).toContain("C++");
    expect(response.result.missingSkills).toContain("RTOS");
  });
});
