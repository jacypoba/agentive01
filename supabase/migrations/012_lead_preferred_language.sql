-- Lead preferred language for multilingual WhatsApp AI

alter table public.leads
  add column if not exists preferred_language text
  check (preferred_language in ('pt', 'en', 'it', 'es'));

create index if not exists leads_preferred_language_idx
  on public.leads (preferred_language);
