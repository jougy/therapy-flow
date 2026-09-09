-- Migration: 20260908170000_enforce_credit_card_for_clinic_creation.sql
-- Descrição: Revoga execução pública de handle_signup (permitindo apenas service_role) e
-- exige que activate_clinic_free_trial possua cartão de crédito tokenizado prévio.

-- 1. Revogar permissões públicas de handle_signup (Apenas Edge Functions / Service Role podem criar clínicas)
DO $$
BEGIN
  -- Revoga da assinatura atual com 7 parâmetros
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.handle_signup(uuid, text, text, public.subscription_plan, text, text, boolean) FROM authenticated, anon';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.handle_signup(uuid, text, text, public.subscription_plan, text, text, boolean) TO service_role';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Atualizar activate_clinic_free_trial com verificação estrita de cartão tokenizado
CREATE OR REPLACE FUNCTION public.activate_clinic_free_trial(
  _clinic_id uuid,
  _plan_type text DEFAULT 'clinic'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id uuid := auth.uid();
  v_owner_user_id uuid;
  v_is_authorized boolean := false;
  v_typed_plan public.subscription_plan;
  v_trial_duration_days integer := 7;
  v_expires_at timestamptz := now() + interval '7 days';
  v_has_card boolean := false;
BEGIN
  IF _clinic_id IS NULL THEN
    RAISE EXCEPTION 'clinic_id é obrigatório para ativar a degustação grátis.';
  END IF;

  -- Validação e coerção do plano
  BEGIN
    v_typed_plan := _plan_type::public.subscription_plan;
  EXCEPTION WHEN OTHERS THEN
    v_typed_plan := 'clinic'::public.subscription_plan;
  END;

  -- 1. Buscar o account_owner_user_id da clínica
  SELECT account_owner_user_id INTO v_owner_user_id
  FROM public.clinics
  WHERE id = _clinic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clínica não encontrada.';
  END IF;

  -- 2. Validação de segurança: verificar se auth.uid() é account_owner ou admin
  IF v_current_user_id IS NOT NULL THEN
    IF v_owner_user_id = v_current_user_id THEN
      v_is_authorized := true;
    ELSIF EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.clinic_id = _clinic_id
        AND cm.user_id = v_current_user_id
        AND cm.account_role = 'account_owner'
        AND cm.is_active = true
        AND cm.membership_status = 'active'
    ) THEN
      v_is_authorized := true;
    ELSIF EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = v_current_user_id
        AND pa.is_active = true
    ) THEN
      v_is_authorized := true;
    END IF;
  ELSE
    -- Chamadas executadas com service_role (ex: Edge Functions)
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Acesso negado: apenas o responsável pela clínica (account_owner) ou administrador pode ativar o teste grátis.';
  END IF;

  -- 3. Validação de Garantia: verificar se a clínica possui cartão registrado em clinic_subscriptions
  SELECT (trial_card_token IS NOT NULL AND trim(trial_card_token) <> '') INTO v_has_card
  FROM public.clinic_subscriptions
  WHERE clinic_id = _clinic_id;

  IF NOT COALESCE(v_has_card, false) THEN
    RAISE EXCEPTION 'É obrigatório registrar um cartão de crédito como garantia para ativar o teste gratuito.';
  END IF;

  v_owner_user_id := COALESCE(v_owner_user_id, v_current_user_id);

  -- 4. Realizar UPSERT seguro em public.clinic_subscriptions com parâmetros de 7 dias
  INSERT INTO public.clinic_subscriptions (
    clinic_id,
    account_owner_user_id,
    plan_type,
    billing_cycle,
    payment_method,
    base_monthly_price,
    base_concurrent_access_count,
    total_recurring_monthly_price,
    base_subaccount_limit,
    status,
    is_free_trial,
    is_read_only,
    trial_max_attendances,
    trial_max_patients,
    trial_max_custom_forms,
    period_duration_days,
    current_period_start,
    current_period_end,
    expires_at,
    updated_at
  )
  VALUES (
    _clinic_id,
    v_owner_user_id,
    v_typed_plan,
    'ANNUAL',
    'CREDIT_CARD',
    CASE WHEN v_typed_plan = 'solo' THEN 44.00 ELSE 104.00 END,
    4, -- 4 acessos simultâneos no trial
    0,
    CASE WHEN v_typed_plan = 'solo' THEN 1 ELSE 30 END,
    'TRIAL',
    true,
    false,
    20,
    5,
    2, -- 2 formulários editáveis
    v_trial_duration_days,
    now(),
    v_expires_at,
    v_expires_at,
    now()
  )
  ON CONFLICT (clinic_id) DO UPDATE
  SET
    account_owner_user_id = COALESCE(clinic_subscriptions.account_owner_user_id, EXCLUDED.account_owner_user_id),
    plan_type = EXCLUDED.plan_type,
    billing_cycle = 'ANNUAL',
    payment_method = 'CREDIT_CARD',
    base_monthly_price = EXCLUDED.base_monthly_price,
    base_concurrent_access_count = 4,
    total_recurring_monthly_price = 0,
    base_subaccount_limit = EXCLUDED.base_subaccount_limit,
    status = 'TRIAL',
    is_free_trial = true,
    is_read_only = false,
    trial_max_attendances = 20,
    trial_max_patients = 5,
    trial_max_custom_forms = 2,
    period_duration_days = v_trial_duration_days,
    current_period_start = now(),
    current_period_end = v_expires_at,
    expires_at = v_expires_at,
    updated_at = now();

  -- 5. Atualizar a clínica em public.clinics
  UPDATE public.clinics
  SET
    subscription_plan = v_typed_plan,
    concurrent_access_limit = 4,
    subaccount_limit = CASE WHEN v_typed_plan = 'solo' THEN 1 ELSE 30 END,
    updated_at = now()
  WHERE id = _clinic_id;

  RETURN jsonb_build_object(
    'success', true,
    'clinic_id', _clinic_id,
    'plan_type', v_typed_plan,
    'status', 'TRIAL',
    'is_free_trial', true,
    'concurrent_access_limit', 4,
    'trial_max_custom_forms', 2,
    'expires_at', v_expires_at,
    'message', 'Degustação grátis de 7 dias ativada com sucesso.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_clinic_free_trial(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_clinic_free_trial(uuid, public.subscription_plan) TO authenticated, service_role;
