import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAgentInviteEmail } from '@/lib/email'
import { getAppUrl } from '@/lib/utils/url'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const body = await request.json()
    const { clientId, email, name, password } = body

    if (!clientId || !email) {
      return NextResponse.json({ error: 'Client ID and Email address are required' }, { status: 400 })
    }

    const cleanEmail = email.trim()
    const clientName = name || cleanEmail.split('@')[0]

    // Verify client exists
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, name, company')
      .eq('id', clientId)
      .single()

    if (clientErr || !client) {
      return NextResponse.json({ error: 'Client record not found' }, { status: 404 })
    }

    let userId: string | null = null
    let actionLink: string | null = null

    // Check if profile with email already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (existingProfile) {
      userId = existingProfile.id

      // Set password if provided
      if (password && password.length >= 6) {
        const { error: pwdErr } = await supabase.auth.admin.updateUserById(existingProfile.id, {
          password: password,
        })
        if (pwdErr) {
          return NextResponse.json({ error: pwdErr.message }, { status: 400 })
        }
      }
    } else {
      // Create user via admin API
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: password || undefined,
        email_confirm: true,
        user_metadata: {
          name: clientName,
          role: 'CLIENT',
        },
      })

      if (createErr) {
        // Fallback: try generating invite link
        const appUrl = getAppUrl(request)
        const callbackUrl = `${appUrl}/reset-password`
        const { data: inviteData, error: inviteError } = await supabase.auth.admin.generateLink({
          type: 'invite',
          email: cleanEmail,
          options: {
            redirectTo: callbackUrl,
            data: { name: clientName, role: 'CLIENT' },
          },
        })

        if (inviteError) {
          return NextResponse.json({ error: createErr.message || inviteError.message }, { status: 400 })
        }

        userId = inviteData?.user?.id ?? null
        actionLink = inviteData?.properties?.action_link ?? null
      } else {
        userId = newUser.user.id
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Failed to establish user account' }, { status: 500 })
    }

    // Upsert profile with CLIENT role and client_id binding
    const profilePayload: any = {
      id: userId,
      name: clientName,
      email: cleanEmail,
      role: 'CLIENT',
      is_active: true,
    }
    if (clientId) {
      profilePayload.client_id = clientId
    }

    let { error: profErr } = await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' })

    if (profErr && profErr.message?.includes('client_id')) {
      delete profilePayload.client_id
      const retry = await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' })
      profErr = retry.error
    }

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 400 })
    }

    // Link profile_id on clients table if column exists
    try {
      await supabase.from('clients').update({ profile_id: userId }).eq('id', clientId)
    } catch (e) {
      console.warn('Could not update profile_id on clients table:', e)
    }

    // Optional email sending if invite action link generated
    if (actionLink) {
      try {
        await sendAgentInviteEmail(cleanEmail, clientName, actionLink, 'CLIENT', null)
      } catch (e) {
        console.error('Failed to send invite email:', e)
      }
    }

    return NextResponse.json({
      success: true,
      userId,
      message: password
        ? 'Client portal credentials set successfully!'
        : 'Client portal access created/invited successfully!',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'An unexpected error occurred' }, { status: 500 })
  }
}
