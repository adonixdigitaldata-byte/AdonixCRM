import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import DashboardClient from './DashboardClient'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  // Fetch all lead stages
  const { data: stages } = await supabase
    .from('lead_stages').select('*').order('sort_order')

  // Count leads per stage
  const { data: stageCountsRaw } = await supabase
    .from('leads')
    .select('stage_id')

  // Count by source
  const { data: sourceCountsRaw } = await supabase
    .from('leads')
    .select('source')

  // Recent leads
  const { data: recentLeads } = await supabase
    .from('leads')
    .select('id, name, phone, source, created_at, stage:lead_stages(label, color_hex), assigned_agent:profiles(name)')
    .order('created_at', { ascending: false })
    .limit(8)

  // Upcoming follow-ups
  const { data: followups } = await supabase
    .from('lead_followups')
    .select('*, lead:leads(name, phone), agent:profiles(name)')
    .eq('is_completed', false)
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at')
    .limit(5)

  // Invoices & Quotations for Financial Analytics
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, total, amount_paid, currency, status, created_at')

  const { data: quotations } = await supabase
    .from('quotations')
    .select('id, quote_number, total, currency, status, created_at')

  // Total counts
  const totalLeads = stageCountsRaw?.length ?? 0
  const stageCounts: Record<string, number> = {}
  stageCountsRaw?.forEach((l: { stage_id: string }) => {
    stageCounts[l.stage_id] = (stageCounts[l.stage_id] ?? 0) + 1
  })

  const sourceCounts: Record<string, number> = {}
  sourceCountsRaw?.forEach((l: { source: string }) => {
    sourceCounts[l.source] = (sourceCounts[l.source] ?? 0) + 1
  })

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
    />
  )
}
