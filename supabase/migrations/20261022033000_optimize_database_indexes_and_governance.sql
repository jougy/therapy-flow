-- ==============================================================================
-- Migration: Modernização, Indexação Avançada e Otimização do Banco de Dados
-- Arquitetura: Pluri-Health (Therapy-Flow)
-- Data: 2026-10-22
-- Objetivo:
--   1. Purificar a RPC get_user_active_governance (tornando-a STABLE e removendo UPDATE em leitura)
--   2. Criar Covering Indexes (INCLUDE) e Partial Indexes para acelerar queries frequentes e RLS
--   3. Ajustar Autovacuum em tabelas de alto churn para mitigar table bloat e economizar Disk IO
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Purificação da Função de Leitura de Governança
-- ------------------------------------------------------------------------------

-- Rotina dedicada para expiração de punições (assíncrona / sob demanda)
CREATE OR REPLACE FUNCTION public.expire_outdated_user_punishments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.user_punishments up
  SET is_active = false
  WHERE up.is_active = true
    AND up.expires_at IS NOT NULL
    AND up.expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

ALTER FUNCTION public.expire_outdated_user_punishments() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.expire_outdated_user_punishments() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_outdated_user_punishments() TO authenticated;

-- Função de leitura de governança estritamente declarativa e STABLE (sem UPDATE oculto)
CREATE OR REPLACE FUNCTION public.get_user_active_governance(_user_id uuid)
RETURNS TABLE(
  punishment_id uuid,
  punishment_type text,
  applied_at timestamptz,
  expires_at timestamptz,
  reason text,
  is_manual boolean,
  applied_by_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT 
    p.id AS punishment_id,
    p.punishment_type,
    p.applied_at,
    p.expires_at,
    p.reason,
    p.is_manual,
    COALESCE(prof.full_name, prof.email, 'Sistema Automático') AS applied_by_name
  FROM public.user_punishments p
  LEFT JOIN public.profiles prof ON prof.id = p.applied_by
  WHERE p.user_id = _user_id
    AND p.is_active = true
    AND (p.expires_at IS NULL OR p.expires_at > now());
$$;

ALTER FUNCTION public.get_user_active_governance(uuid) OWNER TO postgres;
GRANT ALL ON FUNCTION public.get_user_active_governance(uuid) TO service_role;
GRANT ALL ON FUNCTION public.get_user_active_governance(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_active_governance(uuid) TO anon;

-- Agendar expiração periódica diária caso pg_cron esteja instalado
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      EXECUTE 'SELECT cron.unschedule(''expire-outdated-user-punishments'')';
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;

    BEGIN
      PERFORM cron.schedule(
        'expire-outdated-user-punishments',
        '0 3 * * *',
        'SELECT public.expire_outdated_user_punishments();'
      );
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Índices Parciais e Covering Indexes (INCLUDE)
-- ------------------------------------------------------------------------------

-- 2.1 Agenda Events: Cobrindo visualização ativa por clínica e período (Index-Only Scan)
CREATE INDEX IF NOT EXISTS idx_agenda_events_covering_active
ON public.agenda_events (clinic_id, scheduled_for)
INCLUDE (id, title, event_type, status, patient_id, duration_minutes)
WHERE (status <> 'cancelado');

-- 2.2 Pacientes Ativos: Cobrindo listagens e contagem de cotas sem Heap Fetch
CREATE INDEX IF NOT EXISTS idx_patients_active_clinic_covering
ON public.patients (clinic_id, name)
INCLUDE (id, patient_code, status, updated_at)
WHERE (deleted_at IS NULL);

-- 2.3 RLS Acceleration: Subqueries de clinic_memberships no RLS
CREATE INDEX IF NOT EXISTS idx_clinic_memberships_user_clinic_covering
ON public.clinic_memberships (user_id, clinic_id)
INCLUDE (operational_role, role_key, is_active, membership_status)
WHERE (is_active = true);

-- 2.4 Session Shares: Checagem de RLS de compartilhamentos vigentes
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_shares_active_unique
ON public.session_shares (session_id, shared_with_user_id)
WHERE (revoked_at IS NULL);

-- 2.5 User Punishments: Aceleração da nova query STABLE de governança
CREATE INDEX IF NOT EXISTS idx_user_punishments_user_active_covering
ON public.user_punishments (user_id, is_active)
INCLUDE (punishment_type, applied_at, expires_at, reason, is_manual, applied_by)
WHERE (is_active = true);

-- ------------------------------------------------------------------------------
-- 3. Autovacuum Tuning para Tabelas de Alta Escrita
-- ------------------------------------------------------------------------------
ALTER TABLE public.agenda_events SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 500,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE public.sessions SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 500,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE public.clinic_memberships SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 200,
  autovacuum_analyze_scale_factor = 0.02
);
