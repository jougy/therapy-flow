-- Migration: 20260829010000_consolidate_subscription_pricing_and_webhook_rpcs.sql
-- Descrição: Alinhamento das tabelas de assinatura com a Matriz Oficial de Preços,
-- relaxamento de constraints de status, RPCs atômicas para Webhook e confirmação de pagamento Asaas.

-- 1. Ajustar constraints de status em clinic_subscriptions e subscription_invoices
ALTER TABLE public.clinic_subscriptions
  DROP CONSTRAINT IF EXISTS clinic_subscriptions_status_check;

ALTER TABLE public.clinic_subscriptions
  ADD CONSTRAINT clinic_subscriptions_status_check
  CHECK (status IN ('ACTIVE', 'PENDING', 'TRIAL', 'BETA', 'OVERDUE', 'PAUSED', 'CANCELED', 'SUSPENDED', 'EXPIRED'));

ALTER TABLE public.subscription_invoices
  DROP CONSTRAINT IF EXISTS subscription_invoices_status_check;

ALTER TABLE public.subscription_invoices
  ADD CONSTRAINT subscription_invoices_status_check
  CHECK (status IN ('PENDING', 'RECEIVED', 'CONFIRMED', 'OVERDUE', 'REFUNDED', 'DELETED', 'DUNNING_RECEIVED', 'RECEIVED_IN_CASH', 'AWAITING_PAYMENT'));

-- 2. Garantir colunas essenciais em subscription_invoices
ALTER TABLE public.subscription_invoices
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS installment_number integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_installments integer DEFAULT 1;

-- 3. RPC Atômica para Registro Idempotente de Webhooks do Asaas
CREATE OR REPLACE FUNCTION public.record_asaas_webhook_event(
  _event_id text,
  _event_type text,
  _payload jsonb,
  _signature text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.asaas_webhook_events%ROWTYPE;
  v_event_id uuid;
BEGIN
  -- Verificar se o evento já foi registrado
  SELECT * INTO v_existing
  FROM public.asaas_webhook_events
  WHERE asaas_event_id = _event_id;

  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'already_processed', coalesce(v_existing.processed, false),
      'event_id', v_existing.id,
      'status', 'EXISTING'
    );
  END IF;

  -- Inserir novo evento
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
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'already_processed', false,
    'event_id', v_event_id,
    'status', 'INSERTED'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_asaas_webhook_event(text, text, jsonb, text) TO service_role, postgres;

-- 4. RPC Atômica para Confirmação e Ativação de Pagamento Asaas
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
SET search_path = public
AS $$
DECLARE
  v_sub public.clinic_subscriptions%ROWTYPE;
  v_duration_days integer := 30;
  v_new_expires_at timestamptz;
  v_new_due_date date;
BEGIN
  -- 1. Buscar assinatura da clínica
  SELECT * INTO v_sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _clinic_id;

  IF v_sub.id IS NOT NULL THEN
    v_duration_days := CASE
      WHEN UPPER(v_sub.billing_cycle) = 'ANNUAL' THEN 365
      WHEN UPPER(v_sub.billing_cycle) = 'QUARTERLY' THEN 90
      ELSE 30
    END;

    v_new_expires_at := _payment_date + (v_duration_days || ' days')::interval;
    v_new_due_date := (_payment_date + (v_duration_days || ' days')::interval)::date;

    -- Atualizar assinatura para ACTIVE
    UPDATE public.clinic_subscriptions
    SET
      status = 'ACTIVE',
      is_free_trial = false,
      current_period_start = _payment_date,
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

