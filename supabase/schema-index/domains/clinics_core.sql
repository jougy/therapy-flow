-- ==========================================================================
-- DOMÍNIO: CLINICS_CORE (Gerado automaticamente por npm run schema:index)
-- Fonte SSOT: supabase/schema.sql
-- ==========================================================================

-- [RPC/FUNCTION] accept_clinic_collaborator_invitation (schema.sql L172-L442)
CREATE OR REPLACE FUNCTION "public"."accept_clinic_collaborator_invitation"("_token" "text", "_full_name" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _newer_invitation public.clinic_collaborator_invitations%ROWTYPE;
  _profile_exists boolean;
  _clinic_plan text;
  _subaccount_limit integer;
  _active_collaborators_count integer;
  _token_clean text := trim(coalesce(_token, ''));
  _md5_hash text := md5(_token_clean);
  _sha256_hash text;
  _clinic_route_key text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para aceitar o convite.';
  END IF;

  IF _token_clean = '' THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  _user_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF _user_email IS NULL OR _user_email = '' THEN
    SELECT lower(email)
    INTO _user_email
    FROM auth.users
    WHERE id = _user_id;
  END IF;

  BEGIN
    _sha256_hash := encode(extensions.digest(_token_clean, 'sha256'), 'hex');
  EXCEPTION WHEN OTHERS THEN
    _sha256_hash := NULL;
  END;

  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE token_hash = _md5_hash
     OR (_sha256_hash IS NOT NULL AND token_hash = _sha256_hash)
     OR _md5_hash = ANY(valid_token_hashes)
     OR (_sha256_hash IS NOT NULL AND _sha256_hash = ANY(valid_token_hashes))
  ORDER BY CASE WHEN status = 'pending' THEN 0 WHEN status = 'accepted' THEN 1 ELSE 2 END, created_at DESC
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF _invitation.status = 'cancelled' THEN
    SELECT *
    INTO _newer_invitation
    FROM public.clinic_collaborator_invitations
    WHERE clinic_id = _invitation.clinic_id
      AND lower(email) = lower(_invitation.email)
      AND status = 'pending'
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF _newer_invitation.id IS NOT NULL THEN
      _invitation := _newer_invitation;
    END IF;
  END IF;

  IF _user_email IS DISTINCT FROM lower(_invitation.email) THEN
    RAISE EXCEPTION 'Entre com o e-mail convidado para aceitar este acesso.';
  END IF;

  SELECT route_key
  INTO _clinic_route_key
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  -- Idempotency if already accepted
  IF _invitation.status = 'accepted' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.user_security_settings (user_id, clinic_id)
    VALUES (_user_id, _invitation.clinic_id)
    ON CONFLICT (user_id) DO UPDATE
    SET clinic_id = COALESCE(public.user_security_settings.clinic_id, EXCLUDED.clinic_id);

    INSERT INTO public.clinic_memberships (
      clinic_id,
      user_id,
      account_role,
      operational_role,
      role_key,
      membership_status,
      is_active,
      invited_by
    )
    VALUES (
      _invitation.clinic_id,
      _user_id,
      NULL,
      _invitation.operational_role,
      COALESCE(_invitation.role_key, _invitation.operational_role::text),
      'active',
      true,
      _invitation.invited_by
    )
    ON CONFLICT (clinic_id, user_id)
    DO UPDATE SET
      operational_role = COALESCE(public.clinic_memberships.operational_role, EXCLUDED.operational_role),
      role_key = COALESCE(public.clinic_memberships.role_key, EXCLUDED.role_key),
      membership_status = 'active',
      is_active = true,
      ended_at = NULL;

    INSERT INTO public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
    VALUES (_user_id, _invitation.clinic_id, now())
    ON CONFLICT (user_id)
    DO UPDATE SET clinic_id = EXCLUDED.clinic_id, updated_at = now();

    RETURN jsonb_build_object(
      'clinic_id', _invitation.clinic_id,
      'clinic_route_key', _clinic_route_key,
      'status', 'accepted',
      'already_accepted', true
    );
  END IF;

  IF _invitation.expires_at < now() THEN
    UPDATE public.clinic_collaborator_invitations
    SET status = 'expired', updated_at = now()
    WHERE id = _invitation.id;
    RAISE EXCEPTION 'Este convite expirou.';
  END IF;

  IF _invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Este convite não está mais pendente.';
  END IF;

  -- Validate clinic plan & collaborator quota (counting only non-owner collaborators)
  SELECT
    LOWER(COALESCE(subscription_plan::text, 'solo')),
    CASE
      WHEN subscription_plan::text IN ('clinica_basico', 'clinica_medio', 'clinica_top', 'clinic', 'enterprise') THEN 999999
      WHEN subscription_plan::text = 'prof_top' THEN GREATEST(COALESCE(subaccount_limit, 2), 2)
      ELSE COALESCE(subaccount_limit, 1)
    END
  INTO _clinic_plan, _subaccount_limit
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  IF _clinic_plan IN ('prof_basico', 'prof_medio', 'solo') THEN
    RAISE EXCEPTION 'Esta clínica está atualmente em um plano monoposto (apenas o titular) e não aceita novos colaboradores.';
  END IF;

  IF _subaccount_limit < 999999 THEN
    SELECT COUNT(*)::integer INTO _active_collaborators_count
    FROM public.clinic_memberships
    WHERE clinic_id = _invitation.clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND user_id <> _user_id
      AND COALESCE(account_role::text, '') NOT IN ('account_owner', 'owner')
      AND COALESCE(operational_role::text, '') <> 'owner';

    IF _active_collaborators_count >= GREATEST(1, _subaccount_limit - 1) THEN
      RAISE EXCEPTION 'O limite de membros da clínica foi atingido para o plano atual.';
    END IF;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id)
  INTO _profile_exists;

  IF _profile_exists THEN
    UPDATE public.profiles
    SET
      clinic_id = COALESCE(clinic_id, _invitation.clinic_id),
      email = COALESCE(email, _invitation.email),
      full_name = COALESCE(NULLIF(trim(full_name), ''), NULLIF(trim(coalesce(_full_name, '')), '')),
      job_title = COALESCE(NULLIF(trim(_invitation.job_title), ''), job_title),
      specialty = COALESCE(NULLIF(trim(_invitation.specialty), ''), specialty),
      public_code = COALESCE(NULLIF(trim(public_code), ''), public.generate_profile_public_code())
    WHERE id = _user_id;
  ELSE
    INSERT INTO public.profiles (
      id,
      clinic_id,
      email,
      full_name,
      job_title,
      specialty,
      public_code
    )
    VALUES (
      _user_id,
      _invitation.clinic_id,
      _invitation.email,
      NULLIF(trim(coalesce(_full_name, '')), ''),
      NULLIF(trim(_invitation.job_title), ''),
      NULLIF(trim(_invitation.specialty), ''),
      public.generate_profile_public_code()
    );
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_security_settings (user_id, clinic_id)
  VALUES (_user_id, _invitation.clinic_id)
  ON CONFLICT (user_id) DO UPDATE
  SET clinic_id = COALESCE(public.user_security_settings.clinic_id, EXCLUDED.clinic_id);

  INSERT INTO public.clinic_memberships (
    clinic_id,
    user_id,
    account_role,
    operational_role,
    role_key,
    membership_status,
    is_active,
    invited_by
  )
  VALUES (
    _invitation.clinic_id,
    _user_id,
    NULL,
    _invitation.operational_role,
    COALESCE(_invitation.role_key, _invitation.operational_role::text),
    'active',
    true,
    _invitation.invited_by
  )
  ON CONFLICT (clinic_id, user_id)
  DO UPDATE SET
    operational_role = CASE
      WHEN public.clinic_memberships.account_role = 'account_owner' THEN 'owner'::public.operational_role_type
      ELSE EXCLUDED.operational_role
    END,
    role_key = CASE
      WHEN public.clinic_memberships.account_role = 'account_owner' THEN 'owner'
      ELSE EXCLUDED.role_key
    END,
    membership_status = 'active',
    is_active = true,
    ended_at = NULL,
    invited_by = COALESCE(public.clinic_memberships.invited_by, EXCLUDED.invited_by);

  INSERT INTO public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
  VALUES (_user_id, _invitation.clinic_id, now())
  ON CONFLICT (user_id)
  DO UPDATE SET clinic_id = EXCLUDED.clinic_id, updated_at = now();

  UPDATE public.clinic_collaborator_invitations
  SET
    status = 'accepted',
    accepted_by = _user_id,
    accepted_at = now(),
    updated_at = now()
  WHERE id = _invitation.id;

  RETURN jsonb_build_object(
    'clinic_id', _invitation.clinic_id,
    'clinic_route_key', _clinic_route_key,
    'status', 'accepted'
  );
END;
$$;

-- [RPC/FUNCTION] activate_clinic_free_trial (schema.sql L768-L926)
CREATE OR REPLACE FUNCTION "public"."activate_clinic_free_trial"("_clinic_id" "uuid", "_plan_type" "text" DEFAULT 'clinic'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

-- [RPC/FUNCTION] activate_clinic_free_trial (schema.sql L932-L937)
CREATE OR REPLACE FUNCTION "public"."activate_clinic_free_trial"("_clinic_id" "uuid", "_plan_type" "public"."subscription_plan") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.activate_clinic_free_trial(_clinic_id, _plan_type::text);
$$;

-- [RPC/FUNCTION] buy_clinic_subaccount_extra_spaces (schema.sql L1427-L1510)
CREATE OR REPLACE FUNCTION "public"."buy_clinic_subaccount_extra_spaces"("_clinic_id" "uuid", "_quantity" integer, "_billing_type" "text" DEFAULT 'PIX'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_current_user_id uuid := auth.uid();
  v_sub_record public.clinic_subscriptions%rowtype;
  v_unit_price numeric(10,2) := 5.00;
  v_total_price numeric(10,2);
  v_payment_id text;
  v_invoice_id uuid;
begin
  if not public.is_clinic_subscription_manager(v_current_user_id, _clinic_id) then
    raise exception 'Acesso negado: apenas o responsável pela clínica pode adquirir vagas extras.';
  end if;

  if coalesce(_quantity, 0) <= 0 then
    raise exception 'Quantidade de vagas inválida. Informe um valor maior que zero.';
  end if;

  v_total_price := _quantity * v_unit_price;

  -- Garante que existe registro de assinatura
  select * into v_sub_record from public.clinic_subscriptions where clinic_id = _clinic_id;
  if v_sub_record.id is null then
    insert into public.clinic_subscriptions (clinic_id, account_owner_user_id, plan_type, base_monthly_price, base_subaccount_limit, base_concurrent_access_count, status)
    values (_clinic_id, v_current_user_id, 'clinic', 60.00, 30, 2, 'BETA')
    returning * into v_sub_record;
  end if;

  if v_sub_record.plan_type = 'solo' then
    raise exception 'Não é possível comprar vagas extras no plano Solo. Faça upgrade para o plano Clínica primeiro.';
  end if;

  -- Incrementa vagas compradas em clinic_subscriptions
  update public.clinic_subscriptions
  set
    purchased_subaccount_extra_count = coalesce(purchased_subaccount_extra_count, 0) + _quantity,
    updated_at = now()
  where clinic_id = _clinic_id
  returning * into v_sub_record;

  -- Registra a fatura avulsa
  v_payment_id := 'EXP_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.subscription_invoices (
    clinic_id,
    subscription_id,
    asaas_payment_id,
    charge_type,
    status,
    value,
    due_date,
    payment_date,
    billing_type,
    metadata
  )
  values (
    _clinic_id,
    v_sub_record.id,
    v_payment_id,
    'ONE_TIME_SUBACCOUNT_EXPANSION',
    'CONFIRMED',
    v_total_price,
    current_date,
    now(),
    _billing_type,
    jsonb_build_object(
      'purchased_quantity', _quantity,
      'unit_price', v_unit_price,
      'description', 'Compra avulsa de ' || _quantity || ' vagas de colaboradores'
    )
  )
  returning id into v_invoice_id;

  return jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'purchased_quantity', _quantity,
    'total_price', v_total_price,
    'new_subaccount_limit', v_sub_record.base_subaccount_limit + v_sub_record.purchased_subaccount_extra_count
  );
end;
$$;

