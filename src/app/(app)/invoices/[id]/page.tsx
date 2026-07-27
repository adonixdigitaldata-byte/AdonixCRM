import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import InvoiceDetailClient from './InvoiceDetailClient'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('invoices').select('invoice_number').eq('id', id).single()
  return { title: data?.invoice_number ?? 'Invoice' }
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const [
    { data: invoice },
    { data: payments },
  ] = await Promise.all([
    supabase.from('invoices').select('*, client:clients(*), items:invoice_items(*)').eq('id', id).single(),
    supabase.from('payments').select('*').eq('invoice_id', id).order('paid_at', { ascending: false }),
  ])

  if (!invoice) notFound()

  return <InvoiceDetailClient invoice={invoice as any} payments={payments ?? []} profile={profile as any} />
}
