'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, Check, Building2, User, ChevronDown } from 'lucide-react'

interface ClientOption {
  id: string
  name: string
  company?: string | null
  email?: string | null
  phone?: string | null
  cr_number?: string | null
  vat_number?: string | null
  address?: string | null
}

interface Props {
  clients: ClientOption[]
  selectedId: string
  onSelect: (client: ClientOption | null) => void
}

export default function ClientSearchSelect({ clients, selectedId, onSelect }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedClient = clients.find((c) => c.id === selectedId)

  // Filter clients based on search query
  const filtered = clients.filter((c) => {
    const q = query.toLowerCase().trim()
    if (!q) return true
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    )
  })

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(client: ClientOption) {
    onSelect(client)
    setIsOpen(false)
    setQuery('')
  }

  function handleClear() {
    onSelect(null)
    setQuery('')
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
      {selectedClient ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            background: 'var(--accent-light)',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12.5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
            <Check size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {selectedClient.name} {selectedClient.company ? `(${selectedClient.company})` : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClear}
            title="Clear selected client"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
            }}
          />
          <input
            type="text"
            className="form-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (!isOpen) setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search client by name or company..."
            style={{
              paddingLeft: 30,
              paddingRight: 28,
              fontSize: 12.5,
              height: 34,
              cursor: 'text',
            }}
          />
          <ChevronDown
            size={14}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              pointerEvents: 'none',
            }}
          />
        </div>
      )}

      {/* Dropdown Results */}
      {isOpen && !selectedClient && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 200,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
              No clients matching &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((client) => (
              <div
                key={client.id}
                onClick={() => handleSelect(client)}
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  transition: 'background 100ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {client.name}
                  </span>
                  {client.phone && (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{client.phone}</span>
                  )}
                </div>
                {client.company && (
                  <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    {client.company}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

