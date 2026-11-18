'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Share2,
  Printer,
  Edit2,
  Trash2,
  Check,
  Copy,
  MessageCircle,
  Mail,
  AlertTriangle,
  X,
} from 'lucide-react'
import type { Contract, ContractStatus } from '@/types/database'
import StandardContractTemplate from '@/components/contracts/StandardContractTemplate'

interface Props {
  contract: Contract
  profile: any
}

const STATUS_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  DRAFT: ['SENT', 'ACTIVE'],
  SENT: ['SIGNED', 'ACTIVE', 'TERMINATED'],
  SIGNED: ['ACTIVE', 'TERMINATED'],
  ACTIVE: ['EXPIRED', 'TERMINATED'],
  EXPIRED: ['ACTIVE', 'TERMINATED'],
  TERMINATED: ['DRAFT', 'ACTIVE'],
}

export default function ContractDetailClient({ contract: initialContract }: Props) {
  const router = useRouter()
  const [contract, setContract] = useState<Contract>(initialContract)
  const [updating, setUpdating] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState(false)

  // Email state inside modal
  const [recipientEmail, setRecipientEmail] = useState(contract.client_email || '')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/contracts/view/${contract.id}` : ''

  function copyLink() {
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function handlePrint() {
    const originalTitle = document.title
    const clientName = contract.client_company || contract.client_name
    document.title = `Contract — Adonix for ${clientName} (${contract.contract_number})`
    window.print()
    setTimeout(() => {
      document.title = originalTitle
    }, 1000)
  }

  function openWhatsApp() {
    const priceText = `${(contract.total_with_tax || contract.contract_price).toLocaleString()} ${contract.currency}`
    const message = `Hello ${contract.client_name},\n\nPlease review your official Service Agreement & Contract with Asaheeb and Adonix Developments Company:\n\n📄 Contract: ${contract.contract_number}\n📌 Service: ${contract.service_title}\n⏳ Duration: ${contract.term_duration}\n💰 Total: ${priceText}\n\n👉 Open Contract & Sign Online:\n${publicUrl}\n\n---\nمرحباً بك، يرجى الاطلاع على عقد تقديم الخدمات المعتمد وتوقيعه إلكترونياً عبر الرابط أعلاه.`

    const phoneClean = (contract.client_phone || '').replace(/[^0-9]/g, '')
    const waUrl = `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`
    window.open(waUrl, '_blank')
  }

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!recipientEmail) return
    setSendingEmail(true)
    setEmailStatus(null)

    try {
      const res = await fetch('/api/contracts/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: contract.id,
          recipientEmail: recipientEmail.trim(),
          recipientName: contract.client_name,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setEmailStatus('✓ Contract sent to client successfully!')
        if (contract.status === 'DRAFT') {
          setContract({ ...contract, status: 'SENT' })
        }
      } else {
        setEmailStatus(data.error || 'Failed to send contract email.')
      }
    } catch (err: any) {
      setEmailStatus('Error sending email. Please check network.')
    } finally {
      setSendingEmail(false)
    }
  }

  async function updateStatus(newStatus: ContractStatus) {
    setUpdating(true)
    try {
      const res = await fetch(`/api/contracts/${contract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (res.ok && data.contract) {
        setContract(data.contract)
      }
    } catch (err) {
      console.error('Failed to update status:', err)
    } finally {
      setUpdating(false)
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/contracts/${contract.id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/contracts')
      }
    } catch (err) {
      console.error('Error deleting contract:', err)
    } finally {
      setDeleting(false)
    }
  }

  const nextStatuses = STATUS_TRANSITIONS[contract.status] || []

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Top Action Bar (Hidden during print) */}
      <div className="page-header no-print" style={{ marginBottom: 20 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="text-page-title" style={{ fontFamily: 'monospace', margin: 0, fontSize: 20 }}>
                {contract.contract_number}
              </h1>
              <span className={`badge ${contract.status === 'SIGNED' || contract.status === 'ACTIVE' ? 'badge-success' : contract.status === 'SENT' ? 'badge-info' : 'badge-default'}`}>
                {contract.status}
              </span>
            </div>
            <p className="text-meta" style={{ marginTop: 2 }}>
              Client: <strong>{contract.client_name}</strong> {contract.client_company ? `(${contract.client_company})` : ''} · Term: <strong>{contract.term_duration}</strong>
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Status Switcher Buttons */}
          {nextStatuses.map((st) => (
            <button
              key={st}
              type="button"
              disabled={updating}
              onClick={() => updateStatus(st)}
              className="btn btn-outline btn-sm"
              style={{ fontSize: 12 }}
            >
              Mark as {st}
            </button>
          ))}

          {/* Share Modal Trigger */}
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Share2 size={14} />
            Share with Client
          </button>

          {/* Print / Save PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="btn btn-outline btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={14} />
            Print / PDF
          </button>

          {/* Edit */}
          <Link
            href={`/contracts/${contract.id}/edit`}
            className="btn btn-ghost btn-sm"
            title="Edit Contract Details"
            style={{ padding: '6px 8px' }}
          >
            <Edit2 size={15} />
          </Link>

          {/* Delete */}
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="btn btn-ghost btn-sm"
            title="Delete Contract"
            style={{ color: 'var(--danger)', padding: '6px 8px' }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Render Official Bilingual Document */}
      <StandardContractTemplate
        contract={contract}
        officeLocation={(contract.office_location as any) || 'KSA'}
      />

      {/* SHARE MODAL */}
      {showShareModal && (
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
          <div className="card" style={{ maxWidth: 480, width: '100%', padding: 24, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Share2 size={18} style={{ color: 'var(--accent)' }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Share Contract with Client
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Direct Public Link with 1-Click Copy */}
            <div style={{ marginBottom: 18 }}>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                Direct Public Client Link (No login required)
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  readOnly
                  value={publicUrl}
                  className="form-input"
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
                <button
                  type="button"
                  onClick={copyLink}
                  className="btn btn-outline btn-sm"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {copied ? (
                    <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Check size={14} /> Copied!
                    </span>
                  ) : (
                    <>
                      <Copy size={14} /> Copy
                    </>
                  )}
                </button>
              </div>
              <span className="form-hint" style={{ marginTop: 4, display: 'block' }}>
                Client can open this on any device to read English &amp; Arabic clauses, download PDF, and digitally sign online.
              </span>
            </div>

            {/* WhatsApp Share Box */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 'var(--radius)',
                marginBottom: 18,
              }}
            >
              <div>
                <strong style={{ fontSize: 13, color: '#166534', display: 'block' }}>Send via WhatsApp</strong>
                <span style={{ fontSize: 11.5, color: '#15803d' }}>
                  Opens WhatsApp with pre-filled English &amp; Arabic contract link.
                </span>
              </div>
              <button
                type="button"
                onClick={openWhatsApp}
                className="btn btn-sm"
                style={{ background: '#16a34a', color: '#ffffff', borderColor: '#16a34a' }}
              >
                <MessageCircle size={14} /> WhatsApp
              </button>
            </div>

            {/* Email Share Form */}
            <form onSubmit={handleSendEmail} style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                Send Directly via Email (Resend)
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="email"
                  required
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="client@company.com"
                  className="form-input"
                />
                <button
                  type="submit"
                  disabled={sendingEmail}
                  className="btn btn-primary btn-sm"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <Mail size={14} />
                  {sendingEmail ? 'Sending...' : 'Send'}
                </button>
              </div>

              {emailStatus && (
                <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginTop: 6 }}>
                  {emailStatus}
                </div>
              )}
            </form>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="btn btn-outline btn-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && (
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
          <div className="card" style={{ maxWidth: 440, width: '100%', padding: 24, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--danger)', marginBottom: 12 }}>
              <AlertTriangle size={20} />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Delete Contract
              </h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete contract <strong>{contract.contract_number}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Contract'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
