'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, CheckCircle, XCircle, Clock, Search, ChevronRight, ChevronLeft, Edit2, Shield, User, Briefcase, X, AlertTriangle } from 'lucide-react'
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

const SPECIALIZATIONS: { key: string; label: string }[] = [
  { key: 'WEBSITE', label: 'Website Development' },
  { key: 'SOFTWARE_ENGINEER', label: 'Software Engineer' },
  { key: 'ANDROID_DEV', label: 'Android Developer' },
  { key: 'SOCIAL_MEDIA', label: 'Social Media Management' },
  { key: 'ADS', label: 'Meta / Google Ads' },
  { key: 'GMB', label: 'GMB & Local SEO' },
  { key: 'VIDEO_AI', label: 'AI Video & Content' },
  { key: 'DESIGN', label: 'Graphic & UI Design' },
  { key: 'SEO', label: 'Organic SEO' },
  { key: 'OTHER', label: 'General / Operations' },
  { key: 'CUSTOM', label: 'Custom / Other...' },
]

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', // Indigo - Purple
  'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)', // Sky - Blue
  'linear-gradient(135deg, #059669 0%, #10b981 100%)', // Emerald - Green
  'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', // Amber - Orange
  'linear-gradient(135deg, #db2777 0%, #ec4899 100%)', // Pink - Rose
  'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', // Purple - Violet
  'linear-gradient(135deg, #ea580c 0%, #f97316 100%)', // Orange
  'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)', // Cyan - Teal
  'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)', // Rose
]

function getAvatarBackground(name: string, role?: string): string {
  if (role === 'ADMIN') return 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)'
  if (role === 'CLIENT') return 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)'
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length
  return AVATAR_GRADIENTS[index]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

const PAGE_SIZE = 20

