import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import InvoiceDetailClient from './InvoiceDetailClient'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Invoice' }
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: invoice },
    { data: items },
    { data: payments },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('invoices').select('*, client:clients(*)').eq('id', id).single(),
    supabase.from('invoice_items').select('*').eq('invoice_id', id).order('sort_order'),
    supabase.from('payments').select('*').eq('invoice_id', id).order('paid_at', { ascending: false }),
  ])

  if (!invoice) notFound()

  const invoiceWithItems = {
    ...invoice,
    items: items ?? invoice.items ?? [],
  }

  return <InvoiceDetailClient invoice={invoiceWithItems as any} payments={payments ?? []} profile={profile as any} />
}
