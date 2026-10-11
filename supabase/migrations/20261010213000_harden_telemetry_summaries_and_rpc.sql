-- Migration: Harden Telemetry Summaries and RPC Idempotency
-- Date: 2026-10-10

-- 1. Ensure unique constraint handles NULL clinic_id properly (Postgres 15+ NULLS NOT DISTINCT)
DO $$
BEGIN
  ALTER TABLE public.user_telemetry_summaries DROP CONSTRAINT IF EXISTS user_telemetry_summary_unique;
  ALTER TABLE public.user_telemetry_summaries ADD CONSTRAINT user_telemetry_summary_unique UNIQUE NULLS NOT DISTINCT (user_id, clinic_id, summary_date);
EXCEPTION WHEN OTHERS THEN
  -- Fallback if NULLS NOT DISTINCT is already present or unsupported
  RAISE NOTICE 'Constraint migration notice: %', SQLERRM;
END $$;

-- 2. Enhanced idempotent RPC with graceful unauthenticated handling and deep route aggregation
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
  _spam_reason TEXT DEFAULT NULL
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

GRANT EXECUTE ON FUNCTION public.upsert_user_telemetry_summary(UUID, TEXT, INT, INT, INT, INT, INT, JSONB, BOOLEAN, TEXT) TO authenticated;
