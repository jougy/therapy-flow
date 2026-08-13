-- Migration: Telemetry Retention & Cleanup RPC for Supabase Free Tier Optimization
-- Date: 2026-08-12

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
SET search_path = public, auth
AS $$
DECLARE
  v_deleted_page_views BIGINT := 0;
  v_deleted_security_events BIGINT := 0;
BEGIN
  -- Verify caller is platform owner
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Acesso negado. Apenas o Backoffice Master pode executar a limpeza de telemetria.';
  END IF;

  -- Delete routine page_views older than retention limit
  WITH deleted_pv AS (
    DELETE FROM public.telemetry_events
    WHERE event_type = 'page_view'
      AND created_at < now() - (_page_view_retention_days || ' days')::INTERVAL
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_page_views FROM deleted_pv;

  -- Delete security events older than security retention limit
  WITH deleted_sec AS (
    DELETE FROM public.telemetry_events
    WHERE event_type IN ('print_screen', 'document_print', 'export_pdf')
      AND created_at < now() - (_security_event_retention_days || ' days')::INTERVAL
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_security_events FROM deleted_sec;

  RETURN QUERY SELECT v_deleted_page_views, v_deleted_security_events;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_telemetry_events(INT, INT) TO authenticated;
