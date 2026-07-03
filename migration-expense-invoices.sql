-- Run in Supabase SQL Editor
-- Separate table for B2B expense invoices sent to VST Tillers Tractors Ltd

create table expense_invoices (
  id               uuid default gen_random_uuid() primary key,
  invoice_number   text unique not null,
  invoice_date     date not null default current_date,
  po_no            text,
  po_date          date,
  transportation_mode text default 'By road',
  vehicle_number   text,
  place_of_supply  text,
  credit_date      date,
  fssai_no         text,
  gstin_dealer     text,
  state_dealer     text,
  state_code_dealer text,
  notes            text,
  discount_percent numeric(5,2) default 0,
  other_charges    numeric(12,2) default 0,
  round_off        numeric(12,2) default 0,
  taxable_total    numeric(12,2) default 0,
  gst_total        numeric(12,2) default 0,
  total_amount     numeric(12,2) default 0,
  paid             boolean default false,
  created_at       timestamptz default now()
);

create table expense_invoice_items (
  id                uuid default gen_random_uuid() primary key,
  expense_invoice_id uuid references expense_invoices(id) on delete cascade,
  description       text not null,
  hsn_code          text not null,
  quantity          numeric(10,3) default 1,
  unit             text default 'NOS',
  unit_price        numeric(12,3) not null,
  gross_amount      numeric(12,2),
  discount_percent  numeric(5,2) default 0,
  taxable_amount    numeric(12,2),
  gst_percent       numeric(5,2) default 18,
  cgst_amount       numeric(12,2) default 0,
  sgst_amount       numeric(12,2) default 0,
  igst_amount       numeric(12,2) default 0,
  total             numeric(12,2)
);

alter table expense_invoices enable row level security;
alter table expense_invoice_items enable row level security;

create policy "Staff can manage expense invoices"
  on expense_invoices for all using (get_my_role() = 'staff');

create policy "Staff can manage expense invoice items"
  on expense_invoice_items for all using (get_my_role() = 'staff');

-- Auto-generate invoice number for expense invoices
create or replace function generate_expense_invoice_number()
returns trigger as $$
declare
  next_num integer;
begin
  select coalesce(max(cast(substring(invoice_number from 'EINV-(\d+)') as integer)), 0) + 1
  into next_num
  from expense_invoices;
  new.invoice_number := 'EINV-' || lpad(next_num::text, 4, '0');
  return new;
end;
$$ language plpgsql;

create trigger set_expense_invoice_number
  before insert on expense_invoices
  for each row
  when (new.invoice_number is null or new.invoice_number = '')
  execute function generate_expense_invoice_number();

-- Add expense invoice bank account to dealer_settings
alter table dealer_settings
  add column if not exists bank_name_expense text default '[BANK DETAILS PENDING - UPDATE BEFORE USE]',
  add column if not exists ifsc_code_expense text default '[IFSC PENDING]',
  add column if not exists account_no_expense text default '[ACCOUNT NO PENDING]';
