import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN!
const META_APP_SECRET = process.env.META_APP_SECRET!
const META_PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN!

// GET: Webhook verification handshake
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
    console.log('[Meta Webhook] Verification successful')
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Forbidden', { status: 403 })
}

// POST: Receive lead notifications
export async function POST(request: NextRequest) {
  // Verify signature
  const body = await request.text()
  const signature = request.headers.get('x-hub-signature-256')

  if (!verifySignature(body, signature)) {
    console.error('[Meta Webhook] Invalid signature')
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const payload = JSON.parse(body)

  // Process each entry
  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field === 'leadgen') {
          await processLead(change.value)
        }
      }
    }
  } catch (err) {
    console.error('[Meta Webhook] Processing error:', err)
  }

  return new NextResponse('OK', { status: 200 })
}

function verifySignature(body: string, signature: string | null): boolean {
  if (!signature) return false
  const expected = 'sha256=' + crypto
    .createHmac('sha256', META_APP_SECRET)
    .update(body)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  )
}

async function processLead(value: {
  leadgen_id: string
  page_id: string
  form_id: string
  ad_id: string
  adgroup_id: string
  campaign_id: string
}) {
  const supabase = await createServiceClient()

  // 1. Fetch full lead data from Meta Graph API
  const leadRes = await fetch(
    `https://graph.facebook.com/v20.0/${value.leadgen_id}?fields=id,created_time,field_data,ad_id,adset_id,campaign_id,form_id&access_token=${META_PAGE_ACCESS_TOKEN}`
  )
  const leadData = await leadRes.json()

  if (leadData.error) {
    console.error('[Meta Webhook] Graph API error:', leadData.error)
    return
  }

  // 2. Parse field_data into form_data object
  const formData: Record<string, string> = {}
  let name = '', phone = '', email = ''

  for (const field of leadData.field_data ?? []) {
    const key = field.name as string
    const val = (field.values?.[0] ?? '') as string
    formData[key] = val

    if (key === 'full_name' || key === 'name') name = val
    if (key === 'phone_number' || key === 'phone') phone = val
    if (key === 'email') email = val
  }

  // 3. Upsert campaign
  let campaignDbId: string | null = null
  if (value.campaign_id) {
    // Fetch campaign name from Meta
    const campRes = await fetch(
      `https://graph.facebook.com/v20.0/${value.campaign_id}?fields=id,name,objective,status&access_token=${META_PAGE_ACCESS_TOKEN}`
    )
    const campData = await campRes.json()

    const { data: campaign } = await supabase
      .from('ad_campaigns')
      .upsert({
        meta_campaign_id: value.campaign_id,
        name: campData.name ?? `Campaign ${value.campaign_id}`,
        objective: campData.objective ?? null,
        status: campData.status ?? null,
      }, { onConflict: 'meta_campaign_id' })
      .select('id')
      .single()
    campaignDbId = campaign?.id ?? null
  }

  // 4. Upsert ad set
  let adSetDbId: string | null = null
  if (value.adgroup_id && campaignDbId) {
    const adsetRes = await fetch(
      `https://graph.facebook.com/v20.0/${value.adgroup_id}?fields=id,name,status&access_token=${META_PAGE_ACCESS_TOKEN}`
    )
    const adsetData = await adsetRes.json()

    const { data: adSet } = await supabase
      .from('ad_sets')
      .upsert({
        meta_adset_id: value.adgroup_id,
        campaign_id: campaignDbId,
        name: adsetData.name ?? `Ad Set ${value.adgroup_id}`,
        status: adsetData.status ?? null,
      }, { onConflict: 'meta_adset_id' })
      .select('id')
      .single()
    adSetDbId = adSet?.id ?? null
  }

  // 5. Upsert ad
  let adDbId: string | null = null
  if (value.ad_id && adSetDbId) {
    const adRes = await fetch(
      `https://graph.facebook.com/v20.0/${value.ad_id}?fields=id,name,status&access_token=${META_PAGE_ACCESS_TOKEN}`
    )
    const adData = await adRes.json()

    const { data: ad } = await supabase
      .from('ads')
      .upsert({
        meta_ad_id: value.ad_id,
        ad_set_id: adSetDbId,
        name: adData.name ?? `Ad ${value.ad_id}`,
        status: adData.status ?? null,
      }, { onConflict: 'meta_ad_id' })
      .select('id')
      .single()
    adDbId = ad?.id ?? null
  }

  // 6. Dedup check
  const { data: existing } = await supabase
    .from('leads')
    .select('id')
    .or(`phone.eq.${phone},email.eq.${email}`)
    .limit(1)
    .single()

  // 7. Get default stage (first stage)
  const { data: firstStage } = await supabase
    .from('lead_stages')
    .select('id')
    .order('sort_order')
    .limit(1)
    .single()

  // 8. Auto-assign agent (round-robin by open lead count)
  const { data: activeAgents } = await supabase
    .from('profiles')
    .select('id, open_leads_count')
    .eq('role', 'AGENT')
    .eq('is_active', true)
    .order('open_leads_count')
    .limit(1)

  const assignedAgentId = activeAgents?.[0]?.id ?? null

  // 9. Insert lead
  const { data: lead } = await supabase
    .from('leads')
    .insert({
      source: 'META_ADS',
      campaign_id: campaignDbId,
      ad_set_id: adSetDbId,
      ad_id: adDbId,
      name: name || null,
      phone: phone || null,
      email: email || null,
      form_data: formData,
      raw_payload: value,
      stage_id: firstStage?.id,
      assigned_agent_id: assignedAgentId,
      is_duplicate: !!existing,
      duplicate_of: existing?.id ?? null,
    })
    .select('id')
    .single()

  if (lead) {
    // 10. Log activity
    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      activity_type: 'LEAD_CREATED',
      metadata: { source: 'META_ADS', form_id: value.form_id, leadgen_id: value.leadgen_id },
    })

    // 11. Update agent open_leads_count
    if (assignedAgentId) {
      await supabase.rpc('increment_agent_leads', { agent_id: assignedAgentId })
    }
  }

  console.log(`[Meta Webhook] Lead ${lead?.id} created (${name}, ${phone})`)
}
