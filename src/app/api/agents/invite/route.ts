import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAgentInviteEmail } from '@/lib/email'
import { getAppUrl } from '@/lib/utils/url'

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()
  const body = await request.json()
  const { email, name, mode, role = 'AGENT', specialization = null } = body

  if (!email) {
    return NextResponse.json({ error: 'Email address is required' }, { status: 400 })
  }

  const appUrl = getAppUrl(request)
  const callbackUrl = `${appUrl}/reset-password`

  // If in forgot-password mode, verify user exists first
  if (mode === 'forgot') {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('email', email.trim())
      .maybeSingle()

    if (!existingProfile) {
      return NextResponse.json(
        { error: `No account found for "${email}". Please ask your CRM Administrator to invite you.` },
        { status: 404 }
      )
    }
  }

  let userId: string | null = null
  let actionLink: string | null = null

  // 1. Try to generate an invite link for a new user
  const { data: inviteData, error: inviteError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: email.trim(),
    options: {
      redirectTo: callbackUrl,
      data: { name: name || email.split('@')[0], role: role || 'AGENT' },
    },
  })

  if (inviteData?.properties?.action_link) {
    actionLink = inviteData.properties.action_link
    userId = inviteData.user?.id ?? null
  } else {
    // 2. If user already exists, generate a recovery/reset password link instead
    const { data: recoveryData, error: recoveryError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email.trim(),
      options: {
        redirectTo: callbackUrl,
      },
    })

    if (recoveryError) {
      return NextResponse.json({ error: recoveryError.message ?? 'Failed to generate reset link for user' }, { status: 400 })
    }

    actionLink = recoveryData.properties?.action_link ?? null
    userId = recoveryData.user?.id ?? null
  }

  let finalRole = role || 'AGENT'
  let finalSpec = specialization || null

  // 3. Upsert profile so team member appears in table list, preserving existing role if profile already exists
  if (userId) {
    const { data: existingProf } = await supabase
      .from('profiles')
      .select('role, specialization, work_status')
      .eq('id', userId)
      .maybeSingle()

    if (existingProf) {
      finalRole = body.role !== undefined ? body.role : existingProf.role
      finalSpec = body.specialization !== undefined ? body.specialization : (existingProf.specialization || null)
    }

    await supabase.from('profiles').upsert({
      id: userId,
      name,
      email,
      role: finalRole,
      specialization: finalSpec,
      work_status: existingProf?.work_status || 'AVAILABLE',
      is_active: true,
    }, { onConflict: 'id' })
  }

  // 4. Send branded email via Resend with the actual action link
  if (actionLink) {
    await sendAgentInviteEmail(email, name, actionLink, finalRole, finalSpec)
  } else {
    return NextResponse.json({ error: 'Failed to generate invitation link' }, { status: 400 })
  }

  return NextResponse.json({ success: true, userId })
}
