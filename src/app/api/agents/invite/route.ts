import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAgentInviteEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()
  const { email, name } = await request.json()

  if (!email || !name) {
    return NextResponse.json({ error: 'Email and name are required' }, { status: 400 })
  }

  const callbackUrl = `${request.nextUrl.origin}/reset-password`

  let userId: string | null = null
  let actionLink: string | null = null

  // 1. Try to generate an invite link for a new user
  const { data: inviteData, error: inviteError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo: callbackUrl,
      data: { name, role: 'AGENT' },
    },
  })

  if (inviteData?.properties?.action_link) {
    actionLink = inviteData.properties.action_link
    userId = inviteData.user?.id ?? null
  } else {
    // 2. If user already exists, generate a recovery/reset password link instead
    const { data: recoveryData, error: recoveryError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: callbackUrl,
      },
    })

    if (recoveryError) {
      return NextResponse.json({ error: recoveryError.message }, { status: 400 })
    }

    actionLink = recoveryData.properties?.action_link ?? null
    userId = recoveryData.user?.id ?? null
  }

  // 3. Upsert profile so agent appears in table list
  if (userId) {
    await supabase.from('profiles').upsert({
      id: userId,
      name,
      email,
      role: 'AGENT',
      is_active: true,
    }, { onConflict: 'id' })
  }

  // 4. Send branded email via Resend with the actual action link (which has the Supabase token)
  if (actionLink) {
    await sendAgentInviteEmail(email, name, actionLink)
  } else {
    return NextResponse.json({ error: 'Failed to generate invitation link' }, { status: 400 })
  }

  return NextResponse.json({ success: true, userId })
}
