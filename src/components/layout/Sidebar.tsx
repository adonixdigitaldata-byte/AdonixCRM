'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types/database'
import {
  LayoutDashboard,
  Users,
  Megaphone,
  FileText,
  Receipt,
  Settings,
  LogOut,
  ChevronRight,
  Building2,
  Upload,
} from 'lucide-react'

interface SidebarProps {
  profile: Profile
}

const adminNav = [
  {
    section: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/leads', label: 'Leads', icon: Users },
      { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
    ],
  },
  {
    section: 'Finance',
    items: [
      { href: '/quotations', label: 'Quotations', icon: FileText },
      { href: '/invoices', label: 'Invoices', icon: Receipt },
      { href: '/clients', label: 'Clients', icon: Building2 },
    ],
  },
  {
    section: 'Settings',
    items: [
      { href: '/settings/agents', label: 'Agents', icon: Settings },
      { href: '/settings/import', label: 'Import leads', icon: Upload },
    ],
  },
]

const agentNav = [
  {
    section: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/leads', label: 'My leads', icon: Users },
      { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
    ],
  },
  {
    section: 'Finance',
    items: [
      { href: '/quotations', label: 'Quotations', icon: FileText },
      { href: '/invoices', label: 'Invoices', icon: Receipt },
      { href: '/clients', label: 'Clients', icon: Building2 },
    ],
  },
]

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const nav = profile.role === 'ADMIN' ? adminNav : agentNav

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <nav className="sidebar">
      {/* Logo */}
      <div className="sidebar-header">
        <Link href="/dashboard" className="sidebar-logo">
          <span className="sidebar-logo-icon">A</span>
          <span>Adonix CRM</span>
        </Link>
      </div>

      {/* Nav */}
      <div className="sidebar-nav">
        {nav.map((section) => (
          <div key={section.section}>
            <div className="sidebar-section-label">{section.section}</div>
            {section.items.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-nav-item ${isActive(item.href) ? 'active' : ''}`}
                >
                  <Icon size={15} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </div>

      {/* User / Sign out */}
      <div className="sidebar-footer">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <div className="avatar avatar-sm">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {profile.name}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
              }}
            >
              {profile.role === 'ADMIN' ? 'Admin' : 'Agent'}
            </div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="sidebar-nav-item"
          style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer' }}
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </nav>
  )
}
