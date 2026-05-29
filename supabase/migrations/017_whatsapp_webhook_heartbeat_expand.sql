-- Expand WhatsApp webhook heartbeat for inbound/outbound reliability diagnostics.
-- Safe to run when 016 was never applied or only partially applied.

create table if not exists public.whatsapp_webhook_heartbeat (
  id text primary key,
  instance text,
  last_webhook_received_at timestamptz,
  last_message_id text,
  last_remote_jid text,
  last_phone text,
  last_direction text,
  last_processing_status text,
  last_error text,
  last_response_body text,
  last_evolution_message_id text,
  last_delivery_key text,
  last_delivery_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_webhook_heartbeat add column if not exists instance text;
alter table public.whatsapp_webhook_heartbeat add column if not exists last_remote_jid text;
alter table public.whatsapp_webhook_heartbeat add column if not exists last_direction text;
alter table public.whatsapp_webhook_heartbeat add column if not exists last_processing_status text;
alter table public.whatsapp_webhook_heartbeat add column if not exists last_response_body text;
alter table public.whatsapp_webhook_heartbeat add column if not exists last_evolution_message_id text;
alter table public.whatsapp_webhook_heartbeat add column if not exists last_delivery_key text;
alter table public.whatsapp_webhook_heartbeat add column if not exists last_delivery_status text;
alter table public.whatsapp_webhook_heartbeat add column if not exists created_at timestamptz default now();

update public.whatsapp_webhook_heartbeat
set created_at = coalesce(updated_at, now())
where created_at is null;

alter table public.whatsapp_webhook_heartbeat
  alter column created_at set default now();

alter table public.whatsapp_webhook_heartbeat
  alter column updated_at set default now();

-- Migrate legacy singleton row from 016.
update public.whatsapp_webhook_heartbeat
set
  id = 'inbound',
  last_direction = coalesce(last_direction, 'inbound')
where id = 'global';

insert into public.whatsapp_webhook_heartbeat (id, last_direction)
values ('inbound', 'inbound')
on conflict (id) do nothing;

insert into public.whatsapp_webhook_heartbeat (id, last_direction)
values ('outbound', 'outbound')
on conflict (id) do nothing;

alter table public.whatsapp_webhook_heartbeat enable row level security;
