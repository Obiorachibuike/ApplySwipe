import db from "@/lib/db";
import { ApplicationAgent } from "@/lib/applications/agent";
import { AIService } from "@/lib/ai/provider";
import { Job, AutopilotSetting } from "@/types";

export interface AutopilotRunSummary {
  scannedCount: number;
  matchedCount: number;
  preparedCount: number;
  submittedCount: number;
  needsReviewCount: number;
  processedJobs: {
    jobId: string;
    jobTitle: string;
    company: string;
    matchScore: number;
    actionTaken: "SUBMITTED" | "PREPARED" | "SKIPPED";
    reason?: string;
  }[];
}

export class AutopilotService {
  /**
   * Executes an autopilot processing cycle for a user
   */
  public static async executeCycle(userId: string): Promise<AutopilotRunSummary> {
    const setting = await db.autopilotSetting.findUnique({
      where: { userId },
    });

    if (!setting || !setting.isEnabled) {
      throw new Error("Autopilot is disabled or not configured.");
    }

    const profile = await db.profile.findUnique({
      where: { userId },
      include: {
        skills: true,
        experiences: true,
        educations: true,
        projects: true,
        certifications: true,
      },
    });

    if (!profile) {
      throw new Error("Career profile is incomplete. Cannot run autopilot.");
    }

    // Load available active jobs
    const allJobs = await db.job.findMany({
      where: { isActive: true },
    });

    // Load existing user interactions/applications to avoid reapplying
    const existingApps = await db.application.findMany({ where: { userId } });
    const existingInteractions = await db.jobInteraction.findMany({ where: { userId } });

    const appliedJobIds = new Set(existingApps.map((a: any) => a.jobId));
    const passedJobIds = new Set(
      existingInteractions
        .filter((i: any) => i.interactionType === "PASSED")
        .map((i: any) => i.jobId)
    );

    const excludedCompanyNames = (setting.excludedCompanies || []).map((c: string) =>
      c.toLowerCase().trim()
    );

    let scannedCount = 0;
    let matchedCount = 0;
    let preparedCount = 0;
    let submittedCount = 0;
    let needsReviewCount = 0;
    const processedJobs: AutopilotRunSummary["processedJobs"] = [];

    let remainingDailyBudget = Math.max(0, setting.dailyLimit - setting.applicationsToday);

    for (const job of allJobs) {
      if (remainingDailyBudget <= 0) break;
      if (appliedJobIds.has(job.id) || passedJobIds.has(job.id)) continue;

      scannedCount++;

      // Check excluded companies
      if (excludedCompanyNames.some((ec: string) => job.company.toLowerCase().includes(ec))) {
        processedJobs.push({
          jobId: job.id,
          jobTitle: job.title,
          company: job.company,
          matchScore: 0,
          actionTaken: "SKIPPED",
          reason: `Company ${job.company} is on excluded list`,
        });
        continue;
      }

      // Check min salary constraint if job lists salary
      if (setting.minSalary && job.salaryMax && job.salaryMax < setting.minSalary) {
        processedJobs.push({
          jobId: job.id,
          jobTitle: job.title,
          company: job.company,
          matchScore: 0,
          actionTaken: "SKIPPED",
          reason: `Salary below minimum threshold of $${setting.minSalary.toLocaleString()}`,
        });
        continue;
      }

      // Calculate match
      const analysis = await AIService.analyzeMatch(profile, job, userId);
      const matchScore = analysis.result.overallMatch;

      if (matchScore >= setting.minMatchScore) {
        matchedCount++;

        // Process application through agent
        const result = await ApplicationAgent.processApplication(
          userId,
          job,
          setting.mode || "SMART_APPLY"
        );

        if (result.status === "SUBMITTED") {
          submittedCount++;
          remainingDailyBudget--;
          processedJobs.push({
            jobId: job.id,
            jobTitle: job.title,
            company: job.company,
            matchScore,
            actionTaken: "SUBMITTED",
          });
        } else {
          preparedCount++;
          needsReviewCount++;
          remainingDailyBudget--;
          processedJobs.push({
            jobId: job.id,
            jobTitle: job.title,
            company: job.company,
            matchScore,
            actionTaken: "PREPARED",
            reason: result.message,
          });
        }
      } else {
        processedJobs.push({
          jobId: job.id,
          jobTitle: job.title,
          company: job.company,
          matchScore,
          actionTaken: "SKIPPED",
          reason: `Match ${matchScore}% below minimum required ${setting.minMatchScore}%`,
        });
      }
    }

    // Update autopilot settings with new counters
    await db.autopilotSetting.update({
      where: { userId },
      data: {
        lastRunAt: new Date().toISOString(),
        applicationsToday: setting.applicationsToday + submittedCount + preparedCount,
        scannedCount: (setting.scannedCount || 0) + scannedCount,
        matchedCount: (setting.matchedCount || 0) + matchedCount,
        preparedCount: (setting.preparedCount || 0) + preparedCount,
        submittedCount: (setting.submittedCount || 0) + submittedCount,
        needsReviewCount: (setting.needsReviewCount || 0) + needsReviewCount,
      },
    });

    // Create summary notification
    await db.notification.create({
      data: {
        userId,
        title: "Autopilot Cycle Complete ⚡",
        message: `Scanned ${scannedCount} jobs, matched ${matchedCount}. Submitted: ${submittedCount}, Prepared: ${preparedCount}.`,
        type: "AUTOPILOT_SUMMARY",
        link: "/dashboard/autopilot",
      },
    });

    return {
      scannedCount,
      matchedCount,
      preparedCount,
      submittedCount,
      needsReviewCount,
      processedJobs,
    };
  }
}
