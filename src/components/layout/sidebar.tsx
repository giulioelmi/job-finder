'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Leaf,
  Settings,
  Bell,
  LogOut,
  Briefcase,
  Users,
  X,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

interface SidebarProps {
  userEmail?: string
  onClose?: () => void
  notificationCount?: number
}

export function Sidebar({ userEmail, onClose, notificationCount = 0 }: SidebarProps) {
  const pathname = usePathname()

  const navItems: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/jobs', label: 'Recent Jobs', icon: Bell },
    { href: '/applications', label: 'Applications', icon: Briefcase },
    { href: '/networking', label: 'Networking', icon: Users, badge: notificationCount },
    { href: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="w-64 bg-[#f0f7f3] flex flex-col h-screen border-r border-[#d4e9db]">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-[#d4e9db] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900 tracking-tight">Bamboo</span>
        </div>
        {/* Close button — only shown in mobile drawer */}
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-green-100 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-green-700 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-green-100'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {badge != null && badge > 0 && (
                <span className={cn(
                  'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-xs font-bold',
                  isActive ? 'bg-white text-green-700' : 'bg-orange-500 text-white'
                )}>
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-[#d4e9db]">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs text-gray-500 truncate">{userEmail || 'user@example.com'}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            try { await fetch('/auth/signout', { method: 'POST' }) } catch {}
            window.location.href = '/login'
          }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-green-100 transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  )
}
