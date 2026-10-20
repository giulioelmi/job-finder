import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function PlanCard({ isPro }: { isPro: boolean }) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Plan</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <p className="text-gray-700">{isPro ? 'You are on Pro.' : 'You are on the Free plan.'}</p>
        <form action={isPro ? '/api/stripe/portal' : '/api/stripe/checkout'} method="POST">
          <Button type="submit">{isPro ? 'Manage billing' : 'Upgrade to Pro'}</Button>
        </form>
      </CardContent>
    </Card>
  )
}
