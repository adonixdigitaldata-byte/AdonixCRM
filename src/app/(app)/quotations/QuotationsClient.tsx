'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Plus, Search, Filter } from 'lucide-react'

interface Props {
  quotations: any[]
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-default', SENT: 'badge-info', ACCEPTED: 'badge-success',
  REJECTED: 'badge-danger', EXPIRED: 'badge-warning',
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

export default function QuotationsClient({ quotations }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Helper to determine if a quotation is expired
  function getIsQuotationExpired(q: any): boolean {
    if (q.status === 'ACCEPTED' || q.status === 'REJECTED') {
      return false
    }
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

  // Search & Status filtering
  const filtered = quotations.filter((q) => {
    const qNum = (q.quote_number ?? '').toLowerCase()
    const cName = (q.client?.name ?? '').toLowerCase()
    const cComp = (q.client?.company ?? '').toLowerCase()
    const query = search.toLowerCase().trim()

    const matchesSearch = !query || qNum.includes(query) || cName.includes(query) || cComp.includes(query)
    const isExpired = getIsQuotationExpired(q)
    const effectiveStatus = isExpired ? 'EXPIRED' : q.status
    const matchesStatus = statusFilter === 'ALL' || effectiveStatus === statusFilter

    return matchesSearch && matchesStatus
  })

  const totalQuoted = filtered.reduce((acc, q) => acc + convertToSAR(Number(q.total), q.currency), 0)
  const acceptedValue = filtered.filter((q) => q.status === 'ACCEPTED').reduce((acc, q) => acc + convertToSAR(Number(q.total), q.currency), 0)
  const pendingValue = filtered
    .filter((q) => !getIsQuotationExpired(q) && (q.status === 'DRAFT' || q.status === 'SENT'))
    .reduce((acc, q) => acc + convertToSAR(Number(q.total), q.currency), 0)
  const acceptedCount = filtered.filter((q) => q.status === 'ACCEPTED').length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-page-title">Quotations & Proposals</h1>
          <p className="text-meta" style={{ marginTop: 2 }}>
            {filtered.length} of {quotations.length} quotation{quotations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/quotations/create" className="btn btn-primary btn-sm">
          <Plus size={14} />
          New quotation
        </Link>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Financial Analytics Bar */}
        <div className="rg-stats">
          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Total Value Quoted</span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--text-primary)' }}>
              SAR {totalQuoted.toLocaleString('en', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>Accepted Proposals</span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--success)' }}>
              SAR {acceptedValue.toLocaleString('en', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--info)', fontWeight: 500 }}>Pending Deals</span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--info)' }}>
              SAR {pendingValue.toLocaleString('en', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Deals Won</span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--text-primary)' }}>
              {acceptedCount} / {filtered.length} ({filtered.length ? Math.round((acceptedCount / filtered.length) * 100) : 0}%)
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="toolbar-filters flex gap-3 items-center flex-wrap">
          <div className="search-input-wrapper flex-1" style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search by quote #, client name, or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: 140 }}
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-title">No quotations found</div>
              <div className="empty-state-desc">Try clearing your search query or filters</div>
            </div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Quote #</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Issue date</th>
                  <th>Valid until</th>
                  <th className="num">Total</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q: any) => {
                  const curr = q.currency ?? 'SAR'
                  const isExpired = getIsQuotationExpired(q)
                  const displayStatus = isExpired ? 'EXPIRED' : q.status
                  return (
                    <tr
                      key={q.id}
                      className="clickable"
                      onClick={(e) => {
                        const target = e.target as HTMLElement
                        if (target.tagName !== 'BUTTON' && target.tagName !== 'A' && !target.closest('a') && !target.closest('button')) {
                          router.push(`/quotations/${q.id}`)
                        }
                      }}
                    >
                      <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        <Link href={`/quotations/${q.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {q.quote_number}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/quotations/${q.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          <div style={{ fontWeight: 500 }}>{q.client?.name ?? '—'}</div>
                          {q.client?.company && (
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{q.client.company}</div>
                          )}
                        </Link>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[displayStatus] ?? 'badge-default'}`}>
                          {displayStatus}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                        {format(new Date(q.issue_date), 'dd MMM yyyy')}
                      </td>
                      <td style={{ color: isExpired ? 'var(--warning)' : 'var(--text-secondary)', fontSize: 13, fontWeight: isExpired ? 600 : 400 }}>
                        {q.valid_until ? format(new Date(q.valid_until), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="num tabular-nums" style={{ fontWeight: 600 }}>
                        {curr} {Number(q.total).toLocaleString('en', { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <Link href={`/quotations/${q.id}`} className="btn btn-ghost btn-xs">
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
