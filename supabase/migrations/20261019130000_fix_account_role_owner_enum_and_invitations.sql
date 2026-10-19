-- Migration: 20261019130000_fix_account_role_owner_enum_and_invitations.sql
-- Description:
-- 1. Corrige o erro "invalid input value for enum account_role_type: owner"
--    adicionando 'owner' com segurança ao enum account_role_type.
-- 2. Atualiza invite_clinic_collaborator e manage_clinic_subscription_plan para não falharem.
-- 3. Atualiza get_clinic_pending_collaborator_invitations para expor role_key, email_delivery_status e email_last_error.

-- 1. Expansão segura do enum account_role_type para conter 'owner'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.account_role_type'::regtype
      AND enumlabel = 'owner'
  ) THEN
    ALTER TYPE public.account_role_type ADD VALUE 'owner';
  END IF;
END $$;

-- 2. Atualizar invite_clinic_collaborator para evitar comparação inválida de enum e suportar role_key
CREATE OR REPLACE FUNCTION public.invite_clinic_collaborator(
  _clinic_id uuid DEFAULT NULL::uuid,
  _email text DEFAULT NULL::text,
  _operational_role public.operational_role_type DEFAULT 'professional'::public.operational_role_type,
  _job_title text DEFAULT NULL::text,
  _specialty text DEFAULT NULL::text,
  _role_key text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _resolved_clinic_id uuid;
  _normalized_email text := lower(trim(coalesce(_email, '')));
  _token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  _token_hash text := md5(_token);
  _existing_user_id uuid;
  _invitation_id uuid;
  _normalized_role_key text := NULLIF(trim(_role_key), '');
  _inferred_operational_role public.operational_role_type := _operational_role;
  _custom_role record;
  _clinic_plan text;
  _subaccount_limit integer;
  _active_subaccounts_count integer;
  _pending_invites_count integer;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  _resolved_clinic_id := COALESCE(_clinic_id, public.get_user_clinic_id(_requester_id));

  IF _resolved_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clínica não identificada.';
  END IF;

  IF NOT (public.current_user_can('subaccounts.write', _resolved_clinic_id) OR public.current_user_can('subaccounts.manage', _resolved_clinic_id)) THEN
    RAISE EXCEPTION 'Você não tem permissão para convidar colaboradores.';
  END IF;

  -- Obter plano e limites canônicos da clínica
  SELECT LOWER(COALESCE(subscription_plan::text, 'solo')), COALESCE(subaccount_limit, 1)
  INTO _clinic_plan, _subaccount_limit
  FROM public.clinics
  WHERE id = _resolved_clinic_id;

  -- Trava 1: Planos Monoposto (prof_basico, prof_medio, solo) não permitem colaboradores
  IF _clinic_plan IN ('prof_basico', 'prof_medio', 'solo') THEN
    RAISE EXCEPTION 'Convites de colaboradores não estão disponíveis em planos individuais (monoposto). Faça upgrade para Profissional Top ou Plano Clínica.';
  END IF;

  -- Trava 2: Plano Profissional Top (prof_top): máximo de 1 colaborador de apoio (total 2 membros)
  IF _clinic_plan = 'prof_top' OR _subaccount_limit = 2 THEN
    SELECT COUNT(*)::integer INTO _active_subaccounts_count
    FROM public.clinic_memberships
    WHERE clinic_id = _resolved_clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND COALESCE(account_role::text, '') NOT IN ('account_owner', 'owner')
      AND COALESCE(operational_role::text, '') <> 'owner';

    SELECT COUNT(*)::integer INTO _pending_invites_count
    FROM public.clinic_collaborator_invitations
    WHERE clinic_id = _resolved_clinic_id
      AND status = 'pending'
      AND lower(email) <> _normalized_email;

    IF (_active_subaccounts_count + _pending_invites_count) >= 1 THEN
      RAISE EXCEPTION 'O plano Profissional Top permite no máximo 1 colaborador de apoio (total de 2 membros). Limite atingido.';
    END IF;
  ELSIF _subaccount_limit < 999999 THEN
    -- Verificação genérica para outros planos limitados
    SELECT COUNT(*)::integer INTO _active_subaccounts_count
    FROM public.clinic_memberships
    WHERE clinic_id = _resolved_clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND COALESCE(account_role::text, '') NOT IN ('account_owner', 'owner')
      AND COALESCE(operational_role::text, '') <> 'owner';

    SELECT COUNT(*)::integer INTO _pending_invites_count
    FROM public.clinic_collaborator_invitations
    WHERE clinic_id = _resolved_clinic_id
      AND status = 'pending'
      AND lower(email) <> _normalized_email;

    IF (_active_subaccounts_count + _pending_invites_count) >= GREATEST(0, _subaccount_limit - 1) THEN
      RAISE EXCEPTION 'O limite de membros da clínica foi atingido para o plano atual.';
    END IF;
  END IF;

  IF _normalized_email = '' OR _normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Informe um e-mail válido para o convite.';
  END IF;

  IF _operational_role = 'owner' OR _normalized_role_key = 'owner' THEN
    RAISE EXCEPTION 'O papel owner não pode ser atribuído por convite operacional.';
  END IF;

  -- Validar role_key em clinic_operational_roles se informado
  IF _normalized_role_key IS NOT NULL THEN
    SELECT *
    INTO _custom_role
    FROM public.clinic_operational_roles
    WHERE clinic_id = _resolved_clinic_id
      AND role_key = _normalized_role_key
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Papel operacional inválido para esta clínica.';
    END IF;

    IF _operational_role IS NULL OR _operational_role = 'professional'::public.operational_role_type THEN
      _inferred_operational_role := _custom_role.base_operational_role;
    END IF;
  END IF;

  SELECT users.id
  INTO _existing_user_id
  FROM auth.users
  WHERE lower(users.email) = _normalized_email
  LIMIT 1;

  UPDATE public.clinic_collaborator_invitations
  SET status = 'cancelled', updated_at = now()
  WHERE clinic_id = _resolved_clinic_id
    AND lower(email) = _normalized_email
    AND status = 'pending';

  INSERT INTO public.clinic_collaborator_invitations (
    clinic_id,
    email,
    operational_role,
    role_key,
    job_title,
    specialty,
    token_hash,
    invited_by,
    existing_user_id,
    status,
    email_delivery_status,
    email_last_error,
    email_sent_at
  )
  VALUES (
    _resolved_clinic_id,
    _normalized_email,
    _inferred_operational_role,
    _normalized_role_key,
    NULLIF(trim(_job_title), ''),
    NULLIF(trim(_specialty), ''),
    _token_hash,
    _requester_id,
    _existing_user_id,
    'pending',
    'pending',
    NULL,
    NULL
  )
  RETURNING id INTO _invitation_id;

  PERFORM public.log_security_event(
    _resolved_clinic_id,
    _requester_id,
    _existing_user_id,
    'clinic_collaborator_invited',
    'admin',
    jsonb_build_object(
      'invitation_id', _invitation_id,
      'email', _normalized_email,
      'operational_role', _inferred_operational_role,
      'role_key', _normalized_role_key,
      'job_title', _job_title,
      'specialty', _specialty
    )
  );

  RETURN jsonb_build_object(
    'invitation_id', _invitation_id,
    'token', _token,
    'status', 'pending'
  );
END;
$$;

-- 3. Atualizar get_clinic_pending_collaborator_invitations para expor role_key e telemetria de e-mail
CREATE OR REPLACE FUNCTION public.get_clinic_pending_collaborator_invitations(_clinic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _invitations jsonb;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF NOT (
    public.current_user_can('subaccounts.manage', _clinic_id) OR
    public.current_user_can('subaccounts_roles.manage', _clinic_id) OR
    public.is_platform_owner_mfa_verified(_requester_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar convites desta clínica.';
  END IF;

  -- Auto-expirar convites vencidos
  UPDATE public.clinic_collaborator_invitations
  SET status = 'expired', updated_at = now()
  WHERE clinic_id = _clinic_id
    AND status = 'pending'
    AND expires_at < now();

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'clinic_id', i.clinic_id,
      'email', i.email,
      'operational_role', i.operational_role,
      'role_key', i.role_key,
      'job_title', i.job_title,
      'specialty', i.specialty,
      'token_hash', i.token_hash,
      'status', i.status,
      'created_at', i.created_at,
      'last_resent_at', i.last_resent_at,
      'expires_at', i.expires_at,
      'existing_user_id', i.existing_user_id,
      'email_delivery_status', i.email_delivery_status,
      'email_last_error', i.email_last_error,
      'account_state', CASE
        WHEN u.id IS NOT NULL AND u.email_confirmed_at IS NULL THEN 'registered_unconfirmed'
        WHEN u.id IS NOT NULL AND u.email_confirmed_at IS NOT NULL THEN 'registered_confirmed_pending_acceptance'
        ELSE 'invite_sent'
      END,
      'pending_reason', CASE
        WHEN u.id IS NOT NULL AND u.email_confirmed_at IS NULL THEN 'Conta criada no sistema. Aguardando confirmação do e-mail cadastrado.'
        WHEN u.id IS NOT NULL AND u.email_confirmed_at IS NOT NULL THEN 'E-mail verificado! Aguardando login para ativar o acesso à clínica.'
        ELSE 'Convite enviado por e-mail. Aguardando abertura do link e cadastro da senha.'
      END
    ) ORDER BY i.created_at DESC
  )
  INTO _invitations
  FROM public.clinic_collaborator_invitations i
  LEFT JOIN auth.users u ON lower(u.email) = lower(i.email)
  WHERE i.clinic_id = _clinic_id
    AND i.status = 'pending';

  RETURN COALESCE(_invitations, '[]'::jsonb);
END;
$$;

-- 4. Atualizar manage_clinic_subscription_plan para blindar comparação de enum
CREATE OR REPLACE FUNCTION public.manage_clinic_subscription_plan(
  _clinic_id uuid,
  _new_plan public.subscription_plan,
  _billing_cycle text DEFAULT 'annual'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_current_user_id uuid := auth.uid();
  v_owner_user_id uuid;
  v_is_platform_admin boolean := false;
  v_active_subaccounts_count integer := 0;
  v_sub_record public.clinic_subscriptions%ROWTYPE;
  v_plan_str text := LOWER(_new_plan::text);
  v_billing_cycle text := LOWER(COALESCE(_billing_cycle, 'annual'));
  v_base_monthly_price bigint := 0;
  v_base_subaccount_limit integer := 1;
  v_base_concurrent_access integer := 1;
  v_additional_seat_price bigint := 2990;
BEGIN
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT is_active INTO v_is_platform_admin
  FROM public.platform_admins
  WHERE user_id = v_current_user_id;

  SELECT user_id INTO v_owner_user_id
  FROM public.clinic_memberships
  WHERE clinic_id = _clinic_id
    AND (
      COALESCE(account_role::text, '') IN ('account_owner', 'owner')
      OR COALESCE(operational_role::text, '') = 'owner'
    )
    AND is_active = true
  LIMIT 1;

  IF NOT (COALESCE(v_is_platform_admin, false) = true OR v_owner_user_id = v_current_user_id) THEN
    RAISE EXCEPTION 'Apenas o proprietário da clínica ou um administrador da plataforma pode alterar o plano.';
  END IF;

  v_owner_user_id := COALESCE(v_owner_user_id, v_current_user_id);

  IF v_plan_str IN ('prof_basico', 'prof_medio', 'solo') THEN
    SELECT COUNT(*)::integer INTO v_active_subaccounts_count
    FROM public.clinic_memberships
    WHERE clinic_id = _clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND COALESCE(account_role::text, '') NOT IN ('account_owner', 'owner')
      AND COALESCE(operational_role::text, '') <> 'owner';

    IF v_active_subaccounts_count > 0 THEN
      RAISE EXCEPTION 'Não é possível alterar para plano individual enquanto houver % colaborador(es) ativo(s) cadastrado(s). Desative ou remova os colaboradores primeiro.', v_active_subaccounts_count;
    END IF;
  ELSIF v_plan_str = 'prof_top' THEN
    SELECT COUNT(*)::integer INTO v_active_subaccounts_count
    FROM public.clinic_memberships
    WHERE clinic_id = _clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND COALESCE(account_role::text, '') NOT IN ('account_owner', 'owner')
      AND COALESCE(operational_role::text, '') <> 'owner';

    IF v_active_subaccounts_count > 1 THEN
      RAISE EXCEPTION 'O plano Profissional Top permite no máximo 1 colaborador de apoio (total de 2 membros). Atualmente há % colaboradores ativos.', v_active_subaccounts_count;
    END IF;
  END IF;

  CASE v_plan_str
    WHEN 'prof_basico' THEN
      v_base_monthly_price := CASE WHEN v_billing_cycle = 'annual' THEN 3990 ELSE 4990 END;
      v_base_subaccount_limit := 1;
      v_base_concurrent_access := 1;
    WHEN 'prof_medio' THEN
      v_base_monthly_price := CASE WHEN v_billing_cycle = 'annual' THEN 5990 ELSE 7990 END;
      v_base_subaccount_limit := 1;
      v_base_concurrent_access := 1;
    WHEN 'prof_top' THEN
      v_base_monthly_price := CASE WHEN v_billing_cycle = 'annual' THEN 8990 ELSE 11990 END;
      v_base_subaccount_limit := 2;
      v_base_concurrent_access := 1;
    WHEN 'clinica_basico' THEN
      v_base_monthly_price := CASE WHEN v_billing_cycle = 'annual' THEN 14990 ELSE 18990 END;
      v_base_subaccount_limit := 999999;
      v_base_concurrent_access := 2;
    WHEN 'clinica_intermediario' THEN
      v_base_monthly_price := CASE WHEN v_billing_cycle = 'annual' THEN 24990 ELSE 29990 END;
      v_base_subaccount_limit := 999999;
      v_base_concurrent_access := 5;
    WHEN 'clinica_avancado' THEN
      v_base_monthly_price := CASE WHEN v_billing_cycle = 'annual' THEN 39990 ELSE 49990 END;
      v_base_subaccount_limit := 999999;
      v_base_concurrent_access := 10;
    WHEN 'solo' THEN
      v_base_monthly_price := 0;
      v_base_subaccount_limit := 1;
      v_base_concurrent_access := 1;
    ELSE
      v_base_monthly_price := CASE WHEN v_billing_cycle = 'annual' THEN 14990 ELSE 18990 END;
      v_base_subaccount_limit := 999999;
      v_base_concurrent_access := 2;
  END CASE;

  UPDATE public.clinics
  SET
    subscription_plan = _new_plan,
    subaccount_limit = v_base_subaccount_limit,
    concurrent_access_limit = v_base_concurrent_access,
    updated_at = now()
  WHERE id = _clinic_id;

  INSERT INTO public.clinic_subscriptions (
    clinic_id,
    account_owner_user_id,
    plan_type,
    billing_cycle,
    status,
    base_monthly_price,
    base_subaccount_limit,
    base_concurrent_access_count,
    additional_concurrent_access_count,
    additional_concurrent_access_price,
    total_recurring_monthly_price,
    is_free_trial,
    updated_at
  )
  VALUES (
    _clinic_id,
    v_owner_user_id,
    _new_plan,
    v_billing_cycle,
    'ACTIVE',
    v_base_monthly_price,
    v_base_subaccount_limit,
    v_base_concurrent_access,
    0,
    v_additional_seat_price,
    v_base_monthly_price,
    false,
    now()
  )
  ON CONFLICT (clinic_id) DO UPDATE
  SET
    account_owner_user_id = COALESCE(clinic_subscriptions.account_owner_user_id, EXCLUDED.account_owner_user_id),
    plan_type = EXCLUDED.plan_type,
    billing_cycle = EXCLUDED.billing_cycle,
    base_monthly_price = EXCLUDED.base_monthly_price,
    base_subaccount_limit = EXCLUDED.base_subaccount_limit,
    base_concurrent_access_count = EXCLUDED.base_concurrent_access_count,
    additional_concurrent_access_count = CASE
      WHEN EXCLUDED.plan_type::text IN ('prof_basico', 'prof_medio', 'prof_top', 'solo') THEN 0
      ELSE clinic_subscriptions.additional_concurrent_access_count
    END,
    additional_concurrent_access_price = EXCLUDED.additional_concurrent_access_price,
    total_recurring_monthly_price = EXCLUDED.base_monthly_price + (
      CASE
        WHEN EXCLUDED.plan_type::text IN ('prof_basico', 'prof_medio', 'prof_top', 'solo') THEN 0
        ELSE clinic_subscriptions.additional_concurrent_access_count
      END * EXCLUDED.additional_concurrent_access_price
    ),
    updated_at = now()
  RETURNING * INTO v_sub_record;

  UPDATE public.clinics
  SET account_owner_user_id = COALESCE(account_owner_user_id, v_owner_user_id)
  WHERE id = _clinic_id;

  RETURN jsonb_build_object(
    'success', true,
    'clinic_id', _clinic_id,
    'plan_type', v_sub_record.plan_type,
    'billing_cycle', v_sub_record.billing_cycle,
    'base_subaccount_limit', v_sub_record.base_subaccount_limit,
    'base_concurrent_access_count', v_sub_record.base_concurrent_access_count,
    'additional_concurrent_access_count', v_sub_record.additional_concurrent_access_count,
    'total_recurring_monthly_price', v_sub_record.total_recurring_monthly_price
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_clinic_collaborator(uuid, text, public.operational_role_type, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_clinic_pending_collaborator_invitations(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.manage_clinic_subscription_plan(uuid, public.subscription_plan, text) TO authenticated, service_role;
