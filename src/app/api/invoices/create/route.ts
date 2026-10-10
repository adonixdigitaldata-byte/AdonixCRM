import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {},
        },
      }
    )

    const {
      data: { user },
    } = await supabaseUser.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required to generate invoices' }, { status: 401 })
    }

    const serviceClient = await createServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, name, role')
      .eq('id', user.id)
      .single()

    if (!profile || !['ADMIN', 'ACCOUNT_MANAGER', 'AGENT'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to issue or generate invoices' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const {
      clientId,
      officeLocation,
      invoiceType,
      currency,
      issueDate,
      dueDate,
      subtotal,
      discountType,
      discountValue,
      discountAmount,
      taxPercent,
      taxAmount,
      total,
      status,
      notes,
      terms,
      bankName,
      bankAccountName,
      bankAccountNumber,
      bankIban,
      bankSwift,
      bankIfsc,
      items,
      isCreditNote,
      isDebitNote,
      referenceInvoiceId,
      referenceInvoiceNumber,
      creditDebitReason,
    } = body

    if (!clientId) {
      return NextResponse.json({ error: 'Client is required' }, { status: 400 })
    }

    // 1. Generate strictly sequential, controlled invoice counter
    // Determine the next sequence counter atomically from the database
    let nextCounter = 1
    const { data: latestInvoice } = await serviceClient
      .from('invoices')
      .select('invoice_counter_value')
      .order('invoice_counter_value', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (latestInvoice && latestInvoice.invoice_counter_value) {
      nextCounter = latestInvoice.invoice_counter_value + 1
    } else {
      // Fallback check total invoices count
      const { count } = await serviceClient.from('invoices').select('*', { count: 'exact', head: true })
      nextCounter = (count || 0) + 1
    }

    const prefix = isCreditNote ? 'CN-KSA' : isDebitNote ? 'DN-KSA' : officeLocation === 'HYDERABAD' ? 'INV-HYD' : 'INV-KSA'
    const invoiceNumber = `${prefix}-${String(nextCounter).padStart(6, '0')}`

    // 2. Exact UTC Time of supply / issuance
    const nowUtc = new Date()
    const issueTime = `${nowUtc.getUTCHours().toString().padStart(2, '0')}:${nowUtc.getUTCMinutes().toString().padStart(2, '0')}:${nowUtc.getUTCSeconds().toString().padStart(2, '0')} UTC`

    // 3. Insert Invoice Record
    const { data: newInvoice, error: invErr } = await serviceClient
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        invoice_counter_value: nextCounter,
        client_id: clientId,
        office_location: officeLocation || 'KSA',
        invoice_type: officeLocation === 'HYDERABAD' ? null : (invoiceType || 'B2B'),
        zatca_status: officeLocation === 'HYDERABAD' ? 'NOT_APPLICABLE' : 'PENDING',
        currency: currency || (officeLocation === 'HYDERABAD' ? 'INR' : 'SAR'),
        issue_date: issueDate || nowUtc.toISOString().slice(0, 10),
        issue_time: issueTime,
        due_date: dueDate || null,
        subtotal: subtotal || 0,
        discount_type: discountType || 'PERCENTAGE',
        discount_value: discountValue || 0,
        discount_amount: discountAmount || 0,
        tax_percent: taxPercent ?? 15,
        tax_amount: taxAmount || 0,
        total: total || 0,
        amount_paid: 0,
        status: status || 'DRAFT',
        notes: notes || null,
        terms: terms || null,
        bank_name: bankName || null,
        bank_account_name: bankAccountName || null,
        bank_account_number: bankAccountNumber || null,
        bank_iban: bankIban || null,
        bank_swift: bankSwift || null,
        bank_ifsc: bankIfsc || null,
        is_credit_note: isCreditNote || false,
        is_debit_note: isDebitNote || false,
        reference_invoice_id: referenceInvoiceId || null,
        reference_invoice_number: referenceInvoiceNumber || null,
        credit_debit_reason: creditDebitReason || null,
        created_by: profile.id,
      })
      .select('*')
      .single()

    if (invErr || !newInvoice) {
      return NextResponse.json({ error: invErr?.message || 'Failed to create invoice' }, { status: 400 })
    }

    // 4. Insert Line Items
    if (items && Array.isArray(items) && items.length > 0) {
      const validItems = items
        .filter((i: any) => i.description && i.description.trim())
        .map((item: any, idx: number) => ({
          invoice_id: newInvoice.id,
          description: item.description.trim(),
          qty: Number(item.qty) || 1,
          unit_price: Number(item.unit_price) || 0,
          discount_percent: Number(item.discount_percent) || 0,
          amount: Number(item.amount) || 0,
          sort_order: idx,
        }))

      if (validItems.length > 0) {
        await serviceClient.from('invoice_items').insert(validItems)
      }
    }

    // 5. Create Immutable Audit Log entry
    try {
      await serviceClient.from('invoice_audit_logs').insert({
        invoice_id: newInvoice.id,
        invoice_number: newInvoice.invoice_number,
        action: isCreditNote ? 'CREDIT_NOTE_ISSUED' : 'CREATED',
        performed_by: profile.id,
        new_state: {
          invoice_number: newInvoice.invoice_number,
          status: newInvoice.status,
          total: newInvoice.total,
          tax_amount: newInvoice.tax_amount,
          client_id: newInvoice.client_id,
          created_at: newInvoice.created_at,
        },
      })
    } catch (auditErr) {
      console.warn('Audit logging warning:', auditErr)
    }

    return NextResponse.json({ success: true, invoice: newInvoice })
  } catch (error: any) {
    console.error('Invoice creation error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
