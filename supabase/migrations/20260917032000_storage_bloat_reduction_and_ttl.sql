-- Migration: 20260917032000_storage_bloat_reduction_and_ttl.sql
-- Description: Fase C do Plano de Execução:
--   1. Migra DEFAULT '{}'::jsonb para NULL em colunas opcionais, poupando cabeçalhos de tupla no Postgres.
--   2. Descarta índices isolados de baixíssima seletividade que gastam RAM e I/O de escrita.
--   3. Cria índice parcial cirúrgico idx_sessions_unpaid_partial.
--   4. Implementa RPC purge_old_app_notifications para retenção automática de notificações antigas.

-- ==============================================================================
-- 1. DESPERDÍCIO DE JSONB: DEFAULT NULL EM COLUNAS OPCIONAIS
-- ==============================================================================

ALTER TABLE public.sessions
  ALTER COLUMN anamnesis SET DEFAULT NULL,
  ALTER COLUMN treatment SET DEFAULT NULL,
  ALTER COLUMN anamnesis_form_response SET DEFAULT NULL;

ALTER TABLE public.profiles
  ALTER COLUMN address SET DEFAULT NULL,
  ALTER COLUMN specialties SET DEFAULT NULL;

-- ==============================================================================
-- 2. LIMPEZA DE ÍNDICES ISOLADOS DE BAIXA CARDINALIDADE (MENOS I/O E RAM)
-- ==============================================================================

DROP INDEX IF EXISTS public.idx_sessions_payment_status;
DROP INDEX IF EXISTS public.idx_sessions_payment_method;
DROP INDEX IF EXISTS public.idx_agenda_events_status;
DROP INDEX IF EXISTS public.idx_clinic_memberships_user_id;

-- Índice parcial cirúrgico para inadimplência / cobranças em aberto na clínica
CREATE INDEX IF NOT EXISTS idx_sessions_unpaid_partial
ON public.sessions(clinic_id, session_date DESC)
WHERE payment_status IN ('pendente', 'parcial') AND deleted_at IS NULL;

-- ==============================================================================
-- 3. ROTINA DE TTL / PURGE AUTOMÁTICO EM NOTIFICAÇÕES ANTIGAS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.purge_old_app_notifications(_retention_days integer DEFAULT 60)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _deleted_count integer := 0;
BEGIN
  DELETE FROM public.app_notifications
  WHERE (read_at IS NOT NULL OR dismissed_at IS NOT NULL)
    AND created_at < (now() - (_retention_days || ' days')::interval);

  GET DIAGNOSTICS _deleted_count = ROW_COUNT;
  RETURN _deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_old_app_notifications(integer) TO authenticated, service_role;
