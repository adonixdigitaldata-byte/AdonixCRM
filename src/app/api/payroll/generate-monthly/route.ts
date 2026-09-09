import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  getFinancialYear,
  numberToWords,
  calculateSalarySplitFromGross,
  getDaysInMonth,
  getDefaultStatutoryDeductions,
} from '@/lib/payroll-utils'
import { PayslipCurrency } from '@/types/database'

interface MonthYear {
  month: number
  year: number
}

function getMonthsBetween(startDateStr: string, endYear: number, endMonth: number): MonthYear[] {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // Never allow generating beyond the current real-world month
  let capYear = endYear
  let capMonth = endMonth
  if (capYear > currentYear || (capYear === currentYear && capMonth > currentMonth)) {
    capYear = currentYear
    capMonth = currentMonth
  }

  const start = new Date(startDateStr)
  let startYear = isNaN(start.getFullYear()) ? 2025 : start.getFullYear()
  let startMonth = isNaN(start.getMonth()) ? 12 : start.getMonth() + 1

  const results: MonthYear[] = []
  let curY = startYear
  let curM = startMonth

  while (curY < capYear || (curY === capYear && curM <= capMonth)) {
    results.push({ year: curY, month: curM })
    curM++
    if (curM > 12) {
      curM = 1
      curY++
    }
  }
  return results
}

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
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    const {
      month = currentMonth,
      year = currentYear,
      mode = 'CURRENT_MONTH', // 'CURRENT_MONTH' | 'BACKFILL_FROM_JOINING' | 'SINGLE_EMPLOYEE'
      employeeId = null,
      employeeIds = null,
      overwriteExisting = false,
    } = body

    const targetMonth = Number(month)
    const targetYear = Number(year)

    // Validation: Block future months
    if (targetYear > currentYear || (targetYear === currentYear && targetMonth > currentMonth)) {
      return NextResponse.json({
        error: `Cannot generate payslips for future months (${targetMonth}/${targetYear}). Payslips can only be generated up to the current month (${currentMonth}/${currentYear}).`
      }, { status: 400 })
    }

    const serviceClient = await createServiceClient()

    // 1. Fetch eligible profiles (exclude CLIENT role)
    let profilesQuery = serviceClient
      .from('profiles')
      .select('id, name, email, role, specialization')
      .neq('role', 'CLIENT')
      .eq('is_active', true)

    if (Array.isArray(employeeIds) && employeeIds.length > 0) {
      profilesQuery = profilesQuery.in('id', employeeIds)
    } else if (employeeId) {
      profilesQuery = profilesQuery.eq('id', employeeId)
    }

    const { data: teamMembers, error: teamErr } = await profilesQuery
    if (teamErr) throw teamErr
    if (!teamMembers || teamMembers.length === 0) {
      return NextResponse.json({ error: 'No eligible team members found' }, { status: 404 })
    }

    // 2. Fetch their salary profiles
    const memberIds = teamMembers.map((m) => m.id)
    const { data: salaryProfiles } = await serviceClient
      .from('employee_salary_profiles')
      .select('*')
      .in('profile_id', memberIds)

    const salaryProfileMap = new Map((salaryProfiles || []).map((sp) => [sp.profile_id, sp]))

    // Fetch salary histories to calculate historical periods correctly
    const { data: salaryHistories } = await serviceClient
      .from('employee_salary_history')
      .select('*')
      .in('profile_id', memberIds)
      .order('start_date', { ascending: true })

    const historyMap = new Map<string, any[]>()
    for (const record of salaryHistories || []) {
      if (!historyMap.has(record.profile_id)) {
        historyMap.set(record.profile_id, [])
      }
      historyMap.get(record.profile_id)!.push(record)
    }

    // 3. Fetch existing payslips to avoid unwanted overwrites unless requested
    const { data: existingPayslips } = await serviceClient
      .from('payslips')
      .select('employee_id, month, year')
      .in('employee_id', memberIds)

    const existingKeySet = new Set((existingPayslips || []).map((p) => `${p.employee_id}-${p.year}-${p.month}`))

    const generatedPayslips: any[] = []
    let skippedPriorToJoining = 0
    let skippedAlreadyExists = 0

    for (const member of teamMembers) {
      const sp = salaryProfileMap.get(member.id)
      const currency: PayslipCurrency = sp?.currency || (member.role === 'EMPLOYEE' ? 'INR' : 'SAR')
      const baseSalary = sp?.base_salary ? Number(sp.base_salary) : 0
      const joiningDate = sp?.joining_date || '2025-12-01'
      const designation = sp?.designation || member.specialization || (member.role === 'AGENT' ? 'Sales Agent' : member.role === 'ACCOUNT_MANAGER' ? 'Account Manager' : 'Software Specialist')
      const department = sp?.department || (member.role === 'AGENT' ? 'Sales & BD' : member.role === 'ACCOUNT_MANAGER' ? 'Client Relations' : 'Engineering & Operations')
      const employeeCode = sp?.employee_code || `ADX-${member.name.slice(0, 2).toUpperCase()}-${member.id.slice(0, 4).toUpperCase()}`
      const bankName = sp?.bank_name || null
      const accountNumber = sp?.account_number || null
      const ifscOrIban = sp?.ifsc_or_iban || null
      const panOrIqama = sp?.pan_or_iqama || null

      // Build periods to generate for this member
      let periods: MonthYear[] = []
      if (mode === 'BACKFILL_FROM_JOINING') {
        periods = getMonthsBetween(joiningDate, targetYear, targetMonth)
      } else {
        periods = [{ year: targetYear, month: targetMonth }]
      }

      for (const period of periods) {
        // Parse joining date components
        const joinDateObj = new Date(joiningDate)
        const joinYear = isNaN(joinDateObj.getFullYear()) ? 2025 : joinDateObj.getFullYear()
        const joinMonth = isNaN(joinDateObj.getMonth()) ? 12 : joinDateObj.getMonth() + 1
        const joinDay = isNaN(joinDateObj.getDate()) ? 1 : joinDateObj.getDate()

        // 1. Skip if period is BEFORE the joining month
        if (period.year < joinYear || (period.year === joinYear && period.month < joinMonth)) {
          skippedPriorToJoining++
          continue // Skip generation completely
        }

        const key = `${member.id}-${period.year}-${period.month}`
        if (existingKeySet.has(key) && !overwriteExisting) {
          skippedAlreadyExists++
          continue // Skip existing unless explicitly overwriting
        }

        const daysInMonth = getDaysInMonth(period.year, period.month)
        
        let periodStart = `${period.year}-${String(period.month).padStart(2, '0')}-01`
        const periodEnd = `${period.year}-${String(period.month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

        // Find active history record for this period
        const periodStartTS = new Date(periodStart).getTime()
        const periodEndTS = new Date(periodEnd).getTime()

        const memberHistories = historyMap.get(member.id) || []
        const activeHistory = memberHistories.find((hist) => {
          const histStart = new Date(hist.start_date).getTime()
          const histEnd = hist.end_date ? new Date(hist.end_date).getTime() : Infinity
          return histStart <= periodEndTS && histEnd >= periodStartTS
        })

        const activeBaseSalary = activeHistory ? Number(activeHistory.base_salary) : baseSalary
        const activeCurrency = activeHistory ? activeHistory.currency : currency

        let activeDays = daysInMonth
        let actualGrossSalary = activeBaseSalary

        // 2. Prorate if this is the EXACT joining month
        if (period.year === joinYear && period.month === joinMonth) {
          periodStart = joiningDate
          activeDays = Math.max(1, daysInMonth - joinDay + 1)
          actualGrossSalary = (activeBaseSalary / daysInMonth) * activeDays
        }

        // Realistic salary structure split: Basic (80%), HRA (16%), Special Allowance (4%)
        const split = calculateSalarySplitFromGross(actualGrossSalary)
        const allowances = [
          { id: 'hra', name: 'House Rent Allowance (HRA)', amount: split.hra },
          { id: 'special', name: 'Special Allowance', amount: split.specialAllowance },
        ]

        const deductions = Array.isArray(sp?.default_deductions) && sp.default_deductions.length > 0
          ? sp.default_deductions
          : getDefaultStatutoryDeductions(activeCurrency)

        const earningsBreakdown = [
          { id: 'basic', name: 'Basic Salary', amount: split.basic },
          ...allowances,
        ]

        const grossEarnings = earningsBreakdown.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0)
        const totalDeductions = deductions.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0)
        const netPay = Math.max(0, grossEarnings - totalDeductions)
        const netPayWords = numberToWords(netPay, activeCurrency)
        const fy = getFinancialYear(period.year, period.month)

        const payslipRecord = {
          employee_id: member.id,
          month: period.month,
          year: period.year,
          financial_year: fy,
          currency: activeCurrency,
          base_salary: split.basic,
          earnings_breakdown: earningsBreakdown,
          deductions_breakdown: deductions,
          gross_earnings: grossEarnings,
          total_deductions: totalDeductions,
          net_pay: netPay,
          net_pay_in_words: netPayWords,
          working_days: daysInMonth,
          paid_days: activeDays,
          lop_days: 0,
          status: 'PAID',
          payment_method: 'BANK_TRANSFER',
          designation,
          department,
          employee_code: employeeCode,
          bank_name: bankName,
          account_number: accountNumber,
          ifsc_or_iban: ifscOrIban,
          pan_or_iqama: panOrIqama,
          joining_date: joiningDate,
          period_start_date: periodStart,
          period_end_date: periodEnd,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        }

        generatedPayslips.push(payslipRecord)
      }
    }

    if (generatedPayslips.length > 0) {
      const { error: insertError } = await serviceClient
        .from('payslips')
        .upsert(generatedPayslips, { onConflict: 'employee_id,month,year' })

      if (insertError) {
        console.error('Payslip batch generation error:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 400 })
      }
    }

    return NextResponse.json({
      success: true,
      generatedCount: generatedPayslips.length,
      skippedPriorToJoining,
      skippedAlreadyExists,
      targetPeriod: `${targetMonth}/${targetYear}`,
    })
  } catch (err: any) {
    console.error('Generate monthly payslips server error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
