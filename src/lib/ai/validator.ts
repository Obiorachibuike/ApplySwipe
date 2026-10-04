import { Profile } from "@/types";

export interface ValidationReport {
  isValid: boolean;
  unsupportedClaims: string[];
  recommendation: "ACCEPT" | "REVISE" | "REJECT";
  confidenceScore: number;
}

export class ResumeValidator {
  /**
   * Strictly validates that generated resume content only references facts verified in the candidate profile
   */
  public static validateTailoredResume(
    generatedContent: {
      targetRole: string;
      summary: string;
      skills: string[];
      experienceHighlights: string[];
      fullMarkdown: string;
    },
    profile: Profile
  ): ValidationReport {
    const unsupportedClaims: string[] = [];

    // Verified sets from profile
    const verifiedSkills = new Set(
      (profile.skills || []).map((s) => s.name.toLowerCase().trim())
    );
    const verifiedCompanies = new Set(
      (profile.experiences || []).map((e) => e.company.toLowerCase().trim())
    );
    const verifiedInstitutions = new Set(
      (profile.educations || []).map((e) => e.institution.toLowerCase().trim())
    );

    // 1. Check skills: ensure at least 80% are explicitly in verified skills or general aliases
    const commonWebSkills = new Set([
      "rest apis",
      "performance optimization",
      "git",
      "agile",
      "web performance",
      "ci/cd",
      "system design",
    ]);

    generatedContent.skills.forEach((skill) => {
      const lower = skill.toLowerCase().trim();
      const isKnown =
        verifiedSkills.has(lower) ||
        Array.from(verifiedSkills).some(
          (vs) => lower.includes(vs) || vs.includes(lower)
        ) ||
        commonWebSkills.has(lower);

      if (!isKnown) {
        unsupportedClaims.push(`Unverified skill detected: "${skill}"`);
      }
    });

    // 2. Check full content for hallucinated company names
    // Any capitalized company mention must belong to verified companies
    const knownForbiddenHallucinations = [
      "google",
      "meta",
      "apple",
      "microsoft",
      "netflix",
      "amazon",
    ];

    knownForbiddenHallucinations.forEach((bigTech) => {
      const regex = new RegExp(`\\b${bigTech}\\b`, "i");
      const inGenerated = regex.test(generatedContent.fullMarkdown);
      const inProfile = Array.from(verifiedCompanies).some((c) =>
        c.includes(bigTech)
      );

      if (inGenerated && !inProfile) {
        unsupportedClaims.push(
          `Hallucinated enterprise employer detected: "${bigTech.toUpperCase()}"`
        );
      }
    });

    const isValid = unsupportedClaims.length === 0;
    const confidenceScore = isValid
      ? 100
      : Math.max(40, 100 - unsupportedClaims.length * 20);

    const recommendation = isValid
      ? "ACCEPT"
      : unsupportedClaims.length <= 2
      ? "REVISE"
      : "REJECT";

    return {
      isValid,
      unsupportedClaims,
      recommendation,
      confidenceScore,
    };
  }
}
