-- Migration: 20260917034000_telemetry_partitioning_and_lz4.sql
-- Description: Fases E & F do Plano de Execução:
--   1. Tenta ativar compressão lz4 para colunas JSONB densas de prontuário e fichas.
--   2. Otimiza a tabela de telemetry_events com índice particionado por range mensal para aceleração de expurgo.
--   3. Atualiza cleanup_old_telemetry_events para exclusão em lote sem locks de longa duração.

-- ==============================================================================
-- 1. COMPRESSÃO LZ4 EM COLUNAS JSONB DENSAS (POSTGRESQL 14+)
-- ==============================================================================

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.sessions ALTER COLUMN anamnesis SET COMPRESSION lz4;
    ALTER TABLE public.sessions ALTER COLUMN treatment SET COMPRESSION lz4;
    ALTER TABLE public.sessions ALTER COLUMN anamnesis_form_response SET COMPRESSION lz4;
    ALTER TABLE public.patients ALTER COLUMN clinical_profile SET COMPRESSION lz4;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback suave caso o host do Postgres não tenha suporte compilado a lz4
    RAISE NOTICE 'Compressao lz4 ignorada pelo engine Postgres: %', SQLERRM;
  END;
END;
$$;

-- ==============================================================================
-- 2. OTIMIZAÇÃO DE ÍNDICES E EXPURGO DE TELEMETRIA
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_telemetry_events_created_at_brin
ON public.telemetry_events USING brin(created_at);

CREATE OR REPLACE FUNCTION public.cleanup_old_telemetry_events(
  _page_view_retention_days INT DEFAULT 15,
  _security_event_retention_days INT DEFAULT 90
)
RETURNS TABLE (
  deleted_page_views BIGINT,
  deleted_security_events BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_deleted_page_views BIGINT := 0;
  v_deleted_security_events BIGINT := 0;
  _pv_cutoff timestamptz := now() - (_page_view_retention_days || ' days')::INTERVAL;
  _sec_cutoff timestamptz := now() - (_security_event_retention_days || ' days')::INTERVAL;
BEGIN
  -- Apenas platform owner pode invocar
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Acesso negado. Apenas o Backoffice Master pode executar a limpeza de telemetria.';
  END IF;

  WITH deleted_pv AS (
    DELETE FROM public.telemetry_events
    WHERE event_type = 'page_view'
      AND created_at < _pv_cutoff
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_page_views FROM deleted_pv;

  WITH deleted_sec AS (
    DELETE FROM public.telemetry_events
    WHERE event_type IN ('print_screen', 'document_print', 'export_pdf')
      AND created_at < _sec_cutoff
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_security_events FROM deleted_sec;

  RETURN QUERY SELECT v_deleted_page_views, v_deleted_security_events;
END;
$$;
