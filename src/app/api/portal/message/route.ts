import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendClientMessageNotificationEmail } from '@/lib/email'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!currentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 401 })
    }

    const body = await req.json()
    const { clientId, category, subject, message } = body

    if (!clientId || !subject?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields: clientId, subject, or message' },
        { status: 400 }
      )
    }

    // Fetch client record to find assigned Account Manager
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, name, company, email, assigned_agent_id')
      .eq('id', clientId)
      .single()

    if (clientErr || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Identify Account Manager or fallback to active Admin
    let recipientEmail = ''
    let recipientName = 'Team'

    if (client.assigned_agent_id) {
      const { data: manager } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', client.assigned_agent_id)
        .single()

      if (manager?.email) {
        recipientEmail = manager.email
        recipientName = manager.name || 'Account Manager'
      }
    }

    // If no assigned manager, find an active Admin
    if (!recipientEmail) {
      const { data: admin } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('role', 'ADMIN')
        .eq('is_active', true)
        .limit(1)
        .single()

      if (admin?.email) {
        recipientEmail = admin.email
        recipientName = admin.name || 'Admin'
      }
    }

    // Dispatch email notification via Resend
    if (recipientEmail) {
      await sendClientMessageNotificationEmail({
        recipientEmail,
        recipientName,
        clientName: client.name,
        clientCompany: client.company,
        clientEmail: client.email || currentProfile.email,
        category: category || 'General Request',
        subject: subject.trim(),
        message: message.trim(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Portal message error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to deliver message' },
      { status: 500 }
    )
  }
}
