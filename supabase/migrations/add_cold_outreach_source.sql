-- Migration: Add COLD_OUTREACH to leads source check constraint
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor)

-- 1. Drop existing source check constraint
alter table leads drop constraint if exists leads_source_check;

-- 2. Re-add source check constraint with COLD_OUTREACH included
alter table leads add constraint leads_source_check
  check (source in ('META_ADS','TIKTOK','SNAPCHAT','WHATSAPP','MANUAL','XLSX_IMPORT','COLD_OUTREACH'));
