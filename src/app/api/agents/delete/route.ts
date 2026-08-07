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
    
    // Check if the current user is an Admin
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Only Admins can delete users' }, { status: 403 })
    }

    const { userId } = await req.json()
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    if (userId === user.id) {
      return NextResponse.json({ error: 'Cannot delete your own admin account' }, { status: 400 })
    }

    // 1. Delete from public profiles table first
    const { error: profileErr } = await serviceClient
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 400 })
    }

    // 2. Delete from Supabase Auth completely using service role
    const { error: authErr } = await serviceClient.auth.admin.deleteUser(userId)
    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
