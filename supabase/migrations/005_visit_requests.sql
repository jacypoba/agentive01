-- Visit requests from WhatsApp AI detection
-- Run after 004_lead_qualification_fields.sql

create table if not exists public.visit_requests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  requested_datetime_text text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists visit_requests_user_id_idx
  on public.visit_requests (user_id);

create index if not exists visit_requests_lead_id_idx
  on public.visit_requests (lead_id);

create index if not exists visit_requests_status_idx
  on public.visit_requests (status);

create index if not exists visit_requests_created_at_idx
  on public.visit_requests (created_at desc);

alter table public.visit_requests enable row level security;

create policy "Users can view own visit requests"
  on public.visit_requests for select
  using (auth.uid() = user_id);

create policy "Users can insert own visit requests"
  on public.visit_requests for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.leads
      where leads.id = visit_requests.lead_id
        and leads.user_id = auth.uid()
    )
  );

create policy "Users can update own visit requests"
  on public.visit_requests for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own visit requests"
  on public.visit_requests for delete
  using (auth.uid() = user_id);

alter publication supabase_realtime add table public.visit_requests;
