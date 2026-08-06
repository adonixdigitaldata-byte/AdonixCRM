import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import AgentDetailClient from './AgentDetailClient'

export const metadata: Metadata = { title: 'Agent Analytics' }

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Admin check
  const { data: currentProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (currentProfile?.role !== 'ADMIN') redirect('/leads')

  // Use service client to bypass RLS policies for admin agent details
  const serviceSupabase = await createServiceClient()

  // Fetch agent profile
  const { data: agent } = await serviceSupabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!agent) notFound()

  // Parallel queries: leads, stages, followups, activities, quotations, invoices, tasks
  const [
    { data: leads },
    { data: stages },
    { data: followups },
    { data: activities },
    { data: quotations },
    { data: invoices },
    { data: tasks },
  ] = await Promise.all([
    serviceSupabase
      .from('leads')
      .select('id, name, phone, email, source, created_at, stage_id, stage:lead_stages(id, key, label, color_hex)')
      .eq('assigned_agent_id', id)
      .order('created_at', { ascending: false }),
    serviceSupabase
      .from('lead_stages')
      .select('*')
      .order('sort_order'),
    serviceSupabase
      .from('lead_followups')
      .select('id, lead_id, scheduled_at, is_completed, completed_at, note, outcome_note, lead:leads(id, name)')
      .eq('agent_id', id)
      .order('scheduled_at', { ascending: false })
      .limit(50),
    serviceSupabase
      .from('lead_activities')
      .select('*, lead:leads(id, name)')
      .eq('performed_by', id)
      .order('created_at', { ascending: false })
      .limit(40),
    serviceSupabase
      .from('quotations')
      .select('id, quote_number, status, currency, total, issue_date, created_at, client:clients(name), lead:leads(name)')
      .or(`created_by.eq.${id}`)
      .order('created_at', { ascending: false }),
    serviceSupabase
      .from('invoices')
      .select('id, invoice_number, status, currency, total, amount_paid, issue_date, created_at, client:clients(name), lead:leads(name)')
      .or(`created_by.eq.${id}`)
      .order('created_at', { ascending: false }),
    serviceSupabase
      .from('client_tasks')
      .select(`
        *,
        client:clients(id, name, company),
        assigned_employee:profiles!assigned_employee_id(id, name, email, role, specialization, avatar_url, work_status),
        updates:client_task_updates(*)
      `)
      .eq('assigned_employee_id', id)
      .order('created_at', { ascending: false }),
  ])

  // Filter/match quotations & invoices associated with this agent's leads if created_by wasn't set
  const leadIds = new Set(leads?.map((l: any) => l.id) ?? [])
  
  // Combine quotations created by agent or belonging to agent's leads
  const agentQuotations = quotations ?? []
  const agentInvoices = invoices ?? []

  // Stage counts for this agent
  const stageCounts: Record<string, number> = {}
  leads?.forEach((l: any) => {
    stageCounts[l.stage_id] = (stageCounts[l.stage_id] ?? 0) + 1
  })

  // Won / Lost / Conversion
  const wonStage = stages?.find((s: any) => s.key === 'won')
  const lostStage = stages?.find((s: any) => s.key === 'lost')
  const wonCount = wonStage ? (stageCounts[wonStage.id] ?? 0) : 0
  const lostCount = lostStage ? (stageCounts[lostStage.id] ?? 0) : 0
  const totalLeads = leads?.length ?? 0
  const conversionRate = totalLeads > 0 ? (wonCount / totalLeads) * 100 : 0

  const completedFu = followups?.filter((f: any) => f.is_completed).length ?? 0
  const pendingFu = followups?.filter((f: any) => !f.is_completed).length ?? 0

  return (
    <AgentDetailClient
      agent={agent as any}
      leads={leads ?? []}
      stages={stages ?? []}
      stageCounts={stageCounts}
      followups={followups ?? []}
      activities={activities ?? []}
      quotations={agentQuotations}
      invoices={agentInvoices}
      tasks={tasks ?? []}
      totalLeads={totalLeads}
      wonCount={wonCount}
      lostCount={lostCount}
      conversionRate={conversionRate}
      completedFollowups={completedFu}
      pendingFollowups={pendingFu}
    />
  )
}
