'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, CheckCircle, XCircle, Clock, Search, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Profile } from '@/types/database'

interface EnrichedAgent extends Profile {
  last_sign_in_at?: string | null
  is_confirmed?: boolean
  wonLeads?: number
  conversionRate?: number
  completedFollowups?: number
  quotationCount?: number
  invoiceCount?: number
}

interface Props {
  agents: EnrichedAgent[]
  agentLeadCounts: Record<string, number>
  currentUserId: string
}

export default function AgentsClient({ agents: initialAgents, agentLeadCounts, currentUserId }: Props) {
  const router = useRouter()
  const [agents, setAgents] = useState<EnrichedAgent[]>(initialAgents)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [resendingEmails, setResendingEmails] = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState('')

  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
  }, [])

  const filteredAgents = useMemo(() => {
    if (!search.trim()) return agents
    const q = search.toLowerCase()
    return agents.filter(
      (a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
    )
  }, [agents, search])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim() || !inviteName.trim() || inviteLoading) return
    setInviteLoading(true)
    setInviteError('')
    setInviteSuccess('')

    const res = await fetch('/api/agents/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim(), name: inviteName.trim() }),
    })

    const data = await res.json()
    if (!res.ok) {
      setInviteError(data.error ?? 'Failed to invite agent')
    } else {
      setInviteSuccess(`Invitation sent to ${inviteEmail}`)
      if (data.userId) {
        const newAgent: EnrichedAgent = {
          id: data.userId,
          name: inviteName.trim(),
          email: inviteEmail.trim(),
          role: 'AGENT',
          is_active: true,
          avatar_url: null,
          total_leads_assigned: 0,
          open_leads_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          last_sign_in_at: null,
          is_confirmed: false,
          wonLeads: 0,
          conversionRate: 0,
          completedFollowups: 0,
          quotationCount: 0,
          invoiceCount: 0,
        }
        setAgents([newAgent, ...agents])
      }
      setInviteEmail('')
      setInviteName('')
      setShowInvite(false)
    }
    setInviteLoading(false)
  }

  async function resendInvite(email: string, name: string) {
    setInviteSuccess('')
    setInviteError('')
    setResendingEmails((prev) => {
      const next = new Set(prev)
      next.add(email)
      return next
    })

    const res = await fetch('/api/agents/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    })
    const data = await res.json()
    if (!res.ok) {
      setInviteError(data.error ?? 'Failed to send reset link')
    } else {
      setInviteSuccess(`Password reset email link sent to ${email}`)
    }

    setResendingEmails((prev) => {
      const next = new Set(prev)
      next.delete(email)
      return next
    })
  }

  async function toggleActive(agentId: string, currentStatus: boolean) {
    await supabase
      .from('profiles')
      .update({ is_active: !currentStatus })
      .eq('id', agentId)
    setAgents(agents.map((a) => a.id === agentId ? { ...a, is_active: !currentStatus } : a))
  }

  const topByLeads = [...agents].sort((a, b) => b.total_leads_assigned - a.total_leads_assigned)
  const maxLeads = topByLeads.length > 0 && topByLeads[0].total_leads_assigned > 0 ? topByLeads[0].total_leads_assigned : 1

  return (
    <div>
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <div style={{ minWidth: 0 }}>
          <h1 className="text-page-title">Agents &amp; Team</h1>
          <p className="text-meta" style={{ marginTop: 2 }}>
            {agents.filter((a) => a.is_active && a.last_sign_in_at).length} active ·{' '}
            {agents.filter((a) => a.is_active && !a.last_sign_in_at).length} pending invite ·{' '}
            {agents.length} total members
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(true)} style={{ flexShrink: 0 }}>
          <UserPlus size={14} />
          Invite agent
        </button>
      </div>

      <div className="page-body">
        {inviteSuccess && (
          <div style={{
            padding: '10px 16px', background: 'var(--success-light)', border: '1px solid var(--success)',
            borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--success)', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <CheckCircle size={14} />
            {inviteSuccess}
          </div>
        )}

        {inviteError && (
          <div style={{
            padding: '10px 16px', background: 'var(--danger-light)', border: '1px solid var(--danger)',
            borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--danger)', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <XCircle size={14} />
            {inviteError}
          </div>
        )}

        {/* Invite form */}
        {showInvite && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="text-section-header">Invite new team member</span>
            </div>
            <div className="card-body">
              <form onSubmit={handleInvite} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: '1 1 200px' }}>
                  <label className="form-label form-label-required">Name</label>
                  <input
                    className="form-input"
                    placeholder="Agent name"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: '1 1 200px' }}>
                  <label className="form-label form-label-required">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="agent@adonix.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-2" style={{ paddingBottom: 1 }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowInvite(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={inviteLoading}>
                    {inviteLoading ? 'Sending...' : 'Send invitation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Search bar */}
        <div style={{ marginBottom: 14, position: 'relative' }}>
          <Search size={15} style={{
            position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-tertiary)', pointerEvents: 'none',
          }} />
          <input
            className="form-input"
            placeholder="Search agents by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>

        <div className="table-wrapper">
          <table className="table" style={{ minWidth: 880 }}>
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Agent</th>
                <th style={{ width: '8%' }}>Role</th>
                <th style={{ width: '12%' }}>Status</th>
                <th style={{ width: '14%' }}>Last active</th>
                <th className="num" style={{ width: '9%' }}>Leads</th>
                <th className="num" style={{ width: '7%' }}>Won</th>
                <th className="num" style={{ width: '8%' }}>Conv. %</th>
                <th className="num" style={{ width: '10%' }}>Quotes/Invoices</th>
                <th style={{ width: '10%' }}>Performance</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgents.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '32px 16px' }}>
                    {search ? `No team members match "${search}"` : 'No team members found'}
                  </td>
                </tr>
              ) : (
                filteredAgents.map((agent) => {
                  const isPending = !agent.last_sign_in_at
                  const totalLeads = agent.total_leads_assigned ?? 0
                  const wonLeads = agent.wonLeads ?? 0
                  const convRate = agent.conversionRate ?? 0
                  const quoteCount = agent.quotationCount ?? 0
                  const invCount = agent.invoiceCount ?? 0
                  const perfPct = maxLeads > 0 ? (totalLeads / maxLeads) * 100 : 0

                  return (
                    <tr
                      key={agent.id}
                      className="clickable"
                      onClick={() => router.push(`/settings/agents/${agent.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="avatar avatar-sm">
                            {agent.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 500, fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {agent.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {agent.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{
                          background: agent.role === 'ADMIN' ? '#eff6ff' : '#f4f4f5',
                          color: agent.role === 'ADMIN' ? '#2563eb' : '#52525b',
                          fontSize: 11, fontWeight: 600, border: '1px solid var(--border)',
                        }}>
                          {agent.role}
                        </span>
                      </td>
                      <td>
                        {!agent.is_active ? (
                          <span className="badge badge-danger">
                            <span className="badge-dot" style={{ background: 'var(--danger)' }} />
                            Inactive
                          </span>
                        ) : isPending ? (
                          <span className="badge badge-warning" title="Agent hasn't logged in yet">
                            <Clock size={11} />
                            Invite pending
                          </span>
                        ) : (
                          <span className="badge badge-success">
                            <span className="badge-dot" style={{ background: 'var(--success)' }} />
                            Active
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {!mounted ? (
                          <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        ) : agent.last_sign_in_at && agent.last_seen_at ? (
                          formatDistanceToNow(new Date(agent.last_seen_at), { addSuffix: true })
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>Never logged in</span>
                        )}
                      </td>
                      <td className="num tabular-nums" style={{ fontWeight: totalLeads > 0 ? 600 : 400 }}>{totalLeads}</td>
                      <td className="num tabular-nums" style={{ color: wonLeads > 0 ? 'var(--success)' : 'var(--text-secondary)', fontWeight: wonLeads > 0 ? 600 : 400 }}>
                        {wonLeads}
                      </td>
                      <td className="num tabular-nums">
                        <span style={{
                          fontWeight: 600,
                          color: convRate >= 20 ? 'var(--success)' : convRate >= 10 ? '#d97706' : 'var(--text-secondary)',
                        }}>
                          {convRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="num tabular-nums" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {quoteCount} / {invCount}
                      </td>
                      <td>
                        <div style={{ height: 5, background: 'var(--border)', borderRadius: 100, overflow: 'hidden' }}>
                          <div style={{
                            width: `${perfPct}%`, height: '100%', borderRadius: 100,
                            background: perfPct > 66 ? 'var(--success)' : perfPct > 33 ? '#d97706' : 'var(--accent)',
                            transition: 'width 600ms ease',
                          }} />
                        </div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          {agent.is_active && (
                            <button
                              className="btn btn-outline btn-xs"
                              onClick={() => resendInvite(agent.email, agent.name)}
                              disabled={resendingEmails.has(agent.email)}
                              style={{ padding: '2px 8px' }}
                              title="Send password setup or reset link to agent email"
                            >
                              {resendingEmails.has(agent.email) ? 'Sending...' : 'Reset link'}
                            </button>
                          )}
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => toggleActive(agent.id, agent.is_active)}
                            style={{ color: agent.is_active ? 'var(--danger)' : 'var(--success)', padding: '2px 6px' }}
                          >
                            {agent.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <ChevronRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
