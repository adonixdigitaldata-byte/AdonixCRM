'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow, format } from 'date-fns'
import {
  BarChart2,
  Users,
  TrendingUp,
  Clock,
  Calendar,
  ArrowRight,
  Megaphone,
  Plus,
  DollarSign,
  FileText,
  CreditCard,
  AlertCircle,
  Trophy,
  ChevronRight,
} from 'lucide-react'
import type { LeadStage, Profile } from '@/types/database'

interface AgentPerf {
  id: string
  name: string
  totalLeads: number
  wonLeads: number
  openLeads: number
  completedFollowups: number
  conversionRate: number
  lastSeen: string | null
}

interface Props {
  profile: Profile
  stages: LeadStage[]
  stageCounts: Record<string, number>
  sourceCounts: Record<string, number>
  totalLeads: number
  recentLeads: any[]
  followups: any[]
  invoices: any[]
  quotations: any[]
  agentPerf?: AgentPerf[]
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

function isOverdue(dateStr: string): boolean {
  const scheduled = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - scheduled.getTime()
  return diffMs > 30 * 60 * 1000 // 30 minutes in ms
}

function isPast(dateStr: string) {
  return new Date(dateStr) < new Date()
}

export default function DashboardClient({
  profile,
  stages,
  stageCounts,
  sourceCounts,
  totalLeads,
  recentLeads,
  followups,
  invoices,
  quotations,
  agentPerf = [],
}: Props) {
  const router = useRouter()
  const metaLeads = sourceCounts['META_ADS'] ?? 0
  const isAdmin = profile.role === 'ADMIN'

  // Helper to check if quotation is expired
  function getIsQuotationExpired(q: any): boolean {
    if (q.status === 'ACCEPTED' || q.status === 'REJECTED') return false
    if (q.status === 'EXPIRED') return true
    if (q.valid_until) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const validUntil = new Date(q.valid_until)
      validUntil.setHours(0, 0, 0, 0)
      return today > validUntil
    }
    return false
  }

  // Financial calculations (normalized to SAR) - Exclude CANCELLED invoices
  const activeInvoices = invoices.filter((inv) => inv.status !== 'CANCELLED')
  const totalEarnedSAR = activeInvoices.reduce((acc, inv) => acc + convertToSAR(Number(inv.amount_paid ?? 0), inv.currency), 0)
  const totalInvoicedSAR = activeInvoices.reduce((acc, inv) => acc + convertToSAR(Number(inv.total ?? 0), inv.currency), 0)
  const outstandingSAR = totalInvoicedSAR - totalEarnedSAR

  // Active Pending Quotations Pipeline (excluding ACCEPTED, REJECTED, and EXPIRED)
  const activePendingQuotations = quotations.filter(
    (q) => (q.status === 'SENT' || q.status === 'DRAFT') && !getIsQuotationExpired(q)
  )
  const pipelineQuotationsSAR = activePendingQuotations.reduce(
    (acc, q) => acc + convertToSAR(Number(q.total ?? 0), q.currency),
    0
  )

  // Won leads
  const wonStage = stages.find((s) => s.key === 'won')
  const wonCount = wonStage ? (stageCounts[wonStage.id] ?? 0) : 0
  const conversionRate = totalLeads > 0 ? ((wonCount / totalLeads) * 100).toFixed(1) : '0.0'

  // Top agents sorted by total leads
  const topAgents = [...agentPerf].sort((a, b) => b.totalLeads - a.totalLeads).slice(0, 5)
  const maxLeads = topAgents.length > 0 ? topAgents[0].totalLeads : 1

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="text-page-title">Dashboard</h1>
          <p className="text-meta" style={{ marginTop: 2 }}>
            Good {getGreeting()}, {profile.name.split(' ')[0]} · Overview of leads, pipeline &amp; finances
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/quotations/new" className="btn btn-outline btn-sm">
            <FileText size={14} /> New quotation
          </Link>
          <Link href="/leads?action=add" className="btn btn-primary btn-sm">
            <Plus size={14} /> Add lead
          </Link>
        </div>
      </div>

