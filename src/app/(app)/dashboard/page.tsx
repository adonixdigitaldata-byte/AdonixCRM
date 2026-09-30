import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import DashboardClient from './DashboardClient'

export const metadata: Metadata = { title: 'Dashboard' }

// Legitimate client outreach activities strictly excluding administrative actions:
// LEAD_CREATED, ASSIGNED, QUOTE_SENT, INVOICE_SENT, PAYMENT_RECORDED, etc.
const OUTREACH_ACTIVITY_TYPES = [
  'STAGE_CHANGE',
  'NOTE_ADDED',
  'NOTE_UPDATED',
  'FOLLOWUP_SCHEDULED',
  'FOLLOWUP_UPDATED',
  'FOLLOWUP_COMPLETED',
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  // Technical Employees land directly on /tasks?tab=MY
  // CLIENT role users land directly on /portal
  if (profile && profile.role === 'EMPLOYEE') {
    redirect('/tasks?tab=MY')
  }
  if (profile && profile.role === 'CLIENT') {
    redirect('/portal')
  }

  const now = new Date()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayStartIso = todayStart.toISOString()
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)
  const todayEndIso = todayEnd.toISOString()
  const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)

  const isAdmin = profile?.role === 'ADMIN'
  const isManagerOrAdmin = isAdmin || profile?.role === 'ACCOUNT_MANAGER'

  // ─── Fire all independent queries IN PARALLEL ─────────────────────
  const [
    { data: stages },
    { data: leadsData },
    { data: recentLeads },
    { data: allPendingFus },
    { data: invoices },
    { data: quotations },
    { data: myCompletedToday },
    { data: myOutreachToday },
    { data: myAllLeads },
  ] = await Promise.all([
    supabase.from('lead_stages').select('*').order('sort_order'),
    supabase.from('leads').select('id, name, phone, stage_id, source, assigned_agent_id, created_at'),
    supabase
      .from('leads')
      .select('id, name, phone, source, created_at, stage:lead_stages(label, color_hex), assigned_agent:profiles(name)')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('lead_followups')
      .select('id, lead_id, agent_id, scheduled_at, note, is_completed, lead:leads(id, name, phone), agent:profiles(name)')
      .eq('is_completed', false)
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('invoices')
      .select('id, invoice_number, total, amount_paid, currency, status, created_at'),
    supabase
      .from('quotations')
      .select('id, quote_number, total, currency, status, created_at'),

    // Today's completed follow-ups by current user
    supabase
      .from('lead_followups')
      .select('lead_id')
      .eq('agent_id', user.id)
      .eq('is_completed', true)
      .gte('completed_at', todayStartIso),

    // Genuine client outreach activities today by current user
    supabase
      .from('lead_activities')
      .select('lead_id, activity_type')
      .eq('performed_by', user.id)
      .gte('created_at', todayStartIso)
      .in('activity_type', OUTREACH_ACTIVITY_TYPES),

    // All leads assigned to current user
    supabase
      .from('leads')
      .select('id, name, phone, stage_id, created_at')
      .eq('assigned_agent_id', user.id),
  ])

  // ─── Compute counts ───────────────────────────────────────────────
  const totalLeads = leadsData?.length ?? 0

  const stageCounts: Record<string, number> = {}
  leadsData?.forEach((l: { stage_id: string }) => {
    stageCounts[l.stage_id] = (stageCounts[l.stage_id] ?? 0) + 1
  })

  const sourceCounts: Record<string, number> = {}
  leadsData?.forEach((l: { source: string }) => {
    sourceCounts[l.source] = (sourceCounts[l.source] ?? 0) + 1
  })

  // ─── DAILY 35 TARGET: DISTINCT unique leads engaged today ─────────
  const uniqueLeadsWorkedToday = new Set<string>()
  myCompletedToday?.forEach((f: any) => { if (f.lead_id) uniqueLeadsWorkedToday.add(f.lead_id) })
  myOutreachToday?.forEach((a: any) => {
    if (a.lead_id && OUTREACH_ACTIVITY_TYPES.includes(a.activity_type)) {
      uniqueLeadsWorkedToday.add(a.lead_id)
    }
  })
  const doneTodayCount = uniqueLeadsWorkedToday.size

  // ─── IDLE LEADS CALCULATION ───────────────────────────────────────
  const closedStageIds = new Set(
    (stages ?? [])
      .filter((s: any) => ['won', 'lost', 'junk_leads'].includes(s.key))
      .map((s: any) => s.id)
  )

  const allPendingLeadIds = new Set((allPendingFus ?? []).map((f: any) => f.lead_id))

  // Total Idle leads across company
  const teamIdleLeadsCount = (leadsData ?? []).filter(
    (l: any) => !closedStageIds.has(l.stage_id) && !allPendingLeadIds.has(l.id)
  ).length

  // My personal Idle leads
  const myIdleLeadsList = (myAllLeads ?? []).filter(
    (l: any) => !closedStageIds.has(l.stage_id) && !allPendingLeadIds.has(l.id)
  )
  const myIdleLeadsCount = myIdleLeadsList.length

  // Overdue follow-ups (> 10 mins past scheduled time)
  const allOverdueFollowups = (allPendingFus ?? []).filter((f: any) => {
    if (!f.scheduled_at) return false
    return new Date(f.scheduled_at) < now
  })
  const myOverdueFollowups = allOverdueFollowups.filter((f: any) => f.agent_id === user.id)

  // Today's follow-ups
  const allTodayFollowups = (allPendingFus ?? []).filter((f: any) => {
    if (!f.scheduled_at) return false
    const sched = new Date(f.scheduled_at)
    return sched >= todayStart && sched <= todayEnd
  })
  const myTodayFollowups = allTodayFollowups.filter((f: any) => f.agent_id === user.id)

  // Scheduled followups to display in upcoming card
  const displayFollowups = isManagerOrAdmin
    ? (allPendingFus ?? []).slice(0, 25)
    : (allPendingFus ?? []).filter((f: any) => f.agent_id === user.id).slice(0, 25)

  // ─── Admin / Manager: Agent performance, Accountability Radar & Stage Health ───
  let agentPerf: any[] = []
  let agentHealthStats: any[] = []
  let stageHealthStats: any[] = []

  if (isManagerOrAdmin) {
    const { data: agents } = await supabase
      .from('profiles')
      .select('id, name, email, role, last_seen_at')
      .in('role', ['AGENT', 'ACCOUNT_MANAGER'])
      .eq('is_active', true)

    if (agents && agents.length > 0) {
      const wonStage = stages?.find((s: any) => s.key === 'won')

      const [
        { data: allLeads },
        { data: completedFus7Days },
        { data: outreachActs7Days },
      ] = await Promise.all([
        supabase
          .from('leads')
          .select('id, assigned_agent_id, stage_id')
          .not('assigned_agent_id', 'is', null),
        supabase
          .from('lead_followups')
          .select('lead_id, agent_id, completed_at')
          .eq('is_completed', true)
          .gte('completed_at', sevenDaysAgo.toISOString()),
        supabase
          .from('lead_activities')
          .select('lead_id, performed_by, created_at, activity_type')
          .gte('created_at', sevenDaysAgo.toISOString())
          .in('activity_type', OUTREACH_ACTIVITY_TYPES),
      ])

      agentPerf = agents.map((agent: any) => {
        const agentLeads = allLeads?.filter((l: any) => l.assigned_agent_id === agent.id) ?? []
        const totalLeadsAgent = agentLeads.length
        const wonLeads = wonStage
          ? agentLeads.filter((l: any) => l.stage_id === wonStage.id).length
          : 0
        const completedFollowups = completedFus7Days?.filter((f: any) => f.agent_id === agent.id).length ?? 0
        const conversionRate = totalLeadsAgent > 0 ? (wonLeads / totalLeadsAgent) * 100 : 0

        return {
          id: agent.id,
          name: agent.name || agent.email || 'Agent',
          totalLeads: totalLeadsAgent,
          wonLeads,
          openLeads: totalLeadsAgent - wonLeads,
          completedFollowups,
          conversionRate,
          lastSeen: agent.last_seen_at,
        }
      })

      // Calculate AgentHealthStats with 7-day consistency and 35 quota
      agentHealthStats = agents.map((agent: any) => {
        const agentLeads = (allLeads ?? []).filter(
          (l: any) => l.assigned_agent_id === agent.id && !closedStageIds.has(l.stage_id)
        )
        const idleCount = agentLeads.filter((l: any) => !allPendingLeadIds.has(l.id)).length
        const overdueCount = (allPendingFus ?? []).filter((f: any) => {
          return f.agent_id === agent.id && f.scheduled_at && new Date(f.scheduled_at) < now
        }).length

        // Build 7-day history (6 days ago to today)
        const history7Days: Array<{ date: string; dayLabel: string; uniqueLeads: number; targetMet: boolean }> = []
        for (let i = 6; i >= 0; i--) {
          const dStart = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000)
          const dEnd = new Date(dStart.getTime() + 24 * 60 * 60 * 1000 - 1)
          const dateStr = dStart.toISOString().split('T')[0]
          const dayLabel = i === 0 ? 'Today' : i === 1 ? 'Yday' : dStart.toLocaleDateString('en-US', { weekday: 'short' })

          const dLeadSet = new Set<string>()
          completedFus7Days
            ?.filter((f: any) => {
              if (f.agent_id !== agent.id || !f.completed_at) return false
              const comp = new Date(f.completed_at)
              return comp >= dStart && comp <= dEnd
            })
            .forEach((f: any) => { if (f.lead_id) dLeadSet.add(f.lead_id) })

          outreachActs7Days
            ?.filter((a: any) => {
              if (a.performed_by !== agent.id || !a.created_at) return false
              const actTime = new Date(a.created_at)
              return actTime >= dStart && actTime <= dEnd
            })
            .forEach((a: any) => { if (a.lead_id) dLeadSet.add(a.lead_id) })

          history7Days.push({
            date: dateStr,
            dayLabel,
            uniqueLeads: dLeadSet.size,
            targetMet: dLeadSet.size >= 35,
          })
        }

        const agentDoneToday = history7Days[history7Days.length - 1]?.uniqueLeads || 0
        const yesterdayCount = history7Days[history7Days.length - 2]?.uniqueLeads || 0
        const sevenDayTargetMetCount = history7Days.filter((h) => h.targetMet).length
        const sevenDayAvg = Math.round(history7Days.reduce((acc, h) => acc + h.uniqueLeads, 0) / 7)
        const targetProgress = Math.min(100, Math.round((agentDoneToday / 35) * 100))
        const targetStatus: 'crushed' | 'on_pace' | 'behind' =
          agentDoneToday >= 35 ? 'crushed' : agentDoneToday >= 20 ? 'on_pace' : 'behind'

        const agentTodayFollowups = (allTodayFollowups ?? []).filter((f: any) => f.agent_id === agent.id).length

        return {
          id: agent.id,
          name: agent.name || agent.email || 'Agent',
          role: agent.role,
          totalLeads: agentLeads.length,
          idleLeads: idleCount,
          overdueFollowups: overdueCount,
          doneToday: agentDoneToday,
          target: 35,
          targetProgress,
          targetStatus,
          yesterdayCount,
          sevenDayAvg,
          sevenDayTargetMetCount,
          history7Days,
          followupsScheduledToday: agentTodayFollowups,
          meetingsBookedToday: agentTodayFollowups,
        }
      })

      // Sort: highest overdue first, then highest idle
      agentHealthStats.sort((a, b) => b.overdueFollowups - a.overdueFollowups || b.idleLeads - a.idleLeads)

      // Calculate Pipeline Stage Bottlenecks
      stageHealthStats = (stages ?? []).map((stage: any) => {
        const isClosed = ['won', 'lost', 'junk_leads'].includes(stage.key)
        const stageTotal = stageCounts[stage.id] ?? 0
        if (isClosed) {
          return {
            id: stage.id,
            key: stage.key,
            label: stage.label,
            colorHex: stage.color_hex || '#94A3B8',
            totalLeads: stageTotal,
            idleLeads: 0,
            idlePercent: 0,
            status: 'green' as const,
          }
        }

        const idleInStage = (leadsData ?? []).filter(
          (l: any) => l.stage_id === stage.id && !allPendingLeadIds.has(l.id)
        ).length

        const percent = stageTotal > 0 ? Math.round((idleInStage / stageTotal) * 100) : 0
        const status = (percent >= 60 || idleInStage > 20 ? 'red' : percent >= 30 || idleInStage > 5 ? 'amber' : 'green') as 'red' | 'amber' | 'green'

        return {
          id: stage.id,
          key: stage.key,
          label: stage.label,
          colorHex: stage.color_hex || '#3B82F6',
          totalLeads: stageTotal,
          idleLeads: idleInStage,
          idlePercent: percent,
          status,
        }
      })
    }
  }

  // Today's scheduled meetings / followups list
  const activeTodayFollowups = isManagerOrAdmin ? allTodayFollowups : myTodayFollowups
  const todayMeetings = activeTodayFollowups.map((fu: any) => {
    const fuDate = new Date(fu.scheduled_at)
    const timeStr = `${String(fuDate.getHours()).padStart(2, '0')}:${String(fuDate.getMinutes()).padStart(2, '0')}`
    const isPastDue = fuDate.getTime() < now.getTime() - 10 * 60 * 1000

    return {
      id: `fu_${fu.id}`,
      leadId: fu.lead?.id || fu.lead_id,
      leadName: fu.lead?.name || 'Unnamed Lead',
      leadPhone: fu.lead?.phone,
      time: timeStr,
      scheduledAtIso: fu.scheduled_at,
      type: 'MEETING' as const,
      typeLabel: 'Follow-up Call',
      stageKey: fu.lead?.stage?.key,
      stageLabel: fu.lead?.stage?.label || 'Follow-up',
      stageColor: fu.lead?.stage?.color_hex || '#3B82F6',
      agentId: fu.agent_id,
      agentName: fu.agent?.name || 'Assigned Agent',
      note: fu.note,
      status: isPastDue ? ('OVERDUE' as const) : ('SCHEDULED' as const),
    }
  })

  const myPendingLeadIds = (allPendingFus ?? [])
    .filter((f: any) => f.agent_id === user.id)
    .map((f: any) => f.lead_id as string)

  return (
    <DashboardClient
      profile={profile as any}
      stages={stages ?? []}
      stageCounts={stageCounts}
      sourceCounts={sourceCounts}
      totalLeads={totalLeads}
      recentLeads={recentLeads ?? []}
      followups={displayFollowups}
      overdueFollowups={isManagerOrAdmin ? allOverdueFollowups : myOverdueFollowups}
      todayFollowups={isManagerOrAdmin ? allTodayFollowups : myTodayFollowups}
      todayMeetings={todayMeetings}
      doneTodayCount={doneTodayCount}
      myAllLeads={(myAllLeads ?? []) as any}
      myPendingFollowupLeadIds={myPendingLeadIds}
      teamIdleLeadsCount={teamIdleLeadsCount}
      agentHealthStats={agentHealthStats}
      stageHealthStats={stageHealthStats}
      invoices={invoices ?? []}
      quotations={quotations ?? []}
    />
  )
}
