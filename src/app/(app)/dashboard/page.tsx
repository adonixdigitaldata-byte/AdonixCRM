import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import DashboardClient from './DashboardClient'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  // Technical Employees / Work Specialists land directly on /tasks?tab=MY
  // ADMIN, ACCOUNT_MANAGER, and AGENT (Sales Agents) access the Dashboard
  if (profile && profile.role === 'EMPLOYEE') {
    redirect('/tasks?tab=MY')
  }

  // ─── Fire all independent queries IN PARALLEL ─────────────────────
  const [
    { data: stages },
    { data: leadsData },
    { data: recentLeads },
    { data: followups },
    { data: invoices },
    { data: quotations },
  ] = await Promise.all([
    supabase.from('lead_stages').select('*').order('sort_order'),
    supabase.from('leads').select('stage_id, source'),
    supabase
      .from('leads')
      .select('id, name, phone, source, created_at, stage:lead_stages(label, color_hex), assigned_agent:profiles(name)')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('lead_followups')
      .select('*, lead:leads(id, name, phone), agent:profiles(name)')
      .eq('is_completed', false)
      .order('scheduled_at')
      .limit(10),
    supabase
      .from('invoices')
      .select('id, invoice_number, total, amount_paid, currency, status, created_at'),
    supabase
      .from('quotations')
      .select('id, quote_number, total, currency, status, created_at'),
  ])

  const isAdmin = profile?.role === 'ADMIN'

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

  // ─── Admin-only: Agent performance data (parallel) ────────────────
  let agentPerf: any[] = []

  if (isAdmin) {
    const { data: agents } = await supabase
      .from('profiles')
      .select('id, name, last_seen_at')
      .eq('role', 'AGENT')
      .eq('is_active', true)

    if (agents && agents.length > 0) {
      const wonStage = stages?.find((s: any) => s.key === 'won')

      // Fire agent-data queries in parallel
      const [{ data: allLeads }, { data: completedFus }] = await Promise.all([
        supabase
          .from('leads')
          .select('id, assigned_agent_id, stage_id')
          .not('assigned_agent_id', 'is', null),
        supabase
          .from('lead_followups')
          .select('agent_id')
          .eq('is_completed', true),
      ])

      agentPerf = agents.map((agent: any) => {
        const agentLeads = allLeads?.filter((l: any) => l.assigned_agent_id === agent.id) ?? []
        const totalLeadsAgent = agentLeads.length
        const wonLeads = wonStage
          ? agentLeads.filter((l: any) => l.stage_id === wonStage.id).length
          : 0
        const completedFollowups = completedFus?.filter((f: any) => f.agent_id === agent.id).length ?? 0
        const conversionRate = totalLeadsAgent > 0 ? (wonLeads / totalLeadsAgent) * 100 : 0

        return {
          id: agent.id,
          name: agent.name,
          totalLeads: totalLeadsAgent,
          wonLeads,
          openLeads: totalLeadsAgent - wonLeads,
          completedFollowups,
          conversionRate,
          lastSeen: agent.last_seen_at,
        }
      })
    }
  }

  return (
    <DashboardClient
      profile={profile as any}
      stages={stages ?? []}
      stageCounts={stageCounts}
      sourceCounts={sourceCounts}
      totalLeads={totalLeads}
      recentLeads={recentLeads ?? []}
      followups={followups ?? []}
      invoices={invoices ?? []}
      quotations={quotations ?? []}
      agentPerf={agentPerf}
    />
  )
}