      <div className="page-body">
        {/* Financial Analytics Summary Row */}
        <div className="mb-6">
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <span className="text-section-header" style={{ fontSize: 13 }}>Financial Overview (SAR Base)</span>
            <div className="flex gap-3 text-meta" style={{ fontSize: 12 }}>
              <span>Invoices: {activeInvoices.length}</span>
              <span>Quotations: {quotations.length}</span>
            </div>
          </div>
          <div className="rg-4">
            <div className="card" style={{ padding: '14px 16px', background: 'var(--card-bg)' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Revenue Earned</span>
                <span style={{ padding: 4, borderRadius: 6, background: '#f0fdf4', color: '#16a34a' }}>
                  <DollarSign size={14} />
                </span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>
                SAR {totalEarnedSAR.toLocaleString('en', { minimumFractionDigits: 2 })}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
                Collected payments
              </span>
            </div>

            <div className="card" style={{ padding: '14px 16px', background: 'var(--card-bg)' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Quotation Pipeline</span>
                <span style={{ padding: 4, borderRadius: 6, background: '#eff6ff', color: '#2563eb' }}>
                  <FileText size={14} />
                </span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#2563eb' }}>
                SAR {pipelineQuotationsSAR.toLocaleString('en', { minimumFractionDigits: 2 })}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
                Active quotes in pipeline
              </span>
            </div>

            <div className="card" style={{ padding: '14px 16px', background: 'var(--card-bg)' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Outstanding Balance</span>
                <span style={{ padding: 4, borderRadius: 6, background: '#fffbe6', color: '#d48806' }}>
                  <CreditCard size={14} />
                </span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: outstandingSAR > 0 ? '#d48806' : 'var(--text-primary)' }}>
                SAR {outstandingSAR.toLocaleString('en', { minimumFractionDigits: 2 })}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
                Pending collection
              </span>
            </div>

            <div className="card" style={{ padding: '14px 16px', background: 'var(--card-bg)' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Total Invoiced</span>
                <span style={{ padding: 4, borderRadius: 6, background: 'var(--border)', color: 'var(--text-secondary)' }}>
                  <TrendingUp size={14} />
                </span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                SAR {totalInvoicedSAR.toLocaleString('en', { minimumFractionDigits: 2 })}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
                Gross total billed
              </span>
            </div>
          </div>
        </div>

        {/* Lead Stats Row */}
        <div className="rg-4 mb-6">
          <div className="stat-card">
            <div className="stat-card-label">Total leads</div>
            <div className="stat-card-value">{totalLeads.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">From Meta Ads</div>
            <div className="stat-card-value">{metaLeads.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Won leads</div>
            <div className="stat-card-value" style={{ color: 'var(--success)' }}>
              {wonCount.toLocaleString()}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Conversion rate</div>
            <div className="stat-card-value">{conversionRate}%</div>
          </div>
        </div>

        {/* Funnel chart + Source Breakdown */}
        <div className="rg-main-sidebar mb-6">
          {/* Funnel chart */}
          <div className="card">
            <div className="card-header">
              <span className="text-section-header">Funnel overview</span>
              <Link href="/leads" className="btn btn-ghost btn-sm" style={{ fontSize: 13 }}>
                View all leads <ArrowRight size={13} />
              </Link>
            </div>
            <div className="card-body">
              {stages.length === 0 ? (
                <div className="empty-state">
                  <BarChart2 size={24} className="empty-state-icon" />
                  <div className="empty-state-title">No stage data</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {stages.map((stage) => {
                    const count = stageCounts[stage.id] ?? 0
                    const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0
                    return (
                      <div key={stage.id}>
                        <div className="flex items-center gap-3" style={{ marginBottom: 4 }}>
                          <span style={{ width: 110, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flexShrink: 0 }}>
                            {stage.label}
                          </span>
                          <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 100, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: stage.color_hex, borderRadius: 100, transition: 'width 400ms ease' }} />
                          </div>
                          <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', width: 32, textAlign: 'right', flexShrink: 0 }}>
                            {count}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Source breakdown */}
          <div className="card">
            <div className="card-header">
              <span className="text-section-header">Lead sources</span>
            </div>
            <div className="card-body">
              {Object.keys(sourceCounts).length === 0 ? (
                <div className="empty-state">
                  <Megaphone size={24} className="empty-state-icon" />
                  <div className="empty-state-title">No leads yet</div>
                  <div className="empty-state-desc">Add leads manually or connect Meta Ads</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Object.entries(sourceCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([source, count]) => (
                      <div key={source} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                            {SOURCE_LABELS[source] ?? source}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div style={{ width: 80, height: 4, background: 'var(--border)', borderRadius: 100, overflow: 'hidden' }}>
                            <div style={{ width: `${totalLeads > 0 ? (count / totalLeads) * 100 : 0}%`, height: '100%', background: 'var(--accent)', borderRadius: 100 }} />
                          </div>
                          <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', width: 28, textAlign: 'right' }}>
                            {count}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent leads + Follow-ups */}
        <div className="rg-main-sidebar mb-6">
          {/* Recent leads */}
          <div className="card">
            <div className="card-header">
              <span className="text-section-header">Recent leads</span>
              <Link href="/leads" className="btn btn-ghost btn-sm" style={{ fontSize: 13 }}>
                View all <ArrowRight size={13} />
              </Link>
            </div>
            {recentLeads.length === 0 ? (
              <div className="empty-state">
                <Users size={24} className="empty-state-icon" />
                <div className="empty-state-title">No leads yet</div>
                <div className="empty-state-desc">Add a lead manually or set up Meta Ads webhook</div>
                <Link href="/leads?action=add" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
                  <Plus size={14} />
                  Add first lead
                </Link>
              </div>
            ) : (
              <>
                <div className="table-wrapper hide-mobile" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Stage</th>
                        <th>Source</th>
                        <th>Added</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLeads.map((lead: any) => (
                        <tr
                          key={lead.id}
                          className="clickable"
                          onClick={() => (window.location.href = `/leads/${lead.id}`)}
                        >
                          <td style={{ fontWeight: 500 }}>{lead.name ?? '—'}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{lead.phone ?? '—'}</td>
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
                          <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                            {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="show-mobile flex-col" style={{ borderTop: '1px solid var(--border)' }}>
                  {recentLeads.map((lead: any, i: number) => (
                    <div
                      key={lead.id}
                      className="clickable"
                      onClick={() => (window.location.href = `/leads/${lead.id}`)}
                      style={{
                        padding: '12px 20px',
                        borderBottom: i < recentLeads.length - 1 ? '1px solid var(--border)' : 'none',
                        display: 'flex', flexDirection: 'column', gap: 4,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {lead.name ?? 'Unnamed Lead'}
                        </span>
                        {lead.stage && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: lead.stage.color_hex, flexShrink: 0 }} />
                            {lead.stage.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-meta" style={{ fontSize: 12 }}>
                        <span>{lead.phone ?? '—'}</span>
                        <div className="flex gap-2">
                          <span className="badge badge-default" style={{ fontSize: 10, padding: '2px 6px' }}>
                            {SOURCE_LABELS[lead.source] ?? lead.source}
                          </span>
                          <span>{formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Upcoming follow-ups — now clickable + overdue badge */}
          <div className="card">
            <div className="card-header">
              <span className="text-section-header">Upcoming follow-ups</span>
              <Calendar size={15} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {followups.length === 0 ? (
                <div className="empty-state">
                  <Clock size={24} className="empty-state-icon" />
                  <div className="empty-state-title">No follow-ups scheduled</div>
                  <div className="empty-state-desc">Schedule a follow-up from any lead detail page</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {followups.map((fu: any, i: number) => {
                    const overdue = isOverdue(fu.scheduled_at)
                    const past = isPast(fu.scheduled_at)
                    const leadId = fu.lead_id ?? fu.lead?.id

                    return (
                      <div
                        key={fu.id}
                        className="clickable"
                        onClick={() => leadId && (window.location.href = `/leads/${leadId}`)}
                        style={{
                          padding: '12px 20px',
                          borderBottom: i < followups.length - 1 ? '1px solid var(--border)' : 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                          cursor: leadId ? 'pointer' : 'default',
                          transition: 'background 150ms',
                        }}
                        onMouseEnter={(e) => { if (leadId) (e.currentTarget as HTMLElement).style.background = 'var(--bg)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {fu.lead?.name ?? 'Unknown lead'}
                            </span>
                            {overdue && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 20,
                                background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa',
                                flexShrink: 0,
                              }}>
                                <AlertCircle size={9} />
                                Pending
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                            <span style={{
                              fontSize: 11,
                              color: overdue ? 'var(--danger)' : past ? '#d97706' : 'var(--text-secondary)',
                              fontWeight: overdue ? 600 : 400,
                            }}>
                              {format(new Date(fu.scheduled_at), 'dd MMM, HH:mm')}
                            </span>
                            {leadId && <ChevronRight size={12} style={{ color: 'var(--text-tertiary)' }} />}
                          </div>
                        </div>
                        {fu.note && (
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fu.note}
                          </span>
                        )}
                        {fu.agent?.name && (
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                            Agent: {fu.agent.name}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Agent Leaderboard & Performance Overview */}
        {(isAdmin || profile.role === 'ACCOUNT_MANAGER') && agentPerf.length > 0 && (
          <div className="card mb-6">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <Trophy size={15} style={{ color: '#d97706' }} />
                <span className="text-section-header">Sales Agent Leaderboard</span>
              </div>
              <Link href="/settings/agents" className="btn btn-ghost btn-sm" style={{ fontSize: 13 }}>
                Manage team <ArrowRight size={13} />
              </Link>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {topAgents.map((agent, i) => {
                  const pct = maxLeads > 0 ? (agent.totalLeads / maxLeads) * 100 : 0
                  const rankColors = ['#f59e0b', '#94a3b8', '#cd7c2e', 'var(--text-tertiary)', 'var(--text-tertiary)']
                  return (
                    <div
                      key={agent.id}
                      className="clickable"
                      onClick={() => (window.location.href = `/settings/agents/${agent.id}`)}
                      style={{
                        padding: '14px 20px',
                        borderBottom: i < topAgents.length - 1 ? '1px solid var(--border)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        cursor: 'pointer',
                        transition: 'background 150ms',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, color: rankColors[i], width: 20, textAlign: 'center', flexShrink: 0 }}>
                        #{i + 1}
                      </span>
                      <div className="avatar avatar-sm" style={{ flexShrink: 0 }}>
                        {agent.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {agent.name}
                          </span>
                          <div className="flex items-center gap-4" style={{ flexShrink: 0 }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{agent.totalLeads}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>leads</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>{agent.conversionRate.toFixed(1)}%</div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>conv.</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>{agent.completedFollowups}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>follow-ups</div>
                            </div>
                          </div>
                        </div>
                        <div style={{ height: 4, background: 'var(--border)', borderRadius: 100, overflow: 'hidden' }}>
                          <div style={{
                            width: `${pct}%`, height: '100%', borderRadius: 100,
                            background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7c2e' : 'var(--accent)',
                            transition: 'width 600ms ease',
                          }} />
                        </div>
                      </div>
                      <ChevronRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}
