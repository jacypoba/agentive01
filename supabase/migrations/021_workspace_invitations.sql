-- Workspace team invitations + member visibility for team settings
-- Run after 020_billing_webhook_events.sql

-- ---------------------------------------------------------------------------
-- Helper: workspace owner or admin
-- ---------------------------------------------------------------------------

create or replace function public.is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_workspace_id is not null
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = p_workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    );
$$;

revoke all on function public.is_workspace_admin(uuid) from public;
grant execute on function public.is_workspace_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- workspace_invitations
-- ---------------------------------------------------------------------------

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member')),
  token_hash text not null,
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'canceled', 'expired')
  ),
  invited_by uuid not null references auth.users (id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint workspace_invitations_token_hash_unique unique (token_hash)
);

create index if not exists workspace_invitations_workspace_id_idx
  on public.workspace_invitations (workspace_id);

create index if not exists workspace_invitations_status_idx
  on public.workspace_invitations (workspace_id, status);

create unique index if not exists workspace_invitations_pending_email_idx
  on public.workspace_invitations (workspace_id, lower(email))
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- workspace_members: teammates can see each other in the same workspace
-- ---------------------------------------------------------------------------

drop policy if exists "workspace_members_select_own" on public.workspace_members;
drop policy if exists "workspace_members_select_workspace_member" on public.workspace_members;

create policy "workspace_members_select_workspace_member"
  on public.workspace_members
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- workspace_invitations RLS (reads for admins; writes via service role)
-- ---------------------------------------------------------------------------

alter table public.workspace_invitations enable row level security;

drop policy if exists "workspace_invitations_select_admin" on public.workspace_invitations;
create policy "workspace_invitations_select_admin"
  on public.workspace_invitations
  for select
  to authenticated
  using (public.is_workspace_admin(workspace_id));

grant select on public.workspace_invitations to authenticated;

-- Teammates may read each other's profile names/emails within shared workspaces.
drop policy if exists "profiles_select_workspace_teammate" on public.profiles;
create policy "profiles_select_workspace_teammate"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm_self
      inner join public.workspace_members wm_target
        on wm_self.workspace_id = wm_target.workspace_id
      where wm_self.user_id = auth.uid()
        and wm_target.user_id = profiles.user_id
    )
  );
