'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow, format } from 'date-fns'
import {
  ArrowLeft, Phone, Mail, MapPin, Tag, User, Clock,
  MessageSquare, CheckCircle, Plus, X, Globe, Activity,
  FileText, ChevronDown, Edit2, MessageCircle, ExternalLink, Trash2,
} from 'lucide-react'
import type { Lead, LeadStage, Profile, LeadNote, LeadFollowup, LeadActivity } from '@/types/database'
import Link from 'next/link'

interface Props {
  lead: Lead
  profile: Profile
  stages: LeadStage[]
  agents: { id: string; name: string }[]
  notes: LeadNote[]
  followups: LeadFollowup[]
  activities: LeadActivity[]
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  LEAD_CREATED: <Plus size={12} />,
  STAGE_CHANGE: <Activity size={12} />,
  NOTE_ADDED: <MessageSquare size={12} />,
  NOTE_DELETED: <Trash2 size={12} />,
  FOLLOWUP_SCHEDULED: <Clock size={12} />,
  FOLLOWUP_COMPLETED: <CheckCircle size={12} />,
  QUOTE_SENT: <FileText size={12} />,
  INVOICE_SENT: <FileText size={12} />,
  ASSIGNED: <User size={12} />,
  PAYMENT_RECORDED: <CheckCircle size={12} />,
}

function activityText(a: LeadActivity): string {
  const m = a.metadata as any
  switch (a.activity_type as string) {
    case 'LEAD_CREATED': return 'Lead created'
    case 'STAGE_CHANGE': return `Moved from ${m?.from_stage ?? '—'} to ${m?.to_stage ?? '—'}`
    case 'NOTE_ADDED': return 'Note added'
    case 'NOTE_DELETED': return 'Note deleted'
    case 'FOLLOWUP_SCHEDULED': return `Follow-up scheduled for ${m?.date ? format(new Date(m.date), 'dd MMM') : '—'}`
    case 'FOLLOWUP_COMPLETED': return 'Follow-up marked complete'
    case 'QUOTE_SENT': return `Quotation ${m?.quote_number ?? ''} sent`
    case 'INVOICE_SENT': return `Invoice ${m?.invoice_number ?? ''} sent`
    case 'ASSIGNED': return `Assigned to ${m?.agent_name ?? '—'}`
    case 'PAYMENT_RECORDED': return `Payment of ${m?.amount ?? ''} recorded`
    default: return a.activity_type
  }
}

