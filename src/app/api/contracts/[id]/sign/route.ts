import { NextResponse } from 'next/server'
import { getContractById, saveContract } from '@/lib/contracts/contractStore'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const contract = await getContractById(id)
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    const body = await req.json()
    const { signatoryName, signatoryTitle, signatureNotes } = body

    if (!signatoryName || !signatoryName.trim()) {
      return NextResponse.json({ error: 'Signatory Name is required' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const updated = await saveContract({
      ...contract,
      status: 'SIGNED',
      signed_at: now,
      signed_by_name: `${signatoryName.trim()}${signatoryTitle ? ` (${signatoryTitle.trim()})` : ''}`,
      signature_notes: signatureNotes || 'Digitally signed and accepted online via Adonix Client Portal.',
    })

    return NextResponse.json({ success: true, contract: updated })
  } catch (error: any) {
    console.error('Error signing contract:', error)
    return NextResponse.json({ error: error.message || 'Error signing contract' }, { status: 500 })
  }
}

