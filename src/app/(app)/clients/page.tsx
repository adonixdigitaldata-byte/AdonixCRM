import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { format } from 'date-fns'

export const metadata: Metadata = { title: 'Clients' }

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-page-title">Clients</h1>
          <p className="text-meta" style={{ marginTop: 2 }}>{clients?.length ?? 0} clients</p>
        </div>
      </div>
      <div className="page-body">
        {!clients || clients.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-title">No clients yet</div>
              <div className="empty-state-desc">Clients are created when you create a quotation</div>
            </div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c: any) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.company ?? '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{c.email ?? '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.phone ?? '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                      {format(new Date(c.created_at), 'dd MMM yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
