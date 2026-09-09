import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabaseUser = await createClient()
  const { data: { user } } = await supabaseUser.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabaseUser
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const allowedRoles = ['ADMIN', 'ACCOUNT_MANAGER', 'AGENT']
  if (!profile || !allowedRoles.includes(profile.role)) {
    return NextResponse.json(
      { error: 'Forbidden: Only administrators, account managers, and sales agents can bulk delete leads' },
      { status: 403 }
    )
  }

  const body = await request.json()
  const { leadIds } = body

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: 'No leads selected for deletion' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()

  try {
    // 1. Unlink foreign keys on associated tables
    await serviceClient.from('clients').update({ lead_id: null }).in('lead_id', leadIds)
    await serviceClient.from('quotations').update({ lead_id: null }).in('lead_id', leadIds)
    await serviceClient.from('invoices').update({ lead_id: null }).in('lead_id', leadIds)

    // 2. Clean up child relational records
    await serviceClient.from('lead_notes').delete().in('lead_id', leadIds)
    await serviceClient.from('lead_followups').delete().in('lead_id', leadIds)
    await serviceClient.from('lead_activities').delete().in('lead_id', leadIds)
    await serviceClient.from('lead_stage_history').delete().in('lead_id', leadIds)

    // 3. Delete the lead records
    const { error: deleteError } = await serviceClient
      .from('leads')
      .delete()
      .in('id', leadIds)

    if (deleteError) {
      console.error('Bulk lead deletion error:', deleteError)
      return NextResponse.json({ error: deleteError.message || 'Failed to delete leads' }, { status: 400 })
    }

    return NextResponse.json({ success: true, count: leadIds.length })
  } catch (err: any) {
    console.error('Bulk delete server error:', err)
    return NextResponse.json({ error: err?.message || 'Server error during bulk lead deletion' }, { status: 500 })
  }
}
