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

    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Only Admins can delete quotations' }, { status: 403 })
    }

    const { quotationId } = await req.json()
    if (!quotationId) {
      return NextResponse.json({ error: 'Quotation ID is required' }, { status: 400 })
    }

    // Unlink any invoices that were converted/linked from this quotation first to satisfy foreign key constraint
    await serviceClient.from('invoices').update({ quotation_id: null }).eq('quotation_id', quotationId)

    // Delete associated quotation items
    await serviceClient.from('quotation_items').delete().eq('quotation_id', quotationId)

    // Delete quotation record
    const { error: delErr } = await serviceClient.from('quotations').delete().eq('id', quotationId)

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete quotation error:', error)
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 })
  }
}