-- 5. Atualizar manage_clinic_subscription_plan com os preços oficiais
CREATE OR REPLACE FUNCTION public.manage_clinic_subscription_plan(
  _clinic_id uuid,
  _new_plan public.subscription_plan,
  _billing_cycle text DEFAULT 'annual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id uuid := auth.uid();
  v_active_subaccounts_count integer;
  v_owner_user_id uuid;
  v_sub_record public.clinic_subscriptions%ROWTYPE;
  v_cycle text := LOWER(coalesce(_billing_cycle, 'annual'));
  v_base_price numeric(10,2);
  v_extra_price numeric(10,2);
  v_current_extra_seats integer := 0;
BEGIN
  IF NOT public.is_clinic_subscription_manager(v_current_user_id, _clinic_id) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o responsável pela clínica (account_owner) pode alterar o plano.';
  END IF;

  SELECT account_owner_user_id INTO v_owner_user_id
  FROM public.clinics
  WHERE id = _clinic_id;

  v_owner_user_id := coalesce(v_owner_user_id, v_current_user_id);

  -- Validação no Downgrade para Solo
  IF _new_plan = 'solo' THEN
    SELECT COUNT(*)::integer INTO v_active_subaccounts_count
    FROM public.clinic_memberships
    WHERE clinic_id = _clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND account_role != 'account_owner';

    IF v_active_subaccounts_count > 0 THEN
      RAISE EXCEPTION 'Não é possível alterar para o plano Solo enquanto houver % colaborador(es) ativo(s) cadastrado(s). Desative ou remova os colaboradores primeiro.', v_active_subaccounts_count;
    END IF;
  END IF;

  -- Obter preços da matriz oficial
  IF _new_plan = 'solo' THEN
    v_base_price := CASE
      WHEN v_cycle = 'monthly' THEN 52.00
      WHEN v_cycle = 'quarterly' THEN 48.00
      ELSE 40.00
    END;
    v_extra_price := 0.00;
    v_current_extra_seats := 0;
  ELSE
    v_base_price := CASE
      WHEN v_cycle = 'monthly' THEN 78.00
      WHEN v_cycle = 'quarterly' THEN 72.00
      ELSE 60.00
    END;
    v_extra_price := CASE
      WHEN v_cycle = 'monthly' THEN 13.00
      WHEN v_cycle = 'quarterly' THEN 12.00
      ELSE 10.00
    END;

    SELECT additional_concurrent_access_count INTO v_current_extra_seats
    FROM public.clinic_subscriptions
    WHERE clinic_id = _clinic_id;

    v_current_extra_seats := coalesce(v_current_extra_seats, 0);
  END IF;

  -- Upsert em clinic_subscriptions
  INSERT INTO public.clinic_subscriptions (
    clinic_id,
    account_owner_user_id,
    plan_type,
    billing_cycle,
    base_monthly_price,
    base_subaccount_limit,
    base_concurrent_access_count,
    additional_concurrent_access_count,
    additional_concurrent_access_price,
    total_recurring_monthly_price,
    status
  )
  VALUES (
    _clinic_id,
    v_owner_user_id,
    _new_plan,
    UPPER(v_cycle),
    v_base_price,
    CASE WHEN _new_plan = 'clinic' THEN 30 ELSE 1 END,
    CASE WHEN _new_plan = 'clinic' THEN 2 ELSE 1 END,
    v_current_extra_seats,
    v_extra_price,
    v_base_price + (v_current_extra_seats * v_extra_price),
    'PENDING'
  )
  ON CONFLICT (clinic_id) DO UPDATE
  SET
    plan_type = EXCLUDED.plan_type,
    billing_cycle = EXCLUDED.billing_cycle,
    base_monthly_price = EXCLUDED.base_monthly_price,
    base_subaccount_limit = EXCLUDED.base_subaccount_limit,
    base_concurrent_access_count = EXCLUDED.base_concurrent_access_count,
    additional_concurrent_access_count = CASE WHEN EXCLUDED.plan_type = 'solo' THEN 0 ELSE clinic_subscriptions.additional_concurrent_access_count END,
    additional_concurrent_access_price = EXCLUDED.additional_concurrent_access_price,
    total_recurring_monthly_price = EXCLUDED.base_monthly_price + (
      CASE WHEN EXCLUDED.plan_type = 'solo' THEN 0 ELSE clinic_subscriptions.additional_concurrent_access_count END * EXCLUDED.additional_concurrent_access_price
    ),
    updated_at = now()
  RETURNING * INTO v_sub_record;

  RETURN jsonb_build_object(
    'success', true,
    'clinic_id', _clinic_id,
    'plan_type', v_sub_record.plan_type,
    'billing_cycle', v_sub_record.billing_cycle,
    'base_subaccount_limit', v_sub_record.base_subaccount_limit,
    'base_concurrent_access_count', v_sub_record.base_concurrent_access_count,
    'total_recurring_monthly_price', v_sub_record.total_recurring_monthly_price
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.manage_clinic_subscription_plan(uuid, public.subscription_plan, text) TO authenticated;

-- 6. Atualizar update_clinic_concurrent_accesses com o valor dinâmico por ciclo
CREATE OR REPLACE FUNCTION public.update_clinic_concurrent_accesses(
  _clinic_id uuid,
  _extra_concurrent integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id uuid := auth.uid();
  v_sub_record public.clinic_subscriptions%ROWTYPE;
  v_extra_seat_price numeric(10,2);
  v_base_monthly_price numeric(10,2);
BEGIN
  IF NOT public.is_clinic_subscription_manager(v_current_user_id, _clinic_id) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o responsável pela clínica pode ajustar os acessos simultâneos.';
  END IF;

  IF coalesce(_extra_concurrent, 0) < 0 THEN
    RAISE EXCEPTION 'Quantidade de acessos extras inválida.';
  END IF;

  SELECT * INTO v_sub_record FROM public.clinic_subscriptions WHERE clinic_id = _clinic_id;
  IF v_sub_record.id IS NULL THEN
    INSERT INTO public.clinic_subscriptions (
      clinic_id, account_owner_user_id, plan_type, billing_cycle,
      base_monthly_price, base_subaccount_limit, base_concurrent_access_count, status
    )
    VALUES (_clinic_id, v_current_user_id, 'clinic', 'ANNUAL', 60.00, 30, 2, 'PENDING')
    RETURNING * INTO v_sub_record;
  END IF;

  IF v_sub_record.plan_type = 'solo' THEN
    RAISE EXCEPTION 'Não é possível adicionar acessos simultâneos extras no plano Solo. Faça upgrade para o plano Clínica primeiro.';
  END IF;

  -- Determinar preço do assento extra baseado no ciclo
  v_extra_seat_price := CASE
    WHEN UPPER(coalesce(v_sub_record.billing_cycle, 'ANNUAL')) = 'MONTHLY' THEN 13.00
    WHEN UPPER(coalesce(v_sub_record.billing_cycle, 'ANNUAL')) = 'QUARTERLY' THEN 12.00
    ELSE 10.00
  END;

  v_base_monthly_price := CASE
    WHEN UPPER(coalesce(v_sub_record.billing_cycle, 'ANNUAL')) = 'MONTHLY' THEN 78.00
    WHEN UPPER(coalesce(v_sub_record.billing_cycle, 'ANNUAL')) = 'QUARTERLY' THEN 72.00
    ELSE 60.00
  END;

  UPDATE public.clinic_subscriptions
  SET
    additional_concurrent_access_count = _extra_concurrent,
    additional_concurrent_access_price = v_extra_seat_price,
    base_monthly_price = v_base_monthly_price,
    total_recurring_monthly_price = v_base_monthly_price + (_extra_concurrent * v_extra_seat_price),
    updated_at = now()
  WHERE clinic_id = _clinic_id
  RETURNING * INTO v_sub_record;

  RETURN jsonb_build_object(
    'success', true,
    'additional_concurrent_access_count', _extra_concurrent,
    'total_concurrent_access_limit', v_sub_record.base_concurrent_access_count + _extra_concurrent,
    'total_recurring_monthly_price', v_sub_record.total_recurring_monthly_price
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_clinic_concurrent_accesses(uuid, integer) TO authenticated;
