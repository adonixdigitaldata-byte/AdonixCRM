'use client'

import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import type { Lead } from '@/types/database'

const SOURCE_LABELS: Record<string, string> = {
  META_ADS: 'Meta Ads', MANUAL: 'Manual', XLSX_IMPORT: 'XLSX',
  TIKTOK: 'TikTok', SNAPCHAT: 'Snapchat', WHATSAPP: 'WhatsApp',
}

interface Props {
  leads: Lead[]
  loading: boolean
  onRefresh: () => void
}

export default function LeadsTable({ leads, loading, onRefresh }: Props) {
  const router = useRouter()

  if (loading) {
    return (
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th><th>Phone</th><th>Email</th>
              <th>Stage</th><th>Source</th><th>Agent</th><th>Added</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(6)].map((_, i) => (
              <tr key={i}>
                {[...Array(7)].map((_, j) => (
                  <td key={j}>
                    <div className="skeleton" style={{ height: 16, width: '80%', borderRadius: 4 }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-title">No leads found</div>
          <div className="empty-state-desc">Try adjusting your filters or add a new lead</div>
        </div>
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Stage</th>
            <th>Source</th>
            <th>Agent</th>
            <th>Added</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.id}
              className="clickable"
              onClick={() => router.push(`/leads/${lead.id}`)}
            >
              <td style={{ fontWeight: 500 }}>{lead.name ?? '—'}</td>
              <td style={{ color: 'var(--text-secondary)' }}>{lead.phone ?? '—'}</td>
              <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{lead.email ?? '—'}</td>
              <td>
                {lead.stage && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: lead.stage.color_hex, flexShrink: 0,
                    }} />
                    {lead.stage.label}
                  </span>
                )}
              </td>
              <td>
                <span className="badge badge-default" style={{ fontSize: 11 }}>
                  {SOURCE_LABELS[lead.source] ?? lead.source}
                </span>
              </td>
              <td>
                {lead.assigned_agent ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="avatar avatar-sm">
                      {lead.assigned_agent.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span style={{ fontSize: 13 }}>{lead.assigned_agent.name}</span>
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Unassigned</span>
                )}
              </td>
              <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
