import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getContractById } from '@/lib/contracts/contractStore'
import ContractEditClient from './ContractEditClient'

export const metadata: Metadata = {
  title: 'Edit Contract — Adonix CRM',
}

export default async function ContractEditPage({
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

  const contract = await getContractById(id)
  if (!contract) {
    notFound()
  }

  return <ContractEditClient contract={contract} />
}
