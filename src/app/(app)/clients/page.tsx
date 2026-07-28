import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import ClientsClient from './ClientsClient'

export const metadata: Metadata = { title: 'Clients' }

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch clients
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  // Fetch profiles (agents)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('is_active', true)

  // Fetch invoices for financial context
  const { data: invoices } = await supabase
    .from('invoices')
    .select('client_id, total, amount_paid, status, currency')

  return (
    <ClientsClient
      initialClients={(clients as any[]) ?? []}
      agents={(profiles as any[]) ?? []}
      invoices={(invoices as any[]) ?? []}
    />
  )
}
