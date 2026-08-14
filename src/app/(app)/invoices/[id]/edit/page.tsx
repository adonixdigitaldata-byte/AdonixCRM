import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import InvoiceEditClient from './InvoiceEditClient'

export const metadata: Metadata = { title: 'Edit Invoice' }

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  let { data: invoice } = await supabase
    .from('invoices')
    .select('*, client:clients(*), items:invoice_items(*)')
    .eq('id', id)
    .single()

  if (!invoice) {
    const serviceSupabase = await createServiceClient()
    const { data: sInvoice } = await serviceSupabase
      .from('invoices')
      .select('*, client:clients(*), items:invoice_items(*)')
      .eq('id', id)
      .single()
    invoice = sInvoice
  }

  const { data: clients } = await supabase.from('clients').select('*').order('name', { ascending: true })

  if (!invoice) notFound()

  return <InvoiceEditClient invoice={invoice as any} clients={clients ?? []} profile={profile as any} />
}
