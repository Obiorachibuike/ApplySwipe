import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/jwt";
import db from "@/lib/db";
import { AIService } from "@/lib/ai/provider";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const job = await db.job.findUnique({
      where: { id: params.id },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const user = await getSessionUser();
    let matchAnalysis = null;
    let isSaved = false;
    let isApplied = false;
    let isPassed = false;
    let application = null;

    if (user) {
      const profile = await db.profile.findUnique({
        where: { userId: user.id },
        include: { skills: true, experiences: true, educations: true, projects: true },
      });

      if (profile) {
        const analysis = await AIService.analyzeMatch(profile, job, user.id);
        matchAnalysis = analysis.result;
      }

      const saved = await db.savedJob.findFirst({ where: { userId: user.id, jobId: job.id } });
      isSaved = !!saved;

      application = await db.application.findFirst({
        where: { userId: user.id, jobId: job.id },
        include: { answers: true, documents: true, events: true },
      });
      isApplied = !!application;

      const passed = await db.jobInteraction.findFirst({
        where: { userId: user.id, jobId: job.id, interactionType: "PASSED" },
      });
      isPassed = !!passed;

      // Record VIEWED interaction
      await db.jobInteraction.create({
        data: {
          userId: user.id,
          jobId: job.id,
          interactionType: "VIEWED",
        },
      });
    }

    return NextResponse.json({
      job: {
        ...job,
        matchAnalysis,
        isSaved,
        isApplied,
        isPassed,
        application,
      },
    });
  } catch (error: any) {
    console.error("Error fetching job:", error);
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}
