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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action, invoiceId, paymentId, amount, method, paidAt, referenceNote } = await req.json()

    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()

    if (action === 'RECORD') {
      const { error: insertErr } = await serviceClient.from('payments').insert({
        invoice_id: invoiceId,
        amount: parseFloat(amount),
        method: method || 'BANK_TRANSFER',
        paid_at: paidAt || new Date().toISOString().slice(0, 10),
        reference_note: referenceNote ? referenceNote.trim() : null,
        recorded_by: user.id,
      })

      if (insertErr) {
        console.error('Error inserting payment:', insertErr)
        return NextResponse.json({ error: insertErr.message }, { status: 400 })
      }
    } else if (action === 'UPDATE') {
      if (!paymentId) {
        return NextResponse.json({ error: 'Payment ID is required for update' }, { status: 400 })
      }

      const { error: updateErr } = await serviceClient
        .from('payments')
        .update({
          amount: parseFloat(amount),
          method: method || 'BANK_TRANSFER',
          paid_at: paidAt,
          reference_note: referenceNote ? referenceNote.trim() : null,
        })
        .eq('id', paymentId)

      if (updateErr) {
        console.error('Error updating payment:', updateErr)
        return NextResponse.json({ error: updateErr.message }, { status: 400 })
      }
    } else if (action === 'DELETE') {
      if (!paymentId) {
        return NextResponse.json({ error: 'Payment ID is required for deletion' }, { status: 400 })
      }

      const { error: deleteErr } = await serviceClient.from('payments').delete().eq('id', paymentId)

      if (deleteErr) {
        console.error('Error deleting payment:', deleteErr)
        return NextResponse.json({ error: deleteErr.message }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Sync invoice balance and status using service role
    const { data: allPayments } = await serviceClient
      .from('payments')
      .select('amount')
      .eq('invoice_id', invoiceId)

    const newAmountPaid = (allPayments ?? []).reduce((sum: number, p: any) => sum + Number(p.amount), 0)

    const { data: inv } = await serviceClient
      .from('invoices')
      .select('total, status')
      .eq('id', invoiceId)
      .single()

    if (inv) {
      const invTotal = Number(inv.total)
      let newStatus: string = inv.status

      if (newAmountPaid >= invTotal) {
        newStatus = 'PAID'
      } else if (newAmountPaid > 0) {
        newStatus = 'PARTIALLY_PAID'
      } else if (inv.status === 'PAID' || inv.status === 'PARTIALLY_PAID') {
        newStatus = 'SENT'
      }

      await serviceClient
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
        })
        .eq('id', invoiceId)
    }

    // Fetch updated invoice and payments to return
    const { data: updatedInvoice } = await serviceClient
      .from('invoices')
      .select('*, client:clients(*), items:invoice_items(*)')
      .eq('id', invoiceId)
      .single()

    const { data: updatedPayments } = await serviceClient
      .from('payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('paid_at', { ascending: false })

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
      payments: updatedPayments,
    })
  } catch (error: any) {
    console.error('Unexpected payment API error:', error)
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 })
  }
}
