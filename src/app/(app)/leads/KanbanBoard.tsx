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
import { formatDistanceToNow } from 'date-fns'
import { Phone, Globe, FileUp, MessageCircle, GripVertical } from 'lucide-react'
import type { Lead, LeadStage } from '@/types/database'

interface Props {
  leads: Lead[]
  stages: LeadStage[]
  loading: boolean
  onLeadMoved: () => void
  currentUserId: string
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  META_ADS: <Globe size={11} />,
  MANUAL: <Phone size={11} />,
  XLSX_IMPORT: <FileUp size={11} />,
  WHATSAPP: <MessageCircle size={11} />,
}

function KanbanCard({ lead }: { lead: Lead }) {
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
      style={style}
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
        </div>

        {/* Dedicated Drag Handle Icon — attaches dnd listeners here ONLY so touch scrolling works everywhere else */}
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
}: {
  stage: LeadStage
  leads: Lead[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

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
            leads.map((lead) => <KanbanCard key={lead.id} lead={lead} />)
          )}
        </SortableContext>
      </div>
    </div>
  )
}

function getOrderedStages(stagesList: LeadStage[]) {
  if (!stagesList || stagesList.length === 0) return []
  const followUpIndex = stagesList.findIndex(
    (s) => s.key === 'followup' || s.label.toLowerCase().replace(/[^a-z]/g, '') === 'followup'
  )
  const noReplyIndex = stagesList.findIndex(
    (s) => s.key === 'no_reply' || s.label.toLowerCase().includes('no reply')
  )
  if (followUpIndex === -1 || noReplyIndex === -1) return stagesList

  const copy = [...stagesList]
  const [followUpStage] = copy.splice(followUpIndex, 1)
  const targetIndex = copy.findIndex(
    (s) => s.key === 'no_reply' || s.label.toLowerCase().includes('no reply')
  )
  copy.splice(targetIndex + 1, 0, followUpStage)
  return copy
}

export default function KanbanBoard({ leads, stages, loading, onLeadMoved, currentUserId }: Props) {
  const orderedStages = useMemo(() => getOrderedStages(stages), [stages])
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const [selectedStageId, setSelectedStageId] = useState<string>(orderedStages[0]?.id ?? '')
  const boardRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

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

    const oldStageId = lead.stage_id

    const { error } = await supabase
      .from('leads')
      .update({ stage_id: targetStageId, updated_at: new Date().toISOString() })
      .eq('id', leadId)

    if (error) {
      console.error('Failed to move lead:', error)
      return
    }

    await supabase.from('lead_stage_history').insert({
      lead_id: leadId,
      from_stage_id: oldStageId,
      to_stage_id: targetStageId,
      changed_by: currentUserId,
    })

    const toStage = stages.find((s) => s.id === targetStageId)
    const fromStage = stages.find((s) => s.id === oldStageId)
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      activity_type: 'STAGE_CHANGE',
      performed_by: currentUserId,
      metadata: {
        from_stage: fromStage?.label,
        to_stage: toStage?.label,
      },
    })

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
              <span style={{
                fontSize: 10, padding: '1px 5px', borderRadius: 10,
                background: isSelected ? s.color_hex : 'var(--bg)',
                color: isSelected ? '#fff' : 'var(--text-tertiary)',
              }}>
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
  )
}
