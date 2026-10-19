import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { appUrl, BillingNotConfiguredError, getStripe } from '@/lib/stripe'

// Starts a Stripe Checkout subscription for the Pro plan.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const stripe = getStripe()
    const priceId = process.env.STRIPE_PRICE_ID
    if (!priceId) throw new BillingNotConfiguredError('STRIPE_PRICE_ID is not set')

    const service = createServiceClient()
    const { data: sub } = await service.from('subscriptions').select('plan, stripe_customer_id').eq('user_id', user.id).maybeSingle()
    if (sub?.plan === 'pro') return NextResponse.json({ error: 'You are already on Pro' }, { status: 400 })

    let customer = sub?.stripe_customer_id as string | undefined
    if (!customer) {
      customer = (await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } })).id
      await service.from('subscriptions').upsert({ user_id: user.id, stripe_customer_id: customer }, { onConflict: 'user_id' })
    }

    const base = appUrl(req)
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { user_id: user.id } },
      success_url: `${base}/career-profile?upgraded=1`,
      cancel_url: `${base}/career-profile`,
    })
    return NextResponse.json({ url: session.url })
  } catch (e) {
    if (e instanceof BillingNotConfiguredError)
      return NextResponse.json({ error: 'Billing is not set up yet' }, { status: 503 })
    console.error('[billing] checkout failed:', e)
    return NextResponse.json({ error: 'Could not start checkout' }, { status: 500 })
  }
}
