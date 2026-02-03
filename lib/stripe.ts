// lib/stripe.ts
import Stripe from "stripe";

/**
 * Singleton Stripe client.
 * We rely on the Stripe account's default API version to avoid TS literal mismatches.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  _stripe = new Stripe(key);

  return _stripe;
}