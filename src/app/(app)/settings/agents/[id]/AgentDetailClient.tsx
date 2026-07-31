'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow, format, subDays, isAfter } from 'date-fns'
import {
  ArrowLeft, Users, TrendingUp, CheckCircle, Clock, Target,
  Phone, Mail, Activity, Search, ChevronRight, Award,
  XCircle, AlertCircle, BarChart2, Calendar, MessageSquare,
  FileText, Receipt, DollarSign, CreditCard, Sparkles,
} from 'lucide-react'
import type { Profile, LeadStage } from '@/types/database'
import Link from 'next/link'

interface Props {
  agent: Profile & { last_sign_in_at?: string | null }
  leads: any[]
  stages: LeadStage[]
  stageCounts: Record<string, number>
  followups: any[]
  activities: any[]
  quotations: any[]
  invoices: any[]
  totalLeads: number
  wonCount: number
  lostCount: number
  conversionRate: number
  completedFollowups: number
  pendingFollowups: number
}

const SOURCE_LABELS: Record<string, string> = {
  META_ADS: 'Meta Ads',
  MANUAL: 'Manual',
  XLSX_IMPORT: 'XLSX Import',
  TIKTOK: 'TikTok',
  SNAPCHAT: 'Snapchat',
  WHATSAPP: 'WhatsApp',
}

function convertToSAR(amount: number, currency?: string): number {
  const rates: Record<string, number> = {
    SAR: 1.0,
    USD: 3.75,
    AED: 1.02,
    INR: 0.045,
  }
  return amount * (rates[currency ?? 'SAR'] ?? 1.0)
}

function activityLabel(type: string, meta: any): string {
  switch (type) {
    case 'LEAD_CREATED': return 'Created lead'
    case 'STAGE_CHANGE': return `Stage: ${meta?.from_stage ?? '?'} → ${meta?.to_stage ?? '?'}`
    case 'NOTE_ADDED': return 'Added a note'
    case 'FOLLOWUP_SCHEDULED': return 'Scheduled follow-up'
    case 'FOLLOWUP_COMPLETED': return 'Completed follow-up'
    case 'FOLLOWUP_UPDATED': return 'Updated follow-up'
    case 'ASSIGNED': return `Assigned lead`
    case 'QUOTE_SENT': return `Sent quotation ${meta?.quote_number ?? ''}`
    case 'INVOICE_SENT': return `Sent invoice ${meta?.invoice_number ?? ''}`
    default: return type.replace(/_/g, ' ')
  }
}

