import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`, 303)

  const { data: billing } = await createServiceClient()
    .from('billing')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    client_reference_id: user.id,
    ...(billing?.stripe_customer_id
      ? { customer: billing.stripe_customer_id }
      : { customer_email: user.email }),
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?upgraded=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  })

  return NextResponse.redirect(session.url!, 303)
}
