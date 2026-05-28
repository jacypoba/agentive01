-- Google Calendar integration for visit scheduling

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS google_refresh_token text,
  ADD COLUMN IF NOT EXISTS google_access_token text,
  ADD COLUMN IF NOT EXISTS google_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_calendar_id text DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS google_calendar_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS calendar_work_start time DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS calendar_work_end time DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS calendar_visit_duration_minutes integer DEFAULT 60;

ALTER TABLE public.visit_requests
  ADD COLUMN IF NOT EXISTS property_title text,
  ADD COLUMN IF NOT EXISTS scheduled_start timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_end timestamptz,
  ADD COLUMN IF NOT EXISTS google_calendar_event_id text;

CREATE INDEX IF NOT EXISTS visit_requests_scheduled_start_idx
  ON public.visit_requests (user_id, scheduled_start)
  WHERE scheduled_start IS NOT NULL;

CREATE INDEX IF NOT EXISTS visit_requests_google_event_idx
  ON public.visit_requests (google_calendar_event_id)
  WHERE google_calendar_event_id IS NOT NULL;
