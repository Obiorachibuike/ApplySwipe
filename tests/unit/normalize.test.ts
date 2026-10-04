import { describe, it, expect } from "vitest";
import {
  annualizeSalary,
  buildNormalizedJob,
  decodeHtmlEntities,
  extractSalaryFromText,
  htmlToText,
  normalizeEmploymentType,
  normalizeLocation,
  normalizeSalary,
  normalizeSeniority,
  normalizeWorkplaceType,
  providerDescriptionToText,
  validateNormalizedJob,
  JobValidationError,
} from "@/jobs/ingestion/normalize";

const base = {
  provider: "GREENHOUSE",
  externalId: "123",
  title: "Senior Full Stack Engineer",
  companyName: "Linear",
  description: "Build with React and TypeScript.",
  location: "Remote (US)",
  sourceUrl: "https://boards.greenhouse.io/linear/jobs/123",
  applicationUrl: "https://boards.greenhouse.io/linear/jobs/123",
};

describe("HTML cleanup", () => {
  it("strips markup, keeps structure and drops script/style bodies", () => {
    const html =
      "<div><script>alert('xss')</script><h2>About</h2><p>Build <strong>great</strong> software.</p><ul><li>React</li><li>TypeScript</li></ul></div>";
    const text = htmlToText(html);

    expect(text).not.toMatch(/<[^>]+>/);
    expect(text).not.toContain("alert(");
    expect(text).toContain("About");
    expect(text).toContain("Build great software.");
    expect(text).toContain("• React");
  });

  it("decodes HTML entities including numeric ones", () => {
    expect(decodeHtmlEntities("Tom &amp; Jerry &lt;3 &#39;quotes&#39;")).toBe("Tom & Jerry <3 'quotes'");
  });

  it("treats escaped markup as markup (Greenhouse content style)", () => {
    const escaped = "&lt;div&gt;&lt;p&gt;React &amp;amp; TypeScript&lt;/p&gt;&lt;/div&gt;";
    const text = providerDescriptionToText(escaped);

    expect(text).not.toContain("&lt;");
    expect(text).toContain("React & TypeScript");
  });

  it("keeps plain text untouched apart from whitespace cleanup", () => {
    expect(providerDescriptionToText("  Plain   text  ")).toBe("Plain text");
  });
});

describe("location normalization", () => {
  it("marks remote, hybrid and onsite correctly", () => {
    expect(normalizeWorkplaceType({ location: "Remote - Europe" })).toBe("REMOTE");
    expect(normalizeWorkplaceType({ location: "London (Hybrid)" })).toBe("HYBRID");
    expect(normalizeWorkplaceType({ location: "Berlin, Germany" })).toBe("ONSITE");
    expect(normalizeWorkplaceType({ location: "" })).toBe("UNKNOWN");
  });

  it("honours an explicit provider flag when the location is silent", () => {
    expect(normalizeWorkplaceType({ location: "", remoteFlag: true })).toBe("REMOTE");
    expect(normalizeWorkplaceType({ location: "", remoteFlag: false })).toBe("ONSITE");
  });

  it("normalizes display text and country hints", () => {
    const location = normalizeLocation("  San   Francisco, CA  ");
    expect(location.display).toBe("San Francisco, CA");
    expect(location.workplaceType).toBe("ONSITE");
  });

  it("produces a stable placeholder when nothing was provided", () => {
    expect(normalizeLocation(undefined).display).toBe("Location not specified");
  });
});

