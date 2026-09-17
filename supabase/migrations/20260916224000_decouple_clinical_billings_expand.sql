-- Migration: 20260916224000_decouple_clinical_billings_expand.sql
-- Description: Fase 2 (Expand & Contract) do Plano Diretor de Banco de Dados:
--   1. Cria a tabela public.clinical_session_billings para separar o faturamento do prontuário médico.
--   2. Padroniza todos os valores monetários em bigint (centavos).
--   3. Implementa backfill seguro de dados financeiros históricos da tabela public.sessions.
--   4. Implementa triggers de sincronização bidirecional (dual-write) para garantir zero downtime no client.
--   5. Adiciona trigger transacional atômico para used_sessions em public.patient_payment_plans.

-- ==============================================================================
-- 1. CRIAR TABELA clinical_session_billings
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.clinical_session_billings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE RESTRICT,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  amount_charged_cents bigint NOT NULL DEFAULT 0 CHECK (amount_charged_cents >= 0),
  amount_paid_cents bigint NOT NULL DEFAULT 0 CHECK (amount_paid_cents >= 0),
  amount_original_cents bigint NOT NULL DEFAULT 0 CHECK (amount_original_cents >= 0),
  payment_status text NOT NULL DEFAULT 'nao_cobrado' CHECK (payment_status IN ('nao_cobrado', 'pendente', 'parcial', 'pago', 'credito', 'cortesia')),
  payment_method text NOT NULL DEFAULT 'nao_informado' CHECK (payment_method IN ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'convenio', 'transferencia', 'credito_usado', 'cortesia', 'nao_informado')),
  payment_installments smallint NOT NULL DEFAULT 1 CHECK (payment_installments >= 1 AND payment_installments <= 12),
  payment_adjustment_reason text CHECK (payment_adjustment_reason IS NULL OR char_length(payment_adjustment_reason) <= 240),
  payment_status_date date,
  payment_plan_id uuid REFERENCES public.patient_payment_plans(id) ON DELETE SET NULL,
  payment_plan_session_index integer CHECK (payment_plan_session_index IS NULL OR payment_plan_session_index >= 1),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinical_session_billings_session_unique UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_clinical_session_billings_clinic_id ON public.clinical_session_billings(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinical_session_billings_patient_id ON public.clinical_session_billings(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_session_billings_payment_status ON public.clinical_session_billings(payment_status);
CREATE INDEX IF NOT EXISTS idx_clinical_session_billings_payment_plan_id ON public.clinical_session_billings(payment_plan_id);

ALTER TABLE public.clinical_session_billings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users read clinic session billings" ON public.clinical_session_billings;
CREATE POLICY "Users read clinic session billings" ON public.clinical_session_billings
FOR SELECT TO authenticated
USING (
  (clinic_id IS NULL AND session_id IN (SELECT id FROM public.sessions WHERE user_id = auth.uid()))
  OR (
    clinic_id = public.get_user_clinic_id(auth.uid())
    AND (
      public.current_user_can('treasury.read', clinic_id)
      OR public.current_user_can('sessions.read', clinic_id)
    )
  )
);

DROP POLICY IF EXISTS "Users manage clinic session billings" ON public.clinical_session_billings;
CREATE POLICY "Users manage clinic session billings" ON public.clinical_session_billings
FOR ALL TO authenticated
USING (
  (clinic_id IS NULL AND session_id IN (SELECT id FROM public.sessions WHERE user_id = auth.uid()))
  OR (
    clinic_id = public.get_user_clinic_id(auth.uid())
    AND (
      public.current_user_can('treasury.manage', clinic_id)
      OR public.current_user_can('sessions.write', clinic_id)
    )
  )
)
WITH CHECK (
  (clinic_id IS NULL AND session_id IN (SELECT id FROM public.sessions WHERE user_id = auth.uid()))
  OR (
    clinic_id = public.get_user_clinic_id(auth.uid())
    AND (
      public.current_user_can('treasury.manage', clinic_id)
      OR public.current_user_can('sessions.write', clinic_id)
    )
  )
);

-- ==============================================================================
-- 2. BACKFILL HISTÓRICO SEGURO DE SESSIONS PARA clinical_session_billings
-- ==============================================================================

INSERT INTO public.clinical_session_billings (
  session_id,
  clinic_id,
  patient_id,
  amount_charged_cents,
  amount_paid_cents,
  amount_original_cents,
  payment_status,
  payment_method,
  payment_installments,
  payment_adjustment_reason,
  payment_status_date,
  payment_plan_id,
  payment_plan_session_index,
  created_at,
  updated_at
)
SELECT
  s.id,
  s.clinic_id,
  s.patient_id,
  COALESCE(s.amount_charged_cents, 0)::bigint,
  COALESCE(s.amount_paid_cents, 0)::bigint,
  COALESCE(s.amount_original_cents, 0)::bigint,
  COALESCE(s.payment_status, 'nao_cobrado'),
  COALESCE(s.payment_method, 'nao_informado'),
  COALESCE(s.payment_installments, 1),
  s.payment_adjustment_reason,
  s.payment_status_date,
  s.payment_plan_id,
  s.payment_plan_session_index,
  s.created_at,
  s.updated_at
FROM public.sessions s
ON CONFLICT (session_id) DO UPDATE SET
  amount_charged_cents = EXCLUDED.amount_charged_cents,
  amount_paid_cents = EXCLUDED.amount_paid_cents,
  amount_original_cents = EXCLUDED.amount_original_cents,
  payment_status = EXCLUDED.payment_status,
  payment_method = EXCLUDED.payment_method,
  payment_installments = EXCLUDED.payment_installments,
  payment_adjustment_reason = EXCLUDED.payment_adjustment_reason,
  payment_status_date = EXCLUDED.payment_status_date,
  payment_plan_id = EXCLUDED.payment_plan_id,
  payment_plan_session_index = EXCLUDED.payment_plan_session_index,
  updated_at = EXCLUDED.updated_at;

-- ==============================================================================
-- 3. DUAL-WRITE SYNCHRONIZATION TRIGGER (TRANSITION LAYER)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.sync_session_to_billing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.clinical_session_billings (
    session_id,
    clinic_id,
    patient_id,
    amount_charged_cents,
    amount_paid_cents,
    amount_original_cents,
    payment_status,
    payment_method,
    payment_installments,
    payment_adjustment_reason,
    payment_status_date,
    payment_plan_id,
    payment_plan_session_index,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.clinic_id,
    NEW.patient_id,
    COALESCE(NEW.amount_charged_cents, 0)::bigint,
    COALESCE(NEW.amount_paid_cents, 0)::bigint,
    COALESCE(NEW.amount_original_cents, 0)::bigint,
    COALESCE(NEW.payment_status, 'nao_cobrado'),
    COALESCE(NEW.payment_method, 'nao_informado'),
    COALESCE(NEW.payment_installments, 1),
    NEW.payment_adjustment_reason,
    NEW.payment_status_date,
    NEW.payment_plan_id,
    NEW.payment_plan_session_index,
    now()
  )
  ON CONFLICT (session_id) DO UPDATE SET
    clinic_id = EXCLUDED.clinic_id,
    patient_id = EXCLUDED.patient_id,
    amount_charged_cents = EXCLUDED.amount_charged_cents,
    amount_paid_cents = EXCLUDED.amount_paid_cents,
    amount_original_cents = EXCLUDED.amount_original_cents,
    payment_status = EXCLUDED.payment_status,
    payment_method = EXCLUDED.payment_method,
    payment_installments = EXCLUDED.payment_installments,
    payment_adjustment_reason = EXCLUDED.payment_adjustment_reason,
    payment_status_date = EXCLUDED.payment_status_date,
    payment_plan_id = EXCLUDED.payment_plan_id,
    payment_plan_session_index = EXCLUDED.payment_plan_session_index,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_session_to_billing ON public.sessions;
CREATE TRIGGER trg_sync_session_to_billing
AFTER INSERT OR UPDATE OF amount_charged_cents, amount_paid_cents, amount_original_cents,
                         payment_status, payment_method, payment_installments,
                         payment_adjustment_reason, payment_status_date,
                         payment_plan_id, payment_plan_session_index, clinic_id, patient_id
ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.sync_session_to_billing();

-- ==============================================================================
-- 4. ATOMIC TRIGGER FOR used_sessions ON patient_payment_plans
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.sync_payment_plan_used_sessions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _plan_id uuid;
BEGIN
  _plan_id := COALESCE(NEW.payment_plan_id, OLD.payment_plan_id);

  IF _plan_id IS NOT NULL THEN
    UPDATE public.patient_payment_plans
    SET used_sessions = (
      SELECT COUNT(*)::integer
      FROM public.sessions
      WHERE payment_plan_id = _plan_id
        AND status <> 'cancelado'
        AND deleted_at IS NULL
    ),
    updated_at = now()
    WHERE id = _plan_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_payment_plan_used_sessions ON public.sessions;
CREATE TRIGGER trg_sync_payment_plan_used_sessions
AFTER INSERT OR UPDATE OF payment_plan_id, status, deleted_at OR DELETE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.sync_payment_plan_used_sessions();
