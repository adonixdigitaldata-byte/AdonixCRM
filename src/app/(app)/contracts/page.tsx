import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAllContracts } from '@/lib/contracts/contractStore'
import ContractsListClient from './ContractsListClient'

export const metadata: Metadata = { title: 'Contracts & Agreements — Adonix' }

export default async function ContractsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'CLIENT') {
    redirect('/portal?section=contracts')
  }

  const contracts = await getAllContracts()

  return <ContractsListClient initialContracts={contracts} />
}

