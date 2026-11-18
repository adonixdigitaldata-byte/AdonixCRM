import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getContractById } from '@/lib/contracts/contractStore'
import PublicContractViewClient from './PublicContractViewClient'

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
      ? `Contract ${contract?.contract_number} — ${clientName} | Adonix Developments`
      : 'Service Agreement & Contract — Adonix Developments',
  }
}

export default async function PublicContractViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = (await searchParams) || {}
  const contract = await getContractById(id)

  if (!contract) {
    notFound()
  }

  return (
    <PublicContractViewClient
      initialContract={contract}
      fromPortal={from === 'portal'}
    />
  )
}

