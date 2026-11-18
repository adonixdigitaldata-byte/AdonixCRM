import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import ContractBuilderClient from './ContractBuilderClient'

export const metadata: Metadata = { title: 'Create New Contract — Adonix' }

interface Props {
  searchParams: Promise<{
    clientId?: string
    quotationId?: string
  }>
}

export default async function NewContractPage({ searchParams }: Props) {
  const { clientId, quotationId } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch clients for dropdown
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, company, email, phone, cr_number, vat_number, address')
    .order('name', { ascending: true })

  let prefillData: any = null

  // If quotationId provided, fetch quotation details
  if (quotationId) {
    const { data: quote } = await supabase
      .from('quotations')
      .select('*, client:clients(*), items:quotation_items(*)')
      .eq('id', quotationId)
      .maybeSingle()

    if (quote) {
      prefillData = {
        quotationId: quote.id,
        clientId: quote.client_id,
        clientName: quote.client?.name || '',
        clientCompany: quote.client?.company || '',
        clientEmail: quote.client?.email || '',
        clientPhone: quote.client?.phone || '',
        clientAddress: quote.client?.address || '',
        clientCr: quote.client?.cr_number || '',
        clientVat: quote.client?.vat_number || '',
        serviceTitle: quote.items?.[0]?.description || 'Custom Digital & Technology Services',
        contractPrice: quote.total || quote.subtotal || 0,
        currency: quote.currency || 'SAR',
      }
    }
  } else if (clientId) {
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .maybeSingle()

    if (client) {
      prefillData = {
        clientId: client.id,
        clientName: client.name || '',
        clientCompany: client.company || '',
        clientEmail: client.email || '',
        clientPhone: client.phone || '',
        clientAddress: client.address || '',
        clientCr: client.cr_number || '',
        clientVat: client.vat_number || '',
      }
    }
  }

  return (
    <ContractBuilderClient
      existingClients={clients || []}
      prefillData={prefillData}
    />
  )
}