-- [RPC/FUNCTION] can_read_clinic_data (schema.sql L1788-L1854)
CREATE OR REPLACE FUNCTION "public"."can_read_clinic_data"("_clinic_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER PARALLEL SAFE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub record;
  v_is_owner boolean := false;
BEGIN
  IF v_uid IS NULL OR _clinic_id IS NULL THEN
    RETURN false;
  END IF;

  -- Platform admin / owner bypass
  IF EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE pa.user_id = v_uid AND pa.is_active = true
  ) OR public.is_platform_owner(v_uid) THEN
    RETURN true;
  END IF;

  -- Check if user is clinic owner
  IF EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = _clinic_id AND c.account_owner_user_id = v_uid
  ) OR EXISTS (
    SELECT 1 FROM public.clinic_memberships cm
    WHERE cm.clinic_id = _clinic_id
      AND cm.user_id = v_uid
      AND (cm.account_role = 'account_owner' OR cm.operational_role = 'owner')
      AND cm.is_active = true
      AND cm.membership_status = 'active'
  ) THEN
    v_is_owner := true;
  END IF;

  IF NOT v_is_owner AND NOT public.user_has_active_clinic_membership(v_uid, _clinic_id) THEN
    RETURN false;
  END IF;

  -- Check subscription status
  SELECT status, is_free_trial, is_courtesy, expires_at, current_period_end
  INTO v_sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _clinic_id
  LIMIT 1;

  IF FOUND THEN
    IF COALESCE(v_sub.is_courtesy, false) = true OR v_sub.status IN ('ACTIVE', 'BETA', 'COURTESY', 'PENDING') THEN
      RETURN true;
    END IF;

    IF v_sub.status = 'TRIAL_EXPIRED' AND NOT v_is_owner THEN
      RETURN false;
    END IF;

    IF v_sub.status = 'TRIAL' AND NOT v_is_owner THEN
      IF COALESCE(v_sub.expires_at, v_sub.current_period_end) IS NOT NULL
         AND COALESCE(v_sub.expires_at, v_sub.current_period_end) < now() THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  RETURN true;
END;
$$;

-- [RPC/FUNCTION] cancel_clinic_collaborator_invitation (schema.sql L1943-L1991)
CREATE OR REPLACE FUNCTION "public"."cancel_clinic_collaborator_invitation"("_invitation_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE id = _invitation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF NOT (
    public.current_user_can('subaccounts.delete', _invitation.clinic_id)
    OR public.current_user_can('subaccounts.write', _invitation.clinic_id)
    OR public.current_user_can('subaccounts.manage', _invitation.clinic_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar este convite.';
  END IF;

  IF _invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Apenas convites pendentes podem ser cancelados.';
  END IF;

  UPDATE public.clinic_collaborator_invitations
  SET status = 'cancelled', updated_at = now()
  WHERE id = _invitation_id;

  PERFORM public.log_security_event(
    _invitation.clinic_id,
    _requester_id,
    _invitation.existing_user_id,
    'clinic_collaborator_invite_cancelled',
    'admin',
    jsonb_build_object('invitation_id', _invitation_id, 'email', _invitation.email)
  );

  RETURN jsonb_build_object('invitation_id', _invitation_id, 'status', 'cancelled');
END;
$$;

-- [RPC/FUNCTION] check_clinic_hibernation_eligibility (schema.sql L2010-L2043)
CREATE OR REPLACE FUNCTION "public"."check_clinic_hibernation_eligibility"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_has_active_subscription boolean := false;
BEGIN
  IF NEW.is_hibernated = true THEN
    -- Regra sagrada: Clínicas com assinatura ativa (ou access_status ativo com plano ativo) não podem ser hibernadas
    IF LOWER(COALESCE(NEW.access_status, '')) = 'active' THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.clinic_subscriptions cs
        WHERE cs.clinic_id = NEW.id
          AND cs.status = 'ACTIVE'
      ) INTO v_has_active_subscription;

      IF v_has_active_subscription THEN
        RAISE EXCEPTION 'Regra sagrada: Clínicas com subscription ativa (subscription_status = ACTIVE / access_status = active) NUNCA podem ser marcadas como hibernadas.';
      END IF;
    END IF;

    -- Preencher hibernated_at se ainda não preenchido
    IF NEW.hibernated_at IS NULL THEN
      NEW.hibernated_at := now();
    END IF;
  ELSE
    -- Ao deshibernar, limpa a data de hibernação
    NEW.hibernated_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] create_clinic_subaccount (schema.sql L2431-L2607)
