'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, CheckCircle, XCircle, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Profile } from '@/types/database'

interface EnrichedAgent extends Profile {
  last_sign_in_at?: string | null
  is_confirmed?: boolean
}

interface Props {
  agents: EnrichedAgent[]
  agentLeadCounts: Record<string, number>
  currentUserId: string
}

export default function AgentsClient({ agents: initialAgents, agentLeadCounts, currentUserId }: Props) {
  const [agents, setAgents] = useState<EnrichedAgent[]>(initialAgents)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [resendingEmails, setResendingEmails] = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
  }, [])

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
      setInviteError(data.error ?? 'Failed to resend invite')
    } else {
      setInviteSuccess(`Invitation resent to ${email}`)
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-page-title">Agents</h1>
          <p className="text-meta" style={{ marginTop: 2 }}>
            {agents.filter((a) => a.is_active && a.last_sign_in_at).length} active · {agents.filter((a) => a.is_active && !a.last_sign_in_at).length} pending invite · {agents.length} total
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(true)}>
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
              <span className="text-section-header">Invite new agent</span>
            </div>
            <div className="card-body">
              <form onSubmit={handleInvite} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label form-label-required">Name</label>
                  <input
                    className="form-input"
                    placeholder="Agent name"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
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
              {inviteError && <p className="form-error" style={{ marginTop: 8 }}>{inviteError}</p>}
            </div>
          </div>
        )}

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Email</th>
                <th>Status</th>
                <th>Last active</th>
                <th className="num">Total leads</th>
                <th className="num">Open leads</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '32px 16px' }}>
                    No agents yet — invite your first agent above
                  </td>
                </tr>
              ) : (
                agents.map((agent) => {
                  const isPending = !agent.last_sign_in_at
                  return (
                    <tr key={agent.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="avatar avatar-sm">
                            {agent.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 500 }}>{agent.name}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{agent.email}</td>
                      <td>
                        {!agent.is_active ? (
                          <span className="badge badge-danger">
                            <span className="badge-dot" style={{ background: 'var(--danger)' }} />
                            Inactive
                          </span>
                        ) : isPending ? (
                          <span className="badge badge-warning" title="Agent hasn't set up password or logged in yet">
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
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {!mounted ? (
                          <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        ) : agent.last_sign_in_at && agent.last_seen_at ? (
                          formatDistanceToNow(new Date(agent.last_seen_at), { addSuffix: true })
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>Never logged in</span>
                        )}
                      </td>
                      <td className="num tabular-nums">{agent.total_leads_assigned}</td>
                      <td className="num tabular-nums">{agent.open_leads_count}</td>
                      <td>
                        <div className="flex items-center gap-2 justify-end">
                          {isPending && agent.is_active && (
                            <button
                              className="btn btn-outline btn-xs"
                              onClick={() => resendInvite(agent.email, agent.name)}
                              disabled={resendingEmails.has(agent.email)}
                            >
                              {resendingEmails.has(agent.email) ? (
                                <>
                                  <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1 }} />
                                  Resending...
                                </>
                              ) : (
                                <>
                                  <UserPlus size={12} />
                                  Resend invite
                                </>
                              )}
                            </button>
                          )}
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => toggleActive(agent.id, agent.is_active)}
                            style={{ color: agent.is_active ? 'var(--danger)' : 'var(--success)' }}
                          >
                            {agent.is_active ? (
                              <><XCircle size={13} /> Deactivate</>
                            ) : (
                              <><CheckCircle size={13} /> Activate</>
                            )}
                          </button>
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
