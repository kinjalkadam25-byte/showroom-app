-- Sequence for auto-incrementing invoice numbers
create sequence if not exists invoice_seq start with 1;

create or replace function generate_invoice_number()
returns trigger language plpgsql as $$
begin
  new.invoice_number := 'INV-' || lpad(nextval('invoice_seq')::text, 4, '0');
  return new;
end;
$$;

-- Invoices
create table if not exists invoices (
  id             uuid           primary key default gen_random_uuid(),
  invoice_number text           unique,
  customer_id    uuid           references customers(id) on delete set null,
  invoice_date   date           not null default current_date,
  due_date       date,
  paid           boolean        not null default false,
  discount       numeric(12, 2) not null default 0,
  total_amount   numeric(12, 2) not null default 0,
  notes          text,
  created_at     timestamptz    default now()
);

create trigger trg_invoice_number
  before insert on invoices
  for each row execute function generate_invoice_number();

-- Invoice line items
create table if not exists invoice_items (
  id             uuid           primary key default gen_random_uuid(),
  invoice_id     uuid           not null references invoices(id) on delete cascade,
  inventory_id   uuid           references inventory(id) on delete set null,
  description    text           not null,
  quantity       int            not null default 1,
  unit_price     numeric(12, 2) not null,
  total          numeric(12, 2) not null
);

-- RLS
alter table invoices      enable row level security;
alter table invoice_items enable row level security;

create policy "Staff full access to invoices"
  on invoices for all
  using     (exists (select 1 from profiles where id = auth.uid() and role = 'staff'))
  with check(exists (select 1 from profiles where id = auth.uid() and role = 'staff'));

create policy "Staff full access to invoice items"
  on invoice_items for all
  using     (exists (select 1 from profiles where id = auth.uid() and role = 'staff'))
  with check(exists (select 1 from profiles where id = auth.uid() and role = 'staff'));
