import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/jwt";
import db from "@/lib/db";
import { AIService } from "@/lib/ai/provider";
import { ResumeValidator } from "@/lib/ai/validator";

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const { jobId, resumeId } = await req.json();

    const job = await db.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const profile = await db.profile.findUnique({
      where: { userId: user.id },
      include: { skills: true, experiences: true, educations: true, projects: true, user: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 400 });
    }

    let tailored = await AIService.tailorResume(profile, job, undefined, user.id);

    // Rule 42: Validate against user facts!
    const validation = ResumeValidator.validateTailoredResume(tailored.result, profile);

    if (!validation.isValid && validation.recommendation === "REJECT") {
      // Regenerate with strict enforcement
      tailored = await AIService.tailorResume(profile, job, undefined, user.id);
    }

    // Save as ResumeVersion if master resume exists
    let masterResume = resumeId ? await db.resume.findUnique({ where: { id: resumeId } }) : null;
    if (!masterResume) {
      masterResume = await db.resume.findFirst({ where: { userId: user.id, isDefault: true } });
    }

    let versionRecord = null;
    if (masterResume) {
      versionRecord = await db.resumeVersion.create({
        data: {
          resumeId: masterResume.id,
          jobId: job.id,
          versionType: "TAILORED",
          title: `${job.title} - ${job.company} Tailored`,
          targetRole: tailored.result.targetRole,
          summary: tailored.result.summary,
          skills: tailored.result.skills,
          experienceHighlights: tailored.result.experienceHighlights,
          fullContent: tailored.result.fullMarkdown,
          matchScore: 90,
        },
      });
    }

    return NextResponse.json({
      success: true,
      tailoredResume: tailored.result,
      validation,
      version: versionRecord,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to tailor resume" }, { status: 500 });
  }
}
