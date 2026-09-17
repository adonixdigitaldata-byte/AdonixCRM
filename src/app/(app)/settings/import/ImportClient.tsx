'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, CheckCircle, XCircle, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { format } from 'date-fns'
import type { LeadStage } from '@/types/database'

interface Props {
  stages: LeadStage[]
  agents: { id: string; name: string }[]
  batches: any[]
  currentUserId: string
  userRole?: string
}

interface ParsedRow {
  rowIndex: number
  name?: string
  phone?: string
  email?: string
  city?: string
  interest?: string
  potential_value?: number | null
  stage_id?: string
  assigned_agent_id?: string
  status: 'valid' | 'error' | 'duplicate'
  error?: string
}

export default function ImportClient({ stages, agents, batches: initialBatches, currentUserId, userRole }: Props) {
  const isAgent = userRole === 'AGENT'
  const [batches, setBatches] = useState(initialBatches)
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [stageId, setStageId] = useState(stages[0]?.id ?? '')
  const [agentId, setAgentId] = useState(isAgent ? currentUserId : '')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  function updateRowStage(rowIndex: number, newStageId: string) {
    setParsedRows((prev) =>
      prev.map((r) => (r.rowIndex === rowIndex ? { ...r, stage_id: newStageId } : r))
    )
  }

  function updateRowAgent(rowIndex: number, newAgentId: string) {
    setParsedRows((prev) =>
      prev.map((r) => (r.rowIndex === rowIndex ? { ...r, assigned_agent_id: newAgentId } : r))
    )
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)

    // Dynamic import to avoid Turbopack chunk loading issue
    const XLSX = await import('xlsx')

    // Parse XLSX/CSV
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const data: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    // Check for existing phones/emails in database
    const phones = data.map((r) => String(r.phone || r.Phone || r.PHONE || r.mobile || '').trim()).filter(Boolean)
    const emails = data.map((r) => String(r.email || r.Email || r.EMAIL || '').trim()).filter(Boolean)

    const { data: existingByPhone } = await supabase
      .from('leads').select('phone').in('phone', phones)
    const { data: existingByEmail } = await supabase
      .from('leads').select('email').in('email', emails)

    const dupPhones = new Set(existingByPhone?.map((l: any) => l.phone) ?? [])
    const dupEmails = new Set(existingByEmail?.map((l: any) => l.email) ?? [])

    const seenPhonesInFile = new Set<string>()
    const seenEmailsInFile = new Set<string>()

    const rows: ParsedRow[] = data.map((row, i) => {
      const name = String(row.name || row.Name || row.NAME || row.full_name || '').trim()
      const phone = String(row.phone || row.Phone || row.PHONE || row.mobile || '').trim()
      const email = String(row.email || row.Email || row.EMAIL || '').trim()
      const city = String(row.city || row.City || row.CITY || '').trim()
      const interest = String(row.interest || row.Interest || row.service || '').trim()
      const potentialRaw = row.potential_value || row['Potential Value'] || row.potentialValue || row.value || ''
      const potential_value = potentialRaw ? parseFloat(String(potentialRaw)) : null

      // Match Stage column from XLSX if available
      const stageRaw = String(row.stage || row.Stage || row.STAGE || row.stage_id || row['Lead Stage'] || '').trim().toLowerCase()
      const matchedStage = stageRaw
        ? stages.find((s) => s.label.toLowerCase() === stageRaw || s.label.toLowerCase().includes(stageRaw) || s.id === stageRaw)
        : undefined
      const matchedStageId = matchedStage ? matchedStage.id : undefined

      // Match Agent column from XLSX if available (by Email first, then Exact Name, then ID/Substring)
      const agentRaw = String(row.agent || row.Agent || row.AGENT || row.assigned_agent || row['Assigned Agent'] || row['Agent Name'] || row.agent_name || '').trim().toLowerCase()
      const matchedAgent = agentRaw
        ? agents.find((a) => {
            const agentName = a.name.toLowerCase()
            const agentEmail = (a as any).email?.toLowerCase() || ''

            // 1. If agentRaw is an email address (contains @), strictly match exact email
            if (agentRaw.includes('@')) {
              return agentEmail === agentRaw
            }

            // 2. Exact name or ID match
            if (agentName === agentRaw || a.id === agentRaw) {
              return true
            }

            // 3. Substring name match (only if not an email)
            return agentName.includes(agentRaw) || agentRaw.includes(agentName)
          })
        : undefined
      const matchedAgentId = matchedAgent ? matchedAgent.id : undefined

      if (!name && !phone && !email) {
        return { 
          rowIndex: i + 2, name, phone, email, city, interest, potential_value, 
          stage_id: matchedStageId, assigned_agent_id: matchedAgentId,
          status: 'error' as const, error: 'No contact info' 
        }
      }

      const isDbDuplicate = (phone && dupPhones.has(phone)) || (email && dupEmails.has(email))
      const isFileDuplicate = (phone && seenPhonesInFile.has(phone)) || (email && seenEmailsInFile.has(email))

      if (isDbDuplicate || isFileDuplicate) {
        return {
          rowIndex: i + 2,
          name, phone, email, city, interest, potential_value,
          stage_id: matchedStageId, assigned_agent_id: matchedAgentId,
          status: 'duplicate' as const,
          error: isDbDuplicate ? 'Already in CRM' : 'Duplicate row in file',
        }
      }

      if (phone) seenPhonesInFile.add(phone)
      if (email) seenEmailsInFile.add(email)

      return { 
        rowIndex: i + 2, name, phone, email, city, interest, potential_value,
        stage_id: matchedStageId, assigned_agent_id: matchedAgentId,
        status: 'valid' as const 
      }
    })

    setParsedRows(rows)
    setStep('preview')
  }

  async function handleImport() {
    setImporting(true)
    const validRows = parsedRows.filter((r) => r.status === 'valid')

    try {
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          defaultStageId: stageId,
          defaultAgentId: isAgent ? currentUserId : agentId,
          rows: validRows.map((r) => ({
            name: r.name,
            phone: r.phone,
            email: r.email,
            city: r.city,
            interest: r.interest,
            potential_value: r.potential_value,
            stage_id: r.stage_id || stageId,
            assigned_agent_id: isAgent ? currentUserId : (r.assigned_agent_id !== undefined ? r.assigned_agent_id : agentId),
          })),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to import leads')
        setImporting(false)
        return
      }

      setImportResult({
        total: validRows.length,
        success: data.successCount ?? 0,
        errors: data.errorCount ?? 0,
        duplicates: parsedRows.filter((r) => r.status === 'duplicate').length,
      })
      setStep('done')
      const { data: updatedBatches } = await supabase.from('import_batches').select('*').order('created_at', { ascending: false }).limit(10)
      if (updatedBatches) setBatches(updatedBatches)
    } catch (err: any) {
      alert(err.message || 'Error occurred during import')
    } finally {
      setImporting(false)
    }
  }

  const validCount = parsedRows.filter((r) => r.status === 'valid').length
  const duplicateCount = parsedRows.filter((r) => r.status === 'duplicate').length
  const errorCount = parsedRows.filter((r) => r.status === 'error').length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-page-title">Import leads</h1>
          <p className="text-meta" style={{ marginTop: 2 }}>Upload XLSX or CSV files with lead data</p>
        </div>
      </div>

      <div className="page-body">
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Step: Upload */}
          {step === 'upload' && (
            <div className="card">
              <div className="card-header">
                <span className="text-section-header">Upload file</span>
              </div>
              <div className="card-body">
                <div
                  style={{
                    border: '2px dashed var(--border)', borderRadius: 'var(--radius)',
                    padding: 40, textAlign: 'center', cursor: 'pointer',
                    transition: 'border-color 150ms ease',
                  }}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault() }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const file = e.dataTransfer.files[0]
                    if (file && fileRef.current) {
                      const dt = new DataTransfer()
                      dt.items.add(file)
                      fileRef.current.files = dt.files
                      fileRef.current.dispatchEvent(new Event('change', { bubbles: true }))
                    }
                  }}
                >
                  <FileSpreadsheet size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Drop your XLSX or CSV file here
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                    or click to browse
                  </div>
                  <button type="button" className="btn btn-outline btn-sm">
                    <Upload size={14} />
                    Choose file
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Expected columns:</strong>{' '}
                  name, phone, email, city, interest (case-insensitive). Extra columns are ignored.
                </div>
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <>
              {/* Summary */}
              <div className="card">
                <div className="card-header">
                  <span className="text-section-header">Preview: {fileName}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setStep('upload'); setParsedRows([]) }}>
                    Change file
                  </button>
                </div>
                <div className="card-body">
                  <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                      <span style={{ fontSize: 13 }}><strong>{validCount}</strong> will be imported</span>
                    </div>
                    {duplicateCount > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertCircle size={16} style={{ color: 'var(--warning)' }} />
                        <span style={{ fontSize: 13 }}><strong>{duplicateCount}</strong> duplicates (skipped)</span>
                      </div>
                    )}
                    {errorCount > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <XCircle size={16} style={{ color: 'var(--danger)' }} />
                        <span style={{ fontSize: 13 }}><strong>{errorCount}</strong> rows have errors</span>
                      </div>
                    )}
                  </div>

                  {/* Assignment */}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label form-label-required">Assign to stage</label>
                      <select className="form-input" value={stageId} onChange={(e) => setStageId(e.target.value)}>
                        {stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Assign to agent</label>
                      {isAgent ? (
                        <div
                          className="form-input"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'var(--surface-hover)',
                            color: 'var(--text-primary)',
                            fontWeight: 500,
                          }}
                        >
                          {agents.find((a) => a.id === currentUserId)?.name || 'Assigned to you (Sales Agent)'}
                        </div>
                      ) : (
                        <select className="form-input" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                          <option value="">Unassigned</option>
                          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Preview table */}
                  <div className="table-wrapper" style={{ maxHeight: '60vh', overflowY: 'auto', width: '100%' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th style={{ width: 60 }}>Row</th>
                          <th>Name</th>
                          <th>Phone</th>
                          <th>Email</th>
                          <th style={{ minWidth: 150 }}>Target Stage</th>
                          <th style={{ minWidth: 170 }}>Assign Agent</th>
                          <th style={{ width: 110 }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.slice(0, 50).map((row) => (
                          <tr key={row.rowIndex}>
                            <td style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{row.rowIndex}</td>
                            <td style={{ fontWeight: 500 }}>{row.name || '—'}</td>
                            <td style={{ fontSize: 13 }}>{row.phone || '—'}</td>
                            <td style={{ fontSize: 13 }}>{row.email || '—'}</td>
                            <td>
                              <select
                                className="form-input"
                                style={{ padding: '4px 8px', height: 32, fontSize: 12, width: '100%' }}
                                value={row.stage_id || stageId}
                                onChange={(e) => updateRowStage(row.rowIndex, e.target.value)}
                              >
                                {stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                              </select>
                            </td>
                            <td>
                              <select
                                className="form-input"
                                style={{ padding: '4px 8px', height: 32, fontSize: 12, width: '100%' }}
                                value={row.assigned_agent_id !== undefined ? row.assigned_agent_id : agentId}
                                onChange={(e) => updateRowAgent(row.rowIndex, e.target.value)}
                              >
                                <option value="">Unassigned</option>
                                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                              </select>
                            </td>
                            <td>
                              {row.status === 'valid' && <span className="badge badge-success">Valid</span>}
                              {row.status === 'duplicate' && <span className="badge badge-warning" title={row.error}>{row.error || 'Duplicate'}</span>}
                              {row.status === 'error' && <span className="badge badge-danger" title={row.error}>Error</span>}
                            </td>
                          </tr>
                        ))}
                        {parsedRows.length > 50 && (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12, padding: '8px 16px' }}>
                              +{parsedRows.length - 50} more rows not shown
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="card-footer" style={{ justifyContent: 'flex-end', display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline" onClick={() => { setStep('upload'); setParsedRows([]) }}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleImport}
                    disabled={validCount === 0 || importing}
                  >
                    {importing ? 'Importing...' : `Import ${validCount} lead${validCount !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Step: Done */}
          {step === 'done' && importResult && (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '40px 24px' }}>
                <CheckCircle size={40} style={{ color: 'var(--success)', margin: '0 auto 16px' }} />
                <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Import complete</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  {importResult.successCount} leads imported ·{' '}
                  {importResult.duplicateCount} duplicates skipped ·{' '}
                  {importResult.errorCount} errors
                </div>
                <div className="flex gap-2" style={{ justifyContent: 'center' }}>
                  <button className="btn btn-outline" onClick={() => { setStep('upload'); setParsedRows([]) }}>
                    Import another file
                  </button>
                  <a href="/leads" className="btn btn-primary">View leads</a>
                </div>
              </div>
            </div>
          )}

          {/* Past imports */}
          {initialBatches.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="text-section-header">Recent imports</span>
              </div>
              <div className="table-wrapper" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th className="num">Total</th>
                      <th className="num">Imported</th>
                      <th className="num">Duplicates</th>
                      <th className="num">Errors</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialBatches.map((b: any) => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 500, fontSize: 13 }}>{b.file_name}</td>
                        <td className="num tabular-nums">{b.total_rows ?? '—'}</td>
                        <td className="num tabular-nums" style={{ color: 'var(--success)' }}>{b.success_count ?? '—'}</td>
                        <td className="num tabular-nums" style={{ color: 'var(--warning)' }}>{b.duplicate_count ?? '—'}</td>
                        <td className="num tabular-nums" style={{ color: 'var(--danger)' }}>{b.error_count ?? '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {format(new Date(b.created_at), 'dd MMM yyyy, HH:mm')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
