import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import LeadDetailClient from './LeadDetailClient'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Lead detail' }
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: lead },
    { data: stages },
    { data: agents },
    { data: notes },
    { data: followups },
    { data: activities },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('leads').select(`
      *,
      stage:lead_stages(*),
      assigned_agent:profiles(id, name, avatar_url),
      campaign:ad_campaigns(id, name),
      ad_set:ad_sets(id, name),
      ad:ads(id, name, creative_thumbnail_url)
    `).eq('id', id).single(),
    supabase.from('lead_stages').select('*').order('sort_order'),
    supabase.from('profiles').select('id, name').eq('is_active', true).order('name'),
    supabase.from('lead_notes').select('*, author:profiles(id, name)').eq('lead_id', id).order('created_at', { ascending: false }),
    supabase.from('lead_followups').select('*, agent:profiles(id, name)').eq('lead_id', id).order('scheduled_at'),
    supabase.from('lead_activities').select('*, performer:profiles(id, name)').eq('lead_id', id).order('created_at', { ascending: false }),
  ])

  if (!lead) notFound()

  return (
    <LeadDetailClient
      lead={lead as any}
      profile={profile as any}
      stages={stages ?? []}
      agents={agents ?? []}
      notes={notes ?? []}
      followups={followups ?? []}
      activities={activities ?? []}
    />
  )
}
