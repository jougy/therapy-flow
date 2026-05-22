CREATE INDEX IF NOT EXISTS idx_agenda_events_auto_cancel_due
ON public.agenda_events (scheduled_for)
WHERE event_type = 'atendimento'
  AND patient_id IS NOT NULL
  AND status <> 'cancelado';

CREATE OR REPLACE FUNCTION public.finalize_overdue_agenda_events(
  _batch_size integer DEFAULT 500,
  _timezone text DEFAULT 'America/Sao_Paulo'
)
RETURNS TABLE(cancelled_count integer, deleted_event_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _safe_batch_size integer := LEAST(GREATEST(COALESCE(_batch_size, 500), 1), 5000);
  _today_start timestamptz;
BEGIN
  _today_start := date_trunc('day', timezone(_timezone, now())) AT TIME ZONE _timezone;

  RETURN QUERY
  WITH due_events AS (
    SELECT agenda_events.*
    FROM public.agenda_events
    WHERE agenda_events.event_type = 'atendimento'
      AND agenda_events.patient_id IS NOT NULL
      AND agenda_events.status <> 'cancelado'
      AND agenda_events.scheduled_for < _today_start
    ORDER BY agenda_events.scheduled_for ASC
    LIMIT _safe_batch_size
    FOR UPDATE SKIP LOCKED
  ),
  ensure_cancelled_groups AS (
    INSERT INTO public.patient_groups (
      user_id,
      patient_id,
      clinic_id,
      name,
      color,
      status,
      is_default,
      group_kind
    )
    SELECT DISTINCT
      due_events.user_id,
      due_events.patient_id,
      due_events.clinic_id,
      'Cancelados',
      'rose',
      'cancelado',
      false,
      'cancelados'
    FROM due_events
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.patient_groups
      WHERE patient_groups.patient_id = due_events.patient_id
        AND patient_groups.group_kind = 'cancelados'
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  ),
  cancelled_groups AS (
    SELECT patient_groups.patient_id, patient_groups.id
    FROM public.patient_groups
    JOIN due_events ON due_events.patient_id = patient_groups.patient_id
    WHERE patient_groups.group_kind = 'cancelados'
  ),
  inserted_sessions AS (
    INSERT INTO public.sessions (
      user_id,
      patient_id,
      group_id,
      session_date,
      status,
      anamnesis,
      treatment,
      pain_score,
      complexity_score,
      notes,
      clinic_id,
      provider_id,
      scheduled_start_at,
      patient_arrived_at,
      payment_status,
      amount_charged_cents,
      amount_paid_cents,
      amount_original_cents
    )
    SELECT
      due_events.user_id,
      due_events.patient_id,
      cancelled_groups.id,
      due_events.scheduled_for,
      'cancelado',
      '{}'::jsonb,
      '{}'::jsonb,
      0,
      0,
      'Atendimento cancelado automaticamente porque o agendamento passou do fim do dia sem intervenção do usuário.',
      due_events.clinic_id,
      due_events.user_id,
      due_events.scheduled_for,
      NULL,
      'nao_cobrado',
      0,
      0,
      0
    FROM due_events
    LEFT JOIN cancelled_groups ON cancelled_groups.patient_id = due_events.patient_id
    RETURNING id
  ),
  deleted_events AS (
    DELETE FROM public.agenda_events
    USING due_events
    WHERE agenda_events.id = due_events.id
    RETURNING agenda_events.id
  )
  SELECT
    (SELECT COUNT(*)::integer FROM inserted_sessions),
    (SELECT COUNT(*)::integer FROM deleted_events);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_overdue_agenda_events(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_overdue_agenda_events(integer, text) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      EXECUTE 'SELECT cron.unschedule(''finalize-overdue-agenda-events'')';
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;

    EXECUTE $cron$
      SELECT cron.schedule(
        'finalize-overdue-agenda-events',
        '5 0 * * *',
        $$SELECT public.finalize_overdue_agenda_events(1000, 'America/Sao_Paulo');$$
      )
    $cron$;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.finalize_overdue_agenda_events(integer, text)
IS 'Converte agendamentos de atendimento vencidos em atendimentos cancelados e remove os eventos da agenda em lotes seguros.';
