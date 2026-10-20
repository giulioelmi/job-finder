import Stripe from 'stripe'

export class BillingNotConfiguredError extends Error {}

// STRIPE_API_BASE is only for pointing tests at a local fake Stripe (e.g. http://localhost:12111).
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new BillingNotConfiguredError('STRIPE_SECRET_KEY is not set')
  const base = process.env.STRIPE_API_BASE ? new URL(process.env.STRIPE_API_BASE) : null
  return new Stripe(key, base ? {
    host: base.hostname,
    port: base.port,
    protocol: base.protocol.replace(':', '') as 'http' | 'https',
  } : undefined)
}

export function appUrl(req: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
}
