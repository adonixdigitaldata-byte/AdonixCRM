-- ============================================================
-- Adonix CRM — Full Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ============================================================

-- ============================================================
-- 1. PROFILES (extends auth.users)
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('ADMIN','ACCOUNT_MANAGER','AGENT','EMPLOYEE')),
  specialization text,
  work_status text not null default 'AVAILABLE' check (work_status in ('AVAILABLE','BUSY','ON_LEAVE')),
  is_active boolean not null default true,
  avatar_url text,
  -- Auto-assign tracking
  total_leads_assigned int not null default 0,
  open_leads_count int not null default 0,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. AD SOURCE TRACKING
-- ============================================================
create table if not exists ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  meta_campaign_id text unique,
  name text not null,
  objective text,
  status text,
  spend numeric(12,2),
  impressions bigint,
  clicks bigint,
  synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists ad_sets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references ad_campaigns(id) on delete cascade,
  meta_adset_id text unique,
  name text not null,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists ads (
  id uuid primary key default gen_random_uuid(),
  ad_set_id uuid references ad_sets(id) on delete cascade,
  meta_ad_id text unique,
  name text not null,
  creative_thumbnail_url text,
  status text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3. FUNNEL STAGES
-- ============================================================
create table if not exists lead_stages (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  sort_order int not null,
  color_hex text not null default '#71717A'
);

-- Default stages
insert into lead_stages (key, label, sort_order, color_hex) values
  ('new',          'New',          1, '#0284C7'),
  ('contacted',    'Contacted',    2, '#D97706'),
  ('no_reply',     'No Reply',     3, '#64748B'),
  ('followup',     'Follow-up',    4, '#0F766E'),
  ('qualified',    'Qualified',    5, '#7C3AED'),
  ('proposal',     'Proposal',     6, '#DB2777'),
  ('negotiation',  'Negotiation',  7, '#EA580C'),
  ('won',          'Won',          8, '#16A34A'),
  ('lost',         'Lost',         9, '#DC2626'),
  ('junk_leads',   'Junk Leads',   10, '#71717A')
on conflict (key) do nothing;

-- ============================================================
-- 4. IMPORT BATCHES
-- ============================================================
create table if not exists import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  uploaded_by uuid references profiles(id) on delete set null,
  total_rows int,
  success_count int,
  error_count int,
  duplicate_count int,
  error_log jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 5. LEADS (core table)
-- ============================================================
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('META_ADS','TIKTOK','SNAPCHAT','WHATSAPP','MANUAL','XLSX_IMPORT','COLD_OUTREACH')),

  -- Ad attribution (nullable — only for META_ADS)
  campaign_id uuid references ad_campaigns(id),
  ad_set_id uuid references ad_sets(id),
  ad_id uuid references ads(id),

  -- Normalized contact fields
  name text,
  phone text,
  email text,
  city text,
  interest text,
  potential_value numeric(12,2) default 0.00,

  -- Full original form submission
  form_data jsonb not null default '{}',

  -- Full raw webhook payload (audit/debug)
  raw_payload jsonb,

  stage_id uuid references lead_stages(id) not null,
  assigned_agent_id uuid references profiles(id) on delete set null,

  lead_score int default 0,
  is_duplicate boolean default false,
  duplicate_of uuid references leads(id),

  import_batch_id uuid references import_batches(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leads_campaign on leads(campaign_id);
create index if not exists idx_leads_adset on leads(ad_set_id);
create index if not exists idx_leads_ad on leads(ad_id);
create index if not exists idx_leads_stage on leads(stage_id);
create index if not exists idx_leads_agent on leads(assigned_agent_id);
create index if not exists idx_leads_phone on leads(phone);
create index if not exists idx_leads_email on leads(email);
create index if not exists idx_leads_created on leads(created_at desc);

-- ============================================================
-- 6. STAGE HISTORY
-- ============================================================
create table if not exists lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  from_stage_id uuid references lead_stages(id),
  to_stage_id uuid references lead_stages(id) not null,
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_stage_history_lead on lead_stage_history(lead_id);

-- ============================================================
-- 7. NOTES, FOLLOW-UPS, ACTIVITY TIMELINE
-- ============================================================
create table if not exists lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_notes_lead on lead_notes(lead_id);

create table if not exists lead_followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  agent_id uuid references profiles(id) on delete set null,
  scheduled_at timestamptz not null,
  note text,
  is_completed boolean not null default false,
  reminder_sent boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table lead_followups add column if not exists reminder_sent boolean not null default false;

create index if not exists idx_followups_lead on lead_followups(lead_id);
create index if not exists idx_followups_agent on lead_followups(agent_id);
create index if not exists idx_followups_scheduled on lead_followups(scheduled_at);


create table if not exists lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  activity_type text not null,
  -- Types: LEAD_CREATED, STAGE_CHANGE, NOTE_ADDED, FOLLOWUP_SCHEDULED,
  --        FOLLOWUP_COMPLETED, QUOTE_SENT, INVOICE_SENT, ASSIGNED, PAYMENT_RECORDED
  performed_by uuid references profiles(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activities_lead on lead_activities(lead_id);

-- ============================================================
-- 8. CLIENTS
-- ============================================================
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  name text not null,
  company text,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 9. QUOTATIONS & LINE ITEMS
-- ============================================================
create table if not exists quotations (
  id uuid primary key default gen_random_uuid(),
  quote_number text unique not null,
  client_id uuid references clients(id) not null,
  lead_id uuid references leads(id),
  status text not null default 'DRAFT' check (status in ('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED')),
  currency text not null default 'SAR',
  issue_date date not null default current_date,
  valid_until date,
  subtotal numeric(12,2) not null default 0,
  discount_type text default 'PERCENTAGE' check (discount_type in ('PERCENTAGE', 'FIXED')),
  discount_value numeric(12,2) default 0,
  discount_amount numeric(12,2) default 0,
  tax_percent numeric(5,2) not null default 15.00,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  terms text,
  notes text,
  pdf_url text,
  created_by uuid references profiles(id) on delete set null,
  office_location text default 'KSA',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table quotations add column if not exists discount_type text default 'PERCENTAGE' check (discount_type in ('PERCENTAGE', 'FIXED'));
alter table quotations add column if not exists discount_value numeric(12,2) default 0;
alter table quotations add column if not exists discount_amount numeric(12,2) default 0;

create table if not exists quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid references quotations(id) on delete cascade,
  description text not null,
  qty numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  discount_percent numeric(5,2) default 0,
  amount numeric(12,2) not null default 0,
  sort_order int not null default 0
);

alter table quotation_items add column if not exists discount_percent numeric(5,2) default 0;

-- ============================================================
-- 10. INVOICES & LINE ITEMS
-- ============================================================
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null,
  quotation_id uuid references quotations(id),
  client_id uuid references clients(id) not null,
  lead_id uuid references leads(id),
  status text not null default 'DRAFT' check (status in ('DRAFT','SENT','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED')),
  currency text not null default 'SAR',
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(12,2) not null default 0,
  discount_type text default 'PERCENTAGE' check (discount_type in ('PERCENTAGE', 'FIXED')),
  discount_value numeric(12,2) default 0,
  discount_amount numeric(12,2) default 0,
  tax_percent numeric(5,2) not null default 15.00,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  terms text,
  notes text,
  pdf_url text,
  created_by uuid references profiles(id) on delete set null,
  office_location text default 'KSA',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table invoices add column if not exists discount_type text default 'PERCENTAGE' check (discount_type in ('PERCENTAGE', 'FIXED'));
alter table invoices add column if not exists discount_value numeric(12,2) default 0;
alter table invoices add column if not exists discount_amount numeric(12,2) default 0;

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade,
  description text not null,
  qty numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  discount_percent numeric(5,2) default 0,
  amount numeric(12,2) not null default 0,
  sort_order int not null default 0
);

alter table invoice_items add column if not exists discount_percent numeric(5,2) default 0;

-- ============================================================
-- 11. PAYMENTS
-- ============================================================
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade,
  amount numeric(12,2) not null,
  method text check (method in ('CASH','BANK_TRANSFER','CARD','CHEQUE','OTHER')),
  paid_at date not null default current_date,
  reference_note text,
  recorded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 12. FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_updated_at before update on leads
  for each row execute function update_updated_at();

create trigger quotations_updated_at before update on quotations
  for each row execute function update_updated_at();

create trigger invoices_updated_at before update on invoices
  for each row execute function update_updated_at();

create trigger profiles_updated_at before update on profiles
  for each row execute function update_updated_at();

-- Auto-create profile on new auth user
create or replace function handle_new_user()
returns trigger as $$
declare
  v_name text;
  v_role text;
begin
  v_name := split_part(new.email, '@', 1);
  v_role := 'AGENT';
  
  if new.raw_user_meta_data is not null then
    if new.raw_user_meta_data->>'name' is not null then
      v_name := new.raw_user_meta_data->>'name';
    end if;
    if new.raw_user_meta_data->>'role' is not null then
      v_role := new.raw_user_meta_data->>'role';
    end if;
  end if;

  insert into profiles (id, name, email, role)
  values (
    new.id,
    v_name,
    coalesce(new.email, ''),
    v_role
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Auto-update invoice status after payment
create or replace function update_invoice_after_payment()
returns trigger as $$
declare
  v_total numeric;
  v_paid numeric;
begin
  select total, coalesce(sum(p.amount), 0)
  into v_total, v_paid
  from invoices i
  left join payments p on p.invoice_id = i.id
  where i.id = new.invoice_id
  group by i.total;

  update invoices set
    amount_paid = v_paid,
    status = case
      when v_paid >= v_total then 'PAID'
      when v_paid > 0 then 'PARTIALLY_PAID'
      else status
    end
  where id = new.invoice_id;

  return new;
end;
$$ language plpgsql;

create trigger payment_inserted after insert on payments
  for each row execute function update_invoice_after_payment();

-- Generate sequential quote/invoice numbers
create sequence if not exists quote_number_seq start 1001;
create sequence if not exists invoice_number_seq start 1001;

-- ============================================================
-- 13. ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table leads enable row level security;
alter table lead_stages enable row level security;
alter table lead_notes enable row level security;
alter table lead_followups enable row level security;
alter table lead_activities enable row level security;
alter table lead_stage_history enable row level security;
alter table ad_campaigns enable row level security;
alter table ad_sets enable row level security;
alter table ads enable row level security;
alter table import_batches enable row level security;
alter table clients enable row level security;
alter table quotations enable row level security;
alter table quotation_items enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table payments enable row level security;

-- Helper: is current user admin?
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'ADMIN'
  );
$$ language sql stable security definer;

-- Helper: is current user admin or account manager?
create or replace function is_admin_or_manager()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('ADMIN', 'ACCOUNT_MANAGER')
  );
