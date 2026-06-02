-- Flow — database schema + Row Level Security policies.
-- This is a REFERENCE copy. These statements have already been applied to the
-- Supabase project. If you ever recreate the project, paste this into the
-- Supabase SQL editor (Dashboard -> SQL Editor -> New query -> Run).

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  position integer not null,
  color text,
  created_at timestamptz not null default now()
);

create table if not exists public.columns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  title text not null,
  position integer not null,
  color text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  column_id uuid not null references public.columns(id) on delete cascade,
  title text not null,
  notes text,
  priority text not null default 'med' check (priority in ('low','med','high')),
  due_date date,
  position integer not null,
  completed_at timestamptz,
  completed_from text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_column_id_idx on public.tasks(column_id);
create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists columns_user_id_idx on public.columns(user_id);
create index if not exists columns_board_id_idx on public.columns(board_id);
create index if not exists boards_user_id_idx on public.boards(user_id);

-- ============================================================
-- Keep tasks.updated_at fresh on every update
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security: a user can only read/write their own rows
-- ============================================================

alter table public.boards enable row level security;
alter table public.columns enable row level security;
alter table public.tasks enable row level security;

create policy "boards_select_own" on public.boards
  for select using (auth.uid() = user_id);
create policy "boards_insert_own" on public.boards
  for insert with check (auth.uid() = user_id);
create policy "boards_update_own" on public.boards
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "boards_delete_own" on public.boards
  for delete using (auth.uid() = user_id);

create policy "columns_select_own" on public.columns
  for select using (auth.uid() = user_id);
create policy "columns_insert_own" on public.columns
  for insert with check (auth.uid() = user_id);
create policy "columns_update_own" on public.columns
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "columns_delete_own" on public.columns
  for delete using (auth.uid() = user_id);

create policy "tasks_select_own" on public.tasks
  for select using (auth.uid() = user_id);
create policy "tasks_insert_own" on public.tasks
  for insert with check (auth.uid() = user_id);
create policy "tasks_update_own" on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks_delete_own" on public.tasks
  for delete using (auth.uid() = user_id);

-- ============================================================
-- Curate module: notes
-- ============================================================

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_id_idx on public.notes(user_id);

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

alter table public.notes enable row level security;

create policy "notes_select_own" on public.notes
  for select using (auth.uid() = user_id);
create policy "notes_insert_own" on public.notes
  for insert with check (auth.uid() = user_id);
create policy "notes_update_own" on public.notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes_delete_own" on public.notes
  for delete using (auth.uid() = user_id);
