import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// HELPER: Validate if two date ranges overlap
function doRangesOverlap(s1: string, e1: string | null, s2: string, e2: string | null): boolean {
  const start1 = new Date(s1).getTime()
  const end1 = e1 ? new Date(e1).getTime() : Infinity
  const start2 = new Date(s2).getTime()
  const end2 = e2 ? new Date(e2).getTime() : Infinity

  return start1 <= end2 && end1 >= start2
}

// GET: Fetch salary history for a specific employee
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')

  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId is required' }, { status: 400 })
  }

  // Allow admins, or the employee themselves to view their own history
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN' && user.id !== employeeId) {
    return NextResponse.json({ error: 'Forbidden: Unauthorized access' }, { status: 403 })
  }

  try {
    const { data, error } = await supabase
      .from('employee_salary_history')
      .select('*')
      .eq('profile_id', employeeId)
      .order('start_date', { ascending: true })

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    console.error('Fetch salary history error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// POST: Add a new salary history period
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { profile_id, base_salary, currency = 'INR', start_date, end_date = null } = body

    if (!profile_id || !start_date || base_salary === undefined) {
      return NextResponse.json({ error: 'profile_id, start_date, and base_salary are required' }, { status: 400 })
    }

    if (end_date && new Date(start_date) > new Date(end_date)) {
      return NextResponse.json({ error: 'Start date cannot be after end date' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()

    // Check for overlaps with existing periods
    const { data: existingPeriods, error: fetchErr } = await serviceClient
      .from('employee_salary_history')
      .select('*')
      .eq('profile_id', profile_id)

    if (fetchErr) throw fetchErr

    for (const period of existingPeriods || []) {
      if (doRangesOverlap(start_date, end_date, period.start_date, period.end_date)) {
        const formattedEnd = period.end_date ? new Date(period.end_date).toLocaleDateString('en-GB') : 'Present'
        const formattedStart = new Date(period.start_date).toLocaleDateString('en-GB')
        return NextResponse.json({
          error: `This period overlaps with an existing salary period (${formattedStart} to ${formattedEnd}).`
        }, { status: 400 })
      }
    }

    const { data, error } = await serviceClient
      .from('employee_salary_history')
      .insert({
        profile_id,
        base_salary: Number(base_salary) || 0,
        currency,
        start_date,
        end_date,
      })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    console.error('Insert salary history error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// PUT: Update an existing salary history period
export async function PUT(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, profile_id, base_salary, currency = 'INR', start_date, end_date = null } = body

    if (!id || !profile_id || !start_date || base_salary === undefined) {
      return NextResponse.json({ error: 'id, profile_id, start_date, and base_salary are required' }, { status: 400 })
    }

    if (end_date && new Date(start_date) > new Date(end_date)) {
      return NextResponse.json({ error: 'Start date cannot be after end date' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()

    // Check for overlaps with existing periods (excluding the current one being edited)
    const { data: existingPeriods, error: fetchErr } = await serviceClient
      .from('employee_salary_history')
      .select('*')
      .eq('profile_id', profile_id)
      .neq('id', id)

    if (fetchErr) throw fetchErr

    for (const period of existingPeriods || []) {
      if (doRangesOverlap(start_date, end_date, period.start_date, period.end_date)) {
        const formattedEnd = period.end_date ? new Date(period.end_date).toLocaleDateString('en-GB') : 'Present'
        const formattedStart = new Date(period.start_date).toLocaleDateString('en-GB')
        return NextResponse.json({
          error: `This period overlaps with an existing salary period (${formattedStart} to ${formattedEnd}).`
        }, { status: 400 })
      }
    }

    const { data, error } = await serviceClient
      .from('employee_salary_history')
      .update({
        base_salary: Number(base_salary) || 0,
        currency,
        start_date,
        end_date,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    console.error('Update salary history error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// DELETE: Delete a salary history period
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()
    const { error } = await serviceClient
      .from('employee_salary_history')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Delete salary history error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