$$ language sql stable security definer;

-- PROFILES
create policy "Authenticated users can view profiles" on profiles
  for select using (auth.uid() is not null);
create policy "Users can update their own profile" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "Admins can manage profiles" on profiles
  for all using (is_admin());

-- LEAD STAGES (readable by all authenticated)
create policy "All authenticated can read stages" on lead_stages
  for select using (auth.uid() is not null);
create policy "Admins can manage stages" on lead_stages
  for all using (is_admin());

-- LEADS
create policy "Admins full access leads" on leads
  for all using (is_admin());
create policy "Agents view assigned leads" on leads
  for select using (assigned_agent_id = auth.uid());
create policy "Agents update assigned leads" on leads
  for update using (assigned_agent_id = auth.uid());

-- LEAD NOTES
create policy "Admins full access notes" on lead_notes
  for all using (is_admin());
create policy "Agents manage notes on their leads" on lead_notes
  for all using (
    exists (select 1 from leads where id = lead_id and assigned_agent_id = auth.uid())
  );

-- LEAD FOLLOWUPS
create policy "Admins full access followups" on lead_followups
  for all using (is_admin());
create policy "Agents manage followups on their leads" on lead_followups
  for all using (
    exists (select 1 from leads where id = lead_id and assigned_agent_id = auth.uid())
  );

