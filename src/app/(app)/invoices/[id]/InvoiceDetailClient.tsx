'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ArrowLeft, Plus, CheckCircle, Printer, Edit2, Trash2, XCircle, RotateCcw, Send } from 'lucide-react'

import type { Invoice, Profile, Payment } from '@/types/database'

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

export default function InvoiceDetailClient({ invoice: initial, payments: initialPayments, profile }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [invoice, setInvoice] = useState(initial)
  const [payments, setPayments] = useState(initialPayments)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)

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
  const balance = Number(invoice.total) - Number(invoice.amount_paid)

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

  async function recordOrUpdatePayment(e: React.FormEvent) {
    e.preventDefault()
    if (!payAmount || saving) return
    setSaving(true)

    const amt = parseFloat(payAmount)

    if (editingPaymentId) {
      await supabase.from('payments').update({
        amount: amt,
        method: payMethod,
        paid_at: payDate,
        reference_note: payRef.trim() || null,
      }).eq('id', editingPaymentId)
    } else {
      await supabase.from('payments').insert({
        invoice_id: invoice.id,
        amount: amt,
        method: payMethod,
        paid_at: payDate,
        reference_note: payRef.trim() || null,
        recorded_by: profile.id,
      })
    }

    await syncInvoiceBalanceAndStatus(invoice.id)
    setPayAmount(''); setPayRef(''); setShowPaymentForm(false); setEditingPaymentId(null); setSaving(false)
  }

  async function deletePayment(paymentId: string) {
    if (!confirm('Are you sure you want to delete this payment record?')) return
    setSaving(true)
    await supabase.from('payments').delete().eq('id', paymentId)

    await syncInvoiceBalanceAndStatus(invoice.id)
    setSaving(false)
  }


  // Automatically sync balance and status on load to correct any stale database records
  useState(() => {
    syncInvoiceBalanceAndStatus(initial.id)
  })

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => router.push('/invoices')}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-page-title">{invoice.invoice_number}</h1>
            <p className="text-meta" style={{ marginTop: 2 }}>
              Issued {format(new Date(invoice.issue_date), 'dd MMM yyyy')}
            </p>
          </div>
          <span className={`badge ${STATUS_BADGE[invoice.status] ?? 'badge-default'}`}>
            {invoice.status.replace('_', ' ')}
          </span>
        </div>
        <div className="flex gap-2 no-print flex-wrap">
          <Link href={`/invoices/${invoice.id}/edit`} className="btn btn-outline btn-sm">
            <Edit2 size={14} />
            Edit invoice
          </Link>
          <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
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
        </div>
      </div>


      <div className="page-body">
        {/* Document Banner with Company Logo */}
        <div className="card" style={{ padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 900 }}>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Adonix Logo" style={{ height: 38, width: 'auto', objectFit: 'contain' }} />
            <div>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Adonix</span>
              <p className="text-meta">Tax Invoice & Billing Statement</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{invoice.invoice_number}</span>
            <p className="text-meta">Currency: {curr}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, maxWidth: 900 }}>
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
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{invoice.client.address}</div>
                )}
              </div>
            </div>

            {/* Line items */}
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-header"><span className="text-section-header">Line items</span></div>
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th className="num">Qty</th>
                      <th className="num">Unit price</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoice.items ?? []).map((item: any) => (
                      <tr key={item.id}>
                        <td>{item.description}</td>
                        <td className="num tabular-nums">{item.qty}</td>
                        <td className="num tabular-nums">{curr} {Number(item.unit_price).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                        <td className="num tabular-nums" style={{ fontWeight: 500 }}>{curr} {Number(item.amount).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)' }}>
                      <td colSpan={3} style={{ textAlign: 'right', fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>Subtotal</td>
                      <td className="num tabular-nums" style={{ fontWeight: 600 }}>{curr} {Number(invoice.subtotal).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>Tax ({invoice.tax_percent}%)</td>
                      <td className="num tabular-nums" style={{ fontSize: 13 }}>{curr} {Number(invoice.tax_amount).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr style={{ borderTop: '1px solid var(--border)' }}>
                      <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>Total</td>
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
                  <table className="table">
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
                              <button type="button" className="btn btn-ghost btn-icon btn-xs" onClick={() => deletePayment(p.id)} style={{ color: 'var(--danger)' }}>
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
                {[
                  { label: 'Subtotal', value: invoice.subtotal, color: undefined },
                  { label: `Tax (${invoice.tax_percent}%)`, value: invoice.tax_amount, color: undefined },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between">
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
                    <span className="tabular-nums" style={{ fontSize: 13, color }}>
                      {curr} {Number(value).toLocaleString('en', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
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
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowPaymentForm(false); setEditingPaymentId(null) }}>
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
      </div>
    </div>
  )
}
