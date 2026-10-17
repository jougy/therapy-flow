-- Migration: Permite status 'concluido' em agenda_events
ALTER TABLE public.agenda_events
DROP CONSTRAINT IF EXISTS agenda_events_status_check;

ALTER TABLE public.agenda_events
ADD CONSTRAINT agenda_events_status_check
CHECK (status IN ('lembrete', 'aguardando_confirmacao', 'confirmado', 'cancelado', 'concluido'));