export default function AgentDetailClient({
  agent,
  leads,
  stages,
  stageCounts,
  followups,
  activities,
  quotations,
  invoices,
  totalLeads,
  wonCount,
  lostCount,
  conversionRate,
  completedFollowups,
  pendingFollowups,
}: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'leads' | 'followups' | 'quotations' | 'invoices' | 'activity'>('leads')
  const [leadSearch, setLeadSearch] = useState('')

  // Pagination states
  const [leadsPage, setLeadsPage] = useState(1)
  const [followupsPage, setFollowupsPage] = useState(1)
  const [quotesPage, setQuotesPage] = useState(1)
  const [invoicesPage, setInvoicesPage] = useState(1)
  const [activityPage, setActivityPage] = useState(1)
  const PAGE_SIZE = 10

  // Reset page numbers when tab changes
  useEffect(() => {
    setLeadsPage(1)
    setFollowupsPage(1)
    setQuotesPage(1)
    setInvoicesPage(1)
    setActivityPage(1)
  }, [activeTab])

  // Reset leads page when search updates
  useEffect(() => {
    setLeadsPage(1)
  }, [leadSearch])



  // Calculate agent financial metrics WITH CURRENCY CONVERSION TO SAR
  const totalQuotedSAR = quotations.reduce(
    (acc, q) => acc + convertToSAR(Number(q.total ?? 0), q.currency),
    0
  )
  const totalInvoicedSAR = invoices.reduce(
    (acc, inv) => acc + convertToSAR(Number(inv.total ?? 0), inv.currency),
    0
  )
  const totalCollectedSAR = invoices.reduce(
    (acc, inv) => acc + convertToSAR(Number(inv.amount_paid ?? 0), inv.currency),
    0
  )

  // Recent leads (last 30 days)
  const thirtyDaysAgo = subDays(new Date(), 30)
  const recentLeads = leads.filter((l) => isAfter(new Date(l.created_at), thirtyDaysAgo)).length

  // Follow-up completion rate
  const totalFu = completedFollowups + pendingFollowups
  const fuRate = totalFu > 0 ? (completedFollowups / totalFu) * 100 : 0

  // Filtered leads by search
  const filteredLeads = useMemo(() => {
    if (!leadSearch.trim()) return leads
    const q = leadSearch.toLowerCase()
    return leads.filter(
      (l) => (l.name ?? '').toLowerCase().includes(q) || (l.phone ?? '').toLowerCase().includes(q)
    )
  }, [leads, leadSearch])

  const [resendingReset, setResendingReset] = useState(false)
  const [resetMsg, setResetMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  async function handleSendReset() {
    setResendingReset(true)
    setResetMsg(null)
    try {
      const res = await fetch('/api/agents/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: agent.email, name: agent.name }),
      })
      const data = await res.json()
      if (res.ok) {
        setResetMsg({ text: `Password reset email link sent to ${agent.email}`, type: 'success' })
      } else {
        setResetMsg({ text: data.error ?? 'Failed to send reset email link', type: 'error' })
      }
    } catch {
      setResetMsg({ text: 'Error sending reset password link', type: 'error' })
    }
    setResendingReset(false)
  }

  const initials = agent.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const isActive = agent.is_active

  // Clean performance tag
  const getPerformanceBadge = () => {
    if (totalLeads === 0) return { label: 'New / No Leads', bg: '#f4f4f5', color: '#71717a', border: '#e4e4e7' }
    if (conversionRate >= 25 || wonCount >= 5) return { label: 'Top Performer', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' }
    if (conversionRate >= 10 || wonCount >= 1) return { label: 'Active Agent', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' }
    return { label: 'Needs Conversion', bg: '#fffbe6', color: '#d48806', border: '#ffe58f' }
  }

  const perfTag = getPerformanceBadge()

  return (
    <div>
      {/* Page header */}
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => router.push('/settings/agents')}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-page-title">{agent.name}</h1>
            <p className="text-meta" style={{ marginTop: 2 }}>
              Agent Performance Overview &amp; Analytics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleSendReset}
            disabled={resendingReset}
          >
            <Mail size={14} />
            {resendingReset ? 'Sending link...' : 'Send reset password link'}
          </button>
          <Link href="/leads?action=add" className="btn btn-primary btn-sm">
            <Users size={14} />
            Assign new lead
          </Link>
        </div>
      </div>

      {resetMsg && (
        <div
          style={{
            margin: '12px 0 16px',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            fontWeight: 500,
            background: resetMsg.type === 'success' ? 'var(--success-light)' : '#fef2f2',
            border: `1px solid ${resetMsg.type === 'success' ? 'var(--success)' : '#fecaca'}`,
            color: resetMsg.type === 'success' ? 'var(--success)' : '#dc2626',
          }}
        >
          {resetMsg.text}
        </div>
      )}

      <div className="page-body">

        {/* Profile Header Banner */}
        <div className="card mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="card-body" style={{ padding: '20px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
              alignItems: 'center',
            }}>
              {/* Left Info Column */}
              <div className="flex items-start gap-4">
                <div style={{
                  width: 54, height: 54, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                }}>
                  {initials}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {agent.name}
                    </span>
                    <span className="badge" style={{
                      background: agent.role === 'ADMIN' ? '#eff6ff' : '#f4f4f5',
                      color: agent.role === 'ADMIN' ? '#2563eb' : '#52525b',
                      fontSize: 11, fontWeight: 600, border: '1px solid var(--border)',
                    }}>
                      {agent.role}
                    </span>
                    {isActive ? (
                      <span className="badge badge-success" style={{ fontSize: 11 }}>
                        <span className="badge-dot" style={{ background: 'var(--success)' }} />
                        Active
                      </span>
                    ) : (
                      <span className="badge badge-danger" style={{ fontSize: 11 }}>
                        <span className="badge-dot" style={{ background: 'var(--danger)' }} />
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap text-meta" style={{ fontSize: 12 }}>
                    <span className="flex items-center gap-1" style={{ wordBreak: 'break-all' }}>
                      <Mail size={12} style={{ flexShrink: 0 }} /> {agent.email}
                    </span>
                    <span>Joined {formatDistanceToNow(new Date(agent.created_at), { addSuffix: true })}</span>
                    {agent.last_seen_at && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} style={{ flexShrink: 0 }} />
                        Active {formatDistanceToNow(new Date(agent.last_seen_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Performance Banner Widget */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '12px 18px',
                background: 'var(--bg)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
              }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Status &amp; Rating
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={14} style={{ color: perfTag.color }} />
                    {perfTag.label}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Conversion
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: conversionRate >= 20 ? 'var(--success)' : 'var(--text-primary)', marginTop: 2 }}>
                    {conversionRate.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Responsive KPI Metric Row (SAR Normalized) */}
        <div className="rg-4 mb-6">
          <div className="stat-card">
            <div className="stat-card-label">Total leads</div>
            <div className="stat-card-value">{totalLeads}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {recentLeads} added in last 30 days
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-label">Won deals</div>
            <div className="stat-card-value" style={{ color: 'var(--success)' }}>{wonCount}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {lostCount} lost deals
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-label">Quotations (SAR Base)</div>
            <div className="stat-card-value" style={{ color: '#2563eb', fontSize: 18 }}>
              SAR {totalQuotedSAR.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {quotations.length} quotes created (currency converted)
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-label">Invoiced (SAR Base)</div>
            <div className="stat-card-value" style={{ color: 'var(--success)', fontSize: 18 }}>
              SAR {totalInvoicedSAR.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              SAR {totalCollectedSAR.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} collected
            </div>
          </div>
        </div>

        {/* Stage distribution funnel */}
        <div className="card mb-6">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <BarChart2 size={15} style={{ color: 'var(--text-secondary)' }} />
              <span className="text-section-header">Lead funnel distribution</span>
            </div>
            <span className="text-meta">{totalLeads} assigned leads</span>
          </div>
          <div className="card-body">
            {stages.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: 24 }}>No stage data</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {stages.map((stage) => {
                  const count = stageCounts[stage.id] ?? 0
                  const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0
                  return (
                    <div key={stage.id} className="flex items-center gap-3">
                      <span style={{ width: 110, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flexShrink: 0 }}>
                        {stage.label}
                      </span>
                      <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 100, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: stage.color_hex, borderRadius: 100, transition: 'width 600ms ease' }} />
                      </div>
                      <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, width: 28, textAlign: 'right', color: count > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', flexShrink: 0 }}>
                        {count}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 38, textAlign: 'right', flexShrink: 0 }}>
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Tabbed Detailed Data Section */}
        <div className="card">
          <div className="tabs" style={{ padding: '0 8px', overflowX: 'auto', flexWrap: 'nowrap' }}>
            {([
              { key: 'leads', label: 'Leads', count: totalLeads },
              { key: 'followups', label: 'Follow-ups', count: totalFu },
              { key: 'quotations', label: 'Quotations', count: quotations.length },
              { key: 'invoices', label: 'Invoices', count: invoices.length },
              { key: 'activity', label: 'Activity', count: activities.length },
            ] as const).map(({ key, label, count }) => (
              <button
                key={key}
                className={`tab ${activeTab === key ? 'active' : ''}`}
                onClick={() => setActiveTab(key)}
                style={{ whiteSpace: 'nowrap' }}
              >
                {label}
                <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          <div style={{ padding: '16px' }}>

            {/* LEADS TAB */}
            {activeTab === 'leads' && (
              <div>
                <div style={{ position: 'relative', marginBottom: 14 }}>
                  <Search size={14} style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-tertiary)', pointerEvents: 'none',
                  }} />
                  <input
                    className="form-input"
                    placeholder="Search leads by name or phone..."
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    style={{ paddingLeft: 32, fontSize: 13 }}
                  />
                </div>

                {filteredLeads.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '32px 0' }}>
                    {leadSearch ? 'No leads match your search' : 'No leads assigned yet'}
                  </p>
                ) : (
                  <>
                    <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, margin: -4 }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Lead name</th>
                            <th>Phone</th>
                            <th>Stage</th>
                            <th>Source</th>
                            <th>Added</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLeads.slice((leadsPage - 1) * PAGE_SIZE, leadsPage * PAGE_SIZE).map((lead) => (
                            <tr
                              key={lead.id}
                              className="clickable"
                              onClick={() => (window.location.href = `/leads/${lead.id}`)}
                            >
                              <td style={{ fontWeight: 500 }}>{lead.name ?? '—'}</td>
                              <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{lead.phone ?? '—'}</td>
                              <td>
                                {lead.stage && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: lead.stage.color_hex, flexShrink: 0 }} />
                                    {lead.stage.label}
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className="badge badge-default" style={{ fontSize: 11 }}>
                                  {SOURCE_LABELS[lead.source] ?? lead.source}
                                </span>
                              </td>
                              <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                              </td>
                              <td>
                                <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      currentPage={leadsPage}
                      totalItems={filteredLeads.length}
                      pageSize={PAGE_SIZE}
                      onPageChange={setLeadsPage}
                    />
                  </>
                )}
              </div>
            )}

            {/* FOLLOW-UPS TAB */}
            {activeTab === 'followups' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {followups.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '32px 0' }}>
                    No follow-ups recorded
                  </p>
                ) : (
                  <>
                    {followups.slice((followupsPage - 1) * PAGE_SIZE, followupsPage * PAGE_SIZE).map((fu) => {
                      const overdue = !fu.is_completed && new Date(fu.scheduled_at) < new Date()
                      return (
                        <div
                          key={fu.id}
                          style={{
                            padding: '12px 14px',
                            border: `1px solid ${fu.is_completed ? 'var(--success)' : overdue ? 'var(--danger)' : 'var(--border)'}`,
                            borderRadius: 'var(--radius-sm)',
                            background: fu.is_completed ? 'var(--success-light)' : overdue ? 'var(--danger-light)' : 'var(--bg)',
                            cursor: fu.lead?.id ? 'pointer' : 'default',
                          }}
                          onClick={() => fu.lead?.id && (window.location.href = `/leads/${fu.lead.id}`)}
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: 4 }}>
                            <div className="flex items-center gap-2">
                              <span style={{ fontSize: 13, fontWeight: 600, color: fu.is_completed ? 'var(--success)' : overdue ? 'var(--danger)' : 'var(--text-primary)' }}>
                                {fu.lead?.name ?? 'Unknown lead'}
                              </span>
                              {fu.is_completed ? (
                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', fontWeight: 600 }}>
                                  Completed
                                </span>
                              ) : overdue ? (
                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <AlertCircle size={9} /> Pending
                                </span>
                              ) : null}
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              {format(new Date(fu.scheduled_at), 'dd MMM yyyy, HH:mm')}
                            </span>
                          </div>
                          {fu.note && <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Plan: {fu.note}</p>}
                          {fu.outcome_note && (
                            <div style={{ marginTop: 6, padding: '6px 8px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#16a34a' }}>Outcome: </span>
                              <span style={{ fontSize: 12, color: '#166534' }}>{fu.outcome_note}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <TablePagination
                      currentPage={followupsPage}
                      totalItems={followups.length}
                      pageSize={PAGE_SIZE}
                      onPageChange={setFollowupsPage}
                    />
                  </>
                )}
              </div>
            )}

            {/* QUOTATIONS TAB */}
            {activeTab === 'quotations' && (
              <div>
                {quotations.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '32px 0' }}>
                    No quotations created by this agent yet
                  </p>
                ) : (
                  <>
                    <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, margin: -4 }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Quote #</th>
                            <th>Client / Lead</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th className="num">Original Total</th>
                            <th className="num">Normalized (SAR)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quotations.slice((quotesPage - 1) * PAGE_SIZE, quotesPage * PAGE_SIZE).map((q) => {
                            const origCurr = q.currency ?? 'SAR'
                            const origTotal = Number(q.total ?? 0)
                            const sarTotal = convertToSAR(origTotal, origCurr)

                            return (
                              <tr
                                key={q.id}
                                className="clickable"
                                onClick={() => router.push(`/quotations/${q.id}`)}
                              >
                                <td style={{ fontWeight: 600 }}>
                                  <Link
                                    href={`/quotations/${q.id}`}
                                    style={{ color: 'var(--accent)', textDecoration: 'none' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {q.quote_number}
                                  </Link>
                                </td>
                                <td>
                                  {q.client_id ? (
                                    <Link
                                      href={`/clients/${q.client_id}`}
                                      style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {q.client?.name ?? '—'}
                                    </Link>
                                  ) : q.lead_id ? (
                                    <Link
                                      href={`/leads/${q.lead_id}`}
                                      style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {q.lead?.name ?? '—'}
                                    </Link>
                                  ) : (
                                    q.client?.name ?? q.lead?.name ?? '—'
                                  )}
                                </td>
                                <td>
                                  <span className={`badge badge-${q.status === 'ACCEPTED' ? 'success' : q.status === 'SENT' ? 'info' : 'default'}`} style={{ fontSize: 11 }}>
                                    {q.status}
                                  </span>
                                </td>
                                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                  {q.issue_date ? format(new Date(q.issue_date), 'dd MMM yyyy') : '—'}
                                </td>
                                <td className="num tabular-nums" style={{ fontWeight: 500 }}>
                                  {origCurr} {origTotal.toLocaleString('en', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="num tabular-nums" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                                  SAR {sarTotal.toLocaleString('en', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      currentPage={quotesPage}
                      totalItems={quotations.length}
                      pageSize={PAGE_SIZE}
                      onPageChange={setQuotesPage}
                    />
                  </>
                )}
              </div>
            )}

            {/* INVOICES TAB */}
            {activeTab === 'invoices' && (
              <div>
                {invoices.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '32px 0' }}>
                    No invoices created by this agent yet
                  </p>
                ) : (
                  <>
                    <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, margin: -4 }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Invoice #</th>
                            <th>Client / Lead</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th className="num">Total (Original)</th>
                            <th className="num">Normalized Total (SAR)</th>
                            <th className="num">Collected (SAR)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.slice((invoicesPage - 1) * PAGE_SIZE, invoicesPage * PAGE_SIZE).map((inv) => {
                            const origCurr = inv.currency ?? 'SAR'
                            const origTotal = Number(inv.total ?? 0)
                            const origPaid = Number(inv.amount_paid ?? 0)
                            const sarTotal = convertToSAR(origTotal, origCurr)
                            const sarPaid = convertToSAR(origPaid, origCurr)

                            return (
                              <tr
                                key={inv.id}
                                className="clickable"
                                onClick={() => router.push(`/invoices/${inv.id}`)}
                              >
                                <td style={{ fontWeight: 600 }}>
                                  <Link
                                    href={`/invoices/${inv.id}`}
                                    style={{ color: 'var(--accent)', textDecoration: 'none' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {inv.invoice_number}
                                  </Link>
                                </td>
                                <td>
                                  {inv.client_id ? (
                                    <Link
                                      href={`/clients/${inv.client_id}`}
                                      style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {inv.client?.name ?? '—'}
                                    </Link>
                                  ) : inv.lead_id ? (
                                    <Link
                                      href={`/leads/${inv.lead_id}`}
                                      style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {inv.lead?.name ?? '—'}
                                    </Link>
                                  ) : (
                                    inv.client?.name ?? inv.lead?.name ?? '—'
                                  )}
                                </td>
                                <td>
                                  <span className={`badge badge-${inv.status === 'PAID' ? 'success' : inv.status === 'PARTIALLY_PAID' ? 'warning' : 'default'}`} style={{ fontSize: 11 }}>
                                    {inv.status}
                                  </span>
                                </td>
                                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                  {inv.issue_date ? format(new Date(inv.issue_date), 'dd MMM yyyy') : '—'}
                                </td>
                                <td className="num tabular-nums" style={{ fontWeight: 500 }}>
                                  {origCurr} {origTotal.toLocaleString('en', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="num tabular-nums" style={{ fontWeight: 600 }}>
                                  SAR {sarTotal.toLocaleString('en', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="num tabular-nums" style={{ color: 'var(--success)', fontWeight: 600 }}>
                                  SAR {sarPaid.toLocaleString('en', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      currentPage={invoicesPage}
                      totalItems={invoices.length}
                      pageSize={PAGE_SIZE}
                      onPageChange={setInvoicesPage}
                    />
                  </>
                )}
              </div>
            )}

            {/* ACTIVITY TAB */}
            {activeTab === 'activity' && (
              <div className="timeline" style={{ padding: '8px 0' }}>
                {activities.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '32px 0' }}>
                    No activity recorded
                  </p>
                ) : (
                  <>
                    {activities.slice((activityPage - 1) * PAGE_SIZE, activityPage * PAGE_SIZE).map((act) => (
                      <div key={act.id} className="timeline-item">
                        <div className="timeline-icon">
                          <Activity size={12} />
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-text">
                            {activityLabel(act.activity_type, act.metadata)}
                            {act.lead?.name && (
                              <span
                                style={{ marginLeft: 4, color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                                onClick={() => window.location.href = `/leads/${act.lead.id}`}
                              >
                                — {act.lead.name}
                              </span>
                            )}
                          </div>
                          <div className="timeline-time">
                            {formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    ))}
                    <TablePagination
                      currentPage={activityPage}
                      totalItems={activities.length}
                      pageSize={PAGE_SIZE}
                      onPageChange={setActivityPage}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

function TablePagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
}: {
  currentPage: number
  totalItems: number
  pageSize: number
  onPageChange: (p: number) => void
}) {
  const totalPages = Math.ceil(totalItems / pageSize)
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between" style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        Showing {Math.min((currentPage - 1) * pageSize + 1, totalItems)} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-outline btn-xs"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Previous
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-outline btn-xs"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
