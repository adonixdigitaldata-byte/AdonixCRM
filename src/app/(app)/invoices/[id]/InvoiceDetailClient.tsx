'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ArrowLeft, Plus, CheckCircle, Printer, Edit2, Trash2, XCircle, RotateCcw, Send, AlertTriangle, X, MapPin, Phone, Globe } from 'lucide-react'

import type { Invoice, Profile, Payment } from '@/types/database'
import { OFFICE_LOCATIONS, type OfficeLocationKey } from '@/lib/constants/officeLocations'

interface Props {
  invoice: Invoice & { client: any; items: any[] }
  payments: Payment[]
  profile: Profile
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-default', SENT: 'badge-info', PARTIALLY_PAID: 'badge-warning',
  PAID: 'badge-success', OVERDUE: 'badge-danger', CANCELLED: 'badge-default',
}

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER']

function renderFormattedText(text: string) {
  if (!text) return null
  const lines = text.split('\n')
  const filteredLines = lines.filter((line, i) => {
    if (i === 0 && /^terms\s*(?:&|and)?\s*conditions:?$/i.test(line.trim())) return false
    return true
  })

  return filteredLines.map((line, index) => {
    const cleanLine = line.trim()
    const isHeaderLine = /^(?:\*\*|\*)?(Additional Terms|Terms & Conditions|Payment Terms|Payment Schedule)(?:\*\*|\*)?:?$/i.test(cleanLine)
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)

    return (
      <div
        key={index}
        style={{
          minHeight: line === '' ? '0.6em' : undefined,
          fontWeight: isHeaderLine ? 700 : undefined,
          color: isHeaderLine ? 'var(--text-primary)' : undefined,
          marginTop: isHeaderLine ? 10 : undefined,
          marginBottom: isHeaderLine ? 4 : undefined,
        }}
      >
        {parts.map((part, i) => {
          if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('*') && part.endsWith('*'))) {
            const content = part.slice(part.startsWith('**') ? 2 : 1, part.endsWith('**') ? -2 : -1)
            return <strong key={i} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{content}</strong>
          }
          return part
        })}
      </div>
    )
  })
}

