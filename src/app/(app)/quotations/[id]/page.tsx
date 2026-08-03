import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import QuotationDetailClient from './QuotationDetailClient'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data: quotation } = await supabase
    .from('quotations')
    .select('quote_number, client:clients(name, company)')
    .eq('id', id)
    .single()

  const clientName = (quotation?.client as any)?.name || (quotation?.client as any)?.company
  const title = clientName ? `Quotation — Adonix for ${clientName}` : 'Quotation'
  return { title }
}

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: quotation },
    { data: items },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('quotations').select('*, client:clients(*)').eq('id', id).single(),
    supabase.from('quotation_items').select('*').eq('quotation_id', id).order('sort_order'),
  ])

  if (!quotation) notFound()

  const quotationWithItems = {
    ...quotation,
    items: items ?? quotation.items ?? [],
  }

  return <QuotationDetailClient quotation={quotationWithItems as any} profile={profile as any} />
}