-- LEAD ACTIVITIES
create policy "Admins full access activities" on lead_activities
  for all using (is_admin());
create policy "Agents view activities on their leads" on lead_activities
  for select using (
    exists (select 1 from leads where id = lead_id and assigned_agent_id = auth.uid())
  );
create policy "Agents insert activities on their leads" on lead_activities
  for insert with check (
    exists (select 1 from leads where id = lead_id and assigned_agent_id = auth.uid())
  );

-- STAGE HISTORY
create policy "Admins full access stage history" on lead_stage_history
  for all using (is_admin());
create policy "Agents view stage history on their leads" on lead_stage_history
  for select using (
    exists (select 1 from leads where id = lead_id and assigned_agent_id = auth.uid())
  );

-- AD SOURCE (Admin-only write, all authenticated read)
create policy "All authenticated read campaigns" on ad_campaigns for select using (auth.uid() is not null);
create policy "Admins manage campaigns" on ad_campaigns for all using (is_admin());
create policy "All authenticated read adsets" on ad_sets for select using (auth.uid() is not null);
create policy "Admins manage adsets" on ad_sets for all using (is_admin());
create policy "All authenticated read ads" on ads for select using (auth.uid() is not null);
create policy "Admins manage ads" on ads for all using (is_admin());

-- IMPORT BATCHES
create policy "Admins manage import batches" on import_batches for all using (is_admin());
create policy "Agents view their import batches" on import_batches
  for select using (uploaded_by = auth.uid());

