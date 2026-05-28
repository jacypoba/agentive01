import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/**
 * Server-side Stripe client. Uses STRIPE_SECRET_KEY (test mode: sk_test_...).
 */
export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2026-05-27.dahlia",
      typescript: true,
    });
  }

  return stripeClient;
}

export function isStripeTestMode(): boolean {
  const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
  return secretKey.startsWith("sk_test_");
}
