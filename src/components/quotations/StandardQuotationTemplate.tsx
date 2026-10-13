'use client'

import React from 'react'
import { format } from 'date-fns'
import type { Quotation } from '@/types/database'
import { OFFICE_LOCATIONS, type OfficeLocationKey } from '@/lib/constants/officeLocations'
import { numberToWords, numberToArabicWords } from '@/lib/utils/numberToWords'

interface Props {
  quotation: Quotation & { client: any; items: any[] }
  officeLocation?: OfficeLocationKey
}

function renderFormattedTerms(text: string) {
  if (!text) return null
  return text.split('\n').map((line, index) => {
    const cleanLine = line.trim()
    const isHeaderLine = /^(?:\*\*|\*)?(Additional Terms|Terms & Conditions|Payment Terms|Payment Schedule|Payment Milestones)(?:\*\*|\*)?:?$/i.test(cleanLine)
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)

    return (
      <div
        key={index}
        style={{
          minHeight: line === '' ? '0.5em' : undefined,
          fontWeight: isHeaderLine ? 700 : undefined,
          color: isHeaderLine ? '#000000' : '#333333',
          marginTop: isHeaderLine ? 8 : 2,
          marginBottom: isHeaderLine ? 4 : 2,
          fontSize: isHeaderLine ? 12 : 11.5,
          lineHeight: 1.5,
        }}
      >
        {parts.map((part, i) => {
          if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('*') && part.endsWith('*'))) {
            const content = part.slice(part.startsWith('**') ? 2 : 1, part.endsWith('**') ? -2 : -1)
            return (
              <strong key={i} style={{ fontWeight: 700, color: '#000000' }}>
                {content}
              </strong>
            )
          }
          return part
        })}
      </div>
    )
  })
}

export const DEFAULT_QUOTATION_TERMS = `**Payment Milestones**
50% Advance Payment – Due upon project kickoff to initiate work and secure resources.
30% Interim Payment – Due upon completion and approval of the design/milestone review.
20% Final Payment – Due upon final delivery of the project and prior to deployment, handover, or transfer of source files.

**Additional Terms**
Project work will commence upon receipt of the initial 50% payment.
Any additional features or changes outside the agreed scope will be quoted and billed separately as change requests.
Delays in approvals or payments may impact the project timeline.
All payments are non-refundable once the corresponding project phase has been completed.`

