import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { appUrl, BillingNotConfiguredError, getStripe } from '@/lib/stripe'

// Stripe's hosted page for changing card, cancelling, and downloading invoices.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sub } = await createServiceClient().from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).maybeSingle()
  if (!sub?.stripe_customer_id) return NextResponse.json({ error: 'No billing account yet' }, { status: 400 })

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${appUrl(req)}/career-profile`,
    })
    return NextResponse.json({ url: session.url })
  } catch (e) {
    if (e instanceof BillingNotConfiguredError)
      return NextResponse.json({ error: 'Billing is not set up yet' }, { status: 503 })
    console.error('[billing] portal failed:', e)
    return NextResponse.json({ error: 'Could not open billing' }, { status: 500 })
  }
}
