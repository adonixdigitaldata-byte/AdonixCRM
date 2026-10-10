'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Search, Filter, Plus, Calendar, X } from 'lucide-react'
import { isDateInFilterRange, extractAvailableMonths } from '@/lib/utils/date-filter'

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
  const [dateFilter, setDateFilter] = useState('ALL')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  // Extract available months from invoices
  const availableMonths = useMemo(() => {
    return extractAvailableMonths(invoices, (inv) => inv.issue_date || inv.created_at)
  }, [invoices])

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
    const matchesDate = isDateInFilterRange(
      inv.issue_date || inv.created_at,
      dateFilter,
      customStartDate,
      customEndDate
    )

    return matchesSearch && matchesStatus && matchesDate
  })

  // Map of credit notes & debit notes by referenced invoice id or invoice number
  const creditNotesByRef: Record<string, number> = {}
  const debitNotesByRef: Record<string, number> = {}

  invoices.forEach((inv) => {
    if (inv.is_credit_note && inv.status !== 'CANCELLED') {
      const val = convertToSAR(Number(inv.total), inv.currency)
      if (inv.reference_invoice_id) {
        creditNotesByRef[inv.reference_invoice_id] = (creditNotesByRef[inv.reference_invoice_id] || 0) + val
      }
      if (inv.reference_invoice_number) {
        creditNotesByRef[inv.reference_invoice_number] = (creditNotesByRef[inv.reference_invoice_number] || 0) + val
      }
    }
    if (inv.is_debit_note && inv.status !== 'CANCELLED') {
      const val = convertToSAR(Number(inv.total), inv.currency)
      if (inv.reference_invoice_id) {
        debitNotesByRef[inv.reference_invoice_id] = (debitNotesByRef[inv.reference_invoice_id] || 0) + val
      }
      if (inv.reference_invoice_number) {
        debitNotesByRef[inv.reference_invoice_number] = (debitNotesByRef[inv.reference_invoice_number] || 0) + val
      }
    }
  })

  // Financial Calculations
  const creditNotes = filtered.filter((inv) => inv.is_credit_note && inv.status !== 'CANCELLED')
  const debitNotes = filtered.filter((inv) => inv.is_debit_note && inv.status !== 'CANCELLED')
  const totalCreditNotes = creditNotes.reduce((acc, inv) => acc + convertToSAR(Number(inv.total), inv.currency), 0)
  const totalDebitNotes = debitNotes.reduce((acc, inv) => acc + convertToSAR(Number(inv.total), inv.currency), 0)

  // Standard non-credit/debit invoices
  const standardInvoices = filtered.filter((inv) => !inv.is_credit_note && !inv.is_debit_note && inv.status !== 'CANCELLED')
  const issuedStandardInvoices = standardInvoices.filter((inv) => inv.status !== 'DRAFT')

  const totalGrossInvoiced = standardInvoices.reduce((acc, inv) => acc + convertToSAR(Number(inv.total), inv.currency), 0)
  
  // Net Billed = Gross Invoiced + Debit Notes - Credit Notes
  const netInvoiced = Math.max(0, totalGrossInvoiced + totalDebitNotes - totalCreditNotes)
  
  // Total Collected = All payments recorded in the database
  const totalCollected = filtered.reduce((acc, inv) => acc + convertToSAR(Number(inv.amount_paid || 0), inv.currency), 0)
  
  // Outstanding Receivables = Net Issued Billed - Amount Collected
  const netIssuedInvoiced = Math.max(
    0,
    issuedStandardInvoices.reduce((acc, inv) => acc + convertToSAR(Number(inv.total), inv.currency), 0) + totalDebitNotes - totalCreditNotes
  )
  const totalOutstanding = Math.max(0, netIssuedInvoiced - totalCollected)
  
  const overdueCount = issuedStandardInvoices.filter(getIsOverdue).length

  const hasActiveFilters = search || statusFilter !== 'ALL' || dateFilter !== 'ALL' || customStartDate || customEndDate

  function clearAllFilters() {
    setSearch('')
    setStatusFilter('ALL')
    setDateFilter('ALL')
    setCustomStartDate('')
    setCustomEndDate('')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-page-title">Invoices & Receivables</h1>
          <p className="text-meta" style={{ marginTop: 2 }}>
            {filtered.length} of {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
            {hasActiveFilters ? ' (filtered)' : ''} · Track billing, credit notes & collections
          </p>
        </div>
        <Link href="/invoices/new" className="btn btn-primary btn-sm">
          <Plus size={14} />
          New invoice
        </Link>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Financial Analytics Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Net Invoiced (Billed)</span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--text-primary)' }}>
              SAR {netInvoiced.toLocaleString('en', { minimumFractionDigits: 2 })}
            </div>
            {totalCreditNotes > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                Gross: SAR {totalGrossInvoiced.toLocaleString('en', { minimumFractionDigits: 0 })}
              </span>
            )}
          </div>

          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>Amount Collected</span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--success)' }}>
              SAR {totalCollected.toLocaleString('en', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: totalOutstanding > 0 ? 'var(--warning)' : 'var(--text-secondary)', fontWeight: 500 }}>
              Outstanding (Receivables)
            </span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: totalOutstanding > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
              SAR {totalOutstanding.toLocaleString('en', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="card" style={{ padding: '14px 16px', background: totalCreditNotes > 0 ? '#fffbeb' : undefined, borderColor: totalCreditNotes > 0 ? '#fde68a' : undefined }}>
            <span style={{ fontSize: 12, color: '#b45309', fontWeight: 500 }}>Credit Notes Issued</span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: '#b45309' }}>
              SAR {totalCreditNotes.toLocaleString('en', { minimumFractionDigits: 2 })}
            </div>
            <span style={{ fontSize: 11, color: '#b45309', opacity: 0.8, marginTop: 2 }}>
              {creditNotes.length} note{creditNotes.length !== 1 ? 's' : ''} (reversals)
            </span>
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
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
            <select
              className="form-select"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value)
                if (e.target.value !== 'CUSTOM') {
                  setCustomStartDate('')
                  setCustomEndDate('')
                }
              }}
              style={
                dateFilter !== 'ALL'
                  ? { borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600, width: 140 }
                  : { width: 140 }
              }
              title="Filter invoices by date"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="PAST_3_DAYS">Past 3 Days</option>
              <option value="THIS_WEEK">This Week</option>
              <option value="THIS_MONTH">This Month</option>
              {availableMonths.length > 0 && (
                <optgroup label="By Month">
                  {availableMonths.map((m) => (
                    <option key={m.value} value={`month:${m.value}`}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              )}
              <option value="CUSTOM">Custom Range...</option>
            </select>
          </div>

          {/* Custom Date Pickers */}
          {dateFilter === 'CUSTOM' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                className="form-input"
                style={{ padding: '4px 8px', fontSize: 13, height: 36 }}
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                title="Start date"
              />
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>to</span>
              <input
                type="date"
                className="form-input"
                style={{ padding: '4px 8px', fontSize: 13, height: 36 }}
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                title="End date"
              />
            </div>
          )}

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={
                statusFilter !== 'ALL'
                  ? { borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600, width: 150 }
                  : { width: 150 }
              }
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

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={clearAllFilters}
              style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <X size={13} />
              Clear filters
            </button>
          )}
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
                  const isCN = Boolean(inv.is_credit_note)
                  const isDN = Boolean(inv.is_debit_note)
                  const isCancelled = inv.status === 'CANCELLED'
                  const isDraft = inv.status === 'DRAFT'

                  const creditedTotal = (inv.id && creditNotesByRef[inv.id]) || (inv.invoice_number && creditNotesByRef[inv.invoice_number]) || 0
                  const debitedTotal = (inv.id && debitNotesByRef[inv.id]) || (inv.invoice_number && debitNotesByRef[inv.invoice_number]) || 0

                  const netInvoiceTotal = isCN
                    ? Number(inv.total)
                    : isDN
                    ? Number(inv.total)
                    : Math.max(0, Number(inv.total) + debitedTotal - creditedTotal)

                  const isFullyCredited = !isCN && !isDN && creditedTotal >= Number(inv.total) && Number(inv.total) > 0
                  const balance = (isCancelled || isCN || isFullyCredited)
                    ? 0
                    : Math.max(0, netInvoiceTotal - Number(inv.amount_paid || 0))
                  const isOverdue = !isCN && !isDN && !isFullyCredited && getIsOverdue(inv)

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
                      <td>
                        <Link href={`/invoices/${inv.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{inv.invoice_number}</span>
                            {isCN && (
                              <span className="badge badge-warning" style={{ fontSize: 9, padding: '1px 5px', height: 16 }}>
                                CREDIT NOTE
                              </span>
                            )}
                            {isDN && (
                              <span className="badge" style={{ fontSize: 9, padding: '1px 5px', height: 16, background: '#ede9fe', color: '#6d28d9', borderColor: '#ddd6fe' }}>
                                DEBIT NOTE
                              </span>
                            )}
                          </div>
                          {inv.reference_invoice_number && (
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                              Ref: {inv.reference_invoice_number}
                            </div>
                          )}
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
                        {isCN ? (
                          <span className="badge badge-warning">
                            CREDIT NOTE
                          </span>
                        ) : isDN ? (
                          <span className="badge" style={{ background: '#ede9fe', color: '#6d28d9', borderColor: '#ddd6fe' }}>
                            DEBIT NOTE
                          </span>
                        ) : isFullyCredited ? (
                          <span className="badge badge-default" style={{ color: '#b45309', background: '#fffbeb', borderColor: '#fde68a' }}>
                            CREDITED / REVERSED
                          </span>
                        ) : (
                          <span className={`badge ${isOverdue ? 'badge-danger' : (STATUS_BADGE[inv.status] ?? 'badge-default')}`}>
                            {isOverdue ? 'OVERDUE' : inv.status.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {format(new Date(inv.issue_date), 'dd MMM yyyy')}
                      </td>
                      <td style={{
                        fontSize: 13,
                        color: isOverdue ? 'var(--danger)' : 'var(--text-secondary)',
                        fontWeight: isOverdue ? 600 : 400,
                      }}>
                        {isCN ? '—' : inv.due_date ? format(new Date(inv.due_date), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="num tabular-nums" style={{ fontWeight: 600, color: isCN ? '#b45309' : isDN ? '#6d28d9' : undefined }}>
                        {isCN ? (
                          `- ${curr} ${Number(inv.total).toLocaleString('en', { minimumFractionDigits: 2 })}`
                        ) : isDN ? (
                          `+ ${curr} ${Number(inv.total).toLocaleString('en', { minimumFractionDigits: 2 })}`
                        ) : (
                          <div>
                            <div>{curr} {Number(inv.total).toLocaleString('en', { minimumFractionDigits: 2 })}</div>
                            {creditedTotal > 0 && (
                              <div style={{ fontSize: 10, color: '#b45309', fontWeight: 500 }}>
                                -{curr} {creditedTotal.toLocaleString('en', { minimumFractionDigits: 2 })} (Credit Note)
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="num tabular-nums" style={{ color: isCN ? 'var(--text-tertiary)' : 'var(--success)' }}>
                        {isCN ? '—' : `${curr} ${Number(inv.amount_paid || 0).toLocaleString('en', { minimumFractionDigits: 2 })}`}
                      </td>
                      <td className="num tabular-nums" style={{
                        fontWeight: balance > 0 ? 600 : 400,
                        color: isCN
                          ? '#b45309'
                          : isDN
                          ? '#6d28d9'
                          : (isCancelled || isFullyCredited)
                          ? 'var(--text-tertiary)'
                          : isDraft
                          ? 'var(--text-secondary)'
                          : balance > 0
                          ? (isOverdue ? 'var(--danger)' : 'var(--text-primary)')
                          : 'var(--success)',
                      }}>
                        {isCN ? (
                          <span style={{ fontSize: 11, color: '#b45309', fontWeight: 600 }}>Credit Reversal</span>
                        ) : isCancelled ? (
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Cancelled</span>
                        ) : isFullyCredited ? (
                          <span style={{ fontSize: 11, color: '#b45309', fontWeight: 600 }}>Settled by Credit Note</span>
                        ) : isDraft ? (
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Draft (Unissued)</span>
                        ) : isDN ? (
                          <span>+ {curr} {balance.toLocaleString('en', { minimumFractionDigits: 2 })}</span>
                        ) : (
                          `${curr} ${balance.toLocaleString('en', { minimumFractionDigits: 2 })}`
                        )}
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
