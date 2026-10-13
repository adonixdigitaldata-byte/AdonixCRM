'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ArrowLeft, FileText, Send, CheckCircle, Printer, Edit2, Trash2, AlertTriangle, X } from 'lucide-react'
import type { Quotation, Profile, QuotationStatus } from '@/types/database'
import Link from 'next/link'

import { OFFICE_LOCATIONS, type OfficeLocationKey } from '@/lib/constants/officeLocations'
import StandardQuotationTemplate from '@/components/quotations/StandardQuotationTemplate'

interface Props {
  quotation: Quotation & { client: any; items: any[] }
  profile: Profile
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-default', SENT: 'badge-info', ACCEPTED: 'badge-success',
  REJECTED: 'badge-danger', EXPIRED: 'badge-warning',
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
}

const STATUS_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: ['SENT', 'ACCEPTED'],
  SENT: ['ACCEPTED', 'REJECTED', 'EXPIRED'],
  ACCEPTED: [],
  REJECTED: ['DRAFT', 'SENT', 'ACCEPTED'],
  EXPIRED: ['DRAFT', 'SENT'],
}

export default function QuotationDetailClient({ quotation: initial, profile }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [quotation, setQuotation] = useState(initial)
  const [updating, setUpdating] = useState(false)
  const [officeLocation, setOfficeLocation] = useState<OfficeLocationKey>(
    (initial.office_location as OfficeLocationKey) || 'KSA'
  )

  // Delete Quotation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const curr = quotation.currency ?? 'SAR'

  const isExpired = (() => {
    if (quotation.status === 'ACCEPTED' || quotation.status === 'REJECTED') {
      return false
    }
    if (quotation.status === 'EXPIRED') return true
    if (quotation.valid_until) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const validUntil = new Date(quotation.valid_until)
      validUntil.setHours(0, 0, 0, 0)
      return today > validUntil
    }
    return false
  })()

  const displayStatus = isExpired ? 'EXPIRED' : quotation.status

  function handlePrint() {
    const originalTitle = document.title
    const clientName = quotation.client?.name || quotation.client?.company
    const printTitle = clientName ? `Quotation — Adonix for ${clientName}` : `Quotation — Adonix ${quotation.quote_number}`
    document.title = printTitle
    window.print()
    setTimeout(() => {
      document.title = originalTitle
    }, 1000)
  }

  async function updateStatus(newStatus: QuotationStatus) {
    setUpdating(true)
    await supabase.from('quotations').update({ status: newStatus }).eq('id', quotation.id)
    setQuotation({ ...quotation, status: newStatus })
    setUpdating(false)
  }

  function openDeleteModal() {
    setDeleteError('')
    setShowDeleteModal(true)
  }

  async function confirmDeleteQuotation() {
    setDeleteLoading(true)
    setDeleteError('')
    try {
      const res = await fetch('/api/quotations/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotationId: quotation.id }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        router.push('/quotations')
      } else {
        setDeleteError(data.error || 'Failed to delete quotation')
        setDeleteLoading(false)
      }
    } catch (err) {
      setDeleteError('Error deleting quotation')
      setDeleteLoading(false)
    }
  }

  const DEFAULT_INVOICE_TERMS = `1. Payment due upon receipt or as specified above.\n2. Payment via bank transfer or cheque.\n3. Tax: 15% VAT applicable as per KSA tax regulations.`

  async function convertToInvoice() {
    setUpdating(true)
    try {
      const isClientB2B = Boolean(quotation.client?.vat_number || quotation.client?.cr_number)
      const res = await fetch('/api/invoices/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: quotation.client_id,
          officeLocation: officeLocation || quotation.office_location || 'KSA',
          invoiceType: isClientB2B ? 'B2B' : 'B2C',
          currency: curr,
          issueDate: new Date().toISOString().slice(0, 10),
          dueDate: quotation.valid_until || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
          subtotal: Number(quotation.subtotal) || 0,
          discountType: quotation.discount_type || 'PERCENTAGE',
          discountValue: Number(quotation.discount_value) || 0,
          discountAmount: Number(quotation.discount_amount) || 0,
          taxPercent: Number(quotation.tax_percent) ?? 15,
          taxAmount: Number(quotation.tax_amount) || 0,
          total: Number(quotation.total) || 0,
          status: 'DRAFT',
          notes: quotation.notes || null,
          terms: DEFAULT_INVOICE_TERMS,
          bankName: quotation.bank_name || null,
          bankAccountName: quotation.bank_account_name || null,
          bankAccountNumber: quotation.bank_account_number || null,
          bankIban: quotation.bank_iban || null,
          bankSwift: quotation.bank_swift || null,
          bankIfsc: quotation.bank_ifsc || null,
          items: (quotation.items || []).map((item: any) => ({
            description: item.description,
            qty: item.qty,
            unit_price: item.unit_price,
            discount_percent: item.discount_percent || 0,
            amount: item.amount,
          })),
          quotationId: quotation.id,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success && data.invoice) {
        router.push(`/invoices/${data.invoice.id}`)
      } else {
        alert(data.error || 'Failed to convert quotation to invoice')
        setUpdating(false)
      }
    } catch (err: any) {
      alert(err?.message || 'Error converting quotation to invoice')
      setUpdating(false)
    }
  }

  const nextStatuses = STATUS_TRANSITIONS[quotation.status as QuotationStatus] ?? []

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => router.push(profile.role === 'CLIENT' ? '/portal?section=finance' : '/quotations')}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-page-title">{quotation.quote_number}</h1>
            <p className="text-meta" style={{ marginTop: 2 }}>
              Issued {format(new Date(quotation.issue_date), 'dd MMM yyyy')}
            </p>
          </div>
          <span className={`badge ${STATUS_BADGE[displayStatus] ?? 'badge-default'}`}>
            {STATUS_LABELS[displayStatus] ?? displayStatus}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, marginRight: 8 }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Office:</span>
            <select
              className="form-select"
              value={officeLocation}
              onChange={(e) => {
                const newLoc = e.target.value as OfficeLocationKey
                setOfficeLocation(newLoc)
                supabase.from('quotations').update({ office_location: newLoc }).eq('id', quotation.id).then()
              }}
              style={{ padding: '3px 8px', fontSize: 12, height: 30, cursor: 'pointer', borderRadius: 6 }}
            >
              <option value="KSA">🇸🇦 Saudi Arabia (Riyadh &amp; Jeddah)</option>
              <option value="HYDERABAD">🇮🇳 India (Hyderabad)</option>
            </select>
          </div>

          <Link href={`/quotations/${quotation.id}/edit`} className="btn btn-outline btn-sm">
            <Edit2 size={14} />
            Edit quotation
          </Link>
          <button className="btn btn-outline btn-sm" onClick={handlePrint}>
            <Printer size={14} />
            Print / PDF
          </button>
          {quotation.status === 'ACCEPTED' && (
            <button className="btn btn-primary btn-sm" onClick={convertToInvoice} disabled={updating}>
              <FileText size={14} />
              Convert to invoice
            </button>
          )}
          {['ADMIN', 'ACCOUNT_MANAGER', 'AGENT'].includes(profile.role) && (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={openDeleteModal} disabled={updating}>
              <Trash2 size={14} />
              Delete
            </button>
          )}
          {nextStatuses.map((status) => (
            <button
              key={status}
              className={`btn btn-sm ${status === 'ACCEPTED' ? 'btn-primary' : status === 'REJECTED' ? 'btn-danger' : 'btn-outline'}`}
              onClick={() => updateStatus(status)}
              disabled={updating}
            >
              {status === 'SENT' && <Send size={14} />}
              {status === 'ACCEPTED' && <CheckCircle size={14} />}
              Mark as {status.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body">
        <StandardQuotationTemplate
          quotation={quotation}
          officeLocation={officeLocation}
        />
      </div>

      {showDeleteModal && (
        <div className="modal-backdrop" onClick={() => !deleteLoading && setShowDeleteModal(false)}>
          <div className="modal-box" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 8, borderRadius: 8, background: '#fef2f2', color: 'var(--danger)' }}>
                  <AlertTriangle size={20} />
                </div>
                <h3 className="modal-title">Delete Quotation</h3>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px 20px' }}>
              {deleteError && (
                <div className="alert alert-danger" style={{ marginBottom: 12, padding: '8px 12px', fontSize: 13 }}>
                  {deleteError}
                </div>
              )}
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Are you sure you want to delete quotation <strong style={{ color: 'var(--text-primary)' }}>{quotation.quote_number}</strong>?
                This action cannot be undone.
              </p>
            </div>

            <div className="modal-footer" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={confirmDeleteQuotation}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Delete quotation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
