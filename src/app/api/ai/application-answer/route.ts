import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/jwt";
import db from "@/lib/db";
import { AIService } from "@/lib/ai/provider";

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const { jobId, question } = await req.json();

    if (!question) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

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

    const response = await AIService.answerQuestion(question, profile, job, user.id);

    return NextResponse.json({
      success: true,
      answer: response.result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to generate answer" }, { status: 500 });
  }
}
