-- =============================================
-- SHOWROOM APP — SUPABASE SCHEMA
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. PROFILES (extends auth.users)
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  email text not null,
  phone text,
  role text not null check (role in ('staff', 'customer')),
  created_at timestamptz default now()
);

-- 2. CUSTOMERS (detailed info, staff-managed)
create table customers (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles(id) on delete set null,
  name text not null,
  email text,
  phone text not null,
  address text,
  notes text,
  created_at timestamptz default now()
);

-- 3. INVENTORY (cars)
create table inventory (
  id uuid default gen_random_uuid() primary key,
  make text not null,
  model text not null,
  year integer not null,
  color text,
  price numeric(12,2) not null,
  status text default 'available' check (status in ('available', 'sold', 'reserved')),
  image_url text,
  description text,
  created_at timestamptz default now()
);

-- 4. CUSTOMER_CARS (cars linked to customers after purchase)
create table customer_cars (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references customers(id) on delete cascade,
  inventory_id uuid references inventory(id) on delete set null,
  purchase_date date,
  purchase_price numeric(12,2),
  created_at timestamptz default now()
);

-- 5. QUOTATIONS
create table quotations (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references customers(id) on delete cascade,
  inventory_id uuid references inventory(id) on delete set null,
  validity_date date,
  discount numeric(10,2) default 0,
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected', 'expired')),
  notes text,
  pdf_url text,
  created_at timestamptz default now()
);

-- 6. INVOICES
create table invoices (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references customers(id) on delete cascade,
  customer_car_id uuid references customer_cars(id) on delete set null,
  invoice_number text unique not null,
  amount numeric(12,2) not null,
  gst_percent numeric(5,2) default 18,
  gst_amount numeric(12,2),
  total_amount numeric(12,2),
  paid boolean default false,
  invoice_date date default current_date,
  pdf_url text,
  created_at timestamptz default now()
);

-- 7. PAYMENTS
create table payments (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references customers(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete cascade,
  amount numeric(12,2) not null,
  method text check (method in ('cash', 'upi', 'bank_transfer', 'card', 'other')),
  payment_date date default current_date,
  notes text,
  created_at timestamptz default now()
);

-- 8. SERVICE BOOKINGS
create table bookings (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references customers(id) on delete cascade,
  customer_car_id uuid references customer_cars(id) on delete set null,
  service_type text not null,
  scheduled_date date not null,
  status text default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz default now()
);

-- 9. REMINDERS (WhatsApp / Email)
create table reminders (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references customers(id) on delete cascade,
  message text not null,
  due_date date not null,
  channel text default 'whatsapp' check (channel in ('whatsapp', 'email', 'both')),
  sent boolean default false,
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

alter table profiles enable row level security;
alter table customers enable row level security;
alter table inventory enable row level security;
alter table customer_cars enable row level security;
alter table quotations enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;
alter table bookings enable row level security;
alter table reminders enable row level security;

-- Helper function: get current user's role
create or replace function get_my_role()
returns text as $$
  select role from profiles where id = auth.uid()
$$ language sql security definer;

-- PROFILES policies
create policy "Users can read own profile"
  on profiles for select using (id = auth.uid());

create policy "Staff can read all profiles"
  on profiles for select using (get_my_role() = 'staff');

create policy "Users can update own profile"
  on profiles for update using (id = auth.uid());

-- INVENTORY policies (public read, staff write)
create policy "Anyone can view inventory"
  on inventory for select using (true);

create policy "Staff can manage inventory"
  on inventory for all using (get_my_role() = 'staff');

-- CUSTOMERS policies (staff only)
create policy "Staff can manage customers"
  on customers for all using (get_my_role() = 'staff');

create policy "Customers can view own record"
  on customers for select using (profile_id = auth.uid());

-- CUSTOMER_CARS policies
create policy "Staff can manage customer cars"
  on customer_cars for all using (get_my_role() = 'staff');

create policy "Customers can view own cars"
  on customer_cars for select
  using (customer_id in (select id from customers where profile_id = auth.uid()));

-- QUOTATIONS policies
create policy "Staff can manage quotations"
  on quotations for all using (get_my_role() = 'staff');

create policy "Customers can view own quotations"
  on quotations for select
  using (customer_id in (select id from customers where profile_id = auth.uid()));

-- INVOICES policies
create policy "Staff can manage invoices"
  on invoices for all using (get_my_role() = 'staff');

create policy "Customers can view own invoices"
  on invoices for select
  using (customer_id in (select id from customers where profile_id = auth.uid()));

-- PAYMENTS policies
create policy "Staff can manage payments"
  on payments for all using (get_my_role() = 'staff');

create policy "Customers can view own payments"
  on payments for select
  using (customer_id in (select id from customers where profile_id = auth.uid()));

-- BOOKINGS policies
create policy "Staff can manage bookings"
  on bookings for all using (get_my_role() = 'staff');

create policy "Customers can view and create own bookings"
  on bookings for select
  using (customer_id in (select id from customers where profile_id = auth.uid()));

create policy "Customers can insert bookings"
  on bookings for insert
  with check (customer_id in (select id from customers where profile_id = auth.uid()));

-- REMINDERS policies
create policy "Staff can manage reminders"
  on reminders for all using (get_my_role() = 'staff');

create policy "Customers can view own reminders"
  on reminders for select
  using (customer_id in (select id from customers where profile_id = auth.uid()));

-- =============================================
-- STORAGE BUCKETS (run in Supabase dashboard)
-- =============================================
-- Create two buckets manually in Supabase Storage:
-- 1. "car-images"  → public
-- 2. "documents"   → private (invoices, quotations PDFs)
