import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ProfileForm } from './profile-form'

export default async function EditProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('autofill_profiles')
    .select('*')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (!profile) notFound()

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
        <p className="text-gray-500 mt-1">{profile.name}</p>
      </div>
      <ProfileForm initialProfile={profile} />
    </div>
  )
}
