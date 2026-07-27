'use client'

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
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
import { Phone, Globe, FileUp, MessageCircle } from 'lucide-react'
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
      {...listeners}
      className={`kanban-card ${isDragging ? 'dragging' : ''}`}
      onClick={(e) => {
        // Only navigate if not dragging
        if (!isDragging) {
          e.stopPropagation()
          router.push(`/leads/${lead.id}`)
        }
      }}
    >
      <div className="kanban-card-name">{lead.name ?? 'Unknown'}</div>
      <div className="kanban-card-meta">
        <span className="kanban-card-phone">
          {SOURCE_ICONS[lead.source] ?? <Globe size={11} />}
          {lead.phone ?? lead.email ?? '—'}
        </span>
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
      <div ref={setNodeRef} className="kanban-cards">
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

export default function KanbanBoard({ leads, stages, loading, onLeadMoved, currentUserId }: Props) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const supabase = createClient()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  function getLeadsForStage(stageId: string) {
    return leads.filter((l) => l.stage_id === stageId)
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

    // over.id can be a stage id or another lead id
    let targetStageId = over.id as string

    // If dropped on a lead card, find that lead's stage
    const targetLead = leads.find((l) => l.id === targetStageId)
    if (targetLead) targetStageId = targetLead.stage_id

    if (targetStageId === lead.stage_id) return

    // Optimistic update
    const oldStageId = lead.stage_id

    // Update in Supabase
    const { error } = await supabase
      .from('leads')
      .update({ stage_id: targetStageId, updated_at: new Date().toISOString() })
      .eq('id', leadId)

    if (error) {
      console.error('Failed to move lead:', error)
      return
    }

    // Log stage history
    await supabase.from('lead_stage_history').insert({
      lead_id: leadId,
      from_stage_id: oldStageId,
      to_stage_id: targetStageId,
      changed_by: currentUserId,
    })

    // Log activity
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
        {stages.map((s) => (
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
      <div className="kanban-root">
        {stages.map((stage) => (
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
