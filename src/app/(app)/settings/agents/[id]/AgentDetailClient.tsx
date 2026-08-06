'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow, format, subDays, isAfter, parseISO } from 'date-fns'
import {
  ArrowLeft, Users, TrendingUp, CheckCircle, Clock, Target,
  Phone, Mail, Activity, Search, ChevronRight, Award,
  XCircle, AlertCircle, BarChart2, Calendar, MessageSquare,
  FileText, Receipt, DollarSign, CreditCard, Sparkles, X,
  Edit2, Trash2, Paperclip, ExternalLink, AlertTriangle,
} from 'lucide-react'
import type { Profile, LeadStage, TaskCategory, TaskPriority, TaskStatus } from '@/types/database'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const CATEGORY_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  WEBSITE: { label: 'Website Dev', color: '#0284C7', icon: '🌐' },
  SOCIAL_MEDIA: { label: 'Social Media', color: '#DB2777', icon: '📱' },
  ADS: { label: 'Paid Ads', color: '#7C3AED', icon: '🎯' },
  GMB: { label: 'GMB / SEO', color: '#D97706', icon: '📍' },
  VIDEO_AI: { label: 'Video / AI', color: '#EA580C', icon: '🎬' },
  DESIGN: { label: 'Graphic Design', color: '#0F766E', icon: '🎨' },
  SEO: { label: 'SEO Campaign', color: '#16A34A', icon: '🚀' },
  SALES_TASK: { label: 'Sales Follow-up', color: '#15803D', icon: '💼' },
  FINANCE_TASK: { label: 'Quote / Billing', color: '#7E22CE', icon: '📄' },
  OTHER: { label: 'General Task', color: '#71717A', icon: '📋' },
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  PENDING: { label: 'To Do', bg: '#F4F4F5', text: '#52525B' },
  IN_PROGRESS: { label: 'In Progress', bg: '#EFF6FF', text: '#1D4ED8' },
  UNDER_REVIEW: { label: 'Under Review', bg: '#FEF3C7', text: '#D97706' },
  COMPLETED: { label: 'Completed', bg: '#DCFCE7', text: '#15803D' },
  BLOCKED: { label: 'Blocked', bg: '#FEE2E2', text: '#B91C1C' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Low', color: '#71717A' },
  MEDIUM: { label: 'Medium', color: '#0284C7' },
  HIGH: { label: 'High', color: '#D97706' },
  URGENT: { label: 'Urgent', color: '#DC2626' },
}

interface Props {
  agent: Profile & { last_sign_in_at?: string | null }
  leads: any[]
  stages: LeadStage[]
  stageCounts: Record<string, number>
  followups: any[]
  activities: any[]
  quotations: any[]
  invoices: any[]
  tasks?: any[]
  totalLeads: number
  wonCount: number
  lostCount: number
  conversionRate: number
  completedFollowups: number
  pendingFollowups: number
}

