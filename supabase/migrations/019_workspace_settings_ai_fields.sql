-- Extend workspace_settings for full AI assistant configuration.

alter table public.workspace_settings
  add column if not exists areas_served text,
  add column if not exists preferred_languages jsonb not null default '["en"]'::jsonb,
  add column if not exists office_hours text,
  add column if not exists greeting_style text,
  add column if not exists follow_up_style text;

update public.workspace_settings
set preferred_languages = jsonb_build_array(default_language)
where preferred_languages is null
   or preferred_languages = '[]'::jsonb;

-- Ensure every workspace has a settings row (idempotent).
insert into public.workspace_settings (workspace_id)
select w.id
from public.workspaces w
where not exists (
  select 1
  from public.workspace_settings ws
  where ws.workspace_id = w.id
)
on conflict (workspace_id) do nothing;

-- Auto-provision settings row when a workspace is created.
create or replace function public.ensure_workspace_settings_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_settings (workspace_id)
  values (NEW.id)
  on conflict (workspace_id) do nothing;
  return NEW;
end;
$$;

drop trigger if exists workspace_settings_on_workspace_insert on public.workspaces;
create trigger workspace_settings_on_workspace_insert
  after insert on public.workspaces
  for each row
  execute function public.ensure_workspace_settings_row();

-- Idempotent ensure helper for application layer (service role or definer).
create or replace function public.ensure_workspace_settings(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_workspace_id is null then
    raise exception 'workspace_id is required';
  end if;

  insert into public.workspace_settings (workspace_id)
  values (p_workspace_id)
  on conflict (workspace_id) do nothing;
end;
$$;

grant execute on function public.ensure_workspace_settings(uuid) to authenticated;

-- Extend provision_default_workspace to create settings row.
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
  if auth.uid() is not null and auth.uid() is distinct from p_user_id then
    raise exception 'Cannot provision workspace for another user';
  end if;

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

    perform public.ensure_workspace_settings(v_workspace_id);
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

  perform public.ensure_workspace_settings(v_workspace_id);
  return v_workspace_id;
end;
$$;

grant execute on function public.provision_default_workspace(uuid, text) to authenticated;
