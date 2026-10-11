-- Migration: Add Error Logs and Extended Telemetry Metrics
-- Date: 2026-10-10 22:45:00

-- 1. Helper function for platform admin verification if not existing
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins
    WHERE platform_admins.user_id = _user_id
      AND platform_admins.is_active = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated, service_role;

-- 2. Add extended telemetry metrics columns to user_telemetry_summaries
ALTER TABLE public.user_telemetry_summaries
  ADD COLUMN IF NOT EXISTS clinical_records_saved_count INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS forms_completed_count INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS upgrade_views_count INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS form_validation_errors_count INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS recent_errors JSONB DEFAULT '[]'::jsonb NOT NULL;

-- 3. Create platform_error_logs audit table
CREATE TABLE IF NOT EXISTS public.platform_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
  error_type TEXT NOT NULL,
  scope TEXT,
  message TEXT NOT NULL,
  stack_trace TEXT,
  context JSONB DEFAULT '{}'::jsonb NOT NULL,
  route TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.platform_error_logs OWNER TO postgres;

-- Indexes for platform_error_logs
CREATE INDEX IF NOT EXISTS idx_platform_error_logs_created_at ON public.platform_error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_error_logs_error_type ON public.platform_error_logs (error_type);
CREATE INDEX IF NOT EXISTS idx_platform_error_logs_clinic_id ON public.platform_error_logs (clinic_id);
CREATE INDEX IF NOT EXISTS idx_platform_error_logs_user_id ON public.platform_error_logs (user_id);

