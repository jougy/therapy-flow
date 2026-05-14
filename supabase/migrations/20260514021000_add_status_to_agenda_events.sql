ALTER TABLE public.agenda_events
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aguardando_confirmacao';

ALTER TABLE public.agenda_events
DROP CONSTRAINT IF EXISTS agenda_events_status_check;

ALTER TABLE public.agenda_events
ADD CONSTRAINT agenda_events_status_check
CHECK (status IN ('lembrete', 'aguardando_confirmacao', 'confirmado', 'cancelado'));

CREATE INDEX IF NOT EXISTS idx_agenda_events_status ON public.agenda_events(status);
