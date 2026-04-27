'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sidebar } from './sidebar'
import { OnboardingModal } from '@/components/onboarding/onboarding-modal'
import { ExtensionInstallModal } from '@/components/onboarding/extension-install-modal'
import { Menu, Leaf, Bell } from 'lucide-react'

interface AppLayoutProps {
  children: React.ReactNode
  userEmail?: string
  notificationCount?: number
  isNewUser?: boolean
  userId?: string
  showExtensionInstallModal?: boolean
}

export function AppLayout({ children, userEmail, notificationCount = 0, isNewUser = false, userId, showExtensionInstallModal = false }: AppLayoutProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-[#f7faf8]">
      {isNewUser && userId && userEmail && (
        <OnboardingModal userId={userId} userEmail={userEmail} />
      )}

      {!isNewUser && showExtensionInstallModal && userId && (
        <ExtensionInstallModal userId={userId} />
      )}

      {/* Desktop sidebar — always visible on lg+ */}
      <div className="hidden lg:block flex-shrink-0">
        <Sidebar userEmail={userEmail} notificationCount={notificationCount} />
      </div>

      {/* Mobile drawer backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-200 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar userEmail={userEmail} onClose={() => setOpen(false)} notificationCount={notificationCount} />
      </div>

      {/* Main content column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 border-b border-[#d4e9db] bg-[#f0f7f3] flex-shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="p-1.5 rounded-lg hover:bg-green-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 bg-green-700 rounded-lg flex items-center justify-center">
              <Leaf className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-gray-900 tracking-tight">Bamboo</span>
          </div>
          {/* Notification bell — mobile only */}
          <Link
            href="/networking"
            className="relative p-1.5 rounded-lg hover:bg-green-100 transition-colors"
            aria-label={notificationCount > 0 ? `${notificationCount} follow-up reminders` : 'Networking'}
          >
            <Bell className="w-5 h-5 text-gray-700" />
            {notificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                {notificationCount}
              </span>
            )}
          </Link>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>

    </div>
  )
}
