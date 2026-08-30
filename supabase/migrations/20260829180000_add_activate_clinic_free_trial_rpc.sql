-- Migration: 20260829180000_add_activate_clinic_free_trial_rpc.sql
-- Descrição: RPC atômica activate_clinic_free_trial para ativação segura de planos de degustação grátis (TRIAL) para Solo e Clínica.

CREATE OR REPLACE FUNCTION public.activate_clinic_free_trial(
  _clinic_id uuid,
  _plan_type public.subscription_plan DEFAULT 'solo'
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
BEGIN
  IF _clinic_id IS NULL THEN
    RAISE EXCEPTION 'clinic_id é obrigatório para ativar a degustação grátis.';
  END IF;

  -- 1. Buscar o account_owner_user_id da clínica
  SELECT account_owner_user_id INTO v_owner_user_id
  FROM public.clinics
  WHERE id = _clinic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clínica não encontrada.';
  END IF;

  -- 2. Validação de segurança: verificar se auth.uid() é account_owner em clinic_memberships,
  -- em clinics.account_owner_user_id ou se é platform_admin.
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
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Acesso negado: apenas o responsável pela clínica (account_owner) ou administrador pode ativar o teste grátis.';
  END IF;

  v_owner_user_id := COALESCE(v_owner_user_id, v_current_user_id);

  -- 3. Realizar UPSERT seguro em public.clinic_subscriptions
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
    trial_max_attendances,
    trial_max_patients,
    trial_max_custom_forms,
    current_period_start,
    updated_at
  )
  VALUES (
    _clinic_id,
    v_owner_user_id,
    _plan_type,
    'ANNUAL',
    'TRIAL',
    CASE WHEN _plan_type = 'clinic' THEN 60.00 ELSE 40.00 END,
    CASE WHEN _plan_type = 'clinic' THEN 4 ELSE 1 END,
    0,
    CASE WHEN _plan_type = 'clinic' THEN 30 ELSE 1 END,
    'TRIAL',
    true,
    20,
    5,
    1,
    now(),
    now()
  )
  ON CONFLICT (clinic_id) DO UPDATE
  SET
    account_owner_user_id = COALESCE(clinic_subscriptions.account_owner_user_id, EXCLUDED.account_owner_user_id),
    plan_type = EXCLUDED.plan_type,
    billing_cycle = 'ANNUAL',
    payment_method = 'TRIAL',
    base_monthly_price = EXCLUDED.base_monthly_price,
    base_concurrent_access_count = EXCLUDED.base_concurrent_access_count,
    total_recurring_monthly_price = 0,
    base_subaccount_limit = EXCLUDED.base_subaccount_limit,
    status = 'TRIAL',
    is_free_trial = true,
    trial_max_attendances = 20,
    trial_max_patients = 5,
    trial_max_custom_forms = 1,
    current_period_start = now(),
    updated_at = now();

  -- 4. Atualizar a clínica em public.clinics
  UPDATE public.clinics
  SET
    subscription_plan = _plan_type,
    concurrent_access_limit = CASE WHEN _plan_type = 'clinic' THEN 4 ELSE 1 END,
    subaccount_limit = CASE WHEN _plan_type = 'clinic' THEN 30 ELSE 1 END,
    updated_at = now()
  WHERE id = _clinic_id;

  RETURN jsonb_build_object(
    'success', true,
    'clinic_id', _clinic_id,
    'plan_type', _plan_type,
    'status', 'TRIAL',
    'is_free_trial', true,
    'message', 'Degustação grátis ativada com sucesso.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_clinic_free_trial(uuid, public.subscription_plan) TO authenticated, anon;
