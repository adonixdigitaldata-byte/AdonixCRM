'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Plus, LayoutGrid, List, Search, X, Filter, SlidersHorizontal, Calendar, Upload } from 'lucide-react'
import KanbanBoard from './KanbanBoard'
import LeadsTable from './LeadsTable'
import AddLeadModal from './AddLeadModal'
import { getDateFilterBounds } from '@/lib/utils/date-filter'
import type { Lead, LeadStage, Profile, AdCampaign } from '@/types/database'

interface Props {
  profile: Profile
  stages: LeadStage[]
  campaigns: { id: string; name: string }[]
  agents: { id: string; name: string }[]
  availableMonths?: { value: string; label: string; count: number }[]
  initialSearchParams: Record<string, string | undefined>
}

export type ViewMode = 'kanban' | 'list'

export default function LeadsClient({
  profile,
  stages,
  campaigns,
  agents,
  availableMonths: initialAvailableMonths = [],
  initialSearchParams,
}: Props) {
  const [view, setView] = useState<ViewMode>('kanban')
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(initialSearchParams.action === 'add')

  // Available months where leads actually exist
  const [availableMonths, setAvailableMonths] = useState(initialAvailableMonths)
  const [pendingFollowupLeadIds, setPendingFollowupLeadIds] = useState<string[]>([])

  // Filters
  const [search, setSearch] = useState('')
  const initialDate = initialSearchParams.month
    ? (initialSearchParams.month.startsWith('month:') ? initialSearchParams.month : `month:${initialSearchParams.month}`)
    : 'ALL'
  const [filterDate, setFilterDate] = useState(initialDate)
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [filterCampaign, setFilterCampaign] = useState(initialSearchParams.campaign_id || '')
  const [filterAdSet, setFilterAdSet] = useState('')
  const [filterAd, setFilterAd] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterAgent, setFilterAgent] = useState('')
  const [filterStage, setFilterStage] = useState('')

  const [adSets, setAdSets] = useState<{ id: string; name: string }[]>([])
  const [ads, setAds] = useState<{ id: string; name: string }[]>([])

  const supabase = createClient()

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('leads')
      .select(`
        *,
        stage:lead_stages(id, key, label, sort_order, color_hex),
        assigned_agent:profiles(id, name, avatar_url),
        campaign:ad_campaigns(id, name),
        ad_set:ad_sets(id, name),
        ad:ads(id, name, creative_thumbnail_url)
      `)
      .order('created_at', { ascending: false })

    const { start, end } = getDateFilterBounds(filterDate, customStartDate, customEndDate)
    if (start) query = query.gte('created_at', start)
    if (end) query = query.lte('created_at', end)

    if (filterCampaign) query = query.eq('campaign_id', filterCampaign)
    if (filterAdSet) query = query.eq('ad_set_id', filterAdSet)
    if (filterAd) query = query.eq('ad_id', filterAd)
    if (filterSource) query = query.eq('source', filterSource)
    if (filterAgent) query = query.eq('assigned_agent_id', filterAgent)
    if (filterStage) query = query.eq('stage_id', filterStage)
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
    }

    // Agents only see their leads
    if (profile.role === 'AGENT') {
      query = query.eq('assigned_agent_id', profile.id)
    }

    const [leadsRes, fupsRes] = await Promise.all([
      query,
      supabase.from('lead_followups').select('lead_id').eq('is_completed', false),
    ])

    setLeads((leadsRes.data as Lead[]) ?? [])
    if (fupsRes.data) {
      setPendingFollowupLeadIds(fupsRes.data.map((f: any) => f.lead_id as string))
    }
    setLoading(false)
  }, [filterDate, customStartDate, customEndDate, filterCampaign, filterAdSet, filterAd, filterSource, filterAgent, filterStage, search, profile, supabase])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Cascade: fetch ad sets when campaign changes
  useEffect(() => {
    if (!filterCampaign) {
      setAdSets([])
      setFilterAdSet('')
      return
    }
    supabase
      .from('ad_sets')
      .select('id, name')
      .eq('campaign_id', filterCampaign)
      .order('name')
      .then(({ data }) => setAdSets(data ?? []))
  }, [filterCampaign])

  // Cascade: fetch ads when ad set changes
  useEffect(() => {
    if (!filterAdSet) {
      setAds([])
      setFilterAd('')
      return
    }
    supabase
      .from('ads')
      .select('id, name')
      .eq('ad_set_id', filterAdSet)
      .order('name')
      .then(({ data }) => setAds(data ?? []))
  }, [filterAdSet])

  const activeFilterCount = [
    filterDate !== 'ALL' ? filterDate : '',
    filterCampaign, filterAdSet, filterAd, filterSource, filterAgent, filterStage
  ].filter(Boolean).length

  const refreshAvailableMonths = useCallback(async () => {
    let q = supabase.from('leads').select('created_at')
    if (profile.role === 'AGENT') {
      q = q.eq('assigned_agent_id', profile.id)
    }
    const { data } = await q
    if (data) {
      const monthMap = new Map<string, number>()
      for (const item of data) {
        if (!item.created_at) continue
        const d = new Date(item.created_at)
        if (isNaN(d.getTime())) continue
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const key = `${y}-${m}`
        monthMap.set(key, (monthMap.get(key) || 0) + 1)
      }
      const months = Array.from(monthMap.entries()).map(([value, count]) => {
        const [y, m] = value.split('-')
        const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1)
        const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        return {
          value,
          label: `${label} (${count})`,
          count,
        }
      })
      months.sort((a, b) => b.value.localeCompare(a.value))
      setAvailableMonths(months)
    }
  }, [profile.id, profile.role, supabase])

  function clearAllFilters() {
    setFilterDate('ALL')
    setCustomStartDate('')
    setCustomEndDate('')
    setFilterCampaign('')
    setFilterAdSet('')
    setFilterAd('')
    setFilterSource('')
    setFilterAgent('')
    setFilterStage('')
    setSearch('')
  }

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="text-page-title">Leads</h1>
          <p className="text-meta" style={{ marginTop: 2 }}>
            {leads.length} lead{leads.length !== 1 ? 's' : ''}
            {activeFilterCount > 0 ? ' (filtered)' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${view === 'kanban' ? 'active' : ''}`}
              onClick={() => setView('kanban')}
              title="Kanban view"
            >
              <LayoutGrid size={14} />
              Board
            </button>
            <button
              className={`view-toggle-btn ${view === 'list' ? 'active' : ''}`}
              onClick={() => setView('list')}
              title="List view"
            >
              <List size={14} />
              List
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/settings/import"
              className="btn btn-secondary btn-sm"
              title="Import leads from Excel / XLSX file"
            >
              <Upload size={14} />
              Import XLSX
            </Link>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={14} />
              Add lead
            </button>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        {/* Search */}
        <div className="search-input-wrapper">
          <Search size={14} />
          <input
            className="search-input"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: 8,
                background: 'none',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Date Filter */}
        <select
          className="filter-select"
          value={filterDate}
          onChange={(e) => {
            setFilterDate(e.target.value)
            if (e.target.value !== 'CUSTOM') {
              setCustomStartDate('')
              setCustomEndDate('')
            }
          }}
          style={
            filterDate !== 'ALL'
              ? { borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600 }
              : undefined
          }
          title="Filter leads by date"
        >
          <option value="ALL">All Time</option>
          <option value="TODAY">Today</option>
          <option value="PAST_3_DAYS">Past 3 Days</option>
          <option value="THIS_WEEK">This Week</option>
          <option value="THIS_MONTH">This Month</option>
          {availableMonths.length > 0 && (
            <optgroup label="By Month">
              {availableMonths.map((m) => (
                <option key={m.value} value={`month:${m.value}`}>
                  {m.label}
                </option>
              ))}
            </optgroup>
          )}
          <option value="CUSTOM">Custom Range...</option>
        </select>

        {filterDate === 'CUSTOM' && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              className="filter-select"
              style={{ padding: '4px 8px' }}
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              title="Start date"
            />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>to</span>
            <input
              type="date"
              className="filter-select"
              style={{ padding: '4px 8px' }}
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              title="End date"
            />
          </div>
        )}

        {/* Campaign cascade */}
        <select
          className="filter-select"
          value={filterCampaign}
          onChange={(e) => setFilterCampaign(e.target.value)}
        >
          <option value="">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={filterAdSet}
          onChange={(e) => setFilterAdSet(e.target.value)}
          disabled={!filterCampaign}
        >
          <option value="">All ad sets</option>
          {adSets.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={filterAd}
          onChange={(e) => setFilterAd(e.target.value)}
          disabled={!filterAdSet}
        >
          <option value="">All ads</option>
          {ads.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        {/* Source */}
        <select
          className="filter-select"
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
        >
          <option value="">All sources</option>
          <option value="META_ADS">Meta Ads</option>
          <option value="MANUAL">Manual</option>
          <option value="COLD_OUTREACH">Cold Outreach</option>
          <option value="XLSX_IMPORT">XLSX Import</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="TIKTOK">TikTok</option>
          <option value="SNAPCHAT">Snapchat</option>
        </select>

        {/* Agent (admin only) */}
        {profile.role === 'ADMIN' && (
          <select
            className="filter-select"
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}

        {/* Stage */}
        {view === 'list' && (
          <select
            className="filter-select"
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
          >
            <option value="">All stages</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        )}

        {/* Clear filters */}
        {activeFilterCount > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={clearAllFilters}
            style={{ color: 'var(--danger)', marginLeft: 4 }}
          >
            <X size={13} />
            Clear filters ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Content */}
      {view === 'kanban' ? (
        <div className="kanban-wrapper" style={{ padding: '16px 24px' }}>
          <KanbanBoard
            leads={leads}
            stages={stages}
            loading={loading}
            onLeadMoved={fetchLeads}
            currentUserId={profile.id}
            pendingFollowupLeadIds={pendingFollowupLeadIds}
          />
        </div>
      ) : (
        <div style={{ padding: '16px 24px' }}>
          <LeadsTable
            leads={leads}
            loading={loading}
            onRefresh={() => {
              fetchLeads()
              refreshAvailableMonths()
            }}
            agents={agents}
            isAdmin={profile.role === 'ADMIN'}
            userRole={profile.role}
          />
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <AddLeadModal
          stages={stages}
          agents={agents}
          currentUserId={profile.id}
          userRole={profile.role}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false)
            fetchLeads()
            refreshAvailableMonths()
          }}
        />
      )}
    </div>
  )
}
