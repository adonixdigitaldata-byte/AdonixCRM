import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import InvoicesClient from './InvoicesClient'

export const metadata: Metadata = { title: 'Invoices' }

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role === 'CLIENT') redirect('/portal?section=finance')

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, client:clients(name, company)')
    .order('created_at', { ascending: false })

  return <InvoicesClient invoices={invoices ?? []} />
}