export default function StandardQuotationTemplate({
  quotation,
  officeLocation = 'KSA',
}: Props) {
  const currentOffice = OFFICE_LOCATIONS[officeLocation] || OFFICE_LOCATIONS.KSA
  const isKsa = officeLocation === 'KSA'
  const curr = quotation.currency ?? (isKsa ? 'SAR' : 'INR')

  const items = quotation.items ?? []
  const subtotal = Number(quotation.subtotal) || 0
  const discountAmount = Number(quotation.discount_amount) || 0
  const taxableSubtotal = Math.max(0, subtotal - discountAmount)
  const taxAmount = Number(quotation.tax_amount) || 0
  const total = Number(quotation.total) || 0

  const formattedIssueDate = quotation.issue_date
    ? format(new Date(quotation.issue_date), 'yyyy-MM-dd')
    : (quotation.created_at ? format(new Date(quotation.created_at), 'yyyy-MM-dd') : '')

  const formattedValidUntil = quotation.valid_until
    ? format(new Date(quotation.valid_until), 'yyyy-MM-dd')
    : ''

  const amountInWordsEn = numberToWords(total, curr)
  const amountInWordsAr = isKsa ? numberToArabicWords(total, curr) : ''

  // Filter client details to avoid rendering empty lines
  const clientName = quotation.client?.name || ''
  const clientCompany = quotation.client?.company || ''
  const clientVat = quotation.client?.vat_number || ''
  const clientCr = quotation.client?.cr_number || ''
  const clientAddress = quotation.client?.address || ''
  const clientPhone = quotation.client?.phone || ''
  const clientEmail = quotation.client?.email || ''

  // Bank details with per-quotation overrides and fallback to office defaults
  const bank = {
    bankName: quotation.bank_name || currentOffice.bankDetails?.bankName,
    accountName: quotation.bank_account_name || currentOffice.bankDetails?.accountName,
    accountNumber: quotation.bank_account_number || currentOffice.bankDetails?.accountNumber,
    iban: quotation.bank_iban || currentOffice.bankDetails?.iban,
    swiftCode: quotation.bank_swift || currentOffice.bankDetails?.swiftCode,
    ifscCode: quotation.bank_ifsc || currentOffice.bankDetails?.ifscCode,
  }

  // Ensure terms always renders even if database record was saved with blank terms
  const termsToRender =
    quotation.terms && quotation.terms.trim().length > 0
      ? quotation.terms
      : DEFAULT_QUOTATION_TERMS

  return (
    <div className={`prem-invoice-container ${!isKsa ? 'mode-intl' : 'mode-ksa'}`}>
      {/* =========================================================
          PAGE 1: HEADER, PARTIES, DATES & OFFICIAL BANKING DETAILS
          ========================================================= */}
      <div className="prem-page-one">
        {/* 1. TOP HEADER SECTION */}
        {isKsa ? (
          /* KSA BILINGUAL BALANCED HEADER (NO OVERLAPPING OR CROWDED CENTER) */
          <div
            style={{
              borderBottom: '2px solid #111111',
              paddingBottom: 16,
              marginBottom: 16,
            }}
          >
            {/* Top Brand Bar with Logo & Bilingual Legal Names */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
                paddingBottom: 12,
                borderBottom: '1px solid #e4e4e7',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img
                  src="/logo.png"
                  alt="Adonix Logo"
                  style={{ height: 42, width: 'auto', objectFit: 'contain' }}
                />
                <div>
                  <h1 className="prem-brand-name" style={{ margin: 0, fontSize: 18, lineHeight: 1.2 }}>
                    {currentOffice.legalNameEn}
                  </h1>
                  <span style={{ fontSize: 11, color: '#71717a', fontWeight: 600, letterSpacing: '0.04em' }}>
                    ADONIX DIGITAL DEVELOPMENTS
                  </span>
                </div>
              </div>
              <div dir="rtl" style={{ textAlign: 'right' }}>
                <h1 className="prem-brand-name prem-brand-name-ar" style={{ margin: 0, fontSize: 19, lineHeight: 1.2 }}>
                  {currentOffice.legalNameAr}
                </h1>
                <span style={{ fontSize: 11, color: '#71717a', fontWeight: 600 }}>
                  شركة اساهيب وادونيكس للتطوير
                </span>
              </div>
            </div>

            {/* Sub-row: 2-Column Balanced Registration, Tax & Address Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, fontSize: 12.5 }}>
              {/* Left Column: English Details (LTR) */}
              <div className="prem-meta-list" style={{ margin: 0 }}>
                <div className="prem-meta-item">
                  <span className="prem-meta-key">CR / 700 No:</span>
                  <span className="prem-meta-val font-mono font-bold">{currentOffice.crNumber ?? '7055349166'}</span>
                </div>
                <div className="prem-meta-item">
                  <span className="prem-meta-key">VAT / TRN:</span>
                  <span className="prem-meta-val font-mono font-bold">{currentOffice.vatNumber ?? '315081325900003'}</span>
                </div>
                <div className="prem-meta-item">
                  <span className="prem-meta-key">National Address:</span>
                  <span className="prem-meta-val">{currentOffice.address}</span>
                </div>
                <div className="prem-meta-item">
                  <span className="prem-meta-key">Tel / Mob:</span>
                  <span className="prem-meta-val font-mono">{currentOffice.phone}</span>
                </div>
              </div>

              {/* Right Column: Arabic Details (RTL) */}
              <div className="prem-meta-list" dir="rtl" style={{ margin: 0 }}>
                <div className="prem-meta-item" dir="rtl">
                  <span className="prem-meta-key">السجل التجاري / الرقم الموحد:</span>
                  <span className="prem-meta-val font-mono font-bold">{currentOffice.crNumber ?? '7055349166'}</span>
                </div>
                <div className="prem-meta-item" dir="rtl">
                  <span className="prem-meta-key">الرقم الضريبي:</span>
                  <span className="prem-meta-val font-mono font-bold">{currentOffice.vatNumber ?? '315081325900003'}</span>
                </div>
                <div className="prem-meta-item" dir="rtl">
                  <span className="prem-meta-key">العنوان الوطني:</span>
                  <span className="prem-meta-val">{currentOffice.addressAr}</span>
                </div>
                <div className="prem-meta-item" dir="rtl">
                  <span className="prem-meta-key">الهاتف:</span>
                  <span className="prem-meta-val font-mono">{currentOffice.phone}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* INDIA / INTERNATIONAL CLEAN HEADER */
          <div className="prem-header-intl">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <img
                src="/logo.png"
                alt="Adonix Logo"
                style={{ height: 42, width: 'auto', objectFit: 'contain' }}
              />
              <div className="prem-intl-brand">
                <h1 className="prem-brand-name">{currentOffice.legalNameEn}</h1>
                <div className="prem-intl-addr">{currentOffice.address}</div>
                <div className="prem-intl-contact">
                  <span><strong>Phone:</strong> {currentOffice.phone}</span>
                  <span><strong>Email:</strong> {currentOffice.email || 'contact@adonixdigital.com'}</span>
                </div>
              </div>
            </div>
            <div className="prem-intl-doc-badge">
              <div className="prem-intl-badge-title">COMMERCIAL QUOTATION</div>
              <div className="prem-intl-badge-inv font-mono">{quotation.quote_number}</div>
            </div>
          </div>
        )}

        {/* 2. TITLE BAR */}
        {isKsa && (
          <div className="prem-title-bar">
            <div className="prem-title-bar-content">
              <span className="prem-title-en">COMMERCIAL QUOTATION</span>
              <span className="prem-title-sep">/</span>
              <span className="prem-title-ar" dir="rtl">عرض أسعار تجاري</span>
            </div>
          </div>
        )}

        {/* 3. QUOTATION META ROW */}
        <div className="prem-meta-grid">
          <div className="prem-meta-cell">
            <div className="prem-meta-cell-label">
              <span>Quotation No</span>
              {isKsa && <span className="ar">رقم عرض السعر</span>}
            </div>
            <div className="prem-meta-cell-value font-mono font-bold">
              {quotation.quote_number}
            </div>
          </div>

          <div className="prem-meta-cell">
            <div className="prem-meta-cell-label">
              <span>Issue Date</span>
              {isKsa && <span className="ar">تاريخ الإصدار</span>}
            </div>
            <div className="prem-meta-cell-value font-mono font-bold">
              <span>{formattedIssueDate}</span>
            </div>
          </div>

          <div className="prem-meta-cell">
            <div className="prem-meta-cell-label">
              <span>Valid Until</span>
              {isKsa && <span className="ar">صالح لغاية</span>}
            </div>
            <div className="prem-meta-cell-value font-mono font-bold">
              {formattedValidUntil || '30 Days from Issue'}
            </div>
          </div>

          <div className="prem-meta-cell">
            <div className="prem-meta-cell-label">
              <span>Currency / Branch</span>
              {isKsa && <span className="ar">العملة والفرع</span>}
            </div>
            <div className="prem-meta-cell-value font-mono font-bold">
              {curr} · {isKsa ? 'Riyadh & Jeddah' : 'Hyderabad'}
            </div>
          </div>
        </div>

        {/* 4. SELLER & BUYER SECTION */}
        <div className="prem-parties-grid">
          {/* SELLER CARD */}
          <div className="prem-party-card">
            <div className="prem-party-card-header">
              <span>Seller / Service Provider</span>
              {isKsa && <span dir="rtl">بيانات المورد (البائع)</span>}
            </div>
            <div className="prem-party-card-body">
              <div className="prem-party-row">
                <span className="prem-party-label">Entity Name</span>
                <span className="prem-party-data font-bold">
                  {isKsa ? currentOffice.legalNameEn : 'Adonix Digital Tech'}
                </span>
              </div>

              {isKsa && currentOffice.vatNumber && (
                <div className="prem-party-row">
                  <span className="prem-party-label">VAT No / TRN</span>
                  <span className="prem-party-data font-mono font-bold">{currentOffice.vatNumber}</span>
                </div>
              )}

              {isKsa && currentOffice.crNumber && (
                <div className="prem-party-row">
                  <span className="prem-party-label">CR / 700 No</span>
                  <span className="prem-party-data font-mono font-bold">{currentOffice.crNumber}</span>
                </div>
              )}

              <div className="prem-party-row">
                <span className="prem-party-label">Address</span>
                <span className="prem-party-data">{currentOffice.address}</span>
              </div>

              <div className="prem-party-row">
                <span className="prem-party-label">Contact</span>
                <span className="prem-party-data font-mono">{currentOffice.phone}</span>
              </div>
            </div>
          </div>

          {/* BUYER CARD */}
          <div className="prem-party-card">
            <div className="prem-party-card-header">
              <span>Quotation For / Client</span>
              {isKsa && <span dir="rtl">بيانات العميل (المشتري)</span>}
            </div>
            <div className="prem-party-card-body">
              {clientCompany ? (
                <>
                  <div className="prem-party-row">
                    <span className="prem-party-label">Organization</span>
                    <span className="prem-party-data font-bold">{clientCompany}</span>
                  </div>
                  {clientName && (
                    <div className="prem-party-row">
                      <span className="prem-party-label">Contact Person</span>
                      <span className="prem-party-data">{clientName}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="prem-party-row">
                  <span className="prem-party-label">Client Name</span>
                  <span className="prem-party-data font-bold">{clientName || 'Prospective Client'}</span>
                </div>
              )}

              {clientVat && (
                <div className="prem-party-row">
                  <span className="prem-party-label">VAT / Tax ID</span>
                  <span className="prem-party-data font-mono font-bold">{clientVat}</span>
                </div>
              )}

              {clientCr && (
                <div className="prem-party-row">
                  <span className="prem-party-label">CR / ID No</span>
                  <span className="prem-party-data font-mono">{clientCr}</span>
                </div>
              )}

              {clientAddress && (
                <div className="prem-party-row">
                  <span className="prem-party-label">Address</span>
                  <span className="prem-party-data">{clientAddress}</span>
                </div>
              )}

              {clientPhone && (
                <div className="prem-party-row">
                  <span className="prem-party-label">Phone</span>
                  <span className="prem-party-data font-mono">{clientPhone}</span>
                </div>
              )}
              {clientEmail && (
                <div className="prem-party-row">
                  <span className="prem-party-label">Email</span>
                  <span className="prem-party-data">{clientEmail}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 5. OFFICIAL BANK REMITTANCE SECTION (PAGE 1) */}
        {bank && bank.bankName && (
          <div className="prem-bank-card-top">
            <div className="prem-bank-top-header">
              <span>Official Bank Remittance Details (For Project Kickoff &amp; Advance Payment)</span>
              {isKsa && <span dir="rtl">معلومات التحويل البنكي المعتمدة (لبدء المشروع والدفعة الأولى)</span>}
            </div>
            <div className="prem-bank-grid-structured">
              <div className="prem-bank-tile">
                <div className="prem-bank-tile-lbl">
                  <span>Bank Name</span>
                  {isKsa && <span className="ar">اسم البنك</span>}
                </div>
                <div className="prem-bank-tile-val font-bold">{bank.bankName}</div>
              </div>

              {bank.accountName && (
                <div className="prem-bank-tile">
                  <div className="prem-bank-tile-lbl">
                    <span>Account Holder (Beneficiary)</span>
                    {isKsa && <span className="ar">اسم المستفيد / الحساب</span>}
                  </div>
                  <div className="prem-bank-tile-val font-bold">{bank.accountName}</div>
                </div>
              )}

              {bank.iban && (
                <div className="prem-bank-tile prem-bank-tile-full prem-iban-highlight">
                  <div className="prem-bank-tile-lbl">
                    <span>International Bank Account Number (IBAN)</span>
                    {isKsa && <span className="ar">رقم الآيبان الدولي المعتمد</span>}
                  </div>
                  <div className="prem-bank-tile-val font-mono font-bold prem-iban-text">
                    {bank.iban}
                  </div>
                </div>
              )}

              {bank.accountNumber && (
                <div className="prem-bank-tile">
                  <div className="prem-bank-tile-lbl">
                    <span>Account Number</span>
                    {isKsa && <span className="ar">رقم الحساب</span>}
                  </div>
                  <div className="prem-bank-tile-val font-mono font-bold">{bank.accountNumber}</div>
                </div>
              )}

              {bank.swiftCode && (
                <div className="prem-bank-tile">
                  <div className="prem-bank-tile-lbl">
                    <span>SWIFT / BIC Code</span>
                    {isKsa && <span className="ar">رمز السويفت</span>}
                  </div>
                  <div className="prem-bank-tile-val font-mono font-bold">{bank.swiftCode}</div>
                </div>
              )}

              {bank.ifscCode && (
                <div className="prem-bank-tile">
                  <div className="prem-bank-tile-lbl">
                    <span>IFSC Code</span>
                  </div>
                  <div className="prem-bank-tile-val font-mono font-bold">{bank.ifscCode}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PAGE 1 FOOTER CUE */}
        <div className="prem-page-cue">
          <span>Official Commercial Quotation · Page 1 of 2</span>
          <span>See Page 2 for Itemized Scope of Work &amp; Totals →</span>
        </div>
      </div>

      {/* =========================================================
          PAGE 2 / CONTINUATION: ITEM LINES, TOTALS & TERMS
          ========================================================= */}
      <div className="prem-page-two">
        {/* PAGE 2 HEADER ANCHOR */}
        <div className="prem-p2-anchor">
          <div className="prem-p2-anchor-left">
            <span className="prem-p2-doc-title">COMMERCIAL QUOTATION · عرض أسعار تجاري</span>
            <span className="prem-p2-doc-ref font-mono">#{quotation.quote_number}</span>
          </div>
          <div className="prem-p2-anchor-right">
            <span>Date: <strong className="font-mono">{formattedIssueDate}</strong></span>
            <span>Client: <strong>{clientCompany || clientName || 'Prospective Client'}</strong></span>
          </div>
        </div>

        <div className="prem-items-section-header">
          <span>Itemized Products &amp; Deliverables</span>
          {isKsa && <span dir="rtl">جدول بيان الخدمات والبنود المسعرة</span>}
        </div>

        {/* 6. ITEM LINES TABLE */}
        <div className="prem-table-wrapper">
          <table className="prem-items-table">
            <thead>
              <tr>
                <th className="prem-th text-center" style={{ width: '6%' }}>
                  <div>#</div>
                  {isKsa && <div className="ar">م</div>}
                </th>
                <th className="prem-th" style={{ width: '42%' }}>
                  <div>Description / Scope of Work</div>
                  {isKsa && <div className="ar">بيان الخدمة أو البند</div>}
                </th>
                <th className="prem-th text-center" style={{ width: '8%' }}>
                  <div>Qty</div>
                  {isKsa && <div className="ar">الكمية</div>}
                </th>
                <th className="prem-th text-right" style={{ width: '12%' }}>
                  <div>Unit Price</div>
                  {isKsa && <div className="ar">سعر الوحدة</div>}
                </th>
                <th className="prem-th text-right" style={{ width: '13%' }}>
                  <div>Taxable Subtotal</div>
                  {isKsa && <div className="ar">المبلغ الخاضع</div>}
                </th>
                <th className="prem-th text-center" style={{ width: '7%' }}>
                  <div>Tax %</div>
                  {isKsa && <div className="ar">الضريبة</div>}
                </th>
                <th className="prem-th text-right" style={{ width: '12%' }}>
                  <div>Total ({curr})</div>
                  {isKsa && <div className="ar">المجموع الكلي</div>}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, idx: number) => {
                const qty = Number(item.qty) || 1
                const unitPrice = Number(item.unit_price) || 0
                const itemDisc = Number(item.discount_percent) || 0
                const gross = qty * unitPrice
                const netAmount = Math.max(0, gross - (gross * itemDisc) / 100)
                const rate = Number(quotation.tax_percent) || (isKsa ? 15 : 0)
                const itemVat = (netAmount * rate) / 100
                const itemTotal = netAmount + itemVat

                return (
                  <tr key={item.id || idx} className="prem-item-row">
                    <td className="text-center font-mono font-bold">{idx + 1}</td>
                    <td>
                      <div className="prem-item-desc">{item.description}</div>
                      {itemDisc > 0 && (
                        <div className="prem-item-disc">Discount: {itemDisc}% off</div>
                      )}
                    </td>
                    <td className="text-center font-mono font-bold">{qty}</td>
                    <td className="text-right font-mono">{unitPrice.toFixed(2)}</td>
                    <td className="text-right font-mono">{netAmount.toFixed(2)}</td>
                    <td className="text-center font-mono">{rate}%</td>
                    <td className="text-right font-mono font-bold">{itemTotal.toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* 7. TOTALS & SUMMARY SECTION */}
        <div className="prem-summary-section">
          {/* Left Box: Amount in words */}
          <div className="prem-summary-left">
            <div className="prem-words-card">
              <div className="prem-words-title">
                <span>Total Quoted Amount In Words</span>
                {isKsa && <span dir="rtl">المبلغ الإجمالي كتابة</span>}
              </div>
              <div className="prem-words-en font-bold">{amountInWordsEn}</div>
              {isKsa && amountInWordsAr && (
                <div className="prem-words-ar font-bold" dir="rtl">{amountInWordsAr}</div>
              )}
            </div>
          </div>

          {/* Right Box: Calculations Grid */}
          <div className="prem-summary-right">
            <table className="prem-totals-table">
              <tbody>
                <tr className="prem-totals-row">
                  <td className="prem-total-key">
                    <div className="prem-total-key-inner">
                      <span>Subtotal After Line Discounts</span>
                      {isKsa && <span className="ar">الإجمالي بعد خصومات البنود</span>}
                    </div>
                  </td>
                  <td className="prem-total-val font-mono font-bold">
                    {subtotal.toFixed(2)} {curr}
                  </td>
                </tr>

                {discountAmount > 0 && (
                  <tr className="prem-totals-row">
                    <td className="prem-total-key">
                      <div className="prem-total-key-inner">
                        <span>
                          Additional Discount {quotation.discount_type === 'PERCENTAGE' || !quotation.discount_type ? `(${Number(quotation.discount_value) || 0}%)` : ''}
                        </span>
                        {isKsa && <span className="ar">خصم إضافي على عرض السعر</span>}
                      </div>
                    </td>
                    <td className="prem-total-val font-mono">
                      - {discountAmount.toFixed(2)} {curr}
                    </td>
                  </tr>
                )}

                {discountAmount > 0 && (
                  <tr className="prem-totals-row">
                    <td className="prem-total-key">
                      <div className="prem-total-key-inner">
                        <span>Taxable Subtotal</span>
                        {isKsa && <span className="ar">إجمالي المبلغ الخاضع للضريبة</span>}
                      </div>
                    </td>
                    <td className="prem-total-val font-mono font-bold">
                      {taxableSubtotal.toFixed(2)} {curr}
                    </td>
                  </tr>
                )}

                <tr className="prem-totals-row">
                  <td className="prem-total-key">
                    <div className="prem-total-key-inner">
                      <span>Total VAT ({quotation.tax_percent}%)</span>
                      {isKsa && <span className="ar">مجموع ضريبة القيمة المضافة</span>}
                    </div>
                  </td>
                  <td className="prem-total-val font-mono font-bold">
                    {taxAmount.toFixed(2)} {curr}
                  </td>
                </tr>

                <tr className="prem-grand-total-row">
                  <td className="prem-total-key font-bold">
                    <div className="prem-total-key-inner">
                      <div>
                        <div>Total Quoted Amount</div>
                        <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#555555', marginTop: '1px' }}>
                          (Amount Includes 15% VAT)
                        </div>
                      </div>
                      {isKsa && (
                        <div style={{ textAlign: 'right' }}>
                          <div className="ar">الإجمالي شامل الضريبة</div>
                          <div className="ar" style={{ fontSize: '10px', color: '#555555', marginTop: '1px' }}>
                            (المبلغ شامل ضريبة القيمة المضافة)
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="prem-total-val font-bold font-mono">
                    {total.toFixed(2)} {curr}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 8. SCOPE NOTES & CORPORATE AUTHORIZATION BLOCK */}
        <div
          style={{
            display: 'flex',
            justifyContent: quotation.notes ? 'space-between' : 'flex-end',
            alignItems: 'stretch',
            gap: 16,
            marginBottom: 14,
            pageBreakInside: 'avoid',
          }}
        >
          {quotation.notes && (
            <div className="prem-notes-block" style={{ flex: 1, margin: 0 }}>
              <div className="prem-terms-title">
                <span>Special Instructions / Scope Notes</span>
                {isKsa && <span className="ar">ملاحظات نطاق العمل</span>}
              </div>
              <div className="prem-notes-content">
                {renderFormattedTerms(quotation.notes)}
              </div>
            </div>
          )}

          {/* Corporate Authorized Signatory Block */}
          <div
            className="prem-signature-block"
            style={{
              width: quotation.notes ? 260 : 280,
              flexShrink: 0,
              margin: 0,
            }}
          >
            <div className="prem-sign-title">
              <div>Prepared &amp; Authorized By</div>
              {isKsa && <div className="ar">المفوض بالإصدار والختم</div>}
            </div>
            <div className="prem-sign-space"></div>
            <div className="prem-sign-name font-bold">Nabeel Syed Yousuf</div>
            <div className="prem-sign-company">
              {isKsa ? currentOffice.legalNameEn : 'Adonix Digital Tech'}
            </div>
          </div>
        </div>

        {/* 9. PAYMENT MILESTONES & COMMERCIAL TERMS (SPREADING ACROSS THE PAGE NORMALLY) */}
        <div
          className="prem-terms-block"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            margin: '0 0 14px 0',
            pageBreakInside: 'avoid',
          }}
        >
          <div className="prem-terms-title">
            <span>Payment Milestones &amp; Commercial Terms</span>
            {isKsa && <span className="ar">مراحل السداد والشروط التجارية</span>}
          </div>
          <div className="prem-terms-content">
            {renderFormattedTerms(termsToRender)}
          </div>
        </div>

        {/* 9. BOTTOM OFFICIAL COMPLIANCE FOOTER */}
        <div className="prem-bottom-bar">
          <span>Official Computer-Generated Commercial Quotation · Adonix CRM Platform</span>
          {isKsa ? (
            <span dir="rtl">عرض أسعار تجاري معتمد منتج إلكترونياً · منصة أدونيكس لإدارة علاقات العملاء</span>
          ) : (
            <span>Adonix Digital Tech · Banjara Hills, Hyderabad · All Rights Reserved</span>
          )}
        </div>
      </div>
    </div>
  )
}
