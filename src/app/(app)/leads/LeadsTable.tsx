'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ChevronLeft, ChevronRight, Users, Check } from 'lucide-react'
import type { Lead } from '@/types/database'

const SOURCE_LABELS: Record<string, string> = {
  META_ADS: 'Meta Ads', MANUAL: 'Manual', XLSX_IMPORT: 'XLSX',
  TIKTOK: 'TikTok', SNAPCHAT: 'Snapchat', WHATSAPP: 'WhatsApp',
}

const PAGE_SIZE = 20

interface Props {
  leads: Lead[]
  loading: boolean
  onRefresh: () => void
  agents?: { id: string; name: string }[]
  isAdmin?: boolean
}

export default function LeadsTable({ leads, loading, onRefresh, agents = [], isAdmin = false }: Props) {
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAgentId, setBulkAgentId] = useState('')
  const [bulkAssigning, setBulkAssigning] = useState(false)

  // Reset to page 1 whenever leads list changes
  useEffect(() => {
    setCurrentPage(1)
    setSelectedIds([])
  }, [leads.length])

  if (loading) {
    return (
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              {isAdmin && <th style={{ width: 40 }}></th>}
              <th>Name</th><th>Phone</th><th>Email</th>
              <th>Stage</th><th>Source</th><th>Agent</th><th>Added</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(6)].map((_, i) => (
              <tr key={i}>
                {isAdmin && <td><div className="skeleton" style={{ height: 16, width: 16, borderRadius: 4 }} /></td>}
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

  const totalPages = Math.ceil(leads.length / PAGE_SIZE)
  const safeCurrentPage = Math.min(currentPage, totalPages) || 1

  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE
  const endIndex = Math.min(startIndex + PAGE_SIZE, leads.length)
  const paginatedLeads = leads.slice(startIndex, endIndex)

  const allPageSelected = paginatedLeads.length > 0 && paginatedLeads.every((l) => selectedIds.includes(l.id))

  function toggleSelectAllPage() {
    if (allPageSelected) {
      setSelectedIds(selectedIds.filter((id) => !paginatedLeads.some((l) => l.id === id)))
    } else {
      const newIds = Array.from(new Set([...selectedIds, ...paginatedLeads.map((l) => l.id)]))
      setSelectedIds(newIds)
    }
  }

  function toggleSelectLead(id: string) {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  async function handleBulkAssign() {
    if (!bulkAgentId || selectedIds.length === 0) return
    setBulkAssigning(true)
    try {
      const res = await fetch('/api/leads/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: selectedIds, agentId: bulkAgentId }),
      })
      const data = await res.json()
      if (res.ok) {
        setSelectedIds([])
        setBulkAgentId('')
        onRefresh()
      } else {
        alert(data.error ?? 'Failed to bulk assign leads')
      }
    } catch {
      alert('Error bulk assigning leads')
    }
    setBulkAssigning(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Bulk Assignment Bar */}
      {selectedIds.length > 0 && (
        <div
          style={{
            padding: '10px 16px',
            background: 'var(--surface)',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          }}
        >
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
              {selectedIds.length} lead{selectedIds.length > 1 ? 's' : ''} selected
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setSelectedIds([])}
              style={{ fontSize: 12, color: 'var(--text-tertiary)' }}
            >
              Deselect all
            </button>
          </div>

          {isAdmin && agents.length > 0 && (
            <div className="flex items-center gap-2">
              <Users size={14} style={{ color: 'var(--text-secondary)' }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Bulk Assign to:</span>
              <select
                className="form-input"
                value={bulkAgentId}
                onChange={(e) => setBulkAgentId(e.target.value)}
                style={{ minWidth: 170, height: 34, fontSize: 13, padding: '4px 8px' }}
              >
                <option value="">Select agent...</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!bulkAgentId || bulkAssigning}
                onClick={handleBulkAssign}
              >
                {bulkAssigning ? 'Assigning...' : `Assign ${selectedIds.length} lead${selectedIds.length > 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              {isAdmin && (
                <th style={{ width: 40, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectAllPage}
                    style={{ cursor: 'pointer', width: 15, height: 15 }}
                  />
                </th>
              )}
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Stage</th>
              <th className="num">Potential Earning</th>
              <th>Source</th>
              <th>Agent</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLeads.map((lead) => {
              const isSelected = selectedIds.includes(lead.id)
              const potentialVal = (lead as any).potential_value ?? lead.form_data?.potential_value
              return (
                <tr
                  key={lead.id}
                  className="clickable"
                  style={{ background: isSelected ? 'rgba(79, 70, 229, 0.04)' : undefined }}
                  onClick={() => router.push(`/leads/${lead.id}`)}
                >
                  {isAdmin && (
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectLead(lead.id)}
                        style={{ cursor: 'pointer', width: 15, height: 15 }}
                      />
                    </td>
                  )}
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
                  <td className="num tabular-nums" style={{ fontWeight: 600, color: potentialVal ? 'var(--success)' : 'var(--text-tertiary)' }}>
                    {potentialVal ? `SAR ${Number(potentialVal).toLocaleString('en', { minimumFractionDigits: 2 })}` : '—'}
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
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {leads.length > PAGE_SIZE && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            padding: '12px 16px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        >
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Showing <strong style={{ color: 'var(--text-primary)' }}>{startIndex + 1}</strong> to{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{endIndex}</strong> of{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{leads.length}</strong> leads
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={safeCurrentPage === 1}
              onClick={() => {
                setCurrentPage((p) => Math.max(1, p - 1))
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
              }}
              style={{ gap: 4 }}
            >
              <ChevronLeft size={14} />
              Previous
            </button>

            <div style={{ display: 'flex', gap: 4 }}>
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1
                const isActive = pageNum === safeCurrentPage
                return (
                  <button
                    key={pageNum}
                    type="button"
                    className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => {
                      setCurrentPage(pageNum)
                      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
                    }}
                    style={{ minWidth: 32, padding: '0 8px' }}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={safeCurrentPage === totalPages}
              onClick={() => {
                setCurrentPage((p) => Math.min(totalPages, p + 1))
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
              }}
              style={{ gap: 4 }}
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
