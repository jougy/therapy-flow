-- ==============================================================================
-- MIGRATION: 20260911180000_update_solo_pricing_and_single_trial_option.sql
-- DESCRIÇÃO: Unificação do teste gratuito em opção única equivalente ao Clínica Pro
--            (4 acessos simultâneos) e atualização das regras e mensagens para "Teste gratuito (7 dias)".
-- ==============================================================================

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
    RAISE EXCEPTION 'clinic_id é obrigatório para ativar o teste gratuito.';
  END IF;

  -- Regra Comercial: O teste gratuito de 7 dias é exclusivamente concedido na
  -- modalidade equivalente ao "Clínica Pro" (4 acessos simultâneos para equipes).
  v_typed_plan := 'clinic'::public.subscription_plan;

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
    RAISE EXCEPTION 'Acesso negado: apenas o responsável pela clínica (account_owner) ou administrador pode ativar o teste gratuito.';
  END IF;

  -- 3. Validação de Garantia: verificar se a clínica possui cartão registrado em clinic_subscriptions
  SELECT (trial_card_token IS NOT NULL AND trim(trial_card_token) <> '') INTO v_has_card
  FROM public.clinic_subscriptions
  WHERE clinic_id = _clinic_id;

  IF NOT COALESCE(v_has_card, false) THEN
    RAISE EXCEPTION 'É obrigatório registrar um cartão de crédito como garantia para ativar o teste gratuito.';
  END IF;

  v_owner_user_id := COALESCE(v_owner_user_id, v_current_user_id);

  -- 4. Realizar UPSERT seguro em public.clinic_subscriptions com parâmetros do Clínica Pro
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
    'clinic'::public.subscription_plan,
    'ANNUAL',
    'CREDIT_CARD',
    104.00, -- Base de referência Clínica Pro
    4,      -- 4 acessos simultâneos no teste gratuito
    0,
    30,     -- Limite de até 30 colaboradores base
    'TRIAL',
    true,
    false,
    20,
    5,
    2,      -- 2 formulários editáveis
    v_trial_duration_days,
    now(),
    v_expires_at,
    v_expires_at,
    now()
  )
  ON CONFLICT (clinic_id) DO UPDATE
  SET
    account_owner_user_id = COALESCE(clinic_subscriptions.account_owner_user_id, EXCLUDED.account_owner_user_id),
    plan_type = 'clinic'::public.subscription_plan,
    billing_cycle = 'ANNUAL',
    payment_method = 'CREDIT_CARD',
    base_monthly_price = 104.00,
    base_concurrent_access_count = 4,
    total_recurring_monthly_price = 0,
    base_subaccount_limit = 30,
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
    subscription_plan = 'clinic'::public.subscription_plan,
    concurrent_access_limit = 4,
    subaccount_limit = 30,
    updated_at = now()
  WHERE id = _clinic_id;

  RETURN jsonb_build_object(
    'success', true,
    'clinic_id', _clinic_id,
    'plan_type', 'clinic',
    'status', 'TRIAL',
    'is_free_trial', true,
    'concurrent_access_limit', 4,
    'trial_max_custom_forms', 2,
    'expires_at', v_expires_at,
    'message', 'Teste gratuito de 7 dias ativado com sucesso.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_clinic_free_trial(uuid, text) TO authenticated, service_role;
