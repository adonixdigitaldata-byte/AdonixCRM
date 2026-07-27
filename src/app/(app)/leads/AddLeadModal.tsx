'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import type { LeadStage } from '@/types/database'

interface Props {
  stages: LeadStage[]
  agents: { id: string; name: string }[]
  currentUserId: string
  onClose: () => void
  onSuccess: () => void
}

const SOURCES = [
  { value: 'MANUAL', label: 'Manual entry' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'TIKTOK', label: 'TikTok' },
  { value: 'SNAPCHAT', label: 'Snapchat' },
]

export default function AddLeadModal({ stages, agents, currentUserId, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    interest: '',
    source: 'MANUAL',
    stage_id: stages[0]?.id ?? '',
    assigned_agent_id: '',
    notes: '',
  })

  const supabase = createClient()

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.phone.trim() && !form.email.trim()) e.phone = 'Phone or email is required'
    if (!form.stage_id) e.stage_id = 'Please select a stage'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setLoading(true)

    const payload: any = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      city: form.city.trim() || null,
      interest: form.interest.trim() || null,
      source: form.source,
      stage_id: form.stage_id,
      assigned_agent_id: form.assigned_agent_id || null,
      form_data: {},
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .insert(payload)
      .select()
      .single()

    if (error) {
      setErrors({ general: 'Failed to create lead. Please try again.' })
      setLoading(false)
      return
    }

    // Log activity
    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      activity_type: 'LEAD_CREATED',
      performed_by: currentUserId,
      metadata: { source: form.source },
    })

    // Add note if provided
    if (form.notes.trim()) {
      await supabase.from('lead_notes').insert({
        lead_id: lead.id,
        author_id: currentUserId,
        body: form.notes.trim(),
      })
    }

    onSuccess()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add lead</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {errors.general && (
              <div style={{
                padding: '10px 14px', background: 'var(--danger-light)',
                border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)',
                fontSize: 13, color: 'var(--danger)',
              }}>
                {errors.general}
              </div>
            )}

            {/* Name */}
            <div className="form-group">
              <label className="form-label form-label-required">Name</label>
              <input
                className={`form-input ${errors.name ? 'error' : ''}`}
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>

            {/* Phone + Email */}
            <div className="rg-2">
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  className={`form-input ${errors.phone ? 'error' : ''}`}
                  placeholder="+971 50 000 0000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                {errors.phone && <span className="form-error">{errors.phone}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="email@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            {/* City + Interest */}
            <div className="rg-2">
              <div className="form-group">
                <label className="form-label">City</label>
                <input
                  className="form-input"
                  placeholder="Dubai, Riyadh..."
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Interest</label>
                <input
                  className="form-input"
                  placeholder="Product or service interested in"
                  value={form.interest}
                  onChange={(e) => setForm({ ...form, interest: e.target.value })}
                />
              </div>
            </div>

            {/* Source + Stage */}
            <div className="rg-2">
              <div className="form-group">
                <label className="form-label">Source</label>
                <select
                  className="form-input"
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                >
                  {SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label form-label-required">Stage</label>
                <select
                  className={`form-input ${errors.stage_id ? 'error' : ''}`}
                  value={form.stage_id}
                  onChange={(e) => setForm({ ...form, stage_id: e.target.value })}
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assign agent */}
            <div className="form-group">
              <label className="form-label">Assign to agent</label>
              <select
                className="form-input"
                value={form.assigned_agent_id}
                onChange={(e) => setForm({ ...form, assigned_agent_id: e.target.value })}
              >
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Initial note */}
            <div className="form-group">
              <label className="form-label">Initial note <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
              <textarea
                className="form-input"
                placeholder="Any additional context..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  Saving...
                </>
              ) : (
                'Save lead'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
