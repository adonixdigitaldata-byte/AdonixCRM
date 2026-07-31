'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, Check, X } from 'lucide-react'

export interface ClientItem {
  id: string
  name: string
  company?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
}

interface ClientSearchSelectProps {
  clients: ClientItem[]
  selectedClientId: string
  onSelectClient: (client: ClientItem) => void
  placeholder?: string
}

export default function ClientSearchSelect({
  clients,
  selectedClientId,
  onSelectClient,
  placeholder = 'Search & select a client...',
}: ClientSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Find currently selected client object
  const selectedClient = clients.find((c) => c.id === selectedClientId)

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter clients based on search query
  const filteredClients = clients.filter((c) => {
    const q = searchTerm.toLowerCase().trim()
    if (!q) return true
    const nameMatch = (c.name ?? '').toLowerCase().includes(q)
    const companyMatch = (c.company ?? '').toLowerCase().includes(q)
    const emailMatch = (c.email ?? '').toLowerCase().includes(q)
    const phoneMatch = (c.phone ?? '').toLowerCase().includes(q)
    return nameMatch || companyMatch || emailMatch || phoneMatch
  })

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger Button / Input */}
      <div
        className="form-input"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          padding: '8px 12px',
          minHeight: 40,
          background: 'var(--surface)',
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{ fontSize: 14, color: selectedClient ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: selectedClient ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedClient
            ? `${selectedClient.name}${selectedClient.company ? ` (${selectedClient.company})` : ''}`
            : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {selectedClient && (
            <button
              type="button"
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
              onClick={(e) => {
                e.stopPropagation()
                onSelectClient({ id: '', name: '' })
              }}
              title="Clear selection"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown size={16} style={{ color: 'var(--text-tertiary)', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
        </div>
      </div>

      {/* Floating Searchable Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 999,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
          }}
        >
          {/* Search Box inside dropdown */}
          <div style={{ padding: '8px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Type name, company or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                style={{ paddingLeft: 32, fontSize: 13, minHeight: 34 }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Options List */}
          <div style={{ maxHeight: 240, overflowY: 'auto', padding: '4px 0' }}>
            {filteredClients.length === 0 ? (
              <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                No matching clients found
              </div>
            ) : (
              <>
                {filteredClients.slice(0, 30).map((c) => {
                  const isSelected = c.id === selectedClientId
                  return (
                    <div
                      key={c.id}
                      style={{
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        fontSize: 13,
                        background: isSelected ? 'var(--bg)' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                      className="dropdown-item-hover"
                      onClick={() => {
                        onSelectClient(c)
                        setIsOpen(false)
                        setSearchTerm('')
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {c.name}
                          {c.company && (
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 6 }}>
                              ({c.company})
                            </span>
                          )}
                        </div>
                        {c.email && (
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                            {c.email}
                          </div>
                        )}
                      </div>
                      {isSelected && <Check size={14} style={{ color: 'var(--accent)' }} />}
                    </div>
                  )
                })}
                {filteredClients.length > 30 && (
                  <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                    Showing top 30 of {filteredClients.length} clients. Type to refine...
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
