import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import ImportClient from './ImportClient'

export const metadata: Metadata = { title: 'Import leads' }

export default async function ImportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: stages },
    { data: agents },
    { data: batches },
  ] = await Promise.all([
    supabase.from('lead_stages').select('*').order('sort_order'),
    supabase.from('profiles').select('id, name, email, role').order('name'),
    supabase.from('import_batches').select('*').order('created_at', { ascending: false }).limit(10),
  ])

  const formattedAgents = (agents ?? []).map((a) => ({
    id: a.id,
    name: a.name || a.email || 'Unnamed User',
    email: a.email || '',
    role: a.role,
  }))

  return (
    <ImportClient
      stages={stages ?? []}
      agents={formattedAgents}
      batches={batches ?? []}
      currentUserId={user.id}
    />
  )
}
