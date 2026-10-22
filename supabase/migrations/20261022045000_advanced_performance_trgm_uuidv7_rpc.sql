-- ==============================================================================
-- Migration: 5 Melhorias Avançadas de Performance (pg_trgm, UUIDv7, RLS e RPC)
-- Compatibilidade: PostgreSQL 17.6 (ARM64) / Supabase
-- Data: 2026-10-22
-- ==============================================================================

-- 1. Habilitação de pg_trgm e Índice GIN Parcial em patients(name)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_patients_name_trgm
ON public.patients USING gin (name gin_trgm_ops)
WHERE (deleted_at IS NULL);

-- 2. Gerador Nativo/Compatível de UUIDv7 (RFC 9562 - Monotonic Append-Only)
CREATE OR REPLACE FUNCTION public.generate_uuidv7()
RETURNS uuid
LANGUAGE plpgsql
PARALLEL SAFE
AS $$
DECLARE
  unix_time_ms bigint;
  uuid_bytes bytea;
BEGIN
  -- 48 bits de timestamp Unix em milissegundos
  unix_time_ms := (extract(epoch from clock_timestamp()) * 1000)::bigint;

  -- 16 bytes: 6 bytes tempo + 10 bytes aleatórios
  uuid_bytes := set_byte(
    set_byte(
      gen_random_bytes(16),
      0, (unix_time_ms >> 40)::int
    ),
    1, (unix_time_ms >> 32)::int
  );
  uuid_bytes := set_byte(uuid_bytes, 2, (unix_time_ms >> 24)::int);
  uuid_bytes := set_byte(uuid_bytes, 3, (unix_time_ms >> 16)::int);
  uuid_bytes := set_byte(uuid_bytes, 4, (unix_time_ms >> 8)::int);
  uuid_bytes := set_byte(uuid_bytes, 5, unix_time_ms::int);

  -- Versão 7 nos bits 48-51
  uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112);
  -- Variante RFC 4122/9562 nos bits 64-65
  uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128);

  RETURN encode(uuid_bytes, 'hex')::uuid;
END;
$$;

ALTER FUNCTION public.generate_uuidv7() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.generate_uuidv7() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_uuidv7() TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_uuidv7() TO anon;

-- 3. Aceleração de RLS: Marcação estrita como STABLE e PARALLEL SAFE
ALTER FUNCTION public.get_user_clinic_id(uuid) STABLE PARALLEL SAFE;
ALTER FUNCTION public.can_read_clinic_data(uuid) STABLE PARALLEL SAFE;

-- 4. RPC Transacional Atômica para Agendamentos
CREATE OR REPLACE FUNCTION public.schedule_patient_appointment(
  _clinic_id uuid,
  _patient_id uuid,
  _title text,
  _scheduled_for timestamptz,
  _duration_minutes integer DEFAULT 50,
  _event_type text DEFAULT 'atendimento',
  _status text DEFAULT 'confirmado'
)
RETURNS TABLE (
  id uuid,
  clinic_id uuid,
  patient_id uuid,
  title text,
  scheduled_for timestamptz,
  duration_minutes integer,
  status text,
  event_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  -- Validação de autenticação e contexto
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF NOT public.current_user_can('agenda.write', _clinic_id) THEN
    RAISE EXCEPTION 'Sem permissao para criar agendamentos nesta clinica.';
  END IF;

  -- Inserção atômica utilizando generate_uuidv7
  v_event_id := public.generate_uuidv7();

  INSERT INTO public.agenda_events (
    id,
    clinic_id,
    patient_id,
    user_id,
    title,
    scheduled_for,
    duration_minutes,
    status,
    event_type
  ) VALUES (
    v_event_id,
    _clinic_id,
    _patient_id,
    auth.uid(),
    trim(_title),
    _scheduled_for,
    COALESCE(_duration_minutes, 50),
    COALESCE(_status, 'confirmado'),
    COALESCE(_event_type, 'atendimento')
  );

  RETURN QUERY
  SELECT 
    ae.id,
    ae.clinic_id,
    ae.patient_id,
    ae.title,
    ae.scheduled_for,
    ae.duration_minutes,
    ae.status,
    ae.event_type
  FROM public.agenda_events ae
  WHERE ae.id = v_event_id;
END;
$$;

ALTER FUNCTION public.schedule_patient_appointment(uuid, uuid, text, timestamptz, integer, text, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.schedule_patient_appointment(uuid, uuid, text, timestamptz, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_patient_appointment(uuid, uuid, text, timestamptz, integer, text, text) TO service_role;
