-- ==========================================================================
-- DOMÍNIO: FINANCE_BILLING (Gerado automaticamente por npm run schema:index)
-- Fonte SSOT: supabase/schema.sql
-- ==========================================================================

-- [RPC/FUNCTION] change_clinic_subscription_plan (schema.sql L1997-L2004)
CREATE OR REPLACE FUNCTION "public"."change_clinic_subscription_plan"("_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_billing_cycle" "text" DEFAULT 'annual'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN public.manage_clinic_subscription_plan(_clinic_id, _new_plan, _billing_cycle);
END;
$$;

-- [RPC/FUNCTION] check_clinic_plan_quota (schema.sql L2049-L2155)
CREATE OR REPLACE FUNCTION "public"."check_clinic_plan_quota"("p_clinic_id" "uuid", "p_feature_type" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sub record;
  v_count integer := 0;
  v_allowed boolean := true;
  v_limit integer := 0;
  v_is_trial boolean := false;
  v_message text := '';
  v_plan_text text;
  v_is_courtesy boolean := false;
BEGIN
  -- Buscar assinatura da clínica
  SELECT * INTO v_sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = p_clinic_id
  LIMIT 1;

  -- Checar explicitamente se é cortesia parceira
  IF v_sub IS NOT NULL AND (v_sub.status = 'COURTESY' OR COALESCE(v_sub.is_courtesy, false) = true) THEN
    v_is_courtesy := true;
  END IF;

  -- Se não encontrou ou se for trial / beta (e NÃO for cortesia)
  IF NOT v_is_courtesy AND (v_sub IS NULL OR v_sub.status = 'TRIAL' OR COALESCE(v_sub.is_free_trial, false) = true OR v_sub.status = 'BETA') THEN
    v_is_trial := true;
  END IF;

  v_plan_text := LOWER(COALESCE(v_sub.plan_type::text, 'clinica_medio'));

  -- Checagem de Atendimentos (Sessões)
  IF p_feature_type = 'attendances' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.sessions
    WHERE clinic_id = p_clinic_id
      AND status NOT IN ('cancelado', 'rascunho');

    IF v_is_trial THEN
      v_limit := COALESCE(v_sub.trial_max_attendances, 20);
      IF v_count >= v_limit THEN
        v_allowed := false;
        v_message := 'Você atingiu o limite de ' || v_limit || ' atendimentos do seu período de teste grátis. Faça o upgrade para continuar evoluindo seus pacientes.';
      END IF;
    ELSE
      -- Ilimitado em todos os planos pagos e cortesias
      v_limit := -1;
      v_allowed := true;
    END IF;

  -- Checagem de Pacientes
  ELSIF p_feature_type = 'patients' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.patients
    WHERE clinic_id = p_clinic_id
      AND is_active = true;

    IF v_is_trial THEN
      v_limit := COALESCE(v_sub.trial_max_patients, 5);
      IF v_count >= v_limit THEN
        v_allowed := false;
        v_message := 'Você atingiu o limite de ' || v_limit || ' pacientes do seu período de teste grátis. Faça o upgrade para cadastrar novos pacientes.';
      END IF;
    ELSE
      -- Ilimitado em todos os planos pagos e cortesias
      v_limit := -1;
      v_allowed := true;
    END IF;

  -- Checagem de Modelos de Formulário Personalizados
  ELSIF p_feature_type = 'custom_forms' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.anamnesis_form_templates
    WHERE clinic_id = p_clinic_id
      AND is_system_default = false
      AND is_active = true;

    IF v_is_trial THEN
      v_limit := COALESCE(v_sub.trial_max_custom_forms, 1);
      IF v_count >= v_limit THEN
        v_allowed := false;
        v_message := 'O plano de teste grátis permite 1 modelo de formulário personalizado ativo. Faça o upgrade para criar modelos ilimitados.';
      END IF;
    ELSIF v_plan_text = 'prof_basico' AND NOT v_is_courtesy THEN
      -- prof_basico regular tem cota de 1 formulário customizado complementar ativo
      v_limit := 1;
      IF v_count >= v_limit THEN
        v_allowed := false;
        v_message := 'O Plano Profissional Básico permite 1 modelo customizado ativo complementar ao formulário padrão universal. Faça upgrade para formulários ilimitados.';
      END IF;
    ELSE
      -- Todos os outros planos (e cortesia) têm formulários customizados ilimitados (-1)
      v_limit := -1;
      v_allowed := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'current_count', v_count,
    'max_limit', v_limit,
    'is_free_trial', v_is_trial,
    'message', v_message
  );
END;
$$;

-- [RPC/FUNCTION] confirm_asaas_subscription_payment (schema.sql L2353-L2425)
CREATE OR REPLACE FUNCTION "public"."confirm_asaas_subscription_payment"("_asaas_payment_id" "text", "_clinic_id" "uuid", "_paid_value" numeric, "_payment_date" timestamp with time zone DEFAULT "now"(), "_billing_type" "text" DEFAULT 'PIX'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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

-- [RPC/FUNCTION] get_asaas_webhook_logs (schema.sql L4550-L4578)
CREATE OR REPLACE FUNCTION "public"."get_asaas_webhook_logs"("_limit" integer DEFAULT 50, "_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "asaas_event_id" "text", "event_type" "text", "payload" "jsonb", "processed" boolean, "processed_at" timestamp with time zone, "error_message" "text", "signature" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not exists (
    select 1 from public.platform_admins
    where user_id = auth.uid() and is_active = true
  ) then
    raise exception 'Acesso negado: apenas administradores da plataforma podem acessar os logs de webhooks.';
  end if;

  return query
  select
    awe.id,
    awe.asaas_event_id,
    awe.event_type,
    awe.payload,
    awe.processed,
    awe.processed_at,
    awe.error_message,
    awe.signature,
    awe.created_at
  from public.asaas_webhook_events awe
  order by awe.created_at desc
  limit greatest(1, least(200, coalesce(_limit, 50)))
  offset greatest(0, coalesce(_offset, 0));
end;
$$;

-- [RPC/FUNCTION] get_clinic_subscription_summary (schema.sql L5470-L5552)
CREATE OR REPLACE FUNCTION "public"."get_clinic_subscription_summary"("_clinic_id" "uuid") RETURNS TABLE("subscription_id" "uuid", "clinic_id" "uuid", "account_owner_user_id" "uuid", "plan_type" "public"."subscription_plan", "status" "text", "billing_cycle" "text", "payment_method" "text", "base_monthly_price" numeric, "total_recurring_monthly_price" numeric, "base_subaccount_limit" integer, "purchased_subaccount_extra_count" integer, "total_subaccount_limit" integer, "base_concurrent_access_count" integer, "additional_concurrent_access_count" integer, "total_concurrent_access_limit" integer, "next_due_date" "date", "current_period_start" timestamp with time zone, "current_period_end" timestamp with time zone, "expires_at" timestamp with time zone, "period_duration_days" integer, "auto_renew" boolean, "days_remaining" integer, "is_expired" boolean, "asaas_customer_id" "text", "asaas_subscription_id" "text", "applied_coupon_id" "uuid", "coupon_code" "text", "discount_percentage" numeric, "discount_fixed_amount" numeric, "trial_ends_at" timestamp with time zone, "override_reason" "text", "override_by_user_id" "uuid", "override_at" timestamp with time zone, "cpf_cnpj" "text", "billing_email" "text", "billing_name" "text", "billing_due_window" "text", "billing_due_window_updated_at" timestamp with time zone, "can_change_billing_window" boolean, "next_allowed_billing_window_change" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.clinic_id = _clinic_id
        AND cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.membership_status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
        AND pa.is_active = true
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado: você não tem permissão para visualizar a assinatura desta clínica.';
  END IF;

  RETURN QUERY
  SELECT
    cs.id AS subscription_id,
    cs.clinic_id,
    cs.account_owner_user_id,
    cs.plan_type,
    cs.status,
    cs.billing_cycle,
    cs.payment_method,
    cs.base_monthly_price,
    cs.total_recurring_monthly_price,
    cs.base_subaccount_limit,
    cs.purchased_subaccount_extra_count,
    (CASE 
      WHEN cs.plan_type::text IN ('prof_basico', 'prof_medio', 'solo') THEN 1
      WHEN cs.plan_type::text = 'prof_top' THEN 2
      ELSE 999999
    END)::integer AS total_subaccount_limit,
    cs.base_concurrent_access_count,
    cs.additional_concurrent_access_count,
    (CASE 
      WHEN cs.plan_type::text IN ('prof_basico', 'prof_medio', 'solo') THEN 1 
      WHEN cs.plan_type::text = 'prof_top' THEN 2
      WHEN cs.plan_type::text = 'clinica_basico' THEN (2 + COALESCE(cs.additional_concurrent_access_count, 0))
      WHEN cs.plan_type::text IN ('clinica_top', 'enterprise') THEN (COALESCE(cs.base_concurrent_access_count, 8) + COALESCE(cs.additional_concurrent_access_count, 0))
      ELSE (COALESCE(cs.base_concurrent_access_count, 4) + COALESCE(cs.additional_concurrent_access_count, 0)) 
    END)::integer AS total_concurrent_access_limit,
    cs.next_due_date,
    cs.current_period_start,
    cs.current_period_end,
    COALESCE(cs.expires_at, cs.current_period_end, cs.current_period_start + interval '30 days') AS expires_at,
    COALESCE(cs.period_duration_days, 30) AS period_duration_days,
    COALESCE(cs.auto_renew, true) AS auto_renew,
    GREATEST(0, EXTRACT(DAY FROM (COALESCE(cs.expires_at, cs.current_period_end, cs.current_period_start + interval '30 days') - now()))::integer) AS days_remaining,
    (CASE WHEN COALESCE(cs.expires_at, cs.current_period_end) < now() AND cs.status NOT IN ('BETA', 'TRIAL', 'COURTESY') THEN true ELSE false END) AS is_expired,
    cs.asaas_customer_id,
    cs.asaas_subscription_id,
    cs.applied_coupon_id,
    cs.coupon_code,
    cs.discount_percentage,
    cs.discount_fixed_amount,
    cs.trial_ends_at,
    cs.override_reason,
    cs.override_by_user_id,
    cs.override_at,
    cs.cpf_cnpj,
    cs.billing_email,
    cs.billing_name,
    COALESCE(cs.billing_due_window, 'DAY_1_TO_5') AS billing_due_window,
    cs.billing_due_window_updated_at,
    (CASE 
      WHEN cs.billing_due_window_updated_at IS NULL THEN true
      WHEN EXTRACT(DAY FROM (clock_timestamp() - cs.billing_due_window_updated_at)) >= 30 THEN true
      ELSE false
    END) AS can_change_billing_window,
    (COALESCE(cs.billing_due_window_updated_at, clock_timestamp()) + interval '30 days') AS next_allowed_billing_window_change
  FROM public.clinic_subscriptions cs
  WHERE cs.clinic_id = _clinic_id
  LIMIT 1;
END;
$$;

-- [RPC/FUNCTION] is_clinic_subscription_manager (schema.sql L8382-L8404)
CREATE OR REPLACE FUNCTION "public"."is_clinic_subscription_manager"("_user_id" "uuid", "_clinic_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = _clinic_id
      AND c.account_owner_user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.clinic_memberships cm
    WHERE cm.clinic_id = _clinic_id
      AND cm.user_id = _user_id
      AND (cm.account_role = 'account_owner' OR cm.operational_role = 'owner')
      AND cm.is_active = true
      AND cm.membership_status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE pa.user_id = _user_id
      AND pa.is_active = true
  );
$$;

-- [RPC/FUNCTION] manage_clinic_subscription_plan (schema.sql L9611-L9803)
CREATE OR REPLACE FUNCTION "public"."manage_clinic_subscription_plan"("_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_billing_cycle" "text" DEFAULT 'annual'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
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

  IF v_owner_user_id IS NULL THEN
    SELECT account_owner_user_id INTO v_owner_user_id
    FROM public.clinics
    WHERE id = _clinic_id;
  END IF;

  IF NOT (COALESCE(v_is_platform_admin, false) = true OR public.is_platform_owner(v_current_user_id) OR v_owner_user_id = v_current_user_id) THEN
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
      v_base_concurrent_access := 2;
    WHEN 'clinica_basico' THEN
      v_base_monthly_price := CASE WHEN v_billing_cycle = 'annual' THEN 14990 ELSE 18990 END;
      v_base_subaccount_limit := 999999;
      v_base_concurrent_access := 2;
    WHEN 'clinica_medio', 'clinica_intermediario', 'clinic' THEN
      v_base_monthly_price := CASE WHEN v_billing_cycle = 'annual' THEN 24990 ELSE 29990 END;
      v_base_subaccount_limit := 999999;
      v_base_concurrent_access := 4;
    WHEN 'clinica_top', 'clinica_avancado', 'enterprise' THEN
      v_base_monthly_price := CASE WHEN v_billing_cycle = 'annual' THEN 39990 ELSE 49990 END;
      v_base_subaccount_limit := 999999;
      v_base_concurrent_access := 8;
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
    access_status = COALESCE(NULLIF(btrim(access_status), ''), 'active'),
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
    is_read_only,
    expires_at,
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
    false,
    NULL,
    now()
  )
  ON CONFLICT (clinic_id) DO UPDATE
  SET
    account_owner_user_id = COALESCE(clinic_subscriptions.account_owner_user_id, EXCLUDED.account_owner_user_id),
    plan_type = EXCLUDED.plan_type,
    billing_cycle = EXCLUDED.billing_cycle,
    status = 'ACTIVE',
    is_free_trial = false,
    is_read_only = false,
    expires_at = NULL,
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

-- [RPC/FUNCTION] record_and_validate_asaas_webhook (schema.sql L10981-L11029)
CREATE OR REPLACE FUNCTION "public"."record_and_validate_asaas_webhook"("_event_id" "text", "_event_type" "text", "_payload" "jsonb", "_signature" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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

-- [RPC/FUNCTION] record_asaas_webhook_event (schema.sql L11035-L11081)
CREATE OR REPLACE FUNCTION "public"."record_asaas_webhook_event"("_event_id" "text", "_event_type" "text", "_payload" "jsonb", "_signature" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

-- [RPC/FUNCTION] set_clinic_subscriptions_updated_at (schema.sql L12257-L12264)
CREATE OR REPLACE FUNCTION "public"."set_clinic_subscriptions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

-- [RPC/FUNCTION] sync_clinic_daily_metrics (schema.sql L12980-L13029)
CREATE OR REPLACE FUNCTION "public"."sync_clinic_daily_metrics"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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

-- [RPC/FUNCTION] sync_clinic_limits_from_subscription (schema.sql L13035-L13083)
CREATE OR REPLACE FUNCTION "public"."sync_clinic_limits_from_subscription"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_effective_subaccount_limit integer;
  v_effective_concurrent_access_limit integer;
  v_base_subaccounts integer;
  v_base_concurrent integer;
  v_plan text := LOWER(NEW.plan_type::text);
BEGIN
  IF v_plan IN ('prof_basico', 'prof_medio', 'solo') THEN
    v_base_subaccounts := 1;
    v_base_concurrent := 1;
  ELSIF v_plan = 'prof_top' THEN
    v_base_subaccounts := 2; -- Titular + 1 Apoio
    v_base_concurrent := 2;
  ELSIF v_plan = 'clinica_basico' THEN
    v_base_subaccounts := 999999; -- Colaboradores ilimitados no cadastro
    v_base_concurrent := 2;
  ELSIF v_plan IN ('clinica_medio', 'clinic') THEN
    v_base_subaccounts := 999999; -- Colaboradores ilimitados no cadastro
    v_base_concurrent := 4;
  ELSIF v_plan IN ('clinica_top', 'enterprise') THEN
    v_base_subaccounts := 999999; -- Colaboradores ilimitados no cadastro
    v_base_concurrent := COALESCE(NEW.base_concurrent_access_count, 8);
  ELSE
    v_base_subaccounts := COALESCE(NEW.base_subaccount_limit, 999999);
    v_base_concurrent := COALESCE(NEW.base_concurrent_access_count, 4);
  END IF;

  v_effective_subaccount_limit := CASE
    WHEN v_base_subaccounts >= 999999 THEN 999999
    ELSE v_base_subaccounts + COALESCE(NEW.purchased_subaccount_extra_count, 0)
  END;

  v_effective_concurrent_access_limit := v_base_concurrent + COALESCE(NEW.additional_concurrent_access_count, 0);

  UPDATE public.clinics
  SET
    subscription_plan = NEW.plan_type,
    subaccount_limit = v_effective_subaccount_limit,
    concurrent_access_limit = v_effective_concurrent_access_limit,
    updated_at = now()
  WHERE id = NEW.clinic_id;

  RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] toggle_subscription_auto_renew (schema.sql L13218-L13246)
CREATE OR REPLACE FUNCTION "public"."toggle_subscription_auto_renew"("_clinic_id" "uuid", "_auto_renew" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Verificar se quem esta chamando e o owner da clinica ou admin da plataforma
  SELECT account_owner_user_id INTO v_owner_id
  FROM public.clinics
  WHERE id = _clinic_id;

  IF v_owner_id IS DISTINCT FROM auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Apenas o proprietário da clínica pode alterar a renovação automática.';
  END IF;

  UPDATE public.clinic_subscriptions
  SET auto_renew = _auto_renew,
      updated_at = now()
  WHERE clinic_id = _clinic_id;

  RETURN jsonb_build_object(
    'success', true,
    'auto_renew', _auto_renew
  );
END;
$$;

-- [RPC/FUNCTION] update_clinic_billing_due_window (schema.sql L13398-L13524)
CREATE OR REPLACE FUNCTION "public"."update_clinic_billing_due_window"("_clinic_id" "uuid", "_window" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sub record;
  v_is_owner boolean;
  v_is_admin boolean;
  v_last_updated timestamptz;
  v_now timestamptz := clock_timestamp();
  v_days_since_last_update integer;
  v_next_allowed_at timestamptz;
  v_target_day integer;
  v_current_next_due date;
  v_new_next_due date;
BEGIN
  -- Validar parâmetro de entrada
  IF _window NOT IN ('DAY_1_TO_5', 'DAY_10_TO_15', 'DAY_25_TO_30') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Janela de vencimento inválida. Opções permitidas: DAY_1_TO_5, DAY_10_TO_15, DAY_25_TO_30.'
    );
  END IF;

  -- Verificar autorização: proprietário da clínica ou platform_admin
  SELECT (cm.account_role = 'account_owner' AND cm.is_active = true)
  INTO v_is_owner
  FROM public.clinic_memberships cm
  WHERE cm.clinic_id = _clinic_id AND cm.user_id = v_user_id;

  SELECT (pa.is_active = true)
  INTO v_is_admin
  FROM public.platform_admins pa
  WHERE pa.user_id = v_user_id;

  IF NOT (COALESCE(v_is_owner, false) OR COALESCE(v_is_admin, false)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Apenas o proprietário da clínica ou administrador pode alterar as preferências de cobrança.'
    );
  END IF;

  -- Buscar assinatura atual
  SELECT * INTO v_sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _clinic_id;

  IF v_sub.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Assinatura da clínica não encontrada.'
    );
  END IF;

  -- Se já for a mesma janela, apenas retornar sucesso
  IF v_sub.billing_due_window = _window THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'A janela de vencimento informada já está ativa.',
      'billing_due_window', _window,
      'billing_due_window_updated_at', v_sub.billing_due_window_updated_at
    );
  END IF;

  -- Validar se já houve alteração nos últimos 30 dias (Regra: 1 vez por mês)
  v_last_updated := v_sub.billing_due_window_updated_at;
  IF v_last_updated IS NOT NULL THEN
    v_days_since_last_update := EXTRACT(DAY FROM (v_now - v_last_updated))::integer;
    v_next_allowed_at := v_last_updated + interval '30 days';
    
    -- Se tiver sido alterado há menos de 30 dias e não for a primeira configuração
    IF v_days_since_last_update < 30 AND v_sub.billing_due_window IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('A janela de vencimento só pode ser alterada uma vez a cada 30 dias. Próxima alteração permitida em %s.', to_char(v_next_allowed_at, 'DD/MM/YYYY')),
        'next_allowed_at', v_next_allowed_at,
        'days_remaining', (30 - v_days_since_last_update)
      );
    END IF;
  END IF;

  -- Mapear dia de vencimento alvo da janela escolhida
  v_target_day := CASE 
    WHEN _window = 'DAY_1_TO_5' THEN 5
    WHEN _window = 'DAY_10_TO_15' THEN 15
    WHEN _window = 'DAY_25_TO_30' THEN 30
    ELSE 5
  END;

  -- Calcular o vencimento para o próximo ciclo subsequente
  v_current_next_due := COALESCE(v_sub.next_due_date, CURRENT_DATE + interval '30 days');
  -- Ajustar para o dia alvo mantendo ou projetando para o mês seguinte
  v_new_next_due := make_date(
    EXTRACT(YEAR FROM v_current_next_due)::integer,
    EXTRACT(MONTH FROM v_current_next_due)::integer,
    LEAST(v_target_day, EXTRACT(DAY FROM (date_trunc('month', v_current_next_due) + interval '1 month - 1 day'))::integer)
  );

  IF v_new_next_due <= CURRENT_DATE THEN
    v_new_next_due := make_date(
      EXTRACT(YEAR FROM v_current_next_due + interval '1 month')::integer,
      EXTRACT(MONTH FROM v_current_next_due + interval '1 month')::integer,
      LEAST(v_target_day, EXTRACT(DAY FROM (date_trunc('month', v_current_next_due + interval '1 month') + interval '1 month - 1 day'))::integer)
    );
  END IF;

  -- Atualizar registro na base local
  UPDATE public.clinic_subscriptions
  SET 
    billing_due_window = _window,
    billing_due_window_updated_at = v_now,
    next_due_date = v_new_next_due,
    updated_at = v_now
  WHERE clinic_id = _clinic_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Janela de vencimento atualizada com sucesso para os próximos ciclos.',
    'billing_due_window', _window,
    'billing_due_window_updated_at', v_now,
    'target_due_day', v_target_day,
    'next_due_date', v_new_next_due,
    'next_allowed_at', v_now + interval '30 days'
  );
END;
$$;

-- [RPC/FUNCTION] validate_subscription_coupon (schema.sql L14812-L15094)
CREATE OR REPLACE FUNCTION "public"."validate_subscription_coupon"("_code" "text", "_plan_type" "text" DEFAULT 'clinic'::"text", "_clinic_id" "uuid" DEFAULT NULL::"uuid", "_billing_cycle" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_normalized_code text;
  v_coupon public.subscription_coupons%rowtype;
  v_rules jsonb;
  v_clinic record;
  v_collaborator_count integer;
  v_session_count integer;
  v_patient_count integer;
  v_paid_invoices_count integer;
  v_is_winback boolean;
  v_mode text;
  v_after date;
  v_before date;
  v_op text;
  v_val integer;
  v_allowed_cycles jsonb;
  v_allowed_states jsonb;
begin
  if _code is null or trim(_code) = '' then
    return jsonb_build_object(
      'valid', false,
      'message', 'Código do cupom não informado.'
    );
  end if;

  v_normalized_code := upper(trim(_code));

  select * into v_coupon
  from public.subscription_coupons
  where code = v_normalized_code;

  if v_coupon.id is null then
    return jsonb_build_object(
      'valid', false,
      'message', 'Cupom inválido ou não encontrado.'
    );
  end if;

  -- 1. Status manual
  if not v_coupon.is_active then
    return jsonb_build_object(
      'valid', false,
      'message', 'Este cupom está temporariamente pausado ou desativado.'
    );
  end if;

  -- 2. Vigência temporal inicial
  if v_coupon.valid_from > now() then
    return jsonb_build_object(
      'valid', false,
      'message', 'Este cupom ainda não está vigente (inicia em ' || to_char(v_coupon.valid_from, 'DD/MM/YYYY') || ').'
    );
  end if;

  -- 3. Vigência temporal final
  if v_coupon.valid_until is not null and v_coupon.valid_until < now() then
    return jsonb_build_object(
      'valid', false,
      'message', 'Este cupom expirou em ' || to_char(v_coupon.valid_until, 'DD/MM/YYYY') || '.'
    );
  end if;

  -- 4. Limite de resgates
  if v_coupon.max_redemptions is not null and v_coupon.times_redeemed >= v_coupon.max_redemptions then
    return jsonb_build_object(
      'valid', false,
      'message', 'O limite máximo de resgates deste cupom foi atingido.'
    );
  end if;

  -- 5. Planos aplicáveis
  if v_coupon.applicable_plans is not null and array_length(v_coupon.applicable_plans, 1) > 0 then
    if not (_plan_type = any(v_coupon.applicable_plans)) then
      return jsonb_build_object(
        'valid', false,
        'message', 'Este cupom não é aplicável ao plano selecionado (' || _plan_type || ').'
      );
    end if;
  end if;

  v_rules := coalesce(v_coupon.eligibility_rules, '{}'::jsonb);

  -- 6. Validação de Ciclos de Cobrança Alvo (se informado)
  v_allowed_cycles := v_rules->'target_billing_cycles';
  if v_allowed_cycles is not null and jsonb_typeof(v_allowed_cycles) = 'array' and jsonb_array_length(v_allowed_cycles) > 0 then
    if _billing_cycle is not null and trim(_billing_cycle) <> '' then
      if not (v_allowed_cycles ? lower(trim(_billing_cycle))) then
        return jsonb_build_object(
          'valid', false,
          'message', 'Este cupom é exclusivo para ciclos de cobrança específicos (ex: ' || coalesce(v_rules->>'target_billing_cycles_label', 'outro ciclo') || ').'
        );
      end if;
    end if;
  end if;

  -- 7. Validação de Condições da Conta / Clínica (se _clinic_id for fornecido)
  if _clinic_id is not null then
    select id, created_at, address_state, access_status
    into v_clinic
    from public.clinics
    where id = _clinic_id;

    if v_clinic.id is not null then
      -- 7.1 Data de Criação da Clínica
      if v_rules->'account_creation' is not null then
        v_mode := v_rules->'account_creation'->>'mode';
        if v_mode = 'after' and (v_rules->'account_creation'->>'after_date') is not null then
          v_after := (v_rules->'account_creation'->>'after_date')::date;
          if v_clinic.created_at::date < v_after then
            return jsonb_build_object(
              'valid', false,
              'message', 'Este cupom é válido apenas para clínicas cadastradas a partir de ' || to_char(v_after, 'DD/MM/YYYY') || '.'
            );
          end if;
        elsif v_mode = 'before' and (v_rules->'account_creation'->>'before_date') is not null then
          v_before := (v_rules->'account_creation'->>'before_date')::date;
          if v_clinic.created_at::date > v_before then
            return jsonb_build_object(
              'valid', false,
              'message', 'Este cupom é válido apenas para clínicas cadastradas antes de ' || to_char(v_before, 'DD/MM/YYYY') || '.'
            );
          end if;
        elsif v_mode = 'between' then
          v_after := (v_rules->'account_creation'->>'after_date')::date;
          v_before := (v_rules->'account_creation'->>'before_date')::date;
          if v_after is not null and v_clinic.created_at::date < v_after then
            return jsonb_build_object(
              'valid', false,
              'message', 'Este cupom é válido apenas para contas criadas entre ' || to_char(v_after, 'DD/MM/YYYY') || ' e ' || to_char(v_before, 'DD/MM/YYYY') || '.'
            );
          end if;
          if v_before is not null and v_clinic.created_at::date > v_before then
            return jsonb_build_object(
              'valid', false,
              'message', 'Este cupom é válido apenas para contas criadas entre ' || to_char(v_after, 'DD/MM/YYYY') || ' e ' || to_char(v_before, 'DD/MM/YYYY') || '.'
            );
          end if;
        end if;
      end if;

      -- 7.2 Quantidade de Colaboradores Registrados
      if (v_rules->'collaborators'->>'enabled')::boolean is true then
        v_op := coalesce(v_rules->'collaborators'->>'operator', 'gte');
        v_val := coalesce((v_rules->'collaborators'->>'value')::integer, 0);

        select count(*)::integer into v_collaborator_count
        from public.clinic_memberships
        where clinic_id = _clinic_id and is_active = true;

        if v_op = 'gte' and v_collaborator_count < v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Sua clínica precisa ter pelo menos ' || v_val || ' colaboradores ativos para aplicar este cupom (atual: ' || v_collaborator_count || ').'
          );
        elsif v_op = 'lte' and v_collaborator_count > v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom é restrito a equipes de até ' || v_val || ' colaboradores (atual: ' || v_collaborator_count || ').'
          );
        elsif v_op = 'eq' and v_collaborator_count <> v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom exige exatamente ' || v_val || ' colaboradores registrados (atual: ' || v_collaborator_count || ').'
          );
        end if;
      end if;

      -- 7.3 Quantidade de Atendimentos Realizados (sessões clínicas)
      if (v_rules->'sessions'->>'enabled')::boolean is true then
        v_op := coalesce(v_rules->'sessions'->>'operator', 'gte');
        v_val := coalesce((v_rules->'sessions'->>'value')::integer, 0);

        select count(*)::integer into v_session_count
        from public.sessions
        where clinic_id = _clinic_id;

        if v_op = 'gte' and v_session_count < v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Sua clínica precisa ter no mínimo ' || v_val || ' atendimentos registrados para desbloquear este cupom (atual: ' || v_session_count || ').'
          );
        elsif v_op = 'lte' and v_session_count > v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom é exclusivo para clínicas com até ' || v_val || ' atendimentos (atual: ' || v_session_count || ').'
          );
        elsif v_op = 'eq' and v_session_count <> v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom exige exatamente ' || v_val || ' atendimentos realizados (atual: ' || v_session_count || ').'
          );
        end if;
      end if;

      -- 7.4 Sugestão 1: Apenas Primeira Assinatura / Novos Clientes
      if (v_rules->>'first_subscription_only')::boolean is true then
        select count(*)::integer into v_paid_invoices_count
        from public.subscription_invoices
        where clinic_id = _clinic_id and status in ('CONFIRMED', 'RECEIVED');

        if v_paid_invoices_count > 0 then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom de boas-vindas é exclusivo para novos clientes na primeira contratação.'
          );
        end if;
      end if;

      -- 7.5 Sugestão 2: Quantidade de Pacientes Cadastrados
      if (v_rules->'patients'->>'enabled')::boolean is true then
        v_op := coalesce(v_rules->'patients'->>'operator', 'gte');
        v_val := coalesce((v_rules->'patients'->>'value')::integer, 0);

        select count(*)::integer into v_patient_count
        from public.patients
        where clinic_id = _clinic_id;

        if v_op = 'gte' and v_patient_count < v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Sua clínica precisa ter pelo menos ' || v_val || ' pacientes cadastrados para este cupom (atual: ' || v_patient_count || ').'
          );
        elsif v_op = 'lte' and v_patient_count > v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom é voltado para consultórios com até ' || v_val || ' pacientes (atual: ' || v_patient_count || ').'
          );
        elsif v_op = 'eq' and v_patient_count <> v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom exige exatamente ' || v_val || ' pacientes cadastrados (atual: ' || v_patient_count || ').'
          );
        end if;
      end if;

      -- 7.6 Sugestão 4: Condição Winback (Apenas Clínicas Inativas/Canceladas)
      if (v_rules->>'winback_only')::boolean is true then
        select exists (
          select 1 from public.clinic_subscriptions
          where clinic_id = _clinic_id
            and status in ('CANCELED', 'EXPIRED', 'SUSPENDED', 'OVERDUE')
        ) into v_is_winback;

        if not v_is_winback and v_clinic.access_status not in ('suspended', 'blocked', 'past_due') then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom de reativação é exclusivo para contas inativas ou que estão retornando à plataforma.'
          );
        end if;
      end if;

      -- 7.7 Sugestão 5: Filtro Regional por Estado (UF)
      v_allowed_states := v_rules->'allowed_states';
      if v_allowed_states is not null and jsonb_typeof(v_allowed_states) = 'array' and jsonb_array_length(v_allowed_states) > 0 then
        if v_clinic.address_state is null or not (v_allowed_states ? upper(trim(v_clinic.address_state))) then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom é restrito a clínicas sediadas em estados específicos atendidos pela parceria regional.'
          );
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'description', v_coupon.description,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'discount_duration_type', v_coupon.discount_duration_type,
    'discount_duration_months', v_coupon.discount_duration_months,
    'affiliate_id', v_coupon.affiliate_id,
    'is_affiliate_coupon', coalesce(v_coupon.is_affiliate_coupon, false),
    'message', 'Cupom aplicado com sucesso!'
  );
