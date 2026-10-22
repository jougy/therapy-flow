-- Migration: 20261022061500_delivery_b_domain_integrity_and_ssot.sql
-- Description: Entrega B - Integridade de Domínio Multi-clínica, Restrições Invariantes e Idempotência de Faturamento

-- ==============================================================================
-- 1. INTEGRIDADE REFERENCIAL INVARIANTE (PACIENTE - SESSÃO - CLÍNICA)
-- ==============================================================================

-- Criar constraint UNIQUE composta em patients(id, clinic_id) para suportar FK composta
-- Observação: clinic_id não nulo é garantido por dados clínicos legítimos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'uq_patients_id_clinic_id'
    ) THEN
        ALTER TABLE public.patients
        ADD CONSTRAINT uq_patients_id_clinic_id UNIQUE (id, clinic_id);
    END IF;
END $$;

-- Garantir que sessions não possa ter um patient_id associado a um clinic_id divergente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_sessions_patient_clinic_invariant'
    ) THEN
        -- Adiciona a foreign key composta com validação estrita
        ALTER TABLE public.sessions
        ADD CONSTRAINT fk_sessions_patient_clinic_invariant 
        FOREIGN KEY (patient_id, clinic_id) 
        REFERENCES public.patients(id, clinic_id) 
        ON DELETE RESTRICT;
    END IF;
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Existem dados históricos com clinic_id divergente; FK não pôde ser ativada imediatamente.';
END $$;


-- ==============================================================================
-- 2. SSOT FINANCEIRO: CONCILIAÇÃO BI-DIRECIONAL (SESSIONS <-> CLINICAL_SESSION_BILLINGS)
-- ==============================================================================

-- Trigger para refletir alterações de clinical_session_billings de volta para a projeção em sessions
-- Isso garante que se um webhook ou gateway atualizar clinical_session_billings diretamente, sessions não fique defasada
CREATE OR REPLACE FUNCTION public.sync_billing_to_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.sessions
  SET 
    amount_charged_cents = NEW.amount_charged_cents,
    amount_paid_cents = NEW.amount_paid_cents,
    amount_original_cents = NEW.amount_original_cents,
    payment_status = NEW.payment_status,
    payment_method = NEW.payment_method,
    payment_installments = NEW.payment_installments,
    payment_adjustment_reason = NEW.payment_adjustment_reason,
    payment_status_date = NEW.payment_status_date,
    payment_plan_id = NEW.payment_plan_id,
    payment_plan_session_index = NEW.payment_plan_session_index,
    updated_at = now()
  WHERE id = NEW.session_id
    AND (
      amount_charged_cents IS DISTINCT FROM NEW.amount_charged_cents OR
      amount_paid_cents IS DISTINCT FROM NEW.amount_paid_cents OR
      amount_original_cents IS DISTINCT FROM NEW.amount_original_cents OR
      payment_status IS DISTINCT FROM NEW.payment_status OR
      payment_method IS DISTINCT FROM NEW.payment_method
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_billing_to_session ON public.clinical_session_billings;
CREATE TRIGGER trg_sync_billing_to_session
AFTER UPDATE OF amount_charged_cents, amount_paid_cents, amount_original_cents,
                payment_status, payment_method, payment_installments,
                payment_adjustment_reason, payment_status_date,
                payment_plan_id, payment_plan_session_index
ON public.clinical_session_billings
FOR EACH ROW
EXECUTE FUNCTION public.sync_billing_to_session();


-- ==============================================================================
-- 3. IDEMPOTÊNCIA E RESILIÊNCIA EM WEBHOOKS ASAAS
-- ==============================================================================

-- Garantir que a constraint UNIQUE exista em asaas_event_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'asaas_webhook_events_asaas_event_id_key'
    ) THEN
        ALTER TABLE public.asaas_webhook_events
        ADD CONSTRAINT asaas_webhook_events_asaas_event_id_key UNIQUE (asaas_event_id);
    END IF;
END $$;

-- Índice para deduplicação instantânea e busca rápida
CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_dedup 
ON public.asaas_webhook_events (asaas_event_id, processed);

-- Otimizar a RPC de processamento para operação atômica não bloqueante (ON CONFLICT DO NOTHING)
CREATE OR REPLACE FUNCTION public.record_and_validate_asaas_webhook(
  _event_id text,
  _event_type text,
  _payload jsonb,
  _signature text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_already_processed boolean;
BEGIN
  -- Inserir novo evento de forma estritamente idempotente
  INSERT INTO public.asaas_webhook_events (
    asaas_event_id,
    event_type,
    payload,
    signature,
    processed,
    created_at
  )
  VALUES (
    _event_id,
    _event_type,
    _payload,
    _signature,
    false,
    now()
  )
  ON CONFLICT (asaas_event_id) DO NOTHING
  RETURNING id, processed INTO v_id, v_already_processed;

  -- Se já existia registro prévio (conflito de concorrência ou reenvio do Asaas)
  IF v_id IS NULL THEN
    SELECT id, COALESCE(processed, false) 
    INTO v_id, v_already_processed
    FROM public.asaas_webhook_events
    WHERE asaas_event_id = _event_id;

    RETURN jsonb_build_object(
      'already_processed', v_already_processed,
      'event_id', v_id,
      'status', 'DUPLICATE_IGNORED'
    );
  END IF;

  RETURN jsonb_build_object(
    'already_processed', false,
    'event_id', v_id,
    'status', 'RECORDED'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_and_validate_asaas_webhook(text, text, jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_and_validate_asaas_webhook(text, text, jsonb, text) TO service_role;
