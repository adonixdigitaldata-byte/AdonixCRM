'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileSignature,
  ArrowLeft,
  Building2,
  DollarSign,
  Calendar,
  Save,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import { DURATION_PRESETS, SERVICE_PRESETS } from '@/lib/constants/contractPresets'
import type { Contract, ContractStatus } from '@/types/database'

interface Props {
  contract: Contract
}

export default function ContractEditClient({ contract }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fields
  const [clientName, setClientName] = useState(contract.client_name || '')
  const [clientCompany, setClientCompany] = useState(contract.client_company || '')
  const [clientEmail, setClientEmail] = useState(contract.client_email || '')
  const [clientPhone, setClientPhone] = useState(contract.client_phone || '')
  const [clientAddress, setClientAddress] = useState(contract.client_address || '')
  const [clientCr, setClientCr] = useState(contract.client_cr || '')
  const [clientVat, setClientVat] = useState(contract.client_vat || '')
  const [clientRepresentative, setClientRepresentative] = useState(contract.client_representative || '')

  const [serviceTitle, setServiceTitle] = useState(contract.service_title || '')
  const [serviceTitleAr, setServiceTitleAr] = useState(contract.service_title_ar || '')
  const [serviceScope, setServiceScope] = useState(contract.service_scope || '')
  const [serviceScopeAr, setServiceScopeAr] = useState(contract.service_scope_ar || '')

  const [termDuration, setTermDuration] = useState(contract.term_duration || '1 Year (12 Months)')
  const [termDurationAr, setTermDurationAr] = useState(contract.term_duration_ar || 'سنة واحدة (١٢ شهراً)')
  const [startDate, setStartDate] = useState(contract.start_date || new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(contract.end_date || '')

  const [contractPrice, setContractPrice] = useState<number>(contract.contract_price || 0)
  const [currency, setCurrency] = useState(contract.currency || 'SAR')
  const [includeVat, setIncludeVat] = useState(contract.tax_percent > 0)
  const [billingCycle, setBillingCycle] = useState(contract.billing_cycle || 'MONTHLY')
  const [paymentTerms, setPaymentTerms] = useState(contract.payment_terms || 'Monthly retainer due on the 1st of each calendar month via bank transfer.')
  const [paymentTermsAr, setPaymentTermsAr] = useState(contract.payment_terms_ar || 'دفعة شهرية مستحقة في اليوم الأول من كل شهر ميلادي بموجب تحويل بنكي.')
  const [status, setStatus] = useState<ContractStatus>(contract.status || 'DRAFT')

  const taxAmount = includeVat ? Number((contractPrice * 0.15).toFixed(2)) : 0
  const totalWithTax = Number((contractPrice + taxAmount).toFixed(2))

  const isSigned = status === 'SIGNED' || status === 'ACTIVE'

  function applyPreset(idx: number) {
    const p = SERVICE_PRESETS[idx]
    if (!p) return
    setServiceTitle(p.titleEn)
    setServiceTitleAr(p.titleAr)
    setServiceScope(p.scopeEn)
    setServiceScopeAr(p.scopeAr)
  }

  function applyDuration(idx: number) {
    const d = DURATION_PRESETS[idx]
    if (!d) return
    setTermDuration(d.label)
    setTermDurationAr(d.labelAr)

    // Compute end date automatically
    if (startDate) {
      const start = new Date(startDate)
      const end = new Date(start)
      end.setMonth(end.getMonth() + d.months)
      setEndDate(end.toISOString().split('T')[0])
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch(`/api/contracts/${contract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: clientName.trim(),
          client_company: clientCompany.trim() || null,
          client_email: clientEmail.trim() || null,
          client_phone: clientPhone.trim() || null,
          client_address: clientAddress.trim() || null,
          client_cr: clientCr.trim() || null,
          client_vat: clientVat.trim() || null,
          client_representative: clientRepresentative.trim() || null,
          service_title: serviceTitle.trim(),
          service_title_ar: serviceTitleAr.trim(),
          service_scope: serviceScope.trim(),
          service_scope_ar: serviceScopeAr.trim(),
          contract_price: Number(contractPrice) || 0,
          currency,
          tax_percent: includeVat ? 15.0 : 0,
          tax_amount: taxAmount,
          total_with_tax: totalWithTax,
          billing_cycle: billingCycle,
          payment_terms: paymentTerms,
          payment_terms_ar: paymentTermsAr,
          term_duration: termDuration,
          term_duration_ar: termDurationAr,
          start_date: startDate,
          end_date: endDate || null,
          status,
        }),
      })

      const data = await res.json()
      if (res.ok && data.contract) {
        router.push(`/contracts/${contract.id}`)
      } else {
        setError(data.error || 'Failed to update contract')
        setSubmitting(false)
      }
    } catch (err: any) {
      setError(err.message || 'Error saving changes')
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 1060, margin: '0 auto', paddingBottom: 60 }}>
      {/* Top Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => router.push(`/contracts/${contract.id}`)}
              style={{ width: 32, height: 32, padding: 0, justifyContent: 'center' }}
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileSignature size={22} style={{ color: 'var(--accent)' }} />
                Edit Contract — {contract.contract_number}
              </h1>
              <p className="text-meta" style={{ marginTop: 2 }}>
                Modify contract terms, deliverables, pricing, or client information.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              className={`badge ${
                isSigned
                  ? 'badge-success'
                  : status === 'SENT'
                  ? 'badge-info'
                  : 'badge-default'
              }`}
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              Status: {status}
            </span>
          </div>
        </div>
      </div>

      {/* Signature Alert Banner if signed */}
      {isSigned && (
        <div
          style={{
            padding: '14px 18px',
            background: 'var(--success-light)',
            border: '1.5px solid var(--success)',
            borderRadius: 'var(--radius)',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <ShieldCheck size={22} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            <strong style={{ color: 'var(--success)' }}>Contract is Digitally Signed &amp; Active</strong>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: 12 }}>
              Signed by <strong>{contract.signed_by_name || contract.client_name}</strong>
              {contract.signed_at ? ` on ${new Date(contract.signed_at).toLocaleString()}` : ''}.
              {contract.signature_notes && ` (${contract.signature_notes})`}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--danger-light)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius)',
            fontSize: 13,
            color: 'var(--danger)',
            marginBottom: 20,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Section 1: Client & Contracting Party Details */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 18 }}>
            <Building2 size={18} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              1. Client &amp; Contracting Party Details (بيانات العميل والطرف الثاني)
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div className="form-group">
              <label className="form-label form-label-required">Client Name / اسم العميل</label>
              <input
                type="text"
                required
                className="form-input"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Dr. Sufyan Al-Ghamdi"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Company / Organization (الشركة أو المؤسسة)</label>
              <input
                type="text"
                className="form-input"
                value={clientCompany}
                onChange={(e) => setClientCompany(e.target.value)}
                placeholder="e.g. Medical Care Entrepreneurs Company"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Authorized Signatory / المفوض بالتوقيع</label>
              <input
                type="text"
                className="form-input"
                value={clientRepresentative}
                onChange={(e) => setClientRepresentative(e.target.value)}
                placeholder="e.g. Dr. Sufyan (Managing Director)"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone / WhatsApp / رقم الهاتف</label>
              <input
                type="text"
                className="form-input"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="e.g. +966 53 849 8580"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address / البريد الإلكتروني</label>
              <input
                type="email"
                className="form-input"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="e.g. info@client.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">CR Number / السجل التجاري</label>
              <input
                type="text"
                className="form-input"
                value={clientCr}
                onChange={(e) => setClientCr(e.target.value)}
                placeholder="10-digit Commercial Registration #"
              />
            </div>

            <div className="form-group">
              <label className="form-label">VAT Number / الرقم الضريبي</label>
              <input
                type="text"
                className="form-input"
                value={clientVat}
                onChange={(e) => setClientVat(e.target.value)}
                placeholder="15-digit ZATCA VAT Number"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Physical Address / العنوان الوطني</label>
              <input
                type="text"
                className="form-input"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="e.g. Jeddah / Riyadh, Saudi Arabia"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Service & Scope */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                2. Service &amp; Deliverables Scope (موضوع العقد ونطاق الخدمات)
              </h2>
            </div>

            {/* Service Template Chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SERVICE_PRESETS.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(idx)}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: 11, padding: '4px 10px', height: 'auto' }}
                  title="Click to apply preset"
                >
                  {p.label.split('&')[0]}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* English Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label form-label-required">Service Title (English)</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={serviceTitle}
                  onChange={(e) => setServiceTitle(e.target.value)}
                  placeholder="e.g. Full-Stack Digital Marketing & Paid Advertising"
                />
              </div>

              <div className="form-group">
                <label className="form-label form-label-required">Scope of Work (English)</label>
                <textarea
                  rows={8}
                  required
                  className="form-input"
                  value={serviceScope}
                  onChange={(e) => setServiceScope(e.target.value)}
                  placeholder="• Key deliverable 1&#10;• Key deliverable 2&#10;• Monthly reporting"
                  style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}
                />
              </div>
            </div>

            {/* Arabic Column */}
            <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label form-label-required" style={{ textAlign: 'right' }}>
                  مسمى الخدمة (باللغة العربية)
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={serviceTitleAr}
                  onChange={(e) => setServiceTitleAr(e.target.value)}
                  placeholder="مثال: إدارة الحملات الإعلانية والتسويق الرقمي المتكامل"
                  style={{ textAlign: 'right' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label form-label-required" style={{ textAlign: 'right' }}>
                  نطاق العمل ومخرجات الخدمات (باللغة العربية)
                </label>
                <textarea
                  rows={8}
                  required
                  className="form-input"
                  value={serviceScopeAr}
                  onChange={(e) => setServiceScopeAr(e.target.value)}
                  placeholder="• البند الأول من نطاق العمل&#10;• إعداد الحملات والتقارير الشهرية&#10;• المتابعة الدورية"
                  style={{ textAlign: 'right', fontSize: 12.5, lineHeight: 1.6 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Commercial Terms, Duration & Pricing */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16 }}>
            <DollarSign size={18} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              3. Commercial Terms, Duration &amp; Financials (المدة والمقابل المالي)
            </h2>
          </div>

          {/* Duration Chips */}
          <div style={{ marginBottom: 18 }}>
            <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Quick Duration Presets / مدد العقود الشائعة</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {DURATION_PRESETS.map((d, idx) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => applyDuration(idx)}
                  className={`btn btn-sm ${termDuration === d.label ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: 11.5 }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label form-label-required">Duration (English)</label>
              <input
                type="text"
                required
                className="form-input"
                value={termDuration}
                onChange={(e) => setTermDuration(e.target.value)}
                placeholder="e.g. 1 Year (12 Months), 25 Months, 6 Months"
              />
            </div>

            <div className="form-group" dir="rtl">
              <label className="form-label form-label-required" style={{ textAlign: 'right' }}>المدة (باللغة العربية)</label>
              <input
                type="text"
                required
                className="form-input"
                value={termDurationAr}
                onChange={(e) => setTermDurationAr(e.target.value)}
                placeholder="مثال: سنة واحدة (١٢ شهراً) أو ٢٥ شهراً"
                style={{ textAlign: 'right' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label form-label-required">Start Date / تاريخ البداية</label>
              <input
                type="date"
                required
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">End Date / تاريخ الانتهاء</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Pricing Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label form-label-required">Contract Price / القيمة</label>
              <input
                type="number"
                min="0"
                step="any"
                required
                className="form-input"
                value={contractPrice}
                onChange={(e) => setContractPrice(parseFloat(e.target.value) || 0)}
                style={{ fontWeight: 700, fontFamily: 'monospace' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Currency / العملة</label>
              <select
                className="form-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{ fontWeight: 600 }}
              >
                <option value="SAR">SAR — Saudi Riyal (ر.س)</option>
                <option value="AED">AED — UAE Dirham (د.إ)</option>
                <option value="USD">USD — US Dollar ($)</option>
                <option value="INR">INR — Indian Rupee (₹)</option>
                <option value="EUR">EUR — Euro (€)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Contract Status / حالة العقد</label>
              <select
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as ContractStatus)}
                style={{ fontWeight: 600 }}
              >
                <option value="DRAFT">DRAFT (مسودة)</option>
                <option value="SENT">SENT (تم الإرسال للعميل)</option>
                <option value="SIGNED">SIGNED (موقع إلكترونياً)</option>
                <option value="ACTIVE">ACTIVE (ساري المفعول)</option>
                <option value="EXPIRED">EXPIRED (منتهي الصلاحية)</option>
                <option value="TERMINATED">TERMINATED (ملغى / مفسوخ)</option>
              </select>
            </div>
          </div>

          {/* VAT Toggle & Summary Box */}
          <div
            style={{
              padding: 14,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={includeVat}
                onChange={(e) => setIncludeVat(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <span>Apply 15% VAT (تطبيق ضريبة القيمة المضافة ١٥٪)</span>
            </label>

            <div style={{ display: 'flex', gap: 16, fontSize: 12.5 }}>
              <span>Subtotal: <strong>{contractPrice.toLocaleString()} {currency}</strong></span>
              {includeVat && <span>VAT (15%): <strong>{taxAmount.toLocaleString()} {currency}</strong></span>}
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Total: {totalWithTax.toLocaleString()} {currency}</span>
            </div>
          </div>

          {/* Billing Cycle & Payment Terms */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Billing Cycle / دورية الفوترة</label>
              <select
                className="form-select"
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value)}
              >
                <option value="MONTHLY">Monthly / شهري</option>
                <option value="QUARTERLY">Quarterly / ربع سنوي</option>
                <option value="SEMI_ANNUAL">Semi-Annual / نصف سنوي</option>
                <option value="ANNUAL">Annual / سنوي</option>
                <option value="ONE_TIME">One-Time Retainer / دفعة واحدة</option>
                <option value="MILESTONE">Milestone-Based / حسب الإنجاز</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Terms (English)</label>
              <input
                type="text"
                className="form-input"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
              />
            </div>

            <div className="form-group" dir="rtl">
              <label className="form-label" style={{ textAlign: 'right' }}>شروط وطريقة السداد (بالعربية)</label>
              <input
                type="text"
                className="form-input"
                value={paymentTermsAr}
                onChange={(e) => setPaymentTermsAr(e.target.value)}
                style={{ textAlign: 'right' }}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 8 }}>
          <Link href={`/contracts/${contract.id}`} className="btn btn-outline">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{ minWidth: 150, justifyContent: 'center' }}
          >
            <Save size={14} />
            {submitting ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