CREATE OR REPLACE FUNCTION "public"."create_clinic_subaccount"("_email" "text", "_password" "text", "_full_name" "text", "_operational_role" "public"."operational_role_type" DEFAULT 'professional'::"public"."operational_role_type", "_job_title" "text" DEFAULT NULL::"text", "_specialty" "text" DEFAULT NULL::"text", "_clinic_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _resolved_clinic_id uuid := COALESCE(_clinic_id, public.get_user_clinic_id(_requester_id));
  _subscription_plan public.subscription_plan;
  _new_user_id uuid := gen_random_uuid();
  _normalized_email text := lower(trim(_email));
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF _resolved_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clinica nao encontrada para o usuario atual.';
  END IF;

  IF NOT public.current_user_can('subaccounts.manage', _resolved_clinic_id) THEN
    RAISE EXCEPTION 'Sem permissao para criar subcontas nesta clinica.';
  END IF;

  IF _normalized_email = '' OR position('@' IN _normalized_email) = 0 THEN
    RAISE EXCEPTION 'Informe um e-mail valido para a subconta.';
  END IF;

  IF coalesce(length(_password), 0) < 6 THEN
    RAISE EXCEPTION 'A senha da subconta precisa ter pelo menos 6 caracteres.';
  END IF;

  IF coalesce(length(trim(_full_name)), 0) = 0 THEN
    RAISE EXCEPTION 'Informe o nome completo da subconta.';
  END IF;

  IF _operational_role NOT IN ('admin', 'professional', 'assistant', 'estagiario') THEN
    RAISE EXCEPTION 'O papel operacional da subconta deve ser admin, professional, assistant ou estagiario.';
  END IF;

  SELECT subscription_plan
  INTO _subscription_plan
  FROM public.clinics
  WHERE id = _resolved_clinic_id;

  IF _subscription_plan IS DISTINCT FROM 'clinic' THEN
    RAISE EXCEPTION 'Apenas clinicas com plano clinic podem criar subcontas.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = _normalized_email
  ) THEN
    RAISE EXCEPTION 'Ja existe uma conta cadastrada com este e-mail.';
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    _new_user_id,
    'authenticated',
    'authenticated',
    _normalized_email,
    extensions.crypt(_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', trim(_full_name)),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    _new_user_id,
    jsonb_build_object('sub', _new_user_id::text, 'email', _normalized_email),
    'email',
    _normalized_email,
    now(),
    now(),
    now()
  );

  INSERT INTO public.profiles (
    id,
    clinic_id,
    email,
    full_name,
    job_title,
    specialty,
    password_temporary
  )
  VALUES (
    _new_user_id,
    _resolved_clinic_id,
    _normalized_email,
    trim(_full_name),
    NULLIF(trim(_job_title), ''),
    NULLIF(trim(_specialty), ''),
    true
  );

  INSERT INTO public.user_security_settings (user_id, clinic_id)
  VALUES (_new_user_id, _resolved_clinic_id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.clinic_memberships (
    clinic_id,
    user_id,
    account_role,
    operational_role,
    membership_status,
    invited_by,
    is_active
  )
  VALUES (
    _resolved_clinic_id,
    _new_user_id,
    NULL,
    _operational_role,
    'active',
    _requester_id,
    true
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_new_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  PERFORM public.log_security_event(
    _resolved_clinic_id,
    _requester_id,
    _new_user_id,
    'subaccount_created',
    'admin',
    jsonb_build_object(
      'email', _normalized_email,
      'operational_role', _operational_role
    )
  );

  RETURN jsonb_build_object(
    'clinic_id', _resolved_clinic_id,
    'email', _normalized_email,
    'user_id', _new_user_id
  );
END;
$$;

-- [RPC/FUNCTION] enforce_clinic_membership_integrity (schema.sql L3847-L3879)
CREATE OR REPLACE FUNCTION "public"."enforce_clinic_membership_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.account_role = 'account_owner' AND NEW.operational_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'A conta compradora precisa manter o papel operacional owner.';
  END IF;

  IF NEW.account_role IS NULL AND NEW.operational_role = 'owner' THEN
    RAISE EXCEPTION 'O papel operacional owner fica reservado para a conta principal.';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.account_role = 'account_owner' THEN
    IF NEW.account_role IS DISTINCT FROM OLD.account_role
      OR NEW.operational_role IS DISTINCT FROM OLD.operational_role
      OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'A conta principal nao pode ser alterada por este fluxo.';
    END IF;
  END IF;

  IF NEW.membership_status IN ('active', 'invited') THEN
    NEW.is_active := true;
    NEW.ended_at := NULL;
  ELSE
    NEW.is_active := false;
    NEW.ended_at := COALESCE(NEW.ended_at, now());
  END IF;

  RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] get_clinic_active_terms (schema.sql L4584-L4637)
CREATE OR REPLACE FUNCTION "public"."get_clinic_active_terms"("p_clinic_id" "uuid") RETURNS TABLE("term_type" "text", "is_custom" boolean, "id" "uuid", "clinic_id" "uuid", "original_filename" "text", "content_markdown" "text", "b2_object_key" "text", "byte_size" integer, "compressed_byte_size" integer, "storage_encoding" "text", "version" integer, "uploaded_by" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_has_access boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autenticado' USING ERRCODE = '42501';
  END IF;

  -- Checa se o usuário tem permissão para ler dados desta clínica
  IF public.get_user_clinic_id(v_user_id) = p_clinic_id
     OR public.is_platform_owner(v_user_id)
     OR EXISTS (
       SELECT 1 FROM public.clinic_memberships cm
       WHERE cm.clinic_id = p_clinic_id
         AND cm.user_id = v_user_id
         AND cm.is_active = true
         AND cm.membership_status = 'active'
     ) THEN
    v_has_access := true;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Acesso não autorizado para esta clínica' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH requested_types AS (
    SELECT unnest(ARRAY['adult_consent', 'minor_consent']) AS expected_type
  )
  SELECT
    rt.expected_type AS term_type,
    (ct.id IS NOT NULL) AS is_custom,
    ct.id,
    p_clinic_id AS clinic_id,
    COALESCE(ct.original_filename, rt.expected_type || '_padrao.md') AS original_filename,
    COALESCE(ct.content_markdown, '') AS content_markdown,
    COALESCE(ct.b2_object_key, '') AS b2_object_key,
    COALESCE(ct.byte_size, 0) AS byte_size,
    COALESCE(ct.compressed_byte_size, 0) AS compressed_byte_size,
    COALESCE(ct.storage_encoding, 'gzip') AS storage_encoding,
    COALESCE(ct.version, 1) AS version,
    ct.uploaded_by,
    ct.created_at,
    ct.updated_at
  FROM requested_types rt
  LEFT JOIN public.clinic_terms ct
    ON ct.clinic_id = p_clinic_id
   AND ct.term_type = rt.expected_type;
END;
$$;

-- [RPC/FUNCTION] get_clinic_collaborator_invitation (schema.sql L4643-L4758)
CREATE OR REPLACE FUNCTION "public"."get_clinic_collaborator_invitation"("_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions'
    AS $$
DECLARE
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _newer_invitation public.clinic_collaborator_invitations%ROWTYPE;
  _clinic_name text;
  _clinic_route_key text;
  _is_existing_user boolean := false;
  _user_id uuid;
  _has_cpf boolean := false;
  _raw_cpf text;
  _token_clean text := trim(coalesce(_token, ''));
  _md5_hash text := md5(_token_clean);
  _sha256_hash text;
BEGIN
  IF _token_clean = '' THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  BEGIN
    _sha256_hash := encode(extensions.digest(_token_clean, 'sha256'), 'hex');
  EXCEPTION WHEN OTHERS THEN
    _sha256_hash := NULL;
  END;

  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE token_hash = _md5_hash
     OR (_sha256_hash IS NOT NULL AND token_hash = _sha256_hash)
     OR _md5_hash = ANY(valid_token_hashes)
     OR (_sha256_hash IS NOT NULL AND _sha256_hash = ANY(valid_token_hashes))
  ORDER BY CASE WHEN status = 'pending' THEN 0 WHEN status = 'accepted' THEN 1 ELSE 2 END, created_at DESC
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  -- Fallback inteligente: se o convite foi cancelado, buscar convite pending mais novo para mesmo email e clínica
  IF _invitation.status = 'cancelled' THEN
    SELECT *
    INTO _newer_invitation
    FROM public.clinic_collaborator_invitations
    WHERE clinic_id = _invitation.clinic_id
      AND lower(email) = lower(_invitation.email)
      AND status = 'pending'
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF _newer_invitation.id IS NOT NULL THEN
      _invitation := _newer_invitation;
    END IF;
  END IF;

  IF _invitation.status = 'pending' AND _invitation.expires_at < now() THEN
    UPDATE public.clinic_collaborator_invitations
    SET status = 'expired', updated_at = now()
    WHERE id = _invitation.id;

    _invitation.status := 'expired';
  END IF;

  SELECT name, route_key
  INTO _clinic_name, _clinic_route_key
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  SELECT u.id
  INTO _user_id
  FROM auth.users u
  WHERE lower(u.email) = lower(_invitation.email)
  LIMIT 1;

  IF _user_id IS NOT NULL THEN
    _is_existing_user := true;
  ELSE
    _user_id := _invitation.existing_user_id;
    IF _user_id IS NOT NULL THEN
      _is_existing_user := true;
    END IF;
  END IF;

  IF _user_id IS NOT NULL THEN
    SELECT p.cpf
    INTO _raw_cpf
    FROM public.profiles p
    WHERE p.id = _user_id;

    IF _raw_cpf IS NOT NULL AND length(regexp_replace(_raw_cpf, '\D', '', 'g')) = 11 THEN
      _has_cpf := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', _invitation.id,
    'clinic_id', _invitation.clinic_id,
    'clinic_name', COALESCE(_clinic_name, 'Clínica'),
    'clinic_route_key', _clinic_route_key,
    'email', _invitation.email,
    'operational_role', _invitation.operational_role,
    'role_key', _invitation.role_key,
    'job_title', _invitation.job_title,
    'specialty', _invitation.specialty,
    'status', _invitation.status,
    'email_delivery_status', _invitation.email_delivery_status,
    'existing_user', _is_existing_user,
    'has_cpf', _has_cpf,
    'pending_cpf_completion', (_is_existing_user AND NOT _has_cpf),
    'expires_at', _invitation.expires_at
  );
END;
$$;

-- [RPC/FUNCTION] get_clinic_concurrent_access_overview (schema.sql L4764-L4793)
CREATE OR REPLACE FUNCTION "public"."get_clinic_concurrent_access_overview"("_clinic_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cid uuid := COALESCE(_clinic_id, public.get_user_clinic_id(v_uid));
  v_active_sessions integer := 0;
BEGIN
  IF v_uid IS NULL OR v_cid IS NULL THEN
    RETURN jsonb_build_object('active_sessions', 0);
  END IF;

  IF NOT public.user_has_active_clinic_membership(v_uid, v_cid) AND NOT public.is_platform_owner(v_uid) THEN
    RETURN jsonb_build_object('active_sessions', 0);
  END IF;

  SELECT COUNT(DISTINCT uss.user_id)
  INTO v_active_sessions
  FROM public.user_security_sessions uss
  WHERE uss.clinic_id = v_cid
    AND uss.ended_at IS NULL
    AND uss.force_signed_out_at IS NULL
    AND uss.last_seen_at >= (now() - interval '15 minutes');

  RETURN jsonb_build_object(
    'active_sessions', GREATEST(1, COALESCE(v_active_sessions, 1))
  );
END;
$$;

-- [RPC/FUNCTION] get_clinic_dashboard_analytics (schema.sql L4799-L5282)
CREATE OR REPLACE FUNCTION "public"."get_clinic_dashboard_analytics"("_clinic_id" "uuid", "_year" integer DEFAULT NULL::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _target_year int := COALESCE(_year, EXTRACT(YEAR FROM now())::int);
  _result jsonb;

  _total_sessions int := 0;
  _canceled_sessions int := 0;
  _paid_sessions int := 0;
  _today_sessions int := 0;
  _week_sessions int := 0;
  _month_sessions int := 0;
  _year_sessions int := 0;

  _financial_paid bigint := 0;
  _financial_credit bigint := 0;
  _financial_open bigint := 0;
  _forecast_revenue_cents bigint := 0;

  _payment_status_counts jsonb;
  _payment_method_counts jsonb;
  _patient_status_counts jsonb;

  _total_patients int := 0;
  _recurring_patients int := 0;

  _agenda_late int := 0;
  _agenda_confirmed int := 0;
  _agenda_awaiting int := 0;
  _agenda_total int := 0;

  _monthly_revenue jsonb;
  _last_30_days jsonb;
  _weekday_distribution jsonb;
  _top_groups jsonb;
  _collaborators jsonb;

  -- Packages metrics
  _packages_total int := 0;
  _packages_in_progress int := 0;
  _packages_completed int := 0;
  _packages_canceled int := 0;
  _packages_total_revenue_cents bigint := 0;
  _packages_paid_revenue_cents bigint := 0;
  _packages_open_revenue_cents bigint := 0;
  _packages_total_sessions_contracted int := 0;
  _packages_total_sessions_used int := 0;
  _packages_total_sessions_remaining int := 0;
  _packages_status_counts jsonb;
  _packages_list jsonb;

  _is_platform_actor boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- Verifica se é platform owner ou tem sessão ativa de suporte/simulação
  _is_platform_actor := (
    public.is_platform_owner(_user_id) OR
    public.is_platform_owner_mfa_verified(_user_id) OR
    EXISTS (
      SELECT 1
      FROM public.platform_clinic_access_sessions
      WHERE actor_user_id = _user_id
        AND clinic_id = _clinic_id
        AND ended_at IS NULL
    )
  );

  IF NOT (
    _is_platform_actor OR
    public.current_user_can('treasury.manage', _clinic_id) OR
    public.current_user_can('sessions.read', _clinic_id) OR
    public.current_user_can('patients.read', _clinic_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar estatísticas desta clínica.';
  END IF;

  -- 1. Sessões: Contagens gerais e períodos
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE status = 'cancelado')::int,
    COUNT(*) FILTER (WHERE COALESCE(amount_charged_cents, 0) > 0 AND COALESCE(amount_paid_cents, 0) >= COALESCE(amount_charged_cents, 0))::int,
    COUNT(*) FILTER (WHERE session_date::date = CURRENT_DATE)::int,
    COUNT(*) FILTER (WHERE session_date >= date_trunc('week', now()))::int,
    COUNT(*) FILTER (WHERE session_date >= date_trunc('month', now()))::int,
    COUNT(*) FILTER (WHERE session_date >= date_trunc('year', now()))::int,
    COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN LEAST(COALESCE(amount_paid_cents, 0), COALESCE(amount_charged_cents, 0)) ELSE 0 END), 0)::bigint,
    COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN GREATEST(0, COALESCE(amount_paid_cents, 0) - COALESCE(amount_charged_cents, 0)) ELSE 0 END), 0)::bigint,
    COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN GREATEST(0, COALESCE(amount_charged_cents, 0) - COALESCE(amount_paid_cents, 0)) ELSE 0 END), 0)::bigint
  INTO
    _total_sessions,
    _canceled_sessions,
    _paid_sessions,
    _today_sessions,
    _week_sessions,
    _month_sessions,
    _year_sessions,
    _financial_paid,
    _financial_credit,
    _financial_open
  FROM public.sessions
  WHERE clinic_id = _clinic_id;

  _forecast_revenue_cents := _financial_paid + _financial_credit + _financial_open;

  -- 2. Status de Pagamento (Contagens)
  SELECT jsonb_build_object(
    'cortesia', COUNT(*) FILTER (WHERE payment_status = 'cortesia')::int,
    'credit', COUNT(*) FILTER (WHERE COALESCE(payment_status, '') <> 'cortesia' AND COALESCE(amount_paid_cents, 0) > COALESCE(amount_charged_cents, 0))::int,
    'debt', COUNT(*) FILTER (WHERE COALESCE(payment_status, '') <> 'cortesia' AND COALESCE(amount_charged_cents, 0) > 0 AND COALESCE(amount_paid_cents, 0) > 0 AND COALESCE(amount_paid_cents, 0) < COALESCE(amount_charged_cents, 0))::int,
    'pending', COUNT(*) FILTER (WHERE COALESCE(payment_status, '') <> 'cortesia' AND COALESCE(amount_charged_cents, 0) > 0 AND COALESCE(amount_paid_cents, 0) <= 0)::int,
    'paid', COUNT(*) FILTER (WHERE COALESCE(payment_status, '') <> 'cortesia' AND COALESCE(amount_charged_cents, 0) > 0 AND COALESCE(amount_paid_cents, 0) >= COALESCE(amount_charged_cents, 0))::int,
    'notCharged', COUNT(*) FILTER (WHERE COALESCE(payment_status, '') <> 'cortesia' AND COALESCE(amount_charged_cents, 0) <= 0 AND COALESCE(amount_paid_cents, 0) <= 0)::int
  )
  INTO _payment_status_counts
  FROM public.sessions
  WHERE clinic_id = _clinic_id;

  -- 3. Métodos de Pagamento (Agrupados)
  SELECT COALESCE(jsonb_object_agg(sub.method_key, sub.cnt), '{}'::jsonb)
  INTO _payment_method_counts
  FROM (
    SELECT
      CASE
        WHEN payment_status = 'cortesia' THEN 'cortesia'
        WHEN payment_method IS NOT NULL AND payment_method <> '' THEN payment_method
        ELSE 'nao_informado'
      END AS method_key,
      COUNT(*)::int AS cnt
    FROM public.sessions
    WHERE clinic_id = _clinic_id
    GROUP BY 1
  ) sub;

  -- 4. Pacientes (Status e Recorrência)
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE (recurring_weekdays IS NOT NULL AND cardinality(recurring_weekdays) > 0) OR is_recurring = true)::int
  INTO
    _total_patients,
    _recurring_patients
  FROM public.patients
  WHERE clinic_id = _clinic_id;

  SELECT COALESCE(jsonb_object_agg(COALESCE(ps.status, 'ativo'), ps.cnt), '{}'::jsonb)
  INTO _patient_status_counts
  FROM (
    SELECT COALESCE(status, 'ativo') AS status, COUNT(*)::int AS cnt
    FROM public.patients
    WHERE clinic_id = _clinic_id
    GROUP BY COALESCE(status, 'ativo')
  ) ps;

  -- 5. Agenda de Atendimentos
  SELECT
    COUNT(*) FILTER (WHERE status <> 'cancelado' AND scheduled_for < now())::int,
    COUNT(*) FILTER (WHERE status = 'confirmado' AND scheduled_for >= now())::int,
    COUNT(*) FILTER (WHERE status <> 'cancelado' AND status <> 'confirmado' AND scheduled_for >= now())::int,
    COUNT(*) FILTER (WHERE status <> 'cancelado')::int
  INTO
    _agenda_late,
    _agenda_confirmed,
    _agenda_awaiting,
    _agenda_total
  FROM public.agenda_events
  WHERE clinic_id = _clinic_id;

  -- 6. Receita Mensal do Ano Selecionado (12 meses garantidos)
  WITH months AS (
    SELECT m_idx FROM generate_series(1, 12) AS m_idx
  ),
  month_names AS (
    SELECT ARRAY['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] AS names
  ),
  monthly_agg AS (
    SELECT
      EXTRACT(MONTH FROM session_date)::int AS m_idx,
      COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN LEAST(COALESCE(amount_paid_cents, 0), COALESCE(amount_charged_cents, 0)) ELSE 0 END), 0)::numeric / 100.0 AS pago,
      COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN GREATEST(0, COALESCE(amount_charged_cents, 0) - COALESCE(amount_paid_cents, 0)) ELSE 0 END), 0)::numeric / 100.0 AS em_aberto,
      COUNT(*)::int AS atendimentos
    FROM public.sessions
    WHERE clinic_id = _clinic_id
      AND EXTRACT(YEAR FROM session_date)::int = _target_year
    GROUP BY EXTRACT(MONTH FROM session_date)::int
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'label', (SELECT names[m.m_idx] FROM month_names),
      'pago', COALESCE(ma.pago, 0),
      'emAberto', COALESCE(ma.em_aberto, 0),
      'atendimentos', COALESCE(ma.atendimentos, 0)
    ) ORDER BY m.m_idx ASC
  )
  INTO _monthly_revenue
  FROM months m
  LEFT JOIN monthly_agg ma ON ma.m_idx = m.m_idx;

  -- 7. Atendimentos nos Últimos 30 Dias (30 dias garantidos)
  WITH days AS (
    SELECT (CURRENT_DATE - (29 - d_idx) * interval '1 day')::date AS day_date
    FROM generate_series(0, 29) AS d_idx
  ),
  daily_agg AS (
    SELECT
      session_date::date AS d_date,
      COUNT(*)::int AS atendimentos
    FROM public.sessions
    WHERE clinic_id = _clinic_id
      AND session_date::date >= (CURRENT_DATE - interval '29 days')::date
    GROUP BY session_date::date
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'label', to_char(d.day_date, 'DD/MM'),
      'atendimentos', COALESCE(da.atendimentos, 0)
    ) ORDER BY d.day_date ASC
  )
  INTO _last_30_days
  FROM days d
  LEFT JOIN daily_agg da ON da.d_date = d.day_date;

  -- 8. Distribuição por Dia da Semana (0=Dom a 6=Sáb)
  WITH weekdays AS (
    SELECT dow_idx FROM generate_series(0, 6) AS dow_idx
  ),
  weekday_names AS (
    SELECT ARRAY['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] AS names
  ),
  weekday_agg AS (
    SELECT
      EXTRACT(DOW FROM session_date)::int AS dow,
      COUNT(*)::int AS atendimentos
    FROM public.sessions
    WHERE clinic_id = _clinic_id
    GROUP BY EXTRACT(DOW FROM session_date)::int
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'label', (SELECT names[w.dow_idx + 1] FROM weekday_names),
      'atendimentos', COALESCE(wa.atendimentos, 0)
    ) ORDER BY w.dow_idx ASC
  )
  INTO _weekday_distribution
  FROM weekdays w
  LEFT JOIN weekday_agg wa ON wa.dow = w.dow_idx;

  -- 9. Top Grupos / Linhas de Cuidado (Mais Atendidos)
  WITH resolved_sessions AS (
    SELECT
      s.id,
      COALESCE(
        s.group_id,
        (
          SELECT pg2.id
          FROM public.patient_groups pg2
          WHERE pg2.patient_id = s.patient_id
          ORDER BY pg2.is_default DESC, pg2.created_at ASC
          LIMIT 1
        )
      ) AS resolved_group_id
    FROM public.sessions s
    WHERE s.clinic_id = _clinic_id
  ),
  group_counts AS (
    SELECT
      COALESCE(pg.name, 'Sem grupo') AS group_name,
      COALESCE(cs.color_hex, pg.color, '#64748b') AS group_color,
      COUNT(*)::int AS total
    FROM resolved_sessions rs
    LEFT JOIN public.patient_groups pg ON pg.id = rs.resolved_group_id
    LEFT JOIN public.clinic_group_color_slots cs ON cs.id = pg.clinic_color_slot_id
    GROUP BY COALESCE(pg.name, 'Sem grupo'), COALESCE(cs.color_hex, pg.color, '#64748b')
    ORDER BY total DESC
    LIMIT 8
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', gc.group_name,
        'color', gc.group_color,
        'total', gc.total
      )
    ),
    '[]'::jsonb
  )
  INTO _top_groups
  FROM group_counts gc;

  -- 10. Produtividade por Colaborador
  WITH collab_sessions AS (
    SELECT
      COALESCE(s.provider_id, s.user_id, '00000000-0000-0000-0000-000000000000'::uuid) AS collaborator_id,
      CASE WHEN s.payment_status <> 'cortesia' THEN LEAST(COALESCE(s.amount_paid_cents, 0), COALESCE(s.amount_charged_cents, 0)) ELSE 0 END AS paid_cents
    FROM public.sessions s
    WHERE s.clinic_id = _clinic_id
  ),
  collab_agg AS (
    SELECT
      cs.collaborator_id,
      COUNT(*)::int AS total,
      SUM(cs.paid_cents)::numeric / 100.0 AS receita
    FROM collab_sessions cs
    GROUP BY cs.collaborator_id
    ORDER BY total DESC
    LIMIT 8
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'label', COALESCE(
          NULLIF(trim(p.full_name), ''),
          NULLIF(trim(p.social_name), ''),
          CASE
            WHEN p.job_title IS NOT NULL AND p.public_code IS NOT NULL THEN p.job_title || ' (' || p.public_code || ')'
            WHEN p.public_code IS NOT NULL THEN 'Colaborador ' || p.public_code
            WHEN p.email IS NOT NULL THEN p.email
            ELSE 'Colaborador'
          END
        ),
        'total', ca.total,
        'receita', ca.receita
      )
    ),
    '[]'::jsonb
  )
  INTO _collaborators
  FROM collab_agg ca
  LEFT JOIN public.profiles p ON p.id = ca.collaborator_id;

  -- 11. Estatísticas de Pacotes de Atendimentos (patient_payment_plans)
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE payment_status <> 'cancelado' AND used_sessions < total_sessions)::int,
    COUNT(*) FILTER (WHERE payment_status <> 'cancelado' AND used_sessions >= total_sessions)::int,
    COUNT(*) FILTER (WHERE payment_status = 'cancelado')::int,
    COALESCE(SUM(total_amount_cents), 0)::bigint,
    COALESCE(SUM(CASE 
      WHEN payment_status = 'pago' THEN total_amount_cents
      WHEN payment_status = 'parcial' THEN (total_amount_cents / 2)
      ELSE 0 
    END), 0)::bigint,
    COALESCE(SUM(CASE 
      WHEN payment_status = 'pendente' THEN total_amount_cents
      WHEN payment_status = 'parcial' THEN (total_amount_cents - (total_amount_cents / 2))
      ELSE 0 
    END), 0)::bigint,
    COALESCE(SUM(total_sessions), 0)::int,
    COALESCE(SUM(used_sessions), 0)::int,
    COALESCE(SUM(GREATEST(0, total_sessions - used_sessions)), 0)::int
  INTO
    _packages_total,
    _packages_in_progress,
    _packages_completed,
    _packages_canceled,
    _packages_total_revenue_cents,
    _packages_paid_revenue_cents,
    _packages_open_revenue_cents,
    _packages_total_sessions_contracted,
    _packages_total_sessions_used,
    _packages_total_sessions_remaining
  FROM public.patient_payment_plans
  WHERE clinic_id = _clinic_id;

  SELECT jsonb_build_object(
    'pago', COUNT(*) FILTER (WHERE payment_status = 'pago')::int,
    'parcial', COUNT(*) FILTER (WHERE payment_status = 'parcial')::int,
    'pendente', COUNT(*) FILTER (WHERE payment_status = 'pendente')::int,
    'cancelado', COUNT(*) FILTER (WHERE payment_status = 'cancelado')::int
  )
  INTO _packages_status_counts
  FROM public.patient_payment_plans
  WHERE clinic_id = _clinic_id;

  -- Lista de pacotes com dados do paciente para visualização direta
  WITH plans_with_patient AS (
    SELECT
      ppp.id,
      ppp.patient_id,
      p.name AS patient_name,
      p.patient_code,
      ppp.name AS plan_name,
      ppp.total_sessions,
      ppp.used_sessions,
      GREATEST(0, ppp.total_sessions - ppp.used_sessions) AS remaining_sessions,
      CASE 
        WHEN ppp.total_sessions > 0 THEN LEAST(100, ROUND((ppp.used_sessions::numeric / ppp.total_sessions::numeric) * 100.0, 1))
        ELSE 0
      END AS progress_percentage,
      ppp.total_amount_cents,
      ppp.payment_status,
      ppp.payment_method,
      ppp.payment_installments,
      (ppp.used_sessions >= ppp.total_sessions) AS is_completed,
      ppp.start_date,
      ppp.created_at
    FROM public.patient_payment_plans ppp
    LEFT JOIN public.patients p ON p.id = ppp.patient_id
    WHERE ppp.clinic_id = _clinic_id
    ORDER BY ppp.created_at DESC
    LIMIT 30
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', pwp.id,
        'patientId', pwp.patient_id,
        'patientName', COALESCE(pwp.patient_name, 'Paciente não identificado'),
        'patientCode', pwp.patient_code,
        'planName', pwp.plan_name,
        'totalSessions', pwp.total_sessions,
        'usedSessions', pwp.used_sessions,
        'remainingSessions', pwp.remaining_sessions,
        'progressPercentage', pwp.progress_percentage,
        'totalAmountCents', pwp.total_amount_cents,
        'paymentStatus', pwp.payment_status,
        'paymentMethod', pwp.payment_method,
        'paymentInstallments', pwp.payment_installments,
        'isCompleted', pwp.is_completed,
        'startDate', pwp.start_date,
        'createdAt', pwp.created_at
      )
    ),
    '[]'::jsonb
  )
  INTO _packages_list
  FROM plans_with_patient pwp;

  -- 12. Montagem do Resultado Final Consolidado
  _result := jsonb_build_object(
    'year', _target_year,
    'totalSessions', _total_sessions,
    'paidSessions', _paid_sessions,
    'canceledSessions', _canceled_sessions,
    'cancellationRate', CASE WHEN _total_sessions > 0 THEN ROUND((_canceled_sessions::numeric / _total_sessions::numeric) * 100.0, 1) ELSE 0 END,
    'todaySessions', _today_sessions,
    'weekSessions', _week_sessions,
    'monthSessions', _month_sessions,
    'yearSessions', _year_sessions,
    'financialTotals', jsonb_build_object(
      'paid', _financial_paid,
      'credit', _financial_credit,
      'open', _financial_open,
      'forecastRevenueCents', _forecast_revenue_cents
    ),
    'paymentStatusCounts', COALESCE(_payment_status_counts, '{}'::jsonb),
    'paymentMethodCounts', COALESCE(_payment_method_counts, '{}'::jsonb),
    'patientStatusCounts', COALESCE(_patient_status_counts, '{}'::jsonb),
    'totalPatients', COALESCE(_total_patients, 0),
    'recurringPatients', COALESCE(_recurring_patients, 0),
    'agendaCounts', jsonb_build_object(
      'late', _agenda_late,
      'confirmed', _agenda_confirmed,
      'awaiting', _agenda_awaiting,
      'total', _agenda_total
    ),
    'monthlyRevenue', COALESCE(_monthly_revenue, '[]'::jsonb),
    'last30Days', COALESCE(_last_30_days, '[]'::jsonb),
    'weekdayDistribution', COALESCE(_weekday_distribution, '[]'::jsonb),
    'topGroups', COALESCE(_top_groups, '[]'::jsonb),
    'collaborators', COALESCE(_collaborators, '[]'::jsonb),
    'packageAnalytics', jsonb_build_object(
      'total', _packages_total,
      'inProgress', _packages_in_progress,
      'completed', _packages_completed,
      'canceled', _packages_canceled,
      'totalRevenueCents', _packages_total_revenue_cents,
      'paidRevenueCents', _packages_paid_revenue_cents,
      'openRevenueCents', _packages_open_revenue_cents,
      'totalSessionsContracted', _packages_total_sessions_contracted,
      'totalSessionsUsed', _packages_total_sessions_used,
      'totalSessionsRemaining', _packages_total_sessions_remaining,
      'statusCounts', COALESCE(_packages_status_counts, '{}'::jsonb),
      'plansList', COALESCE(_packages_list, '[]'::jsonb)
    )
  );

  RETURN _result;
