create table if not exists ledger_entries (
  id          uuid           primary key default gen_random_uuid(),
  date        date           not null default current_date,
  type        text           not null check (type in ('credit', 'debit')),
  amount      numeric(12, 2) not null,
  description text           not null,
  category    text           not null default 'other'
                               check (category in ('sale', 'service', 'payment_received', 'expense', 'purchase', 'salary', 'other')),
  customer_id uuid           references customers(id) on delete set null,
  reference   text,
  notes       text,
  created_at  timestamptz    default now()
);

alter table ledger_entries enable row level security;

create policy "Staff full access to ledger"
  on ledger_entries for all
  using     (exists (select 1 from profiles where id = auth.uid() and role = 'staff'))
  with check(exists (select 1 from profiles where id = auth.uid() and role = 'staff'));
