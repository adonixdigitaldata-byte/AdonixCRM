'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ArrowLeft, FileText, Send, CheckCircle, Printer, Edit2, Trash2, AlertTriangle, X, MapPin, Phone, Globe } from 'lucide-react'
import type { Quotation, Profile, QuotationStatus } from '@/types/database'
import Link from 'next/link'

import { OFFICE_LOCATIONS, type OfficeLocationKey } from '@/lib/constants/officeLocations'

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

function renderFormattedText(text: string) {
  if (!text) return null
  return text.split('\n').map((line, index) => {
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

export default function QuotationDetailClient({ quotation: initial, profile }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [quotation, setQuotation] = useState(initial)
  const [updating, setUpdating] = useState(false)
  const [showCr, setShowCr] = useState(true)
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
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`
    const { data: invoice } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber,
      quotation_id: quotation.id,
      client_id: quotation.client_id,
      lead_id: quotation.lead_id,
      currency: curr,
      issue_date: new Date().toISOString().slice(0, 10),
      subtotal: quotation.subtotal,
      discount_type: quotation.discount_type || 'PERCENTAGE',
      discount_value: quotation.discount_value || 0,
      discount_amount: quotation.discount_amount || 0,
      tax_percent: quotation.tax_percent,
      tax_amount: quotation.tax_amount,
      total: quotation.total,
      notes: quotation.notes || null,
      terms: DEFAULT_INVOICE_TERMS,
      created_by: profile.id,
    }).select('id').single()

    if (invoice && quotation.items) {
      await supabase.from('invoice_items').insert(
        quotation.items.map((item: any, idx: number) => ({
          invoice_id: invoice.id,
          description: item.description,
          qty: item.qty,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent || 0,
          amount: item.amount,
          sort_order: idx,
        }))
      )
    }

    setUpdating(false)
    if (invoice) router.push(`/invoices/${invoice.id}`)
  }

  const nextStatuses = STATUS_TRANSITIONS[quotation.status as QuotationStatus] ?? []
  const hasItemDiscounts = (quotation.items ?? []).some((i: any) => Number(i.discount_percent) > 0)
  const hasOverallDiscount = Number(quotation.discount_amount) > 0
  const colSpan = hasItemDiscounts ? 4 : 3

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
        {/* Document Banner with Company Logo & Brand Details */}
        {(() => {
          const currentOffice = OFFICE_LOCATIONS[officeLocation] || OFFICE_LOCATIONS.KSA
          return (
            <div className="card doc-banner-card" style={{ padding: '16px 20px', marginBottom: 20, maxWidth: 900, width: '100%', boxSizing: 'border-box' }}>
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
                    <p className="text-meta" style={{ margin: 0 }}>Commercial Quotation</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{quotation.quote_number}</span>
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

          {/* Left Column: Client & Line Items */}
          <div>
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-header">
                <span className="text-section-header">Bill to</span>
              </div>
              <div className="card-body">
                <div style={{ fontWeight: 600 }}>{quotation.client?.name}</div>
                {quotation.client?.company && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{quotation.client.company}</div>
                )}
                {quotation.client?.email && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{quotation.client.email}</div>
                )}
                {quotation.client?.phone && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{quotation.client.phone}</div>
                )}
                {quotation.client?.address && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, whiteSpace: 'pre-line' }}>{quotation.client.address}</div>
                )}
              </div>
            </div>

            <div className="card card-allow-break" style={{ marginBottom: 12 }}>
              <div className="card-header">
                <span className="text-section-header">Line items</span>
              </div>
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
                    {(quotation.items ?? []).map((item: any) => (
                      <tr key={item.id}>
                        <td>{item.description}</td>
                        <td className="num tabular-nums">{item.qty}</td>
                        <td className="num tabular-nums">{curr} {Number(item.unit_price).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                        {hasItemDiscounts && (
                          <td className="num tabular-nums" style={{ color: Number(item.discount_percent) > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>
                            {Number(item.discount_percent) > 0 ? `${item.discount_percent}%` : '—'}
                          </td>
                        )}
                        <td className="num tabular-nums" style={{ fontWeight: 500 }}>{curr} {Number(item.amount).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)' }}>
                      <td colSpan={colSpan} style={{ textAlign: 'right', fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>Subtotal</td>
                      <td className="num tabular-nums" style={{ fontWeight: 600 }}>{curr} {Number(quotation.subtotal).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    {hasOverallDiscount && (
                      <tr>
                        <td colSpan={colSpan} style={{ textAlign: 'right', fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>
                          Discount {quotation.discount_type === 'PERCENTAGE' ? `(${quotation.discount_value}%)` : ''}
                        </td>
                        <td className="num tabular-nums" style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                          - {curr} {Number(quotation.discount_amount).toLocaleString('en', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}
                    {hasOverallDiscount && (
                      <tr>
                        <td colSpan={colSpan} style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>Taxable Subtotal</td>
                        <td className="num tabular-nums" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {curr} {Number(quotation.subtotal - (quotation.discount_amount || 0)).toLocaleString('en', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={colSpan} style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>VAT ({quotation.tax_percent}%)</td>
                      <td className="num tabular-nums" style={{ fontSize: 13 }}>{curr} {Number(quotation.tax_amount).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr style={{ borderTop: '1px solid var(--border)' }}>
                      <td colSpan={colSpan} style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>Total</td>
                      <td className="num tabular-nums" style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{curr} {Number(quotation.total).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Summary, Details & Authorized Signature */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card">
              <div className="card-header"><span className="text-section-header">Summary</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="flex justify-between">
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Subtotal</span>
                  <span className="tabular-nums" style={{ fontSize: 13 }}>
                    {curr} {Number(quotation.subtotal).toLocaleString('en', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {hasOverallDiscount && (
                  <div className="flex justify-between" style={{ color: 'var(--success)' }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                      Discount {quotation.discount_type === 'PERCENTAGE' ? `(${quotation.discount_value}%)` : ''}
                    </span>
                    <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600 }}>
                      - {curr} {Number(quotation.discount_amount).toLocaleString('en', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {hasOverallDiscount && (
                  <div className="flex justify-between">
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Taxable Subtotal</span>
                    <span className="tabular-nums" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {curr} {Number(quotation.subtotal - (quotation.discount_amount || 0)).toLocaleString('en', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>VAT ({quotation.tax_percent}%)</span>
                  <span className="tabular-nums" style={{ fontSize: 13 }}>
                    {curr} {Number(quotation.tax_amount).toLocaleString('en', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="divider" style={{ margin: '4px 0' }} />
                <div className="flex justify-between">
                  <span style={{ fontWeight: 600 }}>Total</span>
                  <span className="tabular-nums" style={{ fontSize: 16, fontWeight: 700 }}>
                    {curr} {Number(quotation.total).toLocaleString('en', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="text-section-header">Details</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Issue date', value: format(new Date(quotation.issue_date), 'dd MMM yyyy') },
                  { label: 'Valid until', value: quotation.valid_until ? format(new Date(quotation.valid_until), 'dd MMM yyyy') : '—' },
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
          </div>
        </div>

        {/* Full-width Terms & Notes below the main grid */}
        <div style={{ maxWidth: 900, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {quotation.terms && (
            <div className="card" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <div className="card-header"><span className="text-section-header">Terms & Conditions</span></div>
              <div className="card-body">
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, wordBreak: 'break-word' }}>
                  {renderFormattedText(quotation.terms)}
                </div>
              </div>
            </div>
          )}

          {quotation.notes && (
            <div className="card" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <div className="card-header"><span className="text-section-header">Notes & Remarks</span></div>
              <div className="card-body">
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, wordBreak: 'break-word' }}>
                  {renderFormattedText(quotation.notes)}
                </div>
              </div>
            </div>
          )}
        </div>
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
