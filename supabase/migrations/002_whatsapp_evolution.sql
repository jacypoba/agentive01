-- WhatsApp / Evolution API support
-- Run after 001_initial_schema.sql

-- Normalized phone for fast lead lookup by WhatsApp number
alter table public.leads
  add column if not exists phone_normalized text;

update public.leads
set phone_normalized = regexp_replace(phone, '\D', '', 'g')
where phone is not null
  and phone_normalized is null;

create index if not exists leads_user_phone_normalized_idx
  on public.leads (user_id, phone_normalized);

-- Enable Supabase Realtime for live dashboard updates
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.leads;
