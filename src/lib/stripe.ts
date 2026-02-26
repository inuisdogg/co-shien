import Stripe from 'stripe';
import { loadStripe } from '@stripe/stripe-js';

/**
 * Server-side Stripe instance (lazy singleton)
 * API Routes / Server Components only
 */
let _stripe: Stripe | null = null;

export function getServerStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    });
  }
  return _stripe;
}

// Backwards compat — lazy getter
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getServerStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/**
 * Client-side Stripe.js (lazy-loaded singleton)
 * Components only
 */
let stripePromise: ReturnType<typeof loadStripe> | null = null;

export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
    );
  }
  return stripePromise;
}
