-- Pending property offer memory for city-fallback acceptance (Conversation State V1)
alter table public.leads
  add column if not exists pending_property_offer jsonb;

comment on column public.leads.pending_property_offer is
  'Active city-fallback offer awaiting client acceptance; cleared or completed after listings sent';
