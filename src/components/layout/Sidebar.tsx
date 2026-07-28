'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import {
  LayoutDashboard,
  Users,
  Megaphone,
  FileText,
  Receipt,
  Settings,
  LogOut,
  Building2,
  Upload,
  Menu,
  X,
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
  // {
  //   section: 'Finance',
  //   items: [
  //     { href: '/quotations', label: 'Quotations', icon: FileText },
  //     { href: '/invoices', label: 'Invoices', icon: Receipt },
  //     { href: '/clients', label: 'Clients', icon: Building2 },
  //   ],
  // },
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
  // {
  //   section: 'Finance',
  //   items: [
  //     { href: '/quotations', label: 'Quotations', icon: FileText },
  //     { href: '/invoices', label: 'Invoices', icon: Receipt },
  //     { href: '/clients', label: 'Clients', icon: Building2 },
  //   ],
  // },
]

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const nav = profile.role === 'ADMIN' ? adminNav : agentNav

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  async function handleSignOut() {
    setMobileOpen(false)
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
    <>
      {/* Mobile-only top header bar */}
      <div className="mobile-header">
        <Link href="/dashboard" className="sidebar-logo" onClick={() => setMobileOpen(false)}>
          <span className="sidebar-logo-icon">A</span>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Adonix</span>
        </Link>
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Backdrop — only rendered when drawer is open, mobile only */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* The sidebar nav — on desktop always visible, on mobile slides in as drawer */}
      <nav className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}>
        {/* Sidebar logo header */}
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/dashboard" className="sidebar-logo" onClick={() => setMobileOpen(false)}>
            <span className="sidebar-logo-icon">A</span>
            <span>Adonix CRM</span>
          </Link>
          {/* Close button — only visible on mobile via CSS */}
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav links */}
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
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon size={15} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>

        {/* User profile and sign out */}
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
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {profile.role === 'ADMIN' ? 'Admin' : 'Agent'}
              </div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="sidebar-nav-item"
            style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', marginTop: 4 }}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </nav>
    </>
  )
}
