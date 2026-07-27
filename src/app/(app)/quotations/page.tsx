import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import QuotationsClient from './QuotationsClient'

export const metadata: Metadata = { title: 'Quotations' }

export default async function QuotationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: quotations } = await supabase
    .from('quotations')
    .select('*, client:clients(name, company)')
    .order('created_at', { ascending: false })

  return <QuotationsClient quotations={quotations ?? []} />
}
