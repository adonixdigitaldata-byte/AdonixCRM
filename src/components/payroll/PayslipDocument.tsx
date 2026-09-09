'use client'

import React, { useRef } from 'react'
import { Payslip } from '@/types/database'
import {
  formatCurrencyAmount,
  getMonthName,
  getSalaryPeriod,
  getDaysInMonth,
  getDefaultStatutoryDeductions,
} from '@/lib/payroll-utils'
import { Printer, X } from 'lucide-react'

interface Props {
  payslip: Payslip
  onClose?: () => void
  isPrintOnly?: boolean
}

export default function PayslipDocument({ payslip, onClose, isPrintOnly = false }: Props) {
  const printRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    const originalTitle = document.title
    const cleanName = (payslip.employee?.name || 'Employee').replace(/\s+/g, '')
    const cleanDesignation = (payslip.designation || payslip.employee?.specialization || 'Staff').replace(/\s+/g, '_')
    const cleanPeriod = `${monthName}_${payslip.year}`

    // Set custom filename for PDF download
    document.title = `${cleanName}_${cleanDesignation}_Payslip_${cleanPeriod}`

    window.print()

    // Restore original title
    setTimeout(() => {
      document.title = originalTitle
    }, 200)
  }

  const monthName = getMonthName(payslip.month)
  const currency = payslip.currency || 'INR'
  const isINR = currency === 'INR'
  const formatPeriodDate = (dStr: string) => {
    try {
      return new Date(dStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return dStr
    }
  }

  const salaryPeriod = (payslip.period_start_date && payslip.period_end_date)
    ? `${formatPeriodDate(payslip.period_start_date)} – ${formatPeriodDate(payslip.period_end_date)}`
    : getSalaryPeriod(payslip.year, payslip.month)
  const totalMonthDays = getDaysInMonth(payslip.year, payslip.month)
  const workingDays = payslip.working_days || totalMonthDays
  const paidDays = payslip.paid_days || workingDays
  const lopDays = payslip.lop_days || 0

  // Reference number
  const monthStr = payslip.month < 10 ? `0${payslip.month}` : `${payslip.month}`
  const empCodeClean = payslip.employee_code || payslip.id.slice(0, 5).toUpperCase()
  const payslipRefNumber = `ADX/PAY/${payslip.year}-${monthStr}/${empCodeClean}`

  // Standard deductions fallback list if empty
  const deductionsList = (payslip.deductions_breakdown && payslip.deductions_breakdown.length > 0)
    ? payslip.deductions_breakdown
    : getDefaultStatutoryDeductions(currency)

  // Bank name & masked account
  const bankName = payslip.bank_name || (isINR ? 'HDFC Bank' : 'Al Rajhi Bank')
  const maskedAccount = payslip.account_number
    ? `•••• •••• ${payslip.account_number.slice(-4)}`
    : '•••• •••• 3273'

  const paymentDateStr = payslip.payment_date
    ? new Date(payslip.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : `${totalMonthDays} ${monthName.slice(0, 3)} ${payslip.year}`

  return (
    <div className="payslip-modal-backdrop" onClick={onClose}>
      <div
        className="payslip-modal-wrapper"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 840,
          width: '100%',
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          margin: 'auto',
          position: 'relative',
        }}
      >
        {/* Action Header (Hidden during browser print) */}
        {!isPrintOnly && (
          <div className="no-print" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 24px',
            borderBottom: '1px solid #E2E8F0',
            background: '#F8FAFC',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-primary" style={{ fontSize: 12, fontWeight: 700 }}>
                {payslip.financial_year}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>
                SALARY SLIP — {monthName.toUpperCase()} {payslip.year}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={handlePrint}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, padding: '8px 16px' }}
              >
                <Printer size={15} /> Print / Save as PDF
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-ghost btn-sm"
                  title="Close"
                  style={{ padding: 6 }}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* PRINTABLE PAYSLIP SHEET (Single Page A4 Layout) */}
        <div
          ref={printRef}
          id="printable-payslip"
          style={{
            padding: '36px 44px',
            background: '#ffffff',
            color: '#0F172A',
            fontFamily: '"Calibri", "Arial", "Helvetica", sans-serif',
            fontSize: 13.5,
            lineHeight: 1.55,
            boxSizing: 'border-box',
            position: 'relative', // Necessary for absolute watermark placement
          }}
        >
          {/* Faded Watermark background */}
          <div className="payslip-watermark" style={{
            position: 'absolute',
            top: '52%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.045, // Slightly more visible watermark
            pointerEvents: 'none',
            zIndex: 0,
            width: '340px',
            height: '340px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <img
              src="/Adonix X Logo.jpeg"
              alt="Adonix Watermark"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          </div>

          <div style={{ position: 'relative', zIndex: 1, paddingRight: '4px' }}>
            {/* HEADER & BRANDING */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid #0F172A',
              paddingBottom: 16,
              marginBottom: 24,
              fontFamily: '"Calibri", "Arial", "Helvetica", sans-serif',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <img
                  src="/Adonix pay slip logo.png"
                  alt="Adonix Logo"
                  style={{ width: 110, height: 'auto', objectFit: 'contain' }}
                />
                <div>
                  <div style={{
                    fontSize: 20,
                    color: '#0F172A',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2
                  }}>
                    ADONIX
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: '#475569',
                    marginTop: 4,
                    lineHeight: 1.4
                  }}>
                    {isINR ? (
                      <>
                        <div><strong>GSTIN:</strong> 36FXMPS8335A1Z4</div>
                        <div>5-5-201/2, Patel Nagar, Darussalam Road, Khairatabad</div>
                        <div>Hyderabad, Telangana - 500004, India</div>
                      </>
                    ) : (
                      <>
                        <div><strong>C.R.</strong> 4030138081</div>
                        <div>Office #602, Matbouli Plaza, Fayd Al Samaa St</div>
                        <div>Jeddah, Kingdom of Saudi Arabia</div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{
                  display: 'inline-block',
                  background: '#0F172A',
                  color: '#ffffff',
                  padding: '3px 10px',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                  marginBottom: 6,
                }}>
                  SALARY SLIP — {monthName.toUpperCase()} {payslip.year}
                </div>
                <div style={{ fontSize: 11, color: '#0F172A', lineHeight: 1.4 }}>
                  Salary Period: <strong>{salaryPeriod}</strong>
                </div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 1, lineHeight: 1.4 }}>
                  Financial Year: <strong>{payslip.financial_year}</strong>
                </div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 1, lineHeight: 1.4 }}>
                  Ref No: <strong style={{ color: '#0F172A' }}>{payslipRefNumber}</strong>
                </div>
              </div>
            </div>

            {/* NET PAY SUMMARY BANNER */}
            <div style={{
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              padding: '16px 22px',
              color: '#0F172A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24,
            }}>
              <div>
                <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                  Net Salary Payable
                </div>
                <div style={{ fontSize: 24, fontWeight: 850, color: '#0F172A', marginTop: 1 }}>
                  {formatCurrencyAmount(payslip.net_pay, currency)}
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 1, fontStyle: 'italic', fontWeight: 600 }}>
                  {payslip.net_pay_in_words || '—'}
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                borderLeft: '1px solid #CBD5E1',
                paddingLeft: 16,
              }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10.5, color: '#64748B', fontWeight: 600 }}>Gross Salary</div>
                  <div style={{ fontSize: 15.5, fontWeight: 700, color: '#16A34A', marginTop: 1 }}>
                    {formatCurrencyAmount(payslip.gross_earnings, currency)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10.5, color: '#64748B', fontWeight: 600 }}>Deductions</div>
                  <div style={{ fontSize: 15.5, fontWeight: 700, color: payslip.total_deductions > 0 ? '#DC2626' : '#64748B', marginTop: 1 }}>
                    {formatCurrencyAmount(payslip.total_deductions, currency)}
                  </div>
                </div>
              </div>
            </div>

            {/* EMPLOYEE & DISBURSEMENT DETAILS TABLE */}
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #CBD5E1',
              marginBottom: 24,
              fontSize: 11.5,
            }}>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 12px', background: '#F8FAFC', border: '1px solid #CBD5E1', fontWeight: 600, color: '#475569', width: '18%' }}>Employee Name</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #CBD5E1', fontWeight: 700, color: '#0F172A', width: '32%' }}>{payslip.employee?.name ?? '—'}</td>
                  <td style={{ padding: '8px 12px', background: '#F8FAFC', border: '1px solid #CBD5E1', fontWeight: 600, color: '#475569', width: '18%' }}>Employee ID</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #CBD5E1', fontWeight: 600, color: '#0F172A', width: '32%' }}>{payslip.employee_code ?? `ADX-${payslip.employee_id.slice(0, 5).toUpperCase()}`}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 12px', background: '#F8FAFC', border: '1px solid #CBD5E1', fontWeight: 600, color: '#475569' }}>Designation</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #CBD5E1', fontWeight: 600, color: '#0F172A' }}>{payslip.designation ?? payslip.employee?.specialization ?? 'Specialist'}</td>
                  <td style={{ padding: '8px 12px', background: '#F8FAFC', border: '1px solid #CBD5E1', fontWeight: 600, color: '#475569' }}>Department</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #CBD5E1', fontWeight: 600, color: '#0F172A' }}>{payslip.department ?? 'Operations'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 12px', background: '#F8FAFC', border: '1px solid #CBD5E1', fontWeight: 600, color: '#475569' }}>Date of Joining</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #CBD5E1', fontWeight: 600, color: '#0F172A' }}>{payslip.joining_date || '01 Dec 2025'}</td>
                  <td style={{ padding: '8px 12px', background: '#F8FAFC', border: '1px solid #CBD5E1', fontWeight: 600, color: '#475569' }}>Bank &amp; Account</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #CBD5E1', fontWeight: 600, color: '#0F172A' }}>{bankName} • {maskedAccount}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 12px', background: '#F8FAFC', border: '1px solid #CBD5E1', fontWeight: 600, color: '#475569' }}>{isINR ? 'IFSC Code' : 'IBAN'}</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #CBD5E1', fontWeight: 600, color: '#0F172A' }}>{payslip.ifsc_or_iban || 'Verified'}</td>
                  <td style={{ padding: '8px 12px', background: '#F8FAFC', border: '1px solid #CBD5E1', fontWeight: 600, color: '#475569' }}>{isINR ? 'PAN Number' : 'Iqama / ID'}</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #CBD5E1', fontWeight: 600, color: '#0F172A' }}>{payslip.pan_or_iqama || 'On File'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 12px', background: '#F8FAFC', border: '1px solid #CBD5E1', fontWeight: 600, color: '#475569' }}>Working / Paid Days</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #CBD5E1', fontWeight: 600, color: '#0F172A' }}>{workingDays} / {paidDays} Days</td>
                  <td style={{ padding: '8px 12px', background: '#F8FAFC', border: '1px solid #CBD5E1', fontWeight: 600, color: '#475569' }}>Payment Date</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #CBD5E1', fontWeight: 600, color: '#16A34A' }}>{paymentDateStr}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 12px', background: '#F8FAFC', border: '1px solid #CBD5E1', fontWeight: 600, color: '#475569' }}>UAN / PF Number</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #CBD5E1', fontWeight: 600, color: '#0F172A' }}>Not Applicable</td>
                  <td style={{ padding: '8px 12px', background: '#F8FAFC', border: '1px solid #CBD5E1', fontWeight: 600, color: '#475569' }}>Loss of Pay (LOP)</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #CBD5E1', fontWeight: 600, color: lopDays > 0 ? '#DC2626' : '#64748B' }}>{lopDays} Days</td>
                </tr>
              </tbody>
            </table>

            {/* TWO-COLUMN SALARY BREAKDOWN TABLE */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0,
              border: '1px solid #CBD5E1',
              marginBottom: 24,
            }}>
              {/* EARNINGS COLUMN */}
              <div style={{ borderRight: '1px solid #CBD5E1' }}>
                <div style={{
                  background: '#F1F5F9',
                  padding: '8px 12px',
                  fontWeight: 700,
                  fontSize: 11.5,
                  color: '#0F172A',
                  borderBottom: '1px solid #CBD5E1',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}>
                  <span>EARNINGS</span>
                  <span>AMOUNT ({currency})</span>
                </div>
                <div style={{ padding: '8px 12px', minHeight: 180 }}>
                  {payslip.earnings_breakdown?.map((item, idx) => (
                    <div key={item.id || idx} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '5px 0',
                      borderBottom: idx === payslip.earnings_breakdown.length - 1 ? 'none' : '1px dashed #E2E8F0',
                      fontSize: 11.5,
                    }}>
                      <span style={{ color: '#334155' }}>{item.name}</span>
                      <span style={{ fontWeight: 700, color: '#0F172A' }}>
                        {formatCurrencyAmount(item.amount, currency)}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{
                  background: '#F8FAFC',
                  padding: '8px 12px',
                  borderTop: '1px solid #CBD5E1',
                  fontWeight: 700,
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: '#16A34A',
                  fontSize: 12,
                }}>
                  <span>Total Gross Salary</span>
                  <span>{formatCurrencyAmount(payslip.gross_earnings, currency)}</span>
                </div>
              </div>

              {/* DEDUCTIONS COLUMN */}
              <div>
                <div style={{
                  background: '#F1F5F9',
                  padding: '8px 12px',
                  fontWeight: 700,
                  fontSize: 11.5,
                  color: '#0F172A',
                  borderBottom: '1px solid #CBD5E1',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}>
                  <span>DEDUCTIONS</span>
                  <span>AMOUNT ({currency})</span>
                </div>
                <div style={{ padding: '8px 12px', minHeight: 180 }}>
                  {payslip.total_deductions === 0 ? (
                    <div style={{
                      color: '#64748B',
                      fontSize: 11.5,
                      fontStyle: 'italic',
                      padding: '24px 0',
                      textAlign: 'center',
                    }}>
                      No deductions applied for this period.
                    </div>
                  ) : (
                    deductionsList
                      .filter((item) => item.amount > 0)
                      .map((item, idx, arr) => (
                        <div key={item.id || idx} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '5px 0',
                          borderBottom: idx === arr.length - 1 ? 'none' : '1px dashed #E2E8F0',
                          fontSize: 11.5,
                        }}>
                          <span style={{ color: '#0F172A' }}>{item.name}</span>
                          <span style={{ fontWeight: 700, color: '#DC2626' }}>
                            - {formatCurrencyAmount(item.amount, currency)}
                          </span>
                        </div>
                      ))
                  )}
                </div>
                <div style={{
                  background: '#F8FAFC',
                  padding: '8px 12px',
                  borderTop: '1px solid #CBD5E1',
                  fontWeight: 700,
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: payslip.total_deductions > 0 ? '#DC2626' : '#64748B',
                  fontSize: 12,
                }}>
                  <span>Total Deductions</span>
                  <span>{formatCurrencyAmount(payslip.total_deductions, currency)}</span>
                </div>
              </div>
            </div>

            {/* NET SALARY CALLOUT ROW */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              padding: '12px 18px',
              marginBottom: 24,
            }}>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  TOTAL NET SALARY CREDITED
                </div>
                <div style={{ fontSize: 12, color: '#0F172A', fontWeight: 600, marginTop: 1 }}>
                  {payslip.net_pay_in_words}
                </div>
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#0F172A' }}>
                {formatCurrencyAmount(payslip.net_pay, currency)}
              </div>
            </div>

            {/* OPTIONAL REMARKS */}
            {payslip.notes && (
              <div style={{
                border: '1px solid #CBD5E1',
                padding: '8px 12px',
                background: '#F8FAFC',
                marginBottom: 24,
                fontSize: 11.5,
              }}>
                <strong>Remarks: </strong> {payslip.notes}
              </div>
            )}

            {/* FOOTER & BOILERPLATE SECTION */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 16,
              paddingTop: 20,
              borderTop: '1px solid #E2E8F0',
              marginTop: 28,
              position: 'relative',
            }}>
              {/* Standard Boilerplate Policy Info */}
              <div style={{ flex: '1 1 50%', fontSize: 10.5, color: '#64748B', lineHeight: 1.45 }}>
                <div style={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 3, letterSpacing: '0.02em', fontSize: 11 }}>
                  Important Notes
                </div>
                <ul style={{ paddingLeft: 12, margin: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <li>This payslip is a confidential record between Adonix and the employee.</li>
                  <li>For any queries or discrepancies, please contact management/admin directly.</li>
                  <li>This is a computer-generated statement and requires no physical signature.</li>
                </ul>
              </div>

              {/* Signature Block (Seal Removed) */}
              <div style={{ flex: '0 0 210px', position: 'relative', textAlign: 'center' }}>
                <div style={{
                  height: 44,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  color: '#0F172A',
                  fontWeight: 700,
                  fontSize: 15,
                  letterSpacing: 0.5,
                  marginBottom: 3,
                }}>
                  Nabeel Syed Yousuf
                </div>
                <div style={{ borderTop: '1.5px solid #0F172A', margin: '3px 0', width: '100%' }}></div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>
                  Nabeel Syed Yousuf
                </div>
                <div style={{ fontSize: 10, color: '#475569', fontWeight: 600 }}>
                  Managing Director / Authorised Signatory
                </div>
                <div style={{ fontSize: 9.5, color: '#64748B' }}>
                  Adonix Digital &amp; Marketing
                </div>
              </div>
            </div>

            {/* PAGE FOOTER FINE PRINT */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 10,
              color: '#94A3B8',
              borderTop: '1px solid #E2E8F0',
              marginTop: 28,
              paddingTop: 8,
            }}>
              <div>
                {isINR ? 'ADONIX • Confidential' : 'ADONIX • C.R. 4030138081 • Confidential'}
              </div>
              <div>
                Page 1 of 1
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STRICT SINGLE-PAGE A4 PRINT CSS */}
      <style jsx global>{`
        @media screen {
          .payslip-modal-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(4px);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            overflow-y: auto;
          }
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          
          /* Hide only background dashboard content, sidebars and actions */
          .no-print,
          .sidebar,
          .activity-tracker,
          button,
          .btn {
            display: none !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
          }

          /* Force body & wrapper structures to reset print layout */
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }

          .app-shell,
          .main-content {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            border: none !important;
            box-shadow: none !important;
          }

          /* Display ONLY the modal wrapper & printable slip at the absolute top of the page */
          .payslip-modal-backdrop {
            position: static !important;
            display: block !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }

          .payslip-modal-wrapper {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }

          #printable-payslip {
            display: block !important;
            position: relative !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  )
}
