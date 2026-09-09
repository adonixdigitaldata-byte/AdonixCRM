-- Migration: Add discount columns to quotations, invoices, and line items
-- Run this in your Supabase SQL Editor if columns do not exist yet.

-- 1. Quotations
alter table quotations
  add column if not exists discount_type text default 'PERCENTAGE' check (discount_type in ('PERCENTAGE', 'FIXED')),
  add column if not exists discount_value numeric(12,2) default 0,
  add column if not exists discount_amount numeric(12,2) default 0;

-- 2. Quotation Items
alter table quotation_items
  add column if not exists discount_percent numeric(5,2) default 0;

-- 3. Invoices
alter table invoices
  add column if not exists discount_type text default 'PERCENTAGE' check (discount_type in ('PERCENTAGE', 'FIXED')),
  add column if not exists discount_value numeric(12,2) default 0,
  add column if not exists discount_amount numeric(12,2) default 0;

-- 4. Invoice Items
alter table invoice_items
  add column if not exists discount_percent numeric(5,2) default 0;
