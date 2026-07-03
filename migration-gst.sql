-- Run this in Supabase SQL Editor
-- Adds GST compliance fields to invoices, and HSN code to inventory

alter table invoices
  add column if not exists gst_percent numeric(5,2) default 18,
  add column if not exists cgst_amount numeric(12,2) default 0,
  add column if not exists sgst_amount numeric(12,2) default 0,
  add column if not exists igst_amount numeric(12,2) default 0,
  add column if not exists is_interstate boolean default false;

alter table inventory
  add column if not exists hsn_code text default '8701';
  -- 8701 is the standard HSN code for tractors in India

alter table invoice_items
  add column if not exists hsn_code text default '8701';

-- Dealer GST details (single row, showroom's own registration)
create table if not exists dealer_settings (
  id uuid default gen_random_uuid() primary key,
  business_name text not null default 'VST Tractors Showroom',
  gstin text,
  address text,
  state text,
  upi_id text,
  updated_at timestamptz default now()
);

alter table dealer_settings enable row level security;

create policy "Staff can manage dealer settings"
  on dealer_settings for all using (get_my_role() = 'staff');

create policy "Anyone authenticated can read dealer settings"
  on dealer_settings for select using (auth.uid() is not null);

-- Insert a default row if none exists (run once)
insert into dealer_settings (business_name, gstin, address, state)
select 'VST Tractors Showroom', '', '', 'Maharashtra'
where not exists (select 1 from dealer_settings);
