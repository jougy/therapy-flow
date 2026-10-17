-- ==========================================================================
-- DOMÍNIO: FINANCE_BILLING (Gerado automaticamente por npm run schema:index)
-- Fonte SSOT: supabase/schema.sql
-- ==========================================================================

-- [RPC/FUNCTION] confirm_asaas_subscription_payment (schema.sql L1650-L1713)
CREATE OR REPLACE FUNCTION "public"."confirm_asaas_subscription_payment"("_asaas_payment_id" "text", "_clinic_id" "uuid", "_paid_value" numeric, "_payment_date" timestamp with time zone DEFAULT "now"(), "_billing_type" "text" DEFAULT 'PIX'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

-- [RPC/FUNCTION] get_asaas_webhook_logs (schema.sql L3354-L3382)
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

-- [RPC/FUNCTION] record_asaas_webhook_event (schema.sql L8430-L8476)
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

-- [RPC/FUNCTION] toggle_subscription_auto_renew (schema.sql L9542-L9570)
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

-- [RPC/FUNCTION] validate_subscription_coupon (schema.sql L10881-L10956)
CREATE OR REPLACE FUNCTION "public"."validate_subscription_coupon"("_code" "text", "_plan_type" "text" DEFAULT 'clinic'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_normalized_code text;
  v_coupon public.subscription_coupons%rowtype;
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

  if not v_coupon.is_active then
    return jsonb_build_object(
      'valid', false,
      'message', 'Este cupom não está mais ativo.'
    );
  end if;

  if v_coupon.valid_from > now() then
    return jsonb_build_object(
      'valid', false,
      'message', 'Este cupom ainda não está vigente.'
    );
  end if;

  if v_coupon.valid_until is not null and v_coupon.valid_until < now() then
    return jsonb_build_object(
      'valid', false,
      'message', 'Este cupom expirou.'
    );
  end if;

  if v_coupon.max_redemptions is not null and v_coupon.times_redeemed >= v_coupon.max_redemptions then
    return jsonb_build_object(
      'valid', false,
      'message', 'Limite máximo de resgates deste cupom atingido.'
    );
  end if;

  if v_coupon.applicable_plans is not null and array_length(v_coupon.applicable_plans, 1) > 0 then
    if not (_plan_type = any(v_coupon.applicable_plans)) then
      return jsonb_build_object(
        'valid', false,
        'message', 'Este cupom não é aplicável ao plano selecionado.'
      );
    end if;
  end if;

  return jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'description', v_coupon.description,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'message', 'Cupom aplicado com sucesso!'
  );
end;
$$;

-- [RPC/FUNCTION] validate_subscription_coupon (schema.sql L10962-L11242)
CREATE OR REPLACE FUNCTION "public"."validate_subscription_coupon"("_code" "text", "_plan_type" "text" DEFAULT 'clinic'::"text", "_clinic_id" "uuid" DEFAULT NULL::"uuid", "_billing_cycle" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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
    'message', 'Cupom aplicado com sucesso!'
  );
end;
$$;

-- [TABLE] asaas_webhook_events (schema.sql L11375-L11385)
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

-- [TABLE] subscription_coupons (schema.sql L12197-L12221)
CREATE TABLE IF NOT EXISTS "public"."subscription_coupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "discount_type" "text" NOT NULL,
    "discount_value" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "max_redemptions" integer,
    "times_redeemed" integer DEFAULT 0 NOT NULL,
    "valid_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valid_until" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "applicable_plans" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "discount_duration_type" "text" DEFAULT 'FOREVER'::"text" NOT NULL,
    "discount_duration_months" integer,
    "eligibility_rules" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "subscription_coupons_code_check" CHECK ((("code" = "upper"(TRIM(BOTH FROM "code"))) AND ("length"("code") >= 3))),
    CONSTRAINT "subscription_coupons_discount_duration_months_check" CHECK ((("discount_duration_months" IS NULL) OR ("discount_duration_months" > 0))),
    CONSTRAINT "subscription_coupons_discount_duration_type_check" CHECK (("discount_duration_type" = ANY (ARRAY['ONCE'::"text", 'REPEATING'::"text", 'FOREVER'::"text"]))),
    CONSTRAINT "subscription_coupons_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['PERCENTAGE'::"text", 'FIXED_AMOUNT'::"text", 'TRIAL_DAYS'::"text"]))),
    CONSTRAINT "subscription_coupons_discount_value_check" CHECK (("discount_value" >= (0)::numeric)),
    CONSTRAINT "subscription_coupons_max_redemptions_check" CHECK ((("max_redemptions" IS NULL) OR ("max_redemptions" > 0))),
    CONSTRAINT "subscription_coupons_times_redeemed_check" CHECK (("times_redeemed" >= 0))
);

