import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import QuotationDetailClient from './QuotationDetailClient'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Quotation' }
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