const SOURCE_LABELS: Record<string, string> = {
  META_ADS: 'Meta Ads',
  MANUAL: 'Manual',
  XLSX_IMPORT: 'XLSX Import',
  TIKTOK: 'TikTok',
  SNAPCHAT: 'Snapchat',
  WHATSAPP: 'WhatsApp',
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

function activityLabel(type: string, meta: any): string {
  switch (type) {
    case 'LEAD_CREATED': return 'Created lead'
    case 'STAGE_CHANGE': return `Stage: ${meta?.from_stage ?? '?'} → ${meta?.to_stage ?? '?'}`
    case 'NOTE_ADDED': return 'Added a note'
    case 'FOLLOWUP_SCHEDULED': return 'Scheduled follow-up'
    case 'FOLLOWUP_COMPLETED': return 'Completed follow-up'
    case 'FOLLOWUP_UPDATED': return 'Updated follow-up'
    case 'ASSIGNED': return `Assigned lead`
    case 'QUOTE_SENT': return `Sent quotation ${meta?.quote_number ?? ''}`
    case 'INVOICE_SENT': return `Sent invoice ${meta?.invoice_number ?? ''}`
    default: return type.replace(/_/g, ' ')
  }
}

export default function AgentDetailClient({
  agent,
  leads,
  stages,
  stageCounts,
  followups,
  activities,
  quotations,
  invoices,
  tasks = [],
  totalLeads,
  wonCount,
  lostCount,
  conversionRate,
  completedFollowups,
  pendingFollowups,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setCurrentProfile(data)
      }
    }
    loadProfile()
  }, [])

  const [activeTab, setActiveTab] = useState<'leads' | 'tasks' | 'followups' | 'quotations' | 'invoices' | 'activity'>(
    agent.role === 'EMPLOYEE' ? 'tasks' : 'leads'
  )
  const [leadSearch, setLeadSearch] = useState('')
  const [selectedTask, setSelectedTask] = useState<any | null>(null)
  const [taskList, setTaskList] = useState<any[]>(tasks)

  useEffect(() => {
    setTaskList(tasks)
  }, [tasks])

  // Task post update state
  const [updateBody, setUpdateBody] = useState('')
  const [updateLink, setUpdateLink] = useState('')
  const [updateStatus, setUpdateStatus] = useState<any>('')
  const [submittingUpdate, setSubmittingUpdate] = useState(false)

  // Task instructions edit state
  const [isEditingTaskDetails, setIsEditingTaskDetails] = useState(false)
  const [editTaskDescription, setEditTaskDescription] = useState('')
  const [editTaskDeliverableLink, setEditTaskDeliverableLink] = useState('')
  const [savingTaskDetails, setSavingTaskDetails] = useState(false)

  // Work Log edit & delete state
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [editingLogBody, setEditingLogBody] = useState('')
  const [editingLogLink, setEditingLogLink] = useState('')
  const [savingLog, setSavingLog] = useState(false)
  const [confirmingDeleteLogId, setConfirmingDeleteLogId] = useState<string | null>(null)

  // Quick Work Status Toggle state
  const [workStatus, setWorkStatus] = useState(agent.work_status || 'AVAILABLE')
  const [updatingWorkStatus, setUpdatingWorkStatus] = useState(false)

  async function handleWorkStatusChange(newStatus: any) {
    setWorkStatus(newStatus)
    setUpdatingWorkStatus(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ work_status: newStatus })
        .eq('id', agent.id)

      if (error) throw error
    } catch (err: any) {
      alert(err.message || 'Failed to update work status')
    } finally {
      setUpdatingWorkStatus(false)
    }
  }

  async function handleSaveTaskDetails() {
    if (!selectedTask || savingTaskDetails) return
    setSavingTaskDetails(true)
    try {
      const { error } = await supabase
        .from('client_tasks')
        .update({
          description: editTaskDescription.trim() || null,
          deliverable_link: editTaskDeliverableLink.trim() || null,
        })
        .eq('id', selectedTask.id)

      if (error) throw error

      const updatedTask = {
        ...selectedTask,
        description: editTaskDescription.trim() || null,
        deliverable_link: editTaskDeliverableLink.trim() || null,
      }

      setSelectedTask(updatedTask)
      setTaskList((prev) => prev.map((t) => (t.id === selectedTask.id ? updatedTask : t)))
      setIsEditingTaskDetails(false)
    } catch (err: any) {
      alert(err.message || 'Failed to update task instructions')
    } finally {
      setSavingTaskDetails(false)
    }
  }

  async function handlePostDailyUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTask || !updateBody.trim() || submittingUpdate) return

    setSubmittingUpdate(true)
    try {
      const { data: updateData, error: updateError } = await supabase
        .from('client_task_updates')
        .insert({
          task_id: selectedTask.id,
          author_id: currentProfile?.id || null,
          body: updateBody.trim(),
          attachment_url: updateLink.trim() || null,
        })
        .select(`*, author:profiles!author_id(id, name)`)
        .single()

      if (updateError) throw updateError

      let newStatus = selectedTask.status
      if (updateStatus && updateStatus !== selectedTask.status) {
        newStatus = updateStatus
        await supabase
          .from('client_tasks')
          .update({ status: updateStatus, updated_at: new Date().toISOString() })
          .eq('id', selectedTask.id)
      }

      const updatedTask = {
        ...selectedTask,
        status: newStatus,
        updates: [updateData, ...(selectedTask.updates || [])],
      }

      setSelectedTask(updatedTask)
      setTaskList((prev) => prev.map((t) => (t.id === selectedTask.id ? updatedTask : t)))

      setUpdateBody('')
      setUpdateLink('')
      setUpdateStatus('')
    } catch (err: any) {
      alert(err.message || 'Failed to post work update')
    } finally {
      setSubmittingUpdate(false)
    }
  }

  async function handleSaveLogEdit(logId: string) {
    if (!editingLogBody.trim() || savingLog) return
    setSavingLog(true)
    try {
      const { error } = await supabase
        .from('client_task_updates')
        .update({
          body: editingLogBody.trim(),
          attachment_url: editingLogLink.trim() || null,
        })
        .eq('id', logId)

      if (error) throw error

      if (selectedTask) {
        const updatedLogs = selectedTask.updates.map((u: any) =>
          u.id === logId ? { ...u, body: editingLogBody.trim(), attachment_url: editingLogLink.trim() || null } : u
        )
        const updatedTask = { ...selectedTask, updates: updatedLogs }
        setSelectedTask(updatedTask)
        setTaskList((prev) => prev.map((t) => (t.id === selectedTask.id ? updatedTask : t)))
      }
      setEditingLogId(null)
    } catch (err: any) {
      alert(err.message || 'Failed to edit work log')
    } finally {
      setSavingLog(false)
    }
  }

  async function confirmDeleteLog(logId: string) {
    try {
      const { error } = await supabase
        .from('client_task_updates')
        .delete()
        .eq('id', logId)

      if (error) throw error

      if (selectedTask) {
        const updatedLogs = selectedTask.updates.filter((u: any) => u.id !== logId)
        const updatedTask = { ...selectedTask, updates: updatedLogs }
        setSelectedTask(updatedTask)
        setTaskList((prev) => prev.map((t) => (t.id === selectedTask.id ? updatedTask : t)))
      }
      setConfirmingDeleteLogId(null)
    } catch (err: any) {
      alert(err.message || 'Failed to delete work log')
    }
  }

  // Pagination states
  const [leadsPage, setLeadsPage] = useState(1)
  const [tasksPage, setTasksPage] = useState(1)
  const [followupsPage, setFollowupsPage] = useState(1)
  const [quotesPage, setQuotesPage] = useState(1)
  const [invoicesPage, setInvoicesPage] = useState(1)
  const [activityPage, setActivityPage] = useState(1)
  const PAGE_SIZE = 10

  // Reset page numbers when tab changes
  useEffect(() => {
    setLeadsPage(1)
    setTasksPage(1)
    setFollowupsPage(1)
    setQuotesPage(1)
    setInvoicesPage(1)
    setActivityPage(1)
  }, [activeTab])

  // Reset leads page when search updates
  useEffect(() => {
    setLeadsPage(1)
  }, [leadSearch])



  // Calculate agent financial metrics WITH CURRENCY CONVERSION TO SAR
  const totalQuotedSAR = quotations.reduce(
    (acc, q) => acc + convertToSAR(Number(q.total ?? 0), q.currency),
    0
  )
  const totalInvoicedSAR = invoices.reduce(
    (acc, inv) => acc + convertToSAR(Number(inv.total ?? 0), inv.currency),
    0
  )
  const totalCollectedSAR = invoices.reduce(
    (acc, inv) => acc + convertToSAR(Number(inv.amount_paid ?? 0), inv.currency),
    0
  )

  // Recent leads (last 30 days)
  const thirtyDaysAgo = subDays(new Date(), 30)
  const recentLeads = leads.filter((l) => isAfter(new Date(l.created_at), thirtyDaysAgo)).length

  // Follow-up completion rate
  const totalFu = completedFollowups + pendingFollowups
  const fuRate = totalFu > 0 ? (completedFollowups / totalFu) * 100 : 0

  // Filtered leads by search
  const filteredLeads = useMemo(() => {
    if (!leadSearch.trim()) return leads
    const q = leadSearch.toLowerCase()
    return leads.filter(
      (l) => (l.name ?? '').toLowerCase().includes(q) || (l.phone ?? '').toLowerCase().includes(q)
    )
  }, [leads, leadSearch])

  // Paginated Tasks
  const paginatedTasks = useMemo(() => {
    const start = (tasksPage - 1) * PAGE_SIZE
    return taskList.slice(start, start + PAGE_SIZE)
  }, [taskList, tasksPage, PAGE_SIZE])

  const [resendingReset, setResendingReset] = useState(false)
  const [resetMsg, setResetMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  async function handleSendReset() {
    setResendingReset(true)
    setResetMsg(null)
    try {
      const res = await fetch('/api/agents/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: agent.email,
          name: agent.name,
          role: agent.role,
          specialization: agent.specialization,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResetMsg({ text: `Password reset email link sent to ${agent.email}`, type: 'success' })
      } else {
        setResetMsg({ text: data.error ?? 'Failed to send reset email link', type: 'error' })
      }
    } catch {
      setResetMsg({ text: 'Error sending reset password link', type: 'error' })
    }
    setResendingReset(false)
  }

  const initials = agent.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const isActive = agent.is_active

  // Clean performance tag
  const getPerformanceBadge = () => {
    if (totalLeads === 0) return { label: 'New / No Leads', bg: '#f4f4f5', color: '#71717a', border: '#e4e4e7' }
    if (conversionRate >= 25 || wonCount >= 5) return { label: 'Top Performer', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' }
    if (conversionRate >= 10 || wonCount >= 1) return { label: 'Active Agent', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' }
    return { label: 'Needs Conversion', bg: '#fffbe6', color: '#d48806', border: '#ffe58f' }
  }

  const perfTag = getPerformanceBadge()

  return (
    <div>
      {/* Page header */}
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => router.push('/settings/agents')}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-page-title">{agent.name}</h1>
            <p className="text-meta" style={{ marginTop: 2 }}>
              Agent Performance Overview &amp; Analytics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleSendReset}
            disabled={resendingReset}
          >
            <Mail size={14} />
            {resendingReset ? 'Sending link...' : 'Send reset password link'}
          </button>
          {agent.role !== 'EMPLOYEE' && (
            <Link href="/leads?action=add" className="btn btn-primary btn-sm">
              <Users size={14} />
              Assign new lead
            </Link>
          )}
        </div>
      </div>

      {resetMsg && (
        <div
          style={{
            margin: '12px 0 16px',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            fontWeight: 500,
            background: resetMsg.type === 'success' ? 'var(--success-light)' : '#fef2f2',
            border: `1px solid ${resetMsg.type === 'success' ? 'var(--success)' : '#fecaca'}`,
            color: resetMsg.type === 'success' ? 'var(--success)' : '#dc2626',
          }}
        >
          {resetMsg.text}
        </div>
      )}

      <div className="page-body">

        {/* Profile Header Banner */}
        <div className="card mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="card-body" style={{ padding: '20px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
              alignItems: 'center',
            }}>
              {/* Left Info Column */}
              <div className="flex items-start gap-4">
                <div style={{
                  width: 54, height: 54, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                }}>
                  {initials}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {agent.name}
                    </span>
                    <span className="badge" style={{
                      background: agent.role === 'ADMIN' ? '#EFF6FF' : agent.role === 'ACCOUNT_MANAGER' ? '#F3E8FF' : agent.role === 'AGENT' ? '#DCFCE7' : '#F4F4F5',
                      color: agent.role === 'ADMIN' ? '#2563EB' : agent.role === 'ACCOUNT_MANAGER' ? '#7E22CE' : agent.role === 'AGENT' ? '#15803D' : '#52525B',
                      fontSize: 11, fontWeight: 600, border: '1px solid var(--border)',
                    }}>
                      {agent.role === 'ADMIN' ? 'Admin' : agent.role === 'ACCOUNT_MANAGER' ? 'Account Manager' : agent.role === 'AGENT' ? 'Sales Agent' : agent.specialization ? `${agent.specialization} Specialist` : 'Technical Employee'}
                    </span>
                    {isActive ? (
                      <span className="badge badge-success" style={{ fontSize: 11 }}>
                        <span className="badge-dot" style={{ background: 'var(--success)' }} />
                        Active
                      </span>
                    ) : (
                      <span className="badge badge-danger" style={{ fontSize: 11 }}>
                        <span className="badge-dot" style={{ background: 'var(--danger)' }} />
                        Inactive
                      </span>
                    )}
                  </div>

                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, wordBreak: 'break-all', color: 'var(--text-secondary)' }}>
                      <Mail size={13} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
                      <span>{agent.email}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, rowGap: 4, flexWrap: 'wrap', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Calendar size={13} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
                        <span>Joined {formatDistanceToNow(new Date(agent.created_at), { addSuffix: true })}</span>
                      </div>
                      {agent.last_seen_at && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={13} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
                          <span>Active {formatDistanceToNow(new Date(agent.last_seen_at), { addSuffix: true })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Performance Banner Widget */}
              {agent.role === 'EMPLOYEE' ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '12px 18px',
                  background: 'var(--bg)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                      Work Availability
                    </div>
                    {(currentProfile?.id === agent.id || currentProfile?.role === 'ADMIN' || currentProfile?.role === 'ACCOUNT_MANAGER') ? (
                      <select
                        className="form-select"
                        value={workStatus}
                        onChange={(e) => handleWorkStatusChange(e.target.value)}
                        disabled={updatingWorkStatus}
                        style={{
                          padding: '3px 8px', fontSize: 12, fontWeight: 700,
                          background: workStatus === 'BUSY' ? '#FEF3C7' : workStatus === 'ON_LEAVE' ? '#FEE2E2' : '#DCFCE7',
                          color: workStatus === 'BUSY' ? '#D97706' : workStatus === 'ON_LEAVE' ? '#B91C1C' : '#15803D',
                          border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer',
                        }}
                      >
                        <option value="AVAILABLE">● AVAILABLE</option>
                        <option value="BUSY">● BUSY</option>
                        <option value="ON_LEAVE">● ON LEAVE</option>
                      </select>
                    ) : (
                      <div style={{
                        fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 4, display: 'inline-block',
                        background: workStatus === 'BUSY' ? '#FEF3C7' : workStatus === 'ON_LEAVE' ? '#FEE2E2' : '#DCFCE7',
                        color: workStatus === 'BUSY' ? '#D97706' : workStatus === 'ON_LEAVE' ? '#B91C1C' : '#15803D',
                      }}>
                        ● {workStatus}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Department
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
                      {agent.specialization || 'Technical'}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '12px 18px',
                  background: 'var(--bg)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                      Work Availability
                    </div>
                    {(currentProfile?.id === agent.id || currentProfile?.role === 'ADMIN' || currentProfile?.role === 'ACCOUNT_MANAGER') ? (
                      <select
                        className="form-select"
                        value={workStatus}
                        onChange={(e) => handleWorkStatusChange(e.target.value)}
                        disabled={updatingWorkStatus}
                        style={{
                          padding: '3px 8px', fontSize: 12, fontWeight: 700,
                          background: workStatus === 'BUSY' ? '#FEF3C7' : workStatus === 'ON_LEAVE' ? '#FEE2E2' : '#DCFCE7',
                          color: workStatus === 'BUSY' ? '#D97706' : workStatus === 'ON_LEAVE' ? '#B91C1C' : '#15803D',
                          border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer',
                        }}
                      >
                        <option value="AVAILABLE">● AVAILABLE</option>
                        <option value="BUSY">● BUSY</option>
                        <option value="ON_LEAVE">● ON LEAVE</option>
                      </select>
                    ) : (
                      <div style={{
                        fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 4, display: 'inline-block',
                        background: workStatus === 'BUSY' ? '#FEF3C7' : workStatus === 'ON_LEAVE' ? '#FEE2E2' : '#DCFCE7',
                        color: workStatus === 'BUSY' ? '#D97706' : workStatus === 'ON_LEAVE' ? '#B91C1C' : '#15803D',
                      }}>
                        ● {workStatus}
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Status &amp; Rating
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={14} style={{ color: perfTag.color }} />
                      {perfTag.label}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Conversion
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: conversionRate >= 20 ? 'var(--success)' : 'var(--text-primary)', marginTop: 2 }}>
                      {conversionRate.toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Responsive KPI Metric Row */}
        {agent.role === 'EMPLOYEE' ? (
          <div className="rg-4 mb-6">
            <div className="stat-card">
              <div className="stat-card-label">Total Assigned Tasks</div>
              <div className="stat-card-value">{tasks.length}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                Technical deliverables &amp; assignments
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-label">In Progress</div>
              <div className="stat-card-value" style={{ color: '#2563EB' }}>
                {tasks.filter((t: any) => t.status !== 'COMPLETED').length}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                Active tasks under execution
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-label">Completed Deliverables</div>
              <div className="stat-card-value" style={{ color: 'var(--success)' }}>
                {tasks.filter((t: any) => t.status === 'COMPLETED').length}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                Finished task deliverables
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-label">Overdue Tasks</div>
              <div className="stat-card-value" style={{ color: 'var(--danger)' }}>
                {tasks.filter((t: any) => t.status !== 'COMPLETED' && t.due_date && t.due_date < format(new Date(), 'yyyy-MM-dd')).length}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                Past target due date
              </div>
            </div>
          </div>
        ) : (
          <div className="rg-4 mb-6">
            <div className="stat-card">
              <div className="stat-card-label">Total leads</div>
              <div className="stat-card-value">{totalLeads}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {recentLeads} added in last 30 days
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-label">Won deals</div>
              <div className="stat-card-value" style={{ color: 'var(--success)' }}>{wonCount}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {lostCount} lost deals
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-label">Quotations (SAR Base)</div>
              <div className="stat-card-value" style={{ color: '#2563eb', fontSize: 18 }}>
                SAR {totalQuotedSAR.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {quotations.length} quotes created
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-label">Invoiced (SAR Base)</div>
              <div className="stat-card-value" style={{ color: 'var(--success)', fontSize: 18 }}>
                SAR {totalInvoicedSAR.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                SAR {totalCollectedSAR.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} collected
              </div>
            </div>
          </div>
        )}

        {/* Stage distribution funnel (Only for Sales Agents and Account Managers) */}
        {agent.role !== 'EMPLOYEE' && (
          <div className="card mb-6">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <BarChart2 size={15} style={{ color: 'var(--text-secondary)' }} />
                <span className="text-section-header">Lead funnel distribution</span>
              </div>
              <span className="text-meta">{totalLeads} assigned leads</span>
            </div>
            <div className="card-body">
              {stages.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: 24 }}>No stage data</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {stages.map((stage) => {
                    const count = stageCounts[stage.id] ?? 0
                    const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0
                    return (
                      <div key={stage.id} className="flex items-center gap-3">
                        <span style={{ width: 110, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flexShrink: 0 }}>
                          {stage.label}
                        </span>
                        <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 100, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: stage.color_hex, borderRadius: 100, transition: 'width 600ms ease' }} />
                        </div>
                        <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, width: 28, textAlign: 'right', color: count > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', flexShrink: 0 }}>
                          {count}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 38, textAlign: 'right', flexShrink: 0 }}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabbed Detailed Data Section */}
        <div className="card">
          {/* Section header or Tabs header */}
          {agent.role === 'EMPLOYEE' ? (
            <div className="card-header flex justify-between items-center">
              <span className="text-section-header">Technical Tasks &amp; Deliverables</span>
              <span className="badge badge-default">{tasks.length} Total Tasks</span>
            </div>
          ) : (
            <div className="tabs" style={{
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              WebkitOverflowScrolling: 'touch',
            }}>
              {[
                { key: 'leads', label: 'Assigned leads', count: totalLeads },
                { key: 'tasks', label: 'Assigned Tasks', count: tasks.length },
                { key: 'followups', label: 'Follow-ups', count: totalFu },
                { key: 'quotations', label: 'Quotations', count: quotations.length },
                { key: 'invoices', label: 'Invoices', count: invoices.length },
                { key: 'activity', label: 'Activity log', count: activities.length },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  className={`tab ${activeTab === key ? 'active' : ''}`}
                  onClick={() => setActiveTab(key as any)}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {label}
                  <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {count}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div style={{ padding: '16px' }}>

            {/* TASKS TAB */}
            {activeTab === 'tasks' && (
              <div>
                {taskList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-tertiary)', fontSize: 13 }}>
                    No technical tasks assigned to this team member yet.
                  </div>
                ) : (
                  <>
                    <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, margin: -4 }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th style={{ width: '35%' }}>Task Deliverable</th>
                            <th style={{ width: '25%' }}>Client</th>
                            <th style={{ width: '20%' }}>Target Date</th>
                            <th style={{ width: '20%' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedTasks.map((t: any) => (
                            <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTask(t)}>
                              <td>
                                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{t.title}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Category: {t.category}</div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 500, fontSize: 13 }}>{t.client?.name ?? '—'}</div>
                                {t.client?.company && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t.client.company}</div>}
                              </td>
                              <td style={{ fontSize: 13 }}>{t.due_date ?? 'No deadline'}</td>
                              <td>
                                <span className="badge" style={{
                                  background: t.status === 'COMPLETED' ? '#DCFCE7' : t.status === 'IN_PROGRESS' ? '#EFF6FF' : '#F4F4F5',
                                  color: t.status === 'COMPLETED' ? '#15803D' : t.status === 'IN_PROGRESS' ? '#1D4ED8' : '#52525B',
                                  fontSize: 11, fontWeight: 600,
                                }}>
                                  {t.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      currentPage={tasksPage}
                      totalItems={taskList.length}
                      pageSize={PAGE_SIZE}
                      onPageChange={setTasksPage}
                    />
                  </>
                )}
              </div>
            )}

            {/* LEADS TAB */}
            {activeTab === 'leads' && (
              <div>
                <div style={{ position: 'relative', marginBottom: 14 }}>
                  <Search size={14} style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-tertiary)', pointerEvents: 'none',
                  }} />
                  <input
                    className="form-input"
                    placeholder="Search leads by name or phone..."
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    style={{ paddingLeft: 32, fontSize: 13 }}
                  />
                </div>

                {filteredLeads.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '32px 0' }}>
                    {leadSearch ? 'No leads match your search' : 'No leads assigned yet'}
                  </p>
                ) : (
                  <>
                    <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, margin: -4 }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Lead name</th>
                            <th>Phone</th>
                            <th>Stage</th>
                            <th>Source</th>
                            <th>Added</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLeads.slice((leadsPage - 1) * PAGE_SIZE, leadsPage * PAGE_SIZE).map((lead) => (
                            <tr
                              key={lead.id}
                              className="clickable"
                              onClick={() => (window.location.href = `/leads/${lead.id}`)}
                            >
                              <td style={{ fontWeight: 500 }}>{lead.name ?? '—'}</td>
                              <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{lead.phone ?? '—'}</td>
                              <td>
                                {lead.stage && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: lead.stage.color_hex, flexShrink: 0 }} />
                                    {lead.stage.label}
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className="badge badge-default" style={{ fontSize: 11 }}>
                                  {SOURCE_LABELS[lead.source] ?? lead.source}
                                </span>
                              </td>
                              <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                              </td>
                              <td>
                                <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      currentPage={leadsPage}
                      totalItems={filteredLeads.length}
                      pageSize={PAGE_SIZE}
                      onPageChange={setLeadsPage}
                    />
                  </>
                )}
              </div>
            )}

            {/* FOLLOW-UPS TAB */}
            {activeTab === 'followups' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {followups.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '32px 0' }}>
                    No follow-ups recorded
                  </p>
                ) : (
                  <>
                    {followups.slice((followupsPage - 1) * PAGE_SIZE, followupsPage * PAGE_SIZE).map((fu) => {
                      const overdue = !fu.is_completed && new Date(fu.scheduled_at) < new Date()
                      return (
                        <div
                          key={fu.id}
                          style={{
                            padding: '12px 14px',
                            border: `1px solid ${fu.is_completed ? 'var(--success)' : overdue ? 'var(--danger)' : 'var(--border)'}`,
                            borderRadius: 'var(--radius-sm)',
                            background: fu.is_completed ? 'var(--success-light)' : overdue ? 'var(--danger-light)' : 'var(--bg)',
                            cursor: fu.lead?.id ? 'pointer' : 'default',
                          }}
                          onClick={() => fu.lead?.id && (window.location.href = `/leads/${fu.lead.id}`)}
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: 4 }}>
                            <div className="flex items-center gap-2">
                              <span style={{ fontSize: 13, fontWeight: 600, color: fu.is_completed ? 'var(--success)' : overdue ? 'var(--danger)' : 'var(--text-primary)' }}>
                                {fu.lead?.name ?? 'Unknown lead'}
                              </span>
                              {fu.is_completed ? (
                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', fontWeight: 600 }}>
                                  Completed
                                </span>
                              ) : overdue ? (
                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <AlertCircle size={9} /> Pending
                                </span>
                              ) : null}
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              {format(new Date(fu.scheduled_at), 'dd MMM yyyy, HH:mm')}
                            </span>
                          </div>
                          {fu.note && <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Plan: {fu.note}</p>}
                          {fu.outcome_note && (
                            <div style={{ marginTop: 6, padding: '6px 8px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#16a34a' }}>Outcome: </span>
                              <span style={{ fontSize: 12, color: '#166534' }}>{fu.outcome_note}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <TablePagination
                      currentPage={followupsPage}
                      totalItems={followups.length}
                      pageSize={PAGE_SIZE}
                      onPageChange={setFollowupsPage}
                    />
                  </>
                )}
              </div>
            )}

            {/* QUOTATIONS TAB */}
            {activeTab === 'quotations' && (
              <div>
                {quotations.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '32px 0' }}>
                    No quotations created by this agent yet
                  </p>
                ) : (
                  <>
                    <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, margin: -4 }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Quote #</th>
                            <th>Client / Lead</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th className="num">Original Total</th>
                            <th className="num">Normalized (SAR)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quotations.slice((quotesPage - 1) * PAGE_SIZE, quotesPage * PAGE_SIZE).map((q) => {
                            const origCurr = q.currency ?? 'SAR'
                            const origTotal = Number(q.total ?? 0)
                            const sarTotal = convertToSAR(origTotal, origCurr)

                            return (
                              <tr
                                key={q.id}
                                className="clickable"
                                onClick={() => router.push(`/quotations/${q.id}`)}
                              >
                                <td style={{ fontWeight: 600 }}>
                                  <Link
                                    href={`/quotations/${q.id}`}
                                    style={{ color: 'var(--accent)', textDecoration: 'none' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {q.quote_number}
                                  </Link>
                                </td>
                                <td>
                                  {q.client_id ? (
                                    <Link
                                      href={`/clients/${q.client_id}`}
                                      style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {q.client?.name ?? '—'}
                                    </Link>
                                  ) : q.lead_id ? (
                                    <Link
                                      href={`/leads/${q.lead_id}`}
                                      style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {q.lead?.name ?? '—'}
                                    </Link>
                                  ) : (
                                    q.client?.name ?? q.lead?.name ?? '—'
                                  )}
                                </td>
                                <td>
                                  <span className={`badge badge-${q.status === 'ACCEPTED' ? 'success' : q.status === 'SENT' ? 'info' : 'default'}`} style={{ fontSize: 11 }}>
                                    {q.status}
                                  </span>
                                </td>
                                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                  {q.issue_date ? format(new Date(q.issue_date), 'dd MMM yyyy') : '—'}
                                </td>
                                <td className="num tabular-nums" style={{ fontWeight: 500 }}>
                                  {origCurr} {origTotal.toLocaleString('en', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="num tabular-nums" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                                  SAR {sarTotal.toLocaleString('en', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      currentPage={quotesPage}
                      totalItems={quotations.length}
                      pageSize={PAGE_SIZE}
                      onPageChange={setQuotesPage}
                    />
                  </>
                )}
              </div>
            )}

            {/* INVOICES TAB */}
            {activeTab === 'invoices' && (
              <div>
                {invoices.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '32px 0' }}>
                    No invoices created by this agent yet
                  </p>
                ) : (
                  <>
                    <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, margin: -4 }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Invoice #</th>
                            <th>Client / Lead</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th className="num">Total (Original)</th>
                            <th className="num">Normalized Total (SAR)</th>
                            <th className="num">Collected (SAR)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.slice((invoicesPage - 1) * PAGE_SIZE, invoicesPage * PAGE_SIZE).map((inv) => {
                            const origCurr = inv.currency ?? 'SAR'
                            const origTotal = Number(inv.total ?? 0)
                            const origPaid = Number(inv.amount_paid ?? 0)
                            const sarTotal = convertToSAR(origTotal, origCurr)
                            const sarPaid = convertToSAR(origPaid, origCurr)

                            return (
                              <tr
                                key={inv.id}
                                className="clickable"
                                onClick={() => router.push(`/invoices/${inv.id}`)}
                              >
                                <td style={{ fontWeight: 600 }}>
                                  <Link
                                    href={`/invoices/${inv.id}`}
                                    style={{ color: 'var(--accent)', textDecoration: 'none' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {inv.invoice_number}
                                  </Link>
                                </td>
                                <td>
                                  {inv.client_id ? (
                                    <Link
                                      href={`/clients/${inv.client_id}`}
                                      style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {inv.client?.name ?? '—'}
                                    </Link>
                                  ) : inv.lead_id ? (
                                    <Link
                                      href={`/leads/${inv.lead_id}`}
                                      style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {inv.lead?.name ?? '—'}
                                    </Link>
                                  ) : (
                                    inv.client?.name ?? inv.lead?.name ?? '—'
                                  )}
                                </td>
                                <td>
                                  <span className={`badge badge-${inv.status === 'PAID' ? 'success' : inv.status === 'PARTIALLY_PAID' ? 'warning' : 'default'}`} style={{ fontSize: 11 }}>
                                    {inv.status}
                                  </span>
                                </td>
                                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                  {inv.issue_date ? format(new Date(inv.issue_date), 'dd MMM yyyy') : '—'}
                                </td>
                                <td className="num tabular-nums" style={{ fontWeight: 500 }}>
                                  {origCurr} {origTotal.toLocaleString('en', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="num tabular-nums" style={{ fontWeight: 600 }}>
                                  SAR {sarTotal.toLocaleString('en', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="num tabular-nums" style={{ color: 'var(--success)', fontWeight: 600 }}>
                                  SAR {sarPaid.toLocaleString('en', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      currentPage={invoicesPage}
                      totalItems={invoices.length}
                      pageSize={PAGE_SIZE}
                      onPageChange={setInvoicesPage}
                    />
                  </>
                )}
              </div>
            )}

            {/* ACTIVITY TAB */}
            {activeTab === 'activity' && (
              <div className="timeline" style={{ padding: '8px 0' }}>
                {activities.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '32px 0' }}>
                    No activity recorded
                  </p>
                ) : (
                  <>
                    {activities.slice((activityPage - 1) * PAGE_SIZE, activityPage * PAGE_SIZE).map((act) => (
                      <div key={act.id} className="timeline-item">
                        <div className="timeline-icon">
                          <Activity size={12} />
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-text">
                            {activityLabel(act.activity_type, act.metadata)}
                            {act.lead?.name && (
                              <span
                                style={{ marginLeft: 4, color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                                onClick={() => window.location.href = `/leads/${act.lead.id}`}
                              >
                                — {act.lead.name}
                              </span>
                            )}
                          </div>
                          <div className="timeline-time">
                            {formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    ))}
                    <TablePagination
                      currentPage={activityPage}
                      totalItems={activities.length}
                      pageSize={PAGE_SIZE}
                      onPageChange={setActivityPage}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* FULL FEATURED TASK DETAILS & DAILY LOG DRAWER */}
      {selectedTask && (
        <div className="modal-backdrop" onClick={() => setSelectedTask(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <div>
                <span className="text-section-header">{selectedTask.title}</span>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Client: <strong>{selectedTask.client?.name}</strong> {selectedTask.client?.company ? `(${selectedTask.client.company})` : ''}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedTask(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Task Meta Bar */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: 12, background: 'var(--bg)', borderRadius: 8, fontSize: 13 }}>
                <div>
                  <span className="text-meta">Category: </span>
                  <strong>{CATEGORY_LABELS[selectedTask.category]?.label || selectedTask.category}</strong>
                </div>
                <div>
                  <span className="text-meta">Specialist: </span>
                  <strong>{selectedTask.assigned_employee?.name ?? 'Unassigned'}</strong>
                </div>
                <div>
                  <span className="text-meta">Due Date: </span>
                  <strong>{selectedTask.due_date ?? 'No deadline'}</strong>
                </div>
                <div>
                  <span className="text-meta">Priority: </span>
                  <strong style={{ color: PRIORITY_CONFIG[selectedTask.priority]?.color }}>{selectedTask.priority}</strong>
                </div>
              </div>

              {/* TASK REQUIREMENTS & INSTRUCTIONS SECTION */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Requirements &amp; Instructions
                  </span>
                  {(currentProfile?.role === 'ADMIN' || currentProfile?.role === 'ACCOUNT_MANAGER') && !isEditingTaskDetails && (
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() => {
                        setIsEditingTaskDetails(true)
                        setEditTaskDescription(selectedTask.description || '')
                        setEditTaskDeliverableLink(selectedTask.deliverable_link || '')
                      }}
                    >
                      <Edit2 size={12} /> Edit Instructions
                    </button>
                  )}
                </div>

                {isEditingTaskDetails ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #CBD5E1' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 12 }}>Instructions / Guidelines</label>
                      <textarea
                        className="form-input"
                        rows={4}
                        value={editTaskDescription}
                        onChange={(e) => setEditTaskDescription(e.target.value)}
                        placeholder="Enter task guidelines and instructions for the specialist..."
                        style={{ fontSize: 13 }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 12 }}>Deliverable Folder / Link (Optional)</label>
                      <input
                        className="form-input"
                        value={editTaskDeliverableLink}
                        onChange={(e) => setEditTaskDeliverableLink(e.target.value)}
                        placeholder="https://drive.google.com/... or Figma link"
                        style={{ fontSize: 12 }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => setIsEditingTaskDetails(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-xs"
                        onClick={handleSaveTaskDetails}
                        disabled={savingTaskDetails}
                      >
                        {savingTaskDetails ? 'Saving...' : 'Save Instructions'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {selectedTask.description ? (
                      <div style={{ fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', background: '#fff', padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}>
                        {selectedTask.description}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '6px 0' }}>
                        No instructions provided yet. Click "Edit Instructions" to add guidelines.
                      </div>
                    )}

                    {selectedTask.deliverable_link && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                          Deliverable Folder / Link
                        </div>
                        <a
                          href={selectedTask.deliverable_link}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-outline btn-xs"
                          style={{ color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <ExternalLink size={12} /> Open Deliverable Link
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* POST PROGRESS UPDATE FORM */}
              <form onSubmit={handlePostDailyUpdate} style={{ background: '#F8FAFC', padding: 14, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MessageSquare size={15} color="var(--accent)" /> Post Work Update / Log
                </div>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Describe progress made (e.g. Uploaded 3 videos to Drive, updated responsive layout)..."
                  value={updateBody}
                  onChange={(e) => setUpdateBody(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    className="form-input"
                    placeholder="Proof / Link URL (optional)"
                    value={updateLink}
                    onChange={(e) => setUpdateLink(e.target.value)}
                    style={{ flex: '1 1 200px', fontSize: 12 }}
                  />
                  <select
                    className="form-select"
                    value={updateStatus}
                    onChange={(e) => setUpdateStatus(e.target.value as TaskStatus)}
                    style={{ width: 140, fontSize: 12 }}
                  >
                    <option value="">Status (Keep current)</option>
                    {Object.entries(STATUS_CONFIG).map(([st, cfg]) => (
                      <option key={st} value={st}>{cfg.label}</option>
                    ))}
                  </select>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={submittingUpdate}>
                    {submittingUpdate ? 'Saving...' : 'Post Update'}
                  </button>
                </div>
              </form>

              {/* PROGRESS & ACTIVITY HISTORY LOG */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                  Work Log &amp; Status History ({selectedTask.updates?.length ?? 0})
                </div>
                {(!selectedTask.updates || selectedTask.updates.length === 0) ? (
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '12px 0' }}>
                    No updates posted yet. Employees can post progress notes above.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {selectedTask.updates.map((u: any) => {
                      const canManageLog =
                        currentProfile?.id === u.author_id ||
                        currentProfile?.role === 'ADMIN' ||
                        currentProfile?.role === 'ACCOUNT_MANAGER'
                      const isEditingThis = editingLogId === u.id
                      const isConfirmingDeleteThis = confirmingDeleteLogId === u.id

                      return (
                        <div key={u.id} style={{ padding: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                                {u.author?.name ?? 'System'}
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                {format(parseISO(u.created_at), 'MMM d, yyyy h:mm a')}
                              </span>
                            </div>

                            {canManageLog && !isEditingThis && !isConfirmingDeleteThis && (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onClick={() => {
                                    setEditingLogId(u.id)
                                    setEditingLogBody(u.body)
                                    setEditingLogLink(u.attachment_url || '')
                                  }}
                                  title="Edit work log"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onClick={() => setConfirmingDeleteLogId(u.id)}
                                  style={{ color: 'var(--danger)' }}
                                  title="Delete work log"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* IN-PAGE DELETE CONFIRMATION ALERT */}
                          {isConfirmingDeleteThis ? (
                            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#991B1B' }}>
                                Delete this daily work log entry?
                              </span>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={() => setConfirmingDeleteLogId(null)}
                                  style={{ background: '#fff' }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-xs"
                                  onClick={() => confirmDeleteLog(u.id)}
                                  style={{ background: '#DC2626', color: '#fff', border: 'none', fontWeight: 600 }}
                                >
                                  Yes, Delete
                                </button>
                              </div>
                            </div>
                          ) : isEditingThis ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                              <textarea
                                className="form-input"
                                rows={2}
                                value={editingLogBody}
                                onChange={(e) => setEditingLogBody(e.target.value)}
                                style={{ fontSize: 13 }}
                              />
                              <input
                                className="form-input"
                                placeholder="Proof / Deliverable Link URL"
                                value={editingLogLink}
                                onChange={(e) => setEditingLogLink(e.target.value)}
                                style={{ fontSize: 12 }}
                              />
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={() => setEditingLogId(null)}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-xs"
                                  onClick={() => handleSaveLogEdit(u.id)}
                                  disabled={savingLog}
                                >
                                  {savingLog ? 'Saving...' : 'Save Log'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{u.body}</div>
                              {u.attachment_url && (
                                <div style={{ marginTop: 6 }}>
                                  <a
                                    href={u.attachment_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, wordBreak: 'break-all' }}
                                  >
                                    <Paperclip size={12} /> View Proof / Deliverable <ExternalLink size={10} />
                                  </a>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TablePagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
}: {
  currentPage: number
  totalItems: number
  pageSize: number
  onPageChange: (p: number) => void
}) {
  const totalPages = Math.ceil(totalItems / pageSize)
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between" style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        Showing {Math.min((currentPage - 1) * pageSize + 1, totalItems)} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-outline btn-xs"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Previous
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-outline btn-xs"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
