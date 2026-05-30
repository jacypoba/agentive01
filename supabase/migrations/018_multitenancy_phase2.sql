-- Phase 2 multi-tenant hardening
-- Run after 017_whatsapp_webhook_heartbeat_expand.sql
--
-- Adds workspace_id to conversations, WhatsApp routing per workspace,
-- workspace-level AI settings, and workspace-scoped RLS on tenant tables.

-- ---------------------------------------------------------------------------
-- Helper: workspace membership check (used by RLS policies)
-- ---------------------------------------------------------------------------

create or replace function public.is_workspace_member(p_workspace_id uuid)
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
    );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- conversations.workspace_id
-- ---------------------------------------------------------------------------

alter table public.conversations
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;

create index if not exists conversations_workspace_id_idx
  on public.conversations (workspace_id);

update public.conversations as c
set workspace_id = l.workspace_id
from public.leads as l
where c.workspace_id is null
  and c.lead_id = l.id
  and l.workspace_id is not null;

-- ---------------------------------------------------------------------------
-- workspace_whatsapp_connections — maps provider instance → workspace
-- ---------------------------------------------------------------------------

create table if not exists public.workspace_whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null check (provider in ('meta', 'evolution')),
  provider_instance_id text not null,
  default_user_id uuid not null references auth.users (id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_whatsapp_connections_provider_instance_unique
    unique (provider, provider_instance_id)
);

create index if not exists workspace_whatsapp_connections_workspace_id_idx
  on public.workspace_whatsapp_connections (workspace_id);

create index if not exists workspace_whatsapp_connections_lookup_idx
  on public.workspace_whatsapp_connections (provider, provider_instance_id)
  where is_active = true;

-- ---------------------------------------------------------------------------
-- workspace_settings — per-workspace AI / business configuration
-- ---------------------------------------------------------------------------

create table if not exists public.workspace_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  tone_of_voice text,
  business_name text,
  business_info text,
  faqs jsonb not null default '[]'::jsonb,
  default_language text not null default 'en',
  agent_behavior_rules text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Backfill: default WhatsApp connection from env-driven single-tenant setup
-- (Uses workspace owner as default_user_id when WHATSAPP_DEFAULT_USER_ID is set
--  at application layer; SQL backfill links first workspace per owner.)
-- ---------------------------------------------------------------------------

insert into public.workspace_settings (workspace_id)
select w.id
from public.workspaces w
on conflict (workspace_id) do nothing;

-- ---------------------------------------------------------------------------
-- Row level security — workspace-scoped tenant tables
-- ---------------------------------------------------------------------------

alter table public.workspace_whatsapp_connections enable row level security;
alter table public.workspace_settings enable row level security;

-- workspace_whatsapp_connections
drop policy if exists "workspace_whatsapp_connections_select_member" on public.workspace_whatsapp_connections;
create policy "workspace_whatsapp_connections_select_member"
  on public.workspace_whatsapp_connections
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

-- workspace_settings
drop policy if exists "workspace_settings_select_member" on public.workspace_settings;
create policy "workspace_settings_select_member"
  on public.workspace_settings
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_settings_update_admin" on public.workspace_settings;
create policy "workspace_settings_update_admin"
  on public.workspace_settings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspace_settings.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspace_settings.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

grant select on public.workspace_whatsapp_connections to authenticated;
grant select, update on public.workspace_settings to authenticated;

-- leads — replace user_id-only policies
drop policy if exists "Users can view own leads" on public.leads;
drop policy if exists "Users can insert own leads" on public.leads;
drop policy if exists "Users can update own leads" on public.leads;
drop policy if exists "Users can delete own leads" on public.leads;
drop policy if exists "leads_select_workspace" on public.leads;
drop policy if exists "leads_insert_workspace" on public.leads;
drop policy if exists "leads_update_workspace" on public.leads;
drop policy if exists "leads_delete_workspace" on public.leads;

create policy "leads_select_workspace"
  on public.leads for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or (workspace_id is null and auth.uid() = user_id)
  );

create policy "leads_insert_workspace"
  on public.leads for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    or (workspace_id is null and auth.uid() = user_id)
  );

create policy "leads_update_workspace"
  on public.leads for update to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or (workspace_id is null and auth.uid() = user_id)
  );

create policy "leads_delete_workspace"
  on public.leads for delete to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or (workspace_id is null and auth.uid() = user_id)
  );

