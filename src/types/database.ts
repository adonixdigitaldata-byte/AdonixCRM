export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'ADMIN' | 'ACCOUNT_MANAGER' | 'AGENT' | 'EMPLOYEE' | 'CLIENT'
export type EmployeeSpecialization = 'WEBSITE' | 'SOCIAL_MEDIA' | 'ADS' | 'GMB' | 'VIDEO_AI' | 'DESIGN' | 'SEO' | 'OTHER'
export type WorkStatus = 'AVAILABLE' | 'BUSY' | 'ON_LEAVE'
export type TaskCategory = 'WEBSITE' | 'SOCIAL_MEDIA' | 'ADS' | 'GMB' | 'VIDEO_AI' | 'DESIGN' | 'SEO' | 'SALES_TASK' | 'FINANCE_TASK' | 'OTHER'
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'COMPLETED' | 'BLOCKED'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type TaskUpdateType = 'PROGRESS_NOTE' | 'STATUS_CHANGE' | 'LINK_ADDED' | 'BLOCKER'

export type LeadSource = 'META_ADS' | 'TIKTOK' | 'SNAPCHAT' | 'WHATSAPP' | 'MANUAL' | 'XLSX_IMPORT'
export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'CHEQUE' | 'UPI' | 'WIRE' | 'OTHER'
export type ActivityType =
  | 'LEAD_CREATED'
  | 'STAGE_CHANGE'
  | 'NOTE_ADDED'
  | 'NOTE_DELETED'
  | 'FOLLOWUP_SCHEDULED'
  | 'FOLLOWUP_COMPLETED'
  | 'FOLLOWUP_UPDATED'
  | 'FOLLOWUP_DELETED'
  | 'QUOTE_SENT'
  | 'INVOICE_SENT'
  | 'ASSIGNED'
  | 'PAYMENT_RECORDED'

export interface Profile {
  id: string
  name: string
  email: string
  role: UserRole
  client_id?: string | null
  specialization?: string | null
  work_status?: WorkStatus
  is_active: boolean
  avatar_url: string | null
  total_leads_assigned: number
  open_leads_count: number
  payroll_pin?: string | null
  last_seen_at: string
  created_at: string
  updated_at: string
}

export interface AdCampaign {
  id: string
  meta_campaign_id: string | null
  name: string
  objective: string | null
  status: string | null
  spend: number | null
  impressions: number | null
  clicks: number | null
  synced_at: string | null
  created_at: string
}

export interface AdSet {
  id: string
  campaign_id: string
  meta_adset_id: string | null
  name: string
  status: string | null
  created_at: string
}

export interface Ad {
  id: string
  ad_set_id: string
  meta_ad_id: string | null
  name: string
  creative_thumbnail_url: string | null
  status: string | null
  created_at: string
}

export interface LeadStage {
  id: string
  key: string
  label: string
  sort_order: number
  color_hex: string
}

export interface Lead {
  id: string
  source: LeadSource
  campaign_id: string | null
  ad_set_id: string | null
  ad_id: string | null
  name: string | null
  phone: string | null
  email: string | null
  city: string | null
  interest: string | null
  potential_value?: number | null
  form_data: Record<string, string>
  raw_payload: Json | null
  stage_id: string
  assigned_agent_id: string | null
  lead_score: number
  is_duplicate: boolean
  duplicate_of: string | null
  import_batch_id: string | null
  created_at: string
  updated_at: string
  // Joined fields
  stage?: LeadStage
  assigned_agent?: Profile
  campaign?: AdCampaign
  ad_set?: AdSet
  ad?: Ad
}

export interface LeadNote {
  id: string
  lead_id: string
  author_id: string
  body: string
  created_at: string
  author?: Profile
}

export interface LeadFollowup {
  id: string
  lead_id: string
  agent_id: string
  scheduled_at: string
  note: string | null
  outcome_note: string | null
  is_completed: boolean
  completed_at: string | null
  created_at: string
  agent?: Profile
}

export interface LeadActivity {
  id: string
  lead_id: string
  activity_type: ActivityType
  performed_by: string | null
  metadata: Json | null
  created_at: string
  performer?: Profile
}

export interface LeadStageHistory {
  id: string
  lead_id: string
  from_stage_id: string | null
  to_stage_id: string
  changed_by: string | null
  changed_at: string
  from_stage?: LeadStage
  to_stage?: LeadStage
  changer?: Profile
}

export interface ImportBatch {
  id: string
  file_name: string
  uploaded_by: string | null
  total_rows: number | null
  success_count: number | null
  error_count: number | null
  duplicate_count: number | null
  error_log: Json | null
  created_at: string
}

