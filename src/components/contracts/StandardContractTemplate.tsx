'use client'

import React from 'react'
import { format } from 'date-fns'
import type { Contract } from '@/types/database'
import { OFFICE_LOCATIONS, type OfficeLocationKey } from '@/lib/constants/officeLocations'
import { numberToWords, numberToArabicWords } from '@/lib/utils/numberToWords'
import { CheckCircle2, ShieldCheck } from 'lucide-react'

interface Props {
  contract: Contract
  officeLocation?: OfficeLocationKey
  hideActions?: boolean
}

export default function StandardContractTemplate({
  contract,
  officeLocation = 'KSA',
}: Props) {
  const currentOffice = OFFICE_LOCATIONS[officeLocation] || OFFICE_LOCATIONS.KSA
  const isKsa = officeLocation === 'KSA'
  const curr = contract.currency || (isKsa ? 'SAR' : 'INR')

  const total = Number(contract.total_with_tax || contract.contract_price) || 0
  const subtotal = Number(contract.contract_price) || 0
  const taxAmount = Number(contract.tax_amount) || 0

  const formattedStartDate = contract.start_date
    ? format(new Date(contract.start_date), 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd')

  const formattedEndDate = contract.end_date
    ? format(new Date(contract.end_date), 'yyyy-MM-dd')
    : 'Ongoing / Auto-Renewing'

  const amountInWordsEn = numberToWords(total, curr)
  const amountInWordsAr = isKsa ? numberToArabicWords(total, curr) : ''

  const isSigned = contract.status === 'SIGNED' || contract.status === 'ACTIVE'

  return (
    <div className="prem-contract-wrapper" style={{ background: '#f8fafc', padding: '24px 12px' }}>
      <div
        className="prem-contract-sheet"
        style={{
          background: '#ffffff',
          color: '#18181b',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          border: '1px solid #d4d4d8',
          borderRadius: 8,
          maxWidth: 960,
          margin: '0 auto',
          padding: '36px 44px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
          boxSizing: 'border-box',
          lineHeight: 1.55,
        }}
      >
        {/* =========================================================================
            PAGE 1: PARTIES, TITLE, SCOPE & DURATION (CRISP PRINT A4 PAGE 1)
            ========================================================================= */}
        <div className="prem-contract-page-1">
          {/* HEADER: COMPANY BRANDING & OFFICIAL CREDENTIALS */}
          <div
            className="prem-contract-header"
            style={{
              borderBottom: '2.5px solid #0f172a',
              paddingBottom: 16,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 14,
                marginBottom: 12,
              }}
            >
              {/* English Brand Identity */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img
                  src="/logo.png"
                  alt="Adonix Logo"
                  style={{ height: 44, width: 'auto', objectFit: 'contain' }}
                />
                <div>
                  <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                    {currentOffice.legalNameEn}
                  </h1>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#6366f1', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    ADONIX DIGITAL DEVELOPMENTS
                  </div>
                </div>
              </div>

              {/* Arabic Brand Identity */}
              <div dir="rtl" style={{ textAlign: 'right' }}>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                  {currentOffice.legalNameAr}
                </h1>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b' }}>
                  الرياض · المملكة العربية السعودية
                </div>
              </div>
            </div>

            {/* Registration Numbers Strip */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                padding: '7px 12px',
                fontSize: 11,
                color: '#475569',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div>
                <strong style={{ color: '#0f172a' }}>CR / السجل التجاري:</strong> {currentOffice.crNumber || '7055349166'}
              </div>
              <div>
                <strong style={{ color: '#0f172a' }}>VAT / الرقم الضريبي:</strong> {currentOffice.vatNumber || '315081325900003'}
              </div>
              <div>
                <strong style={{ color: '#0f172a' }}>Ref / رقم العقد:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#4f46e5' }}>{contract.contract_number}</span>
              </div>
              <div>
                <strong style={{ color: '#0f172a' }}>Date / التاريخ:</strong> {formattedStartDate}
              </div>
            </div>
          </div>

          {/* DOCUMENT TITLE: BILINGUAL AGREEMENT BANNER */}
          <div
            className="prem-contract-banner"
            style={{
              textAlign: 'center',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
              color: '#ffffff',
              borderRadius: 6,
              padding: '12px 16px',
              marginBottom: 16,
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 }}>
              PROFESSIONAL SERVICES &amp; DIGITAL MANAGEMENT AGREEMENT
            </div>
            <div dir="rtl" style={{ fontSize: 15, fontWeight: 700, color: '#cbd5e1' }}>
              عقد تقديم وإدارة خدمات رقمية وبرمجية متخصصة
            </div>
          </div>

          {/* STATUS BADGE & DURATION STRIP */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              padding: '8px 14px',
              background: isSigned ? '#ecfdf5' : '#f1f5f9',
              border: `1px solid ${isSigned ? '#a7f3d0' : '#cbd5e1'}`,
              borderRadius: 6,
              fontSize: 11.5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isSigned ? (
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              ) : (
                <span style={{ height: 8, width: 8, borderRadius: '50%', background: '#6366f1' }} />
              )}
              <span style={{ fontWeight: 700, color: isSigned ? '#065f46' : '#334155' }}>
                Contract Status / حالة العقد: {contract.status}
              </span>
            </div>

            <div style={{ fontWeight: 600, color: '#334155' }}>
              Duration / المدة: <strong style={{ color: '#4f46e5' }}>{contract.term_duration}</strong> ({contract.term_duration_ar})
            </div>
          </div>

          {/* CONTRACTING PARTIES (DUAL BOX) */}
          <div className="prem-contract-parties" style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 800,
                color: '#0f172a',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8,
                borderBottom: '1.5px solid #e2e8f0',
                paddingBottom: 3,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Contracting Parties</span>
              <span dir="rtl">أطراف العقد</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 12,
              }}
            >
              {/* FIRST PARTY (ADONIX) */}
              <div
                style={{
                  border: '1.5px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '12px 14px',
                  background: '#fafafa',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase' }}>
                    First Party (Service Provider)
                  </span>
                  <span dir="rtl" style={{ fontSize: 11, fontWeight: 800, color: '#4338ca' }}>
                    الطرف الأول (مقدم الخدمة)
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 1 }}>
                  {currentOffice.legalNameEn}
                </div>
                <div dir="rtl" style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  {currentOffice.legalNameAr}
                </div>
                <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.45 }}>
                  <div><strong>CR:</strong> {currentOffice.crNumber || '7055349166'} · <strong>VAT:</strong> {currentOffice.vatNumber || '315081325900003'}</div>
                  <div><strong>Address:</strong> {currentOffice.address}</div>
                  <div><strong>Representative:</strong> Nabeel Syed Yousuf (Executive Signatory)</div>
                  <div><strong>Email:</strong> {currentOffice.email || 'contact@adonixdigital.com'}</div>
                </div>
              </div>

              {/* SECOND PARTY (CLIENT) */}
              <div
                style={{
                  border: '1.5px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '12px 14px',
                  background: '#ffffff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>
                    Second Party (Client)
                  </span>
                  <span dir="rtl" style={{ fontSize: 11, fontWeight: 800, color: '#059669' }}>
                    الطرف الثاني (العميل)
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 1 }}>
                  {contract.client_company || contract.client_name}
                </div>
                {contract.client_company && (
                  <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 4 }}>
                    Contact Person: <strong>{contract.client_name}</strong>
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.45 }}>
                  {contract.client_cr && <div><strong>CR / السجل التجاري:</strong> {contract.client_cr}</div>}
                  {contract.client_vat && <div><strong>VAT / الرقم الضريبي:</strong> {contract.client_vat}</div>}
                  {contract.client_representative && <div><strong>Representative:</strong> {contract.client_representative}</div>}
                  {contract.client_address && <div><strong>Address:</strong> {contract.client_address}</div>}
                  <div>
                    <strong>Contact:</strong> {[contract.client_phone, contract.client_email].filter(Boolean).join(' · ') || 'Provided on File'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CLAUSE 1: SCOPE OF SERVICES */}
          <div className="prem-contract-clause" style={{ marginBottom: 16, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* English */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 4, textTransform: 'uppercase' }}>
                  Clause 1: Scope of Services &amp; Deliverables
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#4338ca', marginBottom: 4 }}>
                  {contract.service_title}
                </div>
                <div style={{ fontSize: 11, color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {contract.service_scope}
                </div>
              </div>

              {/* Arabic */}
              <div dir="rtl" style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                  البند الأول: موضوع العقد ونطاق الخدمات
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#4338ca', marginBottom: 4 }}>
                  {contract.service_title_ar || contract.service_title}
                </div>
                <div style={{ fontSize: 11, color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {contract.service_scope_ar || contract.service_scope}
                </div>
              </div>
            </div>
          </div>

          {/* CLAUSE 2: CONTRACT TERM & DURATION */}
          <div className="prem-contract-clause" style={{ marginBottom: 16, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* English */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 4, textTransform: 'uppercase' }}>
                  Clause 2: Contract Term &amp; Effective Dates
                </div>
                <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.5 }}>
                  This Agreement takes effect on <strong>{formattedStartDate}</strong> and shall continue in full force for the duration of <strong>{contract.term_duration}</strong>, ending on <strong>{formattedEndDate}</strong>. The Agreement shall automatically renew for an equivalent period under the same commercial conditions unless either party delivers written notice of non-renewal at least thirty (30) days prior to the expiration date.
                </div>
              </div>

              {/* Arabic */}
              <div dir="rtl" style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                  البند الثاني: مدة العقد وسريانه
                </div>
                <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.5 }}>
                  تسري أحكام هذا العقد اعتباراً من تاريخ <strong>{formattedStartDate}</strong> ولمدة <strong>{contract.term_duration_ar || contract.term_duration}</strong> تنتهي في <strong>{formattedEndDate}</strong>. ويتجدد العقد تلقائياً لمدد مماثلة وبذات الشروط والأحكام ما لم يُخطر أحد الطرفين الآخر كتابياً برغبته في عدم التجديد قبل ثلاثين (٣٠) يوماً على الأقل من تاريخ انتهاء المدة السارية.
                </div>
              </div>
            </div>
          </div>

          {/* PAGE 1 FOOTER STRIP */}
          <div
            style={{
              marginTop: 14,
              paddingTop: 10,
              borderTop: '1px dashed #cbd5e1',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 10,
              color: '#94a3b8',
            }}
          >
            <span>Contract Ref: {contract.contract_number} · Asaheeb and Adonix Developments</span>
            <span>Page 1 of 2 / الصفحة الأولى من ٢</span>
          </div>
        </div>

        {/* =========================================================================
            PAGE 2: FINANCIAL VALUE, CLAUSES 3-7 & SIGNATURES (CRISP PRINT A4 PAGE 2)
            ========================================================================= */}
        <div className="prem-contract-page-2">
          {/* PAGE 2 RUNNING HEADER */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: 8,
              marginBottom: 14,
              fontSize: 10.5,
              color: '#64748b',
            }}
          >
            <span><strong>Adonix Developments</strong> · Ref: <span style={{ fontFamily: 'monospace', color: '#4f46e5', fontWeight: 700 }}>{contract.contract_number}</span></span>
            <span>Professional Services &amp; Digital Management Agreement · Page 2 of 2</span>
          </div>

          {/* CLAUSE 3: FINANCIAL VALUE & PAYMENT TERMS */}
          <div
            className="prem-contract-clause"
            style={{
              marginBottom: 14,
              background: '#faf5ff',
              border: '1.5px solid #e9d5ff',
              borderRadius: 6,
              padding: '12px 16px',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 8 }}>
              {/* English */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#581c87', marginBottom: 4, textTransform: 'uppercase' }}>
                  Clause 3: Financial Consideration &amp; Payment Schedule
                </div>
                <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.5 }}>
                  The total consideration for the services is <strong>{total.toLocaleString()} {curr}</strong> (including {contract.tax_percent}% VAT).
                  {amountInWordsEn && <div style={{ fontSize: 10.5, color: '#6b21a8', fontStyle: 'italic', marginTop: 2 }}>({amountInWordsEn})</div>}
                  <div style={{ marginTop: 4 }}>
                    <strong>Billing Cycle:</strong> {contract.billing_cycle || 'Monthly'}<br />
                    <strong>Payment Terms:</strong> {contract.payment_terms || 'Payment via direct bank transfer upon issuance of tax invoice.'}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, color: '#6b21a8', borderTop: '1px dashed #d8b4fe', paddingTop: 4, lineHeight: 1.45 }}>
                    <strong>Additional Costs &amp; Ad Spend:</strong> The agreed contract value strictly covers the professional services defined in Clause 1. Any additional external costs—including third-party advertising spend (paid ad budgets on Meta/Google/TikTok), governmental/regulatory fees, specialized third-party licenses, domain/hosting charges, or out-of-scope requests—are not included and shall be borne separately by the Second Party subject to prior approval.
                  </div>
                </div>
              </div>

              {/* Arabic */}
              <div dir="rtl" style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#581c87', marginBottom: 4 }}>
                  البند الثالث: المقابل المالي وطريقة السداد
                </div>
                <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.5 }}>
                  إجمالي القيمة المالية للعقد تبلغ <strong>{total.toLocaleString()} {curr}</strong> (شاملة ضريبة القيمة المضافة {contract.tax_percent}٪).
                  {amountInWordsAr && <div style={{ fontSize: 10.5, color: '#6b21a8', marginTop: 2 }}>({amountInWordsAr})</div>}
                  <div style={{ marginTop: 4 }}>
                    <strong>دورية الفوترة:</strong> {contract.billing_cycle === 'MONTHLY' ? 'شهري' : contract.billing_cycle === 'ANNUAL' ? 'سنوي' : 'حسب الدفعات'}<br />
                    <strong>آلية السداد:</strong> {contract.payment_terms_ar || contract.payment_terms || 'يتم السداد بموجب تحويل بنكي رسمي عند صدور الفاتورة الضريبية.'}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, color: '#6b21a8', borderTop: '1px dashed #d8b4fe', paddingTop: 4, lineHeight: 1.45 }}>
                    <strong>المصروفات الإضافية وميزانيات الإعلانات:</strong> يقتصر المقابل المالي المحدد على أتعاب الخدمات المهنية المبينة في البند الأول حصراً. ولا تشمل القيمة أي تكاليف خارجية إضافية—بما في ذلك ميزانيات الحملات الإعلانية الممولة (Ad Spend عبر ميتا وجوجل وتيك توك)، أو الرسوم الحكومية، أو تراخيص البرمجيات الخارجية، أو استضافة النطاقات، أو أي خدمات خارج النطاق؛ وتتحملها المنشأة الطرف الثاني بشكل مستقل ومباشر بموجب موافقة مسبقة.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CLAUSE 4: OBLIGATIONS OF THE PARTIES */}
          <div className="prem-contract-clause" style={{ marginBottom: 12, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* English */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 4, textTransform: 'uppercase' }}>
                  Clause 4: Mutual Obligations &amp; Delivery Standards
                </div>
                <div style={{ fontSize: 10.5, color: '#334155', lineHeight: 1.45 }}>
                  • <strong>First Party:</strong> Deploys qualified personnel, maintains professional industry standards, delivers regular operational reports, and ensures strict confidentiality.<br />
                  • <strong>Second Party:</strong> Supplies brand assets, product data, required administrative access, and feedback within three (3) business days, and ensures timely financial settlement.<br />
                  • <strong>Client Delays &amp; Project Timelines:</strong> Any delay or inaction by the Second Party in delivering necessary materials, brand assets, technical access, or written approvals beyond the agreed timeframes shall automatically extend the project delivery schedule, launch dates, and operational milestones by a duration equivalent to such delay, without liability or penalty on the First Party.
                </div>
              </div>

              {/* Arabic */}
              <div dir="rtl" style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                  البند الرابع: التزامات وحقوق الطرفين
                </div>
                <div style={{ fontSize: 10.5, color: '#334155', lineHeight: 1.45 }}>
                  • <strong>الطرف الأول:</strong> توفير الكوادر المتخصصة، والالتزام بالمعايير المهنية، وتقديم التقارير الدورية عن سير العمل، وحماية سرية بيانات العميل.<br />
                  • <strong>الطرف الثاني:</strong> تزويد الطرف الأول بكافة البيانات والصلاحيات والمواد التسويقية خلال ثلاثة (٣) أيام عمل، والالتزام بمواعيد السداد المعتمدة.<br />
                  • <strong>تأخر العميل وأثره على الجدول الزمني:</strong> أي تأخير أو تراخٍ من قِبل الطرف الثاني في توفير البيانات أو المواد أو الصلاحيات الفنية أو الاعتمادات المطلوبة عن المواعيد المحددة يترتب عليه تلقائياً تمديد الجدول الزمني لتنفيذ المشروع ومراحله بما يعادل مدة التأخير، دون أدنى مسؤولية أو التزام بتعويض على الطرف الأول.
                </div>
              </div>
            </div>
          </div>

          {/* CLAUSE 5: INTELLECTUAL PROPERTY & CONFIDENTIALITY */}
          <div className="prem-contract-clause" style={{ marginBottom: 12, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* English */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 4, textTransform: 'uppercase' }}>
                  Clause 5: Intellectual Property &amp; Confidentiality
                </div>
                <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.5 }}>
                  All customized final creative deliverables and work produced specifically for the Second Party shall transfer to the Second Party upon receipt of full payment. Both parties commit to strictly protect confidential business information and trade secrets indefinitely.
                </div>
              </div>

              {/* Arabic */}
              <div dir="rtl" style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                  البند الخامس: الملكية الفكرية والسرية
                </div>
                <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.5 }}>
                  تنتقل ملكية المخرجات والتصاميم المعتمدة والمواد المنتجة خصيصاً للطرف الثاني فور وفائه بكامل المستحقات المالية. كما يلتزم الطرفان التزاماً أبدياً بالمحافظة التامة على سرية المعلومات والخطط التجارية وعدم إفشائها لأي طرف ثالث.
                </div>
              </div>
            </div>
          </div>

          {/* CLAUSE 6: TERMINATION & DEFAULT */}
          <div className="prem-contract-clause" style={{ marginBottom: 12, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* English */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 4, textTransform: 'uppercase' }}>
                  Clause 6: Termination &amp; Settlement Process
                </div>
                <div style={{ fontSize: 10.5, color: '#334155', lineHeight: 1.45 }}>
                  Either party may terminate this Agreement by giving thirty (30) days advance written notice. <strong>Settlement Process:</strong> Upon notice of termination, the First Party shall prepare a comprehensive final statement of account within seven (7) business days detailing all executed services, deliverables, and accrued work up to the effective termination date. The Second Party shall fully settle all outstanding and accrued amounts within fourteen (14) calendar days of receiving the statement, whereupon all completed work products to date shall be formally delivered.
                </div>
              </div>

              {/* Arabic */}
              <div dir="rtl" style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                  البند السادس: فسخ العقد وآلية التسوية المالية
                </div>
                <div style={{ fontSize: 10.5, color: '#334155', lineHeight: 1.45 }}>
                  يجوز لأي من الطرفين إنهاء هذا العقد بإخطار كتابي مسبق مدته ثلاثون (٣٠) يوماً. <strong>آلية التسوية المالية:</strong> فور تقديم إخطار الإنهاء، يُعد الطرف الأول كشف حساب ختامي مفصل خلال سبعة (٧) أيام عمل يوضح كافة الخدمات والمخرجات المنجزة والأتعاب المستحقة حتى تاريخ سريان الإنهاء. ويلتزم الطرف الثاني بتسوية وسداد كامل المستحقات القائمة خلال أربعة عشر (١٤) يوماً من تاريخ استلام كشف الحساب، وتُسلّم كافة المواد والأعمال المنجزة للطرف الثاني فور إتمام السداد والمخالصة النهائية.
                </div>
              </div>
            </div>
          </div>

          {/* CLAUSE 7: GOVERNING LAW & JURISDICTION */}
          <div className="prem-contract-clause" style={{ marginBottom: 14, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* English */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 4, textTransform: 'uppercase' }}>
                  Clause 7: Governing Law &amp; Jurisdiction
                </div>
                <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.5 }}>
                  This Agreement shall be governed by and interpreted under the applicable laws and regulations of the <strong>Kingdom of Saudi Arabia</strong>. Any dispute that cannot be amicably settled shall be subject to the exclusive jurisdiction of the competent commercial courts in <strong>Riyadh, KSA</strong>.
                </div>
              </div>

              {/* Arabic */}
              <div dir="rtl" style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                  البند السابع: النظام الواجب التطبيق والاختصاص القضائي
                </div>
                <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.5 }}>
                  يخضع هذا العقد ويفسر وفقاً للأنظمة واللوائح التجارية السارية في <strong>المملكة العربية السعودية</strong>. وفي حال تعذر التسوية الودية، ينعقد الاختصاص القضائي الحصري للمحاكم التجارية المختصة في مدينة <strong>الرياض</strong>.
                </div>
              </div>
            </div>
          </div>

          {/* SIGNATURES & SEALS (AUTHENTICATION BLOCK) */}
          <div
            className="prem-contract-seal-box"
            style={{
              borderTop: '2px solid #0f172a',
              paddingTop: 12,
              marginTop: 10,
            }}
          >
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 800,
                color: '#0f172a',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 10,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Execution, Signatures &amp; Official Seals</span>
              <span dir="rtl">التوقيعات والختم الرسمي</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
              }}
            >
              {/* FIRST PARTY SIGNATURE & SEAL */}
              <div
                style={{
                  border: '1.5px solid #0f172a',
                  borderRadius: 6,
                  padding: '12px 14px',
                  background: '#ffffff',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <strong style={{ fontSize: 11, color: '#4338ca' }}>First Party / الطرف الأول</strong>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Authorized Signatory</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                  {currentOffice.legalNameEn}
                </div>
                <div dir="rtl" style={{ fontSize: 11.5, color: '#475569', marginBottom: 8 }}>
                  {currentOffice.legalNameAr}
                </div>

                {/* Digital Stamp Graphic / Seal */}
                <div
                  style={{
                    border: '1.5px dashed #4f46e5',
                    borderRadius: 6,
                    padding: '8px 10px',
                    background: '#f5f3ff',
                    marginBottom: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      height: 38,
                      width: 38,
                      borderRadius: '50%',
                      border: '2px solid #4f46e5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#ffffff',
                      flexShrink: 0,
                    }}
                  >
                    <ShieldCheck className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#312e81' }}>
                      Nabeel Syed Yousuf
                    </div>
                    <div style={{ fontSize: 10, color: '#4f46e5' }}>
                      Executive Director &amp; Signatory
                    </div>
                    <div style={{ fontSize: 9.5, color: '#6b7280' }}>
                      Verified Digital Seal · Adonix KSA
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 10, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Date: {formattedStartDate}</span>
                  <span>CR: {currentOffice.crNumber || '7055349166'}</span>
                </div>
              </div>

              {/* SECOND PARTY SIGNATURE & SEAL */}
              <div
                style={{
                  border: '1.5px solid #0f172a',
                  borderRadius: 6,
                  padding: '12px 14px',
                  background: '#ffffff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <strong style={{ fontSize: 11, color: '#059669' }}>Second Party / الطرف الثاني</strong>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Client Acceptance</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                  {contract.client_company || contract.client_name}
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>
                  Authorized: {contract.client_representative || contract.client_name}
                </div>

                {/* Client Signature Area */}
                {isSigned ? (
                  <div
                    style={{
                      border: '1.5px solid #10b981',
                      borderRadius: 6,
                      padding: '8px 10px',
                      background: '#ecfdf5',
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: '#065f46' }}>
                        Digitally Signed &amp; Accepted
                      </span>
                    </div>
                    <div style={{ fontSize: 10.5, color: '#047857' }}>
                      Signed by: <strong>{contract.signed_by_name || contract.client_name}</strong>
                    </div>
                    {contract.signed_at && (
                      <div style={{ fontSize: 9.5, color: '#059669' }}>
                        Timestamp: {format(new Date(contract.signed_at), 'yyyy-MM-dd HH:mm:ss')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      border: '1.5px dashed #94a3b8',
                      borderRadius: 6,
                      padding: '16px 10px',
                      background: '#f8fafc',
                      textAlign: 'center',
                      marginBottom: 8,
                      color: '#64748b',
                      fontSize: 11,
                    }}
                  >
                    Signature &amp; Corporate Stamp Space<br />
                    <span dir="rtl" style={{ fontSize: 10 }}>مساحة التوقيع والختم المعتمد</span>
                  </div>
                )}

                <div style={{ fontSize: 10, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Date: {contract.signed_at ? format(new Date(contract.signed_at), 'yyyy-MM-dd') : 'Pending'}</span>
                  <span>Status: {contract.status}</span>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM COMPLIANCE FOOTER */}
          <div
            style={{
              marginTop: 14,
              paddingTop: 8,
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 10,
              color: '#94a3b8',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            <span>Official Dual-Language Contract Document · Asaheeb and Adonix Developments Co.</span>
            <span dir="rtl">وثيقة عقد نظامية معتمدة باللغتين العربية والإنجليزية · شركة اساهيب وادونيكس للتطوير</span>
            <span>Page 2 of 2 / الصفحة الثانية من ٢</span>
          </div>
        </div>
      </div>
    </div>
  )
}
