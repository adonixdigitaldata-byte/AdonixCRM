import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import ActivityTracker from '@/components/layout/ActivityTracker'
import type { Profile } from '@/types/database'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (profile.is_active === false) {
    await supabase.auth.signOut()
    redirect('/login?error=deactivated')
  }

  return (
    <div className="app-shell">
      <ActivityTracker userId={profile.id} />
      <Suspense fallback={<div style={{ width: 'var(--sidebar-width)' }} />}>
        <Sidebar profile={profile as Profile} />
      </Suspense>
      <main className="main-content">{children}</main>
    </div>
  )
}
