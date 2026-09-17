import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface ImportRowPayload {
  name?: string
  phone?: string
  email?: string
  city?: string
  interest?: string
  potential_value?: number | null
  stage_id?: string
  assigned_agent_id?: string
}

export async function POST(request: NextRequest) {
  const supabaseUser = await createClient()
  const { data: { user } } = await supabaseUser.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabaseUser
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role === 'CLIENT') {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions to import leads' }, { status: 403 })
  }

  const body = await request.json()
  const { fileName, defaultStageId, defaultAgentId, rows } = body as {
    fileName: string
    defaultStageId: string
    defaultAgentId?: string
    rows: ImportRowPayload[]
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 })
  }

  const isAgent = profile.role === 'AGENT'
  const effectiveAgentId = isAgent ? user.id : (defaultAgentId || null)

  const supabaseService = await createServiceClient()

  // 1. Create import batch
  const { data: batch, error: batchError } = await supabaseService
    .from('import_batches')
    .insert({
      file_name: fileName || 'leads-import.xlsx',
      total_rows: rows.length,
      success_count: 0,
      error_count: 0,
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 500 })
  }

  let successCount = 0
  let errorCount = 0
  const agentCounts: Record<string, number> = {}

  // 2. Process rows in batches of 50
  const CHUNK_SIZE = 50
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    const leadsToInsert = chunk.map((r) => {
      // If agent is uploading, enforce assigned_agent_id is themselves;
      // if admin/manager, allow row-specific agent or fallback to defaultAgentId
      const targetAgentId = isAgent
        ? user.id
        : (r.assigned_agent_id !== undefined ? (r.assigned_agent_id || null) : effectiveAgentId)

      return {
        source: 'XLSX_IMPORT',
        name: r.name || null,
        phone: r.phone || null,
        email: r.email || null,
        city: r.city || null,
        interest: r.interest || null,
        potential_value: r.potential_value ? Number(r.potential_value) : null,
        stage_id: r.stage_id || defaultStageId,
        assigned_agent_id: targetAgentId,
        import_batch_id: batch.id,
        form_data: {},
      }
    })

    const { data: inserted, error: insertError } = await supabaseService
      .from('leads')
      .insert(leadsToInsert)
      .select('id, assigned_agent_id')

    if (insertError) {
      // Fall back row-by-row for this chunk to capture partial successes
      for (const singleLead of leadsToInsert) {
        const { data: singleInserted, error: singleError } = await supabaseService
          .from('leads')
          .insert(singleLead)
          .select('id, assigned_agent_id')
          .single()

        if (singleError) {
          errorCount++
        } else {
          successCount++
          if (singleInserted.assigned_agent_id) {
            agentCounts[singleInserted.assigned_agent_id] = (agentCounts[singleInserted.assigned_agent_id] || 0) + 1
          }
          await supabaseService.from('lead_activities').insert({
            lead_id: singleInserted.id,
            activity_type: 'LEAD_CREATED',
            performed_by: user.id,
            metadata: { source: 'XLSX_IMPORT', batch_id: batch.id },
          })
        }
      }
    } else {
      const insertedCount = inserted?.length || 0
      successCount += insertedCount
      errorCount += chunk.length - insertedCount

      // Create activity logs and track agent counts
      if (inserted && inserted.length > 0) {
        const activityRecords = inserted.map((l) => {
          if (l.assigned_agent_id) {
            agentCounts[l.assigned_agent_id] = (agentCounts[l.assigned_agent_id] || 0) + 1
          }
          return {
            lead_id: l.id,
            activity_type: 'LEAD_CREATED',
            performed_by: user.id,
            metadata: { source: 'XLSX_IMPORT', batch_id: batch.id },
          }
        })
        await supabaseService.from('lead_activities').insert(activityRecords)
      }
    }
  }

  // 3. Update agent lead counts
  for (const [agentId, count] of Object.entries(agentCounts)) {
    for (let c = 0; c < count; c++) {
      await supabaseService.rpc('increment_agent_leads', { agent_id: agentId })
    }
  }

  // 4. Update import batch stats
  await supabaseService
    .from('import_batches')
    .update({
      success_count: successCount,
      error_count: errorCount,
    })
    .eq('id', batch.id)

  return NextResponse.json({
    success: true,
    batchId: batch.id,
    total: rows.length,
    successCount,
    errorCount,
  })
}
