-- Inbox Phase 1.1: last message preview on leads + per-user read cursors
-- Run after 024_lead_assigned_user_id.sql

-- ---------------------------------------------------------------------------
-- leads: denormalized last message preview
-- ---------------------------------------------------------------------------

alter table public.leads
  add column if not exists last_message_text text,
  add column if not exists last_message_sender text
    check (last_message_sender is null or last_message_sender in ('client', 'ai', 'agent')),
  add column if not exists last_message_at timestamptz;

create index if not exists leads_workspace_last_message_at_idx
  on public.leads (workspace_id, last_message_at desc nulls last);

-- ---------------------------------------------------------------------------
-- lead_conversation_reads: per-user read cursor per lead
-- ---------------------------------------------------------------------------

create table if not exists public.lead_conversation_reads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_conversation_reads_lead_user_unique unique (lead_id, user_id)
);

create index if not exists lead_conversation_reads_user_workspace_idx
  on public.lead_conversation_reads (user_id, workspace_id);

create index if not exists lead_conversation_reads_lead_user_idx
  on public.lead_conversation_reads (lead_id, user_id);

-- ---------------------------------------------------------------------------
-- Backfill last_message_* from latest conversation per lead
-- ---------------------------------------------------------------------------

update public.leads as l
set
  last_message_text = latest.message,
  last_message_sender = latest.sender,
  last_message_at = latest.created_at
from (
  select distinct on (c.lead_id)
    c.lead_id,
    c.message,
    c.sender,
    c.created_at
  from public.conversations as c
  order by c.lead_id, c.created_at desc
) as latest
where l.id = latest.lead_id;

-- ---------------------------------------------------------------------------
-- Trigger: keep lead preview in sync on new conversations
-- ---------------------------------------------------------------------------

create or replace function public.sync_lead_last_message_from_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.leads
  set
    last_message_text = new.message,
    last_message_sender = new.sender,
    last_message_at = new.created_at
  where id = new.lead_id
    and (
      last_message_at is null
      or new.created_at >= last_message_at
    );

  return new;
end;
$$;

drop trigger if exists conversations_sync_lead_last_message on public.conversations;

create trigger conversations_sync_lead_last_message
  after insert on public.conversations
  for each row
  execute function public.sync_lead_last_message_from_conversation();

-- ---------------------------------------------------------------------------
-- RLS: lead_conversation_reads
-- ---------------------------------------------------------------------------

alter table public.lead_conversation_reads enable row level security;

drop policy if exists "lead_conversation_reads_select_workspace" on public.lead_conversation_reads;
create policy "lead_conversation_reads_select_workspace"
  on public.lead_conversation_reads
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "lead_conversation_reads_insert_own" on public.lead_conversation_reads;
create policy "lead_conversation_reads_insert_own"
  on public.lead_conversation_reads
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.leads as l
      where l.id = lead_id
        and l.workspace_id = lead_conversation_reads.workspace_id
    )
  );

drop policy if exists "lead_conversation_reads_update_own" on public.lead_conversation_reads;
create policy "lead_conversation_reads_update_own"
  on public.lead_conversation_reads
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.leads as l
      where l.id = lead_id
        and l.workspace_id = lead_conversation_reads.workspace_id
    )
  );

drop policy if exists "lead_conversation_reads_delete_own" on public.lead_conversation_reads;
create policy "lead_conversation_reads_delete_own"
  on public.lead_conversation_reads
  for delete
  to authenticated
  using (user_id = auth.uid());
