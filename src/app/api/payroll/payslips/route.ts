import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getFinancialYear, numberToWords } from '@/lib/payroll-utils'

// GET: Fetch all payslips (Admin only)
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('payslips')
    .select(`
      *,
      employee:profiles!employee_id(id, name, email, role, specialization, avatar_url)
    `)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, data })
}

// PUT: Update existing payslip (adjust line items, working days, net pay, notes, status)
export async function PUT(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      id,
      currency,
      base_salary,
      earnings_breakdown = [],
      deductions_breakdown = [],
      working_days = 30,
      paid_days = 30,
      lop_days = 0,
      status = 'PUBLISHED',
      payment_date = null,
      payment_method = 'BANK_TRANSFER',
      designation,
      department,
      employee_code,
      bank_name,
      account_number,
      ifsc_or_iban,
      pan_or_iqama,
      notes,
      period_start_date = null,
      period_end_date = null,
    } = body

    if (!id) {
      return NextResponse.json({ error: 'Payslip ID is required' }, { status: 400 })
    }

    const grossEarnings = (earnings_breakdown || []).reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0)
    const totalDeductions = (deductions_breakdown || []).reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0)
    const netPay = Math.max(0, grossEarnings - totalDeductions)
    const netPayInWords = numberToWords(netPay, currency || 'INR')

    const serviceClient = await createServiceClient()

    const { data, error } = await serviceClient
      .from('payslips')
      .update({
        currency,
        base_salary: Number(base_salary) || 0,
        earnings_breakdown,
        deductions_breakdown,
        gross_earnings: grossEarnings,
        total_deductions: totalDeductions,
        net_pay: netPay,
        net_pay_in_words: netPayInWords,
        working_days: Number(working_days) || 30,
        paid_days: Number(paid_days) || 30,
        lop_days: Number(lop_days) || 0,
        status,
        payment_date,
        payment_method,
        designation: designation?.trim() || null,
        department: department?.trim() || null,
        employee_code: employee_code?.trim() || null,
        bank_name: bank_name?.trim() || null,
        account_number: account_number?.trim() || null,
        ifsc_or_iban: ifsc_or_iban?.trim() || null,
        pan_or_iqama: pan_or_iqama?.trim() || null,
        notes: notes?.trim() || null,
        period_start_date: period_start_date || null,
        period_end_date: period_end_date || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        employee:profiles!employee_id(id, name, email, role, specialization, avatar_url)
      `)
      .single()

    if (error) {
      console.error('Payslip update error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    console.error('Payslip PUT server error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// DELETE: Delete single or multiple payslips
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  try {
    let idsToDelete: string[] = []

    const { searchParams } = new URL(req.url)
    const singleId = searchParams.get('id')
    const queryIds = searchParams.get('ids')

    if (singleId) {
      idsToDelete = [singleId]
    } else if (queryIds) {
      idsToDelete = queryIds.split(',').map((s) => s.trim()).filter(Boolean)
    } else {
      try {
        const body = await req.json()
        if (Array.isArray(body?.ids)) {
          idsToDelete = body.ids
        }
      } catch {
        // No JSON body
      }
    }

    if (!idsToDelete || idsToDelete.length === 0) {
      return NextResponse.json({ error: 'No payslip IDs provided to delete' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()
    const { error } = await serviceClient.from('payslips').delete().in('id', idsToDelete)
    if (error) throw error

    return NextResponse.json({ success: true, count: idsToDelete.length, deletedIds: idsToDelete })
  } catch (err: any) {
    console.error('Payslip delete error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// POST: Create single custom payslip
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      employee_id,
      month,
      year,
      currency = 'INR',
      base_salary = 0,
      earnings_breakdown = [],
      deductions_breakdown = [],
      working_days = 30,
      paid_days = 30,
      lop_days = 0,
      status = 'PUBLISHED',
      payment_date = null,
      payment_method = 'BANK_TRANSFER',
      designation,
      department,
      employee_code,
      bank_name,
      account_number,
      ifsc_or_iban,
      pan_or_iqama,
      joining_date,
      notes,
      period_start_date = null,
      period_end_date = null,
    } = body

    if (!employee_id || !month || !year) {
      return NextResponse.json({ error: 'employee_id, month, and year are required' }, { status: 400 })
    }

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    if (Number(year) > currentYear || (Number(year) === currentYear && Number(month) > currentMonth)) {
      return NextResponse.json({ error: 'Cannot create payslips for future months.' }, { status: 400 })
    }

    const grossEarnings = (earnings_breakdown || []).reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0)
    const totalDeductions = (deductions_breakdown || []).reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0)
    const netPay = Math.max(0, grossEarnings - totalDeductions)
    const netPayInWords = numberToWords(netPay, currency)
    const fy = getFinancialYear(Number(year), Number(month))

    const serviceClient = await createServiceClient()

    const { data, error } = await serviceClient
      .from('payslips')
      .upsert({
        employee_id,
        month: Number(month),
        year: Number(year),
        financial_year: fy,
        currency,
        base_salary: Number(base_salary) || 0,
        earnings_breakdown,
        deductions_breakdown,
        gross_earnings: grossEarnings,
        total_deductions: totalDeductions,
        net_pay: netPay,
        net_pay_in_words: netPayInWords,
        working_days: Number(working_days) || 30,
        paid_days: Number(paid_days) || 30,
        lop_days: Number(lop_days) || 0,
        status,
        payment_date,
        payment_method,
        designation: designation?.trim() || null,
        department: department?.trim() || null,
        employee_code: employee_code?.trim() || null,
        bank_name: bank_name?.trim() || null,
        account_number: account_number?.trim() || null,
        ifsc_or_iban: ifsc_or_iban?.trim() || null,
        pan_or_iqama: pan_or_iqama?.trim() || null,
        joining_date: joining_date || null,
        notes: notes?.trim() || null,
        period_start_date: period_start_date || null,
        period_end_date: period_end_date || null,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'employee_id,month,year' })
      .select(`
        *,
        employee:profiles!employee_id(id, name, email, role, specialization, avatar_url)
      `)
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    console.error('Payslip POST error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
