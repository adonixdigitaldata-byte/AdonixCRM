import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import InvoiceBuilderClient from './InvoiceBuilderClient'

export const metadata: Metadata = { title: 'New Invoice' }

export default async function NewInvoicePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: existingClients } = await supabase.from('clients').select('id, name, company, email, phone, address, vat_number, cr_number').order('name')

  return (
    <InvoiceBuilderClient
      profile={profile as any}
      existingClients={existingClients ?? []}
    />
  )
}
