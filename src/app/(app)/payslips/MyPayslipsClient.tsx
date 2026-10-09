'use client'

import React, { useState, useMemo } from 'react'
import { Profile, Payslip } from '@/types/database'
import { formatCurrencyAmount, getMonthName } from '@/lib/payroll-utils'
import PayslipDocument from '@/components/payroll/PayslipDocument'
import { FileText, Eye, ShieldCheck, ArrowRight, Archive, Loader2, Download } from 'lucide-react'
import Link from 'next/link'
import { exportPayslipsAsZip, downloadSinglePayslipPdf, ZipExportProgress } from '@/lib/payslip-pdf-export'

interface Props {
  currentProfile: Profile
  payslips: Payslip[]
}

export default function MyPayslipsClient({ currentProfile, payslips }: Props) {
  const [selectedFY, setSelectedFY] = useState<string>('ALL')
  const [viewingPayslip, setViewingPayslip] = useState<Payslip | null>(null)
  const [exportingZip, setExportingZip] = useState(false)
  const [zipProgress, setZipProgress] = useState<ZipExportProgress | null>(null)
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null)

  // Extract available Financial Years
  const availableFYs = useMemo(() => {
    const fys = Array.from(new Set(payslips.map((p) => p.financial_year).filter(Boolean)))
    if (!fys.includes('FY 2026-2027')) fys.unshift('FY 2026-2027')
    if (!fys.includes('FY 2025-2026')) fys.unshift('FY 2025-2026')
    return Array.from(new Set(fys)).sort().reverse()
  }, [payslips])

  const filteredPayslips = useMemo(() => {
    return payslips.filter((p) => {
      if (selectedFY !== 'ALL' && p.financial_year !== selectedFY) return false
      return true
    })
  }, [payslips, selectedFY])

  async function handleDownloadZip() {
    if (filteredPayslips.length === 0 || exportingZip) return

    try {
      setExportingZip(true)
      await exportPayslipsAsZip(
        filteredPayslips,
        currentProfile,
        selectedFY === 'ALL' ? 'All_Cycles' : selectedFY,
        (progress) => setZipProgress(progress)
      )
    } catch (err) {
      console.error('Failed to export payslips as ZIP:', err)
      alert('An error occurred while generating payslip PDFs.')
    } finally {
      setExportingZip(false)
      setZipProgress(null)
    }
  }

  async function handleDownloadSinglePdf(payslip: Payslip) {
    if (downloadingPdfId) return
    try {
      setDownloadingPdfId(payslip.id)
      await downloadSinglePayslipPdf(payslip, currentProfile)
    } catch (err) {
      console.error('Failed to download PDF:', err)
      alert('Failed to generate PDF. You can also view and print directly.')
    } finally {
      setDownloadingPdfId(null)
    }
  }

  return (
    <div>
      {/* Standard Page Header */}
      <div className="page-header">
        <div>
          <h1 className="text-page-title">
            My Payslips &amp; Compensation
          </h1>
          <p className="text-meta" style={{ marginTop: 2 }}>
            View and download your official monthly salary receipts across all financial cycles
          </p>
        </div>

        <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {payslips.length > 0 && (
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={exportingZip || filteredPayslips.length === 0}
              className="btn btn-primary btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 700,
              }}
              title="Download all payslips in this cycle as a ZIP archive of official PDFs"
            >
              {exportingZip ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>
                    Generating ({zipProgress ? `${zipProgress.current}/${zipProgress.total}` : 'PDFs...'})
                  </span>
                </>
              ) : (
                <>
                  <Archive size={14} />
                  <span>Download ZIP ({filteredPayslips.length} PDFs)</span>
                </>
              )}
            </button>
          )}

          {currentProfile.role === 'ADMIN' && (
            <Link href="/payroll" className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <ShieldCheck size={14} /> Open Admin Payroll Vault <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>

      {/* Main Page Body with balanced 4-sided spacing */}
      <div className="page-body">
        {/* Export Progress Notification Banner */}
        {exportingZip && zipProgress && (
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: '#EFF6FF',
              border: '1.5px solid #93C5FD',
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.08)',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Loader2 size={20} className="animate-spin" style={{ color: '#1E3A8A', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#1E3A8A' }}>
                  Generating High-Resolution Payslip PDFs ({zipProgress.current} of {zipProgress.total})...
                </div>
                <div style={{ fontSize: '11.5px', color: '#3B82F6', marginTop: '2px' }}>
                  Processing: <code style={{ background: '#DBEAFE', padding: '1px 6px', borderRadius: 4, color: '#1E3A8A' }}>{zipProgress.currentFileName}</code>
                </div>
              </div>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#1D4ED8' }}>
              {Math.round((zipProgress.current / zipProgress.total) * 100)}%
            </div>
          </div>
        )}

        {/* Financial Year Selector Tabs */}
        <div className="tabs" style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          marginBottom: 20,
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          width: '100%',
          gap: 4,
        }}>
          <button
            className={`tab ${selectedFY === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedFY('ALL')}
          >
            All Cycles ({payslips.length})
          </button>
          {availableFYs.map((fy) => {
            const count = payslips.filter((p) => p.financial_year === fy).length
            return (
              <button
                key={fy}
                className={`tab ${selectedFY === fy ? 'active' : ''}`}
                onClick={() => setSelectedFY(fy)}
              >
                {fy} ({count})
              </button>
            )
          })}
        </div>

        {/* Payslips Grid / Cards */}
        {filteredPayslips.length === 0 ? (
          <div className="card" style={{
            padding: '64px 24px',
            textAlign: 'center',
            width: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 280,
          }}>
            <FileText size={44} color="var(--text-tertiary)" style={{ margin: '0 auto 14px' }} />
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>No Payslips Available Yet</h3>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', lineHeight: 1.5 }}>
              Your monthly salary slips will appear here once published by the finance &amp; payroll team.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 16,
            width: '100%',
          }}>
            {filteredPayslips.map((p) => {
              const monthName = getMonthName(p.month)
              const isINR = p.currency === 'INR'
              const isCurrentDownloading = downloadingPdfId === p.id

              return (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 16,
                    transition: 'transform 150ms ease, box-shadow 150ms ease',
                    cursor: 'pointer',
                  }}
                  onClick={() => setViewingPayslip(p)}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span className="badge badge-default" style={{ fontSize: 11, fontWeight: 700 }}>
                        {p.financial_year}
                      </span>
                      <span className={`badge ${p.status === 'PAID' ? 'badge-success' : 'badge-primary'}`} style={{ fontSize: 11 }}>
                        {p.status}
                      </span>
                    </div>

                    <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                      {monthName} {p.year}
                    </h3>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Disbursed via {p.payment_method?.replace('_', ' ')}
                    </div>
                  </div>

                  <div style={{
                    background: 'var(--bg)',
                    padding: '12px 14px',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Net Salary Paid</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: isINR ? '#15803D' : '#1D4ED8', marginTop: 2 }}>
                        {formatCurrencyAmount(p.net_pay, p.currency)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Paid Days</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {p.paid_days} / {p.working_days}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ flex: 1, minWidth: '90px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      onClick={(e) => { e.stopPropagation(); setViewingPayslip(p); }}
                    >
                      <Eye size={14} /> View
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={isCurrentDownloading}
                      style={{ flex: 1, minWidth: '110px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownloadSinglePdf(p)
                      }}
                      title="Download clean PDF directly"
                    >
                      {isCurrentDownloading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>PDF...</span>
                        </>
                      ) : (
                        <>
                          <Download size={14} />
                          <span>Download PDF</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Payslip Document Viewer Modal */}
      {viewingPayslip && (
        <PayslipDocument
          payslip={viewingPayslip}
          onClose={() => setViewingPayslip(null)}
        />
      )}
    </div>
  )
}
