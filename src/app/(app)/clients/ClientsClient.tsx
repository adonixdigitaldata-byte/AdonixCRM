'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Search, Filter, Users, Calendar, TrendingUp, CreditCard } from 'lucide-react'

interface EnrichedClient {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  client_status: string
  assigned_agent_id: string | null
  billing_cycle: string
  billing_amount: number
  contract_start_date: string | null
  contract_end_date: string | null
  created_at: string
}

interface Props {
  initialClients: EnrichedClient[]
  agents: { id: string; name: string }[]
  invoices: { client_id: string; total: number; amount_paid: number; status: string; currency: string }[]
}

function convertToSAR(amount: number, currency?: string): number {
  const rates: Record<string, number> = {
    SAR: 1.0,
    USD: 3.75,
    AED: 1.02,
    INR: 0.045,
  }
  return amount * (rates[currency ?? 'SAR'] ?? 1.0)
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'badge-success',
  VIP: 'badge-info',
  LEAD: 'badge-warning',
  INACTIVE: 'badge-default',
}

const CYCLE_LABELS: Record<string, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
  ONE_TIME: 'One-Time',
  NONE: 'None',
}

export default function ClientsClient({ initialClients, agents, invoices }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [agentFilter, setAgentFilter] = useState('ALL')
  const [cycleFilter, setCycleFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const limit = 10

  // Calculate MRR, Active Retainers, Expiring Contracts
  let mrrTotal = 0
  let activeRetainersCount = 0
  let expiringContractsCount = 0
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
  const today = new Date()

  initialClients.forEach((c) => {
    const isClientActive = c.client_status === 'ACTIVE' || c.client_status === 'VIP'
    if (isClientActive) {
      // Retainer / MRR Calc
      const normalizedAmount = Number(c.billing_amount) || 0
      if (normalizedAmount > 0 && c.billing_cycle !== 'NONE') {
        activeRetainersCount++
        if (c.billing_cycle === 'MONTHLY') {
          mrrTotal += normalizedAmount
        } else if (c.billing_cycle === 'QUARTERLY') {
          mrrTotal += normalizedAmount / 3
        } else if (c.billing_cycle === 'YEARLY') {
          mrrTotal += normalizedAmount / 12
        }
      }

      // Expiring Contracts check
      if (c.contract_end_date) {
        const endDate = new Date(c.contract_end_date)
        if (endDate >= today && endDate <= thirtyDaysFromNow) {
          expiringContractsCount++
        }
      }
    }
  })

  // Filtering
  const filtered = initialClients.filter((c) => {
    const query = search.toLowerCase().trim()
    const matchesSearch =
      !query ||
      (c.name ?? '').toLowerCase().includes(query) ||
      (c.company ?? '').toLowerCase().includes(query) ||
      (c.email ?? '').toLowerCase().includes(query) ||
      (c.phone ?? '').toLowerCase().includes(query)

    const matchesStatus = statusFilter === 'ALL' || c.client_status === statusFilter
    const matchesAgent = agentFilter === 'ALL' || c.assigned_agent_id === agentFilter
    const matchesCycle = cycleFilter === 'ALL' || c.billing_cycle === cycleFilter

    return matchesSearch && matchesStatus && matchesAgent && matchesCycle
  })

  // Pagination
  const totalItems = filtered.length
  const totalPages = Math.ceil(totalItems / limit) || 1
  const startIndex = (page - 1) * limit
  const paginatedClients = filtered.slice(startIndex, startIndex + limit)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-page-title">Client Directory</h1>
          <p className="text-meta" style={{ marginTop: 2 }}>
            Manage client profiles, custom credentials, retainer invoicing, and asset drives
          </p>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Analytics Summary */}
        <div className="rg-stats">
          <div className="card" style={{ padding: '14px 16px' }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Total Clients</span>
              <Users size={16} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--text-primary)' }}>
              {initialClients.length}
            </div>
          </div>

          <div className="card" style={{ padding: '14px 16px' }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>Monthly Recurring Revenue</span>
              <TrendingUp size={16} style={{ color: 'var(--success)' }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--success)' }}>
              SAR {mrrTotal.toLocaleString('en', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="card" style={{ padding: '14px 16px' }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Active Retainers</span>
              <CreditCard size={16} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--text-primary)' }}>
              {activeRetainersCount}
            </div>
          </div>

          <div className="card" style={{ padding: '14px 16px' }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 12, color: expiringContractsCount > 0 ? 'var(--warning)' : 'var(--text-secondary)', fontWeight: 500 }}>
                Expiring Contracts (30 days)
              </span>
              <Calendar size={16} style={{ color: expiringContractsCount > 0 ? 'var(--warning)' : 'var(--text-tertiary)' }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: expiringContractsCount > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
              {expiringContractsCount}
            </div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="toolbar-filters flex gap-3 items-center flex-wrap">
          <div className="search-input-wrapper flex-1" style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search by name, company, email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              style={{ paddingLeft: 36 }}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
            
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              style={{ width: 130 }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="VIP">VIP</option>
              <option value="LEAD">Lead</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            <select
              className="form-select"
              value={agentFilter}
              onChange={(e) => {
                setAgentFilter(e.target.value)
                setPage(1)
              }}
              style={{ width: 160 }}
            >
              <option value="ALL">All Managers</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            <select
              className="form-select"
              value={cycleFilter}
              onChange={(e) => {
                setCycleFilter(e.target.value)
                setPage(1)
              }}
              style={{ width: 140 }}
            >
              <option value="ALL">All Retainers</option>
              <option value="MONTHLY">Monthly</option>
              <option value="ONE_TIME">One-Time</option>
            </select>
          </div>
        </div>

        {/* Client Table */}
        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-title">No clients found</div>
              <div className="empty-state-desc">Try clearing your filters or search terms</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Status</th>
                    <th>Account Manager</th>
                    <th className="num">Billing Retainer</th>
                    <th>Contract Duration</th>
                    <th>Added</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedClients.map((c) => {
                    const agent = agents.find((a) => a.id === c.assigned_agent_id)
                    const billingText =
                      c.billing_cycle === 'NONE' || !c.billing_amount
                        ? '—'
                        : `SAR ${Number(c.billing_amount).toLocaleString('en', { minimumFractionDigits: 0 })} / ${c.billing_cycle.toLowerCase().replace('_', '')}`

                    const hasContract = c.contract_start_date || c.contract_end_date
                    const contractText = hasContract
                      ? `${c.contract_start_date ? format(new Date(c.contract_start_date), 'dd MMM yyyy') : '—'} to ${c.contract_end_date ? format(new Date(c.contract_end_date), 'dd MMM yyyy') : '—'}`
                      : '—'

                    const isContractExpired =
                      c.contract_end_date && new Date(c.contract_end_date) < new Date()

                    return (
                      <tr
                        key={c.id}
                        className="clickable"
                        onClick={(e) => {
                          const target = e.target as HTMLElement
                          if (target.tagName !== 'BUTTON' && target.tagName !== 'A' && !target.closest('a')) {
                            router.push(`/clients/${c.id}`)
                          }
                        }}
                      >
                        <td style={{ fontWeight: 600 }}>
                          <Link href={`/clients/${c.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {c.name}
                          </Link>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{c.company ?? '—'}</td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[c.client_status] ?? 'badge-default'}`}>
                            {c.client_status}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500 }}>{agent ? agent.name : 'Unassigned'}</td>
                        <td className="num tabular-nums" style={{ color: c.billing_cycle !== 'NONE' ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                          {billingText}
                        </td>
                        <td
                          style={{
                            fontSize: 13,
                            color: isContractExpired ? 'var(--danger)' : 'var(--text-secondary)',
                            fontWeight: isContractExpired ? 500 : 400,
                          }}
                        >
                          {contractText}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                          {format(new Date(c.created_at), 'dd MMM yyyy')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center" style={{ padding: '0 8px' }}>
                <span className="text-meta">
                  Showing {startIndex + 1} to {Math.min(startIndex + limit, totalItems)} of {totalItems} clients
                </span>
                <div className="flex gap-2">
                  <button
                    className="btn btn-outline btn-xs"
                    disabled={page === 1}
                    onClick={() => {
                      setPage((p) => p - 1)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-outline btn-xs"
                    disabled={page === totalPages}
                    onClick={() => {
                      setPage((p) => p + 1)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