-- CLIENTS
create policy "Admins full access clients" on clients for all using (is_admin());
create policy "Agents view clients" on clients for select using (auth.uid() is not null);
create policy "Admins and managers delete clients" on clients for delete using (is_admin_or_manager());

-- QUOTATIONS & ITEMS
create policy "Admins full access quotations" on quotations for all using (is_admin());
create policy "Agents write quotations" on quotations for insert with check (auth.uid() is not null);
create policy "Agents update quotations" on quotations for update using (auth.uid() is not null);
create policy "Agents read quotations" on quotations for select using (auth.uid() is not null);
create policy "Agents delete quotations" on quotations for delete using (auth.uid() is not null);

create policy "Admins full access quotation_items" on quotation_items for all using (is_admin());
create policy "Agents write quotation_items" on quotation_items for insert with check (auth.uid() is not null);
create policy "Agents update quotation_items" on quotation_items for update using (auth.uid() is not null);
create policy "Agents read quotation_items" on quotation_items for select using (auth.uid() is not null);
create policy "Agents delete quotation_items" on quotation_items for delete using (auth.uid() is not null);

-- INVOICES & ITEMS
create policy "Admins full access invoices" on invoices for all using (is_admin());
create policy "Agents write invoices" on invoices for insert with check (auth.uid() is not null);
create policy "Agents update invoices" on invoices for update using (auth.uid() is not null);
create policy "Agents read invoices" on invoices for select using (auth.uid() is not null);
create policy "Agents delete invoices" on invoices for delete using (auth.uid() is not null);

create policy "Admins full access invoice_items" on invoice_items for all using (is_admin());
create policy "Agents write invoice_items" on invoice_items for insert with check (auth.uid() is not null);
create policy "Agents update invoice_items" on invoice_items for update using (auth.uid() is not null);
create policy "Agents read invoice_items" on invoice_items for select using (auth.uid() is not null);
create policy "Agents delete invoice_items" on invoice_items for delete using (auth.uid() is not null);

-- PAYMENTS
create policy "Admins full access payments" on payments for all using (is_admin());
create policy "Agents view payments" on payments for select using (auth.uid() is not null);

-- ============================================================
-- 14. HELPER RPC FUNCTIONS
-- ============================================================

-- Increment agent's open lead count (called from webhook)
create or replace function increment_agent_leads(agent_id uuid)
returns void as $$
begin
  update profiles
  set
    open_leads_count = open_leads_count + 1,
    total_leads_assigned = total_leads_assigned + 1
  where id = agent_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- 15. CLIENTS RETENTION & ATTRIBUTION EXTENSIONS
