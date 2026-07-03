  -- ─── Sequence ───────────────────────────────────────────────────────────────
  create sequence if not exists quotation_seq start with 1;

  -- ─── Auto-number function ────────────────────────────────────────────────────
  create or replace function generate_quotation_number()
  returns trigger language plpgsql as $$
  begin
    new.quotation_number := 'QT-' || lpad(nextval('quotation_seq')::text, 4, '0');
    return new;
  end;
  $$;

  -- ─── Quotations ──────────────────────────────────────────────────────────────
  create table if not exists quotations (
    id               uuid           primary key default gen_random_uuid(),
    quotation_number text           unique,
    customer_id      uuid           references customers(id) on delete set null,
    status           text           not null default 'draft'
                                      check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
    valid_until      date,
    discount         numeric(12, 2) not null default 0,
    total_amount     numeric(12, 2) not null default 0,
    notes            text,
    created_at       timestamptz    default now()
  );

  -- Fix column type if table already existed with quotation_number as numeric
  alter table quotations alter column quotation_number type text using quotation_number::text;

  -- Fix status constraint if table already existed with different values
  alter table quotations drop constraint if exists quotations_status_check;
  alter table quotations add constraint quotations_status_check
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired'));

  -- Trigger (drop first so re-runs are safe)
  drop trigger if exists trg_quotation_number on quotations;
  create trigger trg_quotation_number
    before insert on quotations
    for each row execute function generate_quotation_number();

  -- Backfill any rows that have a null quotation_number
  update quotations
  set quotation_number = 'QT-' || lpad(nextval('quotation_seq')::text, 4, '0')
  where quotation_number is null;

  -- ─── Quotation line items ────────────────────────────────────────────────────
  create table if not exists quotation_items (
    id             uuid           primary key default gen_random_uuid(),
    quotation_id   uuid           not null references quotations(id) on delete cascade,
    inventory_id   uuid           references inventory(id) on delete set null,
    description    text           not null,
    quantity       int            not null default 1,
    unit_price     numeric(12, 2) not null,
    total          numeric(12, 2) not null
  );

  -- ─── RLS ─────────────────────────────────────────────────────────────────────
  alter table quotations      enable row level security;
  alter table quotation_items enable row level security;

  drop policy if exists "Staff full access to quotations"    on quotations;
  drop policy if exists "Staff full access to quotation items" on quotation_items;

  create policy "Staff full access to quotations"
    on quotations for all
    using     (exists (select 1 from profiles where id = auth.uid() and role = 'staff'))
    with check(exists (select 1 from profiles where id = auth.uid() and role = 'staff'));

  create policy "Staff full access to quotation items"
    on quotation_items for all
    using     (exists (select 1 from profiles where id = auth.uid() and role = 'staff'))
    with check(exists (select 1 from profiles where id = auth.uid() and role = 'staff'));
