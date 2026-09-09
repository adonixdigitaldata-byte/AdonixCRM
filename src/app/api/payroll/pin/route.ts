import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Verify or get user's current PIN status
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role, payroll_pin')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Return the user's PIN (defaults to 1234 if not set)
  return NextResponse.json({
    hasPin: Boolean(profile.payroll_pin),
    pin: profile.payroll_pin || '1234',
  })
}

// Update user's personal PIN
export async function PUT(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { newPin } = body

    if (!newPin || typeof newPin !== 'string' || newPin.trim().length < 4) {
      return NextResponse.json({ error: 'PIN must be at least 4 digits' }, { status: 400 })
    }

    const cleanPin = newPin.trim()
    const serviceClient = await createServiceClient()

    const { error } = await serviceClient
      .from('profiles')
      .update({ payroll_pin: cleanPin, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (error) {
      console.error('Error updating payroll PIN:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, pin: cleanPin })
  } catch (err: any) {
    console.error('Server error updating PIN:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