-- ============================================================
alter table clients add column if not exists assigned_agent_id uuid references profiles(id) on delete set null;
alter table clients add column if not exists client_status text not null default 'ACTIVE';
alter table clients add column if not exists industry text;
alter table clients add column if not exists billing_cycle text not null default 'MONTHLY';
alter table clients add column if not exists billing_amount numeric(12,2) not null default 0;
alter table clients add column if not exists contract_start_date date;
alter table clients add column if not exists contract_end_date date;
alter table clients add column if not exists website_url text;
alter table clients add column if not exists report_link text;
alter table clients add column if not exists gmb_url text;
alter table clients add column if not exists brand_assets_link text;
alter table clients add column if not exists facebook_url text;
alter table clients add column if not exists instagram_url text;
alter table clients add column if not exists tiktok_url text;
alter table clients add column if not exists credentials jsonb not null default '[]'::jsonb;
alter table clients add column if not exists service_links jsonb not null default '[]'::jsonb;
alter table clients add column if not exists secondary_contacts jsonb not null default '[]'::jsonb;
alter table clients add column if not exists notes text;

-- ============================================================
-- 16. CLIENT TASKS & TECHNICAL DELIVERABLES
-- ============================================================
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('ADMIN','ACCOUNT_MANAGER','AGENT','EMPLOYEE','CLIENT'));
alter table profiles add column if not exists client_id uuid references clients(id) on delete set null;
alter table clients add column if not exists profile_id uuid references profiles(id) on delete set null;
alter table profiles add column if not exists specialization text;
alter table profiles add column if not exists work_status text not null default 'AVAILABLE';

create table if not exists client_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  assigned_employee_id uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  title text not null,
  description text,
  category text not null default 'OTHER' check (category in ('WEBSITE','SOCIAL_MEDIA','ADS','GMB','VIDEO_AI','DESIGN','SEO','SALES_TASK','FINANCE_TASK','OTHER')),
  status text not null default 'PENDING' check (status in ('PENDING','IN_PROGRESS','UNDER_REVIEW','COMPLETED','BLOCKED')),
  priority text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH','URGENT')),
  due_date date,
  deliverable_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_tasks_client on client_tasks(client_id);
create index if not exists idx_client_tasks_assigned on client_tasks(assigned_employee_id);
create index if not exists idx_client_tasks_status on client_tasks(status);
create index if not exists idx_client_tasks_due on client_tasks(due_date);

