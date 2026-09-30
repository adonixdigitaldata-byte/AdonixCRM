'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Calendar,
  Clock,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  PhoneCall,
  ArrowRight,
  Sparkles,
  FileText,
} from 'lucide-react'
import type { LeadStage } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { checkFollowupConflict, type ScheduleConflict } from '@/lib/followupConflictService'

export interface StageChangePayload {
  targetStageId: string
  followupDate?: string // ISO format
  followupTime?: string // HH:mm
  followupNote?: string
  lostReason?: string
  outcome?: string
  note?: string
}

interface Props {
  isOpen: boolean
  lead: {
    id: string
    name?: string | null
    phone?: string | null
    stage_id: string
    assigned_agent_id?: string | null
  }
  fromStage?: LeadStage | null
  toStage: LeadStage
  stages: LeadStage[]
  onConfirm: (payload: StageChangePayload) => Promise<void>
  onCancel: () => void
  currentUserId?: string | null
}

const LOST_REASONS = [
  'Budget too low / Unqualified',
  'Purchased competitor solution',
  'Invalid / unreachable number',
  'No response after multiple attempts (Ghosted)',
  'Service / requirement mismatch',
  'Postponed decision indefinitely',
  'Just exploring / Not serious',
  'Other',
]

const CONTACTED_OUTCOMES = [
  {
    id: 'connected_interested',
    title: 'Connected — Interested',
    desc: 'Lead showed genuine interest; needs follow-up or qualification',
  },
  {
    id: 'connected_info_sent',
    title: 'Connected — Information / Brochure Sent',
    desc: 'Sent service materials; agreed to review and talk soon',
  },
  {
    id: 'connected_call_back',
    title: 'Connected — Asked to Call Back Later',
    desc: 'Lead requested a specific date/time to talk',
  },
  {
    id: 'no_answer',
    title: 'No Answer / Line Busy',
    desc: 'Could not connect; retry tomorrow',
  },
  {
    id: 'wrong_number',
    title: 'Wrong Number / Not Working',
    desc: 'Invalid contact details',
  },
  {
    id: 'not_interested',
    title: 'Not Interested',
    desc: 'Lead explicitly rejected or stated no interest',
  },
]

