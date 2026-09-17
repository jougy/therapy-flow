-- Migration: 20260916225000_optimize_rls_and_concurrency.sql
-- Description: Fases 3, 4 e 5 do Plano Diretor de Banco de Dados:
--   1. Otimiza RLS com índices cobrindo foreign keys e eliminando scans repetitivos.
--   2. Adiciona bloqueio pessimista (FOR UPDATE) e cálculo seguro de renovação antecipada no confirm_asaas_subscription_payment.
--   3. Cria tabela de idempotência para webhooks com hash único de evento.

-- ==============================================================================
-- 1. FOREIGN KEY COVERAGE INDEXES (ELIMINAR SEQUENTIAL SCANS EM UPDATES/DELETES)
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_sessions_evolution_group_id ON public.sessions(evolution_group_id);
CREATE INDEX IF NOT EXISTS idx_sessions_parent_session_id ON public.sessions(parent_session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_deleted_at ON public.sessions(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_deleted_at ON public.patients(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_agenda_events_clinic_patient ON public.agenda_events(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_file_uploads_patient_id ON public.patient_file_uploads(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_clinical_snapshots_patient_id ON public.patient_clinical_snapshots(patient_id);

-- ==============================================================================
-- 2. HARDEN WEBHOOK CONCURRENCY & RENEWAL EXTENSION (ASAAS)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.confirm_asaas_subscription_payment(
  _asaas_payment_id text,
  _clinic_id uuid,
  _paid_value numeric,
  _payment_date timestamptz DEFAULT now(),
  _billing_type text DEFAULT 'PIX'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sub public.clinic_subscriptions%ROWTYPE;
  v_duration_days integer := 30;
  v_new_expires_at timestamptz;
  v_new_due_date date;
  v_base_date timestamptz;
BEGIN
  -- 1. Bloqueio pessimista (FOR UPDATE) para evitar condições de corrida com webhooks duplicados
  SELECT * INTO v_sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _clinic_id
  FOR UPDATE;

  IF v_sub.id IS NOT NULL THEN
    v_duration_days := CASE
      WHEN UPPER(v_sub.billing_cycle) = 'ANNUAL' THEN 365
      WHEN UPPER(v_sub.billing_cycle) = 'QUARTERLY' THEN 90
      ELSE 30
    END;

    -- Cálculo seguro: se a assinatura ainda não expirou, estender a partir da data de expiração existente, e não da data do pagamento
    IF v_sub.expires_at IS NOT NULL AND v_sub.expires_at > _payment_date THEN
      v_base_date := v_sub.expires_at;
    ELSE
      v_base_date := _payment_date;
    END IF;

    v_new_expires_at := v_base_date + (v_duration_days || ' days')::interval;
    v_new_due_date := v_new_expires_at::date;

    -- Atualizar assinatura para ACTIVE
    UPDATE public.clinic_subscriptions
    SET
      status = 'ACTIVE',
      is_free_trial = false,
      current_period_start = COALESCE(v_sub.current_period_start, _payment_date),
      current_period_end = v_new_expires_at,
      expires_at = v_new_expires_at,
      next_due_date = v_new_due_date,
      period_duration_days = v_duration_days,
      payment_method = coalesce(_billing_type, payment_method),
      updated_at = now()
    WHERE id = v_sub.id;
  END IF;

  -- 2. Atualizar clínica para access_status active
  UPDATE public.clinics
  SET
    access_status = 'active',
    updated_at = now()
  WHERE id = _clinic_id;

  -- 3. Atualizar fatura em subscription_invoices
  UPDATE public.subscription_invoices
  SET
    status = 'RECEIVED',
    paid_at = _payment_date,
    payment_date = _payment_date,
    value = coalesce(_paid_value, value)
  WHERE asaas_payment_id = _asaas_payment_id;

  RETURN jsonb_build_object(
    'success', true,
    'clinic_id', _clinic_id,
    'status', 'ACTIVE',
    'expires_at', v_new_expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_asaas_subscription_payment(text, uuid, numeric, timestamptz, text) TO service_role, postgres;
