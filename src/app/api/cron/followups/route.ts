import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendDailyFollowupDigestEmail, type DigestFollowupItem } from '@/lib/email'

export async function GET(request: NextRequest) {
  // Security authorization check: support Bearer header, URL query ?secret=..., or vercel cron
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || 'adonix_cron_secret_2026'
  const isVercelCron = Boolean(request.headers.get('x-vercel-cron'))
  const querySecret = request.nextUrl.searchParams.get('secret')

  const isAuthorized =
    isVercelCron ||
    authHeader === `Bearer ${cronSecret}` ||
    querySecret === cronSecret

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  // Calculate Today in KSA (Asia/Riyadh, UTC+3) as the primary business calendar
  const now = new Date()
  const ksaDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const ksaDateStr = ksaDateFormatter.format(now) // "YYYY-MM-DD"

  // Start & End of today in KSA
  const startOfTodayKSA = new Date(`${ksaDateStr}T00:00:00+03:00`)
  const endOfTodayKSA = new Date(`${ksaDateStr}T23:59:59.999+03:00`)
  // Lookback up to 7 days for pending overdue followups so nothing falls through the cracks
  const overdueLookback = new Date(startOfTodayKSA.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Fetch uncompleted follow-ups scheduled for today (and overdue within the last 7 days)
  const { data: followups, error } = await supabase
    .from('lead_followups')
    .select(`
      id,
      scheduled_at,
      note,
      reminder_sent,
      is_completed,
      lead_id,
      lead:leads(
        id,
        name,
        phone,
        stage:lead_stages(label, color_hex),
        assigned_agent:profiles!assigned_agent_id(id, name, email)
      ),
      agent:profiles!agent_id(id, name, email)
    `)
    .eq('is_completed', false)
    .gte('scheduled_at', overdueLookback.toISOString())
    .lte('scheduled_at', endOfTodayKSA.toISOString())
    .order('scheduled_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Group follow-ups by recipient agent
  interface AgentGroup {
    agentEmail: string
    agentName: string
    today: DigestFollowupItem[]
    overdue: DigestFollowupItem[]
    followupIds: string[]
  }

  const agentGroups: Record<string, AgentGroup> = {}

  for (const fu of followups ?? []) {
    const lead = fu.lead as any
    const creatorAgent = fu.agent as any
    const assignedAgent = lead?.assigned_agent as any

    // Determine target agent (assigned agent takes precedence, fallback to creator)
    const targetAgentEmail = assignedAgent?.email || creatorAgent?.email
    const targetAgentName = assignedAgent?.name || creatorAgent?.name || 'Team Member'

    if (!targetAgentEmail) continue

    if (!agentGroups[targetAgentEmail]) {
      agentGroups[targetAgentEmail] = {
        agentEmail: targetAgentEmail,
        agentName: targetAgentName,
        today: [],
        overdue: [],
        followupIds: [],
      }
    }

    const scheduledDate = new Date(fu.scheduled_at)
    const isToday = scheduledDate >= startOfTodayKSA && scheduledDate <= endOfTodayKSA
    const isOverdue = scheduledDate < startOfTodayKSA

    const item: DigestFollowupItem = {
      id: fu.id,
      leadId: fu.lead_id,
      leadName: lead?.name || 'Lead',
      leadPhone: lead?.phone || null,
      scheduledAt: fu.scheduled_at,
      note: fu.note || null,
      stageLabel: lead?.stage?.label || null,
      isOverdue,
    }

    if (isToday) {
      agentGroups[targetAgentEmail].today.push(item)
      agentGroups[targetAgentEmail].followupIds.push(fu.id)
    } else if (isOverdue) {
      agentGroups[targetAgentEmail].overdue.push(item)
      agentGroups[targetAgentEmail].followupIds.push(fu.id)
    }
  }

  let sentCount = 0
  const processedIds: string[] = []
  const agentSummaries: { email: string; todayCount: number; overdueCount: number }[] = []

  // Dispatch 1 email per active agent with follow-ups
  for (const group of Object.values(agentGroups)) {
    if (group.today.length === 0 && group.overdue.length === 0) continue

    await sendDailyFollowupDigestEmail({
      agentEmail: group.agentEmail,
      agentName: group.agentName,
      todayFollowups: group.today,
      overdueFollowups: group.overdue,
    })

    sentCount++
    processedIds.push(...group.followupIds)
    agentSummaries.push({
      email: group.agentEmail,
      todayCount: group.today.length,
      overdueCount: group.overdue.length,
    })
  }

  // Update reminder_sent flag for processed items
  if (processedIds.length > 0) {
    await supabase
      .from('lead_followups')
      .update({ reminder_sent: true })
      .in('id', processedIds)
  }

  return NextResponse.json({
    success: true,
    dateKSA: ksaDateStr,
    agentsEmailed: sentCount,
    totalFollowupsProcessed: processedIds.length,
    agents: agentSummaries,
  })
}

