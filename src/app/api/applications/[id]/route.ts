import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/jwt";
import db from "@/lib/db";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const application = await db.application.findUnique({
      where: { id: params.id },
      include: {
        job: true,
        answers: true,
        documents: true,
        events: true,
      },
    });

    if (!application || application.userId !== user.id) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Also get master resume to allow side-by-side comparison
    const masterResume = await db.resume.findFirst({
      where: { userId: user.id, isDefault: true },
    });

    return NextResponse.json({
      success: true,
      application,
      masterResume,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch application" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const application = await db.application.findUnique({
      where: { id: params.id },
    });

    if (!application || application.userId !== user.id) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const body = await req.json();
    const { status, notes, interviewDate, answers, documents } = body;

    const updateData: any = {};
    if (status !== undefined) {
      updateData.status = status;
      if (status === "SUBMITTED" && !application.submittedAt) {
        updateData.submittedAt = new Date().toISOString();
      }
    }
    if (notes !== undefined) updateData.notes = notes;
    if (interviewDate !== undefined) updateData.interviewDate = interviewDate;

    const updated = await db.application.update({
      where: { id: params.id },
      data: updateData,
    });

    // Record Event
    if (status && status !== application.status) {
      await db.applicationEvent.create({
        data: {
          applicationId: params.id,
          eventType: status,
          notes: `Status updated to ${status}`,
        },
      });

      // Notify user
      await db.notification.create({
        data: {
          userId: user.id,
          title: `Application Updated: ${status}`,
          message: `Application status transitioned to ${status}.`,
          type: status === "INTERVIEW" ? "INTERVIEW" : "APPLICATION_SUBMITTED",
          link: `/dashboard/applications/${params.id}`,
        },
      });
    }

    // Update answers if provided
    if (answers && Array.isArray(answers)) {
      for (const a of answers) {
        if (a.id) {
          await db.applicationAnswer.update({
            where: { id: a.id },
            data: { answer: a.answer, isEdited: true },
          });
        }
      }
    }

    // Update documents if provided
    if (documents && Array.isArray(documents)) {
      for (const d of documents) {
        if (d.id) {
          await db.applicationDocument.update({
            where: { id: d.id },
            data: { content: d.content, title: d.title },
          });
        }
      }
    }

    const reloaded = await db.application.findUnique({
      where: { id: params.id },
      include: {
        job: true,
        answers: true,
        documents: true,
        events: true,
      },
    });

    return NextResponse.json({ success: true, application: reloaded });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update application" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const application = await db.application.findUnique({
      where: { id: params.id },
    });

    if (!application || application.userId !== user.id) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    await db.application.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true, message: "Application deleted" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete application" }, { status: 500 });
  }
}
