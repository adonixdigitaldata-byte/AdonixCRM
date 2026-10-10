'use client'

import React from 'react'
import { format } from 'date-fns'
import type { Invoice, Payment } from '@/types/database'
import { OFFICE_LOCATIONS, type OfficeLocationKey } from '@/lib/constants/officeLocations'
import ZatcaQrCode from '@/components/invoices/ZatcaQrCode'
import { formatZatcaTimestamp } from '@/lib/zatca/qrGenerator'
import { numberToWords, numberToArabicWords } from '@/lib/utils/numberToWords'

interface Props {
  invoice: Invoice & { client: any; items: any[] }
  payments?: Payment[]
  officeLocation?: OfficeLocationKey
  showCr?: boolean
}

export default function StandardTaxInvoiceTemplate({
  invoice,
  officeLocation = 'KSA',
  showCr = true,
}: Props) {
  const currentOffice = OFFICE_LOCATIONS[officeLocation] || OFFICE_LOCATIONS.KSA
  const isKsa = officeLocation === 'KSA'
  const curr = invoice.currency ?? (isKsa ? 'SAR' : 'INR')
  const isB2C = invoice.invoice_type === 'B2C'

  const items = invoice.items ?? []
  const subtotal = Number(invoice.subtotal) || 0
  const discountAmount = Number(invoice.discount_amount) || 0
  const taxableSubtotal = Math.max(0, subtotal - discountAmount)
  const taxAmount = Number(invoice.tax_amount) || 0
  const total = Number(invoice.total) || 0
  const amountPaid = Number(invoice.amount_paid) || 0
  const balanceDue = total - amountPaid

  const rawTimestamp = invoice.created_at || (invoice.issue_date ? `${invoice.issue_date}T12:00:00Z` : new Date().toISOString())
  const formattedIssueDate = invoice.issue_date
    ? format(new Date(invoice.issue_date), 'yyyy-MM-dd')
    : (invoice.created_at ? format(new Date(invoice.created_at), 'yyyy-MM-dd') : '')
  const formattedIssueTime = invoice.created_at
    ? format(new Date(invoice.created_at), 'HH:mm:ss')
    : '12:00:00'
  const isoUtcTimestamp = formatZatcaTimestamp(rawTimestamp)

  const formattedDueDate = invoice.due_date
    ? format(new Date(invoice.due_date), 'yyyy-MM-dd')
    : ''

  const amountInWordsEn = numberToWords(total, curr)
  const amountInWordsAr = isKsa ? numberToArabicWords(total, curr) : ''

  // Filter client details to avoid rendering empty lines
  const clientName = invoice.client?.name || ''
  const clientCompany = invoice.client?.company || ''
  const clientVat = invoice.client?.vat_number || ''
  const clientCr = invoice.client?.cr_number || ''
  const clientAddress = invoice.client?.address || ''
  const clientPhone = invoice.client?.phone || ''
  const clientEmail = invoice.client?.email || ''

  // Bank details with per-invoice overrides
  const bank = {
    bankName: invoice.bank_name || currentOffice.bankDetails?.bankName,
    accountName: invoice.bank_account_name || currentOffice.bankDetails?.accountName,
    accountNumber: invoice.bank_account_number || currentOffice.bankDetails?.accountNumber,
    iban: invoice.bank_iban || currentOffice.bankDetails?.iban,
    swiftCode: invoice.bank_swift || currentOffice.bankDetails?.swiftCode,
    ifscCode: invoice.bank_ifsc || currentOffice.bankDetails?.ifscCode,
  }

  return (
    <div className={`prem-invoice-container ${!isKsa ? 'mode-intl' : 'mode-ksa'}`}>
      {/* =========================================================
          PAGE 1: HEADER, PARTIES, DATES & OFFICIAL BANKING DETAILS
          ========================================================= */}
      <div className="prem-page-one">
        {/* 1. TOP HEADER SECTION */}
        {isKsa ? (
          /* KSA BILINGUAL 3-COLUMN HEADER WITH SAUDI NATIONAL ADDRESS */
          <div className="prem-header-ksa">
            {/* Left: English Seller Details (LTR) */}
            <div className="prem-seller-col-en">
              <h1 className="prem-brand-name">{currentOffice.legalNameEn}</h1>
              <div className="prem-meta-list">
                <div className="prem-meta-item">
                  <span className="prem-meta-key">CR / 700 No:</span>
                  <span className="prem-meta-val font-mono">{currentOffice.crNumber ?? '—'}</span>
                </div>
                <div className="prem-meta-item">
                  <span className="prem-meta-key">VAT / TRN:</span>
                  <span className="prem-meta-val font-mono">{currentOffice.vatNumber ?? '—'}</span>
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
            </div>

            {/* Center: Official ZATCA QR Code (Tight, Flush & Centered) */}
            <div className="prem-qr-col">
              <div className="prem-qr-box">
                <ZatcaQrCode
                  size={120}
                  fields={{
                    sellerName: currentOffice.legalNameEn,
                    vatNumber: currentOffice.vatNumber || '315081325900003',
                    timestamp: isoUtcTimestamp,
                    totalAmount: total.toFixed(2),
                    vatAmount: taxAmount.toFixed(2),
                  }}
                />
              </div>
              <span className="prem-qr-tag">E-INVOICE QR · رمز الفاتورة الإلكترونية</span>
            </div>

            {/* Right: Arabic Seller Details (Strict RTL) */}
            <div className="prem-seller-col-ar" dir="rtl">
              <h1 className="prem-brand-name prem-brand-name-ar">{currentOffice.legalNameAr}</h1>
              <div className="prem-meta-list" dir="rtl">
                <div className="prem-meta-item" dir="rtl">
                  <span className="prem-meta-key">السجل التجاري / الرقم الموحد:</span>
                  <span className="prem-meta-val font-mono">{currentOffice.crNumber ?? '—'}</span>
                </div>
                <div className="prem-meta-item" dir="rtl">
                  <span className="prem-meta-key">الرقم الضريبي:</span>
                  <span className="prem-meta-val font-mono">{currentOffice.vatNumber ?? '—'}</span>
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
            <div className="prem-intl-brand">
              <h1 className="prem-brand-name">{currentOffice.legalNameEn}</h1>
              <div className="prem-intl-addr">{currentOffice.address}</div>
              <div className="prem-intl-contact">
                <span><strong>Phone:</strong> {currentOffice.phone}</span>
                <span><strong>Email:</strong> {currentOffice.email || 'contact@adonixdigital.com'}</span>
              </div>
            </div>
            <div className="prem-intl-doc-badge">
              <div className="prem-intl-badge-title">COMMERCIAL INVOICE</div>
              <div className="prem-intl-badge-inv font-mono">{invoice.invoice_number}</div>
            </div>
          </div>
        )}

        {/* 2. TITLE BAR */}
        {isKsa && (
          <div className="prem-title-bar">
            <div className="prem-title-bar-content">
              <span className="prem-title-en">
                {invoice.is_credit_note
                  ? 'TAX CREDIT NOTE'
                  : invoice.is_debit_note
                  ? 'TAX DEBIT NOTE'
                  : isB2C
                  ? 'SIMPLIFIED TAX INVOICE'
                  : 'TAX INVOICE'}
              </span>
              <span className="prem-title-sep">/</span>
              <span className="prem-title-ar" dir="rtl">
                {invoice.is_credit_note
                  ? 'إشعار دائن ضريبي'
                  : invoice.is_debit_note
                  ? 'إشعار مدين ضريبي'
                  : isB2C
                  ? 'فاتورة ضريبية مبسطة'
                  : 'فاتورة ضريبية'}
              </span>
            </div>
          </div>
        )}

        {/* 3. INVOICE META ROW */}
        <div className="prem-meta-grid">
          <div className="prem-meta-cell">
            <div className="prem-meta-cell-label">
              <span>{invoice.is_credit_note ? 'Credit Note No' : invoice.is_debit_note ? 'Debit Note No' : 'Invoice No'}</span>
              {isKsa && <span className="ar">{invoice.is_credit_note ? 'رقم الإشعار الدائن' : invoice.is_debit_note ? 'رقم الإشعار المدين' : 'رقم الفاتورة'}</span>}
            </div>
            <div className="prem-meta-cell-value font-mono font-bold">
              {invoice.invoice_number}
            </div>
          </div>

          <div className="prem-meta-cell">
            <div className="prem-meta-cell-label">
              <span>Issue Date &amp; Time</span>
              {isKsa && <span className="ar">تاريخ ووقت الإصدار</span>}
            </div>
            <div className="prem-meta-cell-value font-mono font-bold">
              <span>{formattedIssueDate}</span>
              <span className="prem-meta-time">{formattedIssueTime} UTC</span>
            </div>
          </div>

          <div className="prem-meta-cell">
            <div className="prem-meta-cell-label">
              <span>{(invoice.is_credit_note || invoice.is_debit_note) ? 'Ref Invoice No' : isKsa ? 'Invoice Type' : 'Billing Office'}</span>
              {isKsa && <span className="ar">{(invoice.is_credit_note || invoice.is_debit_note) ? 'مرجع الفاتورة' : 'نوع الفاتورة'}</span>}
            </div>
            <div className="prem-meta-cell-value font-bold font-mono">
              {(invoice.is_credit_note || invoice.is_debit_note) ? (
                invoice.reference_invoice_number || 'Linked Supply'
              ) : isKsa ? (
                isB2C ? 'B2C Simplified (مبسطة)' : 'B2B Standard (ضريبية)'
              ) : (
                'India Office (Hyderabad)'
              )}
            </div>
          </div>

          <div className="prem-meta-cell">
            <div className="prem-meta-cell-label">
              <span>{invoice.is_credit_note ? 'Document Type' : 'Due Date'}</span>
              {isKsa && <span className="ar">{invoice.is_credit_note ? 'نوع المستند' : 'تاريخ الاستحقاق'}</span>}
            </div>
            <div className="prem-meta-cell-value font-mono font-bold">
              {invoice.is_credit_note ? 'Credit Adjustment' : formattedDueDate || 'Due on Receipt'}
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
                  <span className="prem-party-label">CR / Reg No</span>
                  <span className="prem-party-data font-mono">{currentOffice.crNumber}</span>
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
              <span>Bill To / Customer</span>
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
                  <span className="prem-party-data font-bold">{clientName || 'Walk-in Client'}</span>
                </div>
              )}

              {/* Show VAT Number only if present */}
              {clientVat && (
                <div className="prem-party-row">
                  <span className="prem-party-label">VAT / Tax ID</span>
                  <span className="prem-party-data font-mono font-bold">{clientVat}</span>
                </div>
              )}

              {/* Show CR only if present */}
              {clientCr && (
                <div className="prem-party-row">
                  <span className="prem-party-label">CR / ID No</span>
                  <span className="prem-party-data font-mono">{clientCr}</span>
                </div>
              )}

              {/* Show Address only if present */}
              {clientAddress && (
                <div className="prem-party-row">
                  <span className="prem-party-label">Address</span>
                  <span className="prem-party-data">{clientAddress}</span>
                </div>
              )}

              {/* Show Phone/Email only if present */}
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

        {/* 5. PROMINENT OFFICIAL BANK REMITTANCE SECTION (PAGE 1) */}
        {bank && bank.bankName && (
          <div className="prem-bank-card-top">
            <div className="prem-bank-top-header">
              <span>Official Bank Remittance Instructions</span>
              {isKsa && <span dir="rtl">معلومات التحويل البنكي المعتمدة للمؤسسة</span>}
            </div>
            <div className="prem-bank-grid-structured">
              {/* Row 1: Bank Name & Account Name */}
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

              {/* Row 2: IBAN Highlight Box */}
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

              {/* Row 3: Account Number & SWIFT / IFSC */}
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
          <span>Official Tax Document · Page 1 of 2</span>
          <span>See Page 2 for Itemized Breakdown &amp; Totals →</span>
        </div>
      </div>

      {/* =========================================================
          PAGE 2 / CONTINUATION: ITEM LINES, TOTALS, TERMS & SIGNATURE
          ========================================================= */}
      <div className="prem-page-two">
        {/* PAGE 2 HEADER ANCHOR */}
        <div className="prem-p2-anchor">
          <div className="prem-p2-anchor-left">
            <span className="prem-p2-doc-title">TAX INVOICE · فاتورة ضريبية</span>
            <span className="prem-p2-doc-ref font-mono">#{invoice.invoice_number}</span>
          </div>
          <div className="prem-p2-anchor-right">
            <span>Date: <strong className="font-mono">{formattedIssueDate}</strong></span>
            <span>Client: <strong>{clientCompany || clientName || 'Walk-in Client'}</strong></span>
          </div>
        </div>

        <div className="prem-items-section-header">
          <span>Itemized Products &amp; Services</span>
          {isKsa && <span dir="rtl">جدول بيان الأصناف والخدمات المقدمة</span>}
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
                  <div>Description</div>
                  {isKsa && <div className="ar">بيان الخدمة أو السلعة</div>}
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
                const rate = Number(invoice.tax_percent) || (isKsa ? 15 : 0)
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
                <span>Total Amount In Words</span>
                {isKsa && <span dir="rtl">المبلغ الإجمالي كتابة</span>}
              </div>
              <div className="prem-words-en font-bold">{amountInWordsEn}</div>
              {isKsa && amountInWordsAr && (
                <div className="prem-words-ar font-bold" dir="rtl">{amountInWordsAr}</div>
              )}
            </div>
          </div>

          {/* Right Box: Calculations Grid with Continuous Full Borders */}
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
                          Additional Invoice Discount {invoice.discount_type === 'PERCENTAGE' || !invoice.discount_type ? `(${Number(invoice.discount_value) || 10}%)` : ''}
                        </span>
                        {isKsa && <span className="ar">خصم إضافي على الفاتورة</span>}
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
                      <span>Total Tax ({invoice.tax_percent}%)</span>
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
                        <div>Total Amount Due</div>
                        <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#555555', marginTop: '1px' }}>
                          (Amount Includes VAT)
                        </div>
                      </div>
                      {isKsa && (
                        <div style={{ textAlign: 'right' }}>
                          <div className="ar">الإجمالي المستحق</div>
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

                {amountPaid > 0 && (
                  <tr className="prem-totals-row">
                    <td className="prem-total-key">
                      <div className="prem-total-key-inner">
                        <span>Amount Paid</span>
                        {isKsa && <span className="ar">المبلغ المسدد</span>}
                      </div>
                    </td>
                    <td className="prem-total-val font-mono">
                      {amountPaid.toFixed(2)} {curr}
                    </td>
                  </tr>
                )}

                {amountPaid > 0 && (
                  <tr className="prem-balance-row">
                    <td className="prem-total-key font-bold">
                      <div className="prem-total-key-inner">
                        <span>Remaining Balance Due</span>
                        {isKsa && <span className="ar">المبلغ المتبقي</span>}
                      </div>
                    </td>
                    <td className="prem-total-val font-bold font-mono">
                      {balanceDue.toFixed(2)} {curr}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 8. TERMS, NOTES & SIGNATURE BLOCK */}
        <div className="prem-footer-section">
          {/* Terms Block */}
          <div className="prem-terms-block">
            <div className="prem-terms-title">
              <span>Terms &amp; Conditions</span>
              {isKsa && <span className="ar">الشروط والأحكام</span>}
            </div>
            <div className="prem-terms-content">
              {invoice.terms ||
                '1. Official payments must be deposited directly into our authorized corporate bank account.\n2. Invoices are computer-generated and subject to applicable tax regulations.\n3. Goods or services rendered are non-refundable once signed and acknowledged.'}
            </div>
          </div>

          {/* Notes Block if present */}
          {invoice.notes && (
            <div className="prem-notes-block">
              <div className="prem-terms-title">
                <span>Client Notes / Instructions</span>
                {isKsa && <span className="ar">ملاحظات العميل</span>}
              </div>
              <div className="prem-notes-content">
                {invoice.notes}
              </div>
            </div>
          )}

          {/* Authorized Signatory Block */}
          <div className="prem-signature-block">
            <div className="prem-sign-title">
              <div>Authorized Signatory</div>
              {isKsa && <div className="ar">المفوض بالتوقيع والختم</div>}
            </div>
            <div className="prem-sign-space"></div>
            <div className="prem-sign-name font-bold">Nabeel Syed Yousuf</div>
            <div className="prem-sign-company">
              {isKsa ? currentOffice.legalNameEn : 'Adonix Digital Tech'}
            </div>
          </div>
        </div>

        {/* 9. BOTTOM OFFICIAL COMPLIANCE FOOTER */}
        <div className="prem-bottom-bar">
          <span>Official Computer-Generated Tax Invoice · Adonix CRM Platform</span>
          {isKsa ? (
            <span dir="rtl">فاتورة ضريبية رسمية منتجة إلكترونياً · منصة أدونيكس لإدارة علاقات العملاء</span>
          ) : (
            <span>Adonix Digital Tech · Banjara Hills, Hyderabad · All Rights Reserved</span>
          )}
        </div>
      </div>
    </div>
  )
}
