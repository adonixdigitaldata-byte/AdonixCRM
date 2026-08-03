'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, ArrowLeft, Save, Send } from 'lucide-react'
import type { Invoice, Profile } from '@/types/database'
import ClientSearchSelect from '@/components/ui/ClientSearchSelect'

interface LineItem {
  id: string
  description: string
  qty: number
  unit_price: number
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

  // Client details
  const [selectedClientId, setSelectedClientId] = useState(invoice.client_id ?? '')
  const [clientName, setClientName] = useState(invoice.client?.name ?? '')
  const [clientCompany, setClientCompany] = useState(invoice.client?.company ?? '')
  const [clientEmail, setClientEmail] = useState(invoice.client?.email ?? '')
  const [clientPhone, setClientPhone] = useState(invoice.client?.phone ?? '')
  const [clientAddress, setClientAddress] = useState(invoice.client?.address ?? '')

  // Invoice details
  const [currency, setCurrency] = useState(invoice.currency ?? 'SAR')
  const [issueDate, setIssueDate] = useState(invoice.issue_date ?? new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(invoice.due_date ?? '')
  const [taxPercent, setTaxPercent] = useState(Number(invoice.tax_percent ?? 5))
  const [status, setStatus] = useState(invoice.status)

  // Line items
  const [items, setItems] = useState<LineItem[]>(
    (invoice.items && invoice.items.length > 0)
      ? invoice.items.map((i: any) => ({
          id: i.id || genId(),
          description: i.description ?? '',
          qty: Number(i.qty) || 1,
          unit_price: Number(i.unit_price) || 0,
          amount: Number(i.amount) || 0,
        }))
      : [{ id: genId(), description: '', qty: 1, unit_price: 0, amount: 0 }]
  )

  function handleClientSelect(id: string) {
    setSelectedClientId(id)
    const found = clients.find(c => c.id === id)
    if (found) {
      setClientName(found.name ?? '')
      setClientCompany(found.company ?? '')
      setClientEmail(found.email ?? '')
      setClientPhone(found.phone ?? '')
      setClientAddress(found.address ?? '')
    }
  }

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
      }).eq('id', selectedClientId)
    }

    const { error: invErr } = await supabase
      .from('invoices')
      .update({
        client_id: selectedClientId || invoice.client_id,
        currency,
        issue_date: issueDate,
        due_date: dueDate || null,
        subtotal,
        tax_percent: taxPercent,
        tax_amount: taxAmount,
        total,
        status: targetStatus,
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
        amount: item.amount,
        sort_order: idx,
      }))
    )

    setLoading(false)
    router.push(`/invoices/${invoice.id}`)
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => router.push(`/invoices/${invoice.id}`)}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-page-title">Edit {invoice.invoice_number}</h1>
            <p className="text-meta" style={{ marginTop: 2 }}>Modify items, pricing, tax or client details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => handleSave('DRAFT')} disabled={loading}>
            <Save size={14} /> Save Draft
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleSave('SENT')} disabled={loading}>
            <Send size={14} /> Save & Issue
          </button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="rg-main-sidebar-sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Client Info */}
            <div className="card">
              <div className="card-header"><span className="text-section-header">Client details</span></div>
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
                  <label className="form-label">Billing Address</label>
                  <textarea className="form-input" rows={3} value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} style={{ resize: 'vertical' }} />
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="card">
              <div className="card-header"><span className="text-section-header">Line items</span></div>
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
                            placeholder="Description"
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
                          placeholder="Description"
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
              <div className="card-footer">
                <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>
                  <Plus size={13} /> Add line item
                </button>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-header"><span className="text-section-header">Details</span></div>
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
