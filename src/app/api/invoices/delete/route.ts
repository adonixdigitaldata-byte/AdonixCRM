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

    const serviceClient = await createServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['ADMIN', 'ACCOUNT_MANAGER', 'AGENT'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden: Only Admins, Account Managers, and Sales Agents can delete invoices' }, { status: 403 })
    }

    const { invoiceId } = await req.json()
    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 })
    }

    // Delete associated payments and invoice items first
    await serviceClient.from('payments').delete().eq('invoice_id', invoiceId)
    await serviceClient.from('invoice_items').delete().eq('invoice_id', invoiceId)

    const { error: delErr } = await serviceClient.from('invoices').delete().eq('id', invoiceId)

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete invoice error:', error)
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 })
  }
}
