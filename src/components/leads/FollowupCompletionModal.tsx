'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  CheckCircle2,
  Calendar,
  Clock,
  AlertTriangle,
  ArrowRight,
  PhoneCall,
  UserX,
  CalendarClock,
  Flame,
} from 'lucide-react'
import type { LeadStage, LeadFollowup } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { checkFollowupConflict, type ScheduleConflict } from '@/lib/followupConflictService'

export interface FollowupCompletionData {
  followupId: string
  outcomeNote: string
  targetStageId: string
  nextStepType: 'FOLLOWUP' | 'LOST' | 'NONE'
  nextFollowupDate?: string // ISO
  nextFollowupNote?: string
  lostReason?: string
}

interface Props {
  isOpen: boolean
  followup: LeadFollowup | null
  lead: {
    id: string
    name?: string | null
    phone?: string | null
    stage_id: string
    assigned_agent_id?: string | null
  }
  stages: LeadStage[]
  onClose: () => void
  onSubmit: (data: FollowupCompletionData) => Promise<void>
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

export default function FollowupCompletionModal({
  isOpen,
  followup,
  lead,
  stages,
  onClose,
  onSubmit,
  currentUserId,
}: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Outcome Note
  const [outcomeNote, setOutcomeNote] = useState('')

  // Step 2: Stage Selection (always visible on top)
  const [targetStageId, setTargetStageId] = useState(lead.stage_id)

  // Step 3: Next Action Type
  const [nextStepType, setNextStepType] = useState<'FOLLOWUP' | 'LOST' | 'NONE'>('FOLLOWUP')

  // Follow-up details
  const [nextFollowupDate, setNextFollowupDate] = useState('')
  const [nextFollowupTime, setNextFollowupTime] = useState('11:00')
  const [nextFollowupNote, setNextFollowupNote] = useState('')

  // Lost details
  const [lostReason, setLostReason] = useState(LOST_REASONS[0])

  // Conflict detection (10-minute window)
  const supabase = createClient()
  const [conflict, setConflict] = useState<ScheduleConflict | null>(null)
  const [allowConflictOverlap, setAllowConflictOverlap] = useState(false)

  function getFutureDate(daysAhead: number): string {
    const d = new Date()
    d.setDate(d.getDate() + daysAhead)
    return d.toISOString().split('T')[0]
  }

  // Initialize form when opened
  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setSubmitting(false)
    setOutcomeNote('')
    setTargetStageId(lead.stage_id)
    setNextStepType('FOLLOWUP')
    setNextFollowupDate(getFutureDate(1))
    setNextFollowupTime('11:00')
    setNextFollowupNote(
      followup?.note ? `Follow-up after: ${followup.note}` : 'Check client feedback & next steps'
    )
    setLostReason(LOST_REASONS[0])
    setConflict(null)
    setAllowConflictOverlap(false)
  }, [isOpen, lead.stage_id, followup])

  // Reset conflict toggle on date/time change
  useEffect(() => {
    setAllowConflictOverlap(false)
  }, [nextFollowupDate, nextFollowupTime, nextStepType])

  // Conflict detection effect (10-minute buffer)
  useEffect(() => {
    if (!isOpen || nextStepType !== 'FOLLOWUP' || !nextFollowupDate) {
      setConflict(null)
      return
    }

    const timePart = nextFollowupTime || '11:00'
    const dt = new Date(`${nextFollowupDate}T${timePart}:00`)
    if (isNaN(dt.getTime())) return

    const targetAgentId = followup?.agent_id || lead.assigned_agent_id || currentUserId
    if (!targetAgentId) return

    let active = true
    const timer = setTimeout(async () => {
      const found = await checkFollowupConflict(supabase, {
        agentId: targetAgentId,
        scheduledAtIso: dt.toISOString(),
        excludeFollowupId: followup?.id,
        bufferMinutes: 10,
      })
      if (active) setConflict(found)
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [isOpen, nextStepType, nextFollowupDate, nextFollowupTime, followup?.id, followup?.agent_id, lead.assigned_agent_id, currentUserId])

  // Sync when user changes Stage dropdown on top
  function handleStageChange(newStageId: string) {
    setTargetStageId(newStageId)
    const stg = stages.find((s) => s.id === newStageId)
    if (!stg) return

    if (stg.key === 'lost' || stg.key === 'junk_leads') {
      setNextStepType('LOST')
    } else if (stg.key === 'won') {
      setNextStepType('NONE')
    } else {
      // Active stage: restore to follow-up if previously on lost
      if (nextStepType === 'LOST') {
        setNextStepType('FOLLOWUP')
      }
    }
  }

  // Sync when user clicks Next Step cards
  function handleSelectNextStep(type: 'FOLLOWUP' | 'LOST' | 'NONE') {
    setNextStepType(type)
    if (type === 'LOST') {
      const lostStage = stages.find((s) => s.key === 'lost')
      if (lostStage) setTargetStageId(lostStage.id)
    } else if (type === 'FOLLOWUP') {
      const currentSelected = stages.find((s) => s.id === targetStageId)
      if (currentSelected?.key === 'lost' || currentSelected?.key === 'junk_leads') {
        setTargetStageId(lead.stage_id)
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!followup) return
    setError(null)

    if (!outcomeNote.trim()) {
      setError('Please provide a brief outcome note describing what was discussed.')
      return
    }

    const selectedStg = stages.find((s) => s.id === targetStageId)
    const isQualified = selectedStg?.key === 'qualified'

    if (isQualified && nextStepType !== 'FOLLOWUP') {
      setError('Moving to "Qualified" requires scheduling a mandatory follow-up commitment to prevent stagnation.')
      return
    }

    if (nextStepType === 'FOLLOWUP' && !nextFollowupDate) {
      setError('Please specify when the next follow-up call should take place.')
      return
    }

    // 10-min conflict warning
    if (conflict && !allowConflictOverlap && nextStepType === 'FOLLOWUP') {
      setError(`⚠️ 10-Min Conflict: You already have a follow-up scheduled around ${conflict.formatted_time} with "${conflict.lead_name}". Adjust the time or check "Schedule anyway" below.`)
      return
    }

    try {
      setSubmitting(true)
      let isoDate: string | undefined = undefined
      if (nextStepType === 'FOLLOWUP' && nextFollowupDate) {
        const timePart = nextFollowupTime || '11:00'
        isoDate = new Date(`${nextFollowupDate}T${timePart}:00`).toISOString()
      }

      await onSubmit({
        followupId: followup.id,
        outcomeNote: outcomeNote.trim(),
        targetStageId,
        nextStepType,
        nextFollowupDate: isoDate,
        nextFollowupNote: nextFollowupNote.trim() || undefined,
        lostReason: nextStepType === 'LOST' ? lostReason : undefined,
      })

      onClose()
    } catch (err: any) {
      console.error('Error completing follow-up:', err)
      setError(err?.message || 'Failed to complete follow-up.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || !followup) return null

  const selectedStageObj = stages.find((s) => s.id === targetStageId)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: '#DCFCE7',
                color: '#15803D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.15)',
              }}
            >
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Follow-up Completed: What is the Outcome?
              </h3>
              <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>
                Lead: <strong style={{ color: '#1E293B' }}>{lead.name || 'Unnamed Lead'}</strong>
                {lead.phone ? ` • ${lead.phone}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#991B1B',
                fontSize: 12.5,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Follow-up Note Reference */}
          {followup.note && (
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                color: '#475569',
              }}
            >
              <span style={{ fontWeight: 700, color: '#0F172A' }}>Completed Task: </span>
              {followup.note}
            </div>
          )}

          {/* 1. Outcome Note */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                1. Quick Outcome Note <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>Logged to lead activity &amp; notes</span>
            </div>
            <textarea
              value={outcomeNote}
              onChange={(e) => setOutcomeNote(e.target.value)}
              placeholder="e.g. Spoke on phone, confirmed interest in proposal; requested payment details and callback tomorrow."
              rows={2}
              required
              className="form-input"
              style={{ width: '100%', fontSize: 13, padding: '8px 12px', resize: 'vertical' }}
            />
          </div>

          {/* 2. Pipeline Stage Selector (ALWAYS VISIBLE ON TOP) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                2. Current / Target Pipeline Stage
              </label>
              {selectedStageObj && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    backgroundColor: `${selectedStageObj.color_hex}15`,
                    color: selectedStageObj.color_hex,
                    border: `1px solid ${selectedStageObj.color_hex}40`,
                  }}
                >
                  {selectedStageObj.label}
                </span>
              )}
            </div>
            <select
              value={targetStageId}
              onChange={(e) => handleStageChange(e.target.value)}
              className="form-input"
              style={{
                width: '100%',
                fontWeight: 600,
                fontSize: 13,
                padding: '9px 12px',
                borderRadius: 8,
                background: '#FFFFFF',
              }}
            >
              {stages.map((stg) => (
                <option key={stg.id} value={stg.id}>
                  {stg.label} {stg.id === lead.stage_id ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Next Step Selection */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', display: 'block', marginBottom: 8 }}>
              3. What is the Next Step?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {/* Option A: Schedule Follow-up */}
              <button
                type="button"
                onClick={() => handleSelectNextStep('FOLLOWUP')}
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: `2px solid ${nextStepType === 'FOLLOWUP' ? 'var(--accent)' : '#E2E8F0'}`,
                  backgroundColor: nextStepType === 'FOLLOWUP' ? 'rgba(79, 70, 229, 0.05)' : '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: nextStepType === 'FOLLOWUP' ? 'var(--accent)' : '#0F172A' }}>
                  <CalendarClock size={16} />
                  <span>📅 Next Follow-up</span>
                </div>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  Keeps lead active and non-idle
                </div>
              </button>

              {/* Option B: Mark as Lost */}
              <button
                type="button"
                onClick={() => handleSelectNextStep('LOST')}
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: `2px solid ${nextStepType === 'LOST' ? '#DC2626' : '#E2E8F0'}`,
                  backgroundColor: nextStepType === 'LOST' ? '#FEF2F2' : '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: nextStepType === 'LOST' ? '#DC2626' : '#0F172A' }}>
                  <UserX size={16} />
                  <span>❌ Mark as Lost</span>
                </div>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  Lead rejected or unqualified
                </div>
              </button>
            </div>

            {/* Option C: Leave Idle (Subtle button below) */}
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => handleSelectNextStep('NONE')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: `1px solid ${nextStepType === 'NONE' ? '#D97706' : '#E2E8F0'}`,
                  backgroundColor: nextStepType === 'NONE' ? '#FFFBEB' : '#F8FAFC',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  color: nextStepType === 'NONE' ? '#92400E' : '#64748B',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                  <AlertTriangle size={14} color={nextStepType === 'NONE' ? '#D97706' : '#94A3B8'} />
                  Leave Idle (No Scheduled Next Action)
                </span>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>Risks stagnation</span>
              </button>
            </div>
          </div>

          {/* Conditional Form: Schedule Follow-up */}
          {nextStepType === 'FOLLOWUP' && (
            <div
              style={{
                backgroundColor: '#F8FAFC',
                borderRadius: 8,
                padding: '12px 14px',
                border: '1px solid #E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
                  Follow-up Date &amp; Time <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8 }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={nextFollowupDate}
                      onChange={(e) => setNextFollowupDate(e.target.value)}
                      className="form-input"
                      style={{ fontSize: 12.5, width: '100%' }}
                    />
                  </div>
                  <div>
                    <input
                      type="time"
                      required
                      value={nextFollowupTime}
                      onChange={(e) => setNextFollowupTime(e.target.value)}
                      className="form-input"
                      style={{ fontSize: 12.5, width: '100%' }}
                    />
                  </div>
                </div>

                {/* Quick Date Presets */}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {[
                    { label: 'Tomorrow', days: 1, time: '11:00' },
                    { label: 'In 2 Days', days: 2, time: '11:00' },
                    { label: 'Next Week', days: 7, time: '11:00' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setNextFollowupDate(getFutureDate(preset.days))
                        setNextFollowupTime(preset.time)
                      }}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 10-Minute Conflict Alert */}
              {conflict && (
                <div
                  style={{
                    backgroundColor: '#FEF3C7',
                    border: '1px solid #FCD34D',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 12,
                    color: '#92400E',
                  }}
                >
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={14} color="#D97706" />
                    <span>10-Minute Schedule Conflict</span>
                  </div>
                  <div style={{ marginTop: 2, fontSize: 11.5 }}>
                    You have another commitment around <strong>{conflict.formatted_time}</strong> with <strong>{conflict.lead_name}</strong>.
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, cursor: 'pointer', fontSize: 11.5, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={allowConflictOverlap}
                      onChange={(e) => setAllowConflictOverlap(e.target.checked)}
                    />
                    <span>Schedule anyway (allow overlap)</span>
                  </label>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>
                  Follow-up Agenda / Note
                </label>
                <input
                  type="text"
                  value={nextFollowupNote}
                  onChange={(e) => setNextFollowupNote(e.target.value)}
                  placeholder="e.g. Call back regarding pricing proposal"
                  className="form-input"
                  style={{ fontSize: 12.5, width: '100%' }}
                />
              </div>
            </div>
          )}

          {/* Conditional Form: Mark as Lost */}
          {nextStepType === 'LOST' && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                borderRadius: 8,
                padding: '12px 14px',
                border: '1px solid #FECACA',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#991B1B' }}>
                Reason for marking as Lost
              </div>
              <select
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                className="form-input"
                style={{ fontSize: 12.5, width: '100%', background: '#FFFFFF' }}
              >
                {LOST_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: '#7F1D1D' }}>
                Lost reason will be logged to notes. All open follow-ups will be auto-resolved.
              </div>
            </div>
          )}

          {/* Conditional Warning: Leave Idle */}
          {nextStepType === 'NONE' && (
            <div
              style={{
                backgroundColor: '#FFFBEB',
                borderRadius: 8,
                padding: '12px 14px',
                border: '1px solid #FDE68A',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#92400E' }}>
                  Stagnation Warning
                </div>
                <div style={{ fontSize: 11.5, color: '#B45309', marginTop: 2 }}>
                  Active leads without a scheduled next step become <strong>Idle</strong> and risk churn. You can always schedule a follow-up later from the lead detail page.
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              paddingTop: 10,
              borderTop: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn btn-outline btn-sm"
              style={{ padding: '7px 14px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-sm"
              style={{
                padding: '7px 18px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <CheckCircle2 size={15} />
              <span>{submitting ? 'Saving...' : 'Complete Follow-up & Save'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
