import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'

// Stripe is the source of truth for the plan. Every event here is an idempotent upsert.
const PRO_STATUSES = ['active', 'trialing', 'past_due'] // past_due keeps access while Stripe retries the card

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const signature = req.headers.get('stripe-signature')
  if (!secret || !signature) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(await req.text(), signature, secret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.client_reference_id
    if (userId && session.mode === 'subscription') {
      await supabase.from('subscriptions').upsert({
        user_id: userId,
        plan: 'pro',
        status: 'active',
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
      }, { onConflict: 'user_id' })
    }
  }

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const customer = subscription.customer as string
    const userId = subscription.metadata?.user_id
    const plan = PRO_STATUSES.includes(subscription.status) ? 'pro' : 'free'
    const fields = { plan, status: subscription.status, stripe_subscription_id: subscription.id }

    if (userId) {
      await supabase.from('subscriptions').upsert({ user_id: userId, stripe_customer_id: customer, ...fields }, { onConflict: 'user_id' })
    } else {
      await supabase.from('subscriptions').update(fields).eq('stripe_customer_id', customer)
    }
  }

  return NextResponse.json({ received: true })
}
