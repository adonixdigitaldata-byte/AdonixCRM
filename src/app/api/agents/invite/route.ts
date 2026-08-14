import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAgentInviteEmail } from '@/lib/email'
import { getAppUrl } from '@/lib/utils/url'

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()
  const body = await request.json()
  const { email, name, mode, role = 'AGENT', specialization = null, clientId = null } = body
 
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
  let isPasswordReset = mode === 'forgot'

  // 1. Try to generate an invite link for a new user (only if not explicit forgot mode)
  if (!isPasswordReset) {
    const { data: inviteData } = await supabase.auth.admin.generateLink({
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
    }
  }

  // 2. If user already exists or mode === 'forgot', generate a recovery/reset password link instead
  if (!actionLink) {
    isPasswordReset = true
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
      .select('role, specialization, work_status, client_id')
      .eq('id', userId)
      .maybeSingle()

    if (existingProf) {
      finalRole = body.role !== undefined ? body.role : existingProf.role
      finalSpec = body.specialization !== undefined ? body.specialization : (existingProf.specialization || null)
    }

    const profilePayload: any = {
      id: userId,
      name: name || email.split('@')[0],
      email,
      role: finalRole,
      specialization: finalSpec,
      work_status: existingProf?.work_status || 'AVAILABLE',
      is_active: true,
    }

    if (clientId) {
      profilePayload.client_id = clientId
    }

    let { error: profErr } = await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' })

    if (profErr && profErr.message?.includes('client_id')) {
      delete profilePayload.client_id
      await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' })
    }

    if (clientId) {
      try {
        await supabase.from('clients').update({ profile_id: userId }).eq('id', clientId)
      } catch (e) {
        console.warn('Could not update profile_id on clients:', e)
      }
    }
  }

  // 4. Send branded email via Resend with the actual action link
  if (actionLink) {
    await sendAgentInviteEmail(email, name || email.split('@')[0], actionLink, finalRole, finalSpec, isPasswordReset)
  } else {
    return NextResponse.json({ error: 'Failed to generate invitation link' }, { status: 400 })
  }

  return NextResponse.json({ success: true, userId })
}
