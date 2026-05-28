-- Automated WhatsApp follow-up queue

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (
    type in (
      'property_recommended',
      'silent_lead',
      'visit_pending',
      'visit_completed',
      'new_match'
    )
  ),
  status text not null default 'pending' check (
    status in ('pending', 'sent', 'failed', 'cancelled')
  ),
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  message text,
  context_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists follow_ups_user_status_scheduled_idx
  on public.follow_ups (user_id, status, scheduled_for);

create index if not exists follow_ups_lead_id_idx
  on public.follow_ups (lead_id);

create index if not exists follow_ups_lead_pending_type_idx
  on public.follow_ups (lead_id, type)
  where status = 'pending';

alter table public.follow_ups enable row level security;

drop policy if exists "Users can view own follow ups" on public.follow_ups;
drop policy if exists "Users can insert own follow ups" on public.follow_ups;
drop policy if exists "Users can update own follow ups" on public.follow_ups;

create policy "Users can view own follow ups"
  on public.follow_ups for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own follow ups"
  on public.follow_ups for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own follow ups"
  on public.follow_ups for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.follow_ups to authenticated;
