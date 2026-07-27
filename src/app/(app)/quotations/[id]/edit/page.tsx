import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import QuotationEditClient from './QuotationEditClient'

export const metadata: Metadata = { title: 'Edit Quotation' }

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: clients } = await supabase.from('clients').select('*').order('name', { ascending: true })

  if (!quotation) notFound()

  return <QuotationEditClient quotation={quotation as any} clients={clients ?? []} profile={profile as any} />
}