export default function LeadDetailClient({
  lead: initialLead,
  profile,
  stages,
  agents,
  notes: initialNotes,
  followups: initialFollowups,
  activities: initialActivities,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [lead, setLead] = useState(initialLead)
  const [notes, setNotes] = useState(initialNotes)
  const [followups, setFollowups] = useState(initialFollowups)
  const [activities, setActivities] = useState(initialActivities)
  const [activeTab, setActiveTab] = useState<'notes' | 'followups' | 'activity'>('notes')

  // Edit lead modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({
    name: lead.name ?? '',
    phone: lead.phone ?? '',
    email: lead.email ?? '',
    city: lead.city ?? '',
    interest: lead.interest ?? '',
  })
  const [editLoading, setEditLoading] = useState(false)

  // Note form
  const [noteText, setNoteText] = useState('')
  const [noteLoading, setNoteLoading] = useState(false)

  // Follow-up form
  const [showFollowupForm, setShowFollowupForm] = useState(false)
  const [fuDate, setFuDate] = useState('')
  const [fuNote, setFuNote] = useState('')
  const [fuLoading, setFuLoading] = useState(false)

  // Stage & Agent loading
  const [stageLoading, setStageLoading] = useState(false)
  const [agentLoading, setAgentLoading] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEditLoading(true)

    const updatedData = {
      name: editForm.name.trim() || null,
      phone: editForm.phone.trim() || null,
      email: editForm.email.trim() || null,
      city: editForm.city.trim() || null,
      interest: editForm.interest.trim() || null,
    }

    const { error } = await supabase
      .from('leads')
      .update(updatedData)
      .eq('id', lead.id)

    if (!error) {
      setLead({ ...lead, ...updatedData })
      setShowEditModal(false)
    }
    setEditLoading(false)
  }

  async function handleStageChange(newStageId: string) {
    if (newStageId === lead.stage_id || stageLoading) return
    setStageLoading(true)
    const oldStageId = lead.stage_id

    await supabase.from('leads').update({ stage_id: newStageId }).eq('id', lead.id)
    await supabase.from('lead_stage_history').insert({
      lead_id: lead.id, from_stage_id: oldStageId, to_stage_id: newStageId, changed_by: profile.id,
    })

    const toStage = stages.find((s) => s.id === newStageId)
    const fromStage = stages.find((s) => s.id === oldStageId)
    const { data: newActivity } = await supabase.from('lead_activities').insert({
      lead_id: lead.id, activity_type: 'STAGE_CHANGE', performed_by: profile.id,
      metadata: { from_stage: fromStage?.label, to_stage: toStage?.label },
    }).select('*, performer:profiles(id, name)').single()

    setLead({ ...lead, stage_id: newStageId, stage: toStage })
    if (newActivity) setActivities([newActivity as any, ...activities])
    setStageLoading(false)
  }

  async function handleAgentChange(agentId: string) {
    if (agentLoading) return
    setAgentLoading(true)
    const agent = agents.find((a) => a.id === agentId)
    await supabase.from('leads').update({ assigned_agent_id: agentId || null }).eq('id', lead.id)
    const { data: act } = await supabase.from('lead_activities').insert({
      lead_id: lead.id, activity_type: 'ASSIGNED', performed_by: profile.id,
      metadata: { agent_name: agent?.name ?? 'Unassigned' },
    }).select('*, performer:profiles(id, name)').single()
    setLead({ ...lead, assigned_agent_id: agentId || null, assigned_agent: agent as any })
    if (act) setActivities([act as any, ...activities])
    setAgentLoading(false)
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault()
    if (!noteText.trim() || noteLoading) return
    setNoteLoading(true)
    const { data: note } = await supabase.from('lead_notes').insert({
      lead_id: lead.id, author_id: profile.id, body: noteText.trim(),
    }).select('*, author:profiles(id, name)').single()
    await supabase.from('lead_activities').insert({
      lead_id: lead.id, activity_type: 'NOTE_ADDED', performed_by: profile.id,
    })
    if (note) setNotes([note as any, ...notes])
    setNoteText('')
    setNoteLoading(false)
  }

  async function handleDeleteNote(noteId: string) {
    const noteToDelete = notes.find((n) => n.id === noteId)
    if (!noteToDelete) return

    const { error } = await supabase.from('lead_notes').delete().eq('id', noteId)
    if (!error) {
      setNotes(notes.filter((n) => n.id !== noteId))
      const { data: act } = await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'NOTE_DELETED',
        performed_by: profile.id,
      }).select('*, performer:profiles(id, name)').single()
      if (act) setActivities([act as any, ...activities])
    }
  }

  async function addFollowup(e: React.FormEvent) {
    e.preventDefault()
    if (!fuDate || fuLoading) return
    setFuLoading(true)
    const { data: fu } = await supabase.from('lead_followups').insert({
      lead_id: lead.id, agent_id: profile.id, scheduled_at: new Date(fuDate).toISOString(),
      note: fuNote.trim() || null,
    }).select('*, agent:profiles(id, name)').single()
    await supabase.from('lead_activities').insert({
      lead_id: lead.id, activity_type: 'FOLLOWUP_SCHEDULED', performed_by: profile.id,
      metadata: { date: fuDate },
    })
    if (fu) setFollowups([...followups, fu as any])
    setFuDate(''); setFuNote(''); setShowFollowupForm(false); setFuLoading(false)
  }

  async function completeFollowup(fuId: string) {
    await supabase.from('lead_followups').update({
      is_completed: true, completed_at: new Date().toISOString(),
    }).eq('id', fuId)
    await supabase.from('lead_activities').insert({
      lead_id: lead.id, activity_type: 'FOLLOWUP_COMPLETED', performed_by: profile.id,
    })
    setFollowups(followups.map((f) => f.id === fuId ? { ...f, is_completed: true } : f))
  }

  const formDataEntries = Object.entries(lead.form_data ?? {})
  const cleanPhone = lead.phone ? lead.phone.replace(/[^0-9]/g, '') : ''
  const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : null
  const telUrl = lead.phone ? `tel:${lead.phone}` : null
  const mailtoUrl = lead.email ? `mailto:${lead.email}` : null

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => router.push('/leads')}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-page-title">{lead.name ?? 'Unknown lead'}</h1>
            <p className="text-meta" style={{ marginTop: 2 }}>
              Added {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              setEditForm({
                name: lead.name ?? '',
                phone: lead.phone ?? '',
                email: lead.email ?? '',
                city: lead.city ?? '',
                interest: lead.interest ?? '',
              })
              setShowEditModal(true)
            }}
          >
            <Edit2 size={14} />
            Edit lead
          </button>
          <Link href={`/quotations/create?lead_id=${lead.id}`} className="btn btn-primary btn-sm">
            <FileText size={14} />
            Create quotation
          </Link>
        </div>
      </div>

      {/* Main Two-column Balanced Layout */}
      <div className="page-body rg-lead-detail">
        {/* LEFT COLUMN: Main Activity Hub & Dynamic Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Lead Overview & Quick Contact Card */}
          <div className="card">
            <div className="card-body flex items-center justify-between flex-wrap gap-4 lead-detail-header-card" style={{ padding: '16px 20px' }}>
              <div className="flex items-center gap-3">
                <div className="avatar avatar-md" style={{ width: 44, height: 44, fontSize: 16 }}>
                  {(lead.name ?? 'L').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {lead.name ?? 'Unnamed Lead'}
                    </span>
                    {lead.stage && (
                      <span
                        className="badge"
                        style={{
                          background: lead.stage.color_hex + '18',
                          color: lead.stage.color_hex,
                          border: `1px solid ${lead.stage.color_hex}40`,
                          fontSize: 11,
                        }}
                      >
                        {lead.stage.label}
                      </span>
                    )}
                  </div>
                  <p className="text-meta" style={{ marginTop: 2 }}>
                    Source: <strong style={{ color: 'var(--text-primary)' }}>{lead.source.replace('_', ' ')}</strong> · Assigned to: <strong style={{ color: 'var(--text-primary)' }}>{(lead as any).assigned_agent?.name ?? 'Unassigned'}</strong>
                  </p>
                </div>
              </div>

              {/* Direct Contact CTAs */}
              <div className="flex items-center gap-2">
                {telUrl && (
                  <a
                    href={telUrl}
                    className="btn btn-outline btn-sm"
                    style={{ gap: 6 }}
                  >
                    <Phone size={14} />
                    Call
                  </a>
                )}
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-sm"
                    style={{ gap: 6, color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4' }}
                  >
                    <MessageCircle size={14} />
                    WhatsApp
                  </a>
                )}
                {mailtoUrl && (
                  <a
                    href={mailtoUrl}
                    className="btn btn-outline btn-sm"
                    style={{ gap: 6 }}
                  >
                    <Mail size={14} />
                    Email
                  </a>
                )}
              </div>
            </div>
          </div>
          
          {/* Tabs: Notes, Followups, Activity Timeline */}
          <div className="card">
            <div className="tabs" style={{ padding: '0 8px' }}>
              {(['notes', 'followups', 'activity'] as const).map((tab) => (
                <button
                  key={tab}
                  className={`tab ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === 'notes' && notes.length > 0 && (
                    <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {notes.length}
                    </span>
                  )}
                  {tab === 'followups' && followups.filter(f => !f.is_completed).length > 0 && (
                    <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--warning)' }}>
                      {followups.filter(f => !f.is_completed).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div style={{ padding: 20 }}>
              {/* Notes tab */}
              {activeTab === 'notes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <form onSubmit={addNote} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <textarea
                      className="form-input"
                      placeholder="Add a note regarding conversation, requirements, or next steps..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      rows={3}
                      style={{ resize: 'vertical', minHeight: 90 }}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={!noteText.trim() || noteLoading}
                      style={{ alignSelf: 'flex-end' }}
                    >
                      {noteLoading ? 'Saving...' : 'Add note'}
                    </button>
                  </form>

                  {notes.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>
                      No notes yet — add one above
                    </p>
                  ) : (
                    notes.map((note) => (
                      <div
                        key={note.id}
                        style={{
                          padding: '12px 14px', background: 'var(--bg)',
                          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 6, whiteSpace: 'pre-wrap', flex: 1 }}>
                            {note.body}
                          </p>
                          {(profile.role === 'ADMIN' || note.author_id === profile.id) && (
                            <button
                              className="btn btn-ghost btn-icon btn-xs"
                              onClick={() => handleDeleteNote(note.id)}
                              style={{ color: 'var(--text-tertiary)' }}
                              title="Delete note"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                        <p className="text-meta">
                          {(note as any).author?.name ?? 'Unknown'} ·{' '}
                          {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Follow-ups tab */}
              {activeTab === 'followups' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {!showFollowupForm ? (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setShowFollowupForm(true)}
                    >
                      <Plus size={13} />
                      Schedule follow-up
                    </button>
                  ) : (
                    <form onSubmit={addFollowup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">Date & time</label>
                        <input
                          type="datetime-local"
                          className="form-input"
                          value={fuDate}
                          onChange={(e) => setFuDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Note <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
                        <textarea
                          className="form-input"
                          placeholder="What to discuss during follow-up..."
                          value={fuNote}
                          onChange={(e) => setFuNote(e.target.value)}
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowFollowupForm(false)}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={fuLoading}>
                          {fuLoading ? 'Saving...' : 'Save follow-up'}
                        </button>
                      </div>
                    </form>
                  )}

                  {followups.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>
                      No follow-ups scheduled — schedule one above
                    </p>
                  ) : (
                    followups.map((fu) => {
                      const isOverdue = !fu.is_completed && new Date(fu.scheduled_at) < new Date()
                      return (
                        <div
                          key={fu.id}
                          style={{
                            padding: '12px 14px',
                            background: fu.is_completed ? 'var(--success-light)' : isOverdue ? 'var(--danger-light)' : 'var(--bg)',
                            border: `1px solid ${fu.is_completed ? 'var(--success)' : isOverdue ? 'var(--danger)' : 'var(--border)'}`,
                            borderRadius: 'var(--radius-sm)',
                            opacity: fu.is_completed ? 0.7 : 1,
                          }}
                        >
                          <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                            <span style={{
                              fontSize: 13, fontWeight: 600,
                              color: fu.is_completed ? 'var(--success)' : isOverdue ? 'var(--danger)' : 'var(--text-primary)',
                            }}>
                              {format(new Date(fu.scheduled_at), 'dd MMM yyyy, HH:mm')}
                            </span>
                            {!fu.is_completed && (
                              <button
                                className="btn btn-ghost btn-xs"
                                onClick={() => completeFollowup(fu.id)}
                                style={{ color: 'var(--success)' }}
                              >
                                <CheckCircle size={13} />
                                Mark complete
                              </button>
                            )}
                          </div>
                          {fu.note && (
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{fu.note}</p>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* Activity tab */}
              {activeTab === 'activity' && (
                <div className="timeline" style={{ padding: '8px 0' }}>
                  {activities.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>
                      No activity recorded yet
                    </p>
                  ) : (
                    activities.map((act) => (
                      <div key={act.id} className="timeline-item">
                        <div className="timeline-icon">
                          {ACTIVITY_ICONS[act.activity_type] ?? <Activity size={12} />}
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-text">{activityText(act)}</div>
                          <div className="timeline-time">
                            {(act as any).performer?.name ?? 'System'} ·{' '}
                            {formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Ad attribution */}
          {(lead.campaign || lead.ad_set || lead.ad) && (
            <div className="card">
              <div className="card-header">
                <span className="text-section-header">Ad attribution</span>
                <span className="badge badge-info">Meta Ads</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {lead.ad?.creative_thumbnail_url && (
                  <img
                    src={lead.ad.creative_thumbnail_url}
                    alt="Ad creative"
                    style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                  />
                )}
                {lead.campaign && (
                  <div className="flex items-center gap-3">
                    <span className="text-label" style={{ width: 90, flexShrink: 0 }}>Campaign</span>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{lead.campaign.name}</span>
                  </div>
                )}
                {lead.ad_set && (
                  <div className="flex items-center gap-3">
                    <span className="text-label" style={{ width: 90, flexShrink: 0 }}>Ad set</span>
                    <span style={{ fontSize: 14 }}>{lead.ad_set.name}</span>
                  </div>
                )}
                {lead.ad && (
                  <div className="flex items-center gap-3">
                    <span className="text-label" style={{ width: 90, flexShrink: 0 }}>Ad</span>
                    <span style={{ fontSize: 14 }}>{lead.ad.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Original submission */}
          {formDataEntries.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="text-section-header">Original submission data</span>
                <span className="text-label">{formDataEntries.length} fields</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {formDataEntries.map(([key, value]) => (
                  <div key={key} className="flex gap-3">
                    <span className="text-label" style={{ width: 140, flexShrink: 0, textTransform: 'capitalize' }}>
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: 13, wordBreak: 'break-all' }}>{String(value)}</span>
                  </div>
                ))}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowRaw(!showRaw)}
                  style={{ alignSelf: 'flex-start', marginTop: 4 }}
                >
                  <ChevronDown size={13} style={{ transform: showRaw ? 'rotate(180deg)' : undefined }} />
                  {showRaw ? 'Hide' : 'Show'} raw payload
                </button>
                {showRaw && lead.raw_payload && (
                  <pre style={{
                    fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg)',
                    padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                    overflow: 'auto', maxHeight: 200,
                  }}>
                    {JSON.stringify(lead.raw_payload, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Sidebar (Contact, Stage, Agent) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Contact info card with EDIT button */}
          <div className="card">
            <div className="card-header">
              <span className="text-section-header">Contact info</span>
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => {
                  setEditForm({
                    name: lead.name ?? '',
                    phone: lead.phone ?? '',
                    email: lead.email ?? '',
                    city: lead.city ?? '',
                    interest: lead.interest ?? '',
                  })
                  setShowEditModal(true)
                }}
              >
                <Edit2 size={13} />
                Edit
              </button>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="flex items-center gap-3">
                <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}><User size={14} /></span>
                <span className="text-label" style={{ width: 56, flexShrink: 0 }}>Name</span>
                <span style={{ fontSize: 13, color: lead.name ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: lead.name ? 500 : 400 }}>
                  {lead.name ?? '—'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                  <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}><Phone size={14} /></span>
                  <span className="text-label" style={{ width: 56, flexShrink: 0 }}>Phone</span>
                  <span style={{ fontSize: 13, color: lead.phone ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: lead.phone ? 500 : 400 }}>
                    {lead.phone ?? '—'}
                  </span>
                </div>
                {lead.phone && (
                  <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                    {telUrl && (
                      <a href={telUrl} className="btn btn-ghost btn-icon btn-xs" title="Call phone number">
                        <Phone size={13} />
                      </a>
                    )}
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-icon btn-xs"
                        style={{ color: '#16a34a' }}
                        title="Chat on WhatsApp"
                      >
                        <MessageCircle size={13} />
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                  <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}><Mail size={14} /></span>
                  <span className="text-label" style={{ width: 56, flexShrink: 0 }}>Email</span>
                  <span style={{ fontSize: 13, color: lead.email ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: lead.email ? 500 : 400, wordBreak: 'break-all' }}>
                    {lead.email ?? '—'}
                  </span>
                </div>
                {mailtoUrl && (
                  <a href={mailtoUrl} className="btn btn-ghost btn-icon btn-xs" title="Send email" style={{ flexShrink: 0 }}>
                    <Mail size={13} />
                  </a>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}><MapPin size={14} /></span>
                <span className="text-label" style={{ width: 56, flexShrink: 0 }}>City</span>
                <span style={{ fontSize: 13, color: lead.city ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: lead.city ? 500 : 400 }}>
                  {lead.city ?? '—'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}><Tag size={14} /></span>
                <span className="text-label" style={{ width: 56, flexShrink: 0 }}>Interest</span>
                <span style={{ fontSize: 13, color: lead.interest ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: lead.interest ? 500 : 400 }}>
                  {lead.interest ?? '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Stage selector */}
          <div className="card">
            <div className="card-header">
              <span className="text-section-header">Stage</span>
              {stageLoading && <span className="spinner" style={{ width: 14, height: 14 }} />}
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {stages.map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => handleStageChange(stage.id)}
                  className="btn"
                  style={{
                    justifyContent: 'flex-start',
                    background: lead.stage_id === stage.id ? stage.color_hex + '18' : 'transparent',
                    border: `1px solid ${lead.stage_id === stage.id ? stage.color_hex : 'var(--border)'}`,
                    color: lead.stage_id === stage.id ? stage.color_hex : 'var(--text-secondary)',
                    fontWeight: lead.stage_id === stage.id ? 600 : 400,
                    padding: '7px 12px',
                    gap: 8,
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: stage.color_hex, flexShrink: 0,
                  }} />
                  {stage.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assign agent */}
          <div className="card">
            <div className="card-header">
              <span className="text-section-header">Assigned agent</span>
              {agentLoading && <span className="spinner" style={{ width: 14, height: 14 }} />}
            </div>
            <div className="card-body">
              <select
                className="form-input"
                value={lead.assigned_agent_id ?? ''}
                onChange={(e) => handleAgentChange(e.target.value)}
                disabled={agentLoading}
              >
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

        </div>
      </div>

      {/* EDIT LEAD MODAL */}
      {showEditModal && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit lead details</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowEditModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label form-label-required">Name</label>
                  <input
                    className="form-input"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="rg-2">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      className="form-input"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-input"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="rg-2">
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input
                      className="form-input"
                      value={editForm.city}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Interest</label>
                    <input
                      className="form-input"
                      value={editForm.interest}
                      onChange={(e) => setEditForm({ ...editForm, interest: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editLoading}>
                  {editLoading ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