create table if not exists client_task_updates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references client_tasks(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete set null,
  update_type text not null default 'PROGRESS_NOTE' check (update_type in ('PROGRESS_NOTE','STATUS_CHANGE','LINK_ADDED','BLOCKER')),
  status_from text,
  status_to text,
  body text not null,
  attachment_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_updates_task on client_task_updates(task_id);

create trigger client_tasks_updated_at before update on client_tasks
  for each row execute function update_updated_at();

-- RLS Policies for Tasks
alter table client_tasks enable row level security;
alter table client_task_updates enable row level security;

create policy "All authenticated read client_tasks" on client_tasks for select using (auth.uid() is not null);
create policy "Admins and Account Managers full access client_tasks" on client_tasks for all using (
  is_admin() or exists (select 1 from profiles where id = auth.uid() and role in ('ADMIN', 'ACCOUNT_MANAGER'))
);
create policy "Assigned user update client_tasks" on client_tasks for update using (
  assigned_employee_id = auth.uid()
);

create policy "All authenticated read task updates" on client_task_updates for select using (auth.uid() is not null);
create policy "Authenticated insert task updates" on client_task_updates for insert with check (auth.uid() is not null);
create policy "Authors manage task updates" on client_task_updates for update using (
  author_id = auth.uid() or is_admin() or exists (select 1 from profiles where id = auth.uid() and role in ('ADMIN', 'ACCOUNT_MANAGER'))
);
create policy "Authors manage delete task updates" on client_task_updates for delete using (
  author_id = auth.uid() or is_admin() or exists (select 1 from profiles where id = auth.uid() and role in ('ADMIN', 'ACCOUNT_MANAGER'))
);

-- Allow authenticated users to view, insert, and update client records
drop policy if exists "Agents view clients" on clients;
drop policy if exists "Authenticated view clients" on clients;
drop policy if exists "Assigned employee update clients" on clients;
drop policy if exists "Authenticated insert clients" on clients;
drop policy if exists "Authenticated update clients" on clients;

create policy "Authenticated view clients" on clients for select using (auth.uid() is not null);
create policy "Authenticated insert clients" on clients for insert with check (auth.uid() is not null);
-- ============================================================
-- PAYROLL & PAYSLIP SYSTEM
-- ============================================================

create table if not exists employee_salary_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade unique not null,
  currency text not null default 'INR' check (currency in ('INR', 'SAR', 'USD')),
  base_salary numeric(12, 2) not null default 0,
  joining_date date not null default current_date,
  designation text,
  department text default 'Operations',
  employee_code text,
  bank_name text,
  account_number text,
  ifsc_or_iban text,
  pan_or_iqama text,
  default_allowances jsonb default '[]'::jsonb,
  default_deductions jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_salary_profiles_profile on employee_salary_profiles(profile_id);

create trigger salary_profiles_updated_at before update on employee_salary_profiles
  for each row execute function update_updated_at();

alter table employee_salary_profiles enable row level security;

create policy "Admins manage all salary profiles" on employee_salary_profiles for all using (
  is_admin() or exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
);

create policy "Users view own salary profile" on employee_salary_profiles for select using (
  profile_id = auth.uid()
);

create table if not exists payslips (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references profiles(id) on delete cascade not null,
  month int not null check (month between 1 and 12),
  year int not null check (year between 2000 and 2100),
  financial_year text not null, -- e.g. "2026-2027" or "2025-2026"
  currency text not null default 'INR' check (currency in ('INR', 'SAR', 'USD')),
  base_salary numeric(12, 2) not null default 0,
  earnings_breakdown jsonb not null default '[]'::jsonb,
  deductions_breakdown jsonb not null default '[]'::jsonb,
  gross_earnings numeric(12, 2) not null default 0,
  total_deductions numeric(12, 2) not null default 0,
  net_pay numeric(12, 2) not null default 0,
  net_pay_in_words text,
  working_days int not null default 30,
  paid_days int not null default 30,
  lop_days int not null default 0,
  status text not null default 'PAID' check (status in ('DRAFT', 'PUBLISHED', 'PAID')),
  payment_date date,
  period_start_date date,
  period_end_date date,
  payment_method text not null default 'BANK_TRANSFER' check (payment_method in ('BANK_TRANSFER', 'CHEQUE', 'CASH', 'UPI', 'WIRE')),
  designation text,
  department text,
  employee_code text,
  bank_name text,
  account_number text,
  ifsc_or_iban text,
  pan_or_iqama text,
  joining_date date,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, month, year)
);

create index if not exists idx_payslips_employee on payslips(employee_id);
create index if not exists idx_payslips_period on payslips(year, month);
create index if not exists idx_payslips_fy on payslips(financial_year);
create index if not exists idx_payslips_status on payslips(status);

create trigger payslips_updated_at before update on payslips
  for each row execute function update_updated_at();

alter table payslips enable row level security;

create policy "Admins manage all payslips" on payslips for all using (
  is_admin() or exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
);

create policy "Users view own published payslips" on payslips for select using (
  employee_id = auth.uid() and status in ('PUBLISHED', 'PAID')
);


-- Create employee_salary_history table to track custom salary intervals
create table if not exists employee_salary_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade not null,
  base_salary numeric(12, 2) not null default 0,
  currency text not null default 'INR' check (currency in ('INR', 'SAR', 'USD')),
  start_date date not null,
  end_date date, -- Null means active until updated/future
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add indexes for efficient search during generation/lookup
create index if not exists idx_salary_history_profile on employee_salary_history(profile_id);
create index if not exists idx_salary_history_dates on employee_salary_history(start_date, end_date);

-- Enable Row Level Security (RLS)
alter table employee_salary_history enable row level security;

-- Create RLS Policies for management and view operations
drop policy if exists "Admins manage all salary histories" on employee_salary_history;
create policy "Admins manage all salary histories" on employee_salary_history 
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
  );

drop policy if exists "Users view own salary history" on employee_salary_history;
create policy "Users view own salary history" on employee_salary_history 
  for select using (
    profile_id = auth.uid()
  );

-- Add individual user security PIN for Payroll Vault
alter table profiles add column if not exists payroll_pin text default '1234';
