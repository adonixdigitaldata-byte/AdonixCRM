import { NextResponse } from 'next/server'
import { getContractById, saveContract } from '@/lib/contracts/contractStore'
import { sendContractShareEmail } from '@/lib/email'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { contractId, recipientEmail, recipientName } = body

    if (!contractId || !recipientEmail) {
      return NextResponse.json(
        { error: 'Contract ID and recipient email are required' },
        { status: 400 }
      )
    }

    const contract = await getContractById(contractId)
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    // Determine host URL
    const host = req.headers.get('host') || 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const contractUrl = `${protocol}://${host}/contracts/view/${contract.id}`

    await sendContractShareEmail({
      clientEmail: recipientEmail,
      clientName: recipientName || contract.client_name,
      contractNumber: contract.contract_number,
      serviceTitle: contract.service_title,
      termDuration: contract.term_duration,
      contractPrice: contract.total_with_tax || contract.contract_price,
      currency: contract.currency,
      contractUrl,
    })

    // If contract status was DRAFT, update to SENT
    if (contract.status === 'DRAFT') {
      await saveContract({
        ...contract,
        status: 'SENT',
      })
    }

    return NextResponse.json({ success: true, contractUrl })
  } catch (error: any) {
    console.error('Error sharing contract:', error)
    return NextResponse.json({ error: error.message || 'Error sharing contract' }, { status: 500 })
  }
}

