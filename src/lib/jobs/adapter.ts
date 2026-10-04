import { Job, AutomationCapability, AtsProvider } from "@/types";

export interface JobSourceParams {
  query?: string;
  location?: string;
  remote?: boolean;
  page?: number;
  limit?: number;
}

export interface JobSourceAdapter {
  name: string;
  type: "API" | "ATS" | "FEED" | "RSS";
  fetchJobs(params?: JobSourceParams): Promise<Partial<Job>[]>;
}

export class GreenhouseAtsAdapter implements JobSourceAdapter {
  name = "Greenhouse ATS Direct";
  type: "ATS" = "ATS";

  async fetchJobs(params?: JobSourceParams): Promise<Partial<Job>[]> {
    // Official API format for Greenhouse public boards (e.g., boards-api.greenhouse.io/v1/boards/{board_token}/jobs)
    return [
      {
        externalId: "gh-linear-4091",
        source: "Greenhouse ATS",
        title: "Senior Full Stack Engineer",
        company: "Linear",
        description: "Linear is seeking an exceptional Senior Full Stack Engineer. Build high-speed real-time web workflows.",
        location: "San Francisco, CA / Remote",
        remote: true,
        employmentType: "Full-time",
        experienceLevel: "Senior",
        salaryMin: 165000,
        salaryMax: 215000,
        salaryCurrency: "USD",
        skills: ["React", "TypeScript", "Node.js", "GraphQL", "PostgreSQL"],
        applicationUrl: "https://boards.greenhouse.io/linear/jobs/4091",
        applicationType: "API_SUPPORTED",
        atsProvider: "GREENHOUSE",
        isActive: true,
      },
    ];
  }
}

export class LeverAtsAdapter implements JobSourceAdapter {
  name = "Lever Postings API";
  type: "ATS" = "ATS";

  async fetchJobs(params?: JobSourceParams): Promise<Partial<Job>[]> {
    // Official public Lever postings API (e.g. api.lever.co/v0/postings/{company})
    return [
      {
        externalId: "lev-vercel-8812",
        source: "Lever Postings",
        title: "Staff Frontend Architect",
        company: "Vercel",
        description: "Shape the future of Next.js and frontend infrastructure.",
        location: "Remote",
        remote: true,
        employmentType: "Full-time",
        experienceLevel: "Staff",
        salaryMin: 195000,
        salaryMax: 255000,
        salaryCurrency: "USD",
        skills: ["Next.js", "React", "TypeScript", "Web Performance"],
        applicationUrl: "https://jobs.lever.co/vercel/8812",
        applicationType: "API_SUPPORTED",
        atsProvider: "LEVER",
        isActive: true,
      },
    ];
  }
}

export class PermittedFeedAdapter implements JobSourceAdapter {
  name = "Permitted Tech Feeds";
  type: "FEED" = "FEED";

  async fetchJobs(params?: JobSourceParams): Promise<Partial<Job>[]> {
    return [
      {
        externalId: "feed-acme-552",
        source: "Permitted Feed",
        title: "Senior Full Stack Product Engineer",
        company: "ACME Corp",
        description: "Full stack engineering leadership for greenfield data platform.",
        location: "Remote",
        remote: true,
        employmentType: "Full-time",
        experienceLevel: "Senior",
        salaryMin: 140000,
        salaryMax: 180000,
        salaryCurrency: "USD",
        skills: ["React", "TypeScript", "Node.js", "PostgreSQL"],
        applicationUrl: "https://acme.corp/jobs/552",
        applicationType: "FORM_SUPPORTED",
        atsProvider: "LEVER",
        isActive: true,
      },
    ];
  }
}

export class JobSourceManager {
  private adapters: JobSourceAdapter[] = [
    new GreenhouseAtsAdapter(),
    new LeverAtsAdapter(),
    new PermittedFeedAdapter(),
  ];

  public registerAdapter(adapter: JobSourceAdapter) {
    this.adapters.push(adapter);
  }

  public getAdapters(): JobSourceAdapter[] {
    return this.adapters;
  }

  public async aggregateAll(params?: JobSourceParams): Promise<Partial<Job>[]> {
    const results = await Promise.all(
      this.adapters.map((a) =>
        a.fetchJobs(params).catch((err) => {
          console.warn(`Adapter ${a.name} failed:`, err);
          return [];
        })
      )
    );
    return results.flat();
  }
}

export const jobSourceManager = new JobSourceManager();