-- properties
drop policy if exists "Users can view own properties" on public.properties;
drop policy if exists "Users can insert own properties" on public.properties;
drop policy if exists "Users can update own properties" on public.properties;
drop policy if exists "Users can delete own properties" on public.properties;
drop policy if exists "properties_select_workspace" on public.properties;
drop policy if exists "properties_insert_workspace" on public.properties;
drop policy if exists "properties_update_workspace" on public.properties;
drop policy if exists "properties_delete_workspace" on public.properties;

create policy "properties_select_workspace"
  on public.properties for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or (workspace_id is null and auth.uid() = user_id)
  );

create policy "properties_insert_workspace"
  on public.properties for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    or (workspace_id is null and auth.uid() = user_id)
  );

create policy "properties_update_workspace"
  on public.properties for update to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or (workspace_id is null and auth.uid() = user_id)
  );

create policy "properties_delete_workspace"
  on public.properties for delete to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or (workspace_id is null and auth.uid() = user_id)
  );

-- visit_requests
drop policy if exists "Users can view own visit requests" on public.visit_requests;
drop policy if exists "Users can insert own visit requests" on public.visit_requests;
drop policy if exists "Users can update own visit requests" on public.visit_requests;
drop policy if exists "Users can delete own visit requests" on public.visit_requests;
drop policy if exists "visit_requests_select_workspace" on public.visit_requests;
drop policy if exists "visit_requests_insert_workspace" on public.visit_requests;
drop policy if exists "visit_requests_update_workspace" on public.visit_requests;
drop policy if exists "visit_requests_delete_workspace" on public.visit_requests;

create policy "visit_requests_select_workspace"
  on public.visit_requests for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or (workspace_id is null and auth.uid() = user_id)
  );

create policy "visit_requests_insert_workspace"
  on public.visit_requests for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    or (workspace_id is null and auth.uid() = user_id)
  );

create policy "visit_requests_update_workspace"
  on public.visit_requests for update to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or (workspace_id is null and auth.uid() = user_id)
  );

create policy "visit_requests_delete_workspace"
  on public.visit_requests for delete to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or (workspace_id is null and auth.uid() = user_id)
  );

-- follow_ups
drop policy if exists "Users can view own follow ups" on public.follow_ups;
drop policy if exists "Users can insert own follow ups" on public.follow_ups;
drop policy if exists "Users can update own follow ups" on public.follow_ups;
drop policy if exists "follow_ups_select_workspace" on public.follow_ups;
drop policy if exists "follow_ups_insert_workspace" on public.follow_ups;
drop policy if exists "follow_ups_update_workspace" on public.follow_ups;

create policy "follow_ups_select_workspace"
  on public.follow_ups for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or (workspace_id is null and auth.uid() = user_id)
  );

create policy "follow_ups_insert_workspace"
  on public.follow_ups for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    or (workspace_id is null and auth.uid() = user_id)
  );

create policy "follow_ups_update_workspace"
  on public.follow_ups for update to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or (workspace_id is null and auth.uid() = user_id)
  );

-- conversations — workspace via column or lead join
drop policy if exists "Users can view own conversations" on public.conversations;
drop policy if exists "Users can insert own conversations" on public.conversations;
drop policy if exists "Users can update own conversations" on public.conversations;
drop policy if exists "Users can delete own conversations" on public.conversations;
drop policy if exists "conversations_select_workspace" on public.conversations;
drop policy if exists "conversations_insert_workspace" on public.conversations;
drop policy if exists "conversations_update_workspace" on public.conversations;
drop policy if exists "conversations_delete_workspace" on public.conversations;

create policy "conversations_select_workspace"
  on public.conversations for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or exists (
      select 1 from public.leads l
      where l.id = conversations.lead_id
        and (
          public.is_workspace_member(l.workspace_id)
          or (l.workspace_id is null and l.user_id = auth.uid())
        )
    )
  );

create policy "conversations_insert_workspace"
  on public.conversations for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    or exists (
      select 1 from public.leads l
      where l.id = conversations.lead_id
        and (
          public.is_workspace_member(l.workspace_id)
          or (l.workspace_id is null and l.user_id = auth.uid())
        )
    )
  );

create policy "conversations_update_workspace"
  on public.conversations for update to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or exists (
      select 1 from public.leads l
      where l.id = conversations.lead_id
        and (
          public.is_workspace_member(l.workspace_id)
          or (l.workspace_id is null and l.user_id = auth.uid())
        )
    )
  );

create policy "conversations_delete_workspace"
  on public.conversations for delete to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or exists (
      select 1 from public.leads l
      where l.id = conversations.lead_id
        and (
          public.is_workspace_member(l.workspace_id)
          or (l.workspace_id is null and l.user_id = auth.uid())
        )
    )
  );
