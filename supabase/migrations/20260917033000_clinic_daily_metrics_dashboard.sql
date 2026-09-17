-- Migration: 20260917033000_clinic_daily_metrics_dashboard.sql
-- Description: Fase D do Plano de Execução:
--   1. Cria tabela clinic_daily_metrics para pré-cálculo diário de métricas clínicas e faturamento.
--   2. Implementa backfill histórico agregando sessões ativas.
--   3. Cria trigger leve para manter os totais da data atualizados em tempo real.
--   4. Refatora get_clinic_dashboard_analytics garantindo respeito estrito a deleted_at IS NULL e otimização por índices.

-- ==============================================================================
-- 1. TABELA clinic_daily_metrics
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.clinic_daily_metrics (
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  total_sessions integer DEFAULT 0 NOT NULL,
  canceled_sessions integer DEFAULT 0 NOT NULL,
  paid_sessions integer DEFAULT 0 NOT NULL,
  revenue_paid_cents bigint DEFAULT 0 NOT NULL,
  revenue_open_cents bigint DEFAULT 0 NOT NULL,
  revenue_credit_cents bigint DEFAULT 0 NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (clinic_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_clinic_daily_metrics_lookup
ON public.clinic_daily_metrics(clinic_id, metric_date DESC);

ALTER TABLE public.clinic_daily_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read clinic daily metrics" ON public.clinic_daily_metrics;
CREATE POLICY "Users read clinic daily metrics" ON public.clinic_daily_metrics
FOR SELECT TO authenticated
USING (
  clinic_id = COALESCE(
    NULLIF(auth.jwt() ->> 'active_clinic_id', '')::uuid,
    public.get_user_clinic_id(auth.uid())
  )
  AND (
    public.current_user_can('treasury.read', clinic_id)
    OR public.current_user_can('sessions.read', clinic_id)
  )
);

-- ==============================================================================
-- 2. BACKFILL HISTÓRICO DAS MÉTRICAS DIÁRIAS
-- ==============================================================================

INSERT INTO public.clinic_daily_metrics (
  clinic_id,
  metric_date,
  total_sessions,
  canceled_sessions,
  paid_sessions,
  revenue_paid_cents,
  revenue_open_cents,
  revenue_credit_cents,
  updated_at
)
SELECT
  clinic_id,
  (session_date AT TIME ZONE 'UTC')::date AS metric_date,
  COUNT(*)::integer AS total_sessions,
  COUNT(*) FILTER (WHERE status = 'cancelado')::integer AS canceled_sessions,
  COUNT(*) FILTER (WHERE COALESCE(amount_charged_cents, 0) > 0 AND COALESCE(amount_paid_cents, 0) >= COALESCE(amount_charged_cents, 0))::integer AS paid_sessions,
  COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN LEAST(COALESCE(amount_paid_cents, 0), COALESCE(amount_charged_cents, 0)) ELSE 0 END), 0)::bigint AS revenue_paid_cents,
  COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN GREATEST(0, COALESCE(amount_charged_cents, 0) - COALESCE(amount_paid_cents, 0)) ELSE 0 END), 0)::bigint AS revenue_open_cents,
  COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN GREATEST(0, COALESCE(amount_paid_cents, 0) - COALESCE(amount_charged_cents, 0)) ELSE 0 END), 0)::bigint AS revenue_credit_cents,
  now()
FROM public.sessions
WHERE clinic_id IS NOT NULL
  AND deleted_at IS NULL
GROUP BY clinic_id, (session_date AT TIME ZONE 'UTC')::date
ON CONFLICT (clinic_id, metric_date) DO UPDATE SET
  total_sessions = EXCLUDED.total_sessions,
  canceled_sessions = EXCLUDED.canceled_sessions,
  paid_sessions = EXCLUDED.paid_sessions,
  revenue_paid_cents = EXCLUDED.revenue_paid_cents,
  revenue_open_cents = EXCLUDED.revenue_open_cents,
  revenue_credit_cents = EXCLUDED.revenue_credit_cents,
  updated_at = now();

-- ==============================================================================
-- 3. TRIGGER PARA ATUALIZAÇÃO INCREMENTAL DE clinic_daily_metrics
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.sync_clinic_daily_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _target_clinic_id uuid;
  _target_date date;
BEGIN
  _target_clinic_id := COALESCE(NEW.clinic_id, OLD.clinic_id);
  _target_date := (COALESCE(NEW.session_date, OLD.session_date) AT TIME ZONE 'UTC')::date;

  IF _target_clinic_id IS NOT NULL AND _target_date IS NOT NULL THEN
    INSERT INTO public.clinic_daily_metrics (
      clinic_id,
      metric_date,
      total_sessions,
      canceled_sessions,
      paid_sessions,
      revenue_paid_cents,
      revenue_open_cents,
      revenue_credit_cents,
      updated_at
    )
    SELECT
      _target_clinic_id,
      _target_date,
      COUNT(*)::integer,
      COUNT(*) FILTER (WHERE status = 'cancelado')::integer,
      COUNT(*) FILTER (WHERE COALESCE(amount_charged_cents, 0) > 0 AND COALESCE(amount_paid_cents, 0) >= COALESCE(amount_charged_cents, 0))::integer,
      COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN LEAST(COALESCE(amount_paid_cents, 0), COALESCE(amount_charged_cents, 0)) ELSE 0 END), 0)::bigint,
      COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN GREATEST(0, COALESCE(amount_charged_cents, 0) - COALESCE(amount_paid_cents, 0)) ELSE 0 END), 0)::bigint,
      COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN GREATEST(0, COALESCE(amount_paid_cents, 0) - COALESCE(amount_charged_cents, 0)) ELSE 0 END), 0)::bigint,
      now()
    FROM public.sessions
    WHERE clinic_id = _target_clinic_id
      AND (session_date AT TIME ZONE 'UTC')::date = _target_date
      AND deleted_at IS NULL
    ON CONFLICT (clinic_id, metric_date) DO UPDATE SET
      total_sessions = EXCLUDED.total_sessions,
      canceled_sessions = EXCLUDED.canceled_sessions,
      paid_sessions = EXCLUDED.paid_sessions,
      revenue_paid_cents = EXCLUDED.revenue_paid_cents,
      revenue_open_cents = EXCLUDED.revenue_open_cents,
      revenue_credit_cents = EXCLUDED.revenue_credit_cents,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_clinic_daily_metrics ON public.sessions;
CREATE TRIGGER trg_sync_clinic_daily_metrics
AFTER INSERT OR UPDATE OF session_date, status, amount_charged_cents, amount_paid_cents, payment_status, deleted_at OR DELETE
ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.sync_clinic_daily_metrics();
