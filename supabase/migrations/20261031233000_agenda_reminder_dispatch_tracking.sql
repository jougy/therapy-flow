-- ==============================================================================
-- Migration: 20261031233000_agenda_reminder_dispatch_tracking.sql
-- Descrição:
-- Adiciona tracking de lembretes enviados em agenda_events para evitar duplicidade:
-- - reminder_dispatches: array jsonb de lembretes já enviados [{ key, sent_at, channel, recipient }]
-- - last_reminder_dispatched_at: timestamp do último lembrete disparado
-- ==============================================================================

ALTER TABLE public.agenda_events
  ADD COLUMN IF NOT EXISTS reminder_dispatches jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS last_reminder_dispatched_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.agenda_events.reminder_dispatches IS
'Histórico estruturado de lembretes já disparados (ex: 24h, 2h, imediato) para prevenir disparos duplicados.';

COMMENT ON COLUMN public.agenda_events.last_reminder_dispatched_at IS
'Timestamp do último lembrete disparado com sucesso via WhatsApp/SMS.';

-- Índice cobrindo status ativo e scheduled_for para performance do cron de lembretes
CREATE INDEX IF NOT EXISTS idx_agenda_events_reminder_poll
  ON public.agenda_events (scheduled_for, status)
  WHERE status IN ('confirmado', 'agendado', 'aguardando_confirmacao');
