-- Lead Ownership Phase 2 (P0): assigned_user_id as CRM handler; user_id remains provenance.

alter table public.leads
  add column if not exists assigned_user_id uuid
    references auth.users (id) on delete set null;

comment on column public.leads.user_id is
  'Creator/provenance (immutable after insert). WhatsApp: default_user_id; manual: acting user.';
comment on column public.leads.assigned_user_id is
  'CRM handler/agent responsible for the lead. Nullable = unassigned pool.';

update public.leads
set assigned_user_id = user_id
where assigned_user_id is null
  and user_id is not null;

create index if not exists leads_workspace_assigned_user_idx
  on public.leads (workspace_id, assigned_user_id)
  where assigned_user_id is not null;

create index if not exists leads_workspace_unassigned_idx
  on public.leads (workspace_id)
  where assigned_user_id is null;

create or replace function public.leads_validate_assigned_user()
returns trigger
language plpgsql
as $$
begin
  if new.assigned_user_id is not null and new.workspace_id is not null then
    if not exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = new.workspace_id
        and wm.user_id = new.assigned_user_id
    ) then
      raise exception 'assigned_user_id must be a member of the lead workspace';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists leads_validate_assigned_user_trigger on public.leads;

create trigger leads_validate_assigned_user_trigger
  before insert or update of assigned_user_id, workspace_id
  on public.leads
  for each row
  execute function public.leads_validate_assigned_user();
