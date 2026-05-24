-- Agentive01 initial schema
-- Run in Supabase Dashboard → SQL Editor, or via Supabase CLI.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_name text not null,
  phone text,
  interest text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  message text not null,
  sender text not null check (sender in ('client', 'ai', 'agent')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index leads_user_id_idx on public.leads (user_id);
create index leads_status_idx on public.leads (status);
create index leads_created_at_idx on public.leads (created_at desc);
create index conversations_lead_id_idx on public.conversations (lead_id);
create index conversations_created_at_idx on public.conversations (created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.conversations enable row level security;

-- Profiles: users can read and update their own row
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Leads: users can only access their own leads
create policy "Users can view own leads"
  on public.leads for select
  using (auth.uid() = user_id);

create policy "Users can insert own leads"
  on public.leads for insert
  with check (auth.uid() = user_id);

create policy "Users can update own leads"
  on public.leads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own leads"
  on public.leads for delete
  using (auth.uid() = user_id);

-- Conversations: users can access conversations for their own leads
create policy "Users can view own conversations"
  on public.conversations for select
  using (
    exists (
      select 1 from public.leads
      where leads.id = conversations.lead_id
        and leads.user_id = auth.uid()
    )
  );

create policy "Users can insert own conversations"
  on public.conversations for insert
  with check (
    exists (
      select 1 from public.leads
      where leads.id = conversations.lead_id
        and leads.user_id = auth.uid()
    )
  );

create policy "Users can update own conversations"
  on public.conversations for update
  using (
    exists (
      select 1 from public.leads
      where leads.id = conversations.lead_id
        and leads.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.leads
      where leads.id = conversations.lead_id
        and leads.user_id = auth.uid()
    )
  );

create policy "Users can delete own conversations"
  on public.conversations for delete
  using (
    exists (
      select 1 from public.leads
      where leads.id = conversations.lead_id
        and leads.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
