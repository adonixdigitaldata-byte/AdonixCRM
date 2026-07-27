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

  // Fetch profiles
  const { data: agents } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'AGENT')
    .order('created_at', { ascending: false })

  // Fetch auth users to get last_sign_in_at
  const serviceSupabase = await createServiceClient()
  const { data: authUsers } = await serviceSupabase.auth.admin.listUsers()

  const authUserMap: Record<string, { last_sign_in_at: string | null; confirmed_at: string | null }> = {}
  authUsers?.users.forEach((u) => {
    authUserMap[u.id] = {
      last_sign_in_at: u.last_sign_in_at ?? null,
      confirmed_at: u.email_confirmed_at ?? null,
    }
  })

  // Lead counts per agent
  const { data: leadCounts } = await supabase
    .from('leads')
    .select('assigned_agent_id')
    .not('assigned_agent_id', 'is', null)

  const agentLeadCounts: Record<string, number> = {}
  leadCounts?.forEach((l: any) => {
    if (l.assigned_agent_id)
      agentLeadCounts[l.assigned_agent_id] = (agentLeadCounts[l.assigned_agent_id] ?? 0) + 1
  })

  // Combine profile + auth activity metadata
  const enrichedAgents = (agents ?? []).map((agent) => ({
    ...agent,
    last_sign_in_at: authUserMap[agent.id]?.last_sign_in_at ?? null,
    is_confirmed: !!authUserMap[agent.id]?.last_sign_in_at,
  }))

  return (
    <AgentsClient
      agents={enrichedAgents as any}
      agentLeadCounts={agentLeadCounts}
      currentUserId={user.id}
    />
  )
}
