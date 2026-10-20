import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      await req.text(),
      req.headers.get('stripe-signature')!,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const service = createServiceClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    await service.from('billing').upsert({
      user_id: session.client_reference_id,
      stripe_customer_id: session.customer as string,
      is_pro: true,
      updated_at: new Date().toISOString(),
    })
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object
    await service
      .from('billing')
      .update({
        is_pro: ['active', 'trialing'].includes(subscription.status),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', subscription.customer as string)
  }

  return NextResponse.json({ received: true })
}
