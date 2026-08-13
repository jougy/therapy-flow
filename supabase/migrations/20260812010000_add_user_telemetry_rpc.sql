-- Migration: Add User Specific Telemetry RPC for Backoffice
-- Date: 2026-08-12

CREATE OR REPLACE FUNCTION public.list_platform_user_telemetry_events(
  _user_id UUID,
  _limit INT DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  clinic_id UUID,
  user_id UUID,
  user_name TEXT,
  event_type TEXT,
  pathname TEXT,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Verify caller is platform owner
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Acesso negado. Apenas o Backoffice Master pode visualizar estatísticas individuais de usuários.';
  END IF;

  RETURN QUERY
  SELECT 
    t.id,
    t.clinic_id,
    t.user_id,
    t.user_name,
    t.event_type,
    t.pathname,
    t.resource_type,
    t.resource_id,
    t.metadata,
    t.created_at
  FROM public.telemetry_events t
  WHERE t.user_id = _user_id
  ORDER BY t.created_at DESC
  LIMIT LEAST(_limit, 500);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_platform_user_telemetry_events(UUID, INT) TO authenticated;
