import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { getAllContracts, saveContract } from '@/lib/contracts/contractStore'

export async function GET() {
  try {
    const contracts = await getAllContracts()
    return NextResponse.json({ success: true, contracts })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch contracts' }, { status: 500 })
  }
}

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
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const {
      client_name,
      service_title,
    } = body

    if (!client_name || !service_title) {
      return NextResponse.json(
        { error: 'Client Name and Service Title are required' },
        { status: 400 }
      )
    }

    let resolvedClientId = body.client_id || null

    // Automatically create or update client in the database
    try {
      const serviceClient = await createServiceClient()

      if (!resolvedClientId) {
        // Only link to an existing client if the exact email is provided and matches
        if (body.client_email?.trim()) {
          const { data } = await serviceClient
            .from('clients')
            .select('id')
            .eq('email', body.client_email.trim().toLowerCase())
            .maybeSingle()
          if (data?.id) resolvedClientId = data.id
        }
      }

      if (resolvedClientId) {
        // Update existing client with contract start/end dates and billing amount
        await serviceClient
          .from('clients')
          .update({
            contract_start_date: body.start_date || new Date().toISOString().slice(0, 10),
            contract_end_date: body.end_date || null,
            billing_amount: Number(body.contract_price) || 0,
            billing_cycle: body.billing_cycle || 'MONTHLY',
            client_status: 'ACTIVE',
            ...(body.client_company ? { company: body.client_company.trim() } : {}),
            ...(body.client_phone ? { phone: body.client_phone.trim() } : {}),
            ...(body.client_email ? { email: body.client_email.trim() } : {}),
            ...(body.client_cr ? { cr_number: body.client_cr.trim() } : {}),
            ...(body.client_vat ? { vat_number: body.client_vat.trim() } : {}),
            ...(body.client_address ? { address: body.client_address.trim() } : {}),
          })
          .eq('id', resolvedClientId)
      } else {
        // Automatically insert new client record into database
        const { data: newClient, error: clientErr } = await serviceClient
          .from('clients')
          .insert({
            name: client_name.trim(),
            company: body.client_company?.trim() || null,
            email: body.client_email?.trim() || null,
            phone: body.client_phone?.trim() || null,
            address: body.client_address?.trim() || null,
            cr_number: body.client_cr?.trim() || null,
            vat_number: body.client_vat?.trim() || null,
            client_status: 'ACTIVE',
            contract_start_date: body.start_date || new Date().toISOString().slice(0, 10),
            contract_end_date: body.end_date || null,
            billing_amount: Number(body.contract_price) || 0,
            billing_cycle: body.billing_cycle || 'MONTHLY',
          })
          .select('id')
          .single()

        if (!clientErr && newClient?.id) {
          resolvedClientId = newClient.id
        }
      }
    } catch (dbErr) {
      console.warn('Could not auto-sync client record in database:', dbErr)
    }

    const saved = await saveContract({
      ...body,
      client_id: resolvedClientId,
      created_by: user.id,
    })

    return NextResponse.json({ success: true, contract: saved }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating contract:', error)
    return NextResponse.json({ error: error.message || 'Failed to create contract' }, { status: 500 })
  }
}
