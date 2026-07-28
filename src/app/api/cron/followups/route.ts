import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendFollowupReminderEmail } from '@/lib/email'

export async function GET(request: NextRequest) {
  const supabase = await createServiceClient()

  const now = new Date()
  const fifteenMinsFromNow = new Date(now.getTime() + 15 * 60 * 1000)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000) // safety cutoff for missed/recent followups

  // Fetch uncompleted followups scheduled within next 15 mins (up to 24 hours in past) where reminder hasn't been sent
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
        assigned_agent:profiles!assigned_agent_id(id, name, email)
      ),
      agent:profiles!agent_id(id, name, email)
    `)
    .eq('is_completed', false)
    .eq('reminder_sent', false)
    .gte('scheduled_at', oneDayAgo.toISOString())
    .lte('scheduled_at', fifteenMinsFromNow.toISOString())

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sentCount = 0

  for (const fu of followups ?? []) {
    const lead = fu.lead as any
    const creatorAgent = fu.agent as any
    const assignedAgent = lead?.assigned_agent as any

    // Determine target agent (assigned agent first, or creator agent fallback)
    const targetAgentEmail = assignedAgent?.email || creatorAgent?.email
    const targetAgentName = assignedAgent?.name || creatorAgent?.name || 'Agent'

    if (targetAgentEmail) {
      await sendFollowupReminderEmail({
        agentEmail: targetAgentEmail,
        agentName: targetAgentName,
        leadName: lead?.name || 'Lead',
        leadPhone: lead?.phone || '',
        followupNote: fu.note || '',
        scheduledAt: new Date(fu.scheduled_at).toLocaleString(),
        leadId: fu.lead_id,
      })

      // Mark reminder_sent = true
      await supabase
        .from('lead_followups')
        .update({ reminder_sent: true })
        .eq('id', fu.id)

      sentCount++
    }
  }

  return NextResponse.json({ success: true, sentCount, processed: followups?.length ?? 0 })
}
