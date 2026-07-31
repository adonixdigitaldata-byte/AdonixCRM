'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Search, Filter, Plus } from 'lucide-react'

interface Props {
  invoices: any[]
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-default', SENT: 'badge-info', PARTIALLY_PAID: 'badge-warning',
  PAID: 'badge-success', OVERDUE: 'badge-danger', CANCELLED: 'badge-default',
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

export default function InvoicesClient({ invoices }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Helper to determine if an invoice is overdue
  function getIsOverdue(inv: any) {
    if (inv.status === 'PAID' || inv.status === 'CANCELLED' || inv.status === 'DRAFT') {
      return false
    }
    if (inv.status === 'OVERDUE') return true
    if (inv.due_date) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const dueDate = new Date(inv.due_date)
      dueDate.setHours(0, 0, 0, 0)
      return today > dueDate
    }
    return false
  }

  // Filtering
  const filtered = invoices.filter((inv) => {
    const invNum = (inv.invoice_number ?? '').toLowerCase()
    const cName = (inv.client?.name ?? '').toLowerCase()
    const cComp = (inv.client?.company ?? '').toLowerCase()
    const query = search.toLowerCase().trim()

    const matchesSearch = !query || invNum.includes(query) || cName.includes(query) || cComp.includes(query)
    const isOverdue = getIsOverdue(inv)
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'OVERDUE' && isOverdue) ||
      (statusFilter !== 'OVERDUE' && inv.status === statusFilter)

    return matchesSearch && matchesStatus
  })

  // Exclude CANCELLED invoices from total invoiced and outstanding calculations
  const activeInvoices = filtered.filter((inv) => inv.status !== 'CANCELLED')

  const totalInvoiced = activeInvoices.reduce((acc, inv) => acc + convertToSAR(Number(inv.total), inv.currency), 0)
  const totalCollected = activeInvoices.reduce((acc, inv) => acc + convertToSAR(Number(inv.amount_paid), inv.currency), 0)
  const totalOutstanding = totalInvoiced - totalCollected
  const overdueCount = activeInvoices.filter(getIsOverdue).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-page-title">Invoices & Receivables</h1>
          <p className="text-meta" style={{ marginTop: 2 }}>
            {filtered.length} of {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} · Track billing, partial payments & collections
          </p>
        </div>
        <Link href="/invoices/new" className="btn btn-primary btn-sm">
          <Plus size={14} />
          New invoice
        </Link>
      </div>


      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Financial Analytics Bar */}
        <div className="rg-stats">

          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Total Invoiced</span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--text-primary)' }}>
              SAR {totalInvoiced.toLocaleString('en', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>Amount Collected (Received)</span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--success)' }}>
              SAR {totalCollected.toLocaleString('en', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: totalOutstanding > 0 ? 'var(--warning)' : 'var(--text-secondary)', fontWeight: 500 }}>
              Outstanding (To Receive)
            </span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: totalOutstanding > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
              SAR {totalOutstanding.toLocaleString('en', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: overdueCount > 0 ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: 500 }}>
              Overdue Invoices
            </span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: overdueCount > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
              {overdueCount} {overdueCount === 1 ? 'invoice' : 'invoices'}
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
              placeholder="Search by invoice #, client name, or company..."
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
              style={{ width: 150 }}
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-title">No invoices found</div>
              <div className="empty-state-desc">Try clearing your search query or filters</div>
            </div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Issue date</th>
                  <th>Due date</th>
                  <th className="num">Total</th>
                  <th className="num">Paid</th>
                  <th className="num">Balance</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv: any) => {
                  const curr = inv.currency ?? 'SAR'
                  const balance = inv.status === 'CANCELLED' ? 0 : Number(inv.total) - Number(inv.amount_paid)
                  const isOverdue = getIsOverdue(inv)
                  return (
                    <tr
                      key={inv.id}
                      className="clickable"
                      onClick={(e) => {
                        const target = e.target as HTMLElement
                        if (target.tagName !== 'BUTTON' && target.tagName !== 'A' && !target.closest('a') && !target.closest('button')) {
                          router.push(`/invoices/${inv.id}`)
                        }
                      }}
                    >
                      <td style={{ fontWeight: 600 }}>
                        <Link href={`/invoices/${inv.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/invoices/${inv.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          <div style={{ fontWeight: 500 }}>{inv.client?.name ?? '—'}</div>
                          {inv.client?.company && (
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{inv.client.company}</div>
                          )}
                        </Link>
                      </td>
                      <td>
                        <span className={`badge ${isOverdue ? 'badge-danger' : (STATUS_BADGE[inv.status] ?? 'badge-default')}`}>
                          {isOverdue ? 'OVERDUE' : inv.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {format(new Date(inv.issue_date), 'dd MMM yyyy')}
                      </td>
                      <td style={{
                        fontSize: 13,
                        color: isOverdue ? 'var(--danger)' : 'var(--text-secondary)',
                        fontWeight: isOverdue ? 600 : 400,
                      }}>
                        {inv.due_date ? format(new Date(inv.due_date), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="num tabular-nums" style={{ fontWeight: 600 }}>
                        {curr} {Number(inv.total).toLocaleString('en', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="num tabular-nums" style={{ color: 'var(--success)' }}>
                        {curr} {Number(inv.amount_paid).toLocaleString('en', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="num tabular-nums" style={{
                        fontWeight: balance > 0 ? 600 : 400,
                        color: balance > 0 ? (isOverdue ? 'var(--danger)' : 'var(--text-primary)') : 'var(--success)',
                      }}>
                        {curr} {balance.toLocaleString('en', { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <Link href={`/invoices/${inv.id}`} className="btn btn-ghost btn-xs">
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