describe("salary normalization", () => {
  it("annualizes hourly, weekly and monthly ranges", () => {
    expect(annualizeSalary(50, "HOUR")).toBe(104000);
    expect(annualizeSalary(1000, "WEEK")).toBe(52000);
    expect(annualizeSalary(5000, "MONTH")).toBe(60000);
    expect(annualizeSalary(90000, "YEAR")).toBe(90000);
  });

  it("rejects implausible ranges and keeps only the min when max is missing", () => {
    const filled = normalizeSalary({ min: 90000, currency: "gbp", interval: "year" });
    expect(filled.min).toBe(90000);
    expect(filled.max).toBe(90000);
    expect(filled.currency).toBe("GBP");
    expect(filled.interval).toBe("YEAR");
  });

  it("flags predicted Adzuna salaries without inventing values", () => {
    const predicted = normalizeSalary({ min: 30000, isPredicted: true });
    expect(predicted.isPredicted).toBe(true);
    expect(normalizeSalary({}).isPredicted).toBeUndefined();
    expect(normalizeSalary({ min: 0 }).min).toBeUndefined();
  });

  it("extracts salaries from free text only when a currency marker is present", () => {
    const found = extractSalaryFromText("Compensation: $165,000 - $215,000 per year plus equity.");
    expect(found.min).toBe(165000);
    expect(found.max).toBe(215000);
    expect(found.interval).toBe("YEAR");

    const pounds = extractSalaryFromText("Our salary range is £60,000 - £75,000 per annum.");
    expect(pounds.min).toBe(60000);
    expect(pounds.max).toBe(75000);
    expect(pounds.currency).toBe("GBP");
    expect(pounds.interval).toBe("YEAR");

    // Amounts below 1000 are ignored on purpose: they are almost never salaries
    // (share counts, headcount, percentages...) and a wrong range is worse than none.
    expect(extractSalaryFromText("Rate: £45/hr").min).toBeUndefined();

    // no currency marker -> no invention
    expect(extractSalaryFromText("We pay 100000 depending on experience").min).toBeUndefined();
  });
});

describe("employment type and seniority normalization", () => {
  it("canonicalizes employment variants", () => {
    expect(normalizeEmploymentType("full_time")).toBe("Full-time");
    expect(normalizeEmploymentType("Full Time")).toBe("Full-time");
    expect(normalizeEmploymentType("Contract")).toBe("Contract");
    expect(normalizeEmploymentType("internship")).toBe("Internship");
    expect(normalizeEmploymentType(undefined)).toBe("Full-time");
  });

  it("derives seniority from explicit fields and titles", () => {
    expect(normalizeSeniority("staff")).toBe("Staff");
    expect(normalizeSeniority(undefined, "Junior Backend Engineer")).toBe("Junior");
    expect(normalizeSeniority(undefined, "Head of Design")).toBe("Lead");
    expect(normalizeSeniority(undefined, "Software Engineer")).toBeUndefined();
  });
});

describe("canonical job assembly", () => {
  it("builds a normalized job from provider data", () => {
    const job = buildNormalizedJob({ ...base, skills: ["React", "TypeScript"] });

    expect(job.provider).toBe("GREENHOUSE");
    expect(job.externalId).toBe("123");
    expect(job.workplaceType).toBe("REMOTE");
    expect(job.employmentType).toBe("Full-time");
    expect(job.seniority).toBe("Senior");
    expect(job.skills).toEqual(expect.arrayContaining(["React", "TypeScript"]));
    expect(job.applicationType).toBe("MANUAL_REQUIRED");
    expect(job.postedAt).toBeUndefined();
  });

  it("rejects jobs whose URLs are unsafe instead of storing them", () => {
    expect(() =>
      buildNormalizedJob({
        ...base,
        sourceUrl: "javascript:alert(1)",
        applicationUrl: "javascript:alert(2)",
      })
    ).toThrow(JobValidationError);

    // A missing application URL falls back to the (safe) source URL.
    const job = buildNormalizedJob({ ...base, applicationUrl: undefined });
    expect(job.applicationUrl).toBe(base.sourceUrl);
  });

  it("reports validation issues with a typed error", () => {
    expect(() => buildNormalizedJob({ ...base, title: "" })).toThrow(JobValidationError);

    const issues = validateNormalizedJob({
      title: "",
      description: "too short",
      applicationUrl: undefined,
    } as any);
    expect(issues.map((entry) => entry.field)).toEqual(
      expect.arrayContaining(["title", "description", "applicationUrl", "sourceUrl"])
    );
  });
});
