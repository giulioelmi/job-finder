'use client'

import { Sidebar } from './sidebar'

export function AppLayout({ children, userEmail }: { children: React.ReactNode; userEmail?: string }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar userEmail={userEmail} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
