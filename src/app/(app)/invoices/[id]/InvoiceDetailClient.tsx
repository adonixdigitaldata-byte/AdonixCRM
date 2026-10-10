'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ArrowLeft, Plus, CheckCircle, Printer, Edit2, Trash2, XCircle, RotateCcw, Send, AlertTriangle, X, MapPin, Phone, Globe } from 'lucide-react'

import type { Invoice, Profile, Payment } from '@/types/database'
import { OFFICE_LOCATIONS, type OfficeLocationKey } from '@/lib/constants/officeLocations'
import StandardTaxInvoiceTemplate from '@/components/invoices/StandardTaxInvoiceTemplate'

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
  const [linkedNotes, setLinkedNotes] = useState<any[]>([])
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

  // Fetch linked Credit/Debit notes
  useEffect(() => {
    async function fetchLinkedNotes() {
      const { data } = await supabase
        .from('invoices')
        .select('*')
        .or(`reference_invoice_id.eq.${invoice.id},reference_invoice_number.eq.${invoice.invoice_number}`)
        .order('created_at', { ascending: false })
      if (data) setLinkedNotes(data)
    }
    if (!invoice.is_credit_note && !invoice.is_debit_note) {
      fetchLinkedNotes()
    }
  }, [invoice.id, invoice.invoice_number])

  const creditReversals = linkedNotes.filter(n => n.is_credit_note && n.status !== 'CANCELLED').reduce((sum, n) => sum + Number(n.total), 0)
  const debitSurcharges = linkedNotes.filter(n => n.is_debit_note && n.status !== 'CANCELLED').reduce((sum, n) => sum + Number(n.total), 0)
  const netInvoiceTotal = Math.max(0, Number(invoice.total) + debitSurcharges - creditReversals)
  const isFullyCredited = creditReversals >= Number(invoice.total) && Number(invoice.total) > 0

  const balance = (invoice.status === 'CANCELLED' || invoice.is_credit_note || isFullyCredited)
    ? 0
    : Math.max(0, netInvoiceTotal - Number(invoice.amount_paid || 0))

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

  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [auditLogsLoading, setAuditLogsLoading] = useState(false)
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false)
  const [noteType, setNoteType] = useState<'CREDIT_NOTE' | 'DEBIT_NOTE'>('CREDIT_NOTE')
  const [creditNoteReason, setCreditNoteReason] = useState('')
  const [creditNoteLoading, setCreditNoteLoading] = useState(false)
  const [creditNoteError, setCreditNoteError] = useState('')
  const [noteAmountMode, setNoteAmountMode] = useState<'FULL' | 'REMAINING' | 'CUSTOM'>('FULL')
  const [noteCustomAmount, setNoteCustomAmount] = useState('')

  // Load audit logs on mount
  useState(() => {
    async function fetchLogs() {
      setAuditLogsLoading(true)
      const { data } = await supabase
        .from('invoice_audit_logs')
        .select('*, performer:profiles(name, email)')
        .eq('invoice_id', invoice.id)
        .order('created_at', { ascending: false })
      if (data) setAuditLogs(data)
      setAuditLogsLoading(false)
    }
    fetchLogs()
  })

  async function updateStatus(newStatus: string) {
    if (invoice.status !== 'DRAFT' && newStatus === 'DRAFT') {
      alert('ZATCA Compliance: Once an invoice is issued, it cannot be reverted to draft. To reverse or adjust an issued invoice, please issue a Credit Note.')
      return
    }
    setUpdatingStatus(true)
    const { error: updErr } = await supabase.from('invoices').update({ status: newStatus }).eq('id', invoice.id)
    if (updErr) {
      alert('Failed to update status: ' + updErr.message)
      setUpdatingStatus(false)
      return
    }

    // Record audit log
    try {
      await supabase.from('invoice_audit_logs').insert({
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        action: 'STATUS_CHANGED',
        performed_by: profile.id,
        previous_state: { status: invoice.status },
        new_state: { status: newStatus },
      })
      const { data: updatedLogs } = await supabase
        .from('invoice_audit_logs')
        .select('*, performer:profiles(name, email)')
        .eq('invoice_id', invoice.id)
        .order('created_at', { ascending: false })
      if (updatedLogs) setAuditLogs(updatedLogs)
    } catch (e) {
      console.warn('Audit log write error:', e)
    }

    setInvoice({ ...invoice, status: newStatus as any })
    setUpdatingStatus(false)
  }

  async function handleIssueNote() {
    if (!creditNoteReason.trim()) {
      setCreditNoteError(`Please provide a reason for issuing this ${noteType === 'DEBIT_NOTE' ? 'Debit' : 'Credit'} Note as required by ZATCA.`)
      return
    }

    const isCN = noteType === 'CREDIT_NOTE'
    const isDN = noteType === 'DEBIT_NOTE'
    const remainingAmount = Math.max(0, Number(invoice.total) - Number(invoice.amount_paid || 0))

    let targetTotal = Number(invoice.total)
    if (noteAmountMode === 'REMAINING') {
      targetTotal = remainingAmount
    } else if (noteAmountMode === 'CUSTOM') {
      targetTotal = parseFloat(noteCustomAmount) || 0
    }

    if (targetTotal <= 0) {
      setCreditNoteError('Please specify a valid note amount greater than 0.')
      return
    }

    setCreditNoteLoading(true)
    setCreditNoteError('')

    const taxPercent = Number(invoice.tax_percent) || 15
    const taxMultiplier = 1 + (taxPercent / 100)

    let noteSubtotal = Number(invoice.subtotal) || 0
    let noteTaxAmount = Number(invoice.tax_amount) || 0
    let noteFinalTotal = Number(invoice.total) || 0
    let noteItems: any[] = []

    if (noteAmountMode === 'FULL') {
      noteSubtotal = Number(invoice.subtotal) || 0
      noteTaxAmount = Number(invoice.tax_amount) || 0
      noteFinalTotal = Number(invoice.total) || 0
      noteItems = (invoice.items || []).map((i: any) => ({
        description: `${isCN ? '[Credit Reversal]' : '[Debit Surcharge]'} ${i.description}`,
        qty: i.qty,
        unit_price: i.unit_price,
        discount_percent: i.discount_percent,
        amount: i.amount,
      }))
    } else {
      // Proportional calculation for partial / remaining write-offs
      noteFinalTotal = Math.round(targetTotal * 100) / 100
      noteSubtotal = Math.round((noteFinalTotal / taxMultiplier) * 100) / 100
      noteTaxAmount = Math.round((noteFinalTotal - noteSubtotal) * 100) / 100
      noteItems = [{
        description: `${isCN ? '[Credit Reversal]' : '[Debit Surcharge]'} ${creditNoteReason.trim()}`,
        qty: 1,
        unit_price: noteSubtotal,
        discount_percent: 0,
        amount: noteSubtotal,
      }]
    }

    try {
      const res = await fetch('/api/invoices/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: invoice.client_id,
          officeLocation: invoice.office_location,
          invoiceType: invoice.invoice_type,
          currency: invoice.currency,
          issueDate: new Date().toISOString().slice(0, 10),
          subtotal: noteSubtotal,
          discountType: invoice.discount_type,
          discountValue: 0,
          discountAmount: 0,
          taxPercent: taxPercent,
          taxAmount: noteTaxAmount,
          total: noteFinalTotal,
          status: 'SENT',
          notes: `${isCN ? 'Credit Note' : 'Debit Note'} issued against Invoice #${invoice.invoice_number}. Reason: ${creditNoteReason.trim()}`,
          terms: invoice.terms,
          bankName: invoice.bank_name,
          bankAccountName: invoice.bank_account_name,
          bankAccountNumber: invoice.bank_account_number,
          bankIban: invoice.bank_iban,
          bankSwift: invoice.bank_swift,
          bankIfsc: invoice.bank_ifsc,
          items: noteItems,
          isCreditNote: isCN,
          isDebitNote: isDN,
          referenceInvoiceId: invoice.id,
          referenceInvoiceNumber: invoice.invoice_number,
          creditDebitReason: creditNoteReason.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to issue adjustment note')
      }

      // If full cancellation, mark invoice as CANCELLED
      if (isCN && (noteAmountMode === 'FULL' || creditNoteReason.includes('Cancellation'))) {
        await supabase.from('invoices').update({ status: 'CANCELLED' }).eq('id', invoice.id)
      } else if (isCN && noteAmountMode === 'REMAINING') {
        // If remaining balance was written off, the invoice is settled
        await supabase.from('invoices').update({ status: 'PAID' }).eq('id', invoice.id)
      }

      setShowCreditNoteModal(false)
      router.push(`/invoices/${data.invoice.id}`)
    } catch (err: any) {
      setCreditNoteError(err.message || 'Failed to create adjustment note')
      setCreditNoteLoading(false)
    }
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

              {/* DRAFT ONLY: Allow Edit and Delete (Standard Invoices Only) */}
              {invoice.status === 'DRAFT' && !invoice.is_credit_note && !invoice.is_debit_note && (
                <>
                  <Link href={`/invoices/${invoice.id}/edit`} className="btn btn-outline btn-sm">
                    <Edit2 size={14} />
                    Edit invoice
                  </Link>
                  <button className="btn btn-primary btn-sm" onClick={() => updateStatus('SENT')} disabled={updatingStatus}>
                    <Send size={14} />
                    Issue / Mark as sent
                  </button>
                  {['ADMIN', 'ACCOUNT_MANAGER', 'AGENT'].includes(profile.role) && (
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={openDeleteInvoiceModal} disabled={saving}>
                      <Trash2 size={14} />
                      Delete draft
                    </button>
                  )}
                </>
              )}

              {/* CREDIT NOTE OR DEBIT NOTE VIEW: Clean read-only state */}
              {(Boolean(invoice.is_credit_note) || Boolean(invoice.is_debit_note)) && (
                <span className="badge badge-warning" style={{ fontSize: 12, padding: '4px 8px' }}>
                  {invoice.is_debit_note ? 'Official Debit Note' : 'Official Credit Note'} (Ref #{invoice.reference_invoice_number || 'Linked'})
                </span>
              )}

              {/* ISSUED STANDARD INVOICES: Credit/Debit Note, Payment, and Cancellation */}
              {invoice.status !== 'DRAFT' && !invoice.is_credit_note && !invoice.is_debit_note && (
                <>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ borderColor: '#d97706', color: '#b45309', background: '#fffbeb' }}
                    onClick={() => {
                      setNoteType('CREDIT_NOTE')
                      setCreditNoteReason('')
                      setCreditNoteError('')
                      setShowCreditNoteModal(true)
                    }}
                    title="Issue a ZATCA-compliant Credit or Debit Note against this invoice"
                  >
                    <RotateCcw size={14} />
                    Issue Note / إشعار دائن أو مدين
                  </button>

                  {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
                    <button className="btn btn-primary btn-sm" onClick={openPaymentForm}>
                      <Plus size={14} />
                      Record payment
                    </button>
                  )}

                  {invoice.status !== 'CANCELLED' && (
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                      onClick={() => {
                        if (confirm(`Are you sure you want to mark Invoice ${invoice.invoice_number} as CANCELLED? (Note: Under ZATCA, an official Credit Note is the recommended way to reverse an invoice for tax records).`)) {
                          updateStatus('CANCELLED')
                        }
                      }}
                      disabled={updatingStatus}
                    >
                      <XCircle size={14} />
                      Cancel invoice
                    </button>
                  )}
                </>
              )}

              <button className="btn btn-outline btn-sm" onClick={handlePrint}>
                <Printer size={14} />
                Print / PDF
              </button>
            </>
          )}
        </div>
      </div>


      <div className="page-body">
        {/* OFFICIAL STRUCTURED ZATCA TAX INVOICE TEMPLATE (ON-SCREEN & PRINT) */}
        <StandardTaxInvoiceTemplate
          invoice={invoice}
          officeLocation={officeLocation}
          showCr={showCr}
        />

        {/* ADMIN CONTROLS, PAYMENT HISTORY, & ACTIONS (NO-PRINT) */}
        <div className="no-print" style={{ maxWidth: 880, margin: '20px auto 0' }}>
          {/* Linked Adjustment Notes (Credit & Debit Notes) */}
          {linkedNotes.length > 0 && (
            <div className="card" style={{ marginBottom: 16, background: '#fffbeb', borderColor: '#fde68a' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-section-header" style={{ color: '#b45309' }}>
                  Linked Adjustment Notes · الإشعارات الدائنة والمدينة المرتبطة
                </span>
                <span className="badge badge-warning" style={{ fontSize: 11 }}>
                  {linkedNotes.length} Linked Document{linkedNotes.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table table-compact">
                  <thead>
                    <tr>
                      <th>Document #</th>
                      <th>Type</th>
                      <th>Reason / سبب الإصدار</th>
                      <th>Date</th>
                      <th className="num">Adjustment Amount</th>
                      <th style={{ width: 60 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedNotes.map((note) => (
                      <tr key={note.id}>
                        <td style={{ fontWeight: 600 }}>{note.invoice_number}</td>
                        <td>
                          <span className={`badge ${note.is_credit_note ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: 11 }}>
                            {note.is_credit_note ? 'CREDIT NOTE' : 'DEBIT NOTE'}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{note.credit_debit_reason || '—'}</td>
                        <td style={{ fontSize: 12 }}>{format(new Date(note.issue_date), 'dd MMM yyyy')}</td>
                        <td className="num tabular-nums" style={{ fontWeight: 700, color: note.is_credit_note ? '#b45309' : '#6d28d9' }}>
                          {note.is_credit_note ? `- ${curr} ` : `+ ${curr} `}{Number(note.total).toLocaleString('en', { minimumFractionDigits: 2 })}
                        </td>
                        <td>
                          <Link href={`/invoices/${note.id}`} className="btn btn-ghost btn-xs">
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '10px 16px', background: '#fef3c7', borderTop: '1px solid #fde68a', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <span><strong>Net Collectible Amount:</strong> {curr} {netInvoiceTotal.toLocaleString('en', { minimumFractionDigits: 2 })}</span>
                <span><strong>Net Outstanding Balance:</strong> <strong style={{ color: balance > 0 ? 'var(--danger)' : 'var(--success)', fontSize: 14 }}>{curr} {balance.toLocaleString('en', { minimumFractionDigits: 2 })}</strong></span>
              </div>
            </div>
          )}

          {/* Payment History (Only for standard invoices) */}
          {!invoice.is_credit_note && payments.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-section-header">Payment History · سجل الدفعات</span>
                <span className="badge badge-success" style={{ fontSize: 11 }}>
                  Total Paid: {curr} {Number(invoice.amount_paid).toLocaleString('en', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table table-compact">
                  <thead>
                    <tr>
                      <th>Date / التاريخ</th>
                      <th>Method / طريقة الدفع</th>
                      <th>Reference / المرجع</th>
                      <th className="num">Amount / المبلغ</th>
                      <th style={{ width: 80 }}></th>
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
                        <td>
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

          {/* Record payment form */}
          {showPaymentForm && (
            <div className="card" ref={paymentFormRef} style={{ marginBottom: 16 }}>
              <div className="card-header">
                <span className="text-section-header">{editingPaymentId ? 'Edit Payment Record' : 'Record New Payment'}</span>
              </div>
              <div className="card-body">
                <form onSubmit={recordOrUpdatePayment} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {payError && (
                    <div className="alert alert-danger" style={{ padding: '8px 12px', fontSize: 13 }}>
                      {payError}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                      <label className="form-label">Payment Method</label>
                      <select className="form-input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>{m.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Payment Date</label>
                      <input type="date" className="form-input" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Reference / Bank Transaction ID</label>
                      <input className="form-input" placeholder="Transaction note or check reference" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowPaymentForm(false); setEditingPaymentId(null); setPayError('') }}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                      <CheckCircle size={13} />
                      {saving ? 'Saving...' : editingPaymentId ? 'Update Payment' : 'Record Payment'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Audit Trail & Compliance Activity Card */}
          <div className="card" style={{ marginTop: 16, marginBottom: 24 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="flex items-center gap-2">
                <span className="text-section-header">Audit Trail &amp; Compliance Logs · سجل التدقيق والامتثال</span>
                <span className="badge badge-default" style={{ fontSize: 10 }}>Immutable Phase 1 Log</span>
              </div>
              <span className="text-meta" style={{ fontSize: 12 }}>
                {auditLogs.length} event{auditLogs.length !== 1 ? 's' : ''} recorded
              </span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {auditLogs.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                  No historical audit events logged yet. (System compliance logging active)
                </div>
              ) : (
                <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="table table-compact">
                    <thead>
                      <tr>
                        <th style={{ width: 180 }}>Timestamp (UTC) / الوقت</th>
                        <th style={{ width: 140 }}>Action / الحدث</th>
                        <th style={{ width: 160 }}>User / المستخدم</th>
                        <th>Activity Summary / تفاصيل النشاط</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => {
                        const { action, previous_state, new_state } = log
                        return (
                          <tr key={log.id}>
                            <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              {format(new Date(log.created_at), 'dd MMM yyyy · HH:mm:ss')}
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  log.action === 'CREDIT_NOTE_ISSUED'
                                    ? 'badge-warning'
                                    : log.action === 'CREATED'
                                    ? 'badge-info'
                                    : log.action === 'DRAFT_EDITED'
                                    ? 'badge-default'
                                    : log.action === 'STATUS_CHANGED'
                                    ? 'badge-default'
                                    : 'badge-success'
                                }`}
                                style={{ fontSize: 11 }}
                              >
                                {log.action.replace('_', ' ')}
                              </span>
                            </td>
                            <td style={{ fontSize: 13, fontWeight: 500 }}>
                              {log.performer?.name || log.performer?.email || 'System / Automated'}
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                              {action === 'STATUS_CHANGED' ? (
                                <span>
                                  Status transition: <strong style={{ color: 'var(--text-secondary)' }}>{previous_state?.status || '—'}</strong> → <strong style={{ color: 'var(--accent)' }}>{new_state?.status || '—'}</strong>
                                </span>
                              ) : action === 'CREATED' ? (
                                <span>
                                  Created document with initial total: <strong>{curr} {Number(new_state?.total || 0).toLocaleString('en', { minimumFractionDigits: 2 })}</strong> · Status: <strong>{new_state?.status || 'DRAFT'}</strong>
                                </span>
                              ) : action === 'DRAFT_EDITED' ? (
                                <span>
                                  Draft modified: Total <strong>{curr} {Number(new_state?.total || 0).toLocaleString('en', { minimumFractionDigits: 2 })}</strong> ({new_state?.items_count ?? 1} item{new_state?.items_count !== 1 ? 's' : ''})
                                </span>
                              ) : action === 'CREDIT_NOTE_ISSUED' ? (
                                <span>
                                  Credit Note issued for <strong>{curr} {Number(new_state?.total || 0).toLocaleString('en', { minimumFractionDigits: 2 })}</strong>
                                </span>
                              ) : action === 'PAYMENT_RECORDED' ? (
                                <span>
                                  Payment of <strong>{curr} {Number(new_state?.amount || 0).toLocaleString('en', { minimumFractionDigits: 2 })}</strong> recorded
                                </span>
                              ) : new_state ? (
                                <span>
                                  {Object.entries(new_state).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                                </span>
                              ) : (
                                '—'
                              )}
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
        </div>
      </div>

      {/* Credit & Debit Note Issuance Modal Overlay */}
      {showCreditNoteModal && (
        <div className="modal-backdrop" onClick={() => !creditNoteLoading && setShowCreditNoteModal(false)}>
          <div className="modal-box" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 8, borderRadius: 8, background: '#fffbeb', color: '#b45309' }}>
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className="modal-title">
                    {noteType === 'CREDIT_NOTE' ? 'Issue Credit Note · إنشاء إشعار دائن' : 'Issue Debit Note · إنشاء إشعار مدين'}
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Linked to Invoice #{invoice.invoice_number}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setShowCreditNoteModal(false)}
                disabled={creditNoteLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {creditNoteError && (
                <div className="alert alert-danger" style={{ padding: '8px 12px', fontSize: 13 }}>
                  {creditNoteError}
                </div>
              )}

              {/* Note Type Selector */}
              <div className="form-group">
                <label className="form-label">Note Type / نوع الإشعار</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${noteType === 'CREDIT_NOTE' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setNoteType('CREDIT_NOTE')}
                  >
                    Credit Note (إشعار دائن)
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${noteType === 'DEBIT_NOTE' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setNoteType('DEBIT_NOTE')}
                  >
                    Debit Note (إشعار مدين)
                  </button>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>
                  {noteType === 'CREDIT_NOTE'
                    ? '📉 Credit Note: Used to reduce amount, cancel invoice, or give discounts.'
                    : '📈 Debit Note: Used to bill additional charges or increase invoice amount.'}
                </span>
              </div>

              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Original Invoice Total:</span>
                  <span style={{ fontWeight: 600 }}>{curr} {Number(invoice.total).toLocaleString('en', { minimumFractionDigits: 2 })}</span>
                </div>
                {Number(invoice.amount_paid) > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                      <span>Amount Collected / Received:</span>
                      <span style={{ fontWeight: 600 }}>{curr} {Number(invoice.amount_paid).toLocaleString('en', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b45309', borderTop: '1px dashed var(--border-color)', paddingTop: 4 }}>
                      <span style={{ fontWeight: 500 }}>Remaining Unpaid Balance:</span>
                      <span style={{ fontWeight: 700 }}>{curr} {Math.max(0, Number(invoice.total) - Number(invoice.amount_paid)).toLocaleString('en', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: 4 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Client / Buyer:</span>
                  <span style={{ fontWeight: 500 }}>{invoice.client?.company || invoice.client?.name}</span>
                </div>
              </div>

              {/* Amount Selection for Note */}
              <div className="form-group">
                <label className="form-label">{noteType === 'CREDIT_NOTE' ? 'Credit Note Value / قيمة الإشعار الدائن' : 'Debit Surcharge Amount / قيمة الإشعار المدين'}</label>
                {noteType === 'CREDIT_NOTE' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: Number(invoice.amount_paid) > 0 ? '1fr 1fr 1fr' : '1fr 1fr', gap: 6 }}>
                      <button
                        type="button"
                        className={`btn btn-xs ${noteAmountMode === 'FULL' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setNoteAmountMode('FULL')}
                      >
                        Full Total ({curr} {Number(invoice.total).toLocaleString('en', { minimumFractionDigits: 0 })})
                      </button>
                      {Number(invoice.amount_paid) > 0 && (
                        <button
                          type="button"
                          className={`btn btn-xs ${noteAmountMode === 'REMAINING' ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => setNoteAmountMode('REMAINING')}
                        >
                          Unpaid ({curr} {Math.max(0, Number(invoice.total) - Number(invoice.amount_paid)).toLocaleString('en', { minimumFractionDigits: 0 })})
                        </button>
                      )}
                      <button
                        type="button"
                        className={`btn btn-xs ${noteAmountMode === 'CUSTOM' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setNoteAmountMode('CUSTOM')}
                      >
                        Custom Amount
                      </button>
                    </div>

                    {noteAmountMode === 'CUSTOM' && (
                      <div className="input-group" style={{ marginTop: 4 }}>
                        <span className="input-prefix">{curr}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="form-input"
                          placeholder="Enter custom credit amount..."
                          value={noteCustomAmount}
                          onChange={(e) => setNoteCustomAmount(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="input-group">
                    <span className="input-prefix">{curr}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-input"
                      placeholder="Enter additional surcharge amount..."
                      value={noteCustomAmount}
                      onChange={(e) => {
                        setNoteAmountMode('CUSTOM')
                        setNoteCustomAmount(e.target.value)
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label form-label-required">
                  Reason for {noteType === 'DEBIT_NOTE' ? 'Debit' : 'Credit'} Note / سبب إصدار الإشعار
                </label>
                <select
                  className="form-input"
                  value={creditNoteReason}
                  onChange={(e) => {
                    const r = e.target.value
                    setCreditNoteReason(r)
                    if (r === 'Uncollectible Debt / Partial Write-off' && Number(invoice.amount_paid) > 0) {
                      setNoteAmountMode('REMAINING')
                    }
                  }}
                  style={{ marginBottom: 8 }}
                >
                  <option value="">Select reason...</option>
                  {noteType === 'CREDIT_NOTE' ? (
                    <>
                      <option value="Full Invoice Cancellation / Reversal (إلغاء الفاتورة بالكامل)">Full Invoice Cancellation / Reversal</option>
                      <option value="Goods / Services Return (إرجاع بضائع أو خدمات)">Goods / Services Return</option>
                      <option value="Post-Issuance Commercial Discount (خصم تجاري بعد إصدار الفاتورة)">Post-Issuance Commercial Discount</option>
                      <option value="Price / Computation Correction (تصحيح خطأ حسابي أو في التسعير)">Price / Computation Correction</option>
                      <option value="Uncollectible Debt / Partial Write-off (شطب رصيد غير محصل)">Uncollectible Debt / Partial Write-off</option>
                      <option value="Customer Billing Dispute (نزاع فواتير)">Customer Billing Dispute</option>
                    </>
                  ) : (
                    <>
                      <option value="Additional Services Rendered (خدمات إضافية تم تقديمها)">Additional Services Rendered</option>
                      <option value="Price Adjustment / Increase (تعديل السعر بالزيادة)">Price Adjustment / Increase</option>
                      <option value="Scope Extension Surcharge (رسوم توسيع نطاق العمل)">Scope Extension Surcharge</option>
                    </>
                  )}
                </select>

                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Provide additional justification notes (mandatory for ZATCA audit trail)..."
                  value={creditNoteReason}
                  onChange={(e) => setCreditNoteReason(e.target.value)}
                />
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                ℹ️ In accordance with ZATCA regulations, this will generate a sequential electronic {noteType === 'DEBIT_NOTE' ? 'Debit' : 'Credit'} Note referencing invoice <strong>{invoice.invoice_number}</strong> with cryptographic TLV QR code.
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowCreditNoteModal(false)}
                disabled={creditNoteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleIssueNote}
                disabled={creditNoteLoading || !creditNoteReason.trim()}
                title="Confirm and issue official ZATCA-compliant note"
              >
                {creditNoteLoading ? 'Issuing Note...' : `Confirm & Issue ${noteType === 'DEBIT_NOTE' ? 'Debit Note' : 'Credit Note'}`}
              </button>
            </div>
          </div>
        </div>
      )}

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
