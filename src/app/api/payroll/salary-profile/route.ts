import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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
    const {
      profile_id,
      currency = 'INR',
      base_salary = 0,
      joining_date = new Date().toISOString().split('T')[0],
      designation = '',
      department = 'Operations',
      employee_code = '',
      bank_name = '',
      account_number = '',
      ifsc_or_iban = '',
      pan_or_iqama = '',
      default_allowances = [],
      default_deductions = [],
    } = body

    if (!profile_id) {
      return NextResponse.json({ error: 'profile_id is required' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()

    const payload = {
      profile_id,
      currency,
      base_salary: Number(base_salary) || 0,
      joining_date,
      designation: designation?.trim() || null,
      department: department?.trim() || 'Operations',
      employee_code: employee_code?.trim() || null,
      bank_name: bank_name?.trim() || null,
      account_number: account_number?.trim() || null,
      ifsc_or_iban: ifsc_or_iban?.trim() || null,
      pan_or_iqama: pan_or_iqama?.trim() || null,
      default_allowances: default_allowances || [],
      default_deductions: default_deductions || [],
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await serviceClient
      .from('employee_salary_profiles')
      .upsert(payload, { onConflict: 'profile_id' })
      .select('*')
      .single()

    if (error) {
      console.error('Error saving salary profile:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Synchronize active salary history record so it doesn't conflict or revert
    try {
      const todayStr = new Date().toISOString().split('T')[0]
      const { data: histRecords } = await serviceClient
        .from('employee_salary_history')
        .select('*')
        .eq('profile_id', profile_id)
        .order('start_date', { ascending: false })

      if (histRecords && histRecords.length > 0) {
        // Find currently active record or the latest open-ended one
        const activeRecord = histRecords.find((h: any) => !h.end_date || h.end_date >= todayStr) || histRecords[0]
        if (activeRecord) {
          await serviceClient
            .from('employee_salary_history')
            .update({
              base_salary: Number(base_salary) || 0,
              currency,
              updated_at: new Date().toISOString(),
            })
            .eq('id', activeRecord.id)
        }
      } else {
        await serviceClient
          .from('employee_salary_history')
          .insert({
            profile_id,
            base_salary: Number(base_salary) || 0,
            currency,
            start_date: joining_date || todayStr,
            end_date: null,
          })
      }
    } catch (histErr) {
      console.error('Warning: could not sync salary history entry:', histErr)
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    console.error('Salary profile server error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
