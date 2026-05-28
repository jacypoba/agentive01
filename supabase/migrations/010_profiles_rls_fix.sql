-- Fix profiles RLS for Google Calendar OAuth upsert (insert + update).
-- Safe to re-run in Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- user_id column (mirrors auth user id; id remains primary key)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

update public.profiles
set user_id = id
where user_id is null;

alter table public.profiles
  alter column user_id set not null;

create unique index if not exists profiles_user_id_unique_idx
  on public.profiles (user_id);

-- Keep user_id aligned with id on every write
create or replace function public.profiles_sync_user_id()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    new.user_id := new.id;
  end if;
  if new.id is null then
    new.id := new.user_id;
  end if;
  if new.user_id <> new.id then
    raise exception 'profiles.user_id must equal profiles.id';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_sync_user_id_trigger on public.profiles;

create trigger profiles_sync_user_id_trigger
  before insert or update on public.profiles
  for each row execute function public.profiles_sync_user_id();

-- Signup trigger should populate user_id too
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, user_id, full_name, email)
  values (
    new.id,
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do update
  set
    user_id = excluded.user_id,
    email = coalesce(public.profiles.email, excluded.email),
    full_name = coalesce(public.profiles.full_name, excluded.full_name);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security policies (authenticated users, own row only)
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id and auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Table grants (RLS still enforced)
-- ---------------------------------------------------------------------------

grant select, insert, update on public.profiles to authenticated;
