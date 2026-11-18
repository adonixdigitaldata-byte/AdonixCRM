'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Printer,
  ShieldCheck,
  CheckCircle2,
  FileSignature,
  X,
  FileCheck,
  ArrowLeft,
} from 'lucide-react'
import type { Contract } from '@/types/database'
import StandardContractTemplate from '@/components/contracts/StandardContractTemplate'

interface Props {
  initialContract: Contract
  fromPortal?: boolean
}

export default function PublicContractViewClient({ initialContract, fromPortal = false }: Props) {
  const [contract, setContract] = useState<Contract>(initialContract)
  const [showSignModal, setShowSignModal] = useState(false)
  const [showBackToPortal, setShowBackToPortal] = useState(Boolean(fromPortal))

  useEffect(() => {
    if (!showBackToPortal && typeof document !== 'undefined' && document.referrer?.includes('/portal')) {
      setShowBackToPortal(true)
    }
  }, [showBackToPortal])

  const [signatoryName, setSignatoryName] = useState(contract.client_representative || contract.client_name || '')
  const [signatoryTitle, setSignatoryTitle] = useState('Authorized Representative')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)

  const isSigned = contract.status === 'SIGNED' || contract.status === 'ACTIVE'

  function handlePrint() {
    const originalTitle = document.title
    const clientName = contract.client_company || contract.client_name
    document.title = `Contract — Adonix for ${clientName} (${contract.contract_number})`
    window.print()
    setTimeout(() => {
      document.title = originalTitle
    }, 1000)
  }

  async function handleSignContract(e: React.FormEvent) {
    e.preventDefault()
    setSignError(null)

    if (!signatoryName.trim()) {
      setSignError('Please enter your full legal name.')
      return
    }
    if (!agreeTerms) {
      setSignError('Please check the confirmation box to accept the agreement terms.')
      return
    }

    setSigning(true)
    try {
      const res = await fetch(`/api/contracts/${contract.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatoryName: signatoryName.trim(),
          signatoryTitle: signatoryTitle.trim(),
          signatureNotes: `Accepted online via Adonix Portal on ${new Date().toUTCString()}`,
        }),
      })

      const data = await res.json()
      if (res.ok && data.contract) {
        setContract(data.contract)
        setShowSignModal(false)
      } else {
        setSignError(data.error || 'Failed to digitally sign the agreement.')
      }
    } catch (err: any) {
      setSignError(err.message || 'Error communicating with server.')
    } finally {
      setSigning(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-primary)', paddingBottom: 60 }}>
      {/* Client-Facing Top Bar (Hidden during print) */}
      <header
        className="no-print"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 24px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ maxWidth: 1040, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {showBackToPortal && (
              <>
                <Link
                  href="/portal?section=contracts"
                  className="btn btn-outline btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 12 }}
                >
                  <ArrowLeft size={14} />
                  <span>Back to Portal</span>
                </Link>

                <div style={{ height: 22, width: 1, background: 'var(--border)' }} />
              </>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img
                src="/logo.png"
                alt="Adonix Logo"
                style={{ height: 28, width: 'auto', objectFit: 'contain' }}
              />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Adonix Developments</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--accent)' }}>{contract.contract_number}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Official Bilingual Services Agreement (عقد تقديم وإدارة خدمات رقمية)
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Print / Save PDF Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-outline btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Printer size={14} style={{ color: 'var(--text-secondary)' }} />
              Print / Save PDF
            </button>

            {/* Accept & Sign Button (if not yet signed) */}
            {!isSigned ? (
              <button
                type="button"
                onClick={() => setShowSignModal(true)}
                className="btn btn-sm"
                style={{
                  background: 'var(--success)',
                  color: '#ffffff',
                  borderColor: 'var(--success)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 600,
                }}
              >
                <FileCheck size={14} />
                Accept &amp; Sign Contract (قبول وتوقيع العقد)
              </button>
            ) : (
              <span className="badge badge-success" style={{ fontSize: 12, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={14} />
                Officially Signed &amp; Active
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Document Content */}
      <main style={{ maxWidth: 1040, margin: '20px auto 0', padding: '0 16px' }}>
        {/* Verification banner if already signed */}
        {isSigned && (
          <div
            className="no-print"
            style={{
              marginBottom: 20,
              padding: '14px 18px',
              borderRadius: 'var(--radius)',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldCheck size={22} style={{ color: '#059669', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                  Agreement Digitally Signed &amp; Executed
                </div>
                <div style={{ fontSize: 12, color: '#047857' }}>
                  Confirmed by <strong>{contract.signed_by_name || contract.client_name}</strong> on {contract.signed_at ? new Date(contract.signed_at).toLocaleString() : ''}.
                </div>
              </div>
            </div>

            <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 9999, background: '#bbf7d0', color: '#14532d' }}>
              Contract Active
            </span>
          </div>
        )}

        <StandardContractTemplate
          contract={contract}
          officeLocation={(contract.office_location as any) || 'KSA'}
        />
      </main>

      {/* Digital Signature Modal */}
      {showSignModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(3px)',
            padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 460, width: '100%', padding: 24, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileSignature size={18} style={{ color: 'var(--success)' }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Accept &amp; Digitally Sign Agreement
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSignModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
              By submitting this confirmation, you accept all terms, deliverables, and payment obligations set forth in this bilingual Agreement with <strong>Asaheeb and Adonix Developments Company</strong>.
            </p>

            {signError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--danger-light)',
                  border: '1px solid var(--danger)',
                  fontSize: 12,
                  color: 'var(--danger)',
                  marginBottom: 14,
                }}
              >
                {signError}
              </div>
            )}

            <form onSubmit={handleSignContract} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label form-label-required">
                  Full Legal Name of Signatory (الاسم الثلاثي للمفوّض)
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={signatoryName}
                  onChange={(e) => setSignatoryName(e.target.value)}
                  placeholder="e.g. Dr. Sufyan Al-Ghamdi"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Title / Position (الصفة / المنصب)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={signatoryTitle}
                  onChange={(e) => setSignatoryTitle(e.target.value)}
                  placeholder="e.g. Managing Director / Owner"
                />
              </div>

              <div style={{ paddingTop: 4 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    cursor: 'pointer',
                    padding: 10,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    I confirm that I have reviewed the bilingual contract clauses, agree to the pricing and duration, and have the authority to execute this agreement. (أقر بموافقتي التامة على بنود العقد وشروطه المالية ونطاق الخدمات).
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowSignModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={signing}
                  className="btn btn-sm"
                  style={{ background: 'var(--success)', color: '#ffffff', borderColor: 'var(--success)', fontWeight: 600 }}
                >
                  <ShieldCheck size={14} />
                  {signing ? 'Confirming...' : 'I Agree & Sign Contract'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
