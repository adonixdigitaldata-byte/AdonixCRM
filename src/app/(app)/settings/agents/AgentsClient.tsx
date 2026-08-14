'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, CheckCircle, XCircle, Clock, Search, ChevronRight, Edit2, Shield, User, Briefcase, X, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Profile, UserRole, EmployeeSpecialization, WorkStatus } from '@/types/database'
import ClientSearchSelect from '@/components/ui/ClientSearchSelect'

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
  clients?: { id: string; name: string; company?: string | null; email?: string | null }[]
}

const SPECIALIZATIONS: { key: EmployeeSpecialization; label: string }[] = [
  { key: 'WEBSITE', label: 'Website Development' },
  { key: 'SOCIAL_MEDIA', label: 'Social Media Management' },
  { key: 'ADS', label: 'Meta / Google Ads' },
  { key: 'GMB', label: 'GMB & Local SEO' },
  { key: 'VIDEO_AI', label: 'AI Video & Content' },
  { key: 'DESIGN', label: 'Graphic & UI Design' },
  { key: 'SEO', label: 'Organic SEO' },
  { key: 'OTHER', label: 'General / Operations' },
]

export default function AgentsClient({ agents: initialAgents, agentLeadCounts, currentUserId, clients = [] }: Props) {
  const router = useRouter()
  const [agents, setAgents] = useState<EnrichedAgent[]>(initialAgents)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('EMPLOYEE')
  const [inviteSpecialization, setInviteSpecialization] = useState<EmployeeSpecialization>('WEBSITE')
  const [inviteClientId, setInviteClientId] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [resendingEmails, setResendingEmails] = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState('')

  // Edit Role & Specialization Modal State
  const [editUser, setEditUser] = useState<EnrichedAgent | null>(null)
  const [editName, setEditName] = useState<string>('')
  const [editRole, setEditRole] = useState<UserRole>('EMPLOYEE')
  const [editSpecialization, setEditSpecialization] = useState<string>('')
  const [editWorkStatus, setEditWorkStatus] = useState<WorkStatus>('AVAILABLE')
  const [editLoading, setEditLoading] = useState(false)

  // Delete User Modal State
  const [deleteUser, setDeleteUser] = useState<EnrichedAgent | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
  }, [])

  const filteredAgents = useMemo(() => {
    if (!search.trim()) return agents
    const q = search.toLowerCase()
    return agents.filter(
      (a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || (a.specialization && a.specialization.toLowerCase().includes(q))
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
      body: JSON.stringify({
        email: inviteEmail.trim(),
        name: inviteName.trim(),
        role: inviteRole,
        specialization: inviteRole === 'EMPLOYEE' ? inviteSpecialization : null,
        clientId: inviteRole === 'CLIENT' ? inviteClientId : null,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setInviteError(data.error ?? 'Failed to invite team member')
    } else {
      setInviteSuccess(`Invitation sent to ${inviteEmail}`)
      if (data.userId) {
        const newAgent: EnrichedAgent = {
          id: data.userId,
          name: inviteName.trim(),
          email: inviteEmail.trim(),
          role: inviteRole,
          specialization: inviteRole === 'EMPLOYEE' ? inviteSpecialization : null,
          work_status: 'AVAILABLE',
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

  async function handleUpdateRole(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser || !editName.trim() || editLoading) return

    setEditLoading(true)
    try {
      const res = await fetch('/api/agents/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editUser.id,
          name: editName.trim(),
          role: editRole,
          specialization: editRole === 'EMPLOYEE' ? editSpecialization : null,
          work_status: editWorkStatus,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update user role')

      setAgents(agents.map((a) => a.id === editUser.id ? {
        ...a,
        name: editName.trim(),
        role: editRole,
        specialization: editRole === 'EMPLOYEE' ? editSpecialization : null,
        work_status: editWorkStatus,
      } : a))

      setEditUser(null)
    } catch (err: any) {
      alert(err.message || 'Error updating user role')
    } finally {
      setEditLoading(false)
    }
  }

  async function resendInvite(email: string, name: string, role?: string, specialization?: string | null) {
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
      body: JSON.stringify({ email, name, role, specialization }),
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

  const currentUser = agents.find((a) => a.id === currentUserId)
  const isAdmin = currentUser?.role === 'ADMIN'

  async function handleDeleteUser() {
    if (!deleteUser || deleteLoading) return
    setDeleteLoading(true)
    setDeleteError('')

    try {
      const res = await fetch('/api/agents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: deleteUser.id }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user')
      }

      setAgents(agents.filter((a) => a.id !== deleteUser.id))
      setDeleteUser(null)
    } catch (err: any) {
      setDeleteError(err.message || 'Error deleting user')
    } finally {
      setDeleteLoading(false)
    }
  }

  const maxLeads = 1

  return (
    <div>
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <div style={{ minWidth: 0 }}>
          <h1 className="text-page-title">Team &amp; Technical Staff</h1>
          <p className="text-meta" style={{ marginTop: 2 }}>
            Manage team members, roles (Admins, Account Managers, Technical Employees), and specializations.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setInviteRole('CLIENT')
              if (clients.length > 0 && !inviteClientId) {
                const first = clients[0]
                setInviteClientId(first.id)
                setInviteName(first.company || first.name)
                if (first.email) setInviteEmail(first.email)
              }
              setShowInvite(true)
            }}
          >
            <Shield size={14} style={{ color: 'var(--accent)' }} />
            Invite Client
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setInviteRole('EMPLOYEE')
              setShowInvite(true)
            }}
          >
            <UserPlus size={14} />
            Invite Team Member
          </button>
        </div>
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
              <span className="text-section-header">
                {inviteRole === 'CLIENT' ? 'Invite Client Portal Account' : 'Invite New Team Member'}
              </span>
            </div>
            <div className="card-body">
              <form onSubmit={handleInvite} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: '1 1 180px' }}>
                  <label className="form-label form-label-required">Name</label>
                  <input
                    className="form-input"
                    placeholder="Full name"
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
                    placeholder="name@adonix.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: '1 1 140px' }}>
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={inviteRole}
                    onChange={(e) => {
                      const r = e.target.value as UserRole
                      setInviteRole(r)
                      if (r === 'CLIENT' && clients.length > 0 && !inviteClientId) {
                        const first = clients[0]
                        setInviteClientId(first.id)
                        if (!inviteName) setInviteName(first.company || first.name)
                        if (!inviteEmail && first.email) setInviteEmail(first.email)
                      }
                    }}
                  >
                    <option value="ACCOUNT_MANAGER">Account Manager</option>
                    <option value="AGENT">Sales Agent</option>
                    <option value="EMPLOYEE">Technical Employee</option>
                    <option value="CLIENT">Client Portal Access</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                {inviteRole === 'CLIENT' && (
                  <div className="form-group" style={{ flex: '1 1 280px' }}>
                    <label className="form-label form-label-required">Select Client Profile</label>
                    <ClientSearchSelect
                      clients={clients}
                      selectedClientId={inviteClientId}
                      onSelectClient={(selected) => {
                        setInviteClientId(selected.id)
                        if (selected.id) {
                          setInviteName(selected.company || selected.name)
                          if (selected.email) setInviteEmail(selected.email)
                        }
                      }}
                      placeholder="Type name, company or email to search client..."
                    />
                  </div>
                )}

                {inviteRole === 'EMPLOYEE' && (
                  <div className="form-group" style={{ flex: '1 1 180px' }}>
                    <label className="form-label">Department / Specialization</label>
                    <select
                      className="form-select"
                      value={inviteSpecialization}
                      onChange={(e) => setInviteSpecialization(e.target.value as EmployeeSpecialization)}
                    >
                      {SPECIALIZATIONS.map((s) => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex gap-2" style={{ paddingBottom: 1 }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowInvite(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={inviteLoading}>
                    {inviteLoading ? 'Sending...' : 'Send Invitation'}
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
            placeholder="Search team members by name, email, or specialization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>

        <div className="table-wrapper">
          <table className="table" style={{ minWidth: 880 }}>
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Team Member</th>
                <th style={{ width: '12%' }}>Role</th>
                <th style={{ width: '18%' }}>Specialization</th>
                <th style={{ width: '12%' }}>Work Status</th>
                <th style={{ width: '12%' }}>Account Status</th>
                <th style={{ width: '11%' }}>Last Active</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgents.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '32px 16px' }}>
                    {search ? `No team members match "${search}"` : 'No team members found'}
                  </td>
                </tr>
              ) : (
                filteredAgents.map((agent) => {
                  const isPending = !agent.last_sign_in_at

                  return (
                    <tr
                      key={agent.id}
                      className="clickable"
                      onClick={() => {
                        if (agent.role === 'CLIENT') {
                          const clientId = (agent as any).client_id || clients.find((c) =>
                            (c.email && agent.email && c.email.toLowerCase() === agent.email.toLowerCase()) ||
                            (c.name && agent.name && c.name.toLowerCase() === agent.name.toLowerCase())
                          )?.id

                          if (clientId) {
                            router.push(`/clients/${clientId}`)
                            return
                          }
                          router.push('/clients')
                          return
                        }
                        router.push(`/settings/agents/${agent.id}`)
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="avatar avatar-sm" style={{ background: 'var(--accent)', color: '#fff', fontWeight: 700 }}>
                            {agent.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {agent.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {agent.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Pill */}
                      <td>
                        <span className="badge" style={{
                          background: agent.role === 'ADMIN' ? '#EFF6FF' : agent.role === 'ACCOUNT_MANAGER' ? '#F3E8FF' : agent.role === 'AGENT' ? '#DCFCE7' : agent.role === 'CLIENT' ? '#EEF2FF' : '#F4F4F5',
                          color: agent.role === 'ADMIN' ? '#2563EB' : agent.role === 'ACCOUNT_MANAGER' ? '#7E22CE' : agent.role === 'AGENT' ? '#15803D' : agent.role === 'CLIENT' ? '#4F46E5' : '#52525B',
                          fontSize: 11, fontWeight: 600, border: '1px solid var(--border)',
                        }}>
                          {agent.role === 'ADMIN' ? 'Admin' : agent.role === 'ACCOUNT_MANAGER' ? 'Account Manager' : agent.role === 'AGENT' ? 'Sales Agent' : agent.role === 'CLIENT' ? 'Client Portal' : 'Employee'}
                        </span>
                      </td>

                      {/* Specialization */}
                      <td>
                        {agent.specialization ? (
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                            {SPECIALIZATIONS.find((s) => s.key === agent.specialization)?.label || agent.specialization}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>General</span>
                        )}
                      </td>

                      {/* Work Status */}
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                          background: agent.work_status === 'BUSY' ? '#FEF3C7' : agent.work_status === 'ON_LEAVE' ? '#FEE2E2' : '#DCFCE7',
                          color: agent.work_status === 'BUSY' ? '#D97706' : agent.work_status === 'ON_LEAVE' ? '#B91C1C' : '#15803D',
                          whiteSpace: 'nowrap',
                          display: 'inline-block'
                        }}>
                          ● {agent.work_status || 'AVAILABLE'}
                        </span>
                      </td>

                      {/* Account Status */}
                      <td>
                        {!agent.is_active ? (
                          <span className="badge badge-danger">
                            Inactive
                          </span>
                        ) : isPending ? (
                          <span className="badge badge-warning" title="Team member hasn't logged in yet">
                            Invite pending
                          </span>
                        ) : (
                          <span className="badge badge-success">
                            Active
                          </span>
                        )}
                      </td>

                      {/* Last Active */}
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {!mounted ? (
                          <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        ) : agent.last_seen_at ? (
                          formatDistanceToNow(new Date(agent.last_seen_at), { addSuffix: true })
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>Never</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            className="btn btn-outline btn-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              resendInvite(agent.email, agent.name, agent.role, agent.specialization)
                            }}
                            disabled={resendingEmails.has(agent.email)}
                            title="Send password setup or reset link to email"
                          >
                            {resendingEmails.has(agent.email) ? 'Sending...' : 'Reset Link'}
                          </button>
                          {agent.role !== 'CLIENT' && (
                            <button
                              className="btn btn-outline btn-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditUser(agent)
                                setEditName(agent.name)
                                setEditRole(agent.role)
                                setEditSpecialization(agent.specialization || 'WEBSITE')
                                setEditWorkStatus(agent.work_status || 'AVAILABLE')
                              }}
                              title="Edit Profile & Role"
                            >
                              <Edit2 size={12} />
                              Edit Profile
                            </button>
                          )}
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleActive(agent.id, agent.is_active)
                            }}
                            style={{ color: agent.is_active ? 'var(--danger)' : 'var(--success)' }}
                          >
                            {agent.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          {isAdmin && agent.id !== currentUserId && (
                            <button
                              className="btn btn-ghost btn-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteUser(agent)
                                setDeleteError('')
                              }}
                              style={{ color: 'var(--danger)', fontWeight: 500 }}
                            >
                              Delete
                            </button>
                          )}
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

      {/* EDIT ROLE & SPECIALIZATION MODAL */}
      {editUser && (
        <div className="modal-backdrop" onClick={() => setEditUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <span className="text-section-header">Edit Profile for {editUser.name}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditUser(null)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleUpdateRole}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label form-label-required">Full Name</label>
                  <input
                    className="form-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter user full name..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label form-label-required">Select Role</label>
                  <select
                    className="form-select"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                  >
                    <option value="ACCOUNT_MANAGER">Account Manager</option>
                    <option value="AGENT">Sales Agent</option>
                    <option value="EMPLOYEE">Technical Employee</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                {editRole === 'EMPLOYEE' && (
                  <div className="form-group">
                    <label className="form-label">Department / Technical Specialization</label>
                    <select
                      className="form-select"
                      value={editSpecialization}
                      onChange={(e) => setEditSpecialization(e.target.value)}
                    >
                      {SPECIALIZATIONS.map((s) => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Work Availability Status</label>
                  <select
                    className="form-select"
                    value={editWorkStatus}
                    onChange={(e) => setEditWorkStatus(e.target.value as WorkStatus)}
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="BUSY">Busy</option>
                    <option value="ON_LEAVE">On Leave</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={editLoading}>
                  {editLoading ? 'Saving...' : 'Save Role Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteUser && (
        <div className="modal-backdrop" onClick={() => !deleteLoading && setDeleteUser(null)}>
          <div className="modal-box" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 8, borderRadius: 8, background: '#fef2f2', color: 'var(--danger)' }}>
                  <AlertTriangle size={20} />
                </div>
                <h3 className="modal-title">Delete Team Member</h3>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setDeleteUser(null)}
                disabled={deleteLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px 20px' }}>
              {deleteError && (
                <div className="alert alert-danger" style={{ marginBottom: 12, padding: '8px 12px', fontSize: 13 }}>
                  {deleteError}
                </div>
              )}
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Are you sure you want to permanently delete <strong style={{ color: 'var(--text-primary)' }}>{deleteUser.name}</strong>?
                This will delete their profile and revoke their authentication credentials entirely. This action cannot be undone.
              </p>
            </div>

            <div className="modal-footer" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setDeleteUser(null)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDeleteUser}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
