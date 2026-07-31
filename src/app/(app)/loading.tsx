import { Loader2 } from 'lucide-react'

export default function AppLoading() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        width: '100%',
        gap: 16,
      }}
    >
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          className="sidebar-logo-icon"
          style={{
            width: 44,
            height: 44,
            fontSize: 18,
            fontWeight: 700,
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
          }}
        >
          A
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}>
        <Loader2 size={20} className="spin" style={{ color: 'var(--accent)', animation: 'spin 0.75s linear infinite' }} />
        <span>Loading...</span>
      </div>
    </div>
  )
}
