-- Persistent inbound WhatsApp / Evolution webhook heartbeat (singleton row)
-- Run after 015_billing_foundation.sql

create table if not exists public.whatsapp_webhook_heartbeat (
  id text primary key,
  last_webhook_received_at timestamptz,
  last_message_id text,
  last_phone text,
  last_event text,
  last_error text,
  last_http_status integer,
  updated_at timestamptz not null default now()
);

insert into public.whatsapp_webhook_heartbeat (id)
values ('global')
on conflict (id) do nothing;

alter table public.whatsapp_webhook_heartbeat enable row level security;

-- Service role only (debug routes and webhooks use admin client).
