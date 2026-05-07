import { ProfileForm } from '../[id]/profile-form'

export default function NewProfilePage() {
  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">New Profile</h1>
        <p className="text-gray-500 mt-1">Fill in your details to create an autofill profile.</p>
      </div>
      <ProfileForm />
    </div>
  )
}
