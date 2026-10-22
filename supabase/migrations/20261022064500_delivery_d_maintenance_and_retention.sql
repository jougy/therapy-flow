-- Migration: 20261022064500_delivery_d_maintenance_and_retention.sql
-- Description: Entrega D - Higiene operacional, expurgo automatizado de logs e fixação de search_path

-- ==============================================================================
-- 1. ROTINA DE EXPURGO AUTOMÁTICO DE DADOS OPERACIONAIS E TELEMETRIA
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.purge_expired_operational_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    _purged_telemetry INT := 0;
    _purged_resolved_logs INT := 0;
BEGIN
    -- 1.1. Limpar telemetria com mais de 90 dias
    DELETE FROM public.telemetry_events
    WHERE created_at < (now() - INTERVAL '90 days');
    GET DIAGNOSTICS _purged_telemetry = ROW_COUNT;

    -- 1.2. Limpar logs de erro de plataforma resolvidos com mais de 30 dias
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'platform_error_logs'
    ) THEN
        DELETE FROM public.platform_error_logs
        WHERE resolved = true AND created_at < (now() - INTERVAL '30 days');
        GET DIAGNOSTICS _purged_resolved_logs = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'purged_telemetry_events', _purged_telemetry,
        'purged_resolved_logs', _purged_resolved_logs,
        'executed_at', now()
    );
END;
$$;

-- Restringir execução estritamente para service_role / cron
REVOKE ALL ON FUNCTION public.purge_expired_operational_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_operational_data() TO service_role;


-- ==============================================================================
-- 2. HARDENING FINAL DE search_path EM FUNÇÕES PÚBLICAS
-- ==============================================================================

DO $$
BEGIN
    -- Fixar search_path seguro nas funções apontadas pelo advisor
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_platform_owner') THEN
        ALTER FUNCTION public.is_platform_owner() SET search_path = public, pg_temp;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role' AND pronargs = 2) THEN
        ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public, pg_temp;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_clinic_id' AND pronargs = 1) THEN
        ALTER FUNCTION public.get_user_clinic_id(uuid) SET search_path = public, pg_temp;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'can_read_clinic_data' AND pronargs = 2) THEN
        ALTER FUNCTION public.can_read_clinic_data(uuid, uuid) SET search_path = public, pg_temp;
    END IF;
END $$;
