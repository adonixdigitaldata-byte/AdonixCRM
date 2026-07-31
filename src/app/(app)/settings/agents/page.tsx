import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import AgentsClient from './AgentsClient'

export const metadata: Metadata = { title: 'Agents' }

export default async function AgentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') redirect('/leads')

  // Parallel fetch: agents/profiles, authUsers, leadCounts, wonLeads, completedFus, quotations, invoices
  const serviceSupabase = await createServiceClient()

  const [
    { data: agents },
    { data: authUsers },
    { data: leadCounts },
    { data: wonStageData },
    { data: completedFus },
    { data: quotations },
    { data: invoices },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false }),
    serviceSupabase.auth.admin.listUsers(),
    supabase
      .from('leads')
      .select('assigned_agent_id')
      .not('assigned_agent_id', 'is', null),
    supabase
      .from('lead_stages')
      .select('id')
      .eq('key', 'won')
      .single(),
    supabase
      .from('lead_followups')
      .select('agent_id')
      .eq('is_completed', true),
    supabase
      .from('quotations')
      .select('id, created_by, total, currency'),
    supabase
      .from('invoices')
      .select('id, created_by, total, amount_paid, currency'),
  ])

  const authUserMap: Record<string, { last_sign_in_at: string | null; confirmed_at: string | null }> = {}
  authUsers?.users.forEach((u) => {
    authUserMap[u.id] = {
      last_sign_in_at: u.last_sign_in_at ?? null,
      confirmed_at: u.email_confirmed_at ?? null,
    }
  })

  // Lead counts per agent
  const agentLeadCounts: Record<string, number> = {}
  leadCounts?.forEach((l: any) => {
    if (l.assigned_agent_id)
      agentLeadCounts[l.assigned_agent_id] = (agentLeadCounts[l.assigned_agent_id] ?? 0) + 1
  })

  // Won counts per agent
  const wonCounts: Record<string, number> = {}
  if (wonStageData) {
    const { data: wonLeads } = await supabase
      .from('leads')
      .select('assigned_agent_id')
      .eq('stage_id', wonStageData.id)
      .not('assigned_agent_id', 'is', null)

    wonLeads?.forEach((l: any) => {
      if (l.assigned_agent_id)
        wonCounts[l.assigned_agent_id] = (wonCounts[l.assigned_agent_id] ?? 0) + 1
    })
  }

  // Completed followups per agent
  const fuCounts: Record<string, number> = {}
  completedFus?.forEach((f: any) => {
    if (f.agent_id) fuCounts[f.agent_id] = (fuCounts[f.agent_id] ?? 0) + 1
  })

  // Quotation total per agent
  const quoteCounts: Record<string, number> = {}
  quotations?.forEach((q: any) => {
    if (q.created_by) quoteCounts[q.created_by] = (quoteCounts[q.created_by] ?? 0) + 1
  })

  // Invoice total per agent
  const invoiceCounts: Record<string, number> = {}
  invoices?.forEach((inv: any) => {
    if (inv.created_by) invoiceCounts[inv.created_by] = (invoiceCounts[inv.created_by] ?? 0) + 1
  })

  // Combine profile + auth + performance metadata
  const enrichedAgents = (agents ?? []).map((agent) => {
    const total = agentLeadCounts[agent.id] ?? 0
    const won = wonCounts[agent.id] ?? 0
    return {
      ...agent,
      total_leads_assigned: total,
      last_sign_in_at: authUserMap[agent.id]?.last_sign_in_at ?? null,
      is_confirmed: !!authUserMap[agent.id]?.last_sign_in_at,
      wonLeads: won,
      conversionRate: total > 0 ? (won / total) * 100 : 0,
      completedFollowups: fuCounts[agent.id] ?? 0,
      quotationCount: quoteCounts[agent.id] ?? 0,
      invoiceCount: invoiceCounts[agent.id] ?? 0,
    }
  })

  return (
    <AgentsClient
      agents={enrichedAgents as any}
      agentLeadCounts={agentLeadCounts}
      currentUserId={user.id}
    />
  )
}