end;
$$;

-- [TABLE] asaas_webhook_events (schema.sql L15446-L15456)
CREATE TABLE IF NOT EXISTS "public"."asaas_webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asaas_event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "processed" boolean DEFAULT false,
    "processed_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "signature" "text"
);

-- [TABLE] clinic_daily_metrics (schema.sql L15504-L15514)
CREATE TABLE IF NOT EXISTS "public"."clinic_daily_metrics" (
    "clinic_id" "uuid" NOT NULL,
    "metric_date" "date" NOT NULL,
    "total_sessions" integer DEFAULT 0 NOT NULL,
    "canceled_sessions" integer DEFAULT 0 NOT NULL,
    "paid_sessions" integer DEFAULT 0 NOT NULL,
    "revenue_paid_cents" bigint DEFAULT 0 NOT NULL,
    "revenue_open_cents" bigint DEFAULT 0 NOT NULL,
    "revenue_credit_cents" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [TABLE] clinic_subscriptions (schema.sql L15742-L15794)
CREATE TABLE IF NOT EXISTS "public"."clinic_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "account_owner_user_id" "uuid" NOT NULL,
    "asaas_customer_id" "text",
    "asaas_subscription_id" "text",
    "plan_type" "public"."subscription_plan" DEFAULT 'solo'::"public"."subscription_plan" NOT NULL,
    "billing_cycle" "text" DEFAULT 'MONTHLY'::"text" NOT NULL,
    "payment_method" "text" DEFAULT 'FREE_BETA'::"text" NOT NULL,
    "base_monthly_price" numeric(10,2) DEFAULT 60.00 NOT NULL,
    "base_concurrent_access_count" integer DEFAULT 2 NOT NULL,
    "additional_concurrent_access_count" integer DEFAULT 0 NOT NULL,
    "additional_concurrent_access_price" numeric(10,2) DEFAULT 10.00 NOT NULL,
    "total_recurring_monthly_price" numeric(10,2) DEFAULT 60.00 NOT NULL,
    "base_subaccount_limit" integer DEFAULT 30 NOT NULL,
    "purchased_subaccount_extra_count" integer DEFAULT 0 NOT NULL,
    "purchased_subaccount_unit_price" numeric(10,2) DEFAULT 5.00 NOT NULL,
    "status" "text" DEFAULT 'BETA'::"text" NOT NULL,
    "next_due_date" "date",
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_coupon_id" "uuid",
    "coupon_code" "text",
    "discount_percentage" numeric(5,2) DEFAULT 0.00,
    "discount_fixed_amount" numeric(10,2) DEFAULT 0.00,
    "trial_ends_at" timestamp with time zone,
    "override_reason" "text",
    "override_by_user_id" "uuid",
    "override_at" timestamp with time zone,
    "cpf_cnpj" "text",
    "billing_email" "text",
    "billing_name" "text",
    "is_free_trial" boolean DEFAULT false,
    "trial_max_attendances" integer DEFAULT 20,
    "trial_max_patients" integer DEFAULT 5,
    "trial_max_custom_forms" integer DEFAULT 1,
    "installment_count" integer DEFAULT 1,
    "auto_renew" boolean DEFAULT true,
    "period_duration_days" integer DEFAULT 30,
    "expires_at" timestamp with time zone,
    "is_courtesy" boolean DEFAULT false NOT NULL,
    "courtesy_reason" "text",
    "trial_card_token" "text",
    "is_read_only" boolean DEFAULT false,
    "billing_due_window" "text" DEFAULT 'DAY_1_TO_5'::"text",
    "billing_due_window_updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "clinic_subscriptions_billing_due_window_check" CHECK (("billing_due_window" = ANY (ARRAY['DAY_1_TO_5'::"text", 'DAY_10_TO_15'::"text", 'DAY_25_TO_30'::"text"]))),
    CONSTRAINT "clinic_subscriptions_discount_fixed_amount_check" CHECK (("discount_fixed_amount" >= (0)::numeric)),
    CONSTRAINT "clinic_subscriptions_discount_percentage_check" CHECK ((("discount_percentage" >= (0)::numeric) AND ("discount_percentage" <= (100)::numeric))),
    CONSTRAINT "clinic_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'PENDING'::"text", 'TRIAL'::"text", 'TRIAL_EXPIRED'::"text", 'BETA'::"text", 'OVERDUE'::"text", 'PAUSED'::"text", 'CANCELED'::"text", 'SUSPENDED'::"text", 'EXPIRED'::"text", 'COURTESY'::"text"])))
);

