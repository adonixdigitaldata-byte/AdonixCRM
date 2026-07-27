import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import QuotationDetailClient from './QuotationDetailClient'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('quotations').select('quote_number').eq('id', id).single()
  return { title: data?.quote_number ?? 'Quotation' }
}

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const { data: quotation } = await supabase
    .from('quotations')
    .select('*, client:clients(*), items:quotation_items(*)')
    .eq('id', id)
    .single()

  if (!quotation) notFound()

  return <QuotationDetailClient quotation={quotation as any} profile={profile as any} />
}
