-- Migration: Create Telemetry Events Table & RPC for Backoffice Audit & Statistics
-- Date: 2026-08-12

CREATE TABLE IF NOT EXISTS public.telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  event_type TEXT NOT NULL, -- 'print_screen', 'document_print', 'page_view', 'export_pdf'
  pathname TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to record telemetry events
DROP POLICY IF EXISTS "Authenticated users can insert telemetry events" ON public.telemetry_events;
CREATE POLICY "Authenticated users can insert telemetry events"
  ON public.telemetry_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow Platform Owners to read telemetry events
DROP POLICY IF EXISTS "Platform owners can view all telemetry events" ON public.telemetry_events;
CREATE POLICY "Platform owners can view all telemetry events"
  ON public.telemetry_events
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_owner()
  );

-- Indexes for fast querying in Backoffice
CREATE INDEX IF NOT EXISTS idx_telemetry_events_clinic ON public.telemetry_events(clinic_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_user ON public.telemetry_events(user_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_event_type ON public.telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_created_at ON public.telemetry_events(created_at DESC);

-- RPC for Backoffice to fetch telemetry events for a clinic
CREATE OR REPLACE FUNCTION public.list_platform_telemetry_events(
  _clinic_id UUID,
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
    RAISE EXCEPTION 'Acesso negado. Apenas o Backoffice Master pode visualizar eventos de telemetria.';
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
  WHERE t.clinic_id = _clinic_id
  ORDER BY t.created_at DESC
  LIMIT LEAST(_limit, 500);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_platform_telemetry_events(UUID, INT) TO authenticated;
