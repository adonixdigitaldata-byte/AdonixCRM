import { Loader2 } from 'lucide-react'

export default function RootLoading() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100vw',
        background: 'var(--bg)',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          className="sidebar-logo-icon"
          style={{
            width: 44,
            height: 44,
            fontSize: 20,
            fontWeight: 700,
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
          }}
        >
          A
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Adonix CRM</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Loading platform...</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>
        <Loader2 size={22} className="spin" style={{ color: 'var(--accent)', animation: 'spin 0.75s linear infinite' }} />
      </div>
    </div>
  )
}