export default function InvoiceDetailClient({ invoice: initial, payments: initialPayments, profile }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [invoice, setInvoice] = useState(initial)
  const [payments, setPayments] = useState(initialPayments)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [showCr, setShowCr] = useState(true)
  const [officeLocation, setOfficeLocation] = useState<OfficeLocationKey>(
    (initial.office_location as OfficeLocationKey) || 'KSA'
  )

  // Payment form states
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('BANK_TRANSFER')
  const [payRef, setPayRef] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const paymentFormRef = useRef<HTMLDivElement>(null)
  const payAmountInputRef = useRef<HTMLInputElement>(null)

  const curr = invoice.currency ?? 'SAR'
  const hasItemDiscounts = (invoice.items ?? []).some((i: any) => Number(i.discount_percent) > 0)
  const discountAmount = Number(invoice.discount_amount) || 0
  const taxableSubtotal = Math.max(0, Number(invoice.subtotal) - discountAmount)
  const balance = Number(invoice.total) - Number(invoice.amount_paid)

  const isOverdue = (() => {
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED' || invoice.status === 'DRAFT') {
      return false
    }
    if (invoice.status === 'OVERDUE') return true
    if (invoice.due_date) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const dueDate = new Date(invoice.due_date)
      dueDate.setHours(0, 0, 0, 0)
      return today > dueDate
    }
    return false
  })()

  function openPaymentForm() {
    setEditingPaymentId(null)
    setPayAmount('')
    setPayRef('')
    setPayMethod('BANK_TRANSFER')
    setPayDate(new Date().toISOString().slice(0, 10))
    setShowPaymentForm(true)

    setTimeout(() => {
      paymentFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      payAmountInputRef.current?.focus()
    }, 100)
  }

  function startEditPayment(p: any) {
    setEditingPaymentId(p.id)
    setPayAmount(p.amount.toString())
    setPayMethod(p.method ?? 'BANK_TRANSFER')
    setPayRef(p.reference_note ?? '')
    setPayDate(p.paid_at ? new Date(p.paid_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10))
    setShowPaymentForm(true)

    setTimeout(() => {
      paymentFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      payAmountInputRef.current?.focus()
    }, 100)
  }

  async function updateStatus(newStatus: string) {
    setUpdatingStatus(true)
    await supabase.from('invoices').update({ status: newStatus }).eq('id', invoice.id)
    setInvoice({ ...invoice, status: newStatus as any })
    setUpdatingStatus(false)
  }

  async function syncInvoiceBalanceAndStatus(targetInvoiceId: string) {
    const { data: allPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('invoice_id', targetInvoiceId)

    const newAmountPaid = (allPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)
    const invTotal = Number(invoice.total)

    let newStatus: string = invoice.status
    if (newAmountPaid >= invTotal) {
      newStatus = 'PAID'
    } else if (newAmountPaid > 0) {
      newStatus = 'PARTIALLY_PAID'
    } else if (invoice.status === 'PAID' || invoice.status === 'PARTIALLY_PAID') {
      newStatus = 'SENT'
    }

    await supabase.from('invoices').update({
      amount_paid: newAmountPaid,
      status: newStatus,
    }).eq('id', targetInvoiceId)

    const { data: updatedInvoice } = await supabase
      .from('invoices')
      .select('*, client:clients(*), items:invoice_items(*)')
      .eq('id', targetInvoiceId)
      .single()

    const { data: updatedPayments } = await supabase
      .from('payments')
      .select('*')
      .eq('invoice_id', targetInvoiceId)
      .order('paid_at', { ascending: false })

    if (updatedInvoice) setInvoice(updatedInvoice as any)
    if (updatedPayments) setPayments(updatedPayments as any)
  }

  // Modal states for deleting invoice & payments
  const [payError, setPayError] = useState('')
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)
  const [deletePaymentLoading, setDeletePaymentLoading] = useState(false)
  const [deletePaymentError, setDeletePaymentError] = useState('')

  const [showDeleteInvoiceModal, setShowDeleteInvoiceModal] = useState(false)
  const [deleteInvoiceLoading, setDeleteInvoiceLoading] = useState(false)
  const [deleteInvoiceError, setDeleteInvoiceError] = useState('')

  async function recordOrUpdatePayment(e: React.FormEvent) {
    e.preventDefault()
    if (!payAmount || saving) return
    setSaving(true)
    setPayError('')

    try {
      const res = await fetch('/api/invoices/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: editingPaymentId ? 'UPDATE' : 'RECORD',
          invoiceId: invoice.id,
          paymentId: editingPaymentId,
          amount: parseFloat(payAmount),
          method: payMethod,
          paidAt: payDate,
          referenceNote: payRef.trim() || null,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        if (data.invoice) setInvoice(data.invoice)
        if (data.payments) setPayments(data.payments)
        setPayAmount('')
        setPayRef('')
        setShowPaymentForm(false)
        setEditingPaymentId(null)
      } else {
        setPayError(data.error || 'Failed to save payment')
      }
    } catch (err: any) {
      console.error('Payment error:', err)
      setPayError('Error recording payment')
    }
    setSaving(false)
  }

  function openDeletePaymentModal(paymentId: string) {
    setDeletingPaymentId(paymentId)
    setDeletePaymentError('')
  }

  async function confirmDeletePayment() {
    if (!deletingPaymentId) return
    setDeletePaymentLoading(true)
    setDeletePaymentError('')
    try {
      const res = await fetch('/api/invoices/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE',
          invoiceId: invoice.id,
          paymentId: deletingPaymentId,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        if (data.invoice) setInvoice(data.invoice)
        if (data.payments) setPayments(data.payments)
        setDeletingPaymentId(null)
      } else {
        setDeletePaymentError(data.error || 'Failed to delete payment')
      }
    } catch (err: any) {
      console.error('Delete payment error:', err)
      setDeletePaymentError('Error deleting payment')
    }
    setDeletePaymentLoading(false)
  }

  function openDeleteInvoiceModal() {
    setDeleteInvoiceError('')
    setShowDeleteInvoiceModal(true)
  }

  async function confirmDeleteInvoice() {
    setDeleteInvoiceLoading(true)
    setDeleteInvoiceError('')
    try {
      const res = await fetch('/api/invoices/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        router.push('/invoices')
      } else {
        setDeleteInvoiceError(data.error || 'Failed to delete invoice')
        setDeleteInvoiceLoading(false)
      }
    } catch (err) {
      setDeleteInvoiceError('Error deleting invoice')
      setDeleteInvoiceLoading(false)
    }
  }

  // Automatically sync balance and status on load to correct any stale database records
  function handlePrint() {
    const originalTitle = document.title
    const clientName = invoice.client?.name || invoice.client?.company
    const printTitle = clientName ? `Invoice — Adonix for ${clientName}` : `Invoice — Adonix ${invoice.invoice_number}`
    document.title = printTitle
    window.print()
    setTimeout(() => {
      document.title = originalTitle
    }, 1000)
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => router.push(profile.role === 'CLIENT' ? '/portal?section=finance' : '/invoices')}
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-page-title">{invoice.invoice_number}</h1>
            <p className="text-meta" style={{ marginTop: 2 }}>
              Issued {format(new Date(invoice.issue_date), 'dd MMM yyyy')}
            </p>
          </div>
          <span className={`badge ${isOverdue ? 'badge-danger' : (STATUS_BADGE[invoice.status] ?? 'badge-default')}`}>
            {isOverdue ? 'OVERDUE' : invoice.status.replace('_', ' ')}
          </span>
        </div>

        <div className="flex gap-2 no-print flex-wrap items-center">
          {profile.role === 'CLIENT' ? (
            <button className="btn btn-primary btn-sm" onClick={handlePrint}>
              <Printer size={14} />
              Print / Save as PDF
            </button>
          ) : (
            <>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, marginRight: 8 }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Office:</span>
                <select
                  className="form-select"
                  value={officeLocation}
                  onChange={(e) => {
                    const newLoc = e.target.value as OfficeLocationKey
                    setOfficeLocation(newLoc)
                    supabase.from('invoices').update({ office_location: newLoc }).eq('id', invoice.id).then()
                  }}
                  style={{ padding: '3px 8px', fontSize: 12, height: 30, cursor: 'pointer', borderRadius: 6 }}
                >
                  <option value="KSA">🇸🇦 Saudi Arabia (Jeddah)</option>
                  <option value="HYDERABAD">🇮🇳 India (Hyderabad)</option>
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 13, color: 'var(--text-secondary)', marginRight: 12, userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={showCr}
                  onChange={(e) => setShowCr(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Show CR No.
              </label>
              <Link href={`/invoices/${invoice.id}/edit`} className="btn btn-outline btn-sm">
                <Edit2 size={14} />
                Edit invoice
              </Link>
              <button className="btn btn-outline btn-sm" onClick={handlePrint}>
                <Printer size={14} />
                Print / PDF
              </button>

              {invoice.status === 'DRAFT' && (
                <button className="btn btn-outline btn-sm" onClick={() => updateStatus('SENT')} disabled={updatingStatus}>
                  <Send size={14} />
                  Mark as sent
                </button>
              )}

              {invoice.status === 'SENT' && (
                <button className="btn btn-outline btn-sm" onClick={() => updateStatus('DRAFT')} disabled={updatingStatus}>
                  <RotateCcw size={14} />
                  Mark as draft
                </button>
              )}

              {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
                <button className="btn btn-primary btn-sm" onClick={openPaymentForm}>
                  <Plus size={14} />
                  Record payment
                </button>
              )}

              {['ADMIN', 'ACCOUNT_MANAGER', 'AGENT'].includes(profile.role) && (
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={openDeleteInvoiceModal} disabled={saving}>
                  <Trash2 size={14} />
                  Delete
                </button>
              )}

              {invoice.status !== 'CANCELLED' ? (
                <button className="btn btn-danger btn-sm" onClick={() => updateStatus('CANCELLED')} disabled={updatingStatus}>
                  <XCircle size={14} />
                  Cancel invoice
                </button>
              ) : (
                <button className="btn btn-outline btn-sm" onClick={() => updateStatus('DRAFT')} disabled={updatingStatus}>
                  <RotateCcw size={14} />
                  Re-open as draft
                </button>
              )}
            </>
          )}
        </div>
      </div>


      <div className="page-body">
        {/* Document Banner with Company Logo & Brand Details */}
        {(() => {
          const currentOffice = OFFICE_LOCATIONS[officeLocation] || OFFICE_LOCATIONS.KSA
          return (
            <div className="card doc-banner-card" style={{ padding: '16px 20px', marginBottom: 16, maxWidth: 900, width: '100%', boxSizing: 'border-box' }}>
              <div className="doc-banner-top" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
                <div className="flex items-center gap-3">
                  <img src="/logo.png" alt="Adonix Logo" style={{ height: 38, width: 'auto', objectFit: 'contain' }} />
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Adonix {showCr && currentOffice.crNumber && (
                        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
                          ({currentOffice.crNumber})
                        </span>
                      )}
                    </span>
                    <p className="text-meta" style={{ margin: 0 }}>VAT Invoice &amp; Billing Statement</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{invoice.invoice_number}</span>
                  <p className="text-meta" style={{ margin: 0 }}>Currency: {curr}</p>
                </div>
              </div>

              {/* Compact Brand Header Sub-bar */}
              <div className="doc-banner-brand-bar">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <MapPin size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span>{currentOffice.address}</span>
                  <a
                    href={currentOffice.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none', marginLeft: 2 }}
                  >
                    (View Map)
                  </a>
                </span>

                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Phone size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span>{currentOffice.phone}</span>
                  </span>
                  <span>·</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Globe size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <a
                      href="https://adonixdigital.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                    >
                      adonixdigital.com
                    </a>
                  </span>
                </span>
              </div>
            </div>
          )
        })()}

        <div className="rg-doc-detail">

          <div>
            {/* Client */}
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-header"><span className="text-section-header">Bill to</span></div>
              <div className="card-body">
                <div style={{ fontWeight: 600 }}>{invoice.client?.name}</div>
                {invoice.client?.company && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{invoice.client.company}</div>
                )}
                {invoice.client?.email && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{invoice.client.email}</div>
                )}
                {invoice.client?.phone && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{invoice.client.phone}</div>
                )}
                {invoice.client?.address && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, whiteSpace: 'pre-line' }}>{invoice.client.address}</div>
                )}
              </div>
            </div>

            {/* Line items */}
            <div className="card card-allow-break" style={{ marginBottom: 12 }}>
              <div className="card-header"><span className="text-section-header">Line items</span></div>
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table table-compact">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th className="num">Qty</th>
                      <th className="num">Unit price</th>
                      {hasItemDiscounts && <th className="num">Disc %</th>}
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoice.items ?? []).map((item: any) => (
                      <tr key={item.id}>
                        <td>{item.description}</td>
                        <td className="num tabular-nums">{item.qty}</td>
                        <td className="num tabular-nums">{curr} {Number(item.unit_price).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                        {hasItemDiscounts && (
                          <td className="num tabular-nums" style={{ color: Number(item.discount_percent) > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
                            {Number(item.discount_percent) > 0 ? `${item.discount_percent}%` : '—'}
                          </td>
                        )}
                        <td className="num tabular-nums" style={{ fontWeight: 500 }}>{curr} {Number(item.amount).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)' }}>
                      <td colSpan={hasItemDiscounts ? 4 : 3} style={{ textAlign: 'right', fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>Subtotal</td>
                      <td className="num tabular-nums" style={{ fontWeight: 600 }}>{curr} {Number(invoice.subtotal).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    {discountAmount > 0 && (
                      <tr style={{ color: 'var(--success)' }}>
                        <td colSpan={hasItemDiscounts ? 4 : 3} style={{ textAlign: 'right', fontSize: 13, fontWeight: 500 }}>
                          Discount {invoice.discount_type === 'PERCENTAGE' ? `(${invoice.discount_value}%)` : ''}
                        </td>
                        <td className="num tabular-nums" style={{ fontSize: 13, fontWeight: 600 }}>
                          - {curr} {discountAmount.toLocaleString('en', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}
                    {discountAmount > 0 && (
                      <tr>
                        <td colSpan={hasItemDiscounts ? 4 : 3} style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>Taxable Subtotal</td>
                        <td className="num tabular-nums" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          {curr} {taxableSubtotal.toLocaleString('en', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={hasItemDiscounts ? 4 : 3} style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>VAT ({invoice.tax_percent}%)</td>
                      <td className="num tabular-nums" style={{ fontSize: 13 }}>{curr} {Number(invoice.tax_amount).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr style={{ borderTop: '1px solid var(--border)' }}>
                      <td colSpan={hasItemDiscounts ? 4 : 3} style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>Total</td>
                      <td className="num tabular-nums" style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{curr} {Number(invoice.total).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Payments */}
            {payments.length > 0 && (
              <div className="card" style={{ marginBottom: 12 }}>
                <div className="card-header"><span className="text-section-header">Payment history</span></div>
                <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="table table-compact">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Method</th>
                        <th>Reference</th>
                        <th className="num">Amount</th>
                        <th className="no-print" style={{ width: 70 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p: any) => (
                        <tr key={p.id}>
                          <td style={{ fontSize: 13 }}>{format(new Date(p.paid_at), 'dd MMM yyyy')}</td>
                          <td>
                            <span className="badge badge-default" style={{ fontSize: 11 }}>
                              {p.method?.replace('_', ' ') ?? '—'}
                            </span>
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.reference_note ?? '—'}</td>
                          <td className="num tabular-nums" style={{ fontWeight: 600, color: 'var(--success)' }}>
                            {curr} {Number(p.amount).toLocaleString('en', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="no-print">
                            <div className="flex gap-1 justify-end">
                              <button type="button" className="btn btn-ghost btn-icon btn-xs" onClick={() => startEditPayment(p)}>
                                <Edit2 size={12} />
                              </button>
                              <button type="button" className="btn btn-ghost btn-icon btn-xs" onClick={() => openDeletePaymentModal(p.id)} style={{ color: 'var(--danger)' }}>
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>

          {/* Right: Totals + Record Payment + Details + Signature */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card">
              <div className="card-header"><span className="text-section-header">Summary</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="flex justify-between">
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Subtotal</span>
                  <span className="tabular-nums" style={{ fontSize: 13 }}>
                    {curr} {Number(invoice.subtotal).toLocaleString('en', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between" style={{ color: 'var(--success)' }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                      Discount {invoice.discount_type === 'PERCENTAGE' ? `(${invoice.discount_value}%)` : ''}
                    </span>
                    <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600 }}>
                      - {curr} {discountAmount.toLocaleString('en', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Taxable Subtotal</span>
                    <span className="tabular-nums" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {curr} {taxableSubtotal.toLocaleString('en', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>VAT ({invoice.tax_percent}%)</span>
                  <span className="tabular-nums" style={{ fontSize: 13 }}>
                    {curr} {Number(invoice.tax_amount).toLocaleString('en', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="divider" style={{ margin: '4px 0' }} />
                <div className="flex justify-between">
                  <span style={{ fontWeight: 600 }}>Total</span>
                  <span className="tabular-nums" style={{ fontSize: 16, fontWeight: 700 }}>
                    {curr} {Number(invoice.total).toLocaleString('en', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Paid</span>
                  <span className="tabular-nums" style={{ fontSize: 14, color: 'var(--success)', fontWeight: 600 }}>
                    {curr} {Number(invoice.amount_paid).toLocaleString('en', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Balance</span>
                  <span className="tabular-nums" style={{
                    fontSize: 15, fontWeight: 700,
                    color: balance > 0 ? 'var(--danger)' : 'var(--success)',
                  }}>
                    {curr} {balance.toLocaleString('en', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="text-section-header">Details</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Issue date', value: format(new Date(invoice.issue_date), 'dd MMM yyyy') },
                  { label: 'Due date', value: invoice.due_date ? format(new Date(invoice.due_date), 'dd MMM yyyy') : '—' },
                  { label: 'Currency', value: curr },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
                    <span style={{ fontSize: 13 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="text-section-header">Authorized Signature</span></div>
              <div className="card-body">
                <div style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  paddingBottom: 4,
                  borderBottom: '1px solid var(--border)',
                  marginBottom: 4,
                }}>
                  Nabeel Syed Yousuf
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Authorized Signatory · Adonix
                </div>
              </div>
            </div>

            {/* Record payment form */}
            {showPaymentForm && (
              <div className="card no-print" ref={paymentFormRef}>
                <div className="card-header">
                  <span className="text-section-header">{editingPaymentId ? 'Edit payment record' : 'Record payment'}</span>
                </div>
                <div className="card-body">
                  <form onSubmit={recordOrUpdatePayment} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {payError && (
                      <div className="alert alert-danger" style={{ padding: '8px 12px', fontSize: 13 }}>
                        {payError}
                      </div>
                    )}
                    <div className="form-group">
                      <label className="form-label form-label-required">Amount ({curr})</label>
                      <input
                        ref={payAmountInputRef}
                        type="number"
                        min={0.01}
                        step="0.01"
                        className="form-input"
                        placeholder={`Amount in ${curr}`}
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Payment method</label>
                      <select className="form-input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>{m.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Date</label>
                      <input type="date" className="form-input" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Reference</label>
                      <input className="form-input" placeholder="Transaction reference or note" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
                    </div>
                    <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowPaymentForm(false); setEditingPaymentId(null); setPayError('') }}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                        <CheckCircle size={13} />
                        {saving ? 'Saving...' : editingPaymentId ? 'Update payment' : 'Record payment'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Full-width Terms & Notes below main document grid (Matches Quotations style) */}
        <div style={{ maxWidth: 900, marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {invoice.terms && (
            <div className="card" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <div className="card-header"><span className="text-section-header">Terms &amp; Conditions</span></div>
              <div className="card-body">
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, wordBreak: 'break-word' }}>
                  {renderFormattedText(invoice.terms)}
                </div>
              </div>
            </div>
          )}

          {invoice.notes && (
            <div className="card" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <div className="card-header"><span className="text-section-header">Notes &amp; Remarks</span></div>
              <div className="card-body">
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, wordBreak: 'break-word' }}>
                  {renderFormattedText(invoice.notes)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Payment Modal Overlay */}
      {deletingPaymentId && (
        <div className="modal-backdrop" onClick={() => !deletePaymentLoading && setDeletingPaymentId(null)}>
          <div className="modal-box" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 8, borderRadius: 8, background: '#fef2f2', color: 'var(--danger)' }}>
                  <AlertTriangle size={20} />
                </div>
                <h3 className="modal-title">Delete Payment Record</h3>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setDeletingPaymentId(null)}
                disabled={deletePaymentLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px 20px' }}>
              {deletePaymentError && (
                <div className="alert alert-danger" style={{ marginBottom: 12, padding: '8px 12px', fontSize: 13 }}>
                  {deletePaymentError}
                </div>
              )}
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Are you sure you want to delete this payment record? This action will adjust the invoice balance.
              </p>
            </div>

            <div className="modal-footer" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setDeletingPaymentId(null)}
                disabled={deletePaymentLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={confirmDeletePayment}
                disabled={deletePaymentLoading}
              >
                {deletePaymentLoading ? 'Deleting...' : 'Delete payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Invoice Modal Overlay */}
      {showDeleteInvoiceModal && (
        <div className="modal-backdrop" onClick={() => !deleteInvoiceLoading && setShowDeleteInvoiceModal(false)}>
          <div className="modal-box" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 8, borderRadius: 8, background: '#fef2f2', color: 'var(--danger)' }}>
                  <AlertTriangle size={20} />
                </div>
                <h3 className="modal-title">Delete Invoice</h3>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setShowDeleteInvoiceModal(false)}
                disabled={deleteInvoiceLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px 20px' }}>
              {deleteInvoiceError && (
                <div className="alert alert-danger" style={{ marginBottom: 12, padding: '8px 12px', fontSize: 13 }}>
                  {deleteInvoiceError}
                </div>
              )}
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Are you sure you want to delete invoice <strong style={{ color: 'var(--text-primary)' }}>{invoice.invoice_number}</strong>?
                This action cannot be undone.
              </p>
            </div>

            <div className="modal-footer" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowDeleteInvoiceModal(false)}
                disabled={deleteInvoiceLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={confirmDeleteInvoice}
                disabled={deleteInvoiceLoading}
              >
                {deleteInvoiceLoading ? 'Deleting...' : 'Delete invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
