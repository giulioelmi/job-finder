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
  if (!billing?.stripe_customer_id) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings`, 303)
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: billing.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  })

  return NextResponse.redirect(session.url, 303)
}
