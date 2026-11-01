-- ==============================================================================
-- Migration: 20261031163500_schedule_cache_and_atomic_booking.sql
-- Descrição:
-- 1. RPC public.rpc_get_available_slots(_clinic_id uuid, _provider_id uuid, _date date):
--    Consulta horários vagos (08:00 às 20:00, slots de 30 min) verificando conflito
--    com agenda_events e sessions para a data e profissional informados.
-- 2. RPC public.rpc_book_appointment_atomic(...):
--    Executa reserva atômica com pessimistic lock (SELECT FOR UPDATE) prevenindo
--    duplo agendamento concorrente e insere em agenda_events + sessions ('rascunho').
-- ==============================================================================

-- 1. RPC: rpc_get_available_slots
CREATE OR REPLACE FUNCTION public.rpc_get_available_slots(
  _clinic_id uuid,
  _provider_id uuid,
  _date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _slot_time text;
  _slot_start timestamptz;
  _slot_end timestamptz;
  _is_occupied boolean;
  _slots text[] := ARRAY[]::text[];
  _all_slots text[] := ARRAY[
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'
  ];
BEGIN
  IF _clinic_id IS NULL OR _date IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  FOREACH _slot_time IN ARRAY _all_slots
  LOOP
    -- Converte data + horário em timestamptz no timezone da clínica/São Paulo
    _slot_start := (_date::text || ' ' || _slot_time || ':00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
    _slot_end := _slot_start + interval '30 minutes';

    -- Verifica se já há evento ou sessão ocupando este slot
    SELECT EXISTS (
      -- Checa agenda_events
      SELECT 1
      FROM public.agenda_events ae
      WHERE ae.clinic_id = _clinic_id
        AND (_provider_id IS NULL OR ae.user_id = _provider_id)
        AND ae.status NOT IN ('cancelado')
        AND ae.scheduled_for < _slot_end
        AND (ae.scheduled_for + (COALESCE(ae.duration_minutes, 60) * interval '1 minute')) > _slot_start

      UNION ALL

      -- Checa sessions ativas
      SELECT 1
      FROM public.sessions s
      WHERE s.clinic_id = _clinic_id
        AND (_provider_id IS NULL OR COALESCE(s.provider_id, s.user_id) = _provider_id)
        AND s.deleted_at IS NULL
        AND s.status NOT IN ('cancelada')
        AND COALESCE(s.scheduled_start_at, s.session_date) < _slot_end
        AND (COALESCE(s.scheduled_start_at, s.session_date) + interval '30 minutes') > _slot_start
    ) INTO _is_occupied;

    IF NOT _is_occupied THEN
      _slots := array_append(_slots, _slot_time);
    END IF;
  END LOOP;

  RETURN to_jsonb(_slots);
END;
$$;

COMMENT ON FUNCTION public.rpc_get_available_slots(uuid, uuid, date) IS
'Retorna os slots de horários vagos para uma clínica e profissional em determinada data.';

REVOKE ALL ON FUNCTION public.rpc_get_available_slots(uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_available_slots(uuid, uuid, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_available_slots(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_available_slots(uuid, uuid, date) TO anon;

-- 2. RPC: rpc_book_appointment_atomic
CREATE OR REPLACE FUNCTION public.rpc_book_appointment_atomic(
  _clinic_id uuid,
  _provider_id uuid,
  _patient_id uuid DEFAULT NULL,
  _start_time timestamptz DEFAULT NULL,
  _end_time timestamptz DEFAULT NULL,
  _event_type text DEFAULT 'atendimento',
  _title text DEFAULT 'Atendimento',
  _notes text DEFAULT NULL,
  _duration_minutes integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _resolved_duration integer;
  _calculated_end timestamptz;
  _has_conflict boolean;
  _new_event_id uuid;
  _new_session_id uuid;
  _event_row record;
BEGIN
  IF _clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_REQUIRED: O identificador da clínica é obrigatório.';
  END IF;

  IF _provider_id IS NULL THEN
    RAISE EXCEPTION 'PROVIDER_REQUIRED: O profissional é obrigatório.';
  END IF;

  IF _start_time IS NULL THEN
    RAISE EXCEPTION 'START_TIME_REQUIRED: O horário de início é obrigatório.';
  END IF;

  _resolved_duration := COALESCE(
    _duration_minutes,
    CASE
      WHEN _end_time IS NOT NULL AND _end_time > _start_time THEN
        EXTRACT(EPOCH FROM (_end_time - _start_time))::integer / 60
      ELSE 60
    END
  );

  IF _resolved_duration <= 0 OR _resolved_duration > 1440 THEN
    _resolved_duration := 60;
  END IF;

  _calculated_end := COALESCE(_end_time, _start_time + (_resolved_duration * interval '1 minute'));

  -- Pessimistic Lock & Concurrency Check:
  -- Bloqueia eventos existentes no intervalo para serializar transações concorrentes
  PERFORM 1
  FROM public.agenda_events ae
  WHERE ae.clinic_id = _clinic_id
    AND ae.user_id = _provider_id
    AND ae.status NOT IN ('cancelado')
    AND ae.scheduled_for < _calculated_end
    AND (ae.scheduled_for + (COALESCE(ae.duration_minutes, 60) * interval '1 minute')) > _start_time
  FOR UPDATE;

  -- Verifica se houve conflito
  SELECT EXISTS (
    SELECT 1
    FROM public.agenda_events ae
    WHERE ae.clinic_id = _clinic_id
      AND ae.user_id = _provider_id
      AND ae.status NOT IN ('cancelado')
      AND ae.scheduled_for < _calculated_end
      AND (ae.scheduled_for + (COALESCE(ae.duration_minutes, 60) * interval '1 minute')) > _start_time
  ) INTO _has_conflict;

  IF _has_conflict THEN
    RAISE EXCEPTION 'SLOT_ALREADY_BOOKED: O horário solicitado já foi reservado por outro atendimento.';
  END IF;

  -- 1. Insere o registro em agenda_events
  INSERT INTO public.agenda_events (
    clinic_id,
    user_id,
    patient_id,
    event_type,
    title,
    scheduled_for,
    duration_minutes,
    status
  )
  VALUES (
    _clinic_id,
    _provider_id,
    _patient_id,
    COALESCE(_event_type, 'atendimento'),
    COALESCE(NULLIF(trim(_title), ''), 'Atendimento'),
    _start_time,
    _resolved_duration,
    'confirmado'
  )
  RETURNING id INTO _new_event_id;

  -- 2. Se for do tipo atendimento com paciente, cria sessão complementar em status 'rascunho'
  IF _event_type = 'atendimento' AND _patient_id IS NOT NULL THEN
    INSERT INTO public.sessions (
      clinic_id,
      user_id,
      provider_id,
      patient_id,
      scheduled_start_at,
      session_date,
      status,
      notes
    )
    VALUES (
      _clinic_id,
      _provider_id,
      _provider_id,
      _patient_id,
      _start_time,
      _start_time,
      'rascunho',
      _notes
    )
    RETURNING id INTO _new_session_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', _new_event_id,
    'session_id', _new_session_id,
    'scheduled_for', _start_time,
    'duration_minutes', _resolved_duration
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_book_appointment_atomic(uuid, uuid, uuid, timestamptz, timestamptz, text, text, text, integer) IS
'Reserva atômica de agendamento com trava pessimista para prevenção de concorrência e duplo agendamento.';

REVOKE ALL ON FUNCTION public.rpc_book_appointment_atomic(uuid, uuid, uuid, timestamptz, timestamptz, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_book_appointment_atomic(uuid, uuid, uuid, timestamptz, timestamptz, text, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_book_appointment_atomic(uuid, uuid, uuid, timestamptz, timestamptz, text, text, text, integer) TO authenticated;