export default function AgentsClient({ agents: initialAgents, agentLeadCounts, currentUserId, clients = [] }: Props) {
  const router = useRouter()
  const [agents, setAgents] = useState<EnrichedAgent[]>(initialAgents)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('EMPLOYEE')
  const [inviteSpecialization, setInviteSpecialization] = useState<string>('WEBSITE')
  const [inviteCustomSpecialization, setInviteCustomSpecialization] = useState<string>('')
  const [inviteClientId, setInviteClientId] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [resendingEmails, setResendingEmails] = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // Edit Role & Specialization Modal State
  const [editUser, setEditUser] = useState<EnrichedAgent | null>(null)
  const [editName, setEditName] = useState<string>('')
  const [editRole, setEditRole] = useState<UserRole>('EMPLOYEE')
  const [editSpecialization, setEditSpecialization] = useState<string>('')
  const [editCustomSpecialization, setEditCustomSpecialization] = useState<string>('')
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

  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  const filteredAgents = useMemo(() => {
    if (!search.trim()) return agents
    const q = search.toLowerCase()
    return agents.filter(
      (a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || (a.specialization && a.specialization.toLowerCase().includes(q))
    )
  }, [agents, search])

  const totalPages = Math.ceil(filteredAgents.length / PAGE_SIZE) || 1
  const safeCurrentPage = Math.min(currentPage, totalPages) || 1
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE
  const endIndex = Math.min(startIndex + PAGE_SIZE, filteredAgents.length)
  const paginatedAgents = filteredAgents.slice(startIndex, endIndex)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim() || !inviteName.trim() || inviteLoading) return
    setInviteLoading(true)
    setInviteError('')
    setInviteSuccess('')

    const resolvedSpecialization = inviteRole === 'EMPLOYEE'
      ? (inviteSpecialization === 'CUSTOM'
          ? (inviteCustomSpecialization.trim() || 'General / Operations')
          : (SPECIALIZATIONS.find((s) => s.key === inviteSpecialization)?.label || inviteSpecialization))
      : null

    const res = await fetch('/api/agents/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: inviteEmail.trim(),
        name: inviteName.trim(),
        role: inviteRole,
        specialization: resolvedSpecialization,
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
          specialization: resolvedSpecialization,
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
      setInviteCustomSpecialization('')
      setShowInvite(false)
    }
    setInviteLoading(false)
  }

  async function handleUpdateRole(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser || !editName.trim() || editLoading) return

    setEditLoading(true)
    try {
      const resolvedEditSpec = editRole === 'EMPLOYEE'
        ? (editSpecialization === 'CUSTOM'
            ? (editCustomSpecialization.trim() || 'General / Operations')
            : (SPECIALIZATIONS.find((s) => s.key === editSpecialization)?.label || editSpecialization))
        : null

      const res = await fetch('/api/agents/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editUser.id,
          name: editName.trim(),
          role: editRole,
          specialization: resolvedEditSpec,
          work_status: editWorkStatus,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update user role')

      setAgents(agents.map((a) => a.id === editUser.id ? {
        ...a,
        name: editName.trim(),
        role: editRole,
        specialization: resolvedEditSpec,
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
                  <>
                    <div className="form-group" style={{ flex: '1 1 180px' }}>
                      <label className="form-label">Department / Specialization</label>
                      <select
                        className="form-select"
                        value={inviteSpecialization}
                        onChange={(e) => setInviteSpecialization(e.target.value)}
                      >
                        {SPECIALIZATIONS.map((s) => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    {inviteSpecialization === 'CUSTOM' && (
                      <div className="form-group" style={{ flex: '1 1 200px' }}>
                        <label className="form-label form-label-required">Custom Specialization Title</label>
                        <input
                          className="form-input"
                          placeholder="e.g. Flutter Developer, Cloud Architect"
                          value={inviteCustomSpecialization}
                          onChange={(e) => setInviteCustomSpecialization(e.target.value)}
                          required
                        />
                      </div>
                    )}
                  </>
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
                paginatedAgents.map((agent) => {
                  const isPending = !agent.last_sign_in_at

                  return (
                    <tr
                      key={agent.id}
                      className="clickable"
                      onClick={() => {
                        if (agent.role === 'CLIENT') {
                          if (agent.client_id) {
                            router.push(`/clients/${agent.client_id}`)
                          } else {
                            router.push(`/clients?search=${encodeURIComponent(agent.email || agent.name)}`)
                          }
                        } else {
                          router.push(`/settings/agents/${agent.id}`)
                        }
                      }}
                    >
                      {/* Name & Email */}
                      <td>
                        <div className="flex items-center gap-3">
                          <div
                            className="avatar-circle"
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center',
                              fontSize: 12,
                              fontWeight: 700,
                              background: getAvatarBackground(agent.name, agent.role),
                              color: '#ffffff',
                              flexShrink: 0,
                              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
                              letterSpacing: '0.02em',
                            }}
                          >
                            {getInitials(agent.name)}
                          </div>
                          <div>
                            <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                              {agent.name}
                            </div>
                            <div className="text-meta" style={{ fontSize: 11 }}>
                              {agent.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td>
                        <span className={`badge ${
                          agent.role === 'ADMIN' ? 'badge-primary' :
                          agent.role === 'ACCOUNT_MANAGER' ? 'badge-indigo' :
                          agent.role === 'EMPLOYEE' ? 'badge-secondary' :
                          agent.role === 'CLIENT' ? 'badge-info' : 'badge-success'
                        }`}>
                          {agent.role === 'ADMIN' && <Shield size={10} style={{ marginRight: 3, display: 'inline' }} />}
                          {agent.role === 'ACCOUNT_MANAGER' && <Briefcase size={10} style={{ marginRight: 3, display: 'inline' }} />}
                          {agent.role === 'EMPLOYEE' && <User size={10} style={{ marginRight: 3, display: 'inline' }} />}
                          {agent.role === 'CLIENT' ? 'Client Portal' : (agent.role === 'AGENT' ? 'Sales Agent' : agent.role === 'EMPLOYEE' ? 'Employee' : agent.role === 'ACCOUNT_MANAGER' ? 'Account Manager' : 'Admin')}
                        </span>
                      </td>

                      {/* Specialization */}
                      <td>
                        {agent.specialization ? (
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>
                            {SPECIALIZATIONS.find((s) => s.key === agent.specialization || s.label === agent.specialization)?.label || agent.specialization}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>General</span>
                        )}
                      </td>

                      {/* Work Status */}
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 12,
                            fontWeight: 600,
                            color:
                              agent.work_status === 'AVAILABLE'
                                ? 'var(--success)'
                                : agent.work_status === 'BUSY'
                                ? 'var(--warning)'
                                : 'var(--text-tertiary)',
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor:
                                agent.work_status === 'AVAILABLE'
                                  ? 'var(--success)'
                                  : agent.work_status === 'BUSY'
                                  ? 'var(--warning)'
                                  : 'var(--text-tertiary)',
                            }}
                          />
                          {agent.work_status === 'AVAILABLE' ? 'AVAILABLE' : agent.work_status === 'BUSY' ? 'BUSY' : 'ON LEAVE'}
                        </span>
                      </td>

                      {/* Account Status */}
                      <td>
                        {!agent.is_active ? (
                          <span className="badge badge-danger" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
                            Deactivated
                          </span>
                        ) : isPending ? (
                          <span className="badge badge-warning">
                            Pending
                          </span>
                        ) : (
                          <span className="badge badge-success">
                            Active
                          </span>
                        )}
                      </td>

                      {/* Last Active */}
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {agent.last_sign_in_at && mounted
                            ? formatDistanceToNow(new Date(agent.last_sign_in_at), { addSuffix: true })
                            : isPending
                            ? 'Never'
                            : '—'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
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
                                const found = SPECIALIZATIONS.find((s) => s.key === agent.specialization || s.label === agent.specialization)
                                if (found && found.key !== 'CUSTOM') {
                                  setEditSpecialization(found.key)
                                  setEditCustomSpecialization('')
                                } else if (agent.specialization) {
                                  setEditSpecialization('CUSTOM')
                                  setEditCustomSpecialization(agent.specialization)
                                } else {
                                  setEditSpecialization('WEBSITE')
                                  setEditCustomSpecialization('')
                                }
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

        {/* Pagination Footer */}
        {filteredAgents.length > PAGE_SIZE && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 16,
              padding: '8px 4px',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Showing {startIndex + 1} to {endIndex} of {filteredAgents.length} team members
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '0 4px' }}>
                Page {safeCurrentPage} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
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
                  <>
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
                    {editSpecialization === 'CUSTOM' && (
                      <div className="form-group">
                        <label className="form-label form-label-required">Custom Specialization Title</label>
                        <input
                          className="form-input"
                          placeholder="e.g. Flutter Developer, Cloud Architect"
                          value={editCustomSpecialization}
                          onChange={(e) => setEditCustomSpecialization(e.target.value)}
                          required
                        />
                      </div>
                    )}
                  </>
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
