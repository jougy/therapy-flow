-- Migration: 20260917031000_local_first_occ_and_batch_sync.sql
-- Description: Fase B do Plano de Execução:
--   1. Adiciona coluna version (OCC) em sessions, patients e agenda_events com trigger de auto-incremento.
--   2. Implementa RPC transacional atômica batch_sync_push para drenagem de mutações offline em transação ACID única.

-- ==============================================================================
-- 1. COLUNA VERSION & TRIGGERS DE OCC (OPTIMISTIC CONCURRENCY CONTROL)
-- ==============================================================================

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1 NOT NULL;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1 NOT NULL;

ALTER TABLE public.agenda_events
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1 NOT NULL;

CREATE OR REPLACE FUNCTION public.trg_increment_row_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 1) + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS increment_sessions_version ON public.sessions;
CREATE TRIGGER increment_sessions_version
BEFORE UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.trg_increment_row_version();

DROP TRIGGER IF EXISTS increment_patients_version ON public.patients;
CREATE TRIGGER increment_patients_version
BEFORE UPDATE ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.trg_increment_row_version();

DROP TRIGGER IF EXISTS increment_agenda_events_version ON public.agenda_events;
CREATE TRIGGER increment_agenda_events_version
BEFORE UPDATE ON public.agenda_events
FOR EACH ROW
EXECUTE FUNCTION public.trg_increment_row_version();

-- ==============================================================================
-- 2. RPC ATÔMICA batch_sync_push PARA LOCAL-FIRST
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.batch_sync_push(_mutations jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _item jsonb;
  _table text;
  _action text;
  _id uuid;
  _expected_version integer;
  _current_version integer;
  _data jsonb;
  _results jsonb := '[]'::jsonb;
  _user_id uuid := auth.uid();
  _applied_count integer := 0;
  _conflict_count integer := 0;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF _mutations IS NULL OR jsonb_typeof(_mutations) <> 'array' THEN
    RAISE EXCEPTION 'Payload inválido: array esperado.';
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_mutations)
  LOOP
    _table := _item->>'table';
    _action := _item->>'action'; -- 'upsert' ou 'delete'
    _id := (_item->>'id')::uuid;
    _expected_version := (_item->>'expected_version')::integer;
    _data := COALESCE(_item->'data', '{}'::jsonb);

    IF _table = 'sessions' THEN
      IF _action = 'delete' THEN
        UPDATE public.sessions
        SET deleted_at = now(), deleted_by_user_id = _user_id
        WHERE id = _id AND deleted_at IS NULL;

        _applied_count := _applied_count + 1;
        _results := _results || jsonb_build_object('id', _id, 'status', 'deleted');
      ELSE
        -- Checagem de versão concorrente
        SELECT version INTO _current_version FROM public.sessions WHERE id = _id;

        IF _current_version IS NOT NULL AND _expected_version IS NOT NULL AND _current_version > _expected_version THEN
          _conflict_count := _conflict_count + 1;
          _results := _results || jsonb_build_object('id', _id, 'status', 'conflict', 'server_version', _current_version);
        ELSE
          -- Executar update ou insert seguro
          IF _current_version IS NOT NULL THEN
            UPDATE public.sessions
            SET
              notes = COALESCE(_data->>'notes', notes),
              status = COALESCE(_data->>'status', status),
              pain_score = COALESCE((_data->>'pain_score')::integer, pain_score),
              anamnesis = CASE WHEN _data ? 'anamnesis' THEN _data->'anamnesis' ELSE anamnesis END,
              treatment = CASE WHEN _data ? 'treatment' THEN _data->'treatment' ELSE treatment END,
              updated_at = now()
            WHERE id = _id;
          ELSE
            INSERT INTO public.sessions (
              id,
              user_id,
              patient_id,
              clinic_id,
              session_date,
              notes,
              status,
              pain_score,
              anamnesis,
              treatment
            )
            VALUES (
              _id,
              _user_id,
              (_data->>'patient_id')::uuid,
              (_data->>'clinic_id')::uuid,
              COALESCE((_data->>'session_date')::timestamptz, now()),
              _data->>'notes',
              COALESCE(_data->>'status', 'rascunho'),
              COALESCE((_data->>'pain_score')::integer, 0),
              _data->'anamnesis',
              _data->'treatment'
            );
          END IF;

          _applied_count := _applied_count + 1;
          _results := _results || jsonb_build_object('id', _id, 'status', 'applied');
        END IF;
      END IF;

    ELSIF _table = 'agenda_events' THEN
      IF _action = 'delete' THEN
        DELETE FROM public.agenda_events WHERE id = _id;
        _applied_count := _applied_count + 1;
        _results := _results || jsonb_build_object('id', _id, 'status', 'deleted');
      ELSE
        SELECT version INTO _current_version FROM public.agenda_events WHERE id = _id;

        IF _current_version IS NOT NULL AND _expected_version IS NOT NULL AND _current_version > _expected_version THEN
          _conflict_count := _conflict_count + 1;
          _results := _results || jsonb_build_object('id', _id, 'status', 'conflict', 'server_version', _current_version);
        ELSE
          IF _current_version IS NOT NULL THEN
            UPDATE public.agenda_events
            SET
              title = COALESCE(_data->>'title', title),
              scheduled_for = COALESCE((_data->>'scheduled_for')::timestamptz, scheduled_for),
              status = COALESCE(_data->>'status', status),
              updated_at = now()
            WHERE id = _id;
          ELSE
            INSERT INTO public.agenda_events (
              id,
              user_id,
              clinic_id,
              patient_id,
              title,
              scheduled_for,
              event_type,
              status
            )
            VALUES (
              _id,
              _user_id,
              (_data->>'clinic_id')::uuid,
              (_data->>'patient_id')::uuid,
              COALESCE(_data->>'title', 'Consulta'),
              COALESCE((_data->>'scheduled_for')::timestamptz, now()),
              COALESCE(_data->>'event_type', 'atendimento'),
              COALESCE(_data->>'status', 'agendado')
            );
          END IF;

          _applied_count := _applied_count + 1;
          _results := _results || jsonb_build_object('id', _id, 'status', 'applied');
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'applied_count', _applied_count,
    'conflict_count', _conflict_count,
    'results', _results
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.batch_sync_push(jsonb) TO authenticated;
