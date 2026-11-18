'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileSignature,
  ArrowLeft,
  Building2,
  DollarSign,
  Calendar,
  Layers,
  Eye,
  Save,
  Sparkles,
} from 'lucide-react'
import { SERVICE_PRESETS, DURATION_PRESETS } from '@/lib/constants/contractPresets'
import StandardContractTemplate from '@/components/contracts/StandardContractTemplate'
import ClientSearchSelect from '@/components/contracts/ClientSearchSelect'
import { createClient } from '@/lib/supabase/client'
import type { Contract } from '@/types/database'

interface ClientOption {
  id: string
  name: string
  company?: string | null
  email?: string | null
  phone?: string | null
  cr_number?: string | null
  vat_number?: string | null
  address?: string | null
}

interface Props {
  existingClients: ClientOption[]
  prefillData?: any
}

export default function ContractBuilderClient({ existingClients, prefillData }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form')

  // Client Details
  const [selectedClientId, setSelectedClientId] = useState<string>(prefillData?.clientId || '')
  const [clientName, setClientName] = useState(prefillData?.clientName || '')
  const [clientCompany, setClientCompany] = useState(prefillData?.clientCompany || '')
  const [clientEmail, setClientEmail] = useState(prefillData?.clientEmail || '')
  const [clientPhone, setClientPhone] = useState(prefillData?.clientPhone || '')
  const [clientAddress, setClientAddress] = useState(prefillData?.clientAddress || '')
  const [clientCr, setClientCr] = useState(prefillData?.clientCr || '')
  const [clientVat, setClientVat] = useState(prefillData?.clientVat || '')
  const [clientRepresentative, setClientRepresentative] = useState('')

  // Service Details
  const defaultService = SERVICE_PRESETS[0]
  const [servicePresetId, setServicePresetId] = useState<string>(defaultService.id)
  const [serviceTitle, setServiceTitle] = useState(prefillData?.serviceTitle || defaultService.titleEn)
  const [serviceTitleAr, setServiceTitleAr] = useState(defaultService.titleAr)
  const [serviceScope, setServiceScope] = useState(defaultService.scopeEn)
  const [serviceScopeAr, setServiceScopeAr] = useState(defaultService.scopeAr)

  // Duration & Dates
  const [termDuration, setTermDuration] = useState('1 Year (12 Months)')
  const [termDurationAr, setTermDurationAr] = useState('سنة واحدة (١٢ شهراً)')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')

  // Pricing & Commercials
  const [contractPrice, setContractPrice] = useState<number>(prefillData?.contractPrice || 12000)
  const [currency, setCurrency] = useState(prefillData?.currency || 'SAR')
  const [includeVat, setIncludeVat] = useState(true)
  const [billingCycle, setBillingCycle] = useState('MONTHLY')
  const [paymentTerms, setPaymentTerms] = useState('Monthly retainer due on the 1st of each calendar month via bank transfer.')
  const [paymentTermsAr, setPaymentTermsAr] = useState('دفعة شهرية مستحقة في اليوم الأول من كل شهر ميلادي بموجب تحويل بنكي.')
  const [officeLocation, setOfficeLocation] = useState<'KSA' | 'HYDERABAD'>('KSA')

  // Auto-calculate end date whenever start date or duration changes
  useEffect(() => {
    if (!startDate) return
    const d = new Date(startDate)
    if (isNaN(d.getTime())) return

    let monthsToAdd = 12
    if (termDuration.includes('6 Months')) monthsToAdd = 6
    else if (termDuration.includes('2 Years') || termDuration.includes('24 Months')) monthsToAdd = 24
    else if (termDuration.includes('25 Months')) monthsToAdd = 25
    else if (termDuration.includes('3 Months')) monthsToAdd = 3
    else if (termDuration.includes('1 Year')) monthsToAdd = 12

    const endD = new Date(d)
    endD.setMonth(endD.getMonth() + monthsToAdd)
    setEndDate(endD.toISOString().split('T')[0])
  }, [startDate, termDuration])

  // When client is selected from search dropdown, fill in fields
  function handleClientSelect(found: ClientOption | null) {
    if (!found) {
      setSelectedClientId('')
      return
    }
    setSelectedClientId(found.id)
    setClientName(found.name || '')
    setClientCompany(found.company || '')
    setClientEmail(found.email || '')
    setClientPhone(found.phone || '')
    setClientAddress(found.address || '')
    setClientCr(found.cr_number || '')
    setClientVat(found.vat_number || '')
    setClientRepresentative(found.name || '')
  }

  // When a service preset is picked
  function handlePresetChange(presetId: string) {
    setServicePresetId(presetId)
    const preset = SERVICE_PRESETS.find((p) => p.id === presetId)
    if (preset) {
      setServiceTitle(preset.titleEn)
      setServiceTitleAr(preset.titleAr)
      setServiceScope(preset.scopeEn)
      setServiceScopeAr(preset.scopeAr)
      setBillingCycle(preset.defaultBillingCycle)
    }
  }

  // When a duration preset chip is clicked
  function handleDurationSelect(preset: (typeof DURATION_PRESETS)[0]) {
    setTermDuration(preset.label)
    setTermDurationAr(preset.labelAr)
  }

  const taxAmount = includeVat ? Number((contractPrice * 0.15).toFixed(2)) : 0
  const totalWithTax = Number((contractPrice + taxAmount).toFixed(2))

  // Construct draft object for live preview
  const draftContract: Contract = {
    id: 'preview-mode',
    contract_number: 'ADX-CTR-DRAFT',
    client_name: clientName || 'Client Name / اسم العميل',
    client_company: clientCompany || null,
    client_email: clientEmail || null,
    client_phone: clientPhone || null,
    client_address: clientAddress || null,
    client_cr: clientCr || null,
    client_vat: clientVat || null,
    client_representative: clientRepresentative || clientName,
    service_title: serviceTitle,
    service_title_ar: serviceTitleAr,
    service_scope: serviceScope,
    service_scope_ar: serviceScopeAr,
    contract_price: contractPrice,
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
    end_date: endDate,
    office_location: officeLocation,
    status: 'DRAFT',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!clientName.trim()) {
      setError('Please provide the Client Name.')
      return
    }
    if (!serviceTitle.trim()) {
      setError('Please provide the Service Title.')
      return
    }

    setSubmitting(true)
    try {
      let activeClientId = selectedClientId

      // If no existing client was selected from search, insert or link directly via client Supabase session
      try {
        const supabase = createClient()
        if (!activeClientId) {
          if (clientEmail.trim()) {
            const { data: existingClient } = await supabase
              .from('clients')
              .select('id')
              .eq('email', clientEmail.trim().toLowerCase())
              .maybeSingle()
            if (existingClient?.id) {
              activeClientId = existingClient.id
            }
          }

          if (!activeClientId) {
            const { data: createdClient, error: clientErr } = await supabase
              .from('clients')
              .insert({
                name: clientName.trim(),
                company: clientCompany.trim() || null,
                email: clientEmail.trim() ? clientEmail.trim().toLowerCase() : null,
                phone: clientPhone.trim() || null,
                address: clientAddress.trim() || null,
                cr_number: clientCr.trim() || null,
                vat_number: clientVat.trim() || null,
                client_status: 'ACTIVE',
                contract_start_date: startDate || new Date().toISOString().slice(0, 10),
                contract_end_date: endDate || null,
                billing_amount: Number(contractPrice) || 0,
                billing_cycle: billingCycle || 'MONTHLY',
              })
              .select('id')
              .single()

            if (!clientErr && createdClient?.id) {
              activeClientId = createdClient.id
            }
          }
        }
      } catch (clientSyncErr) {
        console.warn('Client frontend sync note:', clientSyncErr)
      }

      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: activeClientId || null,
          quotation_id: prefillData?.quotationId || null,
          client_name: clientName.trim(),
          client_company: clientCompany.trim() || null,
          client_email: clientEmail.trim() || null,
          client_phone: clientPhone.trim() || null,
          client_address: clientAddress.trim() || null,
          client_cr: clientCr.trim() || null,
          client_vat: clientVat.trim() || null,
          client_representative: clientRepresentative.trim() || clientName.trim(),
          service_title: serviceTitle.trim(),
          service_title_ar: serviceTitleAr.trim() || serviceTitle.trim(),
          service_scope: serviceScope.trim(),
          service_scope_ar: serviceScopeAr.trim() || serviceScope.trim(),
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
          office_location: officeLocation,
          status: 'DRAFT',
        }),
      })

      const data = await res.json()
      if (res.ok && data.success && data.contract?.id) {
        router.push(`/contracts/${data.contract.id}`)
      } else {
        setError(data.error || 'Failed to create contract')
        setSubmitting(false)
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred while saving contract')
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', paddingBottom: 60 }}>
      {/* Top Page Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => router.push('/contracts')}
            style={{ width: 32, height: 32, padding: 0, justifyContent: 'center' }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileSignature size={22} style={{ color: 'var(--accent)' }} />
              Create Bilingual Contract
            </h1>
            <p className="text-meta" style={{ marginTop: 2 }}>
              English &amp; Arabic Executive Services Agreement (عقد تقديم وإدارة خدمات رقمية)
            </p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div style={{ display: 'flex', gap: 6, background: 'var(--bg)', padding: 3, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'form' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('form')}
            style={{ padding: '4px 12px', fontSize: 12 }}
          >
            <Layers size={13} /> Contract Form
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'preview' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('preview')}
            style={{ padding: '4px 12px', fontSize: 12 }}
          >
            <Eye size={13} /> Live Bilingual Preview
          </button>
        </div>
      </div>

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

      {/* FORM TAB */}
      {activeTab === 'form' && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* 1. Client Details Card */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={18} style={{ color: 'var(--accent)' }} />
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  1. Client &amp; Contracting Party (الطرف الثاني)
                </h2>
              </div>

              {existingClients.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Auto-fill from client:</span>
                  <ClientSearchSelect
                    clients={existingClients}
                    selectedId={selectedClientId}
                    onSelect={handleClientSelect}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label className="form-label form-label-required">
                  Client Name / اسم العميل
                </label>
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
                <label className="form-label">
                  Company / Organization Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={clientCompany}
                  onChange={(e) => setClientCompany(e.target.value)}
                  placeholder="e.g. Al-Safwa Medical Group"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Authorized Signatory / Representative
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={clientRepresentative}
                  onChange={(e) => setClientRepresentative(e.target.value)}
                  placeholder="e.g. CEO / Managing Director"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Mobile / WhatsApp Phone
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="e.g. +966 53 849 8580"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Email Address
                </label>
                <input
                  type="email"
                  className="form-input"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="e.g. client@example.com"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  CR Number (السجل التجاري)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={clientCr}
                  onChange={(e) => setClientCr(e.target.value)}
                  placeholder="10-digit CR (optional)"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  VAT Number (الرقم الضريبي)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={clientVat}
                  onChange={(e) => setClientVat(e.target.value)}
                  placeholder="15-digit ZATCA VAT (optional)"
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">
                  Official Address / City (العنوان)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="e.g. Al Muruj District, Riyadh, Kingdom of Saudi Arabia"
                />
              </div>
            </div>
          </div>

          {/* 2. Service Scope Card */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} style={{ color: 'var(--accent)' }} />
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  2. Service &amp; Deliverables Scope (موضوع العقد ونطاق الخدمات)
                </h2>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>1-Click Presets:</span>
            </div>

            {/* Presets Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {SERVICE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`btn btn-sm ${servicePresetId === p.id ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => handlePresetChange(p.id)}
                  style={{ fontSize: 12, padding: '5px 12px' }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* English Scope */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label form-label-required">
                    Service Title (English)
                  </label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={serviceTitle}
                    onChange={(e) => setServiceTitle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Detailed Scope of Work (English)
                  </label>
                  <textarea
                    rows={8}
                    className="form-input"
                    value={serviceScope}
                    onChange={(e) => setServiceScope(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}
                  />
                </div>
              </div>

              {/* Arabic Scope */}
              <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                    style={{ textAlign: 'right' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ textAlign: 'right' }}>
                    نطاق العمل ومخرجاته (باللغة العربية)
                  </label>
                  <textarea
                    rows={8}
                    className="form-input"
                    value={serviceScopeAr}
                    onChange={(e) => setServiceScopeAr(e.target.value)}
                    style={{ textAlign: 'right', fontSize: 12.5, lineHeight: 1.6 }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Duration & Term Card */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 14 }}>
              <Calendar size={18} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                3. Contract Duration &amp; Term (مدة العقد وسريانه)
              </h2>
            </div>

            {/* Quick chips */}
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                Pick Standard Duration:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {DURATION_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleDurationSelect(preset)}
                    className={`btn btn-sm ${termDuration === preset.label ? 'btn-primary' : 'btn-outline'}`}
                    style={{ fontSize: 12 }}
                  >
                    {preset.label} <span style={{ opacity: 0.7 }}>({preset.labelAr})</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label className="form-label form-label-required">Duration (English)</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={termDuration}
                  onChange={(e) => setTermDuration(e.target.value)}
                  placeholder="e.g. 1 Year (12 Months) or 25 Months"
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
                  style={{ textAlign: 'right' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label form-label-required">Start Date (تاريخ البدء)</label>
                <input
                  type="date"
                  required
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">End Date (تاريخ الانتهاء)</label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 4. Financials & Commercials Card */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 14 }}>
              <DollarSign size={18} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                4. Financial Value &amp; Payment Schedule (المقابل المالي وطريقة السداد)
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label form-label-required">Contract Price / Fee</label>
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
                <label className="form-label">Currency</label>
                <select
                  className="form-select"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="SAR">SAR - Saudi Riyal (ر.س)</option>
                  <option value="USD">USD - US Dollar ($)</option>
                  <option value="AED">AED - UAE Dirham (د.إ)</option>
                  <option value="INR">INR - Indian Rupee (₹)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Billing Cycle</label>
                <select
                  className="form-select"
                  value={billingCycle}
                  onChange={(e) => setBillingCycle(e.target.value)}
                >
                  <option value="MONTHLY">Monthly Retainer (شهري)</option>
                  <option value="ONE_TIME">One-Time Project Fee (دفعة واحدة)</option>
                  <option value="QUARTERLY">Quarterly (ربع سنوي)</option>
                  <option value="ANNUAL">Annual (سنوي)</option>
                  <option value="MILESTONES">Milestone Based (حسب المراحل)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Office Location</label>
                <select
                  className="form-select"
                  value={officeLocation}
                  onChange={(e) => setOfficeLocation(e.target.value as any)}
                >
                  <option value="KSA">🇸🇦 Asaheeb &amp; Adonix (Riyadh, KSA)</option>
                  <option value="HYDERABAD">🇮🇳 Adonix Digital Tech (Hyderabad, India)</option>
                </select>
              </div>
            </div>

            {/* VAT Box */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 18px',
                background: 'var(--bg)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={includeVat}
                  onChange={(e) => setIncludeVat(e.target.checked)}
                />
                Apply 15% ZATCA Value Added Tax (VAT / ضريبة القيمة المضافة)
              </label>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Price: {contractPrice.toLocaleString()} {currency} + VAT (15%): {taxAmount.toLocaleString()} {currency}
                </span>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
                  Total Value: {totalWithTax.toLocaleString()} {currency}
                </div>
              </div>
            </div>
          </div>

          {/* Form Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 8 }}>
            <Link href="/contracts" className="btn btn-outline">
              Cancel
            </Link>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setActiveTab('preview')}
            >
              <Eye size={14} /> Preview Document
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ minWidth: 150, justifyContent: 'center' }}
            >
              <Save size={14} />
              {submitting ? 'Generating...' : 'Create Contract (حفظ العقد)'}
            </button>
          </div>
        </form>
      )}

      {/* PREVIEW TAB */}
      {activeTab === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              padding: '10px 16px',
              background: 'var(--accent-light)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)',
              fontSize: 12.5,
              color: 'var(--accent)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>
              <strong>Live Preview Mode:</strong> This is how your client will view the official bilingual agreement. You can switch back to the form to modify any clause.
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Back to Form
            </button>
          </div>

          <StandardContractTemplate
            contract={draftContract}
            officeLocation={officeLocation}
          />
        </div>
      )}
    </div>
  )
}
