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

  // Fetch profiles (Account Managers & Admins)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('is_active', true)

  // Fetch invoices for financial context
  const { data: invoices } = await supabase
    .from('invoices')
    .select('client_id, total, amount_paid, status, currency')

  // Fetch current profile
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', user.id)
    .single()

  if (currentProfile?.role === 'CLIENT') redirect('/portal')

  let finalClients = (clients as any[]) ?? []

  if (currentProfile?.role !== 'ADMIN') {
    // Non-admin users see assigned clients (assigned directly or assigned via technical task)
    const { data: userTasks } = await supabase
      .from('client_tasks')
      .select('client_id')
      .eq('assigned_employee_id', user.id)

    const assignedIds = new Set<string>()
    userTasks?.forEach((t) => { if (t.client_id) assignedIds.add(t.client_id) })

    finalClients = finalClients.filter((c) => c.assigned_agent_id === user.id || assignedIds.has(c.id))
  }

  return (
    <ClientsClient
      initialClients={finalClients}
      agents={(profiles as any[]) ?? []}
      invoices={(invoices as any[]) ?? []}
      currentProfile={currentProfile}
    />
  )
}
