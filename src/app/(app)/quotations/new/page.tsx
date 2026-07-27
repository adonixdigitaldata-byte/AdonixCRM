import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import QuotationBuilderClient from './QuotationBuilderClient'

export const metadata: Metadata = { title: 'New quotation' }

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ lead_id?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  // If coming from a lead, pre-fill client data
  let prefillClient = null
  if (resolvedSearchParams.lead_id) {
    const { data: lead } = await supabase
      .from('leads')
      .select('id, name, email, phone, city')
      .eq('id', resolvedSearchParams.lead_id)
      .single()
    prefillClient = lead
  }

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, company, email, phone')
    .order('name')

  return (
    <QuotationBuilderClient
      profile={profile as any}
      existingClients={clients ?? []}
      prefillClient={prefillClient}
      leadId={resolvedSearchParams.lead_id ?? null}
    />
  )
}
