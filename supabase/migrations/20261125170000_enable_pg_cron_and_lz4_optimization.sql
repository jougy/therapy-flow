-- Migration: 20261125170000_enable_pg_cron_and_lz4_optimization.sql
-- Description:
--   1. Habilita a extensão pg_cron no Postgres para rotinas puramente SQL ($0, 0 msgs QStash).
--   2. Agenda as 4 rotinas SQL de manutenção + limpeza de tokens efêmeros expirados.
--   3. Estende compressão LZ4 para colunas JSONB densas de webhooks, formulários, auditoria e fluxos.

-- ==============================================================================
-- 1. HABILITAR pg_cron E AGENDAR ROTINAS SQL INTERNAS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE OR REPLACE FUNCTION public.purge_expired_ephemeral_tokens()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _purged_mfa INT := 0;
  _purged_invites INT := 0;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mfa_recovery_challenges'
  ) THEN
    DELETE FROM public.mfa_recovery_challenges
    WHERE created_at < (now() - INTERVAL '24 hours');
    GET DIAGNOSTICS _purged_mfa = ROW_COUNT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clinic_collaborator_invitations'
  ) THEN
    DELETE FROM public.clinic_collaborator_invitations
    WHERE status IN ('expired', 'revoked')
      AND expires_at < (now() - INTERVAL '30 days');
    GET DIAGNOSTICS _purged_invites = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'purged_mfa_challenges', _purged_mfa,
    'purged_expired_invitations', _purged_invites,
    'executed_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_ephemeral_tokens() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_ephemeral_tokens() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- 1.1 Finalizar agendamentos vencidos (diário 03:05 UTC = 00:05 BRT)
    BEGIN
      PERFORM cron.unschedule('finalize-overdue-agenda-events');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'finalize-overdue-agenda-events',
      '5 3 * * *',
      $job$SELECT public.finalize_overdue_agenda_events(1000, 'America/Sao_Paulo');$job$
    );

    -- 1.2 Expirar punições vencidas (diário 06:00 UTC = 03:00 BRT)
    BEGIN
      PERFORM cron.unschedule('expire-outdated-user-punishments');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'expire-outdated-user-punishments',
      '0 6 * * *',
      $job$SELECT public.expire_outdated_user_punishments();$job$
    );

    -- 1.3 Limpar tokens efêmeros expirados (diário 06:15 UTC)
    BEGIN
      PERFORM cron.unschedule('purge-expired-ephemeral-tokens');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'purge-expired-ephemeral-tokens',
      '15 6 * * *',
      $job$SELECT public.purge_expired_ephemeral_tokens();$job$
    );

    -- 1.4 Expurgar lixeira clínica > 30 dias (semanal domingo 23:59 UTC)
    BEGIN
      PERFORM cron.unschedule('purge-clinic-trash-bin-sunday');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'purge-clinic-trash-bin-sunday',
      '59 23 * * 0',
      $job$SELECT public.purge_clinic_trash_bin();$job$
    );

    -- 1.5 Expurgar dados operacionais antigos (semanal domingo 23:50 UTC)
    BEGIN
      PERFORM cron.unschedule('purge-expired-operational-data');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'purge-expired-operational-data',
      '50 23 * * 0',
      $job$SELECT public.purge_expired_operational_data();$job$
    );
  END IF;
END;
$$;

-- ==============================================================================
-- 2. COMPRESSÃO LZ4 EM COLUNAS JSONB VOLUMOSAS (POSTGRES 14+)
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.asaas_webhook_events ALTER COLUMN payload SET COMPRESSION lz4;
    ALTER TABLE public.anamnesis_form_templates ALTER COLUMN schema SET COMPRESSION lz4;
    ALTER TABLE public.platform_audit_events ALTER COLUMN metadata SET COMPRESSION lz4;
    ALTER TABLE public.marketing_flows ALTER COLUMN graph_nodes SET COMPRESSION lz4;
    ALTER TABLE public.marketing_flows ALTER COLUMN graph_edges SET COMPRESSION lz4;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Compressao lz4 parcial/ignorada: %', SQLERRM;
  END;
END;
$$;
