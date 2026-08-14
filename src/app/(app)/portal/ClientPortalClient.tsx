'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import {
  LayoutDashboard,
  Receipt,
  FileText,
  CheckSquare,
  Globe,
  Share2,
  ExternalLink,
  Building2,
  Calendar,
  Layers,
  Facebook,
  Instagram,
  Video,
  MapPin,
  User,
  ShieldAlert,
  Send,
  Eye,
  EyeOff,
  LogOut,
  ArrowRight,
  FolderDown,
  Lock,
  Copy,
  Check,
  Key,
  Phone,
  Mail,
  Clock,
  UserCheck,
} from 'lucide-react'

interface Props {
  client: any
  quotations: any[]
  invoices: any[]
  payments: any[]
  tasks: any[]
  assignedAgent: any
  currentProfile: any
  isPreview?: boolean
}

type TabType = 'overview' | 'finance' | 'reports' | 'tasks' | 'company' | 'support'

function ensureExternalUrl(rawUrl?: string): string {
  if (!rawUrl) return '#'
  let url = rawUrl.trim()
  if (!url) return '#'
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  return `https://${url}`
}

function PortalPagination({
  currentPage,
  totalItems,
  pageSize = 10,
  onPageChange,
}: {
  currentPage: number
  totalItems: number
  pageSize?: number
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.ceil(totalItems / pageSize) || 1
  if (totalItems <= pageSize) return null

  const handlePageClick = (page: number) => {
    onPageChange(page)
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }, 50)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 18px',
        borderTop: '1px solid var(--border)',
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} items
      </span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-outline btn-xs"
          disabled={currentPage === 1}
          onClick={() => handlePageClick(currentPage - 1)}
          style={{ fontSize: 11, padding: '2px 8px' }}
        >
          Prev
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            type="button"
            className={`btn btn-xs ${currentPage === p ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => handlePageClick(p)}
            style={{ fontSize: 11, minWidth: 26, padding: '2px 6px' }}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-outline btn-xs"
          disabled={currentPage === totalPages}
          onClick={() => handlePageClick(currentPage + 1)}
          style={{ fontSize: 11, padding: '2px 8px' }}
        >
          Next
        </button>
      </div>
    </div>
  )
}

export default function ClientPortalClient({
  client,
  quotations,
  invoices,
  payments,
  tasks,
  assignedAgent,
  currentProfile,
  isPreview = false,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Read section reactively from URL query params (defaults to overview)
  const sectionParam = (searchParams.get('section') as TabType) || 'overview'
  const activeTab: TabType = ['overview', 'finance', 'reports', 'tasks', 'company', 'support'].includes(sectionParam)
    ? sectionParam
    : 'overview'

  // Client Support Request Form state
  const [msgSubject, setMsgSubject] = useState('')
  const [msgCategory, setMsgCategory] = useState('OTHER')
  const [msgBody, setMsgBody] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [msgSentSuccess, setMsgSentSuccess] = useState(false)

  // Pagination states (10 items per page)
  const [invoicePage, setInvoicePage] = useState(1)
  const [quotationPage, setQuotationPage] = useState(1)
  const [taskPage, setTaskPage] = useState(1)
  const [monthlyReportPage, setMonthlyReportPage] = useState(1)
  const [customReportPage, setCustomReportPage] = useState(1)
  const [credPage, setCredPage] = useState(1)

  // Password visibility & clipboard state for credentials
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const clientCredentials: any[] = Array.isArray(client.credentials) ? client.credentials : []

  function togglePasswordVisibility(id: string) {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function handleCopy(text: string, key: string) {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedField(key)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Parse JSON data fields safely
  const monthlyReports: { id: string; month: string; year: string; url: string }[] = (() => {
    try {
      if (client.report_link && client.report_link.startsWith('[')) {
        return JSON.parse(client.report_link)
      }
    } catch (e) {}
    return client.report_link
      ? [{ id: 'primary', month: 'Primary Report', year: '2026', url: client.report_link }]
      : []
  })()

  const websites: { id: string; name: string; url: string }[] = (() => {
    try {
      if (client.website_url && client.website_url.startsWith('[')) {
        return JSON.parse(client.website_url)
      }
    } catch (e) {}
    return client.website_url
      ? [{ id: 'primary', name: 'Primary Website', url: client.website_url }]
      : []
  })()

  const customServiceLinks: any[] = client.service_links ?? []
  const secondaryContacts: any[] = client.secondary_contacts ?? []

  // Report Years filter state
  const reportYears = Array.from(new Set(monthlyReports.map((r) => r.year || '2026'))).sort(
    (a, b) => b.localeCompare(a)
  )
  const [selectedReportYear, setSelectedReportYear] = useState<string>(
    reportYears[0] ?? '2026'
  )

  // Calculate Financial Summaries
  const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0)
  const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0)
  const balanceDue = totalInvoiced - totalPaid

  const overdueInvoices = invoices.filter((inv) => {
    if (inv.status === 'PAID' || inv.status === 'CANCELLED') return false
    if (inv.status === 'OVERDUE') return true
    if (inv.due_date) {
      return new Date(inv.due_date) < new Date()
    }
    return false
  })

  // Sign out handler
  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Send client support request / note handler
  async function handleSendSupportRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!msgSubject.trim() || !msgBody.trim()) return

    setSendingMsg(true)
    try {
      const res = await fetch('/api/portal/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          category: msgCategory,
          subject: msgSubject.trim(),
          message: msgBody.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit request')
      }

      setMsgSentSuccess(true)
      setMsgSubject('')
      setMsgBody('')
      setTimeout(() => setMsgSentSuccess(false), 6000)
    } catch (e: any) {
      alert(e.message || 'Failed to submit request')
    } finally {
      setSendingMsg(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: 90 }}>
      {/* Admin Preview Banner */}
      {isPreview && (
        <div
          style={{
            background: '#4F46E5',
            color: '#FFFFFF',
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={16} />
            <span>
              <strong>Previewing Client Portal</strong> for <em>{client.name}</em> ({client.company || 'Client Profile'})
            </span>
          </div>
          <button
            onClick={() => window.close()}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#FFF',
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Exit Preview
          </button>
        </div>
      )}

      {/* Top Header / Portal Navbar */}
      <header className="portal-header">
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #4F46E5 0%, #312E81 100%)',
                color: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 18,
                boxShadow: '0 4px 10px rgba(79, 70, 229, 0.25)',
              }}
            >
              {(client.company || client.name || 'C').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}
                >
                  {client.company || client.name}
                </h1>
                <span
                  className="badge"
                  style={{
                    background: 'rgba(79, 70, 229, 0.1)',
                    color: 'var(--accent)',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  Client Access Portal
                </span>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  margin: 0,
                  marginTop: 2,
                }}
              >
                Welcome back · {client.email || 'Client Profile'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {assignedAgent && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              >
                <User size={14} style={{ color: 'var(--accent)' }} />
                <div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>
                    Account Manager
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {assignedAgent.name}
                  </div>
                </div>
              </div>
            )}

            {!isPreview && (
              <button
                onClick={handleSignOut}
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--text-secondary)', display: 'inline-flex', gap: 6 }}
              >
                <LogOut size={14} /> Sign out
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: 1200, margin: '24px auto', padding: '0 16px' }}>
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Financial Overview Stat Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 16,
              }}
            >
              <div className="card" style={{ padding: 20 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Total Invoiced
                </span>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    marginTop: 6,
                    color: 'var(--text-primary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  SAR {totalInvoiced.toLocaleString('en', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  {invoices.length} total issued invoices
                </div>
              </div>

              <div className="card" style={{ padding: 20 }}>
                <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>
                  Total Paid
                </span>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    marginTop: 6,
                    color: 'var(--success)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  SAR {totalPaid.toLocaleString('en', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  Settled payments to date
                </div>
              </div>

              <div className="card" style={{ padding: 20 }}>
                <span
                  style={{
                    fontSize: 12,
                    color: balanceDue > 0 ? 'var(--warning)' : 'var(--text-secondary)',
                    fontWeight: 500,
                  }}
                >
                  Outstanding Balance
                </span>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    marginTop: 6,
                    color: balanceDue > 0 ? 'var(--warning)' : 'var(--text-primary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  SAR {balanceDue.toLocaleString('en', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  {overdueInvoices.length > 0 ? `${overdueInvoices.length} overdue invoice(s)` : 'Account up to date'}
                </div>
              </div>

              <div className="card" style={{ padding: 20 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Active Retainer &amp; Status
                </span>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    marginTop: 6,
                    color: 'var(--accent)',
                  }}
                >
                  {client.billing_cycle || 'Active Client'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  SAR {Number(client.billing_amount || 0).toLocaleString()} / cycle
                </div>
              </div>
            </div>

            {/* Quick Access Shortcuts & Recent Deliverables */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 24,
              }}
            >
              {/* Recent Deliverables & Project Tasks */}
              <div className="card">
                <div
                  className="card-header flex items-center justify-between"
                  style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Layers size={16} color="var(--accent)" />
                    <span className="text-section-header">Project Deliverables &amp; Tasks</span>
                  </div>
                  <button
                    onClick={() => router.push('/portal?section=tasks')}
                    className="btn btn-ghost btn-xs"
                    style={{ color: 'var(--accent)', fontSize: 12 }}
                  >
                    View all →
                  </button>
                </div>
                <div className="card-body" style={{ padding: '12px 18px' }}>
                  {tasks.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '16px 0' }}>
                      No active deliverables published yet.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {tasks.slice(0, 4).map((task) => (
                        <div
                          key={task.id}
                          style={{
                            padding: '14px 16px',
                            background: 'var(--bg)',
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                            {task.category ? (
                              <span
                                className="badge"
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  padding: '2px 7px',
                                  background: 'rgba(79, 70, 229, 0.1)',
                                  color: 'var(--accent)',
                                  textTransform: 'uppercase',
                                  flexShrink: 0,
                                }}
                              >
                                {task.category}
                              </span>
                            ) : <span />}
                            <span
                              className="badge"
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '3px 8px',
                                background:
                                  task.status === 'COMPLETED'
                                    ? 'rgba(22, 163, 74, 0.1)'
                                    : task.status === 'IN_PROGRESS'
                                    ? 'rgba(2, 132, 199, 0.1)'
                                    : 'rgba(217, 119, 6, 0.1)',
                                color:
                                  task.status === 'COMPLETED'
                                    ? 'var(--success)'
                                    : task.status === 'IN_PROGRESS'
                                    ? 'var(--info)'
                                    : 'var(--warning)',
                                flexShrink: 0,
                              }}
                            >
                              {task.status?.replace('_', ' ')}
                            </span>
                          </div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: 1.45 }}>
                            {task.title}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Monthly Reports & Social Assets Quick Card */}
              <div className="card">
                <div
                  className="card-header flex items-center justify-between"
                  style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={16} color="var(--accent)" />
                    <span className="text-section-header">Monthly Reports &amp; Assets</span>
                  </div>
                  <button
                    onClick={() => router.push('/portal?section=reports')}
                    className="btn btn-ghost btn-xs"
                    style={{ color: 'var(--accent)', fontSize: 12 }}
                  >
                    View reports →
                  </button>
                </div>
                <div className="card-body" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                      Latest Monthly Reports
                    </span>
                    {monthlyReports.length === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                        No monthly reports uploaded yet.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {monthlyReports.slice(0, 4).map((rep) => (
                          <a
                            key={rep.id}
                            href={rep.url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-outline btn-sm"
                            style={{ display: 'inline-flex', gap: 6, fontSize: 12 }}
                          >
                            <FileText size={13} /> {rep.month} {rep.year} <ExternalLink size={11} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                      Social &amp; Brand Links
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {client.facebook_url && (
                        <a href={ensureExternalUrl(client.facebook_url)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-xs" style={{ display: 'inline-flex', gap: 4 }}>
                          <Facebook size={13} color="#1877F2" /> Facebook
                        </a>
                      )}
                      {client.instagram_url && (
                        <a href={ensureExternalUrl(client.instagram_url)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-xs" style={{ display: 'inline-flex', gap: 4 }}>
                          <Instagram size={13} color="#E4405F" /> Instagram
                        </a>
                      )}
                      {client.tiktok_url && (
                        <a href={ensureExternalUrl(client.tiktok_url)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-xs" style={{ display: 'inline-flex', gap: 4 }}>
                          <Video size={13} /> TikTok
                        </a>
                      )}
                      {client.gmb_url && (
                        <a href={ensureExternalUrl(client.gmb_url)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-xs" style={{ display: 'inline-flex', gap: 4 }}>
                          <MapPin size={13} color="#EA4335" /> Google My Business
                        </a>
                      )}
                      {client.brand_assets_link && (
                        <a href={ensureExternalUrl(client.brand_assets_link)} target="_blank" rel="noreferrer" className="btn btn-outline btn-xs" style={{ display: 'inline-flex', gap: 4 }}>
                          <FolderDown size={13} /> Brand Assets Drive
                        </a>
                      )}
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 10 }}>
                      <button
                        onClick={() => router.push('/portal?section=company')}
                        className="btn btn-outline btn-xs"
                        style={{ width: '100%', justifyContent: 'center', color: 'var(--accent)', fontWeight: 600, display: 'inline-flex', gap: 6 }}
                      >
                        <Share2 size={13} /> View All Social Links, Assets &amp; Logins Vault →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* QUOTATIONS & INVOICES TAB */}
        {activeTab === 'finance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Invoices List Card */}
            <div className="card">
              <div className="card-header flex items-center justify-between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Receipt size={16} color="var(--accent)" />
                  <span className="text-section-header">Invoices ({invoices.length})</span>
                </div>
              </div>

              <div className="card-body" style={{ padding: 0 }}>
                {invoices.length === 0 ? (
                  <p style={{ padding: 24, fontSize: 13, color: 'var(--text-secondary)' }}>
                    No invoices generated yet for your account.
                  </p>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="table-wrapper portal-desktop-table" style={{ border: 'none' }}>
                      <table className="table table-compact">
                        <thead>
                          <tr>
                            <th>Invoice #</th>
                            <th>Status</th>
                            <th>Issue Date</th>
                            <th>Due Date</th>
                            <th className="num">Total</th>
                            <th className="num">Paid</th>
                            <th className="num">Balance</th>
                            <th style={{ width: 140, textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.slice((invoicePage - 1) * 10, invoicePage * 10).map((inv) => {
                            const invBalance = Number(inv.total || 0) - Number(inv.amount_paid || 0)
                            return (
                              <tr key={inv.id}>
                                <td style={{ fontWeight: 600 }}>
                                  <Link href={`/invoices/${inv.id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                    {inv.invoice_number}
                                  </Link>
                                </td>
                                <td>
                                  <span
                                    className="badge"
                                    style={{
                                      fontSize: 10,
                                      background:
                                        inv.status === 'PAID'
                                          ? 'rgba(22, 163, 74, 0.1)'
                                          : inv.status === 'OVERDUE'
                                          ? 'rgba(220, 38, 38, 0.1)'
                                          : 'rgba(217, 119, 6, 0.1)',
                                      color:
                                        inv.status === 'PAID'
                                          ? 'var(--success)'
                                          : inv.status === 'OVERDUE'
                                          ? 'var(--danger)'
                                          : 'var(--warning)',
                                    }}
                                  >
                                    {inv.status}
                                  </span>
                                </td>
                                <td>{format(new Date(inv.issue_date), 'dd MMM yyyy')}</td>
                                <td>{inv.due_date ? format(new Date(inv.due_date), 'dd MMM yyyy') : '—'}</td>
                                <td className="num tabular-nums">
                                  {inv.currency} {Number(inv.total).toLocaleString('en', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="num tabular-nums" style={{ color: 'var(--success)' }}>
                                  {inv.currency} {Number(inv.amount_paid).toLocaleString('en', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="num tabular-nums" style={{ fontWeight: 600 }}>
                                  {inv.currency} {invBalance.toLocaleString('en', { minimumFractionDigits: 2 })}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <Link
                                    href={`/invoices/${inv.id}`}
                                    className="btn btn-outline btn-xs"
                                    style={{ display: 'inline-flex', gap: 4 }}
                                  >
                                    <Eye size={12} /> View Invoice
                                  </Link>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Responsive Cards View */}
                    <div className="portal-mobile-cards">
                      {invoices.slice((invoicePage - 1) * 10, invoicePage * 10).map((inv) => {
                        const invBalance = Number(inv.total || 0) - Number(inv.amount_paid || 0)
                        return (
                          <div
                            key={inv.id}
                            style={{
                              padding: 14,
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                                  {inv.invoice_number}
                                </span>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                                  Issued: {format(new Date(inv.issue_date), 'dd MMM yyyy')}
                                </div>
                              </div>
                              <span
                                className="badge"
                                style={{
                                  fontSize: 10,
                                  background:
                                    inv.status === 'PAID'
                                      ? 'rgba(22, 163, 74, 0.1)'
                                      : inv.status === 'OVERDUE'
                                      ? 'rgba(220, 38, 38, 0.1)'
                                      : 'rgba(217, 119, 6, 0.1)',
                                  color:
                                    inv.status === 'PAID'
                                      ? 'var(--success)'
                                      : inv.status === 'OVERDUE'
                                      ? 'var(--danger)'
                                      : 'var(--warning)',
                                }}
                              >
                                {inv.status}
                              </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                              <div>
                                <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Total</span>
                                <div style={{ fontWeight: 700 }}>{inv.currency} {Number(inv.total).toLocaleString('en', { minimumFractionDigits: 2 })}</div>
                              </div>
                              <div>
                                <span style={{ color: 'var(--success)', fontSize: 11 }}>Paid</span>
                                <div style={{ fontWeight: 600, color: 'var(--success)' }}>{inv.currency} {Number(inv.amount_paid).toLocaleString('en', { minimumFractionDigits: 2 })}</div>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Balance</span>
                                <div style={{ fontWeight: 700, color: invBalance > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
                                  {inv.currency} {invBalance.toLocaleString('en', { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                            </div>

                            <div style={{ marginTop: 4 }}>
                              <Link
                                href={`/invoices/${inv.id}`}
                                className="btn btn-primary btn-sm"
                                style={{ width: '100%', justifyContent: 'center', display: 'inline-flex', gap: 6 }}
                              >
                                <Eye size={14} /> View Detailed Invoice →
                              </Link>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <PortalPagination currentPage={invoicePage} totalItems={invoices.length} pageSize={10} onPageChange={setInvoicePage} />
                  </>
                )}
              </div>
            </div>

            {/* Quotations List Card */}
            <div className="card">
              <div className="card-header flex items-center justify-between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={16} color="var(--accent)" />
                  <span className="text-section-header">Quotations ({quotations.length})</span>
                </div>
              </div>

              <div className="card-body" style={{ padding: 0 }}>
                {quotations.length === 0 ? (
                  <p style={{ padding: 24, fontSize: 13, color: 'var(--text-secondary)' }}>
                    No quotations generated yet for your account.
                  </p>
                ) : (
                  <>
                    {/* Desktop View */}
                    <div className="table-wrapper portal-desktop-table" style={{ border: 'none' }}>
                      <table className="table table-compact">
                        <thead>
                          <tr>
                            <th>Quote #</th>
                            <th>Status</th>
                            <th>Issue Date</th>
                            <th>Valid Until</th>
                            <th className="num">Subtotal</th>
                            <th className="num">Tax (15%)</th>
                            <th className="num">Total</th>
                            <th style={{ width: 140, textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quotations.slice((quotationPage - 1) * 10, quotationPage * 10).map((q) => (
                            <tr key={q.id}>
                              <td style={{ fontWeight: 600 }}>
                                <Link href={`/quotations/${q.id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                  {q.quote_number}
                                </Link>
                              </td>
                              <td>
                                <span
                                  className="badge"
                                  style={{
                                    fontSize: 10,
                                    background:
                                      q.status === 'ACCEPTED'
                                        ? 'rgba(22, 163, 74, 0.1)'
                                        : q.status === 'SENT'
                                        ? 'rgba(2, 132, 199, 0.1)'
                                        : 'rgba(113, 113, 122, 0.1)',
                                    color:
                                      q.status === 'ACCEPTED'
                                        ? 'var(--success)'
                                        : q.status === 'SENT'
                                        ? 'var(--info)'
                                        : 'var(--text-secondary)',
                                  }}
                                >
                                  {q.status}
                                </span>
                              </td>
                              <td>{format(new Date(q.issue_date), 'dd MMM yyyy')}</td>
                              <td>{q.valid_until ? format(new Date(q.valid_until), 'dd MMM yyyy') : '—'}</td>
                              <td className="num tabular-nums">{q.currency} {Number(q.subtotal).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                              <td className="num tabular-nums">{q.currency} {Number(q.tax_amount).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                              <td className="num tabular-nums" style={{ fontWeight: 600 }}>
                                {q.currency} {Number(q.total).toLocaleString('en', { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <Link
                                  href={`/quotations/${q.id}`}
                                  className="btn btn-outline btn-xs"
                                  style={{ display: 'inline-flex', gap: 4 }}
                                >
                                  <Eye size={12} /> View Quote
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Responsive Cards View */}
                    <div className="portal-mobile-cards">
                      {quotations.slice((quotationPage - 1) * 10, quotationPage * 10).map((q) => (
                        <div
                          key={q.id}
                          style={{
                            padding: 14,
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                                {q.quote_number}
                              </span>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                                Issued: {format(new Date(q.issue_date), 'dd MMM yyyy')}
                              </div>
                            </div>
                            <span
                              className="badge"
                              style={{
                                fontSize: 10,
                                background:
                                  q.status === 'ACCEPTED'
                                    ? 'rgba(22, 163, 74, 0.1)'
                                    : q.status === 'SENT'
                                    ? 'rgba(2, 132, 199, 0.1)'
                                    : 'rgba(113, 113, 122, 0.1)',
                                color:
                                  q.status === 'ACCEPTED'
                                    ? 'var(--success)'
                                    : q.status === 'SENT'
                                    ? 'var(--info)'
                                    : 'var(--text-secondary)',
                              }}
                            >
                              {q.status}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                            <div>
                              <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Subtotal</span>
                              <div style={{ fontWeight: 500 }}>{q.currency} {Number(q.subtotal).toLocaleString('en', { minimumFractionDigits: 2 })}</div>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>VAT (15%)</span>
                              <div style={{ fontWeight: 500 }}>{q.currency} {Number(q.tax_amount).toLocaleString('en', { minimumFractionDigits: 2 })}</div>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Total</span>
                              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>
                                {q.currency} {Number(q.total).toLocaleString('en', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          </div>

                          <div style={{ marginTop: 4 }}>
                            <Link
                              href={`/quotations/${q.id}`}
                              className="btn btn-primary btn-sm"
                              style={{ width: '100%', justifyContent: 'center', display: 'inline-flex', gap: 6 }}
                            >
                              <Eye size={14} /> View Detailed Quote →
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                    <PortalPagination currentPage={quotationPage} totalItems={quotations.length} pageSize={10} onPageChange={setQuotationPage} />
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MONTHLY & CUSTOM REPORTS TAB */}
        {activeTab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Monthly Reports Section */}
            <div className="card">
              <div className="card-header flex items-center justify-between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={16} color="var(--accent)" />
                  <span className="text-section-header">Monthly Performance Reports ({monthlyReports.length})</span>
                </div>
                {reportYears.length > 1 && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {reportYears.map((yr) => (
                      <button
                        key={yr}
                        onClick={() => setSelectedReportYear(yr)}
                        className={`btn btn-xs ${selectedReportYear === yr ? 'btn-primary' : 'btn-outline'}`}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="card-body" style={{ padding: 18 }}>
                {monthlyReports.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                    No monthly reports available for download at this time.
                  </p>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: 14,
                      }}
                    >
                      {monthlyReports
                        .filter((r) => r.year === selectedReportYear || !r.year)
                        .slice((monthlyReportPage - 1) * 10, monthlyReportPage * 10)
                        .map((rep) => (
                          <div
                            key={rep.id}
                            style={{
                              padding: 16,
                              background: 'var(--bg)',
                              borderRadius: 8,
                              border: '1px solid var(--border)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: 12,
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                                <Calendar size={13} /> {rep.year || '2026'}
                              </div>
                              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: 'var(--text-primary)' }}>
                                {rep.month} Report
                              </div>
                            </div>
                            <a
                              href={rep.url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-primary btn-sm"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                width: '100%',
                                color: '#ffffff',
                                textDecoration: 'none',
                              }}
                            >
                              <ExternalLink size={13} /> View Report
                            </a>
                          </div>
                        ))}
                    </div>
                    <PortalPagination
                      currentPage={monthlyReportPage}
                      totalItems={monthlyReports.filter((r) => r.year === selectedReportYear || !r.year).length}
                      pageSize={10}
                      onPageChange={setMonthlyReportPage}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Custom Analytics & Service Links */}
            <div className="card">
              <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Globe size={16} color="var(--accent)" />
                  <span className="text-section-header">Custom Reports &amp; Live Dashboards ({customServiceLinks.length})</span>
                </div>
              </div>
              <div className="card-body" style={{ padding: 18 }}>
                {customServiceLinks.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                    No custom live dashboards recorded.
                  </p>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: 14,
                      }}
                    >
                      {customServiceLinks.slice((customReportPage - 1) * 10, customReportPage * 10).map((link) => (
                        <div
                          key={link.id}
                          style={{
                            padding: 14,
                            background: 'var(--bg)',
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: 12,
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                            {link.label}
                          </div>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-outline btn-xs"
                            style={{ display: 'inline-flex', gap: 6, alignSelf: 'flex-start' }}
                          >
                            <ExternalLink size={12} /> Open Live Report
                          </a>
                        </div>
                      ))}
                    </div>
                    <PortalPagination
                      currentPage={customReportPage}
                      totalItems={customServiceLinks.length}
                      pageSize={10}
                      onPageChange={setCustomReportPage}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PROJECT DELIVERABLES TAB */}
        {activeTab === 'tasks' && (
          <div className="card">
            <div className="card-header flex items-center justify-between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckSquare size={16} color="var(--accent)" />
                <span className="text-section-header">Project Deliverables &amp; Milestones ({tasks.length})</span>
              </div>
            </div>
            <div className="card-body" style={{ padding: 18 }}>
              {tasks.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  No technical deliverables or milestones recorded yet.
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {tasks.slice((taskPage - 1) * 10, taskPage * 10).map((task) => (
                      <div
                        key={task.id}
                        style={{
                          padding: '14px 16px',
                          background: 'var(--bg)',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          {task.category ? (
                            <span
                              className="badge"
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '3px 8px',
                                background: 'rgba(79, 70, 229, 0.1)',
                                color: 'var(--accent)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em',
                                flexShrink: 0,
                              }}
                            >
                              {task.category}
                            </span>
                          ) : <span />}

                          <span
                            className="badge"
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '4px 10px',
                              background:
                                task.status === 'COMPLETED'
                                  ? 'rgba(22, 163, 74, 0.1)'
                                  : task.status === 'IN_PROGRESS'
                                  ? 'rgba(2, 132, 199, 0.1)'
                                  : 'rgba(217, 119, 6, 0.1)',
                              color:
                                task.status === 'COMPLETED'
                                  ? 'var(--success)'
                                  : task.status === 'IN_PROGRESS'
                                  ? 'var(--info)'
                                  : 'var(--warning)',
                              flexShrink: 0,
                            }}
                          >
                            {task.status?.replace('_', ' ')}
                          </span>
                        </div>

                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: 1.45 }}>
                          {task.title}
                        </div>
                        {task.created_at && (
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                            Assigned: {format(new Date(task.created_at), 'dd MMM yyyy, hh:mm a')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <PortalPagination
                    currentPage={taskPage}
                    totalItems={tasks.length}
                    pageSize={10}
                    onPageChange={setTaskPage}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* SOCIAL & ASSETS TAB */}
        {activeTab === 'company' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Credentials & Logins Vault */}
            <div className="card">
              <div className="card-header flex items-center justify-between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Lock size={16} color="var(--accent)" />
                  <span className="text-section-header">Credentials &amp; Logins Vault ({clientCredentials.length})</span>
                </div>
              </div>
              <div className="card-body" style={{ padding: 18 }}>
                {clientCredentials.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                    No credential logins stored for your account.
                  </p>
                ) : (
                  <>
                    {/* Desktop View */}
                    <div className="table-wrapper portal-desktop-table" style={{ border: 'none', width: '100%', overflowX: 'hidden' }}>
                      <table className="table table-compact" style={{ width: '100%', tableLayout: 'fixed' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '25%' }}>Service / Platform</th>
                            <th style={{ width: '30%' }}>Username / Email</th>
                            <th style={{ width: '30%' }}>Password</th>
                            <th style={{ width: '15%' }}>Login URL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientCredentials
                            .slice((credPage - 1) * 5, credPage * 5)
                            .map((cred: any, idx: number) => {
                              const credId = cred.id || `cred-${idx}`
                              const isShowPass = visiblePasswords[credId]
                              return (
                                <tr key={credId}>
                                  <td style={{ fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                    {cred.service}
                                    {cred.notes && (
                                      <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', marginTop: 2, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                        {cred.notes}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: 13, fontFamily: 'monospace', wordBreak: 'break-all', overflowWrap: 'anywhere' }}>{cred.username || '—'}</span>
                                      {cred.username && (
                                        <button
                                          type="button"
                                          onClick={() => handleCopy(cred.username, `user-${credId}`)}
                                          className="btn btn-ghost btn-xs"
                                          title="Copy Username"
                                          style={{ padding: 2, height: 'auto', flexShrink: 0 }}
                                        >
                                          {copiedField === `user-${credId}` ? <Check size={12} color="var(--success)" /> : <Copy size={12} color="var(--text-tertiary)" />}
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: 13, fontFamily: 'monospace', wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                                        {isShowPass ? cred.password : '••••••••••••'}
                                      </span>
                                      {cred.password && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => togglePasswordVisibility(credId)}
                                            className="btn btn-ghost btn-xs"
                                            title={isShowPass ? 'Hide Password' : 'Show Password'}
                                            style={{ padding: 2, height: 'auto', flexShrink: 0 }}
                                          >
                                            {isShowPass ? <EyeOff size={13} /> : <Eye size={13} />}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleCopy(cred.password, `pass-${credId}`)}
                                            className="btn btn-ghost btn-xs"
                                            title="Copy Password"
                                            style={{ padding: 2, height: 'auto', flexShrink: 0 }}
                                          >
                                            {copiedField === `pass-${credId}` ? <Check size={12} color="var(--success)" /> : <Copy size={12} color="var(--text-tertiary)" />}
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                    {cred.login_url ? (
                                      <a
                                        href={ensureExternalUrl(cred.login_url)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-ghost btn-xs"
                                        style={{ color: 'var(--accent)', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                                      >
                                        <ExternalLink size={12} /> Open Portal
                                      </a>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile View - Cards with wrap protection */}
                    <div className="portal-mobile-cards">
                      {clientCredentials
                        .slice((credPage - 1) * 5, credPage * 5)
                        .map((cred: any, idx: number) => {
                          const credId = cred.id || `cred-m-${idx}`
                          const isShowPass = visiblePasswords[credId]
                          return (
                            <div
                              key={credId}
                              style={{
                                padding: 14,
                                background: 'var(--bg)',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 12,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', wordBreak: 'break-word', overflowWrap: 'anywhere', minWidth: 0, flex: 1 }}>
                                  {cred.service}
                                </div>
                                {cred.login_url && (
                                  <a
                                    href={ensureExternalUrl(cred.login_url)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-outline btn-xs"
                                    style={{ display: 'inline-flex', gap: 4, fontSize: 11, flexShrink: 0 }}
                                  >
                                    <ExternalLink size={12} /> Open Link
                                  </a>
                                )}
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                                {/* Username row */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>Username:</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-primary)', wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                                      {cred.username || '—'}
                                    </span>
                                    {cred.username && (
                                      <button
                                        type="button"
                                        onClick={() => handleCopy(cred.username, `user-${credId}`)}
                                        className="btn btn-ghost btn-xs"
                                        style={{ padding: '2px 6px', fontSize: 11 }}
                                      >
                                        {copiedField === `user-${credId}` ? <Check size={12} color="var(--success)" /> : <Copy size={12} color="var(--text-tertiary)" />}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Password row */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>Password:</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-primary)', wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                                      {isShowPass ? cred.password : '••••••••••••'}
                                    </span>
                                    {cred.password && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => togglePasswordVisibility(credId)}
                                          className="btn btn-ghost btn-xs"
                                          style={{ padding: '2px 6px' }}
                                        >
                                          {isShowPass ? <EyeOff size={13} /> : <Eye size={13} />}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleCopy(cred.password, `pass-${credId}`)}
                                          className="btn btn-ghost btn-xs"
                                          style={{ padding: '2px 6px' }}
                                        >
                                          {copiedField === `pass-${credId}` ? <Check size={12} color="var(--success)" /> : <Copy size={12} color="var(--text-tertiary)" />}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Notes if any */}
                                {cred.notes && (
                                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, wordBreak: 'break-word', overflowWrap: 'anywhere', background: 'var(--surface)', padding: 8, borderRadius: 6 }}>
                                    <strong>Notes:</strong> {cred.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                    </div>

                    <PortalPagination
                      currentPage={credPage}
                      totalItems={clientCredentials.length}
                      pageSize={5}
                      onPageChange={setCredPage}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Social Media & Assets Grid */}
            <div className="card">
              <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Share2 size={16} color="var(--accent)" />
                  <span className="text-section-header">Social Media &amp; Brand Assets</span>
                </div>
              </div>
              <div className="card-body" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Social media links */}
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 12 }}>
                    Official Social Profiles
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                    {client.facebook_url && (
                      <a
                        href={ensureExternalUrl(client.facebook_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="card"
                        style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--text-primary)' }}
                      >
                        <Facebook size={20} color="#1877F2" />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>Facebook Page</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Open link ↗</div>
                        </div>
                      </a>
                    )}
                    {client.instagram_url && (
                      <a
                        href={ensureExternalUrl(client.instagram_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="card"
                        style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--text-primary)' }}
                      >
                        <Instagram size={20} color="#E4405F" />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>Instagram Profile</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Open link ↗</div>
                        </div>
                      </a>
                    )}
                    {client.tiktok_url && (
                      <a
                        href={ensureExternalUrl(client.tiktok_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="card"
                        style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--text-primary)' }}
                      >
                        <Video size={20} color="#000" />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>TikTok Account</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Open link ↗</div>
                        </div>
                      </a>
                    )}
                    {client.gmb_url && (
                      <a
                        href={ensureExternalUrl(client.gmb_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="card"
                        style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--text-primary)' }}
                      >
                        <MapPin size={20} color="#EA4335" />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>Google My Business</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Open listing ↗</div>
                        </div>
                      </a>
                    )}
                  </div>
                </div>

                {/* Brand Assets Link */}
                {client.brand_assets_link && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                      Central Brand Assets Folder
                    </span>
                    <a
                      href={ensureExternalUrl(client.brand_assets_link)}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline btn-sm"
                      style={{ display: 'inline-flex', gap: 6 }}
                    >
                      <FolderDown size={14} /> Open Brand Assets Drive / Cloud Folder
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Websites & Contact Details */}
            <div className="card">
              <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building2 size={16} color="var(--accent)" />
                  <span className="text-section-header">Websites &amp; Account Details</span>
                </div>
              </div>
              <div className="card-body" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                    Websites &amp; Domains
                  </span>
                  {websites.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No website links recorded.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: '100%' }}>
                      {websites.map((w) => (
                        <a
                          key={w.id}
                          href={ensureExternalUrl(w.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-outline btn-xs"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            maxWidth: '100%',
                            whiteSpace: 'normal',
                            wordBreak: 'break-all',
                            overflowWrap: 'anywhere',
                            textAlign: 'left',
                            height: 'auto',
                            padding: '8px 12px',
                            lineHeight: 1.4,
                          }}
                        >
                          <Globe size={14} style={{ flexShrink: 0 }} />
                          <span style={{ minWidth: 0, flex: 1, wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                            <strong>{w.name}:</strong> {w.url}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                    Company Contact Details
                  </span>
                  <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--text-primary)' }}>
                    <div><strong>Email:</strong> {client.email || '—'}</div>
                    <div><strong>Phone:</strong> {client.phone || '—'}</div>
                    <div><strong>Address:</strong> {client.address || '—'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUPPORT / MESSAGE TAB */}
        {activeTab === 'support' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 840, margin: '0 auto', width: '100%' }}>
            {/* Direct Support Form */}
            <div className="card">
              <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Send size={16} color="var(--accent)" />
                  <span className="text-section-header">Message Account Manager</span>
                </div>
              </div>
              <div className="card-body" style={{ padding: 20 }}>
                {msgSentSuccess ? (
                  <div style={{ padding: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--success-light)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>
                      ✓
                    </div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Message Sent Successfully!
                    </h3>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', maxWidth: 420, lineHeight: 1.5 }}>
                      Your message has been delivered directly to your account manager via email. They will get back to you shortly.
                    </p>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setMsgSentSuccess(false)
                        setMsgSubject('')
                        setMsgBody('')
                      }}
                      style={{ marginTop: 8 }}
                    >
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSendSupportRequest} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label form-label-required">Category</label>
                      <select
                        className="form-select"
                        value={msgCategory}
                        onChange={(e) => setMsgCategory(e.target.value)}
                      >
                        <option value="WEBSITE">Website Update</option>
                        <option value="SOCIAL_MEDIA">Social Media Post Request</option>
                        <option value="ADS">Meta Ads Support</option>
                        <option value="GMB">Google My Business</option>
                        <option value="DESIGN">Design Asset</option>
                        <option value="OTHER">General Request / Billing Query</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label form-label-required">Subject</label>
                      <input
                        className="form-input"
                        value={msgSubject}
                        onChange={(e) => setMsgSubject(e.target.value)}
                        placeholder="e.g. Request for new campaign report"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label form-label-required">Message / Details</label>
                      <textarea
                        className="form-input"
                        rows={5}
                        value={msgBody}
                        onChange={(e) => setMsgBody(e.target.value)}
                        placeholder="Write your request or message here..."
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={sendingMsg}
                      style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                    >
                      {sendingMsg ? 'Sending Request...' : 'Send Message'}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Management & Account Contacts Card */}
            <div className="card">
              <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <User size={16} color="var(--accent)" />
                  <span className="text-section-header">Executive Contacts &amp; Account Management</span>
                </div>
              </div>
              <div className="card-body" style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                {/* Owner / Management Contact */}
                <div style={{ padding: 16, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>👑</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Nabeel Syed</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>Founder &amp; Owner</div>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                    <a href="mailto:nabeelsy@adonixdigital.com" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', textDecoration: 'none', wordBreak: 'break-all' }}>
                      <Mail size={14} color="var(--accent)" style={{ flexShrink: 0 }} /> nabeelsy@adonixdigital.com
                    </a>
                    <a href="https://wa.me/966538498580" target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', textDecoration: 'none' }}>
                      <Phone size={14} color="var(--success)" style={{ flexShrink: 0 }} /> +966 53 849 8580
                    </a>
                  </div>
                </div>

                {/* Assigned Account Manager Card */}
                <div style={{ padding: 16, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>🎧</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                        {assignedAgent ? assignedAgent.name : 'Account Manager'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>Assigned Account Manager</div>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                    <a href={`mailto:${assignedAgent?.email || 'nabeelsy@adonixdigital.com'}`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', textDecoration: 'none', wordBreak: 'break-all' }}>
                      <Mail size={14} color="var(--accent)" style={{ flexShrink: 0 }} /> {assignedAgent?.email || 'nabeelsy@adonixdigital.com'}
                    </a>
                    {assignedAgent?.phone && (
                      <a href={`tel:${assignedAgent.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', textDecoration: 'none' }}>
                        <Phone size={14} color="var(--info)" style={{ flexShrink: 0 }} /> {assignedAgent.phone}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Regional Global Offices Card (KSA & India) */}
            <div className="card">
              <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building2 size={16} color="var(--accent)" />
                  <span className="text-section-header">Regional Global Offices (KSA &amp; India)</span>
                </div>
              </div>
              <div className="card-body" style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                {/* KSA Office Card */}
                <div style={{ padding: 16, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>🇸🇦</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Saudi Arabia HQ</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>Jeddah / KSA Operations</div>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <MapPin size={15} color="#EA4335" style={{ flexShrink: 0, marginTop: 2 }} />
                      <span style={{ lineHeight: 1.4 }}>
                        Office #602, Matbouli Plaza, Fayd Al Samaa St, Jeddah, KSA
                      </span>
                    </div>
                    <a
                      href="https://maps.app.goo.gl/vbcPiZJTmJ1hvqbv9"
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}
                    >
                      <ExternalLink size={12} /> Open in Google Maps ↗
                    </a>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Phone size={14} color="var(--success)" style={{ flexShrink: 0 }} />
                      <a href="tel:+966538498580" style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>+966 53 849 8580</a>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Mail size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
                      <a href="mailto:nabeelsy@adonixdigital.com" style={{ color: 'var(--text-primary)', textDecoration: 'none', wordBreak: 'break-all' }}>nabeelsy@adonixdigital.com</a>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Clock size={14} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                      <span>Sun – Thu: 9:00 AM – 6:00 PM AST</span>
                    </div>
                  </div>
                </div>

                {/* India Office Card */}
                <div style={{ padding: 16, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>🇮🇳</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>India Tech Hub</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>Hyderabad / India Operations</div>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <MapPin size={15} color="#EA4335" style={{ flexShrink: 0, marginTop: 2 }} />
                      <span style={{ lineHeight: 1.4 }}>
                        Rock Roof, Road No. 12, Kaushik Society, Banjara Hills, Hyderabad
                      </span>
                    </div>
                    <a
                      href="https://maps.app.goo.gl/6kUTEBvu4X5RKNGp9"
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}
                    >
                      <ExternalLink size={12} /> Open in Google Maps ↗
                    </a>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Phone size={14} color="var(--success)" style={{ flexShrink: 0 }} />
                      <a href="tel:+917288863343" style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>+91 72888 63343</a>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Mail size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
                      <a href="mailto:nabeelsy@adonixdigital.com" style={{ color: 'var(--text-primary)', textDecoration: 'none', wordBreak: 'break-all' }}>nabeelsy@adonixdigital.com</a>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Clock size={14} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                      <span>Mon – Sat: 9:00 AM – 7:00 PM IST</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Visible on mobile screens) */}
      <div className="client-mobile-bottom-nav">
        <button
          onClick={() => router.push('/portal?section=overview')}
          className={`bottom-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
        >
          <LayoutDashboard size={18} />
          <span>Overview</span>
        </button>
        <button
          onClick={() => router.push('/portal?section=finance')}
          className={`bottom-nav-item ${activeTab === 'finance' ? 'active' : ''}`}
        >
          <Receipt size={18} />
          <span>Invoices</span>
        </button>
        <button
          onClick={() => router.push('/portal?section=reports')}
          className={`bottom-nav-item ${activeTab === 'reports' ? 'active' : ''}`}
        >
          <FileText size={18} />
          <span>Reports</span>
        </button>
        <button
          onClick={() => router.push('/portal?section=tasks')}
          className={`bottom-nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
        >
          <CheckSquare size={18} />
          <span>Tasks</span>
        </button>
        <button
          onClick={() => router.push('/portal?section=company')}
          className={`bottom-nav-item ${activeTab === 'company' ? 'active' : ''}`}
        >
          <Share2 size={18} />
          <span>Assets</span>
        </button>
        <button
          onClick={() => router.push('/portal?section=support')}
          className={`bottom-nav-item ${activeTab === 'support' ? 'active' : ''}`}
        >
          <Send size={18} />
          <span>Contact</span>
        </button>
      </div>
    </div>
  )
}
