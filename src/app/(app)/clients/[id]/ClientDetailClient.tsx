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
} from 'lucide-react'

interface Props {
  client: any
  profiles: { id: string; name: string }[]
  invoices: any[]
  quotations: any[]
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

export default function ClientDetailClient({ client, profiles, invoices, quotations }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState('')

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

  // Search & Pagination States for Invoices & Quotations
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [invoicePage, setInvoicePage] = useState(1)
  const [quoteSearch, setQuoteSearch] = useState('')
  const [quotePage, setQuotePage] = useState(1)
  const itemsPerPage = 5

  // Financial calculations
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

  function deleteCredential(id: string) {
    setCredentials(credentials.filter((c) => c.id !== id))
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

  function deleteSecondaryContact(id: string) {
    setSecondaryContacts(secondaryContacts.filter((c) => c.id !== id))
  }

  // Handlers for Custom Links
  function addServiceLink() {
    if (!newLink.label || !newLink.url) return
    const item = { ...newLink, id: Math.random().toString(36).slice(2) }
    setServiceLinks([...serviceLinks, item])
    setNewLink({ id: '', label: '', url: '', notes: '' })
    setShowAddLink(false)
  }

  function deleteServiceLink(id: string) {
    setServiceLinks(serviceLinks.filter((l) => l.id !== id))
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

  function deleteWebsite(id: string) {
    setWebsites(websites.filter((w) => w.id !== id))
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

  function deleteReport(id: string) {
    const updated = monthlyReports.filter((r) => r.id !== id)
    setMonthlyReports(updated)

    // Reset filtered tab if deleted last item for that year
    const remainingYears = Array.from(new Set(updated.map((r) => r.year || '2026')))
    if (remainingYears.length > 0 && !remainingYears.includes(reportViewYear)) {
      setReportViewYear(remainingYears[0])
    }
  }

  // Multiple Notes Timeline handlers
  function addNote() {
    if (!newNoteBody.trim()) return
    const item = {
      id: Math.random().toString(36).slice(2),
      body: newNoteBody.trim(),
      created_at: new Date().toISOString(),
    }
    setNotesList([item, ...notesList]) // Newest note on top
    setNewNoteBody('')
  }

  function deleteNote(id: string) {
    setNotesList(notesList.filter((n) => n.id !== id))
  }

  // Edit notes
  function startEditNote(note: any) {
    setEditingNoteId(note.id)
    setEditingNoteBody(note.body)
  }

  function saveEditedNote() {
    if (!editingNoteBody.trim()) return
    setNotesList(
      notesList.map((n) =>
        n.id === editingNoteId ? { ...n, body: editingNoteBody.trim() } : n
      )
    )
    setEditingNoteId(null)
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

  return (
    <div>
      {/* 100% Custom bulletproof static header to prevent layout spacienss/stretching on all viewports */}
      <div className="no-print" style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        gap: 16
      }}>
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

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 100 }}>
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
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Total Invoiced</span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
              SAR {totalInvoiced.toLocaleString('en', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>Earned Revenue</span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--success)' }}>
              SAR {totalEarned.toLocaleString('en', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: outstandingBalance > 0 ? 'var(--warning)' : 'var(--text-secondary)', fontWeight: 500 }}>
              Outstanding Balance
            </span>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: outstandingBalance > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
              SAR {outstandingBalance.toLocaleString('en', { minimumFractionDigits: 2 })}
            </div>
          </div>
          {overdueAmount > 0 && (
            <div className="card" style={{ padding: '14px 16px' }}>
              <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>Overdue Amount</span>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--danger)' }}>
                SAR {overdueAmount.toLocaleString('en', { minimumFractionDigits: 2 })}
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
            
            {/* Credentials Vault */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={16} style={{ color: 'var(--text-secondary)' }} />
                <span className="text-section-header">Credentials & Logins Vault</span>
              </div>
              
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {credentials.length === 0 ? (
                  <p className="text-meta" style={{ padding: '8px 0' }}>No credentials stored for this client.</p>
                ) : (
                  <div className="table-wrapper">
                    <table className="table table-compact">
                      <thead>
                        <tr>
                          <th>Service</th>
                          <th>Username</th>
                          <th>Password</th>
                          <th>Login URL</th>
                          <th>Notes</th>
                          <th style={{ width: 80 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {credentials.map((cred) => {
                          const isEditing = editingCredId === cred.id
                          return (
                            <tr key={cred.id}>
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
                                  <td style={{ fontWeight: 600 }}>{cred.service}</td>
                                  <td>{cred.username ?? '—'}</td>
                                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                                    <div className="flex items-center gap-2">
                                      <span>{visiblePasswords[cred.id] ? cred.password : '••••••••'}</span>
                                      <button
                                        type="button"
                                        className="btn btn-ghost btn-icon btn-xs"
                                        onClick={() => togglePassword(cred.id)}
                                      >
                                        {visiblePasswords[cred.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                                      </button>
                                    </div>
                                  </td>
                                  <td>
                                    {cred.url ? (
                                      <a href={cred.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline" style={{ fontSize: 12 }}>
                                        Visit link <ExternalLink size={10} />
                                      </a>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{cred.notes ?? '—'}</td>
                                  <td>
                                    <div className="flex gap-2">
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
                                        onClick={() => deleteCredential(cred.id)}
                                        style={{ color: 'var(--danger)' }}
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
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={16} style={{ color: 'var(--text-secondary)' }} />
                <span className="text-section-header">Custom Reports & Deliverables Links</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {serviceLinks.length === 0 ? (
                  <p className="text-meta" style={{ padding: '8px 0' }}>No custom deliverables recorded.</p>
                ) : (
                  <div className="table-wrapper">
                    <table className="table table-compact">
                      <thead>
                        <tr>
                          <th>Label</th>
                          <th>URL</th>
                          <th>Notes</th>
                          <th style={{ width: 80 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {serviceLinks.map((link) => {
                          const isEditing = editingLinkId === link.id
                          return (
                            <tr key={link.id}>
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
                                  <td style={{ fontWeight: 600 }}>{link.label}</td>
                                  <td>
                                    <a href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline" style={{ fontSize: 12 }}>
                                      Open link <ExternalLink size={10} />
                                    </a>
                                  </td>
                                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{link.notes ?? '—'}</td>
                                  <td>
                                    <div className="flex gap-2">
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
                                        onClick={() => deleteServiceLink(link.id)}
                                        style={{ color: 'var(--danger)' }}
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
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={16} style={{ color: 'var(--text-secondary)' }} />
                <span className="text-section-header">Client Reference Notes Timeline</span>
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
                  {notesList.length === 0 ? (
                    <p className="text-meta" style={{ textAlign: 'center', padding: '12px 0' }}>No reference notes recorded. Add one above.</p>
                  ) : (
                    notesList.map((note) => {
                      const isEditing = editingNoteId === note.id
                      return (
                        <div
                          key={note.id}
                          style={{
                            padding: 12,
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
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
                                  onClick={() => deleteNote(note.id)}
                                  style={{ color: 'var(--danger)', padding: 2 }}
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
                                rows={2}
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
                            <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', wordBreak: 'break-word', color: 'var(--text-primary)', margin: 0 }}>
                              {note.body}
                            </p>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Secondary Contacts Directory */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users2 size={16} style={{ color: 'var(--text-secondary)' }} />
                <span className="text-section-header">Secondary Contacts</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {secondaryContacts.length === 0 ? (
                  <p className="text-meta" style={{ padding: '8px 0' }}>No secondary contacts added.</p>
                ) : (
                  <div className="table-wrapper">
                    <table className="table table-compact">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Role</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th style={{ width: 80 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {secondaryContacts.map((contact) => {
                          const isEditing = editingContactId === contact.id
                          return (
                            <tr key={contact.id}>
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
                                  <td style={{ fontWeight: 600 }}>{contact.name}</td>
                                  <td>{contact.role ?? '—'}</td>
                                  <td>{contact.email ? <a href={`mailto:${contact.email}`} className="text-primary hover:underline">{contact.email}</a> : '—'}</td>
                                  <td>{contact.phone ?? '—'}</td>
                                  <td>
                                    <div className="flex gap-2">
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
                                        onClick={() => deleteSecondaryContact(contact.id)}
                                        style={{ color: 'var(--danger)' }}
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
                            <th>Valid Until</th>
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
                              <td>{q.valid_until ? format(new Date(q.valid_until), 'dd MMM yyyy') : '—'}</td>
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
              <div className="card-header"><span className="text-section-header">Account settings</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                
                <div className="form-group">
                  <label className="form-label">Client Status</label>
                  <select className="form-select" value={clientStatus} onChange={(e) => setClientStatus(e.target.value)}>
                    <option value="ACTIVE">Active</option>
                    <option value="VIP">VIP</option>
                    <option value="LEAD">Lead</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Account Manager</label>
                  <select className="form-select" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                    <option value="">Unassigned</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Industry</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Real Estate, Medical"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                  />
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>Retainer Retrospective</span>
                  
                  <div className="rg-2" style={{ gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Billing Cycle</label>
                      <select className="form-select" value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)}>
                        <option value="NONE">None</option>
                        <option value="MONTHLY">Monthly</option>
                        <option value="ONE_TIME">One-Time</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Amount (SAR)</label>
                      <input
                        type="number"
                        min={0}
                        className="form-input"
                        value={billingAmount === 0 ? '' : billingAmount}
                        onChange={(e) => setBillingAmount(parseFloat(e.target.value) || 0)}
                        style={{ textAlign: 'right' }}
                      />
                    </div>
                  </div>

                  <div className="rg-2" style={{ gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Contract Start</label>
                      <input
                        type="date"
                        className="form-input"
                        value={contractStartDate}
                        onChange={(e) => setContractStartDate(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Contract End</label>
                      <input
                        type="date"
                        className="form-input"
                        value={contractEndDate}
                        onChange={(e) => setContractEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Client Deliverables Directory */}
            <div className="card">
              <div className="card-header"><span className="text-section-header">Client Deliverables Directory</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                
                {/* Multiple Websites Structured Manager */}
                <div className="form-group" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Websites & URLs</label>
                  
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
                                  <button type="button" className="btn btn-ghost btn-icon btn-xs" onClick={() => deleteWebsite(w.id)} style={{ color: 'var(--danger)', padding: 2 }}>
                                    <X size={12} />
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
                                  <button type="button" className="btn btn-ghost btn-icon btn-xs" onClick={() => deleteReport(r.id)} style={{ color: 'var(--danger)', padding: 2 }}>
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Form to add reports */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <select
                        className="form-select"
                        value={newRepMonth}
                        onChange={(e) => setNewRepMonth(e.target.value)}
                        style={{ fontSize: 12, padding: '4px 8px', height: 28 }}
                      >
                        {MONTHS_LIST.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      
                      <select
                        className="form-select"
                        value={newRepYear}
                        onChange={(e) => setNewRepYear(e.target.value)}
                        style={{ fontSize: 12, padding: '4px 8px', height: 28 }}
                      >
                        {['2024', '2025', '2026', '2027', '2028', '2029', '2030'].map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="form-input"
                        placeholder="Drive report URL"
                        value={newRepUrl}
                        onChange={(e) => setNewRepUrl(e.target.value)}
                        style={{ fontSize: 12, padding: '4px 8px', flex: 1 }}
                      />
                      <button type="button" className="btn btn-outline btn-xs" onClick={addReport} style={{ height: 28 }}>
                        Add
                      </button>
                    </div>
                    {repValidationError && <span style={{ color: 'var(--danger)', fontSize: 11, fontWeight: 500 }}>{repValidationError}</span>}
                  </div>
                </div>

                <div className="form-group">
                  <div className="flex justify-between items-center">
                    <label className="form-label">Google Business Profile (GMB)</label>
                    {gmbUrl && (
                      <a href={gmbUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1" style={{ fontSize: 11 }}>
                        Visit <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                  <input
                    className="form-input"
                    placeholder="GBP search URL or admin panel link"
                    value={gmbUrl}
                    onChange={(e) => setGmbUrl(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                </div>

                <div className="form-group">
                  <div className="flex justify-between items-center">
                    <label className="form-label">Brand Assets Folder</label>
                    {brandAssetsLink && (
                      <a href={brandAssetsLink} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1" style={{ fontSize: 11 }}>
                        Visit <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                  <input
                    className="form-input"
                    placeholder="Drive folder for logos/designs"
                    value={brandAssetsLink}
                    onChange={(e) => setBrandAssetsLink(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                </div>

              </div>
            </div>

            {/* Social Media Quick Handles */}
            <div className="card">
              <div className="card-header"><span className="text-section-header">Social Media Profiles</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                
                <div className="form-group">
                  <div className="flex justify-between items-center">
                    <label className="form-label flex items-center gap-1">
                      <Facebook size={12} /> Facebook Page
                    </label>
                    {facebookUrl && (
                      <a href={facebookUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline" style={{ fontSize: 11 }}>
                        Open
                      </a>
                    )}
                  </div>
                  <input
                    className="form-input"
                    placeholder="https://facebook.com/page"
                    value={facebookUrl}
                    onChange={(e) => setFacebookUrl(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                </div>

                <div className="form-group">
                  <div className="flex justify-between items-center">
                    <label className="form-label flex items-center gap-1">
                      <Instagram size={12} /> Instagram Profile
                    </label>
                    {instagramUrl && (
                      <a href={instagramUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline" style={{ fontSize: 11 }}>
                        Open
                      </a>
                    )}
                  </div>
                  <input
                    className="form-input"
                    placeholder="https://instagram.com/handle"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                </div>

                <div className="form-group">
                  <div className="flex justify-between items-center">
                    <label className="form-label flex items-center gap-1">
                      <Video size={12} /> TikTok Profile
                    </label>
                    {tiktokUrl && (
                      <a href={tiktokUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline" style={{ fontSize: 11 }}>
                        Open
                      </a>
                    )}
                  </div>
                  <input
                    className="form-input"
                    placeholder="https://tiktok.com/@handle"
                    value={tiktokUrl}
                    onChange={(e) => setTiktokUrl(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>

      {/* FIXED BOTTOM SAVE BAR (Sticky action bar for both mobile & desktop) */}
      <div className="fixed-bottom-bar no-print">
        <div className="flex justify-between items-center" style={{ width: '100%', maxWidth: 1200, margin: '0 auto' }}>
          <div className="flex items-center gap-3">
            {error && <span style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 500 }}>✕ {error}</span>}
            {saveSuccess && <span style={{ color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>✓ Changes saved successfully</span>}
          </div>
          
          <button className="btn btn-primary btn-sm" onClick={handleSaveChanges} disabled={saving} style={{ display: 'inline-flex', gap: 6 }}>
            <Save size={14} />
            {saving ? 'Saving changes...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
