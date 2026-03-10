'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Menu, Leaf } from 'lucide-react'

export function AppLayout({ children, userEmail }: { children: React.ReactNode; userEmail?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-[#f7faf8]">

      {/* Desktop sidebar — always visible on lg+ */}
      <div className="hidden lg:block flex-shrink-0">
        <Sidebar userEmail={userEmail} />
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
        <Sidebar userEmail={userEmail} onClose={() => setOpen(false)} />
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
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-green-700 rounded-lg flex items-center justify-center">
              <Leaf className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-gray-900 tracking-tight">Bamboo</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>

    </div>
  )
}
