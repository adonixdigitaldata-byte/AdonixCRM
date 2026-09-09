'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format, isAfter, isBefore, parseISO } from 'date-fns'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Search,
  Filter,
  ExternalLink,
  UserCheck,
  Building2,
  Calendar,
  MessageSquare,
  Paperclip,
  CheckCircle,
  XCircle,
  ChevronRight,
  Shield,
  Layers,
  X,
  FileText,
  AlertTriangle,
  PlayCircle,
  Edit2,
  Trash2,
} from 'lucide-react'
import type { ClientTask, ClientTaskUpdate, Profile, TaskCategory, TaskPriority, TaskStatus } from '@/types/database'
import ClientSearchSelect from '@/components/ui/ClientSearchSelect'

interface Props {
  initialTasks: ClientTask[]
  clients: { id: string; name: string; company?: string | null }[]
  profiles: Profile[]
  currentProfile: Profile | null
}

const CATEGORY_LABELS: Record<TaskCategory, { label: string; color: string; icon: string }> = {
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

const STATUS_CONFIG: Record<TaskStatus, { label: string; bg: string; text: string }> = {
  PENDING: { label: 'To Do', bg: '#F4F4F5', text: '#52525B' },
  IN_PROGRESS: { label: 'In Progress', bg: '#EFF6FF', text: '#1D4ED8' },
  UNDER_REVIEW: { label: 'Under Review', bg: '#FEF3C7', text: '#D97706' },
  COMPLETED: { label: 'Completed', bg: '#DCFCE7', text: '#15803D' },
  BLOCKED: { label: 'Blocked', bg: '#FEE2E2', text: '#B91C1C' },
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  LOW: { label: 'Low', color: '#71717A' },
  MEDIUM: { label: 'Medium', color: '#0284C7' },
  HIGH: { label: 'High', color: '#EA580C' },
  URGENT: { label: 'Urgent', color: '#DC2626' },
}

export default function TasksClient({ initialTasks, clients, profiles, currentProfile }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [tasks, setTasks] = useState<ClientTask[]>(initialTasks)
  const [activeTab, setActiveTab] = useState<'MY' | 'ALL' | 'ACTIVE' | 'COMPLETED' | 'OVERDUE'>('ALL')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('ALL')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [filterEmployee, setFilterEmployee] = useState<string>('ALL')

  // Modals & Drawers
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<ClientTask | null>(null)

  // New task form state
  const [newTitle, setNewTitle] = useState('')
  const [newClientId, setNewClientId] = useState('')
  const [newEmployeeId, setNewEmployeeId] = useState('')
  const [newCategory, setNewCategory] = useState<TaskCategory>('WEBSITE')
  const [newPriority, setNewPriority] = useState<TaskPriority>('MEDIUM')
  const [newDueDate, setNewDueDate] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newDeliverableLink, setNewDeliverableLink] = useState('')
  const [submittingTask, setSubmittingTask] = useState(false)

  // Daily update drawer form state
  const [updateBody, setUpdateBody] = useState('')
  const [updateLink, setUpdateLink] = useState('')
  const [updateStatus, setUpdateStatus] = useState<TaskStatus | ''>('')
  const [submittingUpdate, setSubmittingUpdate] = useState(false)

  // Task deletion state
  const [taskToDelete, setTaskToDelete] = useState<ClientTask | null>(null)
  const [deletingTask, setDeletingTask] = useState(false)

  // Auto-open task drawer if taskId query parameter is present in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const taskIdParam = params.get('taskId')
      if (taskIdParam) {
        const found = tasks.find((t) => t.id === taskIdParam)
        if (found) {
          setSelectedTask(found)
        }
      }
    }
  }, [tasks])

  function canDeleteTask(task: ClientTask | null, profile: Profile | null): boolean {
    if (!task || !profile) return false
    if (profile.role === 'ADMIN') return true
    if (profile.role === 'ACCOUNT_MANAGER') {
      const assignedRole = task.assigned_employee?.role
      if (assignedRole === 'ADMIN' || assignedRole === 'ACCOUNT_MANAGER') {
        return false
      }
      return true
    }
    return false
  }

  async function handleDeleteTask(taskId: string) {
    const targetTask = tasks.find((t) => t.id === taskId)
    if (targetTask && !canDeleteTask(targetTask, currentProfile)) {
      alert('Permission denied: Account Managers cannot delete tasks assigned to Admins or Account Managers.')
      setTaskToDelete(null)
      return
    }
    if (deletingTask) return
    setDeletingTask(true)
    try {
      const { error } = await supabase.from('client_tasks').delete().eq('id', taskId)
      if (error) throw error
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      if (selectedTask?.id === taskId) {
        setSelectedTask(null)
      }
      setTaskToDelete(null)
    } catch (err: any) {
      alert(err.message || 'Failed to delete task')
    } finally {
      setDeletingTask(false)
    }
  }

  // Compute active task counts per employee for workload check
  const employeeWorkloads = useMemo(() => {
    const counts: Record<string, number> = {}
    tasks.forEach((t) => {
      if (t.assigned_employee_id && t.status !== 'COMPLETED') {
        counts[t.assigned_employee_id] = (counts[t.assigned_employee_id] || 0) + 1
      }
    })
    return counts
  }, [tasks])

  const isStaffRestricted = currentProfile?.role === 'EMPLOYEE' || currentProfile?.role === 'AGENT'

  // Accessible tasks pool (scoped for EMPLOYEE and AGENT)
  const accessibleTasks = useMemo(() => {
    if (isStaffRestricted) {
      return tasks.filter(
        (t) => t.assigned_employee_id === currentProfile?.id || (t as any).created_by === currentProfile?.id
      )
    }
    return tasks
  }, [tasks, currentProfile?.id, isStaffRestricted])

  // Filter tasks logic
  const filteredTasks = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')

    return accessibleTasks.filter((t) => {
      // Tab filter
      if (activeTab === 'MY' && t.assigned_employee_id !== currentProfile?.id) return false
      if (activeTab === 'ACTIVE' && t.status === 'COMPLETED') return false
      if (activeTab === 'COMPLETED' && t.status !== 'COMPLETED') return false
      if (activeTab === 'OVERDUE') {
        if (t.status === 'COMPLETED' || !t.due_date || t.due_date >= todayStr) return false
      }

      // Dropdown filters
      if (filterCategory !== 'ALL' && t.category !== filterCategory) return false
      if (filterStatus !== 'ALL' && t.status !== filterStatus) return false
      if (filterEmployee !== 'ALL' && t.assigned_employee_id !== filterEmployee) return false

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase()
        const titleMatch = t.title.toLowerCase().includes(q)
        const clientMatch = t.client?.name.toLowerCase().includes(q) || t.client?.company?.toLowerCase().includes(q)
        const empMatch = t.assigned_employee?.name.toLowerCase().includes(q)
        if (!titleMatch && !clientMatch && !empMatch) return false
      }

      return true
    })
  }, [accessibleTasks, activeTab, filterCategory, filterStatus, filterEmployee, search, currentProfile?.id])

  // Pagination state & calculation
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / itemsPerPage))

  // Auto-reset page if out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages >= 1) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredTasks.slice(start, start + itemsPerPage)
  }, [filteredTasks, currentPage, itemsPerPage])

  // Create Task Handler
  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || !newClientId || submittingTask) return

    setSubmittingTask(true)
    try {
      const payload = {
        client_id: newClientId,
        assigned_employee_id: newEmployeeId || null,
        created_by: currentProfile?.id || null,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        category: newCategory,
        status: 'PENDING' as TaskStatus,
        priority: newPriority,
        due_date: newDueDate || null,
        deliverable_link: newDeliverableLink.trim() || null,
      }

      const { data, error } = await supabase
        .from('client_tasks')
        .insert(payload)
        .select(`
          *,
          client:clients(id, name, company, email, phone),
          assigned_employee:profiles!assigned_employee_id(id, name, email, role, specialization, avatar_url, work_status),
          creator:profiles!created_by(id, name),
          updates:client_task_updates(*)
        `)
        .single()

      if (error) throw error

      setTasks([data, ...tasks])
      setShowCreateModal(false)
      // Reset form
      setNewTitle('')
      setNewClientId('')
      setNewEmployeeId('')
      setNewDescription('')
      setNewDeliverableLink('')
      setNewDueDate('')
    } catch (err: any) {
      alert(err.message || 'Failed to create task')
    } finally {
      setSubmittingTask(false)
    }
  }

  // Fast inline status change
  async function handleQuickStatusChange(taskId: string, newStatus: TaskStatus) {
    const prevTask = tasks.find((t) => t.id === taskId)
    if (!prevTask || prevTask.status === newStatus) return

    // Optimistic UI update
    setTasks(tasks.map((t) => t.id === taskId ? { ...t, status: newStatus } : t))
    if (selectedTask?.id === taskId) {
      setSelectedTask({ ...selectedTask, status: newStatus })
    }

    try {
      await supabase
        .from('client_tasks')
        .update({ status: newStatus })
        .eq('id', taskId)

      // Add system update note for status change
      await supabase.from('client_task_updates').insert({
        task_id: taskId,
        author_id: currentProfile?.id || null,
        update_type: 'STATUS_CHANGE',
        status_from: prevTask.status,
        status_to: newStatus,
        body: `Status updated from ${STATUS_CONFIG[prevTask.status].label} to ${STATUS_CONFIG[newStatus].label}`,
      })
    } catch (err) {
      // Rollback
      setTasks(tasks.map((t) => t.id === taskId ? prevTask : t))
    }
  }

  // Post Daily Progress Update / Note Handler
  async function handlePostDailyUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTask || (!updateBody.trim() && !updateLink.trim() && !updateStatus) || submittingUpdate) return

    setSubmittingUpdate(true)
    try {
      const targetStatus = updateStatus || selectedTask.status

      // 1. If status changed, update task table
      if (updateStatus && updateStatus !== selectedTask.status) {
        await supabase
          .from('client_tasks')
          .update({ status: updateStatus })
          .eq('id', selectedTask.id)
      }

      // 2. Insert update log
      const { data: newUpdate, error } = await supabase
        .from('client_task_updates')
        .insert({
          task_id: selectedTask.id,
          author_id: currentProfile?.id || null,
          update_type: updateLink ? 'LINK_ADDED' : 'PROGRESS_NOTE',
          status_from: selectedTask.status,
          status_to: targetStatus,
          body: updateBody.trim() || 'Posted work deliverable update.',
          attachment_url: updateLink.trim() || null,
        })
        .select(`
          *,
          author:profiles(id, name, avatar_url)
        `)
        .single()

      if (error) throw error

      const updatedTaskObj = {
        ...selectedTask,
        status: targetStatus,
        updates: [newUpdate, ...(selectedTask.updates || [])],
      }

      setSelectedTask(updatedTaskObj)
      setTasks(tasks.map((t) => (t.id === selectedTask.id ? updatedTaskObj : t)))

      setUpdateBody('')
      setUpdateLink('')
      setUpdateStatus('')
    } catch (err: any) {
      alert(err.message || 'Failed to submit update')
    } finally {
      setSubmittingUpdate(false)
    }
  }

  // Edit & Delete Daily Log Handler
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [editingLogBody, setEditingLogBody] = useState('')
  const [editingLogLink, setEditingLogLink] = useState('')
  const [savingLog, setSavingLog] = useState(false)
  const [confirmingDeleteLogId, setConfirmingDeleteLogId] = useState<string | null>(null)

  // Edit Task Details Handler (Admin & Account Manager)
  const [isEditingTaskDetails, setIsEditingTaskDetails] = useState(false)
  const [editTaskTitle, setEditTaskTitle] = useState('')
  const [editTaskClientId, setEditTaskClientId] = useState('')
  const [editTaskCategory, setEditTaskCategory] = useState<TaskCategory>('WEBSITE')
  const [editTaskEmployeeId, setEditTaskEmployeeId] = useState('')
  const [editTaskDueDate, setEditTaskDueDate] = useState('')
  const [editTaskPriority, setEditTaskPriority] = useState<TaskPriority>('MEDIUM')
  const [editTaskDescription, setEditTaskDescription] = useState('')
  const [editTaskDeliverableLink, setEditTaskDeliverableLink] = useState('')
  const [savingTaskDetails, setSavingTaskDetails] = useState(false)

  function startEditingTaskDetails(task: ClientTask) {
    setEditTaskTitle(task.title || '')
    setEditTaskClientId(task.client_id || '')
    setEditTaskCategory(task.category || 'WEBSITE')
    setEditTaskEmployeeId(task.assigned_employee_id || '')
    setEditTaskDueDate(task.due_date || '')
    setEditTaskPriority(task.priority || 'MEDIUM')
    setEditTaskDescription(task.description || '')
    setEditTaskDeliverableLink(task.deliverable_link || '')
    setIsEditingTaskDetails(true)
  }

  async function handleSaveTaskDetails() {
    if (!selectedTask || savingTaskDetails) return
    if (!editTaskTitle.trim()) {
      alert('Task title is required.')
      return
    }
    if (!editTaskClientId) {
      alert('Client selection is required.')
      return
    }
    setSavingTaskDetails(true)
    try {
      const { data, error } = await supabase
        .from('client_tasks')
        .update({
          title: editTaskTitle.trim(),
          client_id: editTaskClientId,
          category: editTaskCategory,
          assigned_employee_id: editTaskEmployeeId || null,
          due_date: editTaskDueDate || null,
          priority: editTaskPriority,
          description: editTaskDescription.trim() || null,
          deliverable_link: editTaskDeliverableLink.trim() || null,
        })
        .eq('id', selectedTask.id)
        .select(`
          *,
          client:clients(id, name, company),
          assigned_employee:profiles!assigned_employee_id(id, name, role, specialization, work_status),
          creator:profiles!created_by(id, name)
        `)
        .single()

      if (error) throw error

      const updatedTask: ClientTask = {
        ...selectedTask,
        ...data,
        updates: selectedTask.updates,
      }

      setSelectedTask(updatedTask)
      setTasks(tasks.map((t) => (t.id === selectedTask.id ? updatedTask : t)))
      setIsEditingTaskDetails(false)
    } catch (err: any) {
      alert(err.message || 'Failed to update task details')
    } finally {
      setSavingTaskDetails(false)
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
        const updatedList = (selectedTask.updates || []).map((u) =>
          u.id === logId ? { ...u, body: editingLogBody.trim(), attachment_url: editingLogLink.trim() || null } : u
        )
        setSelectedTask({ ...selectedTask, updates: updatedList })
        setTasks(tasks.map((t) => (t.id === selectedTask.id ? { ...t, updates: updatedList } : t)))
      }
      setEditingLogId(null)
    } catch (err: any) {
      alert(err.message || 'Failed to update log entry')
    } finally {
      setSavingLog(false)
    }
  }

  async function confirmDeleteLog(logId: string) {
    try {
      const { error } = await supabase.from('client_task_updates').delete().eq('id', logId)
      if (error) throw error

      if (selectedTask) {
        const updatedList = (selectedTask.updates || []).filter((u) => u.id !== logId)
        setSelectedTask({ ...selectedTask, updates: updatedList })
        setTasks(tasks.map((t) => (t.id === selectedTask.id ? { ...t, updates: updatedList } : t)))
      }
      setConfirmingDeleteLogId(null)
    } catch (err: any) {
      alert(err.message || 'Failed to delete log entry')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-page-title">Client Tasks &amp; Operations</h1>
          <p className="text-meta" style={{ marginTop: 2 }}>
            Manage technical task deliverables, employee assignments, and progress logs.
          </p>
        </div>
        {(currentProfile?.role === 'ADMIN' || currentProfile?.role === 'ACCOUNT_MANAGER') && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} />
            New Technical Task
          </button>
        )}
      </div>

      <div className="page-body">
        {/* Navigation Presets Tabs - Scrollable on mobile */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 8,
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          WebkitOverflowScrolling: 'touch',
        }}>
          <button
            className={`btn btn-sm ${activeTab === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { setActiveTab('ALL'); setCurrentPage(1); }}
          >
            {isStaffRestricted ? 'My Tasks' : 'All Tasks'} ({accessibleTasks.length})
          </button>
          {!isStaffRestricted && (
            <button
              className={`btn btn-sm ${activeTab === 'MY' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setActiveTab('MY'); setCurrentPage(1); }}
            >
              <UserCheck size={14} />
              My Assigned Tasks ({accessibleTasks.filter((t) => t.assigned_employee_id === currentProfile?.id).length})
            </button>
          )}
          <button
            className={`btn btn-sm ${activeTab === 'ACTIVE' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { setActiveTab('ACTIVE'); setCurrentPage(1); }}
          >
            In Progress ({accessibleTasks.filter((t) => t.status !== 'COMPLETED').length})
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'OVERDUE' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { setActiveTab('OVERDUE'); setCurrentPage(1); }}
            style={activeTab === 'OVERDUE' ? { background: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff' } : {}}
          >
            <AlertCircle size={14} />
            Overdue ({accessibleTasks.filter((t) => t.status !== 'COMPLETED' && t.due_date && t.due_date < format(new Date(), 'yyyy-MM-dd')).length})
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'COMPLETED' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { setActiveTab('COMPLETED'); setCurrentPage(1); }}
          >
            Completed ({accessibleTasks.filter((t) => t.status === 'COMPLETED').length})
          </button>
        </div>

        {/* Filter Bar - Responsive Wraps */}
        <div className="card" style={{ padding: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-tertiary)' }} />
              <input
                className="form-input"
                placeholder="Search tasks, clients, or employees..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 30 }}
              />
            </div>

            <select
              className="form-select"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ flex: '1 1 140px', minWidth: 130 }}
            >
              <option value="ALL">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([cat, cfg]) => (
                <option key={cat} value={cat}>{cfg.icon} {cfg.label}</option>
              ))}
            </select>

            <select
              className="form-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ flex: '1 1 130px', minWidth: 120 }}
            >
              <option value="ALL">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([st, cfg]) => (
                <option key={st} value={st}>{cfg.label}</option>
              ))}
            </select>

            <select
              className="form-select"
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              style={{ flex: '1 1 160px', minWidth: 140 }}
            >
              <option value="ALL">All Team Members</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role === 'EMPLOYEE' ? p.specialization || 'Employee' : p.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dense Task Table List with Mobile Horizontal Scroll */}
        <div className="card">
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 880 }}>
              <thead>
                <tr>
                  <th style={{ width: '32%', minWidth: 260 }}>Task Deliverable</th>
                  <th style={{ width: '19%', minWidth: 160 }}>Client</th>
                  <th style={{ width: '18%', minWidth: 150 }}>Assigned Specialist</th>
                  <th style={{ width: '12%', minWidth: 110 }}>Target Date</th>
                  <th style={{ width: '11%', minWidth: 120 }}>Status</th>
                  <th style={{ width: '8%', minWidth: 80, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)' }}>
                      No technical tasks found matching your filters.
                    </td>
                  </tr>
                ) : (
                  paginatedTasks.map((t) => {
                    const categoryCfg = CATEGORY_LABELS[t.category] || CATEGORY_LABELS.OTHER
                    const statusCfg = STATUS_CONFIG[t.status]
                    const priorityCfg = PRIORITY_CONFIG[t.priority]
                    const isOverdue = t.status !== 'COMPLETED' && t.due_date && t.due_date < format(new Date(), 'yyyy-MM-dd')

                    return (
                      <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTask(t)}>
                        {/* Task Title & Category */}
                        <td style={{ minWidth: 260, maxWidth: 360, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
                            <span style={{ fontSize: 18, lineHeight: '20px', flexShrink: 0 }}>{categoryCfg.icon}</span>
                            <div style={{ minWidth: 0, flex: 1, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                {t.title}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                <span style={{
                                  fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                                  background: `${categoryCfg.color}15`, color: categoryCfg.color, flexShrink: 0
                                }}>
                                  {categoryCfg.label}
                                </span>
                                <span style={{ fontSize: 11, color: priorityCfg.color, fontWeight: 600, flexShrink: 0 }}>
                                  ● {priorityCfg.label} Priority
                                </span>
                                {t.created_at && (
                                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                    • Assigned{t.creator?.name ? ` by ${t.creator.name}` : ''}: {format(parseISO(t.created_at), 'dd MMM yyyy, hh:mm a')}
                                  </span>
                                )}
                                {t.deliverable_link && (
                                  <a
                                    href={t.deliverable_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ fontSize: 11, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}
                                  >
                                    Deliverable <ExternalLink size={10} />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Client */}
                        <td style={{ minWidth: 160, maxWidth: 220, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                          <Link
                            href={`/clients/${t.client_id}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none', display: 'block', overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                          >
                            <Building2 size={13} style={{ display: 'inline', marginRight: 4, color: 'var(--text-secondary)' }} />
                            {t.client?.name ?? 'Unknown Client'}
                          </Link>
                          {t.client?.company && (
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{t.client.company}</div>
                          )}
                        </td>

                        {/* Assigned Employee */}
                        <td style={{ minWidth: 150 }}>
                          {t.assigned_employee ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)',
                                color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex',
                                alignItems: 'center', justifyContent: 'center', flexShrink: 0
                              }}>
                                {t.assigned_employee.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 500 }}>{t.assigned_employee.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                  {t.assigned_employee.specialization || t.assigned_employee.role}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Unassigned</span>
                          )}
                        </td>

                        {/* Target Due Date */}
                        <td style={{ minWidth: 110 }}>
                          {t.due_date ? (
                            <div style={{ fontSize: 13, color: isOverdue ? 'var(--danger)' : 'var(--text-primary)', fontWeight: isOverdue ? 600 : 400 }}>
                              {t.due_date}
                              {isOverdue && (
                                <div style={{ fontSize: 10, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <AlertTriangle size={10} /> Overdue
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No deadline</span>
                          )}
                        </td>

                        {/* Status Select */}
                        <td style={{ minWidth: 120 }} onClick={(e) => e.stopPropagation()}>
                          <select
                            className="form-select"
                            value={t.status}
                            onChange={(e) => handleQuickStatusChange(t.id, e.target.value as TaskStatus)}
                            style={{
                              padding: '4px 8px', fontSize: 12, fontWeight: 600,
                              background: statusCfg.bg, color: statusCfg.text, border: 'none',
                              borderRadius: 4, cursor: 'pointer'
                            }}
                          >
                            {Object.entries(STATUS_CONFIG).map(([st, cfg]) => (
                              <option key={st} value={st}>{cfg.label}</option>
                            ))}
                          </select>
                        </td>

                        {/* Action / View / Delete */}
                        <td style={{ minWidth: 80, textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={(e) => { e.stopPropagation(); setSelectedTask(t); }}
                              title="View Details"
                            >
                              <MessageSquare size={13} />
                              <span style={{ fontSize: 12, marginLeft: 4 }}>
                                {t.updates?.length ?? 0}
                              </span>
                            </button>
                            {(currentProfile?.role === 'ADMIN' || currentProfile?.role === 'ACCOUNT_MANAGER') && (
                              <button
                                className="btn btn-ghost btn-icon btn-xs"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedTask(t)
                                  startEditingTaskDetails(t)
                                }}
                                title="Edit Task Details"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}
                            {canDeleteTask(t, currentProfile) && (
                              <button
                                className="btn btn-ghost btn-icon btn-xs"
                                onClick={(e) => { e.stopPropagation(); setTaskToDelete(t); }}
                                style={{ color: 'var(--danger)' }}
                                title="Delete Task"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
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
          {filteredTasks.length > 0 && (
            <div className="flex justify-between items-center flex-wrap gap-2" style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
              <span className="text-meta">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredTasks.length)} of {filteredTasks.length} tasks
              </span>
              <div className="flex gap-1.5 items-center flex-wrap">
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`btn btn-xs ${currentPage === p ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setCurrentPage(p)}
                    style={{ minWidth: 28 }}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE NEW TASK MODAL */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <span className="text-section-header">Create Client Technical Task</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreateModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Select Client */}
                <div className="form-group">
                  <label className="form-label form-label-required">Select Client</label>
                  <ClientSearchSelect
                    clients={clients}
                    selectedClientId={newClientId}
                    onSelectClient={(c) => setNewClientId(c.id)}
                    placeholder="Search & select client by name or company..."
                  />
                </div>

                {/* Task Title */}
                <div className="form-group">
                  <label className="form-label form-label-required">Task Title / Deliverable Name</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Design Landing Page, 10 Short AI Reels, Meta Ads Campaign"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {/* Category */}
                  <div className="form-group" style={{ flex: '1 1 200px' }}>
                    <label className="form-label form-label-required">Category / Department</label>
                    <select
                      className="form-select"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as TaskCategory)}
                    >
                      {Object.entries(CATEGORY_LABELS).map(([cat, cfg]) => (
                        <option key={cat} value={cat}>{cfg.icon} {cfg.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Assigned Employee with Availability Indicator */}
                  <div className="form-group" style={{ flex: '1 1 200px' }}>
                    <label className="form-label">Assign Specialist / Employee</label>
                    <select
                      className="form-select"
                      value={newEmployeeId}
                      onChange={(e) => setNewEmployeeId(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {profiles.map((p) => {
                        const activeCount = employeeWorkloads[p.id] || 0
                        const statusBadge = p.work_status === 'BUSY' ? ' (Busy)' : p.work_status === 'ON_LEAVE' ? ' (On Leave)' : ' (Available)'
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name} - {p.specialization || p.role} [{activeCount} active tasks]{statusBadge}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {/* Priority */}
                  <div className="form-group" style={{ flex: '1 1 200px' }}>
                    <label className="form-label">Priority</label>
                    <select
                      className="form-select"
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    >
                      {Object.entries(PRIORITY_CONFIG).map(([pr, cfg]) => (
                        <option key={pr} value={pr}>{cfg.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Due Date */}
                  <div className="form-group" style={{ flex: '1 1 200px' }}>
                    <label className="form-label">Target Due Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Deliverable Link */}
                <div className="form-group">
                  <label className="form-label">Deliverable / Work Folder URL (Optional)</label>
                  <input
                    className="form-input"
                    placeholder="https://drive.google.com/... or Figma link"
                    value={newDeliverableLink}
                    onChange={(e) => setNewDeliverableLink(e.target.value)}
                  />
                </div>

                {/* Description */}
                <div className="form-group">
                  <label className="form-label">Detailed Requirements / Notes</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Specific guidelines or instructions for the employee..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submittingTask}>
                  {submittingTask ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TASK DETAILS & DAILY LOG DRAWER */}
      {selectedTask && (
        <div className="modal-backdrop" onClick={() => setSelectedTask(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <div>
                <span className="text-section-header" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'normal', display: 'block' }}>{selectedTask.title}</span>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Client: <strong>{selectedTask.client?.name}</strong> {selectedTask.client?.company ? `(${selectedTask.client.company})` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {(currentProfile?.role === 'ADMIN' || currentProfile?.role === 'ACCOUNT_MANAGER') && !isEditingTaskDetails && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => startEditingTaskDetails(selectedTask)}
                    title="Edit Task Details"
                  >
                    <Edit2 size={14} /> Edit Task
                  </button>
                )}
                {canDeleteTask(selectedTask, currentProfile) && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setTaskToDelete(selectedTask)}
                    style={{ color: 'var(--danger)', borderColor: '#FCA5A5' }}
                    title="Delete Task"
                  >
                    <Trash2 size={14} /> Delete Task
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedTask(null); setIsEditingTaskDetails(false); }}>
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {isEditingTaskDetails ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: '#F8FAFC', padding: 16, borderRadius: 8, border: '1px solid #CBD5E1' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid #E2E8F0', paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Edit2 size={16} color="var(--accent)" /> Edit Technical Task Details
                  </div>

                  {/* Select Client */}
                  <div className="form-group">
                    <label className="form-label form-label-required">Client</label>
                    <ClientSearchSelect
                      clients={clients}
                      selectedClientId={editTaskClientId}
                      onSelectClient={(c) => setEditTaskClientId(c.id)}
                      placeholder="Search & select client by name or company..."
                    />
                  </div>

                  {/* Task Title */}
                  <div className="form-group">
                    <label className="form-label form-label-required">Task Title / Deliverable Name</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Design Landing Page, 10 Short AI Reels, Meta Ads Campaign"
                      value={editTaskTitle}
                      onChange={(e) => setEditTaskTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {/* Category */}
                    <div className="form-group" style={{ flex: '1 1 200px' }}>
                      <label className="form-label">Category / Department</label>
                      <select
                        className="form-select"
                        value={editTaskCategory}
                        onChange={(e) => setEditTaskCategory(e.target.value as TaskCategory)}
                      >
                        {Object.entries(CATEGORY_LABELS).map(([cat, cfg]) => (
                          <option key={cat} value={cat}>{cfg.icon} {cfg.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Assigned Employee */}
                    <div className="form-group" style={{ flex: '1 1 200px' }}>
                      <label className="form-label">Assign Specialist / Employee</label>
                      <select
                        className="form-select"
                        value={editTaskEmployeeId}
                        onChange={(e) => setEditTaskEmployeeId(e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {profiles.map((p) => {
                          const activeCount = employeeWorkloads[p.id] || 0
                          const statusBadge = p.work_status === 'BUSY' ? ' (Busy)' : p.work_status === 'ON_LEAVE' ? ' (On Leave)' : ' (Available)'
                          return (
                            <option key={p.id} value={p.id}>
                              {p.name} - {p.specialization || p.role} [{activeCount} active tasks]{statusBadge}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {/* Priority */}
                    <div className="form-group" style={{ flex: '1 1 200px' }}>
                      <label className="form-label">Priority</label>
                      <select
                        className="form-select"
                        value={editTaskPriority}
                        onChange={(e) => setEditTaskPriority(e.target.value as TaskPriority)}
                      >
                        {Object.entries(PRIORITY_CONFIG).map(([pr, cfg]) => (
                          <option key={pr} value={pr}>{cfg.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Due Date */}
                    <div className="form-group" style={{ flex: '1 1 200px' }}>
                      <label className="form-label">Target Due Date</label>
                      <input
                        type="date"
                        className="form-input"
                        value={editTaskDueDate}
                        onChange={(e) => setEditTaskDueDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Deliverable Link */}
                  <div className="form-group">
                    <label className="form-label">Deliverable / Work Folder URL (Optional)</label>
                    <input
                      className="form-input"
                      placeholder="https://drive.google.com/... or Figma link"
                      value={editTaskDeliverableLink}
                      onChange={(e) => setEditTaskDeliverableLink(e.target.value)}
                    />
                  </div>

                  {/* Description */}
                  <div className="form-group">
                    <label className="form-label">Detailed Requirements / Instructions</label>
                    <textarea
                      className="form-input"
                      rows={4}
                      placeholder="Specific guidelines or instructions for the employee..."
                      value={editTaskDescription}
                      onChange={(e) => setEditTaskDescription(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setIsEditingTaskDetails(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleSaveTaskDetails}
                      disabled={savingTaskDetails}
                    >
                      {savingTaskDetails ? 'Saving...' : 'Save Task Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Task Meta Bar */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: 12, background: 'var(--bg)', borderRadius: 8, fontSize: 13 }}>
                    <div>
                      <span className="text-meta">Category: </span>
                      <strong>{CATEGORY_LABELS[selectedTask.category]?.label}</strong>
                    </div>
                    <div>
                      <span className="text-meta">Specialist: </span>
                      <strong>{selectedTask.assigned_employee?.name ?? 'Unassigned'}</strong>
                    </div>
                    <div>
                      <span className="text-meta">Assigned By: </span>
                      <strong>{selectedTask.creator?.name ?? 'System Admin'}</strong>
                    </div>
                    <div>
                      <span className="text-meta">Assigned Time: </span>
                      <strong>{selectedTask.created_at ? format(parseISO(selectedTask.created_at), 'dd MMM yyyy, hh:mm a') : '—'}</strong>
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
                    </div>

                    <div>
                      {selectedTask.description ? (
                        <div style={{ fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', background: '#fff', padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}>
                          {selectedTask.description}
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '6px 0' }}>
                          No instructions provided yet.
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
                  </div>
                </>
              )}

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
                    {selectedTask.updates.map((u) => {
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
                                  {savingLog ? 'Saving...' : 'Save Changes'}
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

      {/* Task Deletion Confirmation Modal */}
      {taskToDelete && (
        <div className="modal-backdrop" onClick={() => setTaskToDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, width: '100%' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontWeight: 700, fontSize: 16 }}>
                <AlertTriangle size={18} /> Confirm Task Deletion
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setTaskToDelete(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px 4px', fontSize: 14, color: 'var(--text-primary)' }}>
              Are you sure you want to delete technical task <strong>{taskToDelete.title}</strong>? All progress updates and attached deliverable records will be permanently removed.
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setTaskToDelete(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => handleDeleteTask(taskToDelete.id)}
                disabled={deletingTask}
                style={{ background: 'var(--danger)', color: '#fff', border: 'none', fontWeight: 600, padding: '6px 16px' }}
              >
                {deletingTask ? 'Deleting...' : 'Yes, Delete Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