END;
$$;

-- [RPC/FUNCTION] get_clinic_pending_collaborator_invitations (schema.sql L5346-L5410)
CREATE OR REPLACE FUNCTION "public"."get_clinic_pending_collaborator_invitations"("_clinic_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
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

-- [RPC/FUNCTION] get_clinic_share_collaborators (schema.sql L5416-L5444)
CREATE OR REPLACE FUNCTION "public"."get_clinic_share_collaborators"("_clinic_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH resolved AS (
    SELECT COALESCE(_clinic_id, public.get_user_clinic_id(auth.uid())) AS clinic_id
  )
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id', profiles.id,
        'full_name', profiles.full_name,
        'email', profiles.email,
        'job_title', profiles.job_title,
        'operational_role', clinic_memberships.operational_role
      )
      ORDER BY profiles.full_name NULLS LAST, profiles.email
    ),
    '[]'::json
  )
  FROM resolved
  JOIN public.clinic_memberships
    ON clinic_memberships.clinic_id = resolved.clinic_id
    AND clinic_memberships.is_active = true
    AND clinic_memberships.membership_status = 'active'
  JOIN public.profiles
    ON profiles.id = clinic_memberships.user_id
  WHERE public.current_user_can('sessions.read', resolved.clinic_id);
$$;

-- [RPC/FUNCTION] get_clinic_trash_items (schema.sql L5558-L5678)
CREATE OR REPLACE FUNCTION "public"."get_clinic_trash_items"("_clinic_id" "uuid", "_entity_type" "text" DEFAULT 'all'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  _auth_user_id uuid := auth.uid();
  _clean_entity_type text := lower(trim(COALESCE(_entity_type, 'all')));
  _result jsonb;
BEGIN
  -- 1. Validação de autenticação
  IF _auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  -- 2. Validação de pertinência à clínica
  IF NOT (
    public.is_active_clinic_member(_clinic_id, _auth_user_id)
    OR public.has_role(_auth_user_id, 'super_admin'::app_role)
    OR (public.is_platform_owner(_auth_user_id) AND public.get_active_platform_clinic_id(_auth_user_id) = _clinic_id)
  ) THEN
    RAISE EXCEPTION 'Acesso negado para a clinica informada.';
  END IF;

  -- 3. Validação de permissões: clinic_trash.read, clinic_trash.manage ou manager
  IF NOT (
    public.current_user_can('clinic_trash.read', _clinic_id)
    OR public.current_user_can('clinic_trash.manage', _clinic_id)
    OR public.current_user_is_clinic_manager(_clinic_id)
  ) THEN
    RAISE EXCEPTION 'Permissao negada para visualizar a lixeira da clinica.';
  END IF;

  -- 4. Construção dos itens da lixeira
  WITH trash_union AS (
    -- SESSÕES
    SELECT
      s.id,
      'sessions'::text AS entity_type,
      COALESCE(p.name, 'Atendimento sem paciente') AS title,
      CONCAT_WS(
        ' • ',
        'Data: ' || to_char(s.session_date, 'DD/MM/YYYY HH24:MI'),
        CASE WHEN prof.full_name IS NOT NULL THEN 'Profissional: ' || prof.full_name ELSE NULL END
      ) AS subtitle,
      s.deleted_at,
      COALESCE(del_prof.full_name, del_prof.social_name, del_prof.email, 'Usuário') AS deleted_by_name,
      (date_trunc('week', s.deleted_at) + interval '6 days 23 hours 59 minutes 59 seconds') AS expires_at
    FROM public.sessions s
    LEFT JOIN public.patients p ON p.id = s.patient_id
    LEFT JOIN public.profiles prof ON prof.id = COALESCE(s.provider_id, s.user_id)
    LEFT JOIN public.profiles del_prof ON del_prof.id = s.deleted_by_user_id
    WHERE s.clinic_id = _clinic_id
      AND s.deleted_at IS NOT NULL
      AND _clean_entity_type IN ('all', 'sessions', 'session')

    UNION ALL

    -- PACIENTES
    SELECT
      p.id,
      'patients'::text AS entity_type,
      p.name AS title,
      COALESCE(
        NULLIF(
          CONCAT_WS(
            ' • ',
            CASE WHEN p.patient_code IS NOT NULL AND trim(p.patient_code) <> '' THEN 'Código: ' || p.patient_code ELSE NULL END,
            CASE WHEN p.cpf IS NOT NULL AND trim(p.cpf) <> '' THEN 'CPF: ' || p.cpf ELSE NULL END,
            CASE WHEN p.phone IS NOT NULL AND trim(p.phone) <> '' THEN 'Tel: ' || p.phone ELSE NULL END
          ),
          ''
        ),
        'Paciente cadastrado'
      ) AS subtitle,
      p.deleted_at,
      COALESCE(del_prof.full_name, del_prof.social_name, del_prof.email, 'Usuário') AS deleted_by_name,
      (date_trunc('week', p.deleted_at) + interval '6 days 23 hours 59 minutes 59 seconds') AS expires_at
    FROM public.patients p
    LEFT JOIN public.profiles del_prof ON del_prof.id = p.deleted_by_user_id
    WHERE p.clinic_id = _clinic_id
      AND p.deleted_at IS NOT NULL
      AND _clean_entity_type IN ('all', 'patients', 'patient')

    UNION ALL

    -- FORMULÁRIOS / MODELOS DE ANAMNESE
    SELECT
      f.id,
      'forms'::text AS entity_type,
      f.name AS title,
      COALESCE(NULLIF(trim(f.description), ''), 'Modelo de anamnese') AS subtitle,
      f.deleted_at,
      COALESCE(del_prof.full_name, del_prof.social_name, del_prof.email, 'Usuário') AS deleted_by_name,
      (date_trunc('week', f.deleted_at) + interval '6 days 23 hours 59 minutes 59 seconds') AS expires_at
    FROM public.anamnesis_form_templates f
    LEFT JOIN public.profiles del_prof ON del_prof.id = f.deleted_by_user_id
    WHERE f.clinic_id = _clinic_id
      AND f.deleted_at IS NOT NULL
      AND _clean_entity_type IN ('all', 'forms', 'form', 'anamnesis_forms', 'anamnesis_form_templates')
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', tu.id,
        'entity_type', tu.entity_type,
        'title', tu.title,
        'subtitle', tu.subtitle,
        'deleted_at', tu.deleted_at,
        'deleted_by_name', tu.deleted_by_name,
        'expires_at', tu.expires_at
      )
      ORDER BY tu.deleted_at DESC
    ),
    '[]'::jsonb
  )
  INTO _result
  FROM trash_union tu;

  RETURN _result;
