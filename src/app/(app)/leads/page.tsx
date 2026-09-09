import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import LeadsClient from './LeadsClient'

export const metadata: Metadata = { title: 'Leads' }

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const resolvedSearchParams = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  if (profile?.role === 'CLIENT') redirect('/portal')

  let leadsDateQuery = supabase.from('leads').select('created_at')
  if (profile?.role === 'AGENT') {
    leadsDateQuery = leadsDateQuery.eq('assigned_agent_id', user.id)
  }

  const [
    { data: stages },
    { data: campaigns },
    { data: agents },
    { data: leadDates },
  ] = await Promise.all([
    supabase.from('lead_stages').select('*').order('sort_order'),
    supabase.from('ad_campaigns').select('id, name').order('name'),
    supabase.from('profiles').select('id, name').eq('is_active', true).eq('role', 'AGENT').order('name'),
    leadsDateQuery,
  ])

  // Extract only months where leads actually exist
  const monthMap = new Map<string, number>()
  for (const item of (leadDates ?? [])) {
    if (!item.created_at) continue
    const d = new Date(item.created_at)
    if (isNaN(d.getTime())) continue
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const key = `${y}-${m}`
    monthMap.set(key, (monthMap.get(key) || 0) + 1)
  }

  const availableMonths = Array.from(monthMap.entries()).map(([value, count]) => {
    const [y, m] = value.split('-')
    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1)
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    return {
      value,
      label: `${label} (${count})`,
      count,
    }
  })
  availableMonths.sort((a, b) => b.value.localeCompare(a.value))

  return (
    <LeadsClient
      profile={profile}
      stages={stages ?? []}
      campaigns={campaigns ?? []}
      agents={agents ?? []}
      availableMonths={availableMonths}
      initialSearchParams={resolvedSearchParams}
    />
  )
}
