'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import type { Profile } from '@/types/database'
import ClientSearchSelect from '@/components/ui/ClientSearchSelect'

interface LineItem {
  id: string
  description: string
  qty: number
  unit_price: number
  amount: number
}

interface Props {
  profile: Profile
  existingClients: { id: string; name: string; company?: string; email?: string; phone?: string }[]
  prefillClient: { id?: string; name?: string; email?: string; phone?: string } | null
  leadId: string | null
}

function genId() { return Math.random().toString(36).slice(2) }

export default function QuotationBuilderClient({ profile, existingClients, prefillClient, leadId }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Client
  const [useExistingClient, setUseExistingClient] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [clientName, setClientName] = useState(prefillClient?.name ?? '')
  const [clientCompany, setClientCompany] = useState('')
  const [clientEmail, setClientEmail] = useState(prefillClient?.email ?? '')
  const [clientPhone, setClientPhone] = useState(prefillClient?.phone ?? '')
  const [clientAddress, setClientAddress] = useState('')

  // Quote details
  const [currency, setCurrency] = useState('SAR')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [validUntil, setValidUntil] = useState('')
  const [taxPercent, setTaxPercent] = useState(15)
  const DEFAULT_TERMS = `50% Advance Payment – Due upon acceptance of the proposal and before project commencement.
30% Milestone Payment – Due upon completion of the first review/demo and client approval to proceed.
20% Final Payment – Due upon final delivery of the project and prior to deployment, handover, or transfer of source files.

**Additional Terms**
Project work will commence upon receipt of the initial 50% payment.
Any additional features or changes outside the agreed scope will be quoted and billed separately as change requests.
Delays in approvals or payments may impact the project timeline.
All payments are non-refundable once the corresponding project phase has been completed.`

  const [terms, setTerms] = useState(DEFAULT_TERMS)
  const [notes, setNotes] = useState('')

  // Line items
  const [items, setItems] = useState<LineItem[]>([
    { id: genId(), description: '', qty: 1, unit_price: 0, amount: 0 },
  ])

  function updateItem(id: string, field: keyof LineItem, value: string | number) {
    setItems(items.map((item) => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      if (field === 'qty' || field === 'unit_price') {
        updated.amount = Number(updated.qty) * Number(updated.unit_price)
      }
      return updated
    }))
  }

  function addItem() {
    setItems([...items, { id: genId(), description: '', qty: 1, unit_price: 0, amount: 0 }])
  }

  function removeItem(id: string) {
    if (items.length === 1) return
    setItems(items.filter((i) => i.id !== id))
  }

  const subtotal = items.reduce((sum, i) => sum + i.amount, 0)
  const taxAmount = (subtotal * taxPercent) / 100
  const total = subtotal + taxAmount

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientName.trim() && !selectedClientId) {
      setError('Client name is required')
      return
    }
    setLoading(true)
    setError('')

    let clientId = selectedClientId || (existingClients.length > 0 ? existingClients[0].id : '')

    // Create client if new
    if (useExistingClient) {
      if (!clientId) {
        setError('Please select an existing client from the dropdown.')
        setLoading(false)
        return
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
          lead_id: leadId,
          assigned_agent_id: profile.id,
        })
        .select('id')
        .single()

      if (clientErr) { setError('Failed to create client: ' + clientErr.message); setLoading(false); return }
      clientId = newClient!.id
    }


    // Generate quote number
    const quoteNumber = `QUO-${Date.now().toString().slice(-6)}`

    // Create quotation
    const { data: quotation, error: quoteErr } = await supabase
      .from('quotations')
      .insert({
        quote_number: quoteNumber,
        client_id: clientId,
        lead_id: leadId,
        currency,
        issue_date: issueDate,
        valid_until: validUntil || null,
        subtotal,
        tax_percent: taxPercent,
        tax_amount: taxAmount,
        total,
        terms: terms.trim() || null,
        notes: notes.trim() || null,
        created_by: profile.id,
      })
      .select('id')
      .single()

    if (quoteErr) { setError('Failed to create quotation: ' + quoteErr.message); setLoading(false); return }

    // Insert line items
    await supabase.from('quotation_items').insert(
      items.filter(i => i.description.trim()).map((item, idx) => ({
        quotation_id: quotation!.id,
        description: item.description.trim(),
        qty: item.qty,
        unit_price: item.unit_price,
        amount: item.amount,
        sort_order: idx,
      }))
    )

    router.push(`/quotations/${quotation!.id}`)
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => router.back()}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-page-title">New quotation</h1>
            {leadId && <p className="text-meta" style={{ marginTop: 2 }}>Linked to lead</p>}
          </div>
        </div>
        <button
          type="submit"
          form="quotation-form"
          className="btn btn-primary btn-sm"
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save quotation'}
        </button>
      </div>

      <div className="page-body">
        {error && (
          <div style={{
            padding: '10px 16px', background: 'var(--danger-light)', border: '1px solid var(--danger)',
            borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--danger)', marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <form id="quotation-form" onSubmit={handleSubmit}>
          <div className="rg-builder">

            {/* LEFT: Client + Line items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Client section */}
              <div className="card">
                <div className="card-header">
                  <span className="text-section-header">Client</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`btn btn-sm ${!useExistingClient ? 'btn-outline' : 'btn-ghost'}`}
                      onClick={() => setUseExistingClient(false)}
                    >
                      New client
                    </button>
                    {existingClients.length > 0 && (
                      <button
                        type="button"
                        className={`btn btn-sm ${useExistingClient ? 'btn-outline' : 'btn-ghost'}`}
                        onClick={() => setUseExistingClient(true)}
                      >
                        Existing client
                      </button>
                    )}
                  </div>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {useExistingClient ? (
                    <div className="form-group">
                      <label className="form-label form-label-required">Select client</label>
                      <ClientSearchSelect
                        clients={existingClients}
                        selectedClientId={selectedClientId}
                        onSelectClient={(client) => {
                          setSelectedClientId(client.id)
                          if (client.id) {
                            setClientName(client.name ?? '')
                            setClientCompany(client.company ?? '')
                            setClientEmail(client.email ?? '')
                            setClientPhone(client.phone ?? '')
                            setClientAddress(client.address ?? '')
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="rg-2">
                      <div className="form-group">
                        <label className="form-label form-label-required">Name</label>
                        <input className="form-input" placeholder="Client name" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Company</label>
                        <input className="form-input" placeholder="Company name" value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Email</label>
                        <input type="email" className="form-input" placeholder="client@example.com" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Phone</label>
                        <input className="form-input" placeholder="+971..." value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Address</label>
                        <textarea className="form-input" placeholder="Full address" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} rows={3} style={{ resize: 'vertical' }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Line items */}
              <div className="card">
                <div className="card-header">
                  <span className="text-section-header">Line items</span>
                </div>
                <div className="hide-mobile" style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ minWidth: 600 }}>
                    <thead>
                      <tr>
                        <th style={{ width: '50%' }}>Description</th>
                        <th className="num" style={{ width: 80 }}>Qty</th>
                        <th className="num" style={{ width: 120 }}>Unit price</th>
                        <th className="num" style={{ width: 120 }}>Amount</th>
                        <th style={{ width: 40 }}></th>
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
                              style={{ border: 'none', borderRadius: 0, padding: '4px 0', fontSize: 13 }}
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
                              style={{ textAlign: 'right', border: 'none', borderRadius: 0, padding: '4px 0', fontSize: 13 }}
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
                              style={{ textAlign: 'right', border: 'none', borderRadius: 0, padding: '4px 0', fontSize: 13 }}
                            />
                          </td>
                          <td className="num tabular-nums" style={{ fontWeight: 500 }}>
                            {item.amount.toLocaleString('en', { minimumFractionDigits: 2 })}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon btn-xs"
                              onClick={() => removeItem(item.id)}
                              style={{ color: 'var(--danger)' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="show-mobile flex-col gap-3" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                  {items.map((item, index) => (
                    <div key={item.id} className="card" style={{ padding: 14, background: 'var(--bg)', border: '1px solid var(--border)', marginBottom: 0 }}>
                      <div className="flex justify-between items-center" style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Item #{index + 1}</span>
                        {items.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon btn-xs"
                            onClick={() => removeItem(item.id)}
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col gap-3">
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: 11 }}>Description</label>
                          <input
                            className="form-input"
                            placeholder="Service or product description"
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                            style={{ fontSize: 13 }}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: 11 }}>Qty</label>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className="form-input"
                              value={item.qty}
                              onChange={(e) => updateItem(item.id, 'qty', parseFloat(e.target.value) || 0)}
                              style={{ fontSize: 13 }}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: 11 }}>Unit price</label>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className="form-input"
                              value={item.unit_price}
                              onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                              style={{ fontSize: 13 }}
                            />
                          </div>
                        </div>
                        <div className="flex justify-between items-center" style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Amount</span>
                          <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {currency} {item.amount.toLocaleString('en', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>
                    <Plus size={13} />
                    Add line item
                  </button>
                </div>
              </div>

              {/* Terms & Notes */}
              <div className="card">
                <div className="card-header">
                  <span className="text-section-header">Terms & notes</span>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Terms</label>
                    <textarea className="form-input" rows={9} value={terms} onChange={(e) => setTerms(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea className="form-input" rows={2} placeholder="Any additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Quote details + Totals */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                <div className="card-header">
                  <span className="text-section-header">Quote details</span>
                </div>
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
                    <label className="form-label">Valid until</label>
                    <input type="date" className="form-input" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">VAT (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      className="form-input"
                      value={taxPercent}
                      onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="card">
                <div className="card-header">
                  <span className="text-section-header">Totals ({currency})</span>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Subtotal', value: subtotal },
                    { label: `VAT (${taxPercent}%)`, value: taxAmount },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
                      <span className="tabular-nums" style={{ fontSize: 14 }}>
                        {currency} {value.toLocaleString('en', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                  <div className="divider" style={{ margin: '8px 0' }} />
                  <div className="flex justify-between items-center">
                    <span style={{ fontSize: 15, fontWeight: 600 }}>Total</span>
                    <span className="tabular-nums" style={{ fontSize: 18, fontWeight: 700 }}>
                      {currency} {total.toLocaleString('en', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <button type="submit" form="quotation-form" className="btn btn-primary" style={{ justifyContent: 'center' }} disabled={loading}>
                {loading ? 'Saving...' : 'Save quotation'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