-- [TABLE] subscription_invoices (schema.sql L16832-L16868)
CREATE TABLE IF NOT EXISTS "public"."subscription_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "subscription_id" "uuid",
    "asaas_payment_id" "text" NOT NULL,
    "charge_type" "text" DEFAULT 'RECURRING_SUBSCRIPTION'::"text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "value" numeric(10,2) NOT NULL,
    "net_value" numeric(10,2),
    "due_date" "date" NOT NULL,
    "payment_date" timestamp with time zone,
    "billing_type" "text",
    "invoice_url" "text",
    "bank_slip_url" "text",
    "pix_qr_code" "text",
    "pix_copy_paste" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "asaas_customer_id" "text",
    "asaas_subscription_id" "text",
    "discount_amount" numeric(10,2) DEFAULT 0.00,
    "original_value" numeric(10,2),
    "pix_expiration_date" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "installment_number" integer DEFAULT 1,
    "total_installments" integer DEFAULT 1,
    "asaas_invoice_id" "text",
    "nfe_status" "text",
    "nfe_number" "text",
    "nfe_pdf_url" "text",
    "nfe_xml_url" "text",
    "nfe_error_message" "text",
    "identification_field" "text",
    "bar_code" "text",
    CONSTRAINT "subscription_invoices_charge_type_check" CHECK (("charge_type" = ANY (ARRAY['RECURRING_SUBSCRIPTION'::"text", 'ONE_TIME_SUBACCOUNT_EXPANSION'::"text"]))),
    CONSTRAINT "subscription_invoices_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'RECEIVED'::"text", 'CONFIRMED'::"text", 'OVERDUE'::"text", 'REFUNDED'::"text", 'DELETED'::"text", 'DUNNING_RECEIVED'::"text", 'RECEIVED_IN_CASH'::"text", 'AWAITING_PAYMENT'::"text"])))
);

