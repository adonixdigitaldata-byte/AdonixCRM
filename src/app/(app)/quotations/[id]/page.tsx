import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import QuotationDetailClient from './QuotationDetailClient'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  let { data: quotation } = await supabase
    .from('quotations')
    .select('quote_number, client:clients(name, company)')
    .eq('id', id)
    .single()

  if (!quotation) {
    const serviceSupabase = await createServiceClient()
    const { data: sQuotation } = await serviceSupabase
      .from('quotations')
      .select('quote_number, client:clients(name, company)')
      .eq('id', id)
      .single()
    quotation = sQuotation
  }

  const clientName = (quotation?.client as any)?.name || (quotation?.client as any)?.company
  const title = clientName ? `Quotation — Adonix for ${clientName}` : 'Quotation'
  return { title }
}

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let [
    { data: profile },
    { data: quotation },
    { data: items },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('quotations').select('*, client:clients(*)').eq('id', id).single(),
    supabase.from('quotation_items').select('*').eq('quotation_id', id).order('sort_order'),
  ])

  if (!quotation) {
    const serviceSupabase = await createServiceClient()
    const [
      { data: sQuotation },
      { data: sItems },
    ] = await Promise.all([
      serviceSupabase.from('quotations').select('*, client:clients(*)').eq('id', id).single(),
      serviceSupabase.from('quotation_items').select('*').eq('quotation_id', id).order('sort_order'),
    ])
    quotation = sQuotation
    items = sItems
  }

  if (!quotation) notFound()

  // Security check for CLIENT role users: ensure they can only view their own quotations
  if (profile?.role === 'CLIENT') {
    let userClientId = profile.client_id
    if (!userClientId && profile.email) {
      const serviceSupabase = await createServiceClient()
      const { data: matchedClient } = await serviceSupabase
        .from('clients')
        .select('id')
        .eq('email', profile.email)
        .maybeSingle()
      if (matchedClient) userClientId = matchedClient.id
    }
    if (userClientId && quotation.client_id && quotation.client_id !== userClientId) {
      notFound()
    }
  }

  const quotationWithItems = {
    ...quotation,
    items: items ?? quotation.items ?? [],
  }

  return <QuotationDetailClient quotation={quotationWithItems as any} profile={profile as any} />
}
