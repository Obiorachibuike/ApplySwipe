import { describe, it, expect } from "vitest";
import db from "../../src/lib/db";
import { ApplicationAgent } from "../../src/lib/applications/agent";

describe("ApplySwipe E2E Integration Pipeline", () => {
  it("processes application, generates materials, and verifies status distinction", async () => {
    const user = await db.user.findFirst({ where: { email: "alex@applyswipe.io" } });
    expect(user).toBeDefined();

    const job = await db.job.findFirst({ where: { company: "Linear" } });
    expect(job).toBeDefined();

    // Run application agent in REVIEW_EVERYTHING mode
    const result = await ApplicationAgent.processApplication(user!.id, job!, "REVIEW_EVERYTHING");
    expect(result.status).toBe("READY_FOR_REVIEW");
    // ApplySwipe prepares materials; it never claims a submission it did not perform.
    expect(result.requiresManualHandoff).toBe(true);
    expect(result.externalId).toBeUndefined();

    // Verify documents exist
    const app = await db.application.findFirst({
      where: { userId: user!.id, jobId: job!.id },
      include: { documents: true, answers: true, events: true },
    });

    expect(app).toBeDefined();
    expect(app!.documents.length).toBeGreaterThanOrEqual(2);
    expect(app!.answers.length).toBeGreaterThanOrEqual(2);
    expect(app!.events.length).toBeGreaterThanOrEqual(1);

    // Verify status distinction: never claims submitted when only prepared
    expect(app!.status).not.toBe("SUBMITTED");
    expect(app!.status).not.toBe("APPLIED");
    expect(app!.submissionMethod).toBe("USER_CONFIRMED_EXTERNAL");
    expect(app!.appliedAt ?? null).toBeNull();
  });
});
