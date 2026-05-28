-- Phase 1 multi-tenant foundation (non-breaking)
-- Run after 012_lead_preferred_language.sql
--
-- Adds workspaces + workspace_members, nullable workspace_id on tenant tables,
-- backfills one default workspace per existing user, and keeps user_id + current
-- RLS policies untouched so the app continues to work exactly as before.
--
-- Safe to re-run: uses IF NOT EXISTS / conditional alters where practical.

-- ---------------------------------------------------------------------------
-- Core workspace tables
-- ---------------------------------------------------------------------------

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint workspaces_slug_unique unique (slug)
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  constraint workspace_members_unique unique (workspace_id, user_id)
);

create index if not exists workspace_members_user_id_idx
  on public.workspace_members (user_id);

create index if not exists workspace_members_workspace_id_idx
  on public.workspace_members (workspace_id);

create index if not exists workspaces_created_by_idx
  on public.workspaces (created_by);

-- ---------------------------------------------------------------------------
-- Nullable workspace_id on tenant-owned tables (Phase 1 — keep user_id)
-- ---------------------------------------------------------------------------

alter table public.leads
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;

alter table public.properties
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;

alter table public.visit_requests
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;

alter table public.follow_ups
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;

alter table public.processed_whatsapp_messages
  add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;

alter table public.profiles
  add column if not exists default_workspace_id uuid references public.workspaces (id) on delete set null;

create index if not exists leads_workspace_id_idx
  on public.leads (workspace_id);

create index if not exists properties_workspace_id_idx
  on public.properties (workspace_id);

create index if not exists visit_requests_workspace_id_idx
  on public.visit_requests (workspace_id);

create index if not exists follow_ups_workspace_id_idx
  on public.follow_ups (workspace_id);

create index if not exists processed_whatsapp_messages_workspace_id_idx
  on public.processed_whatsapp_messages (workspace_id);

create index if not exists profiles_default_workspace_id_idx
  on public.profiles (default_workspace_id);

-- ---------------------------------------------------------------------------
-- Provision default workspace for a user (idempotent)
-- ---------------------------------------------------------------------------

create or replace function public.provision_default_workspace(
  p_user_id uuid,
  p_workspace_name text default 'My Workspace'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_name text;
begin
  select wm.workspace_id
  into v_workspace_id
  from public.workspace_members wm
  where wm.user_id = p_user_id
  order by wm.created_at asc
  limit 1;

  if v_workspace_id is not null then
    update public.profiles
    set default_workspace_id = coalesce(default_workspace_id, v_workspace_id)
    where user_id = p_user_id;

    return v_workspace_id;
  end if;

  v_name := coalesce(nullif(trim(p_workspace_name), ''), 'My Workspace');
  v_workspace_id := gen_random_uuid();

  insert into public.workspaces (id, name, slug, created_by)
  values (
    v_workspace_id,
    v_name,
    'ws-' || replace(p_user_id::text, '-', ''),
    p_user_id
  );

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, p_user_id, 'owner');

  update public.profiles
  set default_workspace_id = v_workspace_id
  where user_id = p_user_id;

  return v_workspace_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: one default workspace per existing tenant user
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  v_workspace_id uuid;
  v_name text;
begin
  for r in
    select distinct u.user_id
    from (
      select user_id from public.leads
      union
      select user_id from public.properties
      union
      select user_id from public.visit_requests
      union
      select user_id from public.follow_ups
      union
      select id as user_id from public.profiles
    ) as u
    where u.user_id is not null
  loop
    select coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(split_part(coalesce(p.email, ''), '@', 1)), ''),
      'My Workspace'
    )
    into v_name
    from public.profiles p
    where p.user_id = r.user_id
    limit 1;

    v_workspace_id := public.provision_default_workspace(r.user_id, coalesce(v_name, 'My Workspace'));
  end loop;
end;
$$;

update public.leads as l
set workspace_id = wm.workspace_id
from public.workspace_members as wm
where l.workspace_id is null
  and wm.user_id = l.user_id
  and wm.role = 'owner';

update public.properties as p
set workspace_id = wm.workspace_id
from public.workspace_members as wm
where p.workspace_id is null
  and wm.user_id = p.user_id
  and wm.role = 'owner';

update public.visit_requests as vr
set workspace_id = wm.workspace_id
from public.workspace_members as wm
where vr.workspace_id is null
  and wm.user_id = vr.user_id
  and wm.role = 'owner';

update public.follow_ups as fu
set workspace_id = wm.workspace_id
from public.workspace_members as wm
where fu.workspace_id is null
  and wm.user_id = fu.user_id
  and wm.role = 'owner';

-- processed_whatsapp_messages stays global dedup in Phase 1 (workspace_id remains null)

-- ---------------------------------------------------------------------------
-- Signup hook: auto-provision workspace for new users
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
begin
  v_full_name := coalesce(new.raw_user_meta_data ->> 'full_name', '');

  insert into public.profiles (id, user_id, full_name, email)
  values (
    new.id,
    new.id,
    v_full_name,
    new.email
  )
  on conflict (id) do update
  set
    user_id = excluded.user_id,
    email = coalesce(public.profiles.email, excluded.email),
    full_name = coalesce(public.profiles.full_name, excluded.full_name);

  perform public.provision_default_workspace(
    new.id,
    coalesce(nullif(trim(v_full_name), ''), new.email, 'My Workspace')
  );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security for new tables (existing tenant RLS unchanged)
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

drop policy if exists "workspace_members_select_own" on public.workspace_members;
create policy "workspace_members_select_own"
  on public.workspace_members
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "workspaces_select_member" on public.workspaces;
create policy "workspaces_select_member"
  on public.workspaces
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
    )
  );

grant select on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;

-- Phase 2 will add workspace-scoped RLS on tenant tables and make workspace_id
-- required on writes. user_id remains the compatibility column for now.