END;
$$;

-- [RPC/FUNCTION] is_active_clinic_member (schema.sql L8285-L8297)
CREATE OR REPLACE FUNCTION "public"."is_active_clinic_member"("_clinic_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_memberships
    WHERE clinic_memberships.clinic_id = _clinic_id
      AND clinic_memberships.user_id = _user_id
      AND clinic_memberships.is_active = true
      AND clinic_memberships.membership_status = 'active'
  );
$$;

-- [RPC/FUNCTION] is_clinic_owner (schema.sql L8303-L8321)
CREATE OR REPLACE FUNCTION "public"."is_clinic_owner"("_clinic_id" "uuid", "_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_memberships cm
    WHERE cm.clinic_id = _clinic_id
      AND cm.user_id = _user_id
      AND cm.is_active = true
      AND cm.membership_status = 'active'
      AND (cm.account_role = 'account_owner' OR cm.operational_role = 'owner')
  ) OR EXISTS (
    SELECT 1
    FROM public.clinics c
    WHERE c.id = _clinic_id
      AND c.account_owner_user_id = _user_id
  );
$$;

-- [RPC/FUNCTION] is_clinic_read_only (schema.sql L8327-L8376)
CREATE OR REPLACE FUNCTION "public"."is_clinic_read_only"("_clinic_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sub record;
BEGIN
  IF _clinic_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT
    status,
    is_read_only,
    is_free_trial,
    is_courtesy,
    expires_at,
    current_period_end
  INTO v_sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _clinic_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Active, Beta, Courtesy, or Pending subscriptions are never read-only
  IF COALESCE(v_sub.is_courtesy, false) = true OR v_sub.status IN ('ACTIVE', 'BETA', 'COURTESY', 'PENDING') THEN
    RETURN false;
  END IF;

  IF COALESCE(v_sub.is_read_only, false) = true THEN
    RETURN true;
  END IF;

  IF v_sub.status IN ('TRIAL_EXPIRED', 'SUSPENDED', 'CANCELED', 'EXPIRED') THEN
    RETURN true;
  END IF;

  IF v_sub.status = 'TRIAL' THEN
    IF COALESCE(v_sub.expires_at, v_sub.current_period_end) IS NOT NULL
       AND COALESCE(v_sub.expires_at, v_sub.current_period_end) < now() THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

-- [RPC/FUNCTION] notify_clinic_collaborator_presence (schema.sql L10017-L10098)
CREATE OR REPLACE FUNCTION "public"."notify_clinic_collaborator_presence"("_clinic_id" "uuid", "_user_id" "uuid", "_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_name text;
  _clinic_name text;
  _title text;
  _body text;
  _event_type text;
  _target_member record;
  _recent_notification_exists boolean := false;
BEGIN
  IF _clinic_id IS NULL OR _user_id IS NULL OR _status NOT IN ('online', 'offline') THEN
    RETURN;
  END IF;

  -- 1. Obter nome do colaborador
  SELECT COALESCE(NULLIF(trim(full_name), ''), NULLIF(trim(social_name), ''), NULLIF(trim(email), ''), 'Um colaborador')
  INTO _user_name
  FROM public.profiles
  WHERE id = _user_id;

  -- 2. Obter nome da clínica
  SELECT name
  INTO _clinic_name
  FROM public.clinics
  WHERE id = _clinic_id;

  _event_type := CASE WHEN _status = 'online' THEN 'collaborator_online' ELSE 'collaborator_offline' END;

  -- 3. Debounce para evitar oscilações rápidas (flapping)
  SELECT EXISTS (
    SELECT 1
    FROM public.app_notifications
    WHERE clinic_id = _clinic_id
      AND actor_user_id = _user_id
      AND event_type = _event_type
      AND created_at > now() - (CASE WHEN _status = 'online' THEN interval '10 minutes' ELSE interval '5 minutes' END)
  ) INTO _recent_notification_exists;

  IF _recent_notification_exists THEN
    RETURN;
  END IF;

  IF _status = 'online' THEN
    _title := 'Colaborador online';
    _body := _user_name || ' ficou online' || CASE WHEN _clinic_name IS NOT NULL THEN ' na clínica ' || _clinic_name ELSE '' END || '.';
  ELSE
    _title := 'Colaborador offline';
    _body := _user_name || ' ficou offline' || CASE WHEN _clinic_name IS NOT NULL THEN ' da clínica ' || _clinic_name ELSE '' END || '.';
  END IF;

  -- 4. Criar notificação para todos os OUTROS membros ativos da clínica
  FOR _target_member IN
    SELECT cm.user_id
    FROM public.clinic_memberships cm
    WHERE cm.clinic_id = _clinic_id
      AND cm.user_id <> _user_id
      AND cm.is_active = true
      AND cm.membership_status = 'active'
  LOOP
    PERFORM public.create_user_notification(
      _target_member.user_id,
      _clinic_id,
      _user_id,
      'clinic_access',
      _event_type,
      _title,
      _body,
      NULL,
      NULL,
      jsonb_build_object(
        'collaborator_id', _user_id,
        'collaborator_name', _user_name,
        'status', _status
      ),
      NULL
    );
  END LOOP;
END;
$$;

-- [RPC/FUNCTION] purge_clinic_trash_bin (schema.sql L10500-L10616)
CREATE OR REPLACE FUNCTION "public"."purge_clinic_trash_bin"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  _purged_sessions_count integer := 0;
  _purged_patients_count integer := 0;
  _purged_forms_count integer := 0;
  _session_ids uuid[];
  _patient_ids uuid[];
  _patient_session_ids uuid[];
  _form_ids uuid[];
BEGIN
  -- Validação de segurança: apenas chamadas internas de sistema (pg_cron/service_role) ou platform owner/super_admin
  IF auth.uid() IS NOT NULL AND NOT (
    public.is_platform_owner(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas rotinas internas de sistema ou administradores da plataforma podem executar o expurgo.';
  END IF;

  -- 1. Identifica os formulários elegíveis para expurgo definitivo:
  -- Itens cuja semana já se encerrou (domingo 23:59:59 passou) OU carência superior a 7 dias
  SELECT array_agg(id) INTO _form_ids
  FROM public.anamnesis_form_templates
  WHERE deleted_at IS NOT NULL
    AND (
      (date_trunc('week', deleted_at) + interval '6 days 23 hours 59 minutes 59 seconds') <= now()
      OR deleted_at <= (now() - interval '7 days')
      OR deleted_at < date_trunc('week', now())
    );

  IF _form_ids IS NOT NULL AND cardinality(_form_ids) > 0 THEN
    -- Desvincula templates de sessões se houver referência
    UPDATE public.sessions
    SET anamnesis_template_id = NULL
    WHERE anamnesis_template_id = ANY(_form_ids);

    DELETE FROM public.anamnesis_form_templates
    WHERE id = ANY(_form_ids);
    GET DIAGNOSTICS _purged_forms_count = ROW_COUNT;
  END IF;

  -- 2. Identifica pacientes elegíveis para expurgo definitivo
  SELECT array_agg(id) INTO _patient_ids
  FROM public.patients
  WHERE deleted_at IS NOT NULL
    AND (
      (date_trunc('week', deleted_at) + interval '6 days 23 hours 59 minutes 59 seconds') <= now()
      OR deleted_at <= (now() - interval '7 days')
      OR deleted_at < date_trunc('week', now())
    );

  IF _patient_ids IS NOT NULL AND cardinality(_patient_ids) > 0 THEN
    -- Mapeia todas as sessões ligadas a estes pacientes para remoção completa respeitando FKs
    SELECT array_agg(id) INTO _patient_session_ids
    FROM public.sessions
    WHERE patient_id = ANY(_patient_ids);

    IF _patient_session_ids IS NOT NULL AND cardinality(_patient_session_ids) > 0 THEN
      DELETE FROM public.clinical_session_billings WHERE session_id = ANY(_patient_session_ids);
      DELETE FROM public.session_edit_history WHERE session_id = ANY(_patient_session_ids);
      DELETE FROM public.session_shares WHERE session_id = ANY(_patient_session_ids);
      UPDATE public.sessions SET parent_session_id = NULL WHERE parent_session_id = ANY(_patient_session_ids);
      DELETE FROM public.sessions WHERE id = ANY(_patient_session_ids);
    END IF;

    -- Limpa registros dependentes de pacientes
    DELETE FROM public.clinical_session_billings WHERE patient_id = ANY(_patient_ids);
    DELETE FROM public.agenda_events WHERE patient_id = ANY(_patient_ids);
    DELETE FROM public.patient_clinical_snapshots WHERE patient_id = ANY(_patient_ids);
    DELETE FROM public.patient_file_uploads WHERE patient_id = ANY(_patient_ids);
    DELETE FROM public.patient_payment_plans WHERE patient_id = ANY(_patient_ids);
    DELETE FROM public.patient_evolution_groups WHERE patient_id = ANY(_patient_ids);
    DELETE FROM public.patient_registration_links WHERE patient_id = ANY(_patient_ids);
    DELETE FROM public.patient_groups WHERE patient_id = ANY(_patient_ids);

    DELETE FROM public.patients WHERE id = ANY(_patient_ids);
    GET DIAGNOSTICS _purged_patients_count = ROW_COUNT;
  END IF;

  -- 3. Identifica sessões individuais elegíveis para expurgo definitivo
  SELECT array_agg(id) INTO _session_ids
  FROM public.sessions
  WHERE deleted_at IS NOT NULL
    AND (
      (date_trunc('week', deleted_at) + interval '6 days 23 hours 59 minutes 59 seconds') <= now()
      OR deleted_at <= (now() - interval '7 days')
      OR deleted_at < date_trunc('week', now())
    );

  IF _session_ids IS NOT NULL AND cardinality(_session_ids) > 0 THEN
    -- Remove faturamentos clínicos vinculados
    DELETE FROM public.clinical_session_billings WHERE session_id = ANY(_session_ids);

    -- Remove histórico de edições e compartilhamentos
    DELETE FROM public.session_edit_history WHERE session_id = ANY(_session_ids);
    DELETE FROM public.session_shares WHERE session_id = ANY(_session_ids);

    -- Limpa dependências de autorreferência e uploads
    UPDATE public.sessions SET parent_session_id = NULL WHERE parent_session_id = ANY(_session_ids);
    UPDATE public.patient_file_uploads SET session_id = NULL WHERE session_id = ANY(_session_ids);

    -- Expurga definitivamente as sessões
    DELETE FROM public.sessions WHERE id = ANY(_session_ids);
    GET DIAGNOSTICS _purged_sessions_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'purged_sessions', _purged_sessions_count,
    'purged_patients', _purged_patients_count,
    'purged_forms', _purged_forms_count,
    'executed_at', now()
  );
END;
$$;

-- [RPC/FUNCTION] resend_clinic_collaborator_invitation (schema.sql L11430-L11531)
CREATE OR REPLACE FUNCTION "public"."resend_clinic_collaborator_invitation"("_invitation_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions'
    AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  _token_hash text := md5(_token);
  _sha256_hash text;
  _remaining_seconds integer;
  _account_state text := 'invite_sent';
  _existing_user auth.users%ROWTYPE;
  _clinic_route_key text;
  _is_service_role boolean := (coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role');
BEGIN
  IF NOT _is_service_role THEN
    IF _requester_id IS NULL THEN
      RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;
  END IF;

  SELECT * INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE id = _invitation_id
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF NOT _is_service_role THEN
    IF NOT (
      public.current_user_can('subaccounts.manage', _invitation.clinic_id) OR
      public.is_platform_owner_mfa_verified(_requester_id)
    ) THEN
      RAISE EXCEPTION 'Sem permissão para reenviar convites desta clínica.';
    END IF;
  END IF;

  IF _invitation.last_resent_at IS NOT NULL AND (now() - _invitation.last_resent_at) < interval '5 seconds' THEN
    _remaining_seconds := 5 - extract(epoch from (now() - _invitation.last_resent_at))::integer;
    RAISE EXCEPTION 'Aguarde % segundos antes de reenviar o convite novamente.', GREATEST(_remaining_seconds, 1);
  END IF;

  _sha256_hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  UPDATE public.clinic_collaborator_invitations
  SET status = 'pending',
      token_hash = _token_hash,
      valid_token_hashes = ARRAY(
        SELECT u FROM (
          SELECT DISTINCT u
          FROM unnest(
            array_cat(
              COALESCE(valid_token_hashes, ARRAY[token_hash]),
              ARRAY[_token_hash, _sha256_hash]
            )
          ) AS u
          WHERE u IS NOT NULL AND u <> ''
        ) sub
        ORDER BY 1 DESC
        LIMIT 10
      ),
      last_resent_at = now(),
      updated_at = now(),
      expires_at = now() + interval '14 days',
      email_delivery_status = 'pending',
      email_last_error = NULL,
      email_sent_at = NULL
  WHERE id = _invitation_id;

  SELECT * INTO _existing_user
  FROM auth.users
  WHERE lower(users.email) = lower(_invitation.email)
  LIMIT 1;

  IF _existing_user.id IS NOT NULL THEN
    IF _existing_user.email_confirmed_at IS NULL THEN
      _account_state := 'registered_unconfirmed';
    ELSE
      _account_state := 'registered_confirmed_pending_acceptance';
    END IF;
  END IF;

  SELECT route_key INTO _clinic_route_key
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', _invitation.id,
    'token', _token,
    'status', 'pending',
    'destination_url', '/convite/clinica/' || _token,
    'clinic_route_key', _clinic_route_key,
    'role_key', _invitation.role_key,
    'account_state', _account_state,
    'email_delivery_status', 'pending'
  );
END;
$$;

-- [RPC/FUNCTION] revoke_clinic_member_access (schema.sql L11821-L11894)
CREATE OR REPLACE FUNCTION "public"."revoke_clinic_member_access"("_membership_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _target_membership public.clinic_memberships%ROWTYPE;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  SELECT *
  INTO _target_membership
  FROM public.clinic_memberships
  WHERE id = _membership_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador nao encontrado.';
  END IF;

  IF _target_membership.account_role = 'account_owner' OR _target_membership.operational_role = 'owner' THEN
    RAISE EXCEPTION 'A conta principal nao pode ser removida da clinica.';
  END IF;

  IF _target_membership.user_id = _requester_id THEN
    RAISE EXCEPTION 'Use o fluxo do espaco pessoal para remover seu proprio acesso.';
  END IF;

  IF NOT (
    public.current_user_can('subaccounts.delete', _target_membership.clinic_id)
    OR public.current_user_can('subaccounts.manage', _target_membership.clinic_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissao para remover colaboradores desta clinica.';
  END IF;

  UPDATE public.clinic_memberships
  SET
    membership_status = 'inactive',
    is_active = false,
    ended_at = now()
  WHERE id = _membership_id;

  UPDATE public.user_security_sessions
  SET
    ended_at = now(),
    force_signed_out_at = now(),
    forced_out_by = _requester_id,
    last_seen_at = now()
  WHERE clinic_id = _target_membership.clinic_id
    AND user_id = _target_membership.user_id
    AND ended_at IS NULL;

  DELETE FROM public.user_active_clinic_contexts
  WHERE user_id = _target_membership.user_id
    AND clinic_id = _target_membership.clinic_id;

  PERFORM public.log_security_event(
    _target_membership.clinic_id,
    _requester_id,
    _target_membership.user_id,
    'clinic_member_access_revoked',
    'admin',
    jsonb_build_object(
      'membership_id', _membership_id,
      'previous_status', _target_membership.membership_status,
      'previous_role', _target_membership.operational_role,
      'initiated_by', 'clinic'
    )
  );

  RETURN jsonb_build_object('membership_id', _membership_id, 'status', 'inactive');
END;
$$;

-- [RPC/FUNCTION] sanitize_clinical_free_text (schema.sql L12154-L12191)
CREATE OR REPLACE FUNCTION "public"."sanitize_clinical_free_text"("_text" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  _sanitized text := _text;
BEGIN
  IF _sanitized IS NULL OR trim(_sanitized) = '' THEN
    RETURN _sanitized;
  END IF;

  -- 1. Sanitizar e-mails primeiro para não conflitar com regex de pontuação/letras
  _sanitized := regexp_replace(
    _sanitized,
    '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
    '[EMAIL OCULTADO]',
    'g'
  );

  -- 2. Sanitizar CPFs (com pontuação ou sequência de 11 dígitos com separadores opcionais)
  _sanitized := regexp_replace(
    _sanitized,
    '\y\d{3}\.?\d{3}\.?\d{3}[-\s]?\d{2}\y',
    '[DOCUMENTO OCULTADO]',
    'g'
  );

  -- 3. Sanitizar telefones celulares e fixos com DDD ou +55 opcional
  _sanitized := regexp_replace(
    _sanitized,
    '(\+?55\s*)?(\(?\d{2}\)?\s*)?(9\s*)?\d{4}[-\s]?\d{4}',
    '[CONTATO OCULTADO]',
    'g'
  );

  RETURN _sanitized;
END;
$$;

-- [RPC/FUNCTION] update_clinic_collaborator_invitation (schema.sql L13530-L13574)
CREATE OR REPLACE FUNCTION "public"."update_clinic_collaborator_invitation"("_invitation_id" "uuid", "_operational_role" "public"."operational_role_type" DEFAULT 'professional'::"public"."operational_role_type", "_job_title" "text" DEFAULT NULL::"text", "_specialty" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE id = _invitation_id
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF _invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Apenas convites pendentes podem ser editados.';
  END IF;

  IF NOT public.current_user_can('subaccounts.manage', _invitation.clinic_id) THEN
    RAISE EXCEPTION 'Sem permissão para editar convites desta clínica.';
  END IF;

  UPDATE public.clinic_collaborator_invitations
  SET operational_role = _operational_role,
      job_title = NULLIF(trim(coalesce(_job_title, '')), ''),
      specialty = NULLIF(trim(coalesce(_specialty, '')), ''),
      updated_at = now()
  WHERE id = _invitation_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', _invitation_id,
    'operational_role', _operational_role,
    'job_title', _job_title,
    'specialty', _specialty
  );
END;
$$;

-- [RPC/FUNCTION] update_clinic_concurrent_accesses (schema.sql L13580-L13656)
CREATE OR REPLACE FUNCTION "public"."update_clinic_concurrent_accesses"("_clinic_id" "uuid", "_extra_concurrent" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current_user_id uuid := auth.uid();
  v_sub_record public.clinic_subscriptions%ROWTYPE;
  v_extra_seat_price numeric(10,2) := 25.00;
  v_base_monthly_price numeric(10,2);
  v_cycle text;
  v_plan_str text;
BEGIN
  IF NOT public.is_clinic_subscription_manager(v_current_user_id, _clinic_id) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o responsável pela clínica pode ajustar os acessos simultâneos.';
  END IF;

  IF COALESCE(_extra_concurrent, 0) < 0 THEN
    RAISE EXCEPTION 'Quantidade de acessos extras inválida.';
  END IF;

  SELECT * INTO v_sub_record FROM public.clinic_subscriptions WHERE clinic_id = _clinic_id;
  IF v_sub_record.id IS NULL THEN
    INSERT INTO public.clinic_subscriptions (
      clinic_id, account_owner_user_id, plan_type, billing_cycle,
      base_monthly_price, base_subaccount_limit, base_concurrent_access_count, status
    )
    VALUES (_clinic_id, v_current_user_id, 'clinica_medio', 'ANNUAL', 104.25, 999999, 4, 'PENDING')
    RETURNING * INTO v_sub_record;
  END IF;

  v_plan_str := LOWER(v_sub_record.plan_type::text);

  IF v_plan_str IN ('prof_basico', 'prof_medio', 'prof_top', 'solo') THEN
    RAISE EXCEPTION 'Não é possível adicionar acessos simultâneos extras nos planos individuais. Faça upgrade para um plano Clínica primeiro.';
  END IF;

  v_cycle := LOWER(COALESCE(v_sub_record.billing_cycle, 'annual'));

  -- Preço base do plano no ciclo atual
  IF v_plan_str = 'clinica_basico' THEN
    v_base_monthly_price := CASE
      WHEN v_cycle = 'monthly' THEN 99.00
      WHEN v_cycle = 'quarterly' THEN 89.10
      ELSE 74.25
    END;
  ELSIF v_plan_str IN ('clinica_top', 'enterprise') THEN
    v_base_monthly_price := CASE
      WHEN v_cycle = 'monthly' THEN 199.00
      WHEN v_cycle = 'quarterly' THEN 179.10
      ELSE 149.25
    END;
  ELSE -- clinica_medio, clinic
    v_base_monthly_price := CASE
      WHEN v_cycle = 'monthly' THEN 139.00
      WHEN v_cycle = 'quarterly' THEN 125.10
      ELSE 104.25
    END;
  END IF;

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

-- [RPC/FUNCTION] update_clinic_member_operational_fields (schema.sql L13662-L13766)
CREATE OR REPLACE FUNCTION "public"."update_clinic_member_operational_fields"("_membership_id" "uuid", "_job_title" "text" DEFAULT NULL::"text", "_specialty" "text" DEFAULT NULL::"text", "_working_hours" "text" DEFAULT NULL::"text", "_operational_role" "public"."operational_role_type" DEFAULT NULL::"public"."operational_role_type", "_membership_status" "public"."membership_status_type" DEFAULT NULL::"public"."membership_status_type", "_role_key" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _target_membership public.clinic_memberships%ROWTYPE;
  _normalized_role_key text := lower(trim(coalesce(_role_key, '')));
  _inferred_operational_role public.operational_role_type := _operational_role;
  _custom_role record;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  SELECT *
  INTO _target_membership
  FROM public.clinic_memberships
  WHERE id = _membership_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador nao encontrado.';
  END IF;

  IF _target_membership.account_role = 'account_owner' THEN
    RAISE EXCEPTION 'A conta principal nao pode ser editada por este fluxo.';
  END IF;

  IF NOT (
    public.current_user_can('subaccounts.manage', _target_membership.clinic_id)
    OR public.current_user_can('subaccounts.write', _target_membership.clinic_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissao para editar colaboradores nesta clinica.';
  END IF;

  IF (_operational_role IS NOT NULL OR _role_key IS NOT NULL) AND NOT public.current_user_can('subaccounts_roles.manage', _target_membership.clinic_id) THEN
    RAISE EXCEPTION 'Sem permissao para alterar a hierarquia deste colaborador.';
  END IF;

  IF _operational_role = 'owner' OR _normalized_role_key = 'owner' THEN
    RAISE EXCEPTION 'O papel owner fica reservado para a conta principal.';
  END IF;

  IF _membership_status IS NOT NULL AND _membership_status = 'invited' THEN
    RAISE EXCEPTION 'Status convidado e controlado pelo fluxo de convites.';
  END IF;

  -- Validação de role_key
  IF _normalized_role_key IS NOT NULL AND _normalized_role_key <> '' THEN
    IF _normalized_role_key IN ('admin', 'professional', 'assistant', 'estagiario') THEN
      _inferred_operational_role := _normalized_role_key::public.operational_role_type;
    ELSE
      SELECT *
      INTO _custom_role
      FROM public.clinic_operational_roles
      WHERE clinic_id = _target_membership.clinic_id
        AND role_key = _normalized_role_key
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Papel operacional inválido para esta clínica.';
      END IF;

      _inferred_operational_role := _custom_role.base_operational_role;
    END IF;
  END IF;

  UPDATE public.profiles
  SET
    job_title = CASE WHEN _job_title IS NULL THEN job_title ELSE NULLIF(trim(_job_title), '') END,
    specialty = CASE WHEN _specialty IS NULL THEN specialty ELSE NULLIF(trim(_specialty), '') END,
    working_hours = CASE WHEN _working_hours IS NULL THEN working_hours ELSE NULLIF(trim(_working_hours), '') END,
    updated_at = now()
  WHERE id = _target_membership.user_id;

  UPDATE public.clinic_memberships
  SET
    operational_role = COALESCE(_inferred_operational_role, operational_role),
    role_key = CASE 
      WHEN _role_key IS NOT NULL THEN NULLIF(_normalized_role_key, '')
      ELSE role_key 
    END,
    membership_status = COALESCE(_membership_status, membership_status),
    is_active = CASE
      WHEN _membership_status IS NULL THEN is_active
      WHEN _membership_status = 'active' THEN true
      ELSE false
    END,
    ended_at = CASE
      WHEN _membership_status IS NULL THEN ended_at
      WHEN _membership_status = 'active' THEN NULL
      ELSE COALESCE(ended_at, now())
    END,
    updated_at = now()
  WHERE id = _target_membership.id;

  RETURN jsonb_build_object(
    'membership_id', _target_membership.id,
    'clinic_id', _target_membership.clinic_id,
    'operational_role', COALESCE(_inferred_operational_role, _target_membership.operational_role),
    'role_key', CASE WHEN _role_key IS NOT NULL THEN NULLIF(_normalized_role_key, '') ELSE _target_membership.role_key END,
    'status', COALESCE(_membership_status, _target_membership.membership_status)
  );
END;
$$;

-- [RPC/FUNCTION] update_clinic_subaccount (schema.sql L13772-L13888)
CREATE OR REPLACE FUNCTION "public"."update_clinic_subaccount"("_membership_id" "uuid", "_full_name" "text" DEFAULT NULL::"text", "_email" "text" DEFAULT NULL::"text", "_cpf" "text" DEFAULT NULL::"text", "_professional_license" "text" DEFAULT NULL::"text", "_phone" "text" DEFAULT NULL::"text", "_specialty" "text" DEFAULT NULL::"text", "_job_title" "text" DEFAULT NULL::"text", "_operational_role" "public"."operational_role_type" DEFAULT NULL::"public"."operational_role_type", "_membership_status" "public"."membership_status_type" DEFAULT NULL::"public"."membership_status_type", "_new_password" "text" DEFAULT NULL::"text", "_working_hours" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _target_membership public.clinic_memberships%ROWTYPE;
  _normalized_email text;
  _normalized_cpf text;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  SELECT *
  INTO _target_membership
  FROM public.clinic_memberships
  WHERE id = _membership_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subconta nao encontrada.';
  END IF;

  IF _target_membership.account_role = 'account_owner' THEN
    RAISE EXCEPTION 'A conta principal nao pode ser editada por este fluxo.';
  END IF;

  IF NOT public.current_user_can('subaccounts.manage', _target_membership.clinic_id) THEN
    RAISE EXCEPTION 'Sem permissao para editar subcontas nesta clinica.';
  END IF;

  IF _operational_role IS NOT NULL AND NOT public.current_user_can('subaccounts_roles.manage', _target_membership.clinic_id) THEN
    RAISE EXCEPTION 'Sem permissao para alterar a hierarquia desta subconta.';
  END IF;

  IF _operational_role = 'owner' THEN
    RAISE EXCEPTION 'O papel owner fica reservado para a conta principal.';
  END IF;

  _normalized_email := NULLIF(lower(trim(coalesce(_email, ''))), '');

  IF _normalized_email IS NOT NULL AND EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = _normalized_email
      AND id <> _target_membership.user_id
  ) THEN
    RAISE EXCEPTION 'Ja existe uma conta cadastrada com este e-mail.';
  END IF;

  IF NULLIF(coalesce(_new_password, ''), '') IS NOT NULL AND length(_new_password) < 6 THEN
    RAISE EXCEPTION 'A nova senha precisa ter pelo menos 6 caracteres.';
  END IF;

  IF _full_name IS NOT NULL AND NULLIF(trim(_full_name), '') IS NULL THEN
    RAISE EXCEPTION 'O nome da subconta nao pode ficar vazio.';
  END IF;

  IF _membership_status IS NOT NULL AND _membership_status = 'invited' THEN
    RAISE EXCEPTION 'Este fluxo usa subcontas ativas; status convidado nao esta disponivel aqui.';
  END IF;

  _normalized_cpf := CASE
    WHEN _cpf IS NULL THEN NULL
    ELSE NULLIF(regexp_replace(_cpf, '\D', '', 'g'), '')
  END;

  UPDATE auth.users
  SET
    email = COALESCE(_normalized_email, email),
    encrypted_password = CASE
      WHEN NULLIF(coalesce(_new_password, ''), '') IS NOT NULL THEN extensions.crypt(_new_password, extensions.gen_salt('bf'))
      ELSE encrypted_password
    END,
    raw_user_meta_data = CASE
      WHEN _full_name IS NOT NULL THEN coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', trim(_full_name))
      ELSE raw_user_meta_data
    END,
    updated_at = now()
  WHERE id = _target_membership.user_id;

  IF _normalized_email IS NOT NULL THEN
    UPDATE auth.identities
    SET
      provider_id = _normalized_email,
      identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', _normalized_email),
      updated_at = now()
    WHERE user_id = _target_membership.user_id
      AND provider = 'email';
  END IF;

  UPDATE public.profiles
  SET
    full_name = COALESCE(NULLIF(trim(_full_name), ''), full_name),
    email = COALESCE(_normalized_email, email),
    cpf = COALESCE(_normalized_cpf, cpf),
    professional_license = CASE WHEN _professional_license IS NULL THEN professional_license ELSE NULLIF(trim(_professional_license), '') END,
    phone = CASE WHEN _phone IS NULL THEN phone ELSE NULLIF(trim(_phone), '') END,
    specialty = CASE WHEN _specialty IS NULL THEN specialty ELSE NULLIF(trim(_specialty), '') END,
    job_title = CASE WHEN _job_title IS NULL THEN job_title ELSE NULLIF(trim(_job_title), '') END,
    working_hours = CASE WHEN _working_hours IS NULL THEN working_hours ELSE NULLIF(trim(_working_hours), '') END,
    updated_at = now()
  WHERE id = _target_membership.user_id;

  UPDATE public.clinic_memberships
  SET
    operational_role = COALESCE(_operational_role, operational_role),
    membership_status = COALESCE(_membership_status, membership_status)
  WHERE id = _membership_id;

  RETURN jsonb_build_object(
    'membership_id', _membership_id,
    'user_id', _target_membership.user_id,
    'clinic_id', _target_membership.clinic_id
  );
END;
$$;

-- [TABLE] clinic_collaborator_invitations (schema.sql L15462-L15486)
CREATE TABLE IF NOT EXISTS "public"."clinic_collaborator_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "operational_role" "public"."operational_role_type" DEFAULT 'professional'::"public"."operational_role_type" NOT NULL,
    "job_title" "text",
    "specialty" "text",
    "token_hash" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invited_by" "uuid",
    "existing_user_id" "uuid",
    "accepted_by" "uuid",
    "accepted_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '14 days'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_resent_at" timestamp with time zone,
    "role_key" "text",
    "email_delivery_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "email_last_error" "text",
    "email_sent_at" timestamp with time zone,
    "valid_token_hashes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "clinic_collaborator_invitations_email_delivery_status_check" CHECK (("email_delivery_status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"]))),
    CONSTRAINT "clinic_collaborator_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'cancelled'::"text", 'expired'::"text"])))
);

-- [TABLE] clinic_health_insurances (schema.sql L15628-L15641)
CREATE TABLE IF NOT EXISTS "public"."clinic_health_insurances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "ans_code" "text",
    "payment_term_days" integer DEFAULT 30 NOT NULL,
    "requires_authorization_guide" boolean DEFAULT true NOT NULL,
    "requires_session_signature" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "clinic_health_insurances_payment_term_days_check" CHECK (("payment_term_days" >= 0))
);

-- [TABLE] clinic_insurance_procedures (schema.sql L15647-L15660)
CREATE TABLE IF NOT EXISTS "public"."clinic_insurance_procedures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "health_insurance_id" "uuid" NOT NULL,
    "procedure_name" "text" NOT NULL,
    "tuss_code" "text",
    "session_unit_amount_cents" bigint NOT NULL,
    "copay_amount_cents" bigint DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "clinic_insurance_procedures_copay_amount_cents_check" CHECK (("copay_amount_cents" >= 0)),
    CONSTRAINT "clinic_insurance_procedures_session_unit_amount_cents_check" CHECK (("session_unit_amount_cents" >= 0))
);

-- [TABLE] clinic_memberships (schema.sql L15666-L15712)
CREATE TABLE IF NOT EXISTS "public"."clinic_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_role" "public"."account_role_type",
    "operational_role" "public"."operational_role_type" DEFAULT 'professional'::"public"."operational_role_type" NOT NULL,
    "membership_status" "public"."membership_status_type" DEFAULT 'active'::"public"."membership_status_type" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "job_title" "text",
    "specialty" "text",
    "working_hours" "jsonb",
    "role_key" "text"
)
WITH ("autovacuum_vacuum_scale_factor"='0.05', "autovacuum_vacuum_threshold"='200', "autovacuum_analyze_scale_factor"='0.02');


ALTER TABLE "public"."clinic_memberships" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clinic_memberships"."job_title" IS 'Cargo operacional do colaborador nesta clínica específica.';



COMMENT ON COLUMN "public"."clinic_memberships"."specialty" IS 'Especialidade de atuação do colaborador nesta clínica específica.';



COMMENT ON COLUMN "public"."clinic_memberships"."working_hours" IS 'Horários de trabalho estruturados ou descritivos do colaborador nesta clínica.';



CREATE TABLE IF NOT EXISTS "public"."clinic_operational_role_capabilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "operational_role" "text" NOT NULL,
    "capability" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "clinic_operational_role_capabilities_known" CHECK (("capability" = ANY (ARRAY['clinic_profile.read'::"text", 'clinic_profile.manage'::"text", 'clinic_terms.manage'::"text", 'clinic_trash.manage'::"text", 'forms.read'::"text", 'forms.manage'::"text", 'subaccounts.read'::"text", 'subaccounts.write'::"text", 'subaccounts.manage'::"text", 'subaccounts.delete'::"text", 'subaccounts_roles.read'::"text", 'subaccounts_roles.manage'::"text", 'subscription_billing.read'::"text", 'subscription_billing.manage'::"text", 'treasury.read'::"text", 'treasury.manage'::"text", 'agenda.delete_events'::"text", 'subaccounts_analytics.read'::"text", 'team_development.manage'::"text", 'patients.read'::"text", 'patients.write'::"text", 'patients.delete'::"text", 'patients.manage_exclusive'::"text", 'patients_groups.read'::"text", 'patients.manage_groups'::"text", 'schedule.read'::"text", 'schedule.read_all'::"text", 'schedule.write'::"text", 'schedule.write_others'::"text", 'sessions.read'::"text", 'sessions.write'::"text", 'sessions.read_all'::"text", 'sessions.write_others'::"text", 'sessions.share'::"text", 'sessions.delete'::"text", 'session.delete_draft'::"text", 'system.print'::"text", 'marketing.affiliates.view'::"text", 'marketing.affiliates.manage'::"text", 'marketing.affiliates.withdraw'::"text"]))),
    CONSTRAINT "clinic_operational_role_capabilities_no_owner" CHECK (("operational_role" <> 'owner'::"text"))
);

-- [TABLE] clinic_terms (schema.sql L15823-L15838)
CREATE TABLE IF NOT EXISTS "public"."clinic_terms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "term_type" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "content_markdown" "text" NOT NULL,
    "b2_object_key" "text" NOT NULL,
    "byte_size" integer DEFAULT 0 NOT NULL,
    "compressed_byte_size" integer DEFAULT 0 NOT NULL,
    "storage_encoding" "text" DEFAULT 'gzip'::"text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "clinic_terms_term_type_check" CHECK (("term_type" = ANY (ARRAY['adult_consent'::"text", 'minor_consent'::"text"])))
);

-- [TABLE] clinics (schema.sql L15876-L15907)
CREATE TABLE IF NOT EXISTS "public"."clinics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cnpj" "text" NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "logo_url" "text",
    "theme" "jsonb" DEFAULT '{"accent": "210 40% 96.1%", "primary": "221.2 83.2% 53.3%", "secondary": "210 40% 96.1%"}'::"jsonb",
    "custom_fields" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "anamnesis_base_schema" "jsonb" DEFAULT "jsonb_build_array"("jsonb_build_object"('id', 'section_initial', 'label', 'Contexto inicial', 'type', 'section', 'helpText', 'Use esta área para orientar o preenchimento da ficha.'), "jsonb_build_object"('id', 'main_complaint', 'label', 'Queixa principal', 'type', 'long_text', 'required', true)) NOT NULL,
    "legal_name" "text",
    "email" "text",
    "phone" "text",
    "address" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "business_hours" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "subscription_plan" "public"."subscription_plan" DEFAULT 'solo'::"public"."subscription_plan" NOT NULL,
    "account_owner_user_id" "uuid",
    "subaccount_limit" integer DEFAULT 0 NOT NULL,
    "route_key" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(12), 'hex'::"text") NOT NULL,
    "access_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "concurrent_access_limit" integer,
    "is_hibernated" boolean DEFAULT false NOT NULL,
    "hibernated_at" timestamp with time zone,
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "allow_team_personal_affiliates" boolean DEFAULT false NOT NULL,
    CONSTRAINT "clinics_access_status_check" CHECK (("access_status" = ANY (ARRAY['active'::"text", 'payment_pending'::"text", 'temporarily_paused'::"text", 'banned'::"text"]))),
    CONSTRAINT "clinics_anamnesis_base_schema_shape_check" CHECK ((("jsonb_typeof"("anamnesis_base_schema") = 'array'::"text") AND
CASE
    WHEN ("jsonb_typeof"("anamnesis_base_schema") = 'array'::"text") THEN ("jsonb_array_length"("anamnesis_base_schema") <= 200)
    ELSE false
END))
);

-- [POLICY] Managers insert clinic memberships ON clinic_memberships (schema.sql L19682-L19684)
CREATE POLICY "Managers insert clinic memberships" ON "public"."clinic_memberships" FOR INSERT TO "authenticated" WITH CHECK ((("public"."current_user_can"('subaccounts.write'::"text", "clinic_id") OR "public"."current_user_can"('subaccounts.manage'::"text", "clinic_id")) AND (EXISTS ( SELECT 1
   FROM "public"."clinics"
  WHERE (("clinics"."id" = "clinic_memberships"."clinic_id") AND (("clinics"."subscription_plan")::"text" = ANY (ARRAY['clinic'::"text", 'enterprise'::"text", 'clinica_basico'::"text", 'clinica_medio'::"text", 'clinica_top'::"text", 'prof_top'::"text"])))))));

-- [POLICY] Managers read clinic collaborator invitations ON clinic_collaborator_invitations (schema.sql L19688-L19688)
CREATE POLICY "Managers read clinic collaborator invitations" ON "public"."clinic_collaborator_invitations" FOR SELECT TO "authenticated" USING (("public"."current_user_can"('subaccounts.read'::"text", "clinic_id") OR "public"."current_user_can"('subaccounts.write'::"text", "clinic_id") OR "public"."current_user_can"('subaccounts.manage'::"text", "clinic_id")));

-- [POLICY] Managers update clinic memberships ON clinic_memberships (schema.sql L19692-L19692)
CREATE POLICY "Managers update clinic memberships" ON "public"."clinic_memberships" FOR UPDATE TO "authenticated" USING ("public"."current_user_can"('subaccounts.manage'::"text", "clinic_id")) WITH CHECK ("public"."current_user_can"('subaccounts.manage'::"text", "clinic_id"));

-- [POLICY] Platform admins podem ver todas as clinicas ON clinics (schema.sql L19792-L19794)
CREATE POLICY "Platform admins podem ver todas as clinicas" ON "public"."clinics" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins" "pa"
  WHERE (("pa"."user_id" = "auth"."uid"()) AND ("pa"."is_active" = true)))));

-- [POLICY] Super admins manage all clinics ON clinics (schema.sql L19932-L19932)
CREATE POLICY "Super admins manage all clinics" ON "public"."clinics" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));

