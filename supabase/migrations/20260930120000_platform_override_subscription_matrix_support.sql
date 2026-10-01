-- Migration: 20260930120000_platform_override_subscription_matrix_support.sql
-- Descrição: Harmonização da RPC platform_override_clinic_subscription com a matriz oficial de 6 planos de assinatura e legados
-- 1. Garante que se o registro clinic_subscriptions não existir para a clínica alvo,
--    os valores base inseridos respeitem com precisão o novo plano (_new_plan).
-- 2. Atualiza os limites base da assinatura (base_concurrent_access_count e base_subaccount_limit)
--    de acordo com o tier solicitado no override, caso novos limites não tenham sido passados explicitamente.
-- 3. Assegura sincronização contínua com a tabela clinics via trigger sync_clinic_limits_from_subscription.

CREATE OR REPLACE FUNCTION public.platform_override_clinic_subscription(
  _clinic_id uuid,
  _new_plan public.subscription_plan DEFAULT NULL::public.subscription_plan,
  _status text DEFAULT NULL::text,
  _subaccount_limit integer DEFAULT NULL::integer,
  _concurrent_access_limit integer DEFAULT NULL::integer,
  _next_due_date date DEFAULT NULL::date,
  _reason text DEFAULT NULL::text
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_is_platform_admin boolean;
  v_sub_record public.clinic_subscriptions%ROWTYPE;
  v_owner_id uuid;
  v_target_plan text;
  v_default_base_subaccounts integer := 999999;
  v_default_base_concurrent integer := 4;
  v_default_price numeric(10,2) := 139.00;
  v_new_base_subaccounts integer;
  v_new_base_concurrent integer;
BEGIN
  -- Exige permissão de Administrador da Plataforma
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = v_caller_id AND is_active = true
  ) INTO v_is_platform_admin;

  IF NOT v_is_platform_admin THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores da plataforma podem realizar overrides operacionais.';
  END IF;

  IF _reason IS NULL OR length(trim(_reason)) < 8 THEN
    RAISE EXCEPTION 'Justificativa (motivo) auditável é obrigatória e deve conter pelo menos 8 caracteres para realizar override de assinatura.';
  END IF;

  -- Blindagem e clamp seguro contra valores abusivos ou negativos (1 a 999999)
  IF _subaccount_limit IS NOT NULL THEN
    _subaccount_limit := GREATEST(1, LEAST(_subaccount_limit, 999999));
  END IF;

  IF _concurrent_access_limit IS NOT NULL THEN
    _concurrent_access_limit := GREATEST(1, LEAST(_concurrent_access_limit, 999999));
  END IF;

  -- Busca owner da clínica
  SELECT account_owner_user_id INTO v_owner_id FROM public.clinics WHERE id = _clinic_id;
  v_owner_id := coalesce(v_owner_id, v_caller_id);

  -- Calcula limites e valores base padrão da matriz para o plano alvo
  v_target_plan := LOWER(COALESCE(_new_plan::text, 'clinica_medio'));

  IF v_target_plan IN ('prof_basico', 'prof_medio', 'solo') THEN
    v_default_base_subaccounts := 1;
    v_default_base_concurrent := 1;
    v_default_price := CASE WHEN v_target_plan = 'prof_basico' THEN 39.99 ELSE 59.99 END;
  ELSIF v_target_plan = 'prof_top' THEN
    v_default_base_subaccounts := 2;
    v_default_base_concurrent := 2;
    v_default_price := 89.99;
  ELSIF v_target_plan = 'clinica_basico' THEN
    v_default_base_subaccounts := 999999;
    v_default_base_concurrent := 2;
    v_default_price := 99.00;
  ELSIF v_target_plan IN ('clinica_top', 'enterprise') THEN
    v_default_base_subaccounts := 999999;
    v_default_base_concurrent := 8;
    v_default_price := 199.00;
  ELSE -- clinica_medio, clinic
    v_default_base_subaccounts := 999999;
    v_default_base_concurrent := 4;
    v_default_price := 139.00;
  END IF;

  -- Garante registro de assinatura
  SELECT * INTO v_sub_record FROM public.clinic_subscriptions WHERE clinic_id = _clinic_id;
  IF v_sub_record.id IS NULL THEN
    INSERT INTO public.clinic_subscriptions (
      clinic_id, account_owner_user_id, plan_type, base_monthly_price,
      base_subaccount_limit, base_concurrent_access_count, status
    )
    VALUES (
      _clinic_id,
      v_owner_id,
      COALESCE(_new_plan, 'clinica_medio'::public.subscription_plan),
      v_default_price,
      COALESCE(_subaccount_limit, v_default_base_subaccounts),
      COALESCE(_concurrent_access_limit, v_default_base_concurrent),
      COALESCE(_status, 'ACTIVE')
    )
    RETURNING * INTO v_sub_record;
  END IF;

  -- Determina novos limites base se o plano foi alterado
  IF _new_plan IS NOT NULL THEN
    v_new_base_subaccounts := COALESCE(_subaccount_limit, v_default_base_subaccounts);
    v_new_base_concurrent := COALESCE(_concurrent_access_limit, v_default_base_concurrent);
  ELSE
    v_new_base_subaccounts := COALESCE(_subaccount_limit, v_sub_record.base_subaccount_limit);
    v_new_base_concurrent := v_sub_record.base_concurrent_access_count;
  END IF;

  UPDATE public.clinic_subscriptions
  SET
    plan_type = COALESCE(_new_plan, plan_type),
    status = COALESCE(_status, status),
    base_subaccount_limit = v_new_base_subaccounts,
    base_concurrent_access_count = v_new_base_concurrent,
    additional_concurrent_access_count = CASE
      WHEN _concurrent_access_limit IS NOT NULL THEN GREATEST(0, _concurrent_access_limit - v_new_base_concurrent)
      ELSE additional_concurrent_access_count
    END,
    next_due_date = COALESCE(_next_due_date, next_due_date),
    override_reason = trim(_reason),
    override_by_user_id = v_caller_id,
    override_at = now(),
    updated_at = now()
  WHERE clinic_id = _clinic_id
  RETURNING * INTO v_sub_record;

  -- Registro de auditoria obrigatório no log global de eventos da plataforma
  PERFORM public.log_platform_audit_event(
    'platform_override_clinic_subscription',
    _clinic_id,
    trim(_reason),
    jsonb_build_object(
      'plan_type', v_sub_record.plan_type,
      'status', v_sub_record.status,
      'subaccount_limit', v_sub_record.base_subaccount_limit + v_sub_record.purchased_subaccount_extra_count,
      'concurrent_access_limit', v_sub_record.base_concurrent_access_count + v_sub_record.additional_concurrent_access_count,
      'next_due_date', v_sub_record.next_due_date,
      'caller_user_id', v_caller_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'clinic_id', _clinic_id,
    'plan_type', v_sub_record.plan_type,
    'status', v_sub_record.status,
    'subaccount_limit', v_sub_record.base_subaccount_limit + v_sub_record.purchased_subaccount_extra_count,
    'concurrent_access_limit', v_sub_record.base_concurrent_access_count + v_sub_record.additional_concurrent_access_count,
    'next_due_date', v_sub_record.next_due_date,
    'override_reason', v_sub_record.override_reason,
    'override_at', v_sub_record.override_at
  );
END;
$$;

ALTER FUNCTION public.platform_override_clinic_subscription(uuid, public.subscription_plan, text, integer, integer, date, text) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.platform_override_clinic_subscription(uuid, public.subscription_plan, text, integer, integer, date, text) TO authenticated, service_role;