export default function StageChangeModal({
  isOpen,
  lead,
  fromStage,
  toStage,
  stages,
  onConfirm,
  onCancel,
  currentUserId,
}: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [activeTargetStageId, setActiveTargetStageId] = useState(toStage.id)
  const currentTargetStage = stages.find((s) => s.id === activeTargetStageId) || toStage
  const stageKey = currentTargetStage.key

  // Form states
  const [outcome, setOutcome] = useState('connected_info_sent')
  const [followupDate, setFollowupDate] = useState('')
  const [followupTime, setFollowupTime] = useState('11:00')
  const [followupNote, setFollowupNote] = useState('')
  const [lostReason, setLostReason] = useState(LOST_REASONS[0])
  const [generalNote, setGeneralNote] = useState('')

  // Conflict detection
  const supabase = createClient()
  const [conflict, setConflict] = useState<ScheduleConflict | null>(null)
  const [allowConflictOverlap, setAllowConflictOverlap] = useState(false)

  useEffect(() => {
    setAllowConflictOverlap(false)
  }, [followupDate, followupTime])

  // Helper date generator
  function getFutureDate(daysAhead: number): string {
    const d = new Date()
    d.setDate(d.getDate() + daysAhead)
    return d.toISOString().split('T')[0]
  }

  // Prepopulate defaults based on stage
  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setSubmitting(false)
    setActiveTargetStageId(toStage.id)

    const key = toStage.key

    if (key === 'contacted') {
      setOutcome('connected_info_sent')
      setFollowupDate(getFutureDate(2))
      setFollowupTime('11:00')
      setFollowupNote('Review information package & check client feedback')
    } else if (key === 'no_reply') {
      setFollowupDate(getFutureDate(1))
      setFollowupTime('10:00')
      setFollowupNote('Retry calling lead (no answer on attempt)')
    } else if (key === 'qualified') {
      setFollowupDate(getFutureDate(1))
      setFollowupTime('11:00')
      setFollowupNote('Discuss shortlisted proposal & finalize scope')
    } else if (key === 'followup') {
      setFollowupDate(getFutureDate(1))
      setFollowupTime('11:00')
      setFollowupNote('Scheduled follow-up discussion')
    } else if (key === 'proposal') {
      setFollowupDate(getFutureDate(1))
      setFollowupTime('12:00')
      setFollowupNote('Proposal review and feedback call')
    } else if (key === 'negotiation') {
      setFollowupDate(getFutureDate(1))
      setFollowupTime('14:00')
      setFollowupNote('Check in on contract terms & pricing')
    } else if (key === 'lost' || key === 'junk_leads') {
      setLostReason(LOST_REASONS[0])
    }
  }, [isOpen, toStage.id, toStage.key])

  // Conflict detection effect
  useEffect(() => {
    if (!isOpen) {
      setConflict(null)
      return
    }

    let scheduledIso: string | null = null
    if (followupDate) {
      const timePart = followupTime || '10:00'
      const dt = new Date(`${followupDate}T${timePart}:00`)
      if (!isNaN(dt.getTime())) scheduledIso = dt.toISOString()
    }

    if (!scheduledIso) {
      setConflict(null)
      return
    }

    const targetAgentId = lead.assigned_agent_id || currentUserId
    if (!targetAgentId) return

    let active = true
    const timer = setTimeout(async () => {
      const found = await checkFollowupConflict(supabase, {
        agentId: targetAgentId,
        scheduledAtIso: scheduledIso,
        bufferMinutes: 10,
      })
      if (active) {
        setConflict(found)
      }
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [isOpen, followupDate, followupTime, lead.assigned_agent_id, currentUserId])

  if (!isOpen) return null

  const isClosed = ['won', 'lost', 'junk_leads'].includes(stageKey)
  const isContacted = stageKey === 'contacted'
  const isLostOutcome = stageKey === 'lost' || stageKey === 'junk_leads' || (isContacted && (outcome === 'wrong_number' || outcome === 'not_interested'))
  const isQualified = stageKey === 'qualified'
  const isNoReplyOutcome = isContacted && outcome === 'no_answer'

  const needsFollowup = !isClosed && !isLostOutcome

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validation
    if (isLostOutcome && !lostReason) {
      setError('Please select a reason for marking this lead as lost/junk.')
      return
    }

    if (needsFollowup) {
      if (!followupDate) {
        setError('A next follow-up date is required so this lead does not become neglected.')
        return
      }
      if (isQualified && !followupTime) {
        setError('Please select a specific follow-up time commitment for this qualified lead.')
        return
      }
    }

    // Schedule conflict safety check
    if (conflict && !allowConflictOverlap) {
      setError(`Schedule Conflict: You already have a follow-up around ${conflict.formatted_time} with "${conflict.lead_name}". Adjust the time or check "Schedule anyway" to proceed.`)
      return
    }

    // Determine effective stage
    let effectiveStageId = activeTargetStageId
    if (isContacted) {
      if (isLostOutcome) {
        const lostStage = stages.find((s) => s.key === 'lost')
        if (lostStage) effectiveStageId = lostStage.id
      } else if (isNoReplyOutcome) {
        const noReplyStage = stages.find((s) => s.key === 'no_reply')
        if (noReplyStage) effectiveStageId = noReplyStage.id
      }
    }

    setSubmitting(true)

    try {
      let combinedFollowupIso: string | undefined
      if (followupDate && needsFollowup) {
        const timePart = followupTime || '10:00'
        combinedFollowupIso = new Date(`${followupDate}T${timePart}:00`).toISOString()
      }

      await onConfirm({
        targetStageId: effectiveStageId,
        followupDate: combinedFollowupIso,
        followupTime,
        followupNote: followupNote.trim(),
        lostReason: isLostOutcome ? lostReason : undefined,
        outcome: isContacted ? outcome : undefined,
        note: generalNote.trim(),
      })
    } catch (err: any) {
      setError(err?.message || 'Failed to update lead stage. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(3px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#FFFFFF',
          borderRadius: 8,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--accent)',
                  backgroundColor: 'rgba(79, 70, 229, 0.08)',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                Stage Advancement
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {lead.name || 'Lead'}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 3,
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}
            >
              <span>{fromStage?.label || 'Current'}</span>
              <ArrowRight size={12} />
              <span style={{ fontWeight: 600, color: currentTargetStage.color_hex }}>
                {currentTargetStage.label}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 6,
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                fontSize: 12.5,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>{error}</div>
            </div>
          )}

          {/* CONTACTED OUTCOMES */}
          {isContacted && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                Call / Contact Outcome <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                {CONTACTED_OUTCOMES.map((item) => {
                  const isSel = outcome === item.id
                  return (
                    <div
                      key={item.id}
                      onClick={() => setOutcome(item.id)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: isSel ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                        backgroundColor: isSel ? 'rgba(79, 70, 229, 0.04)' : '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12.5, fontWeight: isSel ? 600 : 500, color: isSel ? 'var(--accent)' : 'var(--text-primary)' }}>
                          {item.title}
                        </span>
                        {isSel && <CheckCircle2 size={14} color="var(--accent)" />}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {item.desc}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* QUALIFIED NOTICE */}
          {isQualified && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 6,
                backgroundColor: 'rgba(124, 58, 237, 0.06)',
                border: '1px solid rgba(124, 58, 237, 0.25)',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}
            >
              <Sparkles size={16} color="#7C3AED" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: '#5B21B6' }}>
                <strong>Qualified Buyer Commitment:</strong> Qualified leads require a scheduled follow-up commitment with date & time pickers so they remain actively worked and do not sit idle.
              </div>
            </div>
          )}

          {/* MANDATORY FOLLOW-UP SECTION FOR ACTIVE STAGES */}
          {needsFollowup && (
            <div
              style={{
                padding: '12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                backgroundColor: '#FAFAFA',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} color="var(--accent)" />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Mandatory Next Follow-up <span style={{ color: 'var(--danger)' }}>*</span>
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={followupDate}
                    onChange={(e) => setFollowupDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                    className="form-input"
                    style={{ fontSize: 12.5, padding: '6px 8px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Time {isQualified && <span style={{ color: 'var(--danger)' }}>*</span>}
                  </label>
                  <input
                    type="time"
                    value={followupTime}
                    onChange={(e) => setFollowupTime(e.target.value)}
                    required={isQualified}
                    className="form-input"
                    style={{ fontSize: 12.5, padding: '6px 8px' }}
                  />
                </div>
              </div>

              {/* CONFLICT WARNING */}
              {conflict && (
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    backgroundColor: '#FEF3C7',
                    border: '1px solid #FCD34D',
                    color: '#92400E',
                    fontSize: 11.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                    <AlertTriangle size={14} color="#D97706" />
                    <span>Schedule Conflict Detected</span>
                  </div>
                  <div>
                    Overlaps with follow-up at {conflict.formatted_time} for <strong>{conflict.lead_name}</strong>.
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, cursor: 'pointer', fontSize: 11 }}>
                    <input
                      type="checkbox"
                      checked={allowConflictOverlap}
                      onChange={(e) => setAllowConflictOverlap(e.target.checked)}
                    />
                    <span>Schedule anyway despite overlap</span>
                  </label>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Follow-up Action / Note
                </label>
                <input
                  type="text"
                  value={followupNote}
                  onChange={(e) => setFollowupNote(e.target.value)}
                  placeholder="e.g., Call to review pricing and discuss next steps"
                  className="form-input"
                  style={{ fontSize: 12.5, padding: '6px 8px' }}
                />
              </div>
            </div>
          )}

          {/* LOST / JUNK LEAD REASON */}
          {isLostOutcome && (
            <div
              style={{
                padding: '12px',
                borderRadius: 6,
                border: '1px solid #FECACA',
                backgroundColor: '#FEF2F2',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={14} color="#DC2626" />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#991B1B' }}>
                  Reason for Closing / Marking Lost <span style={{ color: 'var(--danger)' }}>*</span>
                </span>
              </div>

              <select
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                className="form-select"
                style={{ fontSize: 12.5, padding: '6px 8px' }}
              >
                {LOST_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <div style={{ fontSize: 11, color: '#7F1D1D' }}>
                Note: Marking this lead as closed will automatically mark all existing open follow-ups as resolved. Future follow-ups are not required.
              </div>
            </div>
          )}

          {/* GENERAL NOTE / TIMELINE ENTRY */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
              Timeline Note <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>(Optional)</span>
            </label>
            <textarea
              value={generalNote}
              onChange={(e) => setGeneralNote(e.target.value)}
              placeholder="Add key insights, customer objections, or next steps to the permanent timeline..."
              rows={2}
              className="form-input"
              style={{ fontSize: 12.5, padding: '6px 8px', resize: 'vertical' }}
            />
          </div>

          {/* Modal Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
              paddingTop: 10,
              borderTop: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="btn btn-outline btn-sm"
              style={{ fontSize: 12.5 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-sm"
              style={{ fontSize: 12.5 }}
            >
              {submitting ? 'Saving...' : 'Confirm Stage Change'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
