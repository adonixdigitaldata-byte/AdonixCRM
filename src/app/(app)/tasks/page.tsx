import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TasksClient from './TasksClient'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  const supabase = await createClient()

  // 1. Get current user profile
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  if (currentProfile?.role === 'CLIENT') redirect('/portal')

  // 2. Fetch tasks with joins
  const { data: rawTasks } = await supabase
    .from('client_tasks')
    .select(`
      *,
      client:clients(id, name, company, email, phone),
      assigned_employee:profiles!assigned_employee_id(id, name, email, role, specialization, avatar_url, work_status),
      creator:profiles!created_by(id, name),
      updates:client_task_updates(
        id, task_id, author_id, update_type, status_from, status_to, body, attachment_url, created_at,
        author:profiles(id, name, avatar_url)
      )
    `)
    .order('created_at', { ascending: false })

  // 3. Fetch clients list for quick selection
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, company')
    .order('name', { ascending: true })

  // 4. Fetch all team members for assignment
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  return (
    <TasksClient
      initialTasks={rawTasks ?? []}
      clients={clients ?? []}
      profiles={profiles ?? []}
      currentProfile={currentProfile}
    />
  )
}
