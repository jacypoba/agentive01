-- Allow authenticated users to idempotently provision their own default workspace
-- and backfill any profile that still lacks workspace membership after 013.

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

grant execute on function public.provision_default_workspace(uuid, text) to authenticated;

do $$
declare
  r record;
begin
  for r in
    select
      p.user_id,
      coalesce(
        nullif(trim(p.full_name), ''),
        nullif(trim(split_part(coalesce(p.email, ''), '@', 1)), ''),
        'My Workspace'
      ) as workspace_name
    from public.profiles p
    where not exists (
      select 1
      from public.workspace_members wm
      where wm.user_id = p.user_id
    )
  loop
    perform public.provision_default_workspace(r.user_id, r.workspace_name);
  end loop;
end;
$$;
