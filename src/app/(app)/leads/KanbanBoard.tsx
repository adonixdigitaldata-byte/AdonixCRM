'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Phone, Globe, FileUp, MessageCircle, GripVertical, Send, AlertTriangle } from 'lucide-react'
import type { Lead, LeadStage } from '@/types/database'
import StageChangeModal, { type StageChangePayload } from '@/components/leads/StageChangeModal'

interface Props {
  leads: Lead[]
  stages: LeadStage[]
  loading: boolean
  onLeadMoved: () => void
  currentUserId: string
  pendingFollowupLeadIds?: string[]
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  META_ADS: <Globe size={11} />,
  MANUAL: <Phone size={11} />,
  COLD_OUTREACH: <Send size={11} />,
  XLSX_IMPORT: <FileUp size={11} />,
  WHATSAPP: <MessageCircle size={11} />,
}

function KanbanCard({
  lead,
  isIdle = false,
  idleBadgeText = 'No next action scheduled',
}: {
  lead: Lead
  isIdle?: boolean
  idleBadgeText?: string | null
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? 'transform 150ms ease-out',
    opacity: isDragging ? 0.5 : 1,
  }

  const router = useRouter()

  const daysInStage = lead.updated_at
    ? Math.floor(
        (Date.now() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      )
    : 0

  const agentInitials = lead.assigned_agent?.name
    ? lead.assigned_agent.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : null

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        ...(isIdle ? { borderLeft: '3px solid var(--danger)' } : {}),
      }}
      {...attributes}
      className={`kanban-card ${isDragging ? 'dragging' : ''}`}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation()
          router.push(`/leads/${lead.id}`)
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="kanban-card-name" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {lead.name ?? 'Unknown'}
          </div>
          <div className="kanban-card-meta">
            <span className="kanban-card-phone">
              {SOURCE_ICONS[lead.source] ?? <Globe size={11} />}
              {lead.phone ?? lead.email ?? '—'}
            </span>
          </div>

          {/* Idle Lead Warning Badge */}
          {isIdle && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--danger)',
                backgroundColor: 'rgba(220, 38, 38, 0.08)',
                border: '1px solid rgba(220, 38, 38, 0.2)',
                padding: '2px 5px',
                borderRadius: 4,
                marginTop: 4,
                width: 'fit-content',
              }}
              title="This active lead has no pending follow-up scheduled"
            >
              <AlertTriangle size={10} style={{ flexShrink: 0 }} />
              <span>{idleBadgeText || 'No next action scheduled'}</span>
            </div>
          )}
        </div>

        {/* Dedicated Drag Handle Icon */}
        <div
          {...listeners}
          style={{
            cursor: 'grab',
            padding: '2px 4px',
            color: 'var(--text-tertiary)',
            touchAction: 'none',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
          title="Drag to move stage"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={14} />
        </div>
      </div>

      <div className="kanban-card-footer">
        <span className="kanban-days-badge">
          {daysInStage === 0 ? 'Today' : `${daysInStage}d`}
        </span>
        {agentInitials && (
          <div className="avatar avatar-sm" title={lead.assigned_agent?.name}>
            {agentInitials}
          </div>
        )}
      </div>
    </div>
  )
}

