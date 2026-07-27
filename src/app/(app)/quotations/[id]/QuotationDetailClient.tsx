'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ArrowLeft, FileText, Send, CheckCircle, Printer, Edit2 } from 'lucide-react'
import type { Quotation, Profile, QuotationStatus } from '@/types/database'
import Link from 'next/link'

interface Props {
  quotation: Quotation & { client: any; items: any[] }
  profile: Profile
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-default', SENT: 'badge-info', ACCEPTED: 'badge-success',
  REJECTED: 'badge-danger', EXPIRED: 'badge-warning',
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

  const curr = quotation.currency ?? 'SAR'

  function handlePrint() {
    window.print()
  }

  async function updateStatus(newStatus: QuotationStatus) {
    setUpdating(true)
    await supabase.from('quotations').update({ status: newStatus }).eq('id', quotation.id)
    setQuotation({ ...quotation, status: newStatus })
    setUpdating(false)
  }

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
      tax_percent: quotation.tax_percent,
      tax_amount: quotation.tax_amount,
      total: quotation.total,
      created_by: profile.id,
    }).select('id').single()

    if (invoice && quotation.items) {
      await supabase.from('invoice_items').insert(
        quotation.items.map((item, idx) => ({
          invoice_id: invoice.id,
          description: item.description,
          qty: item.qty,
          unit_price: item.unit_price,
          amount: item.amount,
          sort_order: idx,
        }))
      )
    }

    setUpdating(false)
    if (invoice) router.push(`/invoices/${invoice.id}`)
  }

  const nextStatuses = STATUS_TRANSITIONS[quotation.status as QuotationStatus] ?? []

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => router.push('/quotations')}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-page-title">{quotation.quote_number}</h1>
            <p className="text-meta" style={{ marginTop: 2 }}>
              Issued {format(new Date(quotation.issue_date), 'dd MMM yyyy')}
            </p>
          </div>
          <span className={`badge ${STATUS_BADGE[quotation.status] ?? 'badge-default'}`}>
            {quotation.status}
          </span>
        </div>
        <div className="flex gap-2 no-print">
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
        {/* Document Banner with Company Logo */}
        <div className="card doc-banner-card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 900 }}>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Adonix Logo" style={{ height: 38, width: 'auto', objectFit: 'contain' }} />
            <div>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Adonix</span>
              <p className="text-meta">Commercial Quotation</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{quotation.quote_number}</span>
            <p className="text-meta">Currency: {curr}</p>
          </div>
        </div>

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
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{quotation.client.address}</div>
                )}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 12 }}>
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
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(quotation.items ?? []).map((item: any) => (
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
                      <td className="num tabular-nums" style={{ fontWeight: 600 }}>{curr} {Number(quotation.subtotal).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>Tax ({quotation.tax_percent}%)</td>
                      <td className="num tabular-nums" style={{ fontSize: 13 }}>{curr} {Number(quotation.tax_amount).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr style={{ borderTop: '1px solid var(--border)' }}>
                      <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>Total</td>
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
                {[
                  { label: 'Subtotal', value: quotation.subtotal },
                  { label: `Tax (${quotation.tax_percent}%)`, value: quotation.tax_amount },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
                    <span className="tabular-nums" style={{ fontSize: 13 }}>
                      {curr} {Number(value).toLocaleString('en', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
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
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5, wordBreak: 'break-word' }}>
                  {quotation.terms}
                </div>
              </div>
            </div>
          )}

          {quotation.notes && (
            <div className="card" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <div className="card-header"><span className="text-section-header">Notes & Remarks</span></div>
              <div className="card-body">
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5, wordBreak: 'break-word' }}>
                  {quotation.notes}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
