import { NextResponse } from 'next/server'
import { getContractById, saveContract, deleteContract } from '@/lib/contracts/contractStore'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const contract = await getContractById(id)
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, contract })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching contract' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await getContractById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    const body = await req.json()
    const updated = await saveContract({
      ...existing,
      ...body,
      id,
    })

    return NextResponse.json({ success: true, contract: updated })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error updating contract' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteContract(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error deleting contract' }, { status: 500 })
  }
}