-- [POLICY] Owners e gestores podem ver a assinatura ON clinic_subscriptions (schema.sql L19716-L19716)
CREATE POLICY "Owners e gestores podem ver a assinatura" ON "public"."clinic_subscriptions" FOR SELECT TO "authenticated" USING ((("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())) OR "public"."user_has_active_clinic_membership"("auth"."uid"(), "clinic_id") OR "public"."current_user_can"('subscription_billing.read'::"text", "clinic_id")));

-- [POLICY] Owners e gestores podem ver as faturas ON subscription_invoices (schema.sql L19720-L19722)
CREATE POLICY "Owners e gestores podem ver as faturas" ON "public"."subscription_invoices" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clinic_memberships" "cm"
  WHERE (("cm"."clinic_id" = "subscription_invoices"."clinic_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."is_active" = true) AND ("cm"."membership_status" = 'active'::"public"."membership_status_type") AND (("cm"."account_role" = 'account_owner'::"public"."account_role_type") OR "public"."current_user_can"('subscription_billing.read'::"text", "subscription_invoices"."clinic_id"))))));

-- [POLICY] Platform admins podem ver eventos de webhook ON asaas_webhook_events (schema.sql L19780-L19782)
CREATE POLICY "Platform admins podem ver eventos de webhook" ON "public"."asaas_webhook_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins" "pa"
  WHERE (("pa"."user_id" = "auth"."uid"()) AND ("pa"."is_active" = true)))));

-- [POLICY] Platform admins podem ver todas as assinaturas ON clinic_subscriptions (schema.sql L19786-L19788)
CREATE POLICY "Platform admins podem ver todas as assinaturas" ON "public"."clinic_subscriptions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins" "pa"
  WHERE (("pa"."user_id" = "auth"."uid"()) AND ("pa"."is_active" = true)))));

