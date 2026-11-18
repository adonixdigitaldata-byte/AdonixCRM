import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getContractById } from '@/lib/contracts/contractStore'
import ContractDetailClient from './ContractDetailClient'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const contract = await getContractById(id)
  const clientName = contract?.client_company || contract?.client_name
  return {
    title: clientName
      ? `Contract ${contract?.contract_number} — ${clientName} | Adonix`
      : 'Contract Agreement — Adonix',
  }
}

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const contract = await getContractById(id)
  if (!contract) {
    notFound()
  }

  return <ContractDetailClient contract={contract} profile={profile} />
}

