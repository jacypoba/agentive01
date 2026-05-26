-- Lead qualification fields extracted from WhatsApp conversations
-- Run after 003_whatsapp_message_dedup.sql

alter table public.leads
  add column if not exists budget text,
  add column if not exists preferred_area text,
  add column if not exists property_type text,
  add column if not exists timeline text,
  add column if not exists intent_status text default 'unknown',
  add column if not exists visit_requested boolean not null default false,
  add column if not exists visit_datetime_text text;

create index if not exists leads_intent_status_idx on public.leads (intent_status);
create index if not exists leads_visit_requested_idx on public.leads (visit_requested);