-- [TABLE] subscription_invoices (schema.sql L12239-L12275)
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
    "asaas_invoice_id" text,
    "nfe_status" text,
    "nfe_number" text,
    "nfe_pdf_url" text,
    "nfe_xml_url" text,
    "nfe_error_message" text,
    "identification_field" text,
    "bar_code" text,
    CONSTRAINT "subscription_invoices_charge_type_check" CHECK (("charge_type" = ANY (ARRAY['RECURRING_SUBSCRIPTION'::"text", 'ONE_TIME_SUBACCOUNT_EXPANSION'::"text"]))),
    CONSTRAINT "subscription_invoices_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'RECEIVED'::"text", 'CONFIRMED'::"text", 'OVERDUE'::"text", 'REFUNDED'::"text", 'DELETED'::"text", 'DUNNING_RECEIVED'::"text", 'RECEIVED_IN_CASH'::"text", 'AWAITING_PAYMENT'::"text"])))
);

-- [POLICY] Owners e gestores podem ver as faturas ON subscription_invoices (schema.sql L14111-L14113)
CREATE POLICY "Owners e gestores podem ver as faturas" ON "public"."subscription_invoices" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clinic_memberships" "cm"
  WHERE (("cm"."clinic_id" = "subscription_invoices"."clinic_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."is_active" = true) AND ("cm"."membership_status" = 'active'::"public"."membership_status_type") AND (("cm"."account_role" = 'account_owner'::"public"."account_role_type") OR "public"."current_user_can"('subscription_billing.read'::"text", "subscription_invoices"."clinic_id"))))));

-- [POLICY] Platform admins podem ver eventos de webhook ON asaas_webhook_events (schema.sql L14117-L14119)
CREATE POLICY "Platform admins podem ver eventos de webhook" ON "public"."asaas_webhook_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins" "pa"
  WHERE (("pa"."user_id" = "auth"."uid"()) AND ("pa"."is_active" = true)))));

-- [POLICY] Platform admins podem ver todas as faturas ON subscription_invoices (schema.sql L14135-L14137)
CREATE POLICY "Platform admins podem ver todas as faturas" ON "public"."subscription_invoices" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins" "pa"
  WHERE (("pa"."user_id" = "auth"."uid"()) AND ("pa"."is_active" = true)))));

-- [POLICY] Platform admins possuem controle total dos cupons ON subscription_coupons (schema.sql L14141-L14143)
CREATE POLICY "Platform admins possuem controle total dos cupons" ON "public"."subscription_coupons" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins" "pa"
  WHERE (("pa"."user_id" = "auth"."uid"()) AND ("pa"."is_active" = true)))));

-- [POLICY] Todos autenticados e anonimos podem consultar cupons ativos ON subscription_coupons (schema.sql L14255-L14255)
CREATE POLICY "Todos autenticados e anonimos podem consultar cupons ativos" ON "public"."subscription_coupons" FOR SELECT USING ((("is_active" = true) AND (("valid_until" IS NULL) OR ("valid_until" >= "now"()))));
