import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import ClientPortalClient from './ClientPortalClient'

export const metadata: Metadata = { title: 'Client Portal — Adonix' }

interface PageProps {
  searchParams: Promise<{ asClient?: string }>
}

export default async function ClientPortalPage({ searchParams }: PageProps) {
  const { asClient } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!currentProfile) redirect('/login')

  let clientId: string | null = null

  const isAdminOrManager =
    currentProfile.role === 'ADMIN' || currentProfile.role === 'ACCOUNT_MANAGER'

  if (asClient && isAdminOrManager) {
    clientId = asClient
  } else if (currentProfile.client_id) {
    clientId = currentProfile.client_id
  } else if (currentProfile.role === 'CLIENT') {
    // Fallback search by email
    const { data: matchedClient } = await supabase
      .from('clients')
      .select('id')
      .eq('email', currentProfile.email)
      .maybeSingle()
    if (matchedClient) {
      clientId = matchedClient.id
    }
  } else if (isAdminOrManager) {
    // Admin visiting /portal directly without asClient: pick the first client
    const { data: firstClient } = await supabase
      .from('clients')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (firstClient) {
      clientId = firstClient.id
    }
  }

  if (!clientId) {
    return (
      <div className="p-8 text-center" style={{ padding: 40, textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>No Client Profile Assigned</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
          Your user account is not currently linked to an active client record. Please contact your account manager.
        </p>
      </div>
    )
  }

  // Fetch client details
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (!client) notFound()

  // Parallel data fetching for client resources
  const [
    { data: quotations },
    { data: invoices },
    { data: clientTasks },
    assignedAgent,
  ] = await Promise.all([
    supabase
      .from('quotations')
      .select('*, items:quotation_items(*)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
    supabase
      .from('invoices')
      .select('*, items:invoice_items(*)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
    supabase
      .from('client_tasks')
      .select(`
        *,
        assigned_employee:profiles!assigned_employee_id(id, name, email, role, specialization, avatar_url),
        updates:client_task_updates(
          id, task_id, author_id, update_type, status_from, status_to, body, attachment_url, created_at,
          author:profiles(id, name, avatar_url)
        )
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
    client.assigned_agent_id
      ? supabase
          .from('profiles')
          .select('id, name, email, avatar_url, specialization')
          .eq('id', client.assigned_agent_id)
          .single()
          .then((res) => res.data)
      : Promise.resolve(null),
  ])

  // Fetch payments for invoices
  const invoiceIds = invoices?.map((inv: any) => inv.id) || []
  let payments: any[] = []
  if (invoiceIds.length > 0) {
    const { data: payData } = await supabase
      .from('payments')
      .select('*')
      .in('invoice_id', invoiceIds)
      .order('paid_at', { ascending: false })
    payments = payData || []
  }

  return (
    <Suspense fallback={<div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading Client Portal...</div>}>
      <ClientPortalClient
        client={client}
        quotations={quotations ?? []}
        invoices={invoices ?? []}
        payments={payments}
        tasks={clientTasks ?? []}
        assignedAgent={assignedAgent}
        currentProfile={currentProfile}
        isPreview={Boolean(asClient && isAdminOrManager)}
      />
    </Suspense>
  )
}
