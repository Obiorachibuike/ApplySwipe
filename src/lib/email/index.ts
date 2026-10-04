export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailService {
  send(payload: EmailPayload): Promise<{ success: boolean; id?: string }>;
}

export class MockEmailService implements EmailService {
  async send(payload: EmailPayload): Promise<{ success: boolean; id?: string }> {
    console.log(`📨 [Email Simulated] To: ${payload.to} | Subject: "${payload.subject}"`);
    return { success: true, id: `msg-${Date.now().toString(36)}` };
  }
}

export class ResendEmailService implements EmailService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(payload: EmailPayload): Promise<{ success: boolean; id?: string }> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "ApplySwipe <notifications@applyswipe.io>",
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        }),
      });
      const data = await res.json();
      return { success: res.ok, id: data.id };
    } catch (e) {
      console.error("Resend error:", e);
      return { success: false };
    }
  }
}

export const emailService: EmailService = process.env.RESEND_API_KEY
  ? new ResendEmailService(process.env.RESEND_API_KEY)
  : new MockEmailService();
