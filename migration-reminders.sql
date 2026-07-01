create table if not exists reminders (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null,
  notes       text,
  customer_id uuid        references customers(id) on delete set null,
  due_date    date        not null,
  type        text        not null default 'general'
                            check (type in ('general', 'service', 'payment', 'follow_up')),
  completed   boolean     not null default false,
  created_at  timestamptz default now()
);

alter table reminders enable row level security;

create policy "Staff full access to reminders"
  on reminders for all
  using     (exists (select 1 from profiles where id = auth.uid() and role = 'staff'))
  with check(exists (select 1 from profiles where id = auth.uid() and role = 'staff'));