-- [POLICY] Users delete clinic terms ON clinic_terms (schema.sql L20034-L20034)
CREATE POLICY "Users delete clinic terms" ON "public"."clinic_terms" FOR DELETE TO "authenticated" USING ((("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('clinic_terms.manage'::"text", "clinic_id")));

-- [POLICY] Users insert clinic terms ON clinic_terms (schema.sql L20068-L20068)
CREATE POLICY "Users insert clinic terms" ON "public"."clinic_terms" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('clinic_terms.manage'::"text", "clinic_id")));

-- [POLICY] Users read clinic memberships ON clinic_memberships (schema.sql L20116-L20116)
CREATE POLICY "Users read clinic memberships" ON "public"."clinic_memberships" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())) OR "public"."user_has_active_clinic_membership"("auth"."uid"(), "clinic_id")));

-- [POLICY] Users read clinic terms ON clinic_terms (schema.sql L20155-L20155)
CREATE POLICY "Users read clinic terms" ON "public"."clinic_terms" FOR SELECT TO "authenticated" USING ((("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())) AND "public"."can_read_clinic_data"("clinic_id") AND ("public"."current_user_can"('patients.read'::"text", "clinic_id") OR "public"."current_user_can"('clinic_terms.manage'::"text", "clinic_id") OR "public"."current_user_can"('clinic_profile.read'::"text", "clinic_id"))));

-- [POLICY] Users read own clinic ON clinics (schema.sql L20171-L20171)
CREATE POLICY "Users read own clinic" ON "public"."clinics" FOR SELECT TO "authenticated" USING ((("id" = "public"."get_user_clinic_id"("auth"."uid"())) OR "public"."user_has_active_clinic_membership"("auth"."uid"(), "id") OR ("account_owner_user_id" = "auth"."uid"())));

-- [POLICY] Users update clinic terms ON clinic_terms (schema.sql L20223-L20223)
CREATE POLICY "Users update clinic terms" ON "public"."clinic_terms" FOR UPDATE TO "authenticated" USING ((("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('clinic_terms.manage'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('clinic_terms.manage'::"text", "clinic_id")));

-- [POLICY] Users update managed clinic ON clinics (schema.sql L20227-L20227)
CREATE POLICY "Users update managed clinic" ON "public"."clinics" FOR UPDATE TO "authenticated" USING ("public"."current_user_can"('clinic_profile.manage'::"text", "id")) WITH CHECK ("public"."current_user_can"('clinic_profile.manage'::"text", "id"));

-- [POLICY] clinic_health_insurances_delete ON clinic_health_insurances (schema.sql L20335-L20335)
CREATE POLICY "clinic_health_insurances_delete" ON "public"."clinic_health_insurances" FOR DELETE USING ("public"."current_user_can"('treasury.manage'::"text", "clinic_id"));

-- [POLICY] clinic_health_insurances_insert ON clinic_health_insurances (schema.sql L20339-L20339)
CREATE POLICY "clinic_health_insurances_insert" ON "public"."clinic_health_insurances" FOR INSERT WITH CHECK ("public"."current_user_can"('treasury.manage'::"text", "clinic_id"));

-- [POLICY] clinic_health_insurances_select ON clinic_health_insurances (schema.sql L20343-L20343)
CREATE POLICY "clinic_health_insurances_select" ON "public"."clinic_health_insurances" FOR SELECT USING (("public"."user_has_active_clinic_membership"("auth"."uid"(), "clinic_id") AND ("deleted_at" IS NULL)));

-- [POLICY] clinic_health_insurances_update ON clinic_health_insurances (schema.sql L20347-L20347)
CREATE POLICY "clinic_health_insurances_update" ON "public"."clinic_health_insurances" FOR UPDATE USING ("public"."current_user_can"('treasury.manage'::"text", "clinic_id")) WITH CHECK ("public"."current_user_can"('treasury.manage'::"text", "clinic_id"));

-- [POLICY] clinic_insurance_procedures_all ON clinic_insurance_procedures (schema.sql L20354-L20354)
CREATE POLICY "clinic_insurance_procedures_all" ON "public"."clinic_insurance_procedures" USING ("public"."current_user_can"('treasury.manage'::"text", "clinic_id")) WITH CHECK ("public"."current_user_can"('treasury.manage'::"text", "clinic_id"));

-- [POLICY] clinic_insurance_procedures_select ON clinic_insurance_procedures (schema.sql L20358-L20358)
CREATE POLICY "clinic_insurance_procedures_select" ON "public"."clinic_insurance_procedures" FOR SELECT USING ("public"."user_has_active_clinic_membership"("auth"."uid"(), "clinic_id"));
