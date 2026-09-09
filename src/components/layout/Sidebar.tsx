'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
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
  CheckSquare,
  UserCheck,
  Send,
  Share2,
  Banknote,
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
      { href: '/tasks', label: 'Tasks & Operations', icon: CheckSquare },
      { href: '/payslips', label: 'My Payslips', icon: FileText },
    ],
  },
  {
    section: 'Finance & Clients',
    items: [
      { href: '/quotations', label: 'Quotations', icon: FileText },
      { href: '/invoices', label: 'Invoices', icon: Receipt },
      { href: '/clients', label: 'Clients', icon: Building2 },
    ],
  },
  {
    section: 'Management',
    items: [
      { href: '/settings/agents', label: 'Team & Staff', icon: UserCheck },
      { href: '/payroll', label: 'Payroll & Salaries', icon: Banknote },
      { href: '/settings/import', label: 'Import leads', icon: Upload },
    ],
  },
]

const accountManagerNav = [
  {
    section: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/leads', label: 'Leads', icon: Users },
      { href: '/tasks', label: 'Tasks & Operations', icon: CheckSquare },
      { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
    ],
  },
  {
    section: 'Finance & Clients',
    items: [
      { href: '/quotations', label: 'Quotations', icon: FileText },
      { href: '/invoices', label: 'Invoices', icon: Receipt },
      { href: '/clients', label: 'Clients', icon: Building2 },
      { href: '/payslips', label: 'My Payslips', icon: FileText },
    ],
  },
]

const agentNav = [
  {
    section: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/leads', label: 'My leads', icon: Users },
      { href: '/tasks', label: 'Tasks & Operations', icon: CheckSquare },
      { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
    ],
  },
  {
    section: 'Finance & Clients',
    items: [
      { href: '/quotations', label: 'Quotations', icon: FileText },
      { href: '/invoices', label: 'Invoices', icon: Receipt },
      { href: '/clients', label: 'Clients', icon: Building2 },
      { href: '/payslips', label: 'My Payslips', icon: FileText },
    ],
  },
]

const employeeNav = [
  {
    section: 'My Workspace',
    items: [
      { href: '/tasks?tab=MY', label: 'My Tasks', icon: CheckSquare },
      { href: '/clients', label: 'Assigned Clients', icon: Building2 },
      { href: '/payslips', label: 'My Payslips', icon: FileText },
    ],
  },
]

const clientNav = [
  {
    section: 'Client Portal',
    items: [
      { href: '/portal?section=overview', label: 'Overview', icon: LayoutDashboard },
      { href: '/portal?section=finance', label: 'Invoices & Quotes', icon: Receipt },
      { href: '/portal?section=reports', label: 'Reports', icon: FileText },
      { href: '/portal?section=tasks', label: 'Deliverables & Tasks', icon: CheckSquare },
      { href: '/portal?section=company', label: 'Social & Assets', icon: Share2 },
      { href: '/portal?section=support', label: 'Message Manager', icon: Send },
    ],
  },
]

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mobileOpen, setMobileOpen] = useState(false)
  const nav =
    profile.role === 'ADMIN'
      ? adminNav
      : profile.role === 'ACCOUNT_MANAGER'
      ? accountManagerNav
      : profile.role === 'EMPLOYEE'
      ? employeeNav
      : profile.role === 'CLIENT'
      ? clientNav
      : agentNav

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
    if (profile.role === 'CLIENT') {
      const activeSec = searchParams?.get('section') || 'overview'
      const hrefSec = new URLSearchParams(href.split('?')[1] || '').get('section') || 'overview'
      return pathname.startsWith('/portal') && activeSec === hrefSec
    }
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
          <img
            src="/Adonix X Logo.jpeg"
            alt="Adonix Logo"
            suppressHydrationWarning
            style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }}
          />
          <span style={{ fontSize: 15, fontWeight: 600 }}>Adonix CRM</span>
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
            <img
              src="/Adonix X Logo.jpeg"
              alt="Adonix Logo"
              suppressHydrationWarning
              style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }}
            />
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
                {profile.role === 'ADMIN'
                  ? 'Admin'
                  : profile.role === 'ACCOUNT_MANAGER'
                  ? 'Account Manager'
                  : profile.role === 'AGENT'
                  ? 'Sales Agent'
                  : profile.role === 'CLIENT'
                  ? 'Client Portal'
                  : profile.specialization || 'Employee'}
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
