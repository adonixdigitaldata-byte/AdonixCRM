import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import InvoiceDetailClient from './InvoiceDetailClient'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  let { data: invoice } = await supabase
    .from('invoices')
    .select('invoice_number, client:clients(name, company)')
    .eq('id', id)
    .single()

  if (!invoice) {
    const serviceSupabase = await createServiceClient()
    const { data: sInvoice } = await serviceSupabase
      .from('invoices')
      .select('invoice_number, client:clients(name, company)')
      .eq('id', id)
      .single()
    invoice = sInvoice
  }

  const clientName = (invoice?.client as any)?.name || (invoice?.client as any)?.company
  const title = clientName ? `Invoice — Adonix for ${clientName}` : 'Invoice'
  return { title }
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let [
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

  if (!invoice) {
    const serviceSupabase = await createServiceClient()
    const [
      { data: sInvoice },
      { data: sItems },
      { data: sPayments },
    ] = await Promise.all([
      serviceSupabase.from('invoices').select('*, client:clients(*)').eq('id', id).single(),
      serviceSupabase.from('invoice_items').select('*').eq('invoice_id', id).order('sort_order'),
      serviceSupabase.from('payments').select('*').eq('invoice_id', id).order('paid_at', { ascending: false }),
    ])

    invoice = sInvoice
    items = sItems
    payments = sPayments
  }

  if (!invoice) notFound()

  // Security check for CLIENT role users: ensure they can only view their own invoices
  if (profile?.role === 'CLIENT') {
    let userClientId = profile.client_id
    const serviceSupabase = await createServiceClient()

    if (!userClientId && profile.email) {
      const { data: matchedClient } = await serviceSupabase
        .from('clients')
        .select('id')
        .ilike('email', profile.email.trim())
        .maybeSingle()
      if (matchedClient) userClientId = matchedClient.id
    }

    if (userClientId && invoice.client_id && invoice.client_id !== userClientId) {
      // Check if invoice belongs to a client record with matching email
      const { data: invClient } = await serviceSupabase
        .from('clients')
        .select('email')
        .eq('id', invoice.client_id)
        .maybeSingle()

      if (!invClient || !profile.email || invClient.email.toLowerCase() !== profile.email.trim().toLowerCase()) {
        notFound()
      }
    }
  }

  const invoiceWithItems = {
    ...invoice,
    items: items ?? invoice.items ?? [],
  }

  return <InvoiceDetailClient invoice={invoiceWithItems as any} payments={payments ?? []} profile={profile as any} />
}
