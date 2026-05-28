-- Stripe billing foundation (workspace-scoped subscriptions)
-- Run after 014_workspaces_provision_grant.sql
-- Safe to re-run where noted.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  plan_name text not null default 'starter',
  subscription_status text not null default 'trialing',
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_workspace_id_unique unique (workspace_id),
  constraint subscriptions_stripe_subscription_id_unique unique (stripe_subscription_id),
  constraint subscriptions_plan_name_check check (
    plan_name in ('starter', 'pro', 'enterprise')
  ),
  constraint subscriptions_status_check check (
    subscription_status in (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'unpaid',
      'paused'
    )
  )
);

create index if not exists subscriptions_user_id_idx
  on public.subscriptions (user_id);

create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists subscriptions_stripe_subscription_id_idx
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_workspace_member" on public.subscriptions;
create policy "subscriptions_select_workspace_member"
  on public.subscriptions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = subscriptions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

grant select on public.subscriptions to authenticated;

-- Webhooks and server actions use the service role for writes.