-- [POLICY] Platform admins podem ver todas as faturas ON subscription_invoices (schema.sql L19802-L19804)
CREATE POLICY "Platform admins podem ver todas as faturas" ON "public"."subscription_invoices" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins" "pa"
  WHERE (("pa"."user_id" = "auth"."uid"()) AND ("pa"."is_active" = true)))));

-- [POLICY] Platform admins possuem controle total dos cupons ON subscription_coupons (schema.sql L19814-L19816)
CREATE POLICY "Platform admins possuem controle total dos cupons" ON "public"."subscription_coupons" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins" "pa"
  WHERE (("pa"."user_id" = "auth"."uid"()) AND ("pa"."is_active" = true)))));

-- [POLICY] Todos autenticados e anonimos podem consultar cupons ativos ON subscription_coupons (schema.sql L19968-L19968)
CREATE POLICY "Todos autenticados e anonimos podem consultar cupons ativos" ON "public"."subscription_coupons" FOR SELECT USING ((("is_active" = true) AND (("valid_until" IS NULL) OR ("valid_until" >= "now"()))));

-- [POLICY] Users read clinic daily metrics ON clinic_daily_metrics (schema.sql L20100-L20100)
CREATE POLICY "Users read clinic daily metrics" ON "public"."clinic_daily_metrics" FOR SELECT TO "authenticated" USING ((("clinic_id" = COALESCE((NULLIF(("auth"."jwt"() ->> 'active_clinic_id'::"text"), ''::"text"))::"uuid", "public"."get_user_clinic_id"("auth"."uid"()))) AND ("public"."current_user_can"('treasury.read'::"text", "clinic_id") OR "public"."current_user_can"('sessions.read'::"text", "clinic_id"))));
