'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, ArrowLeft, Save, Send } from 'lucide-react'
import type { Profile } from '@/types/database'
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
  profile: Profile
  existingClients: {
    id: string
    name: string
    company?: string
    email?: string
    phone?: string
    address?: string
    vat_number?: string
    cr_number?: string
  }[]
}

function genId() { return Math.random().toString(36).slice(2) }

export default function InvoiceBuilderClient({ profile, existingClients }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Office Location & Transaction Type
  const [officeLocation, setOfficeLocation] = useState<OfficeLocationKey>('KSA')
  const [invoiceType, setInvoiceType] = useState<'B2B' | 'B2C'>('B2B')

  // Client
  const [useExistingClient, setUseExistingClient] = useState(existingClients.length > 0)
  const [selectedClientId, setSelectedClientId] = useState(existingClients[0]?.id ?? '')
  const [clientName, setClientName] = useState(existingClients[0]?.name ?? '')
  const [clientCompany, setClientCompany] = useState(existingClients[0]?.company ?? '')
  const [clientEmail, setClientEmail] = useState(existingClients[0]?.email ?? '')
  const [clientPhone, setClientPhone] = useState(existingClients[0]?.phone ?? '')
  const [clientAddress, setClientAddress] = useState(existingClients[0]?.address ?? '')
  const [clientVat, setClientVat] = useState(existingClients[0]?.vat_number ?? '')
  const [clientCr, setClientCr] = useState(existingClients[0]?.cr_number ?? '')

  // Bank details with defaults from office location
  const defaultBank = OFFICE_LOCATIONS.KSA.bankDetails
  const [bankName, setBankName] = useState(defaultBank?.bankName ?? '')
  const [bankAccountName, setBankAccountName] = useState(defaultBank?.accountName ?? '')
  const [bankAccountNumber, setBankAccountNumber] = useState(defaultBank?.accountNumber ?? '')
  const [bankIban, setBankIban] = useState(defaultBank?.iban ?? '')
  const [bankSwift, setBankSwift] = useState(defaultBank?.swiftCode ?? '')
  const [bankIfsc, setBankIfsc] = useState(defaultBank?.ifscCode ?? '')

  // Invoice details
  const [currency, setCurrency] = useState('SAR')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [taxPercent, setTaxPercent] = useState(15)

  // Overall Discount
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE')
  const [discountValue, setDiscountValue] = useState<number>(0)

  // Notes & Terms
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState(`1. Payment due upon receipt or as specified above.
2. Payment via bank transfer or cheque.
3. Tax: 15% VAT applicable as per KSA tax regulations.`)

  // Items
  const [items, setItems] = useState<LineItem[]>([
    { id: genId(), description: '', qty: 1, unit_price: 0, discount_percent: 0, amount: 0 },
  ])

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
      setCurrency('INR')
      setTaxPercent(18)
      setTerms(`1. Payment due within specified period.\n2. Payment via NEFT / RTGS / UPI to company bank account.\n3. Invoices once issued are subject to commercial contract terms.`)
    } else {
      setCurrency('SAR')
      setTaxPercent(15)
      setTerms(`1. Payment due upon receipt or as specified above.\n2. Payment via bank transfer or cheque.\n3. Tax: 15% VAT applicable as per KSA tax regulations.`)
    }
  }

  function handleClientSelect(id: string) {
    setSelectedClientId(id)
    const found = existingClients.find(c => c.id === id)
    if (found) {
      setClientName(found.name)
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

  async function handleSave(status: 'DRAFT' | 'SENT') {
    setLoading(true)
    setError('')

    try {
      let clientId = selectedClientId || (existingClients.length > 0 ? existingClients[0].id : '')

      // 1. Prepare / update Client
      if (useExistingClient) {
        if (!clientId) {
          setError('Please select an existing client from the dropdown.')
          setLoading(false)
          return
        }
        // Update client VAT, CR, & Address if provided
        if (clientVat.trim() || clientCr.trim() || clientAddress.trim() || clientPhone.trim()) {
          await supabase.from('clients').update({
            vat_number: clientVat.trim() || null,
            cr_number: clientCr.trim() || null,
            address: clientAddress.trim() || null,
            phone: clientPhone.trim() || null,
          }).eq('id', clientId)
        }
      } else {
        if (!clientName.trim()) {
          setError('Client name is required when creating a new client.')
          setLoading(false)
          return
        }

        const { data: newClient, error: clientErr } = await supabase
          .from('clients')
          .insert({
            name: clientName.trim(),
            company: clientCompany.trim() || null,
            email: clientEmail.trim() || null,
            phone: clientPhone.trim() || null,
            address: clientAddress.trim() || null,
            vat_number: clientVat.trim() || null,
            cr_number: clientCr.trim() || null,
            assigned_agent_id: profile.id,
          })
          .select('id')
          .single()

        if (clientErr) throw clientErr
        clientId = newClient.id
      }

      // 2. Call atomic sequential creation endpoint with Phase 1 compliance
      const res = await fetch('/api/invoices/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          officeLocation,
          invoiceType,
          currency,
          issueDate,
          dueDate: dueDate || null,
          subtotal,
          discountType,
          discountValue: Number(discountValue) || 0,
          discountAmount,
          taxPercent,
          taxAmount,
          total,
          status,
          notes: notes.trim() || null,
          terms: terms.trim() || null,
          bankName: bankName.trim() || null,
          bankAccountName: bankAccountName.trim() || null,
          bankAccountNumber: bankAccountNumber.trim() || null,
          bankIban: bankIban.trim() || null,
          bankSwift: bankSwift.trim() || null,
          bankIfsc: bankIfsc.trim() || null,
          items: items.filter(i => i.description.trim()),
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create invoice')
      }

      router.push(`/invoices/${data.invoice.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create invoice')
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => router.push('/invoices')}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-page-title">New Invoice</h1>
            <p className="text-meta" style={{ marginTop: 2 }}>Create and issue a commercial invoice</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => handleSave('DRAFT')} disabled={loading}>
            <Save size={14} /> Save Draft
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleSave('SENT')} disabled={loading}>
            <Send size={14} /> Create & Issue
          </button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="rg-main-sidebar-sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Client Selection */}
            <div className="card">
              <div className="card-header"><span className="text-section-header">Client details</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {existingClients.length > 0 && (
                  <div className="flex gap-4" style={{ marginBottom: 4 }}>
                    <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        checked={useExistingClient}
                        onChange={() => {
                          setUseExistingClient(true)
                          const targetId = selectedClientId || existingClients[0]?.id || ''
                          if (targetId) handleClientSelect(targetId)
                        }}
                      />
                      Select existing client
                    </label>
                    <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="radio" checked={!useExistingClient} onChange={() => { setUseExistingClient(false); setSelectedClientId(''); setClientName(''); setClientCompany(''); setClientEmail(''); setClientPhone(''); setClientAddress('') }} />
                      Create new client
                    </label>
                  </div>
                )}


                {useExistingClient && existingClients.length > 0 ? (
                  <div className="form-group">
                    <label className="form-label">Client</label>
                    <ClientSearchSelect
                      clients={existingClients}
                      selectedClientId={selectedClientId}
                      onSelectClient={(client) => handleClientSelect(client.id)}
                    />
                  </div>
                ) : (
                  <>
                    <div className="rg-2">
                      <div className="form-group">
                        <label className="form-label form-label-required">Client Name</label>
                        <input className="form-input" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Company Name</label>
                        <input className="form-input" value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} />
                      </div>
                    </div>
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
                      <label className="form-label">Client Address</label>
                      <input
                        className="form-input"
                        placeholder="Street address, City, Country"
                        value={clientAddress}
                        onChange={(e) => setClientAddress(e.target.value)}
                      />
                    </div>
                    <div className="rg-2">
                      <div className="form-group">
                        <label className="form-label">
                          Buyer VAT Number (الرقم الضريبي)
                          {officeLocation === 'KSA' && invoiceType === 'B2B' && <span style={{ color: 'var(--accent)', marginLeft: 4 }}>*Mandatory for B2B</span>}
                        </label>
                        <input
                          className="form-input"
                          placeholder="e.g. 300000000000003 (15 digits)"
                          value={clientVat}
                          onChange={(e) => setClientVat(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Buyer CR / 700 Number (السجل التجاري)</label>
                        <input
                          className="form-input"
                          placeholder="e.g. 7001234567 or CR"
                          value={clientCr}
                          onChange={(e) => setClientCr(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* If existing client is selected, show their VAT, CR & Address with quick edit */}
                {useExistingClient && existingClients.length > 0 && (
                  <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="rg-2">
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: 12 }}>
                          Client VAT Number {officeLocation === 'KSA' && invoiceType === 'B2B' && <span style={{ color: 'var(--accent)' }}>(B2B Mandatory)</span>}
                        </label>
                        <input
                          className="form-input"
                          placeholder="15-digit Tax No. (الرقم الضريبي)"
                          value={clientVat}
                          onChange={(e) => setClientVat(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: 12 }}>Client CR / License No.</label>
                        <input
                          className="form-input"
                          placeholder="Commercial Registration (السجل التجاري)"
                          value={clientCr}
                          onChange={(e) => setClientCr(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 12 }}>Client Address</label>
                      <input
                        className="form-input"
                        placeholder="Client physical/billing address"
                        value={clientAddress}
                        onChange={(e) => setClientAddress(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Line Items */}
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
                      <th className="num" style={{ width: 110 }}>Amount</th>
                      <th style={{ width: 36 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <input
                            className="form-input"
                            placeholder="Service or product description"
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                            style={{ border: 'none', fontSize: 13, padding: '4px 0' }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="form-input"
                            value={item.qty}
                            onChange={(e) => updateItem(item.id, 'qty', parseFloat(e.target.value) || 0)}
                            style={{ textAlign: 'right', border: 'none', fontSize: 13, padding: '4px 0' }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="form-input"
                            value={item.unit_price}
                            onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                            style={{ textAlign: 'right', border: 'none', fontSize: 13, padding: '4px 0' }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.1"
                            placeholder="0%"
                            className="form-input"
                            value={item.discount_percent || ''}
                            onChange={(e) => updateItem(item.id, 'discount_percent', parseFloat(e.target.value) || 0)}
                            style={{ textAlign: 'right', border: 'none', fontSize: 13, padding: '4px 0' }}
                          />
                        </td>
                        <td className="num tabular-nums" style={{ fontWeight: 500 }}>
                          {item.amount.toLocaleString('en', { minimumFractionDigits: 2 })}
                        </td>
                        <td>
                          <button type="button" className="btn btn-ghost btn-icon btn-xs" onClick={() => removeItem(item.id)} style={{ color: 'var(--danger)' }}>
                            <Trash2 size={13} />
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

            {/* Official Bank Remittance Instructions */}
            <div className="card">
              <div className="card-header">
                <span className="text-section-header">Official Bank Remittance Instructions</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="rg-2">
                  <div className="form-group">
                    <label className="form-label">Bank Name</label>
                    <input
                      className="form-input"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. Al Rajhi Bank / HDFC Bank"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Account Holder Name</label>
                    <input
                      className="form-input"
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                      placeholder="Beneficiary legal entity name"
                    />
                  </div>
                </div>

                <div className="rg-2">
                  <div className="form-group">
                    <label className="form-label">IBAN Number</label>
                    <input
                      className="form-input font-mono"
                      value={bankIban}
                      onChange={(e) => setBankIban(e.target.value)}
                      placeholder="e.g. SA0000000000000000000000"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Account Number</label>
                    <input
                      className="form-input font-mono"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      placeholder="Account Number"
                    />
                  </div>
                </div>

                <div className="rg-2">
                  <div className="form-group">
                    <label className="form-label">SWIFT / BIC Code</label>
                    <input
                      className="form-input font-mono"
                      value={bankSwift}
                      onChange={(e) => setBankSwift(e.target.value)}
                      placeholder="e.g. RJHISARI"
                    />
                  </div>
                  {officeLocation === 'HYDERABAD' && (
                    <div className="form-group">
                      <label className="form-label">IFSC Code (India)</label>
                      <input
                        className="form-input font-mono"
                        value={bankIfsc}
                        onChange={(e) => setBankIfsc(e.target.value)}
                        placeholder="e.g. HDFC0000123"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notes & Terms Card */}
            <div className="card">
              <div className="card-header"><span className="text-section-header">Notes &amp; Terms</span></div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea className="form-input" rows={3} placeholder="Additional notes or payment instructions..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Terms &amp; Conditions</label>
                    <textarea className="form-input" rows={5} value={terms} onChange={(e) => setTerms(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-header"><span className="text-section-header">Details</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label form-label-required">Issuing Entity / Office</label>
                  <select
                    className="form-select"
                    value={officeLocation}
                    onChange={(e) => handleOfficeChange(e.target.value as OfficeLocationKey)}
                  >
                    <option value="KSA">🇸🇦 KSA (Asaheeb &amp; Adonix - ZATCA E-Invoice)</option>
                    <option value="HYDERABAD">🇮🇳 India (Hyderabad Office - Non-ZATCA)</option>
                  </select>
                </div>

                {officeLocation === 'KSA' && (
                  <div className="form-group" style={{ padding: '8px 10px', background: 'rgba(37, 99, 235, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
                    <label className="form-label" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                      ZATCA Invoice Category
                    </label>
                    <div className="flex gap-3" style={{ marginTop: 4 }}>
                      <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="inv_type"
                          checked={invoiceType === 'B2B'}
                          onChange={() => setInvoiceType('B2B')}
                        />
                        <span><strong>B2B</strong> (Standard / فاتورة ضريبية)</span>
                      </label>
                      <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="inv_type"
                          checked={invoiceType === 'B2C'}
                          onChange={() => setInvoiceType('B2C')}
                        />
                        <span><strong>B2C</strong> (Simplified / مبسطة)</span>
                      </label>
                    </div>
                  </div>
                )}

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
                  <label className="form-label">VAT (%)</label>
                  <input
                    type="number" min={0} max={100} step="0.01" className="form-input"
                    value={taxPercent} onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                  />
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
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Overall Discount</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className={`btn btn-xs ${discountType === 'PERCENTAGE' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setDiscountType('PERCENTAGE')}
                        style={{ padding: '2px 7px', fontSize: 11, minHeight: 22 }}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        className={`btn btn-xs ${discountType === 'FIXED' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setDiscountType('FIXED')}
                        style={{ padding: '2px 7px', fontSize: 11, minHeight: 22 }}
                      >
                        {currency}
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={discountType === 'PERCENTAGE' ? 100 : undefined}
                    step="0.01"
                    className="form-input"
                    placeholder={discountType === 'PERCENTAGE' ? 'Discount %' : `Amount in ${currency}`}
                    value={discountValue || ''}
                    onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{ fontSize: 12, padding: '4px 8px' }}
                  />
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between items-center" style={{ color: 'var(--success)' }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                      Discount {discountType === 'PERCENTAGE' ? `(${discountValue}%)` : ''}
                    </span>
                    <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 600 }}>
                      - {currency} {discountAmount.toLocaleString('en', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {discountAmount > 0 && (
                  <div className="flex justify-between items-center">
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Taxable Subtotal</span>
                    <span className="tabular-nums" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {currency} {taxableSubtotal.toLocaleString('en', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>VAT ({taxPercent}%)</span>
                  <span className="tabular-nums">{currency} {taxAmount.toLocaleString('en', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="divider" style={{ margin: '6px 0' }} />
                <div className="flex justify-between">
                  <span style={{ fontWeight: 600 }}>Total</span>
                  <span className="tabular-nums" style={{ fontSize: 18, fontWeight: 700 }}>{currency} {total.toLocaleString('en', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
