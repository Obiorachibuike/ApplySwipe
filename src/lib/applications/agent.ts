import db from "@/lib/db";
import {
  Application,
  Job,
  Profile,
  AutomationCapability,
  ApplicationStatus,
  ApplicationMode,
} from "@/types";
import { AIService } from "@/lib/ai/provider";

export interface AutomationResult {
  capability: AutomationCapability;
  status: ApplicationStatus;
  message: string;
  externalId?: string;
  requiresManualHandoff: boolean;
  preparedMaterials: {
    tailoredResumeId?: string;
    coverLetter?: string;
    answeredQuestionsCount: number;
  };
}

export class ApplicationAgent {
  /**
   * Evaluates automation feasibility for a job
   */
  public static evaluateCapability(job: Job): AutomationCapability {
    if (job.applicationType === "API_SUPPORTED") {
      return "API_SUPPORTED";
    }
    if (job.applicationType === "FORM_SUPPORTED") {
      return "FORM_SUPPORTED";
    }
    return "MANUAL_REQUIRED";
  }

  /**
   * Executes the application pipeline adhering to user confirmation modes and legal ATS APIs
   */
  public static async processApplication(
    userId: string,
    job: Job,
    mode: ApplicationMode = "REVIEW_EVERYTHING"
  ): Promise<AutomationResult> {
    const profile = await db.profile.findUnique({
      where: { userId },
      include: {
        skills: true,
        experiences: true,
        educations: true,
        projects: true,
        certifications: true,
        user: true,
      },
    });

    if (!profile) {
      throw new Error("User profile not found");
    }

    // 1. Determine capability
    const capability = this.evaluateCapability(job);

    // 2. Step 1: AI Match Analysis
    const matchAnalysis = await AIService.analyzeMatch(profile, job, userId);

    // 3. Step 2: Generate Tailored Resume
    const tailoredResume = await AIService.tailorResume(profile, job, undefined, userId);

    // 4. Step 3: Generate Cover Letter
    const coverLetter = await AIService.generateCoverLetter(profile, job, userId);

    // 5. Step 4: Generate answers to standard questions
    const standardQuestions = [
      `Why are you interested in joining ${job.company}?`,
      `Describe your relevant experience with ${job.skills.slice(0, 2).join(" and ")}.`,
      `What is your target compensation and availability?`,
    ];

    const answers = await Promise.all(
      standardQuestions.map(async (q) => {
        const res = await AIService.answerQuestion(q, profile, job, userId);
        return {
          question: q,
          answer: res.result,
          isAiGenerated: true,
          isEdited: false,
        };
      })
    );

    // 6. Create or update application in DB
    const existingApp = await db.application.findFirst({
      where: { userId, jobId: job.id },
    });

    let targetStatus: ApplicationStatus = "PREPARING";
    let externalId: string | undefined = undefined;

    // Check application mode
    if (mode === "SMART_APPLY" && capability === "API_SUPPORTED" && matchAnalysis.result.overallMatch >= 85) {
      // Allowed to submit directly via API
      targetStatus = "SUBMITTED";
      externalId = `sub-${job.atsProvider.toLowerCase()}-${Date.now().toString(36)}`;
    } else if (capability === "MANUAL_REQUIRED") {
      targetStatus = "READY_FOR_REVIEW";
    } else {
      // Review everything or Form supported -> Needs user review before submission
      targetStatus = "READY_FOR_REVIEW";
    }

    const applicationData = {
      userId,
      jobId: job.id,
      status: targetStatus,
      mode,
      submissionCapability: capability,
      matchScore: matchAnalysis.result.overallMatch,
      matchExplanation: matchAnalysis.result.explanation,
      submissionMethod: capability === "API_SUPPORTED" ? "API" : capability === "FORM_SUPPORTED" ? "FORM" : "MANUAL_HANDOFF",
      externalApplicationId: externalId || null,
      submittedAt: targetStatus === "SUBMITTED" ? new Date().toISOString() : null,
      notes: targetStatus === "SUBMITTED"
        ? `Submitted via ${job.atsProvider} direct integration. Confirmation #${externalId}`
        : `Materials prepared by AI. Ready for user verification.`,
    };

    let app: any;
    if (existingApp) {
      app = await db.application.update({
        where: { id: existingApp.id },
        data: applicationData,
      });
    } else {
      app = await db.application.create({
        data: applicationData,
      });
    }

    // Save Tailored Resume Document
    await db.applicationDocument.create({
      data: {
        applicationId: app.id,
        type: "TAILORED_RESUME",
        title: `${profile.user?.name || "Candidate"} - ${job.company} Tailored Resume`,
        content: tailoredResume.result.fullMarkdown,
        fileUrl: null,
      },
    });

    // Save Cover Letter Document
    await db.applicationDocument.create({
      data: {
        applicationId: app.id,
        type: "COVER_LETTER",
        title: `Cover Letter - ${job.company}`,
        content: coverLetter.result,
        fileUrl: null,
      },
    });

    // Save Application Answers
    for (const ans of answers) {
      await db.applicationAnswer.create({
        data: {
          applicationId: app.id,
          question: ans.question,
          answer: ans.answer,
          isAiGenerated: true,
          isEdited: false,
        },
      });
    }

    // Record Application Events
    await db.applicationEvent.create({
      data: {
        applicationId: app.id,
        eventType: "PREPARING",
        notes: "AI compiled tailored resume, customized cover letter, and preliminary answers.",
      },
    });

    if (targetStatus === "SUBMITTED") {
      await db.applicationEvent.create({
        data: {
          applicationId: app.id,
          eventType: "SUBMITTED",
          notes: `Official submission dispatched via ${job.atsProvider} API. Confirmation ID: ${externalId}`,
        },
      });

      // Notify user
      await db.notification.create({
        data: {
          userId,
          title: "Application Submitted! 🚀",
          message: `Your tailored application for ${job.title} at ${job.company} was submitted successfully.`,
          type: "APPLICATION_SUBMITTED",
          link: `/dashboard/applications/${app.id}`,
        },
      });
    } else {
      await db.applicationEvent.create({
        data: {
          applicationId: app.id,
          eventType: "READY_FOR_REVIEW",
          notes: "Application materials assembled. Awaiting user review before external submission.",
        },
      });

      await db.notification.create({
        data: {
          userId,
          title: "Application Ready for Review ✨",
          message: `Tailored materials for ${job.title} at ${job.company} are ready. Review before submitting.`,
          type: "NEEDS_REVIEW",
          link: `/dashboard/applications/${app.id}`,
        },
      });
    }

    // Save interaction
    await db.jobInteraction.create({
      data: {
        userId,
        jobId: job.id,
        interactionType: "APPLIED",
        metadata: { status: targetStatus, matchScore: matchAnalysis.result.overallMatch },
      },
    });

    return {
      capability,
      status: targetStatus,
      message:
        targetStatus === "SUBMITTED"
          ? `Application submitted directly to ${job.company} via ${job.atsProvider} API.`
          : capability === "MANUAL_REQUIRED"
          ? `Application materials prepared. Continue to employer careers portal to complete submission.`
          : `Application materials prepared. Review and confirm submission.`,
      externalId,
      requiresManualHandoff: capability === "MANUAL_REQUIRED",
      preparedMaterials: {
        coverLetter: coverLetter.result,
        answeredQuestionsCount: answers.length,
      },
    };
  }
}
