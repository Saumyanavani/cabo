create table if not exists public.rooms (
  code text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.rooms enable row level security;

create policy "rooms are readable by code"
on public.rooms for select
to anon
using (true);

create policy "rooms can be created"
on public.rooms for insert
to anon
with check (true);

create policy "rooms can be updated"
on public.rooms for update
to anon
using (true)
with check (true);

alter publication supabase_realtime add table public.rooms;
