-- Allow French as a lead preferred language (Language V3).

alter table public.leads
  drop constraint if exists leads_preferred_language_check;

alter table public.leads
  add constraint leads_preferred_language_check
  check (preferred_language in ('pt', 'en', 'it', 'es', 'fr'));