-- RLS for platform_error_logs
ALTER TABLE public.platform_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can view platform error logs" ON public.platform_error_logs;
CREATE POLICY "Platform admins can view platform error logs"
  ON public.platform_error_logs
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_platform_owner(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert error logs" ON public.platform_error_logs;
CREATE POLICY "Authenticated users can insert error logs"
  ON public.platform_error_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Anon can insert error logs" ON public.platform_error_logs;
CREATE POLICY "Anon can insert error logs"
  ON public.platform_error_logs
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

GRANT ALL ON TABLE public.platform_error_logs TO service_role;
GRANT SELECT, INSERT ON TABLE public.platform_error_logs TO authenticated;
GRANT INSERT ON TABLE public.platform_error_logs TO anon;

-- 4. Secure RPC to log platform errors from client / backend
CREATE OR REPLACE FUNCTION public.log_platform_error(
  _error_type TEXT,
  _message TEXT,
  _scope TEXT DEFAULT NULL,
  _stack_trace TEXT DEFAULT NULL,
  _context JSONB DEFAULT '{}'::jsonb,
  _route TEXT DEFAULT NULL,
  _clinic_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_log_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  IF _message IS NULL OR trim(_message) = '' THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.platform_error_logs (
    user_id,
    clinic_id,
    error_type,
    scope,
    message,
    stack_trace,
    context,
    route,
    created_at
  ) VALUES (
    v_user_id,
    _clinic_id,
    COALESCE(NULLIF(trim(_error_type), ''), 'runtime_error'),
    NULLIF(trim(_scope), ''),
    trim(_message),
    NULLIF(trim(_stack_trace), ''),
    COALESCE(_context, '{}'::jsonb),
    NULLIF(trim(_route), ''),
    now()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_platform_error(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_platform_error(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, UUID) TO authenticated, anon, service_role;

-- 5. Drop previous signature of upsert_user_telemetry_summary to avoid function overloading
DROP FUNCTION IF EXISTS public.upsert_user_telemetry_summary(UUID, TEXT, INT, INT, INT, INT, INT, JSONB, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.upsert_user_telemetry_summary(UUID, TEXT, INT, INT, INT, INT, INT, JSONB, BOOLEAN, TEXT, INT, INT, INT, INT, JSONB);

-- Recreate upsert_user_telemetry_summary with extended parameters and idempotent aggregation
CREATE OR REPLACE FUNCTION public.upsert_user_telemetry_summary(
  _clinic_id UUID,
  _user_name TEXT,
  _page_views INT,
  _prints_detected INT,
  _docs_printed INT,
  _pdf_exported INT,
  _dwell_seconds INT,
  _top_routes JSONB,
  _is_spam_flagged BOOLEAN DEFAULT false,
  _spam_reason TEXT DEFAULT NULL,
  _clinical_records_saved INT DEFAULT 0,
  _forms_completed INT DEFAULT 0,
  _upgrade_views INT DEFAULT 0,
  _form_validation_errors INT DEFAULT 0,
  _recent_errors JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_clean_user_name TEXT := COALESCE(NULLIF(trim(_user_name), ''), 'Usuário');
  v_clean_spam_reason TEXT := NULLIF(trim(_spam_reason), '');
BEGIN
  -- Safe guard: If session is unauthenticated (e.g. race condition during logout/session teardown), return gracefully
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_telemetry_summaries (
    user_id,
    clinic_id,
    summary_date,
    user_name,
    page_views_count,
    prints_detected_count,
    docs_printed_count,
    pdf_exported_count,
    dwell_time_seconds,
    top_routes,
    is_spam_flagged,
    spam_reason,
    clinical_records_saved_count,
    forms_completed_count,
    upgrade_views_count,
    form_validation_errors_count,
    recent_errors,
    updated_at
  )
  VALUES (
    v_user_id,
    _clinic_id,
    CURRENT_DATE,
    v_clean_user_name,
    GREATEST(0, COALESCE(_page_views, 0)),
    GREATEST(0, COALESCE(_prints_detected, 0)),
    GREATEST(0, COALESCE(_docs_printed, 0)),
    GREATEST(0, COALESCE(_pdf_exported, 0)),
    GREATEST(0, COALESCE(_dwell_seconds, 0)),
    COALESCE(_top_routes, '{}'::jsonb),
    COALESCE(_is_spam_flagged, false),
    LEFT(v_clean_spam_reason, 500),
    GREATEST(0, COALESCE(_clinical_records_saved, 0)),
    GREATEST(0, COALESCE(_forms_completed, 0)),
    GREATEST(0, COALESCE(_upgrade_views, 0)),
    GREATEST(0, COALESCE(_form_validation_errors, 0)),
    COALESCE(_recent_errors, '[]'::jsonb),
    now()
  )
  ON CONFLICT (user_id, clinic_id, summary_date)
  DO UPDATE SET
    user_name = EXCLUDED.user_name,
    page_views_count = user_telemetry_summaries.page_views_count + EXCLUDED.page_views_count,
    prints_detected_count = user_telemetry_summaries.prints_detected_count + EXCLUDED.prints_detected_count,
    docs_printed_count = user_telemetry_summaries.docs_printed_count + EXCLUDED.docs_printed_count,
    pdf_exported_count = user_telemetry_summaries.pdf_exported_count + EXCLUDED.pdf_exported_count,
    dwell_time_seconds = user_telemetry_summaries.dwell_time_seconds + EXCLUDED.dwell_time_seconds,
    clinical_records_saved_count = user_telemetry_summaries.clinical_records_saved_count + EXCLUDED.clinical_records_saved_count,
    forms_completed_count = user_telemetry_summaries.forms_completed_count + EXCLUDED.forms_completed_count,
    upgrade_views_count = user_telemetry_summaries.upgrade_views_count + EXCLUDED.upgrade_views_count,
    form_validation_errors_count = user_telemetry_summaries.form_validation_errors_count + EXCLUDED.form_validation_errors_count,
    recent_errors = (
      SELECT COALESCE(jsonb_agg(err_elem), '[]'::jsonb)
      FROM (
        SELECT elem AS err_elem
        FROM jsonb_array_elements(
          COALESCE(user_telemetry_summaries.recent_errors, '[]'::jsonb) ||
          COALESCE(EXCLUDED.recent_errors, '[]'::jsonb)
        ) AS elem
        ORDER BY (elem->>'timestamp') DESC NULLS LAST
        LIMIT 20
      ) sub
    ),
    top_routes = (
      SELECT COALESCE(
        jsonb_object_agg(key, sum_val),
        '{}'::jsonb
      )
      FROM (
        SELECT key, sum(value::numeric)::int AS sum_val
        FROM (
          SELECT key, value FROM jsonb_each_text(COALESCE(user_telemetry_summaries.top_routes, '{}'::jsonb))
          UNION ALL
          SELECT key, value FROM jsonb_each_text(COALESCE(EXCLUDED.top_routes, '{}'::jsonb))
        ) combined
        WHERE value ~ '^-?[0-9]+$'
        GROUP BY key
      ) summed
    ),
    is_spam_flagged = user_telemetry_summaries.is_spam_flagged OR EXCLUDED.is_spam_flagged,
    spam_reason = COALESCE(EXCLUDED.spam_reason, user_telemetry_summaries.spam_reason),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_user_telemetry_summary(UUID, TEXT, INT, INT, INT, INT, INT, JSONB, BOOLEAN, TEXT, INT, INT, INT, INT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_user_telemetry_summary(UUID, TEXT, INT, INT, INT, INT, INT, JSONB, BOOLEAN, TEXT, INT, INT, INT, INT, JSONB) TO authenticated, service_role;

-- 6. RPC to list platform error logs for Backoffice
CREATE OR REPLACE FUNCTION public.list_platform_error_logs(
  _limit INT DEFAULT 100,
  _error_type TEXT DEFAULT NULL,
  _search TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  clinic_id UUID,
  clinic_name TEXT,
  error_type TEXT,
  scope TEXT,
  message TEXT,
  stack_trace TEXT,
  context JSONB,
  route TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT
    l.id,
    l.user_id,
    p.full_name AS user_name,
    p.email AS user_email,
    l.clinic_id,
    c.name AS clinic_name,
    l.error_type,
    l.scope,
    l.message,
    l.stack_trace,
    l.context,
    l.route,
    l.created_at
  FROM public.platform_error_logs l
  LEFT JOIN public.profiles p ON p.id = l.user_id
  LEFT JOIN public.clinics c ON c.id = l.clinic_id
  WHERE (public.is_platform_admin(auth.uid()) OR public.is_platform_owner(auth.uid()))
    AND (_error_type IS NULL OR _error_type = '' OR l.error_type = _error_type)
    AND (
      _search IS NULL
      OR _search = ''
      OR l.message ILIKE ('%' || _search || '%')
      OR l.scope ILIKE ('%' || _search || '%')
      OR l.route ILIKE ('%' || _search || '%')
      OR coalesce(p.full_name, '') ILIKE ('%' || _search || '%')
      OR coalesce(p.email, '') ILIKE ('%' || _search || '%')
      OR coalesce(c.name, '') ILIKE ('%' || _search || '%')
    )
  ORDER BY l.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 100), 1), 500);
$$;

REVOKE ALL ON FUNCTION public.list_platform_error_logs(INT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_platform_error_logs(INT, TEXT, TEXT) TO authenticated, service_role;
