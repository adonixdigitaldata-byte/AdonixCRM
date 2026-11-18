'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  Filter,
  FileSignature,
  Copy,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  ExternalLink,
  MessageCircle,
  Trash2,
  Edit2,
  Check,
  X,
} from 'lucide-react'
import type { Contract, ContractStatus } from '@/types/database'

interface Props {
  initialContracts: Contract[]
}

const STATUS_BADGE: Record<ContractStatus, { className: string; label: string }> = {
  DRAFT: { className: 'badge badge-default', label: 'Draft' },
  SENT: { className: 'badge badge-info', label: 'Sent to Client' },
  SIGNED: { className: 'badge badge-success', label: 'Digitally Signed' },
  ACTIVE: { className: 'badge badge-success', label: 'Active Retainer' },
  EXPIRED: { className: 'badge badge-warning', label: 'Expired' },
  TERMINATED: { className: 'badge badge-danger', label: 'Terminated' },
}

export default function ContractsListClient({ initialContracts }: Props) {
  const router = useRouter()
  const [contracts, setContracts] = useState<Contract[]>(initialContracts)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Filtered contracts
  const filtered = contracts.filter((c) => {
    const q = search.toLowerCase().trim()
    const matchSearch =
      !q ||
      c.contract_number.toLowerCase().includes(q) ||
      c.client_name.toLowerCase().includes(q) ||
      (c.client_company && c.client_company.toLowerCase().includes(q)) ||
      c.service_title.toLowerCase().includes(q)

    const matchStatus = statusFilter === 'ALL' || c.status === statusFilter

    return matchSearch && matchStatus
  })

  // Metric stats
  const totalContracts = contracts.length
  const activeContracts = contracts.filter((c) => c.status === 'ACTIVE' || c.status === 'SIGNED').length
  const pendingContracts = contracts.filter((c) => c.status === 'DRAFT' || c.status === 'SENT').length
  const totalValueSAR = contracts.reduce((acc, c) => {
    const rate = c.currency === 'USD' ? 3.75 : c.currency === 'AED' ? 1.02 : c.currency === 'INR' ? 0.045 : 1
    return acc + Number(c.total_with_tax || c.contract_price || 0) * rate
  }, 0)

  function copyPublicLink(contractId: string) {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${origin}/contracts/view/${contractId}`
    navigator.clipboard.writeText(url)
    setCopiedId(contractId)
    setTimeout(() => setCopiedId(null), 2500)
  }

  function shareWhatsApp(contract: Contract) {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${origin}/contracts/view/${contract.id}`
    const priceText = `${(contract.total_with_tax || contract.contract_price).toLocaleString()} ${contract.currency}`

    const message = `Hello ${contract.client_name},\n\nPlease review your official Service Agreement & Contract with Asaheeb and Adonix Developments Company:\n\n📄 Contract: ${contract.contract_number}\n📌 Service: ${contract.service_title}\n⏳ Duration: ${contract.term_duration}\n💰 Total: ${priceText}\n\n👉 Open Contract & Sign Online:\n${url}\n\n---\nمرحباً بك، يرجى الاطلاع على عقد تقديم الخدمات المعتمد وتوقيعه إلكترونياً عبر الرابط أعلاه.`

    const waUrl = `https://wa.me/${(contract.client_phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`
    window.open(waUrl, '_blank')
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/contracts/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setContracts(contracts.filter((c) => c.id !== id))
        setDeleteModalId(null)
      }
    } catch (err) {
      console.error('Failed to delete contract:', err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="text-page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileSignature size={24} style={{ color: 'var(--accent)' }} />
            Contracts &amp; Client Agreements
          </h1>
          <p className="text-meta" style={{ marginTop: 4 }}>
            Generate, sign, and share bilingual (English &amp; Arabic) client contracts directly from Adonix.
          </p>
        </div>

        <Link
          href="/contracts/new"
          className="btn btn-primary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={14} />
          New contract
        </Link>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Metric Cards */}
        <div className="rg-stats">
          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Total Contracts</span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--text-primary)' }}>
              {totalContracts}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, display: 'block' }}>
              Across all service lines
            </span>
          </div>

          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>Active &amp; Signed</span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--success)' }}>
              {activeContracts}
            </div>
            <span style={{ fontSize: 11, color: 'var(--success)', marginTop: 2, display: 'block' }}>
              In full legal effect
            </span>
          </div>

          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--info)', fontWeight: 500 }}>Pending / Sent</span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--info)' }}>
              {pendingContracts}
            </div>
            <span style={{ fontSize: 11, color: 'var(--info)', marginTop: 2, display: 'block' }}>
              Awaiting client signature
            </span>
          </div>

          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>Total Portfolio Value</span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--accent)' }}>
              SAR {totalValueSAR.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, display: 'block' }}>
              Combined contract pipeline
            </span>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
              }}
            />
            <input
              type="text"
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by client, company, service or contract #..."
              style={{ paddingLeft: 36, width: '100%' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: 150 }}
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="SIGNED">Signed</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </div>
        </div>

        {/* Table or Empty State */}
        {filtered.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <FileSignature size={40} style={{ margin: '0 auto', color: 'var(--text-tertiary)' }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginTop: 12 }}>
              No contracts found
            </h3>
            <p className="text-meta" style={{ marginTop: 4, maxWidth: 360, margin: '6px auto 16px' }}>
              {search || statusFilter !== 'ALL'
                ? 'Try adjusting your search query or filter options.'
                : 'Get started by creating your first bilingual client agreement in seconds.'}
            </p>
            <Link
              href="/contracts/new"
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={14} />
              Create First Contract
            </Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Contract Ref</th>
                  <th>Client / Company</th>
                  <th>Service &amp; Scope</th>
                  <th>Term &amp; Dates</th>
                  <th className="num">Value</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right', paddingRight: 16 }}>Actions &amp; Share</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const badge = STATUS_BADGE[c.status] || STATUS_BADGE.DRAFT
                  return (
                    <tr
                      key={c.id}
                      className="clickable"
                      onClick={(e) => {
                        const target = e.target as HTMLElement
                        if (
                          target.tagName !== 'BUTTON' &&
                          target.tagName !== 'A' &&
                          !target.closest('a') &&
                          !target.closest('button')
                        ) {
                          router.push(`/contracts/${c.id}`)
                        }
                      }}
                    >
                      {/* Contract Ref */}
                      <td style={{ fontWeight: 600, color: 'var(--accent)', fontFamily: 'monospace' }}>
                        <Link href={`/contracts/${c.id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                          {c.contract_number}
                        </Link>
                      </td>

                      {/* Client / Company */}
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.client_name}</div>
                        {c.client_company && (
                          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 1 }}>
                            {c.client_company}
                          </div>
                        )}
                      </td>

                      {/* Service */}
                      <td style={{ maxWidth: 220 }}>
                        <div
                          style={{
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={c.service_title}
                        >
                          {c.service_title}
                        </div>
                        <div
                          dir="rtl"
                          style={{
                            fontSize: 11,
                            color: 'var(--text-tertiary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {c.service_title_ar}
                        </div>
                      </td>

                      {/* Term & Dates */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.term_duration}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {c.start_date} {c.end_date ? `→ ${c.end_date}` : ''}
                        </div>
                      </td>

                      {/* Value */}
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {(c.total_with_tax || c.contract_price || 0).toLocaleString()} {c.currency}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{c.billing_cycle}</div>
                      </td>

                      {/* Status */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className={badge.className}>{badge.label}</span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap', paddingRight: 16 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {/* Copy Link Button */}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              copyPublicLink(c.id)
                            }}
                            title="Copy Public Client Link"
                            style={{ padding: '4px 8px', height: 28 }}
                          >
                            {copiedId === c.id ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--success)' }}>
                                <Check size={13} /> Copied
                              </span>
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>

                          {/* WhatsApp Button */}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              shareWhatsApp(c)
                            }}
                            title="Share on WhatsApp with Client"
                            style={{ padding: '4px 8px', height: 28, color: '#16a34a' }}
                          >
                            <MessageCircle size={13} />
                          </button>

                          {/* View Detail Link */}
                          <Link
                            href={`/contracts/${c.id}`}
                            className="btn btn-ghost btn-sm"
                            title="View Full Contract Document"
                            style={{ padding: '4px 8px', height: 28 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink size={13} />
                          </Link>

                          {/* Edit Link */}
                          <Link
                            href={`/contracts/${c.id}/edit`}
                            className="btn btn-ghost btn-sm"
                            title="Edit Contract"
                            style={{ padding: '4px 8px', height: 28 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Edit2 size={13} />
                          </Link>

                          {/* Delete Button */}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteModalId(c.id)
                            }}
                            title="Delete Contract"
                            style={{ padding: '4px 8px', height: 28, color: 'var(--danger)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalId && (
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
              Are you sure you want to delete this contract? This will permanently remove the agreement and its public client link.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setDeleteModalId(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => handleDelete(deleteModalId)}
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
