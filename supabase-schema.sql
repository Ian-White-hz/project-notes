-- Run in the SQL Editor of your own Supabase project.
-- One private notebook per signed-in user.
create table if not exists public.notebooks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.notebooks enable row level security;
revoke all on public.notebooks from anon;
grant select, insert, update on public.notebooks to authenticated;

drop policy if exists "Read own notebook" on public.notebooks;
create policy "Read own notebook" on public.notebooks
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Create own notebook" on public.notebooks;
create policy "Create own notebook" on public.notebooks
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Update own notebook" on public.notebooks;
create policy "Update own notebook" on public.notebooks
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
