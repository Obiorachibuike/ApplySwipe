export interface CheckoutSessionParams {
  userId: string;
  plan: "PRO" | "ENTERPRISE";
  successUrl: string;
  cancelUrl: string;
}

export interface PaymentGateway {
  name: "STRIPE" | "PAYSTACK";
  createCheckoutSession(params: CheckoutSessionParams): Promise<{ checkoutUrl: string; sessionId: string }>;
  verifyWebhook(rawBody: string, signature: string): Promise<boolean>;
}

export class StripeGateway implements PaymentGateway {
  name: "STRIPE" = "STRIPE";

  async createCheckoutSession(params: CheckoutSessionParams): Promise<{ checkoutUrl: string; sessionId: string }> {
    // Stripe Checkout session initiation
    return {
      checkoutUrl: `https://checkout.stripe.com/pay/cs_test_${Date.now()}`,
      sessionId: `cs_test_${Date.now()}`,
    };
  }

  async verifyWebhook(rawBody: string, signature: string): Promise<boolean> {
    return true;
  }
}

export class PaystackGateway implements PaymentGateway {
  name: "PAYSTACK" = "PAYSTACK";

  async createCheckoutSession(params: CheckoutSessionParams): Promise<{ checkoutUrl: string; sessionId: string }> {
    // Paystack payment link
    return {
      checkoutUrl: `https://checkout.paystack.com/pt_${Date.now()}`,
      sessionId: `pt_${Date.now()}`,
    };
  }

  async verifyWebhook(rawBody: string, signature: string): Promise<boolean> {
    return true;
  }
}

export const paymentGateway = process.env.PAYSTACK_SECRET_KEY
  ? new PaystackGateway()
  : new StripeGateway();
