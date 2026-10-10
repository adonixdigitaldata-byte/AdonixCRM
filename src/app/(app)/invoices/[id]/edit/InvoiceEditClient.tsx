'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, ArrowLeft, Save, Send, Building } from 'lucide-react'
import type { Invoice, Profile } from '@/types/database'
import ClientSearchSelect from '@/components/ui/ClientSearchSelect'
import { OFFICE_LOCATIONS, type OfficeLocationKey } from '@/lib/constants/officeLocations'

interface LineItem {
  id: string
  description: string
  qty: number
  unit_price: number
  discount_percent: number
  amount: number
}

interface Props {
  invoice: Invoice & { client: any; items: any[] }
  clients: any[]
  profile: Profile
}

function genId() { return Math.random().toString(36).slice(2) }

export default function InvoiceEditClient({ invoice, clients, profile }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Office Location & Compliance
  const [officeLocation, setOfficeLocation] = useState<OfficeLocationKey>(
    (invoice.office_location as OfficeLocationKey) || 'KSA'
  )
  const [invoiceType, setInvoiceType] = useState<'B2B' | 'B2C'>(
    (invoice.invoice_type as 'B2B' | 'B2C') || 'B2B'
  )

  // Client details
  const [selectedClientId, setSelectedClientId] = useState(invoice.client_id ?? '')
  const [clientName, setClientName] = useState(invoice.client?.name ?? '')
  const [clientCompany, setClientCompany] = useState(invoice.client?.company ?? '')
  const [clientEmail, setClientEmail] = useState(invoice.client?.email ?? '')
  const [clientPhone, setClientPhone] = useState(invoice.client?.phone ?? '')
  const [clientAddress, setClientAddress] = useState(invoice.client?.address ?? '')
  const [clientVat, setClientVat] = useState(invoice.client?.vat_number ?? '')
  const [clientCr, setClientCr] = useState(invoice.client?.cr_number ?? '')

  // Invoice details
  const [currency, setCurrency] = useState(invoice.currency ?? (invoice.office_location === 'HYDERABAD' ? 'INR' : 'SAR'))
  const [issueDate, setIssueDate] = useState(invoice.issue_date ?? new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(invoice.due_date ?? '')
  const [taxPercent, setTaxPercent] = useState(Number(invoice.tax_percent ?? (invoice.office_location === 'HYDERABAD' ? 18 : 15)))
  const [status, setStatus] = useState(invoice.status)

  // Custom Bank Remittance Details
  const defaultBank = OFFICE_LOCATIONS[officeLocation]?.bankDetails
  const [bankName, setBankName] = useState(invoice.bank_name ?? defaultBank?.bankName ?? '')
  const [bankAccountName, setBankAccountName] = useState(invoice.bank_account_name ?? defaultBank?.accountName ?? '')
  const [bankAccountNumber, setBankAccountNumber] = useState(invoice.bank_account_number ?? defaultBank?.accountNumber ?? '')
  const [bankIban, setBankIban] = useState(invoice.bank_iban ?? defaultBank?.iban ?? '')
  const [bankSwift, setBankSwift] = useState(invoice.bank_swift ?? defaultBank?.swiftCode ?? '')
  const [bankIfsc, setBankIfsc] = useState(invoice.bank_ifsc ?? defaultBank?.ifscCode ?? '')

  // Overall Discount
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>(invoice.discount_type ?? 'PERCENTAGE')
  const [discountValue, setDiscountValue] = useState<number>(Number(invoice.discount_value) || 0)

  // Notes & Terms
  const [notes, setNotes] = useState(invoice.notes ?? '')
  const [terms, setTerms] = useState(invoice.terms ?? (officeLocation === 'KSA'
    ? `1. Payment due upon receipt or as specified above.\n2. Payment via bank transfer or cheque.\n3. Tax: 15% VAT applicable as per KSA tax regulations.`
    : `1. Payment due within specified period.\n2. Payment via NEFT / RTGS / UPI to company bank account.\n3. Invoices once issued are subject to commercial contract terms.`
  ))

  // Line items
  const [items, setItems] = useState<LineItem[]>(
    (invoice.items && invoice.items.length > 0)
      ? invoice.items.map((i: any) => ({
          id: i.id || genId(),
          description: i.description ?? '',
          qty: Number(i.qty) || 1,
          unit_price: Number(i.unit_price) || 0,
          discount_percent: Number(i.discount_percent) || 0,
          amount: Number(i.amount) || 0,
        }))
      : [{ id: genId(), description: '', qty: 1, unit_price: 0, discount_percent: 0, amount: 0 }]
  )

  function handleOfficeChange(loc: OfficeLocationKey) {
    setOfficeLocation(loc)
    const newBank = OFFICE_LOCATIONS[loc]?.bankDetails
    setBankName(newBank?.bankName || '')
    setBankAccountName(newBank?.accountName || '')
    setBankAccountNumber(newBank?.accountNumber || '')
    setBankIban(newBank?.iban || '')
    setBankSwift(newBank?.swiftCode || '')
    setBankIfsc(newBank?.ifscCode || '')

    if (loc === 'HYDERABAD') {
      if (currency === 'SAR') setCurrency('INR')
      if (taxPercent === 15) setTaxPercent(18)
    } else {
      if (currency === 'INR') setCurrency('SAR')
      if (taxPercent === 18) setTaxPercent(15)
    }
  }

  function handleClientSelect(id: string) {
    setSelectedClientId(id)
    const found = clients.find(c => c.id === id)
    if (found) {
      setClientName(found.name ?? '')
      setClientCompany(found.company ?? '')
      setClientEmail(found.email ?? '')
      setClientPhone(found.phone ?? '')
      setClientAddress(found.address ?? '')
      setClientVat(found.vat_number ?? '')
      setClientCr(found.cr_number ?? '')
    }
  }

  function updateItem(id: string, field: keyof LineItem, value: string | number) {
    setItems(items.map((item) => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      if (field === 'qty' || field === 'unit_price' || field === 'discount_percent') {
        const q = Number(updated.qty) || 0
        const p = Number(updated.unit_price) || 0
        const d = Math.min(100, Math.max(0, Number(updated.discount_percent) || 0))
        const gross = q * p
        updated.amount = Math.max(0, gross - (gross * d) / 100)
      }
      return updated
    }))
  }

  function addItem() {
    setItems([...items, { id: genId(), description: '', qty: 1, unit_price: 0, discount_percent: 0, amount: 0 }])
  }

  function removeItem(id: string) {
    if (items.length === 1) return
    setItems(items.filter((i) => i.id !== id))
  }

  const subtotal = items.reduce((sum, i) => sum + i.amount, 0)
  const discountAmount = discountType === 'PERCENTAGE'
    ? (subtotal * (Number(discountValue) || 0)) / 100
    : Math.min(subtotal, Number(discountValue) || 0)
  const taxableSubtotal = Math.max(0, subtotal - discountAmount)
  const taxAmount = (taxableSubtotal * taxPercent) / 100
  const total = taxableSubtotal + taxAmount

  async function handleSave(newStatus?: string) {
    setLoading(true)
    setError('')
    const targetStatus = newStatus || status

    if (selectedClientId) {
      await supabase.from('clients').update({
        name: clientName.trim(),
        company: clientCompany.trim() || null,
        email: clientEmail.trim() || null,
        phone: clientPhone.trim() || null,
        address: clientAddress.trim() || null,
        vat_number: clientVat.trim() || null,
        cr_number: clientCr.trim() || null,
      }).eq('id', selectedClientId)
    }

    const { error: invErr } = await supabase
      .from('invoices')
      .update({
        client_id: selectedClientId || invoice.client_id,
        office_location: officeLocation,
        invoice_type: officeLocation === 'KSA' ? invoiceType : null,
        currency,
        issue_date: issueDate,
        due_date: dueDate || null,
        subtotal,
        discount_type: discountType,
        discount_value: Number(discountValue) || 0,
        discount_amount: discountAmount,
        tax_percent: taxPercent,
        tax_amount: taxAmount,
        total,
        status: targetStatus,
        notes: notes.trim() || null,
        terms: terms.trim() || null,
        bank_name: bankName.trim() || null,
        bank_account_name: bankAccountName.trim() || null,
        bank_account_number: bankAccountNumber.trim() || null,
        bank_iban: bankIban.trim() || null,
        bank_swift: bankSwift.trim() || null,
        bank_ifsc: bankIfsc.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id)

    if (invErr) { setError('Failed to update invoice: ' + invErr.message); setLoading(false); return }

    await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id)
    await supabase.from('invoice_items').insert(
      items.filter(i => i.description.trim()).map((item, idx) => ({
        invoice_id: invoice.id,
        description: item.description.trim(),
        qty: item.qty,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent || 0,
        amount: item.amount,
        sort_order: idx,
      }))
    )

    // Log the edit event into immutable audit trail
    try {
      await supabase.from('invoice_audit_logs').insert({
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        action: 'DRAFT_EDITED',
        performed_by: profile.id,
        previous_state: {
          subtotal: invoice.subtotal,
          total: invoice.total,
          items_count: invoice.items?.length,
        },
        new_state: {
          subtotal,
          total,
          items_count: items.length,
          status: targetStatus,
        },
      })
    } catch (auditErr) {
      console.warn('Audit log write error:', auditErr)
    }

    setLoading(false)
    router.push(`/invoices/${invoice.id}`)
  }

  const isLocked = invoice.status !== 'DRAFT' || Boolean(invoice.is_credit_note) || Boolean(invoice.is_debit_note)

  if (isLocked) {
    return (
      <div>
        <div className="page-header">
          <div className="flex items-center gap-3">
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => router.push(`/invoices/${invoice.id}`)}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-page-title">{invoice.invoice_number} (Locked)</h1>
              <p className="text-meta" style={{ marginTop: 2 }}>ZATCA Phase 1 Tamper Protection Enforced</p>
            </div>
          </div>
        </div>

        <div className="page-body" style={{ maxWidth: 700, margin: '40px auto' }}>
          <div className="card" style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              {invoice.is_credit_note
                ? 'Credit Notes Cannot Be Modified'
                : invoice.is_debit_note
                ? 'Debit Notes Cannot Be Modified'
                : 'Issued Invoices Cannot Be Modified'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
              {invoice.is_credit_note || invoice.is_debit_note
                ? `Under ZATCA Phase 1 regulations, official adjustment notes are immutable legal records. If you need to bill for new services or scope, please create a standard new invoice.`
                : `Under ZATCA Phase 1 electronic invoicing regulations, once an invoice is issued with status ${invoice.status}, its financial figures, line items, timestamps, and sequential counter cannot be modified or deleted.`}
            </p>
            <div style={{ background: 'var(--bg-subtle, #f8fafc)', padding: 14, borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, textAlign: 'left', borderLeft: '4px solid var(--accent, #0284c7)' }}>
              <strong>Compliant Workflow:</strong> {invoice.is_credit_note || invoice.is_debit_note
                ? 'To bill additional services or charges, click "+ New invoice" from the invoices dashboard.'
                : 'If you need to make changes, corrections, or cancellations, please issue an official Credit Note.'}
            </div>
            <div className="flex justify-center gap-3">
              <button className="btn btn-outline" onClick={() => router.push(`/invoices/${invoice.id}`)}>
                <ArrowLeft size={15} /> Return to Document
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => router.push(`/invoices/${invoice.id}`)}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-page-title">Edit Draft {invoice.invoice_number}</h1>
            <p className="text-meta" style={{ marginTop: 2 }}>Modify items, pricing, tax, office, compliance, or buyer details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => handleSave('DRAFT')} disabled={loading}>
            <Save size={14} /> Save Draft
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleSave('SENT')} disabled={loading}>
            <Send size={14} /> Save &amp; Issue
          </button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="rg-main-sidebar-sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Office Location & Invoice Type Card */}
            <div className="card">
              <div className="card-header"><span className="text-section-header">Office &amp; Compliance Configuration</span></div>
              <div className="card-body">
                <div className="rg-2">
                  <div className="form-group">
                    <label className="form-label">Billing Entity / Office</label>
                    <select
                      className="form-select"
                      value={officeLocation}
                      onChange={(e) => handleOfficeChange(e.target.value as OfficeLocationKey)}
                    >
                      <option value="KSA">🇸🇦 Saudi Arabia Office (ZATCA Compliant)</option>
                      <option value="HYDERABAD">🇮🇳 India Office (Hyderabad · Commercial)</option>
                    </select>
                  </div>
                  {officeLocation === 'KSA' ? (
                    <div className="form-group">
                      <label className="form-label">ZATCA Transaction Model</label>
                      <select
                        className="form-select"
                        value={invoiceType}
                        onChange={(e) => setInvoiceType(e.target.value as 'B2B' | 'B2C')}
                      >
                        <option value="B2B">B2B - Standard Tax Invoice (Clearance)</option>
                        <option value="B2C">B2C - Simplified Tax Invoice (Reporting)</option>
                      </select>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">Tax Regime</label>
                      <input className="form-input" disabled value="Indian Commercial / International" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Client Info */}
            <div className="card">
              <div className="card-header"><span className="text-section-header">Buyer / Client Details</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {clients && clients.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Select Client</label>
                    <ClientSearchSelect
                      clients={clients}
                      selectedClientId={selectedClientId}
                      onSelectClient={(client) => handleClientSelect(client.id)}
                    />
                  </div>
                )}
                <div className="rg-2">
                  <div className="form-group">
                    <label className="form-label form-label-required">Client Name / Contact Person</label>
                    <input className="form-input" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company / Organization</label>
                    <input className="form-input" value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} />
                  </div>
                </div>

                {officeLocation === 'KSA' && (
                  <div className="rg-2">
                    <div className="form-group">
                      <label className="form-label">
                        VAT Number / TRN (15 digits)
                        {invoiceType === 'B2B' && <span style={{ color: 'var(--accent)', marginLeft: 4 }}>* Required for B2B</span>}
                      </label>
                      <input
                        className="form-input"
                        placeholder="3xxxxxxxxxxxxxx"
                        value={clientVat}
                        onChange={(e) => setClientVat(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">CR Number / 700 / National ID</label>
                      <input
                        className="form-input"
                        placeholder="e.g. 7055349166"
                        value={clientCr}
                        onChange={(e) => setClientCr(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="rg-2">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Billing Address</label>
                  <textarea className="form-input" rows={2} value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} style={{ resize: 'vertical' }} />
                </div>
              </div>
            </div>

            {/* Line Items - SINGLE CLEAN DESKTOP & RESPONSIVE TABLE (NO DUPLICATION) */}
            <div className="card">
              <div className="card-header"><span className="text-section-header">Line items</span></div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ minWidth: 620 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '45%' }}>Description</th>
                      <th className="num" style={{ width: 70 }}>Qty</th>
                      <th className="num" style={{ width: 110 }}>Unit price</th>
                      <th className="num" style={{ width: 85 }}>Disc %</th>
                      <th className="num" style={{ width: 110 }}>Total</th>
                      <th style={{ width: 44 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <input
                            className="form-input"
                            placeholder="Product or service description..."
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number" min={1} className="form-input num"
                            value={item.qty}
                            onChange={(e) => updateItem(item.id, 'qty', parseInt(e.target.value) || 1)}
                          />
                        </td>
                        <td>
                          <input
                            type="number" min={0} step="0.01" className="form-input num"
                            value={item.unit_price}
                            onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td>
                          <input
                            type="number" min={0} max={100} step="0.5" className="form-input num"
                            placeholder="0"
                            value={item.discount_percent || ''}
                            onChange={(e) => updateItem(item.id, 'discount_percent', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="num tabular-nums" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {currency} {item.amount.toLocaleString('en', { minimumFractionDigits: 2 })}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon btn-sm"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => removeItem(item.id)}
                            disabled={items.length === 1}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card-footer">
                <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>
                  <Plus size={13} /> Add line item
                </button>
              </div>
            </div>

            {/* Custom Bank Details Card */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building size={16} />
                <span className="text-section-header">Bank Account &amp; Remittance Details</span>
              </div>
              <div className="card-body">
                <p className="text-meta" style={{ marginBottom: 12 }}>
                  These banking details are displayed on the printed invoice for direct wire transfers.
                </p>
                <div className="rg-2">
                  <div className="form-group">
                    <label className="form-label">Bank Name</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Al Rajhi Bank or HDFC Bank"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Account Holder Name</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Asaheeb and Adonix Developments Co."
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="rg-2" style={{ marginTop: 12 }}>
                  <div className="form-group">
                    <label className="form-label">{officeLocation === 'KSA' ? 'IBAN (International Account)' : 'Account Number'}</label>
                    <input
                      className="form-input font-mono"
                      placeholder={officeLocation === 'KSA' ? 'SA0000000000000000000000' : '50100000000000'}
                      value={officeLocation === 'KSA' ? bankIban : bankAccountNumber}
                      onChange={(e) => {
                        if (officeLocation === 'KSA') setBankIban(e.target.value)
                        else setBankAccountNumber(e.target.value)
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{officeLocation === 'KSA' ? 'SWIFT / BIC Code' : 'IFSC Code'}</label>
                    <input
                      className="form-input font-mono"
                      placeholder={officeLocation === 'KSA' ? 'RJHISARI' : 'HDFC0000000'}
                      value={officeLocation === 'KSA' ? bankSwift : bankIfsc}
                      onChange={(e) => {
                        if (officeLocation === 'KSA') setBankSwift(e.target.value)
                        else setBankIfsc(e.target.value)
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notes & Terms Card */}
            <div className="card">
              <div className="card-header"><span className="text-section-header">Notes &amp; Terms</span></div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Notes (Optional reference or instructions)</label>
                    <textarea className="form-input" rows={2} placeholder="Additional notes or payment instructions..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Terms &amp; Conditions</label>
                    <textarea className="form-input" rows={4} value={terms} onChange={(e) => setTerms(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-header"><span className="text-section-header">Invoice Parameters</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select className="form-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="SAR">SAR - Saudi Riyal (﷼)</option>
                    <option value="INR">INR - Indian Rupee (₹)</option>
                    <option value="USD">USD - US Dollar ($)</option>
                    <option value="AED">AED - UAE Dirham</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Issue date</label>
                  <input type="date" className="form-input" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Due date</label>
                  <input type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">VAT / Tax Rate (%)</label>
                  <input
                    type="number" min={0} max={100} step="0.01" className="form-input"
                    value={taxPercent} onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                    <option value="DRAFT">Draft</option>
                    <option value="SENT">Sent</option>
                    <option value="PARTIALLY_PAID">Partially Paid</option>
                    <option value="PAID">Paid</option>
                    <option value="OVERDUE">Overdue</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="text-section-header">Totals ({currency})</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="flex justify-between">
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Subtotal</span>
                  <span className="tabular-nums">{currency} {subtotal.toLocaleString('en', { minimumFractionDigits: 2 })}</span>
                </div>

                {/* Overall Discount */}
                <div style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Discount</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className={`btn btn-xs ${discountType === 'PERCENTAGE' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setDiscountType('PERCENTAGE')}
                      >%</button>
                      <button
                        type="button"
                        className={`btn btn-xs ${discountType === 'FIXED' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setDiscountType('FIXED')}
                      >{currency}</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={0} step={discountType === 'PERCENTAGE' ? '1' : '0.01'}
                      max={discountType === 'PERCENTAGE' ? 100 : subtotal}
                      className="form-input num" style={{ height: 28, fontSize: 12 }}
                      placeholder={discountType === 'PERCENTAGE' ? '0%' : '0.00'}
                      value={discountValue || ''}
                      onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    />
                    {discountAmount > 0 && (
                      <span className="tabular-nums text-meta" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                        -{currency} {discountAmount.toLocaleString('en', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between">
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Taxable Subtotal</span>
                  <span className="tabular-nums">{currency} {taxableSubtotal.toLocaleString('en', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between">
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>VAT ({taxPercent}%)</span>
                  <span className="tabular-nums">{currency} {taxAmount.toLocaleString('en', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between" style={{ borderTop: '2px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
                  <span className="tabular-nums" style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>
                    {currency} {total.toLocaleString('en', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