export interface Client {
  id: string
  lead_id: string | null
  profile_id?: string | null
  name: string
  company: string | null
  email: string | null
  phone: string | null
  address: string | null
  created_at: string
}

export interface QuotationItem {
  id: string
  quotation_id: string
  description: string
  qty: number
  unit_price: number
  discount_percent?: number
  amount: number
  sort_order: number
}

export interface Quotation {
  id: string
  quote_number: string
  client_id: string
  lead_id: string | null
  status: QuotationStatus
  currency: string
  issue_date: string
  valid_until: string | null
  subtotal: number
  discount_type?: 'PERCENTAGE' | 'FIXED' | null
  discount_value?: number
  discount_amount?: number
  tax_percent: number
  tax_amount: number
  total: number
  terms: string | null
  notes: string | null
  pdf_url: string | null
  created_by: string | null
  office_location?: 'KSA' | 'HYDERABAD' | null
  created_at: string
  updated_at: string
  client?: Client
  items?: QuotationItem[]
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  description: string
  qty: number
  unit_price: number
  discount_percent?: number
  amount: number
  sort_order: number
}

export interface Invoice {
  id: string
  invoice_number: string
  quotation_id: string | null
  client_id: string
  lead_id: string | null
  status: InvoiceStatus
  currency: string
  issue_date: string
  due_date: string | null
  subtotal: number
  discount_type?: 'PERCENTAGE' | 'FIXED' | null
  discount_value?: number
  discount_amount?: number
  tax_percent: number
  tax_amount: number
  total: number
  amount_paid: number
  notes?: string | null
  terms?: string | null
  pdf_url: string | null
  created_by: string | null
  office_location?: 'KSA' | 'HYDERABAD' | null
  created_at: string
  updated_at: string
  client?: Client
  items?: InvoiceItem[]
}

export interface Payment {
  id: string
  invoice_id: string
  amount: number
  method: PaymentMethod | null
  paid_at: string
  reference_note: string | null
  recorded_by: string | null
  created_at: string
}

export interface ClientTask {
  id: string
  client_id: string
  assigned_employee_id: string | null
  created_by: string | null
  title: string
  description: string | null
  category: TaskCategory
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  deliverable_link: string | null
  created_at: string
  updated_at: string
  // Joins
  client?: Client
  assigned_employee?: Profile
  creator?: Profile
  updates?: ClientTaskUpdate[]
}

export interface ClientTaskUpdate {
  id: string
  task_id: string
  author_id: string | null
  update_type: TaskUpdateType
  status_from: TaskStatus | null
  status_to: TaskStatus | null
  body: string
  attachment_url: string | null
  created_at: string
  author?: Profile
}

// ==========================================
// PAYROLL & PAYSLIP TYPES
// ==========================================

export type PayslipCurrency = 'INR' | 'SAR' | 'USD'
export type PayslipStatus = 'DRAFT' | 'PUBLISHED' | 'PAID'

export interface PayslipLineItem {
  id: string
  name: string
  amount: number
  description?: string
}

export interface EmployeeSalaryProfile {
  id: string
  profile_id: string
  currency: PayslipCurrency
  base_salary: number
  joining_date: string
  designation?: string | null
  department?: string | null
  employee_code?: string | null
  bank_name?: string | null
  account_number?: string | null
  ifsc_or_iban?: string | null
  pan_or_iqama?: string | null
  default_allowances: PayslipLineItem[]
  default_deductions: PayslipLineItem[]
  created_at: string
  updated_at: string
  profile?: Profile
}

export interface Payslip {
  id: string
  employee_id: string
  month: number // 1 - 12
  year: number // e.g. 2026
  financial_year: string // e.g. "2026-2027"
  currency: PayslipCurrency
  base_salary: number
  earnings_breakdown: PayslipLineItem[]
  deductions_breakdown: PayslipLineItem[]
  gross_earnings: number
  total_deductions: number
  net_pay: number
  net_pay_in_words?: string | null
  working_days: number
  paid_days: number
  lop_days: number
  status: PayslipStatus
  payment_date?: string | null
  period_start_date?: string | null
  period_end_date?: string | null
  payment_method: PaymentMethod
  designation?: string | null
  department?: string | null
  employee_code?: string | null
  bank_name?: string | null
  account_number?: string | null
  ifsc_or_iban?: string | null
  pan_or_iqama?: string | null
  joining_date?: string | null
  notes?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
  // Joins
  employee?: Profile
  creator?: Profile
}

