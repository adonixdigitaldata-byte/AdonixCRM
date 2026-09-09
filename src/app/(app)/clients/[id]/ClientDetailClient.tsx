'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  ExternalLink,
  Lock,
  User,
  Folder,
  Calendar,
  AlertTriangle,
  Globe,
  FileText,
  CheckCircle,
  Facebook,
  Instagram,
  Video,
  Save,
  Shield,
  Users2,
  Layers,
  X,
  Search,
  Building2,
  Mail,
  Phone,
  MapPin,
  Copy,
  Check,
  Send,
} from 'lucide-react'

interface Props {
  client: any
  profiles: { id: string; name: string; email?: string; role?: string; specialization?: string; work_status?: string }[]
  tasks?: any[]
  invoices: any[]
  quotations: any[]
  currentProfile?: any
}

const MONTHS_LIST = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const MONTH_MAP: Record<string, number> = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
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

export default function ClientDetailClient({ client, profiles, tasks = [], invoices, quotations, currentProfile }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState('')

  // Item delete confirmation modal state
  const [itemToDelete, setItemToDelete] = useState<{ id: string; label: string; typeName: string; onDelete: () => void } | null>(null)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)
  const [toastFeedback, setToastFeedback] = useState<{ message: string; type: 'success' | 'danger' } | null>(null)

  function showFeedback(message: string, type: 'success' | 'danger' = 'success') {
    setToastFeedback({ message, type })
    setTimeout(() => setToastFeedback(null), 3000)
  }

  function triggerAnimatedDelete(id: string, deleteCallback: () => void, label: string) {
    setDeletingItemId(id)
    setTimeout(() => {
      deleteCallback()
      setDeletingItemId(null)
      showFeedback(`✓ ${label} deleted successfully`)
    }, 250)
  }

  // Delete client modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingClient, setDeletingClient] = useState(false)

  async function handleDeleteClient() {
    if (deletingClient) return
    setDeletingClient(true)
    try {
      await supabase.from('client_tasks').delete().eq('client_id', client.id)
      await supabase.from('invoices').delete().eq('client_id', client.id)
      await supabase.from('quotations').delete().eq('client_id', client.id)
      await supabase.from('client_assets').delete().eq('client_id', client.id)

      const { error: err } = await supabase.from('clients').delete().eq('id', client.id)
      if (err) throw err

      router.push('/clients')
    } catch (e: any) {
      alert(e.message || 'Failed to delete client')
      setDeletingClient(false)
    }
  }

  // Client Technical Tasks State
  const [clientTasks, setClientTasks] = useState<any[]>(tasks)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskEmployeeId, setTaskEmployeeId] = useState('')
  const [taskCategory, setTaskCategory] = useState('WEBSITE')
  const [taskPriority, setTaskPriority] = useState('MEDIUM')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskLink, setTaskLink] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [submittingTask, setSubmittingTask] = useState(false)

  // State for all editable client fields
  const [clientName, setClientName] = useState(client.name ?? '')
  const [companyName, setCompanyName] = useState(client.company ?? '')
  const [clientEmail, setClientEmail] = useState(client.email ?? '')
  const [clientPhone, setClientPhone] = useState(client.phone ?? '')
  const [clientAddress, setClientAddress] = useState(client.address ?? '')

  const [agentId, setAgentId] = useState(client.assigned_agent_id ?? '')
  const [clientStatus, setClientStatus] = useState(client.client_status ?? 'ACTIVE')
  const [industry, setIndustry] = useState(client.industry ?? '')
  const [billingCycle, setBillingCycle] = useState(client.billing_cycle ?? 'NONE')
  const [billingAmount, setBillingAmount] = useState(Number(client.billing_amount) || 0)
  const [contractStartDate, setContractStartDate] = useState(client.contract_start_date ?? '')
  const [contractEndDate, setContractEndDate] = useState(client.contract_end_date ?? '')

  // GMB & Brand Assets (keep as single links)
  const [gmbUrl, setGmbUrl] = useState(client.gmb_url ?? '')
  const [brandAssetsLink, setBrandAssetsLink] = useState(client.brand_assets_link ?? '')

  // Social Links
  const [facebookUrl, setFacebookUrl] = useState(client.facebook_url ?? '')
  const [instagramUrl, setInstagramUrl] = useState(client.instagram_url ?? '')
  const [tiktokUrl, setTiktokUrl] = useState(client.tiktok_url ?? '')

  // Multiple Websites List (Serialized to client.website_url)
  const getInitialWebsites = () => {
    try {
      if (client.website_url && client.website_url.startsWith('[')) {
        return JSON.parse(client.website_url)
      }
    } catch (e) {}
    return client.website_url ? [{ id: 'primary', name: 'Primary Website', url: client.website_url }] : []
  }
  const [websites, setWebsites] = useState<{ id: string; name: string; url: string }[]>(getInitialWebsites())
  const [newWebName, setNewWebName] = useState('')
  const [newWebUrl, setNewWebUrl] = useState('')
  const [webValidationError, setWebValidationError] = useState('')

  // Multiple Monthly Reports List (with Month + Year selector)
  const getInitialReports = () => {
    try {
      if (client.report_link && client.report_link.startsWith('[')) {
        return JSON.parse(client.report_link)
      }
    } catch (e) {}
    return client.report_link ? [{ id: 'primary', month: 'January', year: '2026', url: client.report_link }] : []
  }
  const [monthlyReports, setMonthlyReports] = useState<{ id: string; month: string; year: string; url: string }[]>(getInitialReports())
  const [newRepMonth, setNewRepMonth] = useState('January')
  const [newRepYear, setNewRepYear] = useState('2026')
  const [newRepUrl, setNewRepUrl] = useState('')
  const [repValidationError, setRepValidationError] = useState('')

  // Unique years of reports for tab view filtering
  const reportYears = Array.from(new Set(monthlyReports.map((r) => r.year || '2026'))).sort((a, b) => b.localeCompare(a))
  const [reportViewYear, setReportViewYear] = useState(reportYears[0] ?? '2026')
  const [isReportsExpanded, setIsReportsExpanded] = useState(true)

  // Multiple Notes Timeline List (Serialized to client.notes)
  const getInitialNotesList = () => {
    try {
      if (client.notes && client.notes.startsWith('[')) {
        return JSON.parse(client.notes)
      }
    } catch (e) {}
    return client.notes ? [{ id: 'legacy', body: client.notes, created_at: client.created_at || new Date().toISOString() }] : []
  }
  const [notesList, setNotesList] = useState<{ id: string; body: string; created_at: string }[]>(getInitialNotesList())
  const [newNoteBody, setNewNoteBody] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteBody, setEditingNoteBody] = useState('')

  // JSONB List States
  const [credentials, setCredentials] = useState<any[]>(client.credentials ?? [])
  const [serviceLinks, setServiceLinks] = useState<any[]>(client.service_links ?? [])
  const [secondaryContacts, setSecondaryContacts] = useState<any[]>(client.secondary_contacts ?? [])

  // Password Visibility toggler state
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})

  // Form togglers (when list is filled, CTA button toggles form)
  const [showAddCred, setShowAddCred] = useState(false)
  const [showAddLink, setShowAddLink] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)

  // Form inputs for adding items
  const [newCred, setNewCred] = useState({ id: '', service: '', url: '', username: '', password: '', notes: '' })
  const [newContact, setNewContact] = useState({ id: '', name: '', role: '', email: '', phone: '' })
  const [newLink, setNewLink] = useState({ id: '', label: '', url: '', notes: '' })

  // Inline editing states for Custom Service Links
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null)
  const [editLinkLabel, setEditLinkLabel] = useState('')
  const [editLinkUrl, setEditLinkUrl] = useState('')
  const [editLinkNotes, setEditLinkNotes] = useState('')

  // Inline editing states for Credentials
  const [editingCredId, setEditingCredId] = useState<string | null>(null)
  const [editCredService, setEditCredService] = useState('')
  const [editCredUrl, setEditCredUrl] = useState('')
  const [editCredUsername, setEditCredUsername] = useState('')
  const [editCredPassword, setEditCredPassword] = useState('')
  const [editCredNotes, setEditCredNotes] = useState('')

  // Inline editing states for Secondary Contacts
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [editContactName, setEditContactName] = useState('')
  const [editContactRole, setEditContactRole] = useState('')
  const [editContactEmail, setEditContactEmail] = useState('')
  const [editContactPhone, setEditContactPhone] = useState('')

  // Inline editing states for Websites
  const [editingWebsiteId, setEditingWebsiteId] = useState<string | null>(null)
  const [editWebName, setEditWebName] = useState('')
  const [editWebUrl, setEditWebUrl] = useState('')

  // Inline editing states for Monthly Reports
  const [editingReportId, setEditingReportId] = useState<string | null>(null)
  const [editRepMonth, setEditRepMonth] = useState('January')
  const [editRepYear, setEditRepYear] = useState('2026')
  const [editRepUrl, setEditRepUrl] = useState('')

  // Search & Pagination States
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [invoicePage, setInvoicePage] = useState(1)
  const [quoteSearch, setQuoteSearch] = useState('')
  const [quotePage, setQuotePage] = useState(1)

  const [credSearch, setCredSearch] = useState('')
  const [credPage, setCredPage] = useState(1)

  const [linkSearch, setLinkSearch] = useState('')
  const [linkPage, setLinkPage] = useState(1)

  const [noteSearch, setNoteSearch] = useState('')
  const [notePage, setNotePage] = useState(1)

  const [taskSearch, setTaskSearch] = useState('')
  const [taskPage, setTaskPage] = useState(1)

  // Client Portal Reset Password Link Sender State
  const [accessLoading, setAccessLoading] = useState(false)
  const [accessSuccess, setAccessSuccess] = useState('')
  const [accessError, setAccessError] = useState('')

  async function handleSendPasswordResetLink() {
    const targetEmail = clientEmail || client.email
    if (!targetEmail || !targetEmail.trim()) {
      setAccessError('Client email is required to send password reset link')
      return
    }
    setAccessLoading(true)
    setAccessError('')
    setAccessSuccess('')

    try {
      const res = await fetch('/api/agents/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail.trim(),
          name: clientName || client.name,
          mode: 'forgot',
          role: 'CLIENT',
          clientId: client.id,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send password reset link')
      }

      setAccessSuccess(`Password reset email link sent to ${targetEmail}!`)
    } catch (e: any) {
      setAccessError(e.message || 'Failed to send password reset link')
    } finally {
      setAccessLoading(false)
    }
  }

  const itemsPerPage = 5

  function canDeleteTask(task: any, profile: any): boolean {
    if (!profile) return false
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

  async function deleteTask(taskId: string) {
    const targetTask = clientTasks.find((t) => t.id === taskId)
    if (targetTask && !canDeleteTask(targetTask, currentProfile)) {
      showFeedback('Permission denied: Account Managers cannot delete tasks assigned to Admins or Account Managers.', 'danger')
      return
    }
    try {
      const { error } = await supabase.from('client_tasks').delete().eq('id', taskId)
      if (error) throw error
      setClientTasks((prev) => prev.filter((t) => t.id !== taskId))
    } catch (err: any) {
      showFeedback(err.message || 'Failed to delete task', 'danger')
    }
  }

  const [copiedId, setCopiedId] = useState<string | null>(null)
  function handleCopyText(text: string, id: string) {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  // Financial calculations
  const totalQuotedAmount = quotations.reduce((sum, q) => sum + convertToSAR(Number(q.total), q.currency), 0)
  const totalInvoiced = invoices.reduce((sum, inv) => sum + convertToSAR(Number(inv.total), inv.currency), 0)
  const totalEarned = invoices.reduce((sum, inv) => sum + convertToSAR(Number(inv.amount_paid), inv.currency), 0)
  const outstandingBalance = totalInvoiced - totalEarned

  const overdueInvoices = invoices.filter((inv) => inv.status === 'OVERDUE')
  const overdueAmount = overdueInvoices.reduce(
    (sum, inv) => sum + convertToSAR(Number(inv.total) - Number(inv.amount_paid), inv.currency),
    0
  )

  const acceptedQuotations = quotations.filter((q) => q.status === 'ACCEPTED').length
  const acceptanceRate = quotations.length > 0 ? (acceptedQuotations / quotations.length) * 100 : 0

  // Alert calculations for expiring contracts
  const today = new Date()
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const hasContractEnd = !!contractEndDate
  // Only alert for active recurring contracts (e.g. Monthly). Do not alert for One-Time retainers.
  const isContractActive = billingCycle === 'MONTHLY'
  const isContractExpired = isContractActive && hasContractEnd && new Date(contractEndDate) < today
  const isContractExpiringSoon =
    isContractActive &&
    hasContractEnd &&
    !isContractExpired &&
    new Date(contractEndDate) >= today &&
    new Date(contractEndDate) <= thirtyDaysFromNow

  // Handlers for Credentials
  function addCredential() {
    if (!newCred.service) return
    const item = { ...newCred, id: Math.random().toString(36).slice(2) }
    setCredentials([...credentials, item])
    setNewCred({ id: '', service: '', url: '', username: '', password: '', notes: '' })
    setShowAddCred(false)
  }

  function startEditCred(cred: any) {
    setEditingCredId(cred.id)
    setEditCredService(cred.service)
    setEditCredUrl(cred.url ?? '')
    setEditCredUsername(cred.username ?? '')
    setEditCredPassword(cred.password ?? '')
    setEditCredNotes(cred.notes ?? '')
  }

  function saveEditedCred() {
    if (!editCredService) return
    setCredentials(
      credentials.map((c) =>
        c.id === editingCredId
          ? { ...c, service: editCredService, url: editCredUrl, username: editCredUsername, password: editCredPassword, notes: editCredNotes }
          : c
      )
    )
    setEditingCredId(null)
  }

  async function deleteCredential(id: string) {
    const updated = credentials.filter((c) => c.id !== id)
    setCredentials(updated)
    await supabase.from('clients').update({ credentials: updated }).eq('id', client.id)
  }

  // Handlers for Secondary Contacts
  function addSecondaryContact() {
    if (!newContact.name) return
    const item = { ...newContact, id: Math.random().toString(36).slice(2) }
    setSecondaryContacts([...secondaryContacts, item])
    setNewContact({ id: '', name: '', role: '', email: '', phone: '' })
    setShowAddContact(false)
  }

  function startEditContact(contact: any) {
    setEditingContactId(contact.id)
    setEditContactName(contact.name)
    setEditContactRole(contact.role ?? '')
    setEditContactEmail(contact.email ?? '')
    setEditContactPhone(contact.phone ?? '')
  }

  function saveEditedContact() {
    if (!editContactName) return
    setSecondaryContacts(
      secondaryContacts.map((c) =>
        c.id === editingContactId
          ? { ...c, name: editContactName, role: editContactRole, email: editContactEmail, phone: editContactPhone }
          : c
      )
    )
    setEditingContactId(null)
  }

  async function deleteSecondaryContact(id: string) {
    const updated = secondaryContacts.filter((c) => c.id !== id)
    setSecondaryContacts(updated)
    await supabase.from('clients').update({ secondary_contacts: updated }).eq('id', client.id)
  }

  // Handlers for Custom Links
  function addServiceLink() {
    if (!newLink.label || !newLink.url) return
    const item = { ...newLink, id: Math.random().toString(36).slice(2) }
    setServiceLinks([...serviceLinks, item])
    setNewLink({ id: '', label: '', url: '', notes: '' })
    setShowAddLink(false)
  }

  async function deleteServiceLink(id: string) {
    const updated = serviceLinks.filter((l) => l.id !== id)
    setServiceLinks(updated)
    await supabase.from('clients').update({ service_links: updated }).eq('id', client.id)
  }

  function togglePassword(id: string) {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function startEditLink(link: any) {
    setEditingLinkId(link.id)
    setEditLinkLabel(link.label)
    setEditLinkUrl(link.url)
    setEditLinkNotes(link.notes ?? '')
  }

  function saveEditedLink() {
    if (!editLinkLabel || !editLinkUrl) return
    setServiceLinks(
      serviceLinks.map((l) =>
        l.id === editingLinkId
          ? { ...l, label: editLinkLabel, url: editLinkUrl, notes: editLinkNotes }
          : l
      )
    )
    setEditingLinkId(null)
  }

  // Multiple Websites handlers
  function addWebsite() {
    setWebValidationError('')
    if (!newWebName.trim() || !newWebUrl.trim()) return

    // Duplicates validation
    const hasDup = websites.some(
      (w) => w.name.toLowerCase() === newWebName.trim().toLowerCase() || w.url.toLowerCase() === newWebUrl.trim().toLowerCase()
    )
    if (hasDup) {
      setWebValidationError('Website name or URL already exists.')
      return
    }

    const url = newWebUrl.startsWith('http') ? newWebUrl : `https://${newWebUrl}`
    setWebsites([...websites, { id: Math.random().toString(36).slice(2), name: newWebName.trim(), url }])
    setNewWebName('')
    setNewWebUrl('')
  }

  function startEditWebsite(w: any) {
    setEditingWebsiteId(w.id)
    setEditWebName(w.name)
    setEditWebUrl(w.url)
  }

  // Save website
  function saveEditedWebsite() {
    if (!editWebName.trim() || !editWebUrl.trim()) return
    const url = editWebUrl.startsWith('http') ? editWebUrl : `https://${editWebUrl}`
    setWebsites(
      websites.map((w) =>
        w.id === editingWebsiteId ? { ...w, name: editWebName.trim(), url } : w
      )
    )
    setEditingWebsiteId(null)
  }

  async function deleteWebsite(id: string) {
    const updated = websites.filter((w) => w.id !== id)
    setWebsites(updated)
    await supabase.from('clients').update({ website_url: JSON.stringify(updated) }).eq('id', client.id)
  }

  // Multiple Reports handlers
  function addReport() {
    setRepValidationError('')
    if (!newRepMonth || !newRepYear || !newRepUrl.trim()) return

    // Duplicates validation
    const hasDup = monthlyReports.some(
      (r) => r.month === newRepMonth && r.year === newRepYear
    )
    if (hasDup) {
      setRepValidationError(`Report for ${newRepMonth} ${newRepYear} already exists.`)
      return
    }

    const url = newRepUrl.trim().startsWith('http') ? newRepUrl.trim() : `https://${newRepUrl.trim()}`
    setMonthlyReports([...monthlyReports, { id: Math.random().toString(36).slice(2), month: newRepMonth, year: newRepYear, url }])
    setNewRepUrl('')
    setReportViewYear(newRepYear) // auto-switch view to added report's year
    setIsReportsExpanded(true)
  }

  function startEditReport(r: any) {
    setEditingReportId(r.id)
    setEditRepMonth(r.month)
    setEditRepYear(r.year ?? '2026')
    setEditRepUrl(r.url)
  }

  function saveEditedReport() {
    if (!editRepUrl.trim()) return
    const url = editRepUrl.trim().startsWith('http') ? editRepUrl.trim() : `https://${editRepUrl.trim()}`
    setMonthlyReports(
      monthlyReports.map((r) =>
        r.id === editingReportId ? { ...r, month: editRepMonth, year: editRepYear, url } : r
      )
    )
    setEditingReportId(null)
  }

  async function deleteReport(id: string) {
    const updated = monthlyReports.filter((r) => r.id !== id)
    setMonthlyReports(updated)

    // Reset filtered tab if deleted last item for that year
    const remainingYears = Array.from(new Set(updated.map((r) => r.year || '2026')))
    if (remainingYears.length > 0 && !remainingYears.includes(reportViewYear)) {
      setReportViewYear(remainingYears[0])
    }
    await supabase.from('clients').update({ report_link: updated.length > 0 ? JSON.stringify(updated) : null }).eq('id', client.id)
  }

  // Multiple Notes Timeline handlers
  async function addNote() {
    if (!newNoteBody.trim()) return
    const item = {
      id: Math.random().toString(36).slice(2),
      body: newNoteBody.trim(),
      created_at: new Date().toISOString(),
    }
    const updated = [item, ...notesList]
    setNotesList(updated) // Newest note on top
    setNewNoteBody('')
    await supabase.from('clients').update({ notes: JSON.stringify(updated) }).eq('id', client.id)
  }

  async function deleteNote(id: string) {
    const updated = notesList.filter((n) => n.id !== id)
    setNotesList(updated)
    await supabase.from('clients').update({ notes: updated.length > 0 ? JSON.stringify(updated) : null }).eq('id', client.id)
  }

  // Edit notes
  function startEditNote(note: any) {
    setEditingNoteId(note.id)
    setEditingNoteBody(note.body)
  }

  async function saveEditedNote() {
    if (!editingNoteBody.trim()) return
    const updated = notesList.map((n) =>
      n.id === editingNoteId ? { ...n, body: editingNoteBody.trim() } : n
    )
    setNotesList(updated)
    setEditingNoteId(null)
    await supabase.from('clients').update({ notes: JSON.stringify(updated) }).eq('id', client.id)
  }

  // Database Save Handler
  async function handleSaveChanges() {
    if (!clientName.trim()) {
      setError('Client Name is required')
      return
    }

    setSaving(true)
    setError('')
    setSaveSuccess(false)

    try {
      const { error: err } = await supabase
        .from('clients')
        .update({
          name: clientName.trim(),
          company: companyName.trim() || null,
          email: clientEmail.trim() || null,
          phone: clientPhone.trim() || null,
          address: clientAddress.trim() || null,
          assigned_agent_id: agentId || null,
          client_status: clientStatus,
          industry: industry || null,
          billing_cycle: billingCycle,
          billing_amount: billingAmount,
          contract_start_date: contractStartDate || null,
          contract_end_date: contractEndDate || null,
          website_url: websites.length > 0 ? JSON.stringify(websites) : null,
          report_link: monthlyReports.length > 0 ? JSON.stringify(monthlyReports) : null,
          gmb_url: gmbUrl || null,
          brand_assets_link: brandAssetsLink || null,
          facebook_url: facebookUrl || null,
          instagram_url: instagramUrl || null,
          tiktok_url: tiktokUrl || null,
          credentials,
          service_links: serviceLinks,
          secondary_contacts: secondaryContacts,
          notes: notesList.length > 0 ? JSON.stringify(notesList) : null,
        })
        .eq('id', client.id)

      if (err) throw err

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (e: any) {
      setError(e.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  // Chronologically sort monthly reports (Year desc, Month desc)
  const sortedReports = [...monthlyReports].sort((a, b) => {
    const yA = Number(a.year) || 2026
    const yB = Number(b.year) || 2026
    if (yA !== yB) return yB - yA
    const mA = MONTH_MAP[a.month] ?? -1
    const mB = MONTH_MAP[b.month] ?? -1
    return mB - mA
  })

  // Filter sorted reports to only show the selected view year
  const displayedReports = sortedReports.filter((r) => (r.year || '2026') === reportViewYear)

  // Filter & Paginate Invoices
  const filteredInvoices = invoices.filter((inv) => {
    const query = invoiceSearch.toLowerCase().trim()
    return !query || inv.invoice_number.toLowerCase().includes(query) || inv.status.toLowerCase().includes(query)
  })
  const totalInvoicesPages = Math.ceil(filteredInvoices.length / itemsPerPage) || 1
  const paginatedInvoices = filteredInvoices.slice((invoicePage - 1) * itemsPerPage, invoicePage * itemsPerPage)

  // Filter & Paginate Quotations
  const filteredQuotations = quotations.filter((q) => {
    const query = quoteSearch.toLowerCase().trim()
    return !query || q.quote_number.toLowerCase().includes(query) || q.status.toLowerCase().includes(query)
  })
  const totalQuotationsPages = Math.ceil(filteredQuotations.length / itemsPerPage) || 1
  const paginatedQuotations = filteredQuotations.slice((quotePage - 1) * itemsPerPage, quotePage * itemsPerPage)

  // Filter & Paginate Credentials
  const filteredCredentials = credentials.filter((c) => {
    const query = credSearch.toLowerCase().trim()
    return !query || (c.service ?? '').toLowerCase().includes(query) || (c.username ?? '').toLowerCase().includes(query) || (c.notes ?? '').toLowerCase().includes(query)
  })
  const totalCredPages = Math.ceil(filteredCredentials.length / itemsPerPage) || 1
  const paginatedCredentials = filteredCredentials.slice((credPage - 1) * itemsPerPage, credPage * itemsPerPage)

  // Filter & Paginate Deliverables (serviceLinks)
  const filteredServiceLinks = serviceLinks.filter((l) => {
    const query = linkSearch.toLowerCase().trim()
    return !query || (l.label ?? '').toLowerCase().includes(query) || (l.url ?? '').toLowerCase().includes(query) || (l.notes ?? '').toLowerCase().includes(query)
  })
  const totalLinkPages = Math.ceil(filteredServiceLinks.length / itemsPerPage) || 1
  const paginatedServiceLinks = filteredServiceLinks.slice((linkPage - 1) * itemsPerPage, linkPage * itemsPerPage)

  // Filter & Paginate Notes
  const filteredNotesList = notesList.filter((n) => {
    const query = noteSearch.toLowerCase().trim()
    return !query || (n.body ?? '').toLowerCase().includes(query)
  })
  const totalNotePages = Math.ceil(filteredNotesList.length / itemsPerPage) || 1
  const paginatedNotesList = filteredNotesList.slice((notePage - 1) * itemsPerPage, notePage * itemsPerPage)

  // Filter & Paginate Client Technical Tasks
  const filteredClientTasks = clientTasks.filter((t) => {
    const query = taskSearch.toLowerCase().trim()
    return !query || (t.title ?? '').toLowerCase().includes(query) || (t.category ?? '').toLowerCase().includes(query) || (t.assigned_employee?.name ?? '').toLowerCase().includes(query) || (t.status ?? '').toLowerCase().includes(query)
  })
  const totalTaskPages = Math.ceil(filteredClientTasks.length / itemsPerPage) || 1
  const paginatedClientTasks = filteredClientTasks.slice((taskPage - 1) * itemsPerPage, taskPage * itemsPerPage)

  return (
    <div>
      {/* Bulletproof sticky page header with Save changes CTA */}
      <div className="page-header no-print" style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        width: '100%',
        boxSizing: 'border-box',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => router.push('/clients')}
            style={{ flexShrink: 0, width: 32, height: 32, padding: 0, justifyContent: 'center' }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>{clientName}</h1>
            <p className="text-meta" style={{ marginTop: 2, margin: 0, fontSize: 12 }}>
              {companyName ? `${companyName} · ` : ''}Client Profile Portal
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {saveSuccess && <span style={{ color: 'var(--success)', fontSize: 12, fontWeight: 600 }}>✓ Saved</span>}
          {error && <span style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 500 }}>✕ {error}</span>}

          <button className="btn btn-primary btn-sm" onClick={handleSaveChanges} disabled={saving} style={{ display: 'inline-flex', gap: 6, fontWeight: 600 }}>
            <Save size={14} />
            {saving ? 'Saving...' : 'Save changes'}
          </button>

          {(currentProfile?.role === 'ADMIN' || currentProfile?.role === 'ACCOUNT_MANAGER') && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setShowDeleteModal(true)}
              style={{ color: 'var(--danger)', borderColor: '#FCA5A5' }}
            >
              <Trash2 size={14} /> Delete Client
            </button>
          )}
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 160 }}>
        {/* Expired/Expiring Contract Banners */}
        {isContractExpired && (
          <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={16} />
            <div>
              <strong>Contract Expired:</strong> This client's retainer agreement ended on{' '}
              {format(new Date(contractEndDate), 'dd MMMM yyyy')}. Please renew.
            </div>
          </div>
        )}
        {isContractExpiringSoon && (
          <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={16} />
            <div>
              <strong>Contract Expiring Soon:</strong> Retainer ends in{' '}
              {Math.ceil((new Date(contractEndDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))} days (on{' '}
              {format(new Date(contractEndDate), 'dd MMMM yyyy')}).
            </div>
          </div>
        )}

        {/* Financial Metrics Summary */}
        <div className="rg-stats">
          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Total Quoted</span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: '#2563eb' }}>
              SAR {totalQuotedAmount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {quotations.length} {quotations.length === 1 ? 'quotation' : 'quotations'}
            </div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Total Invoiced</span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
              SAR {totalInvoiced.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'}
            </div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>Earned Revenue</span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--success)' }}>
              SAR {totalEarned.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: outstandingBalance > 0 ? 'var(--warning)' : 'var(--text-secondary)', fontWeight: 500 }}>
              Outstanding Balance
            </span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: outstandingBalance > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
              SAR {outstandingBalance.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          {overdueAmount > 0 && (
            <div className="card" style={{ padding: '14px 16px' }}>
              <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>Overdue Amount</span>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--danger)' }}>
                SAR {overdueAmount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          )}
          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Quote Acceptance Rate</span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
              {acceptanceRate.toFixed(0)}% <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>({acceptedQuotations} of {quotations.length})</span>
            </div>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="rg-lead-detail">
          {/* Main Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Technical Tasks & Deliverables Section */}
            <div className="card">
              <div className="card-header flex items-center justify-between" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={16} color="var(--accent)" />
                  <span className="text-section-header">Technical Tasks &amp; Deliverables</span>
                  <span className="badge" style={{ background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: 11 }}>
                    {clientTasks.filter((t) => t.status === 'COMPLETED').length} of {clientTasks.length} Completed
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {clientTasks.length > 0 && (
                    <div style={{ position: 'relative' }}>
                      <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                      <input
                        className="form-input"
                        placeholder="Search tasks..."
                        value={taskSearch}
                        onChange={(e) => { setTaskSearch(e.target.value); setTaskPage(1); }}
                        style={{ fontSize: 11, padding: '3px 8px 3px 24px', width: 140 }}
                      />
                    </div>
                  )}
                  {(currentProfile?.role === 'ADMIN' || currentProfile?.role === 'ACCOUNT_MANAGER') && (
                    <button
                      className="btn btn-primary btn-xs"
                      onClick={() => setShowTaskModal(true)}
                    >
                      <Plus size={12} /> Add Technical Task
                    </button>
                  )}
                </div>
              </div>

              <div className="card-body" style={{ padding: 0 }}>
                {filteredClientTasks.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                    {taskSearch ? 'No tasks match search query.' : 'No technical tasks assigned for this client yet. Click "+ Add Technical Task" above to assign deliverables.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {paginatedClientTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => router.push(`/tasks?taskId=${t.id}`)}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--border)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12,
                          flexWrap: 'wrap',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover, #F8FAFC)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'normal', minWidth: 0 }}>
                            {t.title}
                            <ExternalLink size={11} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: '#EFF6FF', color: '#2563EB' }}>
                              {t.category}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              Specialist: <strong>{t.assigned_employee?.name ?? 'Unassigned'}</strong>
                            </span>
                            {t.due_date && (
                              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                Target: {t.due_date}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={(e) => e.stopPropagation()}>
                          {t.deliverable_link && (
                            <a
                              href={t.deliverable_link}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-outline btn-xs"
                              style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}
                            >
                              Folder <ExternalLink size={10} />
                            </a>
                          )}

                          <select
                            className="form-select"
                            value={t.status}
                            onChange={async (e) => {
                              const newStatus = e.target.value
                              setClientTasks(clientTasks.map((item) => item.id === t.id ? { ...item, status: newStatus } : item))
                              await supabase.from('client_tasks').update({ status: newStatus }).eq('id', t.id)
                            }}
                            style={{
                              padding: '2px 6px', fontSize: 11, fontWeight: 600,
                              background: t.status === 'COMPLETED' ? '#DCFCE7' : t.status === 'IN_PROGRESS' ? '#EFF6FF' : '#F4F4F5',
                              color: t.status === 'COMPLETED' ? '#15803D' : t.status === 'IN_PROGRESS' ? '#1D4ED8' : '#52525B',
                              border: 'none', borderRadius: 4
                            }}
                          >
                            <option value="PENDING">To Do</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="UNDER_REVIEW">Under Review</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="BLOCKED">Blocked</option>
                          </select>

                          {canDeleteTask(t, currentProfile) && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon btn-xs"
                              onClick={() => setItemToDelete({ id: t.id, label: t.title, typeName: 'Technical Task', onDelete: () => deleteTask(t.id) })}
                              style={{ color: 'var(--danger)' }}
                              title="Delete Technical Task"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <ClientPagination
                      currentPage={taskPage}
                      totalItems={filteredClientTasks.length}
                      pageSize={itemsPerPage}
                      onPageChange={setTaskPage}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ADD TECHNICAL TASK MODAL FOR THIS CLIENT */}
            {showTaskModal && (
              <div className="modal-backdrop" onClick={() => setShowTaskModal(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
                  <div className="modal-header">
                    <span className="text-section-header">Assign Technical Task for {clientName}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowTaskModal(false)}>
                      <X size={16} />
                    </button>
                  </div>
                  <form onSubmit={async (e) => {
                    e.preventDefault()
                    if (!taskTitle.trim() || submittingTask) return
                    setSubmittingTask(true)
                    try {
                      const { data, error: err } = await supabase
                        .from('client_tasks')
                        .insert({
                          client_id: client.id,
                          assigned_employee_id: taskEmployeeId || null,
                          created_by: currentProfile?.id || null,
                          title: taskTitle.trim(),
                          category: taskCategory,
                          priority: taskPriority,
                          due_date: taskDueDate || null,
                          deliverable_link: taskLink.trim() || null,
                          description: taskDescription.trim() || null,
                          status: 'PENDING',
                        })
                        .select(`
                          *,
                          assigned_employee:profiles!assigned_employee_id(id, name, email, role, specialization, work_status)
                        `)
                        .single()

                      if (err) throw err
                      setClientTasks([data, ...clientTasks])
                      setShowTaskModal(false)
                      setTaskTitle('')
                      setTaskEmployeeId('')
                      setTaskDescription('')
                      setTaskLink('')
                    } catch (errEx: any) {
                      alert(errEx.message || 'Failed to create task')
                    } finally {
                      setSubmittingTask(false)
                    }
                  }}>
                    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label form-label-required">Task / Deliverable Title</label>
                        <input
                          className="form-input"
                          placeholder="e.g. Next.js Website Setup, 12 AI Reels, GMB Optimization"
                          value={taskTitle}
                          onChange={(e) => setTaskTitle(e.target.value)}
                          required
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ flex: '1 1 180px' }}>
                          <label className="form-label">Category</label>
                          <select
                            className="form-select"
                            value={taskCategory}
                            onChange={(e) => setTaskCategory(e.target.value)}
                          >
                            <option value="WEBSITE">🌐 Website Dev</option>
                            <option value="SOCIAL_MEDIA">📱 Social Media</option>
                            <option value="ADS">🎯 Paid Ads</option>
                            <option value="GMB">📍 GMB & SEO</option>
                            <option value="VIDEO_AI">🎬 Video / AI</option>
                            <option value="DESIGN">🎨 Design</option>
                            <option value="SEO">🚀 Organic SEO</option>
                            <option value="OTHER">📋 General</option>
                          </select>
                        </div>

                        <div className="form-group" style={{ flex: '1 1 180px' }}>
                          <label className="form-label">Assign Specialist / Employee</label>
                          <select
                            className="form-select"
                            value={taskEmployeeId}
                            onChange={(e) => setTaskEmployeeId(e.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {profiles.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.specialization || p.role}) {p.work_status === 'BUSY' ? ' (Busy)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ flex: '1 1 180px' }}>
                          <label className="form-label">Priority</label>
                          <select
                            className="form-select"
                            value={taskPriority}
                            onChange={(e) => setTaskPriority(e.target.value)}
                          >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                            <option value="URGENT">Urgent</option>
                          </select>
                        </div>

                        <div className="form-group" style={{ flex: '1 1 180px' }}>
                          <label className="form-label">Target Due Date</label>
                          <input
                            type="date"
                            className="form-input"
                            value={taskDueDate}
                            onChange={(e) => setTaskDueDate(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Deliverable Folder / URL (Optional)</label>
                        <input
                          className="form-input"
                          placeholder="https://drive.google.com/... or Figma link"
                          value={taskLink}
                          onChange={(e) => setTaskLink(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Instructions / Guidelines</label>
                        <textarea
                          className="form-input"
                          rows={2}
                          placeholder="Instructions for the assigned technical employee..."
                          value={taskDescription}
                          onChange={(e) => setTaskDescription(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowTaskModal(false)}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary btn-sm" disabled={submittingTask}>
                        {submittingTask ? 'Creating...' : 'Assign Task'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            
            {/* Credentials Vault */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div className="flex items-center gap-2">
                  <Shield size={16} style={{ color: 'var(--text-secondary)' }} />
                  <span className="text-section-header">Credentials &amp; Logins Vault</span>
                </div>
                <div className="search-input-wrapper" style={{ position: 'relative', width: 220 }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search credentials..."
                    value={credSearch}
                    onChange={(e) => {
                      setCredSearch(e.target.value)
                      setCredPage(1)
                    }}
                    style={{ paddingLeft: 30, fontSize: 12, paddingTop: 4, paddingBottom: 4 }}
                  />
                </div>
              </div>

              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredCredentials.length === 0 ? (
                  <p className="text-meta" style={{ padding: '8px 0' }}>{credSearch ? 'No credentials match search' : 'No credentials stored for this client.'}</p>
                ) : (
                  <>
                    <div className="table-wrapper" style={{ width: '100%', overflowX: 'hidden' }}>
                      <table className="table table-compact" style={{ width: '100%', tableLayout: 'fixed' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '18%' }}>Service</th>
                            <th style={{ width: '22%' }}>Username</th>
                            <th style={{ width: '20%' }}>Password</th>
                            <th style={{ width: '18%' }}>Login URL</th>
                            <th style={{ width: '22%' }}>Notes</th>
                            <th style={{ width: '90px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedCredentials.map((cred) => {
                            const isEditing = editingCredId === cred.id
                            const isDeletingThis = deletingItemId === cred.id
                            return (
                              <tr
                                key={cred.id}
                                style={{
                                  transition: 'all 0.25s ease-out',
                                  opacity: isDeletingThis ? 0 : 1,
                                  transform: isDeletingThis ? 'scale(0.96)' : 'none',
                                  background: isDeletingThis ? '#FEF2F2' : undefined,
                                }}
                              >
                                {isEditing ? (
                                  <>
                                    <td>
                                      <input
                                        className="form-input"
                                        value={editCredService}
                                        onChange={(e) => setEditCredService(e.target.value)}
                                        style={{ fontSize: 12, padding: '4px 8px' }}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        className="form-input"
                                        value={editCredUsername}
                                        onChange={(e) => setEditCredUsername(e.target.value)}
                                        style={{ fontSize: 12, padding: '4px 8px' }}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        type="text"
                                        className="form-input"
                                        value={editCredPassword}
                                        onChange={(e) => setEditCredPassword(e.target.value)}
                                        style={{ fontSize: 12, padding: '4px 8px' }}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        className="form-input"
                                        value={editCredUrl}
                                        onChange={(e) => setEditCredUrl(e.target.value)}
                                        style={{ fontSize: 12, padding: '4px 8px' }}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        className="form-input"
                                        value={editCredNotes}
                                        onChange={(e) => setEditCredNotes(e.target.value)}
                                        style={{ fontSize: 12, padding: '4px 8px' }}
                                      />
                                    </td>
                                    <td>
                                      <div className="flex gap-1">
                                        <button type="button" className="btn btn-primary btn-xs" onClick={saveEditedCred}>
                                          Save
                                        </button>
                                        <button type="button" className="btn btn-outline btn-xs" onClick={() => setEditingCredId(null)}>
                                          Cancel
                                        </button>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td style={{ fontWeight: 600, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{cred.service}</td>
                                    <td style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                                      <div className="flex items-center gap-1" style={{ flexWrap: 'wrap' }}>
                                        <span style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>{cred.username ?? '—'}</span>
                                        {cred.username && (
                                          <button
                                            type="button"
                                            className="btn btn-ghost btn-icon btn-xs"
                                            onClick={() => handleCopyText(cred.username, `${cred.id}-username`)}
                                            title="Copy Username"
                                            style={{ color: copiedId === `${cred.id}-username` ? 'var(--success)' : 'var(--text-tertiary)', flexShrink: 0 }}
                                          >
                                            {copiedId === `${cred.id}-username` ? <Check size={12} /> : <Copy size={12} />}
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                                      <div className="flex items-center gap-1" style={{ flexWrap: 'wrap' }}>
                                        <span style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                                          {visiblePasswords[cred.id]
                                            ? cred.password
                                            : cred.password
                                            ? '••••••••'
                                            : '—'}
                                        </span>
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-icon btn-xs"
                                          onClick={() => togglePassword(cred.id)}
                                          title={visiblePasswords[cred.id] ? 'Hide Password' : 'Show Password'}
                                          style={{ flexShrink: 0 }}
                                        >
                                          {visiblePasswords[cred.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                                        </button>
                                        {cred.password && (
                                          <button
                                            type="button"
                                            className="btn btn-ghost btn-icon btn-xs"
                                            onClick={() => handleCopyText(cred.password, `${cred.id}-password`)}
                                            title="Copy Password"
                                            style={{ color: copiedId === `${cred.id}-password` ? 'var(--success)' : 'var(--text-tertiary)', flexShrink: 0 }}
                                          >
                                            {copiedId === `${cred.id}-password` ? <Check size={12} /> : <Copy size={12} />}
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                                      {cred.url ? (
                                        <a href={cred.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline" style={{ fontSize: 12, wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                                          Visit link <ExternalLink size={10} style={{ flexShrink: 0 }} />
                                        </a>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: 12, wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>{cred.notes ?? '—'}</td>
                                    <td style={{ textAlign: 'right' }}>
                                      <div className="flex gap-2 justify-end">
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-icon btn-xs"
                                          onClick={() => startEditCred(cred)}
                                          style={{ color: 'var(--text-secondary)' }}
                                        >
                                          <Edit2 size={13} />
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-icon btn-xs"
                                          onClick={() => setItemToDelete({ id: cred.id, label: cred.service, typeName: 'Credential', onDelete: () => deleteCredential(cred.id) })}
                                          style={{ color: 'var(--danger)' }}
                                          title="Delete credential"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </td>
                                  </>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <ClientPagination
                      currentPage={credPage}
                      totalItems={filteredCredentials.length}
                      pageSize={itemsPerPage}
                      onPageChange={setCredPage}
                    />
                  </>
                )}

                {/* Form to Add Credential (conditional toggle CTA if list is filled) */}
                {credentials.length > 0 && !showAddCred ? (
                  <div className="flex justify-end" style={{ marginTop: 8 }}>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddCred(true)}>
                      + Add new credential
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)', marginTop: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 10 }}>Add New Credential</span>
                    <div className="rg-2" style={{ gap: 10, marginBottom: 10 }}>
                      <input
                        className="form-input"
                        placeholder="Service (e.g. Hosting, WordPress)"
                        value={newCred.service}
                        onChange={(e) => setNewCred({ ...newCred, service: e.target.value })}
                        style={{ fontSize: 13 }}
                      />
                      <input
                        className="form-input"
                        placeholder="Login URL (optional)"
                        value={newCred.url}
                        onChange={(e) => setNewCred({ ...newCred, url: e.target.value })}
                        style={{ fontSize: 13 }}
                      />
                    </div>
                    <div className="rg-2" style={{ gap: 10, marginBottom: 10 }}>
                      <input
                        className="form-input"
                        placeholder="Username / Email"
                        value={newCred.username}
                        onChange={(e) => setNewCred({ ...newCred, username: e.target.value })}
                        style={{ fontSize: 13 }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Password"
                        value={newCred.password}
                        onChange={(e) => setNewCred({ ...newCred, password: e.target.value })}
                        style={{ fontSize: 13 }}
                      />
                    </div>
                    <div className="flex-responsive">
                      <input
                        className="form-input"
                        placeholder="Credential notes or hints (optional)"
                        value={newCred.notes}
                        onChange={(e) => setNewCred({ ...newCred, notes: e.target.value })}
                        style={{ fontSize: 13, flex: 1 }}
                      />
                      <div className="flex gap-2">
                        <button type="button" className="btn btn-outline btn-sm" onClick={addCredential}>
                          Add
                        </button>
                        {credentials.length > 0 && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddCred(false)}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Custom Deliverables & Reports Links */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div className="flex items-center gap-2">
                  <Layers size={16} style={{ color: 'var(--text-secondary)' }} />
                  <span className="text-section-header">Custom Reports &amp; Deliverables Links</span>
                </div>
                <div className="search-input-wrapper" style={{ position: 'relative', width: 220 }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search deliverables..."
                    value={linkSearch}
                    onChange={(e) => {
                      setLinkSearch(e.target.value)
                      setLinkPage(1)
                    }}
                    style={{ paddingLeft: 30, fontSize: 12, paddingTop: 4, paddingBottom: 4 }}
                  />
                </div>
              </div>

              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredServiceLinks.length === 0 ? (
                  <p className="text-meta" style={{ padding: '8px 0' }}>{linkSearch ? 'No deliverables match search' : 'No custom deliverables recorded.'}</p>
                ) : (
                  <>
                    <div className="table-wrapper" style={{ width: '100%', overflowX: 'hidden' }}>
                      <table className="table table-compact" style={{ width: '100%', tableLayout: 'fixed' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '25%' }}>Label</th>
                            <th style={{ width: '35%' }}>URL</th>
                            <th style={{ width: '40%' }}>Notes</th>
                            <th style={{ width: '90px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedServiceLinks.map((link) => {
                            const isEditing = editingLinkId === link.id
                            const isDeletingThis = deletingItemId === link.id
                            return (
                              <tr
                                key={link.id}
                                style={{
                                  transition: 'all 0.25s ease-out',
                                  opacity: isDeletingThis ? 0 : 1,
                                  transform: isDeletingThis ? 'scale(0.96)' : 'none',
                                  background: isDeletingThis ? '#FEF2F2' : undefined,
                                }}
                              >
                                {isEditing ? (
                                  <>
                                    <td>
                                      <input
                                        className="form-input"
                                        value={editLinkLabel}
                                        onChange={(e) => setEditLinkLabel(e.target.value)}
                                        style={{ fontSize: 12, padding: '4px 8px' }}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        className="form-input"
                                        value={editLinkUrl}
                                        onChange={(e) => setEditLinkUrl(e.target.value)}
                                        style={{ fontSize: 12, padding: '4px 8px' }}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        className="form-input"
                                        value={editLinkNotes}
                                        onChange={(e) => setEditLinkNotes(e.target.value)}
                                        style={{ fontSize: 12, padding: '4px 8px' }}
                                      />
                                    </td>
                                    <td>
                                      <div className="flex gap-1">
                                        <button type="button" className="btn btn-primary btn-xs" onClick={saveEditedLink}>
                                          Save
                                        </button>
                                        <button type="button" className="btn btn-outline btn-xs" onClick={() => setEditingLinkId(null)}>
                                          Cancel
                                        </button>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td style={{ fontWeight: 600, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{link.label}</td>
                                    <td style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                                      <a href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline" style={{ fontSize: 12, wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                                        Open link <ExternalLink size={10} style={{ flexShrink: 0 }} />
                                      </a>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: 12, wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>{link.notes ?? '—'}</td>
                                    <td style={{ textAlign: 'right' }}>
                                      <div className="flex gap-2 justify-end">
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-icon btn-xs"
                                          onClick={() => startEditLink(link)}
                                          style={{ color: 'var(--text-secondary)' }}
                                        >
                                          <Edit2 size={13} />
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-icon btn-xs"
                                          onClick={() => setItemToDelete({ id: link.id, label: link.label, typeName: 'Deliverable Link', onDelete: () => deleteServiceLink(link.id) })}
                                          style={{ color: 'var(--danger)' }}
                                          title="Delete deliverable link"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </td>
                                  </>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <ClientPagination
                      currentPage={linkPage}
                      totalItems={filteredServiceLinks.length}
                      pageSize={itemsPerPage}
                      onPageChange={setLinkPage}
                    />
                  </>
                )}

                {/* Form to Add Custom Link (conditional toggle CTA if list is filled) */}
                {serviceLinks.length > 0 && !showAddLink ? (
                  <div className="flex justify-end" style={{ marginTop: 8 }}>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddLink(true)}>
                      + Add deliverable link
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)', marginTop: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 10 }}>Add Deliverables Link</span>
                    <div className="rg-2" style={{ gap: 10, marginBottom: 10 }}>
                      <input
                        className="form-input"
                        placeholder="Label (e.g. Campaign Dashboard)"
                        value={newLink.label}
                        onChange={(e) => setNewLink({ ...newLink, label: e.target.value })}
                        style={{ fontSize: 13 }}
                      />
                      <input
                        className="form-input"
                        placeholder="URL"
                        value={newLink.url}
                        onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                        style={{ fontSize: 13 }}
                      />
                    </div>
                    <div className="flex-responsive">
                      <input
                        className="form-input"
                        placeholder="Notes (optional)"
                        value={newLink.notes}
                        onChange={(e) => setNewLink({ ...newLink, notes: e.target.value })}
                        style={{ fontSize: 13, flex: 1 }}
                      />
                      <div className="flex gap-2">
                        <button type="button" className="btn btn-outline btn-sm" onClick={addServiceLink}>
                          Add
                        </button>
                        {serviceLinks.length > 0 && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddLink(false)}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* General Client Notes (Timeline Interface) */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div className="flex items-center gap-2">
                  <FileText size={16} style={{ color: 'var(--text-secondary)' }} />
                  <span className="text-section-header">Client Reference Notes Timeline</span>
                </div>
                <div className="search-input-wrapper" style={{ position: 'relative', width: 220 }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search notes..."
                    value={noteSearch}
                    onChange={(e) => {
                      setNoteSearch(e.target.value)
                      setNotePage(1)
                    }}
                    style={{ paddingLeft: 30, fontSize: 12, paddingTop: 4, paddingBottom: 4 }}
                  />
                </div>
              </div>
              
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Add note editor */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Write a reference note or status update for this client..."
                    value={newNoteBody}
                    onChange={(e) => setNewNoteBody(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                  <div className="flex justify-end">
                    <button type="button" className="btn btn-outline btn-sm" onClick={addNote} disabled={!newNoteBody.trim()}>
                      Add Note
                    </button>
                  </div>
                </div>

                {/* Timeline display */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  {filteredNotesList.length === 0 ? (
                    <p className="text-meta" style={{ textAlign: 'center', padding: '12px 0' }}>{noteSearch ? 'No notes match search' : 'No reference notes recorded. Add one above.'}</p>
                  ) : (
                    <>
                      {paginatedNotesList.map((note) => {
                        const isEditing = editingNoteId === note.id
                        const isDeletingThis = deletingItemId === note.id
                        return (
                          <div
                            key={note.id}
                            style={{
                              padding: 12,
                              background: isDeletingThis ? '#FEF2F2' : 'var(--bg)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                              transition: 'all 0.25s ease-out',
                              opacity: isDeletingThis ? 0 : 1,
                              transform: isDeletingThis ? 'scale(0.96)' : 'none',
                            }}
                          >
                            <div className="flex justify-between items-center" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              <div className="flex items-center gap-2">
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Agent Reference</span>
                                <span>•</span>
                                <span>{format(new Date(note.created_at), 'dd MMM yyyy HH:mm')}</span>
                              </div>
                              
                              {!isEditing && (
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-icon btn-xs"
                                    onClick={() => startEditNote(note)}
                                    style={{ padding: 2 }}
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-icon btn-xs"
                                    onClick={() => setItemToDelete({ id: note.id, label: 'Reference Note', typeName: 'Reference Note', onDelete: () => deleteNote(note.id) })}
                                    style={{ color: 'var(--danger)', padding: 2 }}
                                    title="Delete note"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>

                            {isEditing ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <textarea
                                  className="form-input"
                                  rows={3}
                                  value={editingNoteBody}
                                  onChange={(e) => setEditingNoteBody(e.target.value)}
                                  style={{ fontSize: 13 }}
                                />
                                <div className="flex gap-2 justify-end">
                                  <button type="button" className="btn btn-primary btn-xs" onClick={saveEditedNote}>
                                    Save Note
                                  </button>
                                  <button type="button" className="btn btn-outline btn-xs" onClick={() => setEditingNoteId(null)}>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'anywhere', maxWidth: '100%' }}>
                                {note.body}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      <ClientPagination
                        currentPage={notePage}
                        totalItems={filteredNotesList.length}
                        pageSize={itemsPerPage}
                        onPageChange={setNotePage}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Secondary Contacts & Account Managers */}
            <div className="card">
              <div className="card-header flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users2 size={16} style={{ color: 'var(--text-secondary)' }} />
                  <span className="text-section-header">Secondary Contacts &amp; People</span>
                </div>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {secondaryContacts.length === 0 ? (
                  <p className="text-meta" style={{ padding: '8px 0' }}>No alternate contacts added.</p>
                ) : (
                  <div className="table-wrapper" style={{ width: '100%', overflowX: 'hidden' }}>
                    <table className="table table-compact" style={{ width: '100%', tableLayout: 'fixed' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '25%' }}>Name</th>
                          <th style={{ width: '20%' }}>Role</th>
                          <th style={{ width: '30%' }}>Email</th>
                          <th style={{ width: '25%' }}>Phone</th>
                          <th style={{ width: '90px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {secondaryContacts.map((contact) => {
                          const isEditing = editingContactId === contact.id
                          const isDeletingThis = deletingItemId === contact.id
                          return (
                            <tr
                              key={contact.id}
                              style={{
                                transition: 'all 0.25s ease-out',
                                opacity: isDeletingThis ? 0 : 1,
                                transform: isDeletingThis ? 'scale(0.96)' : 'none',
                                background: isDeletingThis ? '#FEF2F2' : undefined,
                              }}
                            >
                              {isEditing ? (
                                <>
                                  <td>
                                    <input
                                      className="form-input"
                                      value={editContactName}
                                      onChange={(e) => setEditContactName(e.target.value)}
                                      style={{ fontSize: 12, padding: '4px 8px' }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      className="form-input"
                                      value={editContactRole}
                                      onChange={(e) => setEditContactRole(e.target.value)}
                                      style={{ fontSize: 12, padding: '4px 8px' }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      className="form-input"
                                      value={editContactEmail}
                                      onChange={(e) => setEditContactEmail(e.target.value)}
                                      style={{ fontSize: 12, padding: '4px 8px' }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      className="form-input"
                                      value={editContactPhone}
                                      onChange={(e) => setEditContactPhone(e.target.value)}
                                      style={{ fontSize: 12, padding: '4px 8px' }}
                                    />
                                  </td>
                                  <td>
                                    <div className="flex gap-1">
                                      <button type="button" className="btn btn-primary btn-xs" onClick={saveEditedContact}>
                                        Save
                                      </button>
                                      <button type="button" className="btn btn-outline btn-xs" onClick={() => setEditingContactId(null)}>
                                        Cancel
                                      </button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td style={{ fontWeight: 600, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{contact.name}</td>
                                  <td style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{contact.role ?? '—'}</td>
                                  <td style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>{contact.email ? <a href={`mailto:${contact.email}`} className="text-primary hover:underline" style={{ wordBreak: 'break-all' }}>{contact.email}</a> : '—'}</td>
                                  <td style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>{contact.phone ?? '—'}</td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div className="flex gap-2 justify-end">
                                      <button
                                        type="button"
                                        className="btn btn-ghost btn-icon btn-xs"
                                        onClick={() => startEditContact(contact)}
                                        style={{ color: 'var(--text-secondary)' }}
                                      >
                                        <Edit2 size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-ghost btn-icon btn-xs"
                                        onClick={() => setItemToDelete({ id: contact.id, label: contact.name, typeName: 'Alternate Contact', onDelete: () => deleteSecondaryContact(contact.id) })}
                                        style={{ color: 'var(--danger)' }}
                                        title="Delete contact"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Form to Add Alternate Contact (conditional toggle CTA if list is filled) */}
                {secondaryContacts.length > 0 && !showAddContact ? (
                  <div className="flex justify-end" style={{ marginTop: 8 }}>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddContact(true)}>
                      + Add alternate contact
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)', marginTop: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 10 }}>Add Alternate Contact</span>
                    <div className="rg-2" style={{ gap: 10, marginBottom: 10 }}>
                      <input
                        className="form-input"
                        placeholder="Contact Name"
                        value={newContact.name}
                        onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                        style={{ fontSize: 13 }}
                      />
                      <input
                        className="form-input"
                        placeholder="Role (e.g. Finance, PM)"
                        value={newContact.role}
                        onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                        style={{ fontSize: 13 }}
                      />
                    </div>
                    <div className="flex-responsive">
                      <input
                        className="form-input"
                        placeholder="Email Address"
                        value={newContact.email}
                        onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                        style={{ fontSize: 13, flex: 1 }}
                      />
                      <input
                        className="form-input"
                        placeholder="Phone Number"
                        value={newContact.phone}
                        onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                        style={{ fontSize: 13, flex: 1 }}
                      />
                      <div className="flex gap-2">
                        <button type="button" className="btn btn-outline btn-sm" onClick={addSecondaryContact}>
                          Add
                        </button>
                        {secondaryContacts.length > 0 && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddContact(false)}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Invoices List (With search and pagination of 5) */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <span className="text-section-header">Invoices</span>
                <div className="search-input-wrapper" style={{ position: 'relative', width: 220 }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search invoice # or status..."
                    value={invoiceSearch}
                    onChange={(e) => {
                      setInvoiceSearch(e.target.value)
                      setInvoicePage(1)
                    }}
                    style={{ paddingLeft: 30, fontSize: 12, paddingTop: 4, paddingBottom: 4 }}
                  />
                </div>
              </div>
              
              <div className="card-body" style={{ padding: 0 }}>
                {paginatedInvoices.length === 0 ? (
                  <p className="text-meta" style={{ padding: 20 }}>No invoices found.</p>
                ) : (
                  <>
                    <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                      <table className="table table-compact">
                        <thead>
                          <tr>
                            <th>Invoice #</th>
                            <th>Status</th>
                            <th>Issue Date</th>
                            <th>Due Date</th>
                            <th className="num">Total</th>
                            <th className="num">Paid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedInvoices.map((inv) => (
                            <tr
                              key={inv.id}
                              className="clickable"
                              onClick={() => router.push(`/invoices/${inv.id}`)}
                            >
                              <td style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                              <td>
                                <span className="badge" style={{ fontSize: 10 }}>
                                  {inv.status}
                                </span>
                              </td>
                              <td>{format(new Date(inv.issue_date), 'dd MMM yyyy')}</td>
                              <td>{inv.due_date ? format(new Date(inv.due_date), 'dd MMM yyyy') : '—'}</td>
                              <td className="num tabular-nums">{inv.currency} {Number(inv.total).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                              <td className="num tabular-nums">{inv.currency} {Number(inv.amount_paid).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination of 5 */}
                    {totalInvoicesPages > 1 && (
                      <div className="flex justify-between items-center" style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
                        <span className="text-meta">
                          Showing {(invoicePage - 1) * itemsPerPage + 1} to {Math.min(invoicePage * itemsPerPage, filteredInvoices.length)} of {filteredInvoices.length} invoices
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            disabled={invoicePage === 1}
                            onClick={() => setInvoicePage(invoicePage - 1)}
                          >
                            Prev
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            disabled={invoicePage === totalInvoicesPages}
                            onClick={() => setInvoicePage(invoicePage + 1)}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Quotations List (With search and pagination of 5) */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <span className="text-section-header">Quotations</span>
                <div className="search-input-wrapper" style={{ position: 'relative', width: 220 }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search quote # or status..."
                    value={quoteSearch}
                    onChange={(e) => {
                      setQuoteSearch(e.target.value)
                      setQuotePage(1)
                    }}
                    style={{ paddingLeft: 30, fontSize: 12, paddingTop: 4, paddingBottom: 4 }}
                  />
                </div>
              </div>
              
              <div className="card-body" style={{ padding: 0 }}>
                {paginatedQuotations.length === 0 ? (
                  <p className="text-meta" style={{ padding: 20 }}>No quotations found.</p>
                ) : (
                  <>
                    <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                      <table className="table table-compact">
                        <thead>
                          <tr>
                            <th>Quote #</th>
                            <th>Status</th>
                            <th>Issue Date</th>
                            <th className="num">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedQuotations.map((q) => (
                            <tr
                              key={q.id}
                              className="clickable"
                              onClick={() => router.push(`/quotations/${q.id}`)}
                            >
                              <td style={{ fontWeight: 600 }}>{q.quote_number}</td>
                              <td>
                                <span className="badge" style={{ fontSize: 10 }}>
                                  {q.status}
                                </span>
                              </td>
                              <td>{format(new Date(q.issue_date), 'dd MMM yyyy')}</td>
                              <td className="num tabular-nums">{q.currency} {Number(q.total).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination of 5 */}
                    {totalQuotationsPages > 1 && (
                      <div className="flex justify-between items-center" style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
                        <span className="text-meta">
                          Showing {(quotePage - 1) * itemsPerPage + 1} to {Math.min(quotePage * itemsPerPage, filteredQuotations.length)} of {filteredQuotations.length} quotations
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            disabled={quotePage === 1}
                            onClick={() => setQuotePage(quotePage - 1)}
                          >
                            Prev
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            disabled={quotePage === totalQuotationsPages}
                            onClick={() => setQuotePage(quotePage + 1)}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

          </div>

          {/* Sidebar Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Client Portal Access & Password Reset Card */}
            <div className="card">
              <div className="card-header flex items-center justify-between" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Shield size={16} style={{ color: 'var(--accent)' }} />
                  <span className="text-section-header">Client Portal Access</span>
                </div>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                  Client portal accounts are managed via invitations. Use the button below to send a password reset link to this client's email address.
                </p>

                {accessSuccess && (
                  <div style={{ padding: '8px 10px', background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: 'var(--radius-sm)', color: 'var(--success)', fontSize: 12 }}>
                    ✓ {accessSuccess}
                  </div>
                )}
                {accessError && (
                  <div style={{ padding: '8px 10px', background: '#FEF2F2', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: 12 }}>
                    ✕ {accessError}
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleSendPasswordResetLink}
                  disabled={accessLoading}
                  style={{ width: '100%', justifyContent: 'center', fontWeight: 600, display: 'inline-flex', gap: 6 }}
                >
                  <Send size={13} />
                  {accessLoading ? 'Sending Reset Link...' : 'Send Password Reset Email'}
                </button>
              </div>
            </div>

            {/* Client Basic Details Form (New Feature to show/edit Name, Email, Phone, Company, Address) */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={16} style={{ color: 'var(--text-secondary)' }} />
                <span className="text-section-header">Basic Information</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Client Name</label>
                  <input
                    className="form-input"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Full name"
                    style={{ fontSize: 13 }}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Company Name</label>
                  <input
                    className="form-input"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Company name"
                    style={{ fontSize: 13 }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="client@email.com"
                    style={{ fontSize: 13 }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    className="form-input"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="+966..."
                    style={{ fontSize: 13 }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Address</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    placeholder="Physical or billing address"
                    style={{ fontSize: 13, resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>

            {/* Account Management & Retainer Billing */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={16} style={{ color: 'var(--text-secondary)' }} />
                <span className="text-section-header">Account &amp; Retainer</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label className="form-label">Account Manager / Agent</label>
                    {currentProfile?.role !== 'ADMIN' && (
                      <span className="badge badge-default" style={{ fontSize: 10, padding: '1px 6px' }}>
                        Admin Managed
                      </span>
                    )}
                  </div>
                  {currentProfile?.role === 'ADMIN' ? (
                    <select
                      className="form-select"
                      value={agentId}
                      onChange={(e) => setAgentId(e.target.value)}
                      style={{ fontSize: 13 }}
                    >
                      <option value="">Unassigned</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                      ))}
                    </select>
                  ) : (
                    <div style={{
                      padding: '8px 12px',
                      background: 'var(--bg-subtle, #f8fafc)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {(profiles.find((p) => p.id === agentId)?.name || 'UN').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        {profiles.find((p) => p.id === agentId)?.name ? (
                          <>
                            <span>{profiles.find((p) => p.id === agentId)?.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 6 }}>
                              ({profiles.find((p) => p.id === agentId)?.role})
                            </span>
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>Unassigned</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Client Status</label>
                  <select
                    className="form-select"
                    value={clientStatus}
                    onChange={(e) => setClientStatus(e.target.value)}
                    style={{ fontSize: 13 }}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="VIP">VIP</option>
                    <option value="LEAD">LEAD</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Retainer Billing Cycle</label>
                  <select
                    className="form-select"
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value)}
                    style={{ fontSize: 13 }}
                  >
                    <option value="NONE">None / Ad-hoc</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="YEARLY">Yearly</option>
                    <option value="ONE_TIME">One-Time</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Retainer Amount (SAR)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={billingAmount}
                    onChange={(e) => setBillingAmount(Number(e.target.value) || 0)}
                    placeholder="0.00"
                    style={{ fontSize: 13 }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contract Start Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={contractStartDate}
                    onChange={(e) => setContractStartDate(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contract End Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={contractEndDate}
                    onChange={(e) => setContractEndDate(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                </div>

                {/* Multiple Websites Structured Manager */}
                <div className="form-group" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Websites &amp; URLs</label>
                  
                  {websites.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                      {websites.map((w) => {
                        const isEditing = editingWebsiteId === w.id
                        return (
                          <div key={w.id} style={{ padding: '6px 8px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 12 }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <input
                                  className="form-input"
                                  value={editWebName}
                                  onChange={(e) => setEditWebName(e.target.value)}
                                  placeholder="Website Name"
                                  style={{ fontSize: 11, padding: '2px 6px' }}
                                />
                                <input
                                  className="form-input"
                                  value={editWebUrl}
                                  onChange={(e) => setEditWebUrl(e.target.value)}
                                  placeholder="Website URL"
                                  style={{ fontSize: 11, padding: '2px 6px' }}
                                />
                                <div className="flex gap-1 justify-end" style={{ marginTop: 2 }}>
                                  <button type="button" className="btn btn-primary btn-xs" onClick={saveEditedWebsite}>Save</button>
                                  <button type="button" className="btn btn-outline btn-xs" onClick={() => setEditingWebsiteId(null)}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-between items-center">
                                <a href={w.url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1" style={{ fontWeight: 500 }}>
                                  {w.name} <ExternalLink size={10} />
                                </a>
                                <div className="flex gap-2">
                                  <button type="button" className="btn btn-ghost btn-icon btn-xs" onClick={() => startEditWebsite(w)} style={{ padding: 2 }}>
                                    <Edit2 size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-icon btn-xs"
                                    onClick={() => setItemToDelete({ id: w.id, label: w.name, typeName: 'Website Link', onDelete: () => deleteWebsite(w.id) })}
                                    style={{ color: 'var(--danger)', padding: 2 }}
                                    title="Delete website"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    <input
                      className="form-input"
                      placeholder="Website Name (e.g. Main Site)"
                      value={newWebName}
                      onChange={(e) => setNewWebName(e.target.value)}
                      style={{ fontSize: 12, padding: '4px 8px' }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="form-input"
                        placeholder="clienturl.com"
                        value={newWebUrl}
                        onChange={(e) => setNewWebUrl(e.target.value)}
                        style={{ fontSize: 12, padding: '4px 8px', flex: 1 }}
                      />
                      <button type="button" className="btn btn-outline btn-xs" onClick={addWebsite} style={{ height: 28 }}>
                        Add
                      </button>
                    </div>
                    {webValidationError && <span style={{ color: 'var(--danger)', fontSize: 11, fontWeight: 500 }}>{webValidationError}</span>}
                  </div>
                </div>

                {/* Multiple Monthly Reports Manager (with Year Tab Filter) */}
                <div className="form-group" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Monthly Reports Links</label>
                  
                  {/* Year Selector Dropdown & Collapse/Expand toggle button */}
                  {reportYears.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      <select
                        className="form-select"
                        value={reportViewYear}
                        onChange={(e) => {
                          setReportViewYear(e.target.value)
                          setIsReportsExpanded(true) // Auto-open when year changes
                        }}
                        style={{ fontSize: 12, height: 28, padding: '2px 8px', flex: 1 }}
                      >
                        {reportYears.map((year) => (
                          <option key={year} value={year}>{year} Reports</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => setIsReportsExpanded(!isReportsExpanded)}
                        style={{ height: 28, padding: '0 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {isReportsExpanded ? 'Collapse' : 'Expand'}
                      </button>
                    </div>
                  )}

                  {/* Reports list filtered by selected year */}
                  {isReportsExpanded && displayedReports.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                      {displayedReports.map((r) => {
                        const isEditing = editingReportId === r.id
                        const displayName = r.year ? `${r.month} ${r.year}` : r.month
                        return (
                          <div key={r.id} style={{ padding: '6px 8px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 12 }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                  <select
                                    className="form-select"
                                    value={editRepMonth}
                                    onChange={(e) => setEditRepMonth(e.target.value)}
                                    style={{ fontSize: 11, padding: '2px 6px', height: 24 }}
                                  >
                                    {MONTHS_LIST.map((m) => (
                                      <option key={m} value={m}>{m}</option>
                                    ))}
                                  </select>
                                  <select
                                    className="form-select"
                                    value={editRepYear}
                                    onChange={(e) => setEditRepYear(e.target.value)}
                                    style={{ fontSize: 11, padding: '2px 6px', height: 24 }}
                                  >
                                    {['2024', '2025', '2026', '2027', '2028', '2029', '2030'].map((y) => (
                                      <option key={y} value={y}>{y}</option>
                                    ))}
                                  </select>
                                </div>
                                <input
                                  className="form-input"
                                  value={editRepUrl}
                                  onChange={(e) => setEditRepUrl(e.target.value)}
                                  placeholder="Report URL"
                                  style={{ fontSize: 11, padding: '2px 6px' }}
                                />
                                <div className="flex gap-1 justify-end" style={{ marginTop: 2 }}>
                                  <button type="button" className="btn btn-primary btn-xs" onClick={saveEditedReport}>Save</button>
                                  <button type="button" className="btn btn-outline btn-xs" onClick={() => setEditingReportId(null)}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-between items-center">
                                <a href={r.url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1" style={{ fontWeight: 500 }}>
                                  {displayName} <ExternalLink size={10} />
                                </a>
                                <div className="flex gap-2">
                                  <button type="button" className="btn btn-ghost btn-icon btn-xs" onClick={() => startEditReport(r)} style={{ padding: 2 }}>
                                    <Edit2 size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-icon btn-xs"
                                    onClick={() => setItemToDelete({ id: r.id, label: `${r.month} ${r.year || '2026'}`, typeName: 'Monthly Report', onDelete: () => deleteReport(r.id) })}
                                    style={{ color: 'var(--danger)', padding: 2 }}
                                    title="Delete report"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Add New Monthly Report input box with Month + Year selector */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <select
                        className="form-select"
                        value={newRepMonth}
                        onChange={(e) => setNewRepMonth(e.target.value)}
                        style={{ fontSize: 12, padding: '4px 8px', height: 30 }}
                      >
                        {MONTHS_LIST.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <select
                        className="form-select"
                        value={newRepYear}
                        onChange={(e) => setNewRepYear(e.target.value)}
                        style={{ fontSize: 12, padding: '4px 8px', height: 30 }}
                      >
                        {['2024', '2025', '2026', '2027', '2028', '2029', '2030'].map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="form-input"
                        placeholder="Report Drive / PDF Link"
                        value={newRepUrl}
                        onChange={(e) => setNewRepUrl(e.target.value)}
                        style={{ fontSize: 12, padding: '4px 8px', flex: 1 }}
                      />
                      <button type="button" className="btn btn-outline btn-xs" onClick={addReport} style={{ height: 30 }}>
                        Add
                      </button>
                    </div>
                    {repValidationError && <span style={{ color: 'var(--danger)', fontSize: 11, fontWeight: 500 }}>{repValidationError}</span>}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Google Business Profile (GMB) URL</label>
                  <input
                    className="form-input"
                    value={gmbUrl}
                    onChange={(e) => setGmbUrl(e.target.value)}
                    placeholder="https://maps.google.com/..."
                    style={{ fontSize: 13 }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Brand Assets Drive / Folder Link</label>
                  <input
                    className="form-input"
                    value={brandAssetsLink}
                    onChange={(e) => setBrandAssetsLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    style={{ fontSize: 13 }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label flex items-center gap-1">
                    <Facebook size={12} color="#1877F2" /> Facebook Page URL
                  </label>
                  <input
                    className="form-input"
                    value={facebookUrl}
                    onChange={(e) => setFacebookUrl(e.target.value)}
                    placeholder="https://facebook.com/..."
                    style={{ fontSize: 13 }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label flex items-center gap-1">
                    <Instagram size={12} color="#E4405F" /> Instagram Profile URL
                  </label>
                  <input
                    className="form-input"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    placeholder="https://instagram.com/..."
                    style={{ fontSize: 13 }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label flex items-center gap-1">
                    <Video size={12} color="#000" /> TikTok Profile URL
                  </label>
                  <input
                    className="form-input"
                    value={tiktokUrl}
                    onChange={(e) => setTiktokUrl(e.target.value)}
                    placeholder="https://tiktok.com/@..."
                    style={{ fontSize: 13 }}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Sleek, responsive bottom save changes footer */}
        <div className="no-print client-detail-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {error && <span style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 500 }}>✕ {error}</span>}
            {saveSuccess && <span style={{ color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>✓ Changes saved successfully</span>}
            {!error && !saveSuccess && <span className="client-detail-footer-text" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Client profile edits must be saved to persist.</span>}
          </div>
          
          <button className="btn btn-primary btn-sm" onClick={handleSaveChanges} disabled={saving} style={{ display: 'inline-flex', gap: 6, padding: '6px 20px', fontWeight: 600 }}>
            <Save size={14} />
            {saving ? 'Saving changes...' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Individual Item Delete Confirmation Popup Modal */}
      {itemToDelete && (
        <div className="modal-backdrop" onClick={() => setItemToDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, width: '100%' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontWeight: 700, fontSize: 16 }}>
                <AlertTriangle size={18} /> Confirm Deletion
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setItemToDelete(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px 4px', fontSize: 14, color: 'var(--text-primary)' }}>
              Are you sure you want to delete this <strong>{itemToDelete.typeName}</strong> ({itemToDelete.label})? This action cannot be undone.
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setItemToDelete(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  const { id, onDelete, typeName } = itemToDelete
                  setItemToDelete(null)
                  triggerAnimatedDelete(id, onDelete, typeName)
                }}
                style={{ background: 'var(--danger)', color: '#fff', border: 'none', fontWeight: 600, padding: '6px 16px' }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Client Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-backdrop" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: '100%' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontWeight: 700, fontSize: 16 }}>
                <AlertTriangle size={18} /> Delete Client Record
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDeleteModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px 4px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', padding: '0 4px' }}>
                Are you sure you want to delete <strong>{client.name}</strong> {client.company ? `(${client.company})` : ''}?
              </div>

              {/* Structured Warning Callout */}
              <div style={{
                background: '#FEF2F2',
                border: '1px solid #FCA5A5',
                borderRadius: 8,
                padding: '14px 16px',
                margin: '2px 4px',
                fontSize: 13,
                color: '#991B1B',
              }}>
                <div style={{ fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#7F1D1D' }}>
                  <AlertTriangle size={15} /> Irreversible Action &amp; Linked Data Removal
                </div>
                <div style={{ fontSize: 12, color: '#7F1D1D', marginBottom: 6, lineHeight: 1.4 }}>
                  Deleting this client will permanently purge all linked records from the database:
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3, color: '#991B1B' }}>
                  <li>Linked <strong>Quotations</strong> &amp; Proposal items</li>
                  <li>Linked <strong>Invoices</strong> &amp; Payment history</li>
                  <li>Linked <strong>Technical Tasks</strong> &amp; Work updates</li>
                  <li>Stored <strong>Asset Credentials</strong> &amp; Logins</li>
                </ul>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleDeleteClient}
                disabled={deletingClient}
                style={{ background: 'var(--danger)', color: '#fff', border: 'none', fontWeight: 600, padding: '6px 16px' }}
              >
                {deletingClient ? 'Deleting...' : 'Yes, Delete Client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Toast Notification Feedback */}
      {toastFeedback && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          background: toastFeedback.type === 'danger' ? '#991B1B' : '#15803D',
          color: '#fff',
          padding: '10px 18px',
          borderRadius: 8,
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <CheckCircle size={16} /> {toastFeedback.message}
        </div>
      )}
    </div>
  )
}

function ClientPagination({
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
    <div className="flex justify-between items-center" style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
      <span className="text-meta">
        Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-outline btn-xs"
          disabled={currentPage === 1}
          onClick={() => {
            onPageChange(currentPage - 1)
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
          }}
        >
          Prev
        </button>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-outline btn-xs"
          disabled={currentPage === totalPages}
          onClick={() => {
            onPageChange(currentPage + 1)
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
          }}
        >
          Next
        </button>
      </div>
    </div>
  )
}
