-- Inventory table
create table if not exists inventory (
  id             uuid           primary key default gen_random_uuid(),
  make           text           not null,
  model          text           not null,
  year           int            not null,
  hp             int,
  fuel_type      text,
  chassis_number text,
  price          numeric(12, 2),
  status         text           not null default 'available'
                                  check (status in ('available', 'sold', 'reserved')),
  description    text,
  created_at     timestamptz    default now()
);

-- Enable Row Level Security
alter table inventory enable row level security;

-- Staff can read and write all inventory
create policy "Staff full access to inventory"
  on inventory
  for all
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'staff')
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'staff')
  );

-- Customers can view available inventory
create policy "Customers can view available inventory"
  on inventory
  for select
  using (
    status = 'available'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'customer'
    )
  );
