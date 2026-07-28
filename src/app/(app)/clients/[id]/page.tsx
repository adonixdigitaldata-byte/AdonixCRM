import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ClientDetailClient from './ClientDetailClient'

export const metadata: Metadata = { title: 'Client Profile' }

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch client details
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (!client) {
    notFound()
  }

  // Fetch all active profiles (for manager assignment)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  // Fetch all invoices for this client
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('client_id', id)
    .order('created_at', { ascending: false })

  // Fetch all quotations for this client
  const { data: quotations } = await supabase
    .from('quotations')
    .select('*')
    .eq('client_id', id)
    .order('created_at', { ascending: false })

  return (
    <ClientDetailClient
      client={client}
      profiles={profiles ?? []}
      invoices={invoices ?? []}
      quotations={quotations ?? []}
    />
  )
}