function KanbanColumn({
  stage,
  leads,
  pendingFollowupLeadIds,
}: {
  stage: LeadStage
  leads: Lead[]
  pendingFollowupLeadIds?: string[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const isClosed = ['won', 'lost', 'junk_leads'].includes(stage.key)

  return (
    <div
      id={`kanban-col-${stage.id}`}
      className="kanban-column"
      style={{
        borderTop: `3px solid ${stage.color_hex}`,
        background: isOver ? 'var(--accent-light)' : undefined,
      }}
    >
      <div className="kanban-column-header">
        <span className="kanban-column-title">{stage.label}</span>
        <span className="kanban-count-pill">{leads.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className="kanban-cards"
        style={{ touchAction: 'pan-y' }}
      >
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.length === 0 ? (
            <div className="kanban-empty">No leads in this stage</div>
          ) : (
            leads.map((lead) => {
              const hasFollowup = pendingFollowupLeadIds?.includes(lead.id)
              const isIdle = !isClosed && !hasFollowup
              return (
                <KanbanCard
                  key={lead.id}
                  lead={lead}
                  isIdle={isIdle}
                  idleBadgeText="No next action scheduled"
                />
              )
            })
          )}
        </SortableContext>
      </div>
    </div>
  )
}

function getOrderedStages(stagesList: LeadStage[]) {
  if (!stagesList || stagesList.length === 0) return []
  const copy = [...stagesList]

  // 1. Ensure follow-up is placed right after no-reply
  const followUpIndex = copy.findIndex(
    (s) => s.key === 'followup' || s.label.toLowerCase().replace(/[^a-z]/g, '') === 'followup'
  )
  const noReplyIndex = copy.findIndex(
    (s) => s.key === 'no_reply' || s.label.toLowerCase().includes('no reply')
  )
  if (followUpIndex !== -1 && noReplyIndex !== -1) {
    const [followUpStage] = copy.splice(followUpIndex, 1)
    const targetIndex = copy.findIndex(
      (s) => s.key === 'no_reply' || s.label.toLowerCase().includes('no reply')
    )
    copy.splice(targetIndex + 1, 0, followUpStage)
  }

  // 2. Ensure junk leads is placed right after lost
  const junkIndex = copy.findIndex(
    (s) => s.key === 'junk_leads' || s.key === 'junk' || s.label.toLowerCase().includes('junk')
  )
  const lostIndex = copy.findIndex(
    (s) => s.key === 'lost' || s.label.toLowerCase() === 'lost'
  )
  if (junkIndex !== -1 && lostIndex !== -1) {
    const [junkStage] = copy.splice(junkIndex, 1)
    const targetIndex = copy.findIndex(
      (s) => s.key === 'lost' || s.label.toLowerCase() === 'lost'
    )
    copy.splice(targetIndex + 1, 0, junkStage)
  }

  return copy
}

export default function KanbanBoard({
  leads,
  stages,
  loading,
  onLeadMoved,
  currentUserId,
  pendingFollowupLeadIds,
}: Props) {
  const orderedStages = useMemo(() => getOrderedStages(stages), [stages])
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const [selectedStageId, setSelectedStageId] = useState<string>(orderedStages[0]?.id ?? '')
  const boardRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Interception Modal State
  const [pendingStageChange, setPendingStageChange] = useState<{
    lead: Lead
    fromStage: LeadStage | null
    toStage: LeadStage
  } | null>(null)

  useEffect(() => {
    if (orderedStages.length > 0 && !selectedStageId) {
      setSelectedStageId(orderedStages[0].id)
    }
  }, [orderedStages, selectedStageId])

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  )

  function getLeadsForStage(stageId: string) {
    return leads.filter((l) => l.stage_id === stageId)
  }

  function handleStageTabClick(stageId: string) {
    setSelectedStageId(stageId)
    const colElement = document.getElementById(`kanban-col-${stageId}`)
    if (colElement) {
      colElement.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
    }
  }

  function handleDragStart(event: any) {
    const lead = leads.find((l) => l.id === event.active.id)
    setActiveLead(lead ?? null)
  }

  async function handleDragEnd(event: any) {
    setActiveLead(null)
    const { active, over } = event
    if (!over) return

    const leadId = active.id as string
    const lead = leads.find((l) => l.id === leadId)
    if (!lead) return

    let targetStageId = over.id as string
    const targetLead = leads.find((l) => l.id === targetStageId)
    if (targetLead) targetStageId = targetLead.stage_id

    if (targetStageId === lead.stage_id) return

    const fromStage = stages.find((s) => s.id === lead.stage_id) || null
    const toStage = stages.find((s) => s.id === targetStageId)
    if (!toStage) return

    // Active & Closed stages require mandatory interception modal
    const stagesRequiringIntercept = [
      'contacted',
      'qualified',
      'no_reply',
      'followup',
      'proposal',
      'negotiation',
      'won',
      'lost',
      'junk_leads',
    ]

    if (stagesRequiringIntercept.includes(toStage.key)) {
      setPendingStageChange({
        lead,
        fromStage,
        toStage,
      })
      return
    }

    // Direct move if moving back to 'new'
    await executeDirectStageMove(lead, fromStage, toStage)
  }

  async function executeDirectStageMove(lead: Lead, fromStage: LeadStage | null, toStage: LeadStage) {
    const { error } = await supabase
      .from('leads')
      .update({ stage_id: toStage.id, updated_at: new Date().toISOString() })
      .eq('id', lead.id)

    if (error) {
      console.error('Failed to move lead:', error)
      return
    }

    await supabase.from('lead_stage_history').insert({
      lead_id: lead.id,
      from_stage_id: fromStage?.id || lead.stage_id,
      to_stage_id: toStage.id,
      changed_by: currentUserId,
    })

    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      activity_type: 'STAGE_CHANGE',
      performed_by: currentUserId,
      metadata: {
        from_stage: fromStage?.label,
        to_stage: toStage.label,
      },
    })

    onLeadMoved()
  }

  async function handleConfirmStageChange(payload: StageChangePayload) {
    if (!pendingStageChange) return

    const { lead, fromStage, toStage } = pendingStageChange
    const effectiveStageId = payload.targetStageId
    const effectiveStage = stages.find((s) => s.id === effectiveStageId) || toStage

    setPendingStageChange(null)

    const updates: any[] = [
      supabase
        .from('leads')
        .update({ stage_id: effectiveStageId, updated_at: new Date().toISOString() })
        .eq('id', lead.id),
      supabase.from('lead_stage_history').insert({
        lead_id: lead.id,
        from_stage_id: fromStage?.id || lead.stage_id,
        to_stage_id: effectiveStageId,
        changed_by: currentUserId,
      }),
      supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'STAGE_CHANGE',
        performed_by: currentUserId,
        metadata: {
          from_stage: fromStage?.label || '—',
          to_stage: effectiveStage.label || '—',
          outcome: payload.outcome || null,
          lost_reason: payload.lostReason || null,
        },
      }),
    ]

    // Save note if provided or if marking lost
    let noteBodyToInsert: string | null = null
    if (payload.note && payload.note.trim()) {
      noteBodyToInsert = payload.note.trim()
    } else if (payload.lostReason) {
      noteBodyToInsert = `Marked as ${effectiveStage.label}. Reason: ${payload.lostReason}`
    }

    if (noteBodyToInsert) {
      updates.push(
        supabase.from('lead_notes').insert({
          lead_id: lead.id,
          author_id: currentUserId,
          body: noteBodyToInsert,
        })
      )
    }

    // Schedule mandatory follow-up if date provided
    if (payload.followupDate) {
      const followupText = payload.followupNote?.trim() || (payload.outcome ? `Follow-up after ${payload.outcome}` : 'Scheduled follow-up')
      updates.push(
        supabase.from('lead_followups').insert({
          lead_id: lead.id,
          agent_id: lead.assigned_agent_id || currentUserId,
          scheduled_at: payload.followupDate,
          note: followupText,
          is_completed: false,
        })
      )
      updates.push(
        supabase.from('lead_activities').insert({
          lead_id: lead.id,
          activity_type: 'FOLLOWUP_SCHEDULED',
          performed_by: currentUserId,
          metadata: { date: payload.followupDate, note: followupText },
        })
      )
    }

    // Closed stages auto-resolve all open follow-ups
    if (['won', 'lost', 'junk_leads'].includes(effectiveStage.key)) {
      updates.push(
        supabase
          .from('lead_followups')
          .update({ is_completed: true, completed_at: new Date().toISOString() })
          .eq('lead_id', lead.id)
          .eq('is_completed', false)
      )
    }

    await Promise.all(updates)
    onLeadMoved()
  }

  if (loading) {
    return (
      <div className="kanban-root">
        {orderedStages.map((s) => (
          <div key={s.id} className="kanban-column" style={{ borderTop: `3px solid ${s.color_hex}` }}>
            <div className="kanban-column-header">
              <span className="kanban-column-title">{s.label}</span>
            </div>
            <div className="kanban-cards">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{ height: 72, borderRadius: 'var(--radius-sm)' }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Mobile Stage Selector Quick Pills */}
        <div
          className="show-mobile-only"
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 10,
            marginBottom: 10,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {orderedStages.map((s) => {
            const count = getLeadsForStage(s.id).length
            const isSelected = selectedStageId === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleStageTabClick(s.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 100,
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  border: `1px solid ${isSelected ? s.color_hex : 'var(--border)'}`,
                  background: isSelected ? s.color_hex + '18' : 'var(--surface)',
                  color: isSelected ? s.color_hex : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color_hex }} />
                {s.label}
                <span
                  style={{
                    fontSize: 10,
                    padding: '1px 5px',
                    borderRadius: 10,
                    background: isSelected ? s.color_hex : 'var(--bg)',
                    color: isSelected ? '#fff' : 'var(--text-tertiary)',
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="kanban-root" ref={boardRef}>
          {orderedStages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              leads={getLeadsForStage(stage.id)}
              pendingFollowupLeadIds={pendingFollowupLeadIds}
            />
          ))}
        </div>

        <DragOverlay>
          {activeLead ? (
            <div className="kanban-card dragging" style={{ opacity: 1, boxShadow: 'var(--shadow-md)' }}>
              <div className="kanban-card-name">{activeLead.name ?? 'Unknown'}</div>
              <div className="kanban-card-phone">{activeLead.phone ?? activeLead.email ?? '—'}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Stage Change Modal Interception */}
      {pendingStageChange && (
        <StageChangeModal
          isOpen={true}
          lead={pendingStageChange.lead}
          fromStage={pendingStageChange.fromStage}
          toStage={pendingStageChange.toStage}
          stages={stages}
          onConfirm={handleConfirmStageChange}
          onCancel={() => setPendingStageChange(null)}
          currentUserId={currentUserId}
        />
      )}
    </>
  )
}
