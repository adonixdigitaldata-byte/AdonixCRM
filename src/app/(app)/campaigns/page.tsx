import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

export const metadata: Metadata = { title: 'Campaigns' }

export default async function CampaignsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') redirect('/leads')

  const { data: campaigns } = await supabase
    .from('ad_campaigns')
    .select('*, ad_sets(id, name, ads(id))')
    .order('created_at', { ascending: false })

  // Lead counts per campaign
  const { data: leadCounts } = await supabase
    .from('leads')
    .select('campaign_id')
    .not('campaign_id', 'is', null)

  const campaignLeadCounts: Record<string, number> = {}
  leadCounts?.forEach((l: any) => {
    if (l.campaign_id) campaignLeadCounts[l.campaign_id] = (campaignLeadCounts[l.campaign_id] ?? 0) + 1
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-page-title">Campaigns</h1>
          <p className="text-meta" style={{ marginTop: 2 }}>
            {campaigns?.length ?? 0} campaign{campaigns?.length !== 1 ? 's' : ''} — auto-created from Meta Ads webhooks
          </p>
        </div>
      </div>

      <div className="page-body">
        {!campaigns || campaigns.length === 0 ? (
          <div className="card">
            <div className="empty-state" style={{ padding: '48px 24px' }}>
              <div className="empty-state-title">No campaigns yet</div>
              <div className="empty-state-desc">
                Campaigns are created automatically when Meta Ads leads arrive via webhook.
                Once you receive your first lead, it will appear here.
              </div>
            </div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Campaign name</th>
                  <th>Objective</th>
                  <th>Status</th>
                  <th className="num">Ad sets</th>
                  <th className="num">Ads</th>
                  <th className="num">Leads</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign: any) => {
                  const adSetCount = campaign.ad_sets?.length ?? 0
                  const adCount = campaign.ad_sets?.reduce((acc: number, as: any) => acc + (as.ads?.length ?? 0), 0) ?? 0
                  const leadCount = campaignLeadCounts[campaign.id] ?? 0

                  return (
                    <tr key={campaign.id}>
                      <td style={{ fontWeight: 500 }}>{campaign.name}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                        {campaign.objective ?? '—'}
                      </td>
                      <td>
                        <span className={`badge ${campaign.status === 'ACTIVE' ? 'badge-success' : 'badge-default'}`}>
                          {campaign.status ?? 'Unknown'}
                        </span>
                      </td>
                      <td className="num">{adSetCount}</td>
                      <td className="num">{adCount}</td>
                      <td className="num">
                        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {leadCount}
                        </span>
                      </td>
                      <td>
                        {leadCount > 0 && (
                          <Link
                            href={`/leads?campaign_id=${campaign.id}`}
                            className="btn btn-ghost btn-xs"
                          >
                            View leads <ExternalLink size={11} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
