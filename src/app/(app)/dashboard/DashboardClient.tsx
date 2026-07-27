'use client'

import Link from 'next/link'
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
} from 'lucide-react'
import type { LeadStage, Profile } from '@/types/database'

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
}: Props) {
  const metaLeads = sourceCounts['META_ADS'] ?? 0

  // Financial calculations (normalized to SAR)
  const totalEarnedSAR = invoices.reduce((acc, inv) => acc + convertToSAR(Number(inv.amount_paid ?? 0), inv.currency), 0)
  const totalInvoicedSAR = invoices.reduce((acc, inv) => acc + convertToSAR(Number(inv.total ?? 0), inv.currency), 0)
  const outstandingSAR = totalInvoicedSAR - totalEarnedSAR

  const pipelineQuotationsSAR = quotations
    .filter((q) => q.status === 'SENT' || q.status === 'ACCEPTED' || q.status === 'DRAFT')
    .reduce((acc, q) => acc + convertToSAR(Number(q.total ?? 0), q.currency), 0)

  // Won leads
  const wonStage = stages.find((s) => s.key === 'won')
  const wonCount = wonStage ? (stageCounts[wonStage.id] ?? 0) : 0
  const conversionRate = totalLeads > 0 ? ((wonCount / totalLeads) * 100).toFixed(1) : '0.0'

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="text-page-title">Dashboard</h1>
          <p className="text-meta" style={{ marginTop: 2 }}>
            Good {getGreeting()}, {profile.name.split(' ')[0]} · Overview of leads, pipeline & finances
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/quotations/new" className="btn btn-outline btn-sm">
            <Plus size={14} /> New quotation
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
              <span>Invoices: {invoices.length}</span>
              <span>Quotations: {quotations.length}</span>
            </div>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
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
        <div
          className="grid grid-cols-4 gap-4 mb-6"
          style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
        >
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
        <div
          className="grid gap-4 mb-6"
          style={{ gridTemplateColumns: '1fr 380px' }}
        >
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
                        <div
                          className="flex items-center gap-3"
                          style={{ marginBottom: 4 }}
                        >
                          <span
                            style={{
                              width: 110,
                              fontSize: 13,
                              fontWeight: 500,
                              color: 'var(--text-primary)',
                              flexShrink: 0,
                            }}
                          >
                            {stage.label}
                          </span>
                          <div
                            style={{
                              flex: 1,
                              height: 8,
                              background: 'var(--border)',
                              borderRadius: 100,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: stage.color_hex,
                                borderRadius: 100,
                                transition: 'width 400ms ease',
                              }}
                            />
                          </div>
                          <span
                            className="tabular-nums"
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              width: 32,
                              textAlign: 'right',
                              flexShrink: 0,
                            }}
                          >
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
                  <div className="empty-state-desc">
                    Add leads manually or connect Meta Ads
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Object.entries(sourceCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([source, count]) => (
                      <div
                        key={source}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            style={{
                              fontSize: 13,
                              color: 'var(--text-primary)',
                            }}
                          >
                            {SOURCE_LABELS[source] ?? source}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div
                            style={{
                              width: 80,
                              height: 4,
                              background: 'var(--border)',
                              borderRadius: 100,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${totalLeads > 0 ? (count / totalLeads) * 100 : 0}%`,
                                height: '100%',
                                background: 'var(--accent)',
                                borderRadius: 100,
                              }}
                            />
                          </div>
                          <span
                            className="tabular-nums"
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              width: 28,
                              textAlign: 'right',
                            }}
                          >
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
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: '1fr 380px' }}
        >
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
                <div className="empty-state-desc">
                  Add a lead manually or set up Meta Ads webhook
                </div>
                <Link href="/leads?action=add" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
                  <Plus size={14} />
                  Add first lead
                </Link>
              </div>
            ) : (
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
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
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {lead.phone ?? '—'}
                        </td>
                        <td>
                          {lead.stage && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 12,
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: lead.stage.color_hex,
                                  flexShrink: 0,
                                }}
                              />
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
            )}
          </div>

          {/* Upcoming follow-ups */}
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
                  <div className="empty-state-desc">
                    Schedule a follow-up from any lead detail page
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {followups.map((fu: any, i: number) => (
                    <div
                      key={fu.id}
                      style={{
                        padding: '12px 20px',
                        borderBottom: i < followups.length - 1 ? '1px solid var(--border)' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span style={{ fontSize: 13, fontWeight: 500 }}>
                          {fu.lead?.name ?? 'Unknown lead'}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: isPast(fu.scheduled_at)
                              ? 'var(--danger)'
                              : 'var(--text-secondary)',
                          }}
                        >
                          {format(new Date(fu.scheduled_at), 'dd MMM, HH:mm')}
                        </span>
                      </div>
                      {fu.note && (
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {fu.note}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
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

function isPast(dateStr: string) {
  return new Date(dateStr) < new Date()
}
