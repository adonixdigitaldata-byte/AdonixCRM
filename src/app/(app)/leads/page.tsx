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

  const [
    { data: stages },
    { data: campaigns },
    { data: agents },
  ] = await Promise.all([
    supabase.from('lead_stages').select('*').order('sort_order'),
    supabase.from('ad_campaigns').select('id, name').order('name'),
    supabase.from('profiles').select('id, name').eq('is_active', true).eq('role', 'AGENT').order('name'),
  ])

  return (
    <LeadsClient
      profile={profile}
      stages={stages ?? []}
      campaigns={campaigns ?? []}
      agents={agents ?? []}
      initialSearchParams={resolvedSearchParams}
    />
  )
}
