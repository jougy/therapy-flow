-- Migration: Add duration_minutes to agenda_events (Expand and Contract safe)
-- Default: 60 minutes, Check: 1 min to 1440 min (24 hours)

ALTER TABLE public.agenda_events
ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 60;

ALTER TABLE public.agenda_events
DROP CONSTRAINT IF EXISTS agenda_events_duration_minutes_check;

ALTER TABLE public.agenda_events
ADD CONSTRAINT agenda_events_duration_minutes_check
CHECK (duration_minutes > 0 AND duration_minutes <= 1440);

COMMENT ON COLUMN public.agenda_events.duration_minutes IS 'Duração do evento na agenda em minutos (padrão 60 min, máximo 24h/1440 min).';
