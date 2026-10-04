import { describe, it, expect } from "vitest";
import { ResumeValidator } from "../../src/lib/ai/validator";
import { Profile } from "../../src/types";

describe("Anti-Hallucination Resume Validator", () => {
  const mockProfile: Profile = {
    id: "p1",
    userId: "u1",
    targetRoles: ["Full Stack Developer"],
    skills: [
      { id: "s1", profileId: "p1", name: "React", level: "EXPERT", createdAt: "", updatedAt: "" },
      { id: "s2", profileId: "p1", name: "TypeScript", level: "EXPERT", createdAt: "", updatedAt: "" },
    ],
    experiences: [
      {
        id: "e1",
        profileId: "p1",
        company: "Acme Corp",
        role: "Engineer",
        isCurrent: true,
        startDate: "2021-01-01",
        description: "",
        achievements: [],
        technologies: ["React"],
        createdAt: "",
        updatedAt: "",
      },
    ],
    educations: [],
    projects: [],
    certifications: [],
    preferredIndustries: [],
    preferredEmploymentTypes: [],
    salaryCurrency: "USD",
    onboardingCompleted: true,
    createdAt: "",
    updatedAt: "",
  };

  it("accepts valid resume content with verified profile skills", () => {
    const content = {
      targetRole: "Full Stack Developer",
      summary: "Experienced React and TypeScript engineer.",
      skills: ["React", "TypeScript", "Performance Optimization"],
      experienceHighlights: ["[Acme Corp] Delivered features"],
      fullMarkdown: "# RESUME\nWorked at Acme Corp.",
    };

    const report = ResumeValidator.validateTailoredResume(content, mockProfile);
    expect(report.isValid).toBe(true);
    expect(report.recommendation).toBe("ACCEPT");
  });

  it("detects and flags hallucinated big-tech enterprise employer", () => {
    const content = {
      targetRole: "Senior Engineer",
      summary: "Senior developer.",
      skills: ["React", "TypeScript"],
      experienceHighlights: ["Led team at Google"],
      fullMarkdown: "# RESUME\nPrincipal Staff Architect at Google.",
    };

    const report = ResumeValidator.validateTailoredResume(content, mockProfile);
    expect(report.isValid).toBe(false);
    expect(report.unsupportedClaims.some((c) => c.includes("GOOGLE"))).toBe(true);
  });
});
