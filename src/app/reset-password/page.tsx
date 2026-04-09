'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Leaf } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let settled = false

    // Timeout: if no session arrives within 5s, show an error
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        setError('Reset link is invalid or has expired. Please request a new one.')
        setReady(true)
      }
    }, 5000)

    // Case 1: user already has an active session (e.g. logged-in user changing password)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !settled) {
        settled = true
        clearTimeout(timer)
        setReady(true)
      }
    })

    // Case 2: PASSWORD_RECOVERY fires when the hash fragment from the email
    // link is detected by the Supabase client (implicit flow)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && !settled) {
        settled = true
        clearTimeout(timer)
        setReady(true)
      }
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7faf8]">
        <p className="text-sm text-gray-500">Verifying reset link…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7faf8]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-700 rounded-xl mb-4">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Bamboo</h1>
          <p className="text-gray-500 mt-1">Set a new password</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {error && !password ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-red-600">{error}</p>
              <Link href="/forgot-password" className="block text-sm text-green-700 font-medium hover:underline">
                Request a new reset link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-green-700 text-white rounded-lg font-medium hover:bg-green-800 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
          <p className="text-center text-sm text-gray-500 mt-6">
            <Link href="/login" className="text-green-700 font-medium hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
