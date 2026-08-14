-- Migration: Idempotent Summary Telemetry & Client Rate Limiting / Anti-Spam
-- Date: 2026-08-12

CREATE TABLE IF NOT EXISTS public.user_telemetry_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL DEFAULT CURRENT_DATE,
  user_name TEXT,
  page_views_count INT NOT NULL DEFAULT 0,
  prints_detected_count INT NOT NULL DEFAULT 0,
  docs_printed_count INT NOT NULL DEFAULT 0,
  pdf_exported_count INT NOT NULL DEFAULT 0,
  dwell_time_seconds INT NOT NULL DEFAULT 0,
  top_routes JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_spam_flagged BOOLEAN NOT NULL DEFAULT false,
  spam_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_telemetry_summary_unique UNIQUE (user_id, clinic_id, summary_date)
);

-- Enable RLS
ALTER TABLE public.user_telemetry_summaries ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to upsert their own summary row
DROP POLICY IF EXISTS "Users can upsert own summary row" ON public.user_telemetry_summaries;
CREATE POLICY "Users can upsert own summary row"
  ON public.user_telemetry_summaries
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow Platform Owners to read all summaries
DROP POLICY IF EXISTS "Platform owners can view all summaries" ON public.user_telemetry_summaries;
CREATE POLICY "Platform owners can view all summaries"
  ON public.user_telemetry_summaries
  FOR SELECT
  TO authenticated
  USING (public.is_platform_owner());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_telemetry_summaries_date ON public.user_telemetry_summaries(summary_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_telemetry_summaries_user ON public.user_telemetry_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_user_telemetry_summaries_clinic ON public.user_telemetry_summaries(clinic_id);
CREATE INDEX IF NOT EXISTS idx_user_telemetry_summaries_spam ON public.user_telemetry_summaries(is_spam_flagged) WHERE is_spam_flagged = true;

-- RPC for Upserting Summary (Idempotent PUT)
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
SET search_path = public, auth
AS $$
BEGIN
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
    auth.uid(),
    _clinic_id,
    CURRENT_DATE,
    _user_name,
    GREATEST(0, _page_views),
    GREATEST(0, _prints_detected),
    GREATEST(0, _docs_printed),
    GREATEST(0, _pdf_exported),
    GREATEST(0, _dwell_seconds),
    COALESCE(_top_routes, '{}'::jsonb),
    _is_spam_flagged,
    _spam_reason,
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
    top_routes = COALESCE(user_telemetry_summaries.top_routes, '{}'::jsonb) || EXCLUDED.top_routes,
    is_spam_flagged = user_telemetry_summaries.is_spam_flagged OR EXCLUDED.is_spam_flagged,
    spam_reason = COALESCE(EXCLUDED.spam_reason, user_telemetry_summaries.spam_reason),
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_user_telemetry_summary TO authenticated;
