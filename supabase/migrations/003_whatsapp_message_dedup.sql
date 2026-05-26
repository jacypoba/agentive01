-- Idempotent WhatsApp webhook processing (prevents duplicate AI replies)
-- Run after 002_whatsapp_evolution.sql

create table if not exists public.processed_whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  message_id text not null,
  instance text not null,
  remote_jid text,
  created_at timestamptz not null default now(),
  constraint processed_whatsapp_messages_unique unique (message_id, instance)
);

create index if not exists processed_whatsapp_messages_created_at_idx
  on public.processed_whatsapp_messages (created_at desc);

-- Service role only — no RLS policies (admin client bypasses RLS)
