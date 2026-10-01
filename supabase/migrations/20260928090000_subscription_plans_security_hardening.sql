-- Migration: 20260928090000_subscription_plans_security_hardening.sql
-- Descrição: Blindagem de segurança (RBAC & RLS) e cotas estritas para a nova esteira de planos:
-- 1. invite_clinic_collaborator:
--    - Impede que usuários em planos monoposto (prof_basico, prof_medio, solo) convidem colaboradores.
--    - Trava estrita para o plano Profissional Top (prof_top): máximo de 1 colaborador de apoio (total 2 membros).
--    - Respeita o subaccount_limit da clínica em todos os tiers.
-- 2. accept_clinic_collaborator_invitation:
--    - Valida o subaccount_limit e o plano da clínica antes de ativar novos membros, evitando que convites antigos
--      sejam aceitos caso a clínica tenha sofrido downgrade para monoposto ou já tenha atingido o teto do prof_top.
-- 3. current_user_can_role_capability:
--    - Bloqueia capacidades de gestão de subcontas/equipe em planos monoposto mesmo para o account_owner.

-- 1. Atualizar RPC invite_clinic_collaborator com validações de esteira de planos
CREATE OR REPLACE FUNCTION public.invite_clinic_collaborator(
  _clinic_id uuid DEFAULT NULL::uuid,
  _email text DEFAULT NULL::text,
  _operational_role public.operational_role_type DEFAULT 'professional'::public.operational_role_type,
  _job_title text DEFAULT NULL::text,
  _specialty text DEFAULT NULL::text,
  _role_key text DEFAULT NULL::text
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'auth'
AS $_$
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
      AND account_role NOT IN ('account_owner', 'owner');

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
      AND account_role NOT IN ('account_owner', 'owner');

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
  SET status = 'cancelled'
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
    status
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
    'pending'
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
$_$;

ALTER FUNCTION public.invite_clinic_collaborator(uuid, text, public.operational_role_type, text, text, text) OWNER TO postgres;
GRANT ALL ON FUNCTION public.invite_clinic_collaborator(uuid, text, public.operational_role_type, text, text, text) TO service_role;
GRANT ALL ON FUNCTION public.invite_clinic_collaborator(uuid, text, public.operational_role_type, text, text, text) TO authenticated;

-- 2. Atualizar accept_clinic_collaborator_invitation com checagem de cota da clínica
CREATE OR REPLACE FUNCTION public.accept_clinic_collaborator_invitation(
  _token text,
  _full_name text DEFAULT NULL::text
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'auth'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _profile_exists boolean;
  _clinic_plan text;
  _subaccount_limit integer;
  _active_members_count integer;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para aceitar o convite.';
  END IF;

  SELECT lower(email)
  INTO _user_email
  FROM auth.users
  WHERE id = _user_id;

  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE token_hash = md5(coalesce(_token, ''))
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF _invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Este convite não está mais pendente.';
  END IF;

  IF _invitation.expires_at < now() THEN
    UPDATE public.clinic_collaborator_invitations
    SET status = 'expired'
    WHERE id = _invitation.id;
    RAISE EXCEPTION 'Este convite expirou.';
  END IF;

  IF _user_email IS DISTINCT FROM lower(_invitation.email) THEN
    RAISE EXCEPTION 'Entre com o e-mail convidado para aceitar este acesso.';
  END IF;

  -- Validação de cota do plano da clínica antes de admitir novo membro
  SELECT LOWER(COALESCE(subscription_plan::text, 'solo')), COALESCE(subaccount_limit, 1)
  INTO _clinic_plan, _subaccount_limit
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  IF _clinic_plan IN ('prof_basico', 'prof_medio', 'solo') THEN
    RAISE EXCEPTION 'Esta clínica está atualmente em um plano monoposto (apenas o titular) e não aceita novos colaboradores.';
  END IF;

  IF _subaccount_limit < 999999 THEN
    SELECT COUNT(*)::integer INTO _active_members_count
    FROM public.clinic_memberships
    WHERE clinic_id = _invitation.clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND user_id <> _user_id;

    IF _active_members_count >= _subaccount_limit THEN
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
  ON CONFLICT DO NOTHING;

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
    _invitation.role_key,
    'active',
    true,
    _invitation.invited_by
  )
  ON CONFLICT (clinic_id, user_id)
  DO UPDATE SET
    operational_role = EXCLUDED.operational_role,
    role_key = EXCLUDED.role_key,
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
    accepted_at = now()
  WHERE id = _invitation.id;

  RETURN jsonb_build_object(
    'clinic_id', _invitation.clinic_id,
    'status', 'accepted'
  );
END;
$$;

ALTER FUNCTION public.accept_clinic_collaborator_invitation(text, text) OWNER TO postgres;
GRANT ALL ON FUNCTION public.accept_clinic_collaborator_invitation(text, text) TO service_role;
GRANT ALL ON FUNCTION public.accept_clinic_collaborator_invitation(text, text) TO authenticated;

-- 3. Atualizar current_user_can_role_capability para blindar subaccounts.* em planos monoposto
CREATE OR REPLACE FUNCTION public.current_user_can_role_capability(
  _capability text,
  _clinic_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _resolved_clinic_id uuid;
  _operational_role public.operational_role_type;
  _role_key text;
  _account_role public.account_role_type;
  _membership_status public.membership_status_type;
  _is_active boolean;
  _subscription_plan public.subscription_plan;
  _clinic_owner_id uuid;
  _override_enabled boolean;
  _sub record;
  _is_subscription_expired boolean := false;
  _is_read_only boolean := false;
  _is_owner boolean := false;
  _canonical_capability text := _capability;
  _is_clinic_tier boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Normalização de capacidades sinônimas/canônicas
  IF _capability IN ('patient_groups.write', 'patients_groups.write') THEN
    _canonical_capability := 'patients.manage_groups';
  ELSIF _capability IN ('patient_groups.read') THEN
    _canonical_capability := 'patients_groups.read';
  ELSIF _capability = 'agenda.read' THEN
    _canonical_capability := 'schedule.read';
  ELSIF _capability = 'agenda.write' THEN
    _canonical_capability := 'schedule.write';
  END IF;

  _resolved_clinic_id := COALESCE(_clinic_id, public.get_user_clinic_id(_user_id));

  -- Bypass para Platform Owner em contexto ativo
  IF _resolved_clinic_id IS NOT NULL
    AND public.is_platform_owner(_user_id)
    AND public.get_active_platform_clinic_id(_user_id) = _resolved_clinic_id THEN
    RETURN true;
  END IF;

  SELECT
    clinic_memberships.account_role,
    clinic_memberships.operational_role,
    clinic_memberships.role_key,
    clinic_memberships.membership_status,
    clinic_memberships.is_active,
    clinics.subscription_plan,
    clinics.account_owner_user_id
  INTO
    _account_role,
    _operational_role,
    _role_key,
    _membership_status,
    _is_active,
    _subscription_plan,
    _clinic_owner_id
  FROM public.clinic_memberships
  JOIN public.clinics ON clinics.id = clinic_memberships.clinic_id
  WHERE clinic_memberships.user_id = _user_id
    AND clinic_memberships.clinic_id = _resolved_clinic_id
  LIMIT 1;

  IF _resolved_clinic_id IS NULL
    OR _is_active IS DISTINCT FROM true
    OR _membership_status IS DISTINCT FROM 'active' THEN
    RETURN false;
  END IF;

  _is_owner := (_account_role = 'account_owner' OR _operational_role = 'owner' OR _clinic_owner_id = _user_id);
  _is_clinic_tier := (_subscription_plan::text IN ('clinic', 'enterprise', 'clinica_basico', 'clinica_medio', 'clinica_top', 'prof_top'));

  -- 1. Checagem de Assinatura e Read-Only
  SELECT * INTO _sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _resolved_clinic_id
  LIMIT 1;

  IF _sub IS NOT NULL THEN
    IF _sub.status = 'TRIAL_EXPIRED' AND NOT _is_owner THEN
      RETURN false;
    END IF;

    IF public.is_clinic_read_only(_resolved_clinic_id) THEN
      _is_read_only := true;
      IF (_sub.status = 'TRIAL_EXPIRED' OR _sub.status = 'TRIAL' OR COALESCE(_sub.is_free_trial, false) = true) AND NOT _is_owner THEN
        RETURN false;
      END IF;
    END IF;

    IF _sub.status NOT IN ('BETA', 'TRIAL', 'COURTESY') AND COALESCE(_sub.is_courtesy, false) = false THEN
      IF _sub.expires_at IS NOT NULL AND _sub.expires_at < now() THEN
        _is_subscription_expired := true;
      ELSIF _sub.status IN ('EXPIRED', 'SUSPENDED') THEN
        _is_subscription_expired := true;
      END IF;
    END IF;
  END IF;

  IF _is_read_only OR _is_subscription_expired THEN
    IF _capability = 'subscription_billing.manage' AND _is_owner THEN
      RETURN true;
    END IF;

    IF _capability IN (
      'patients.read',
      'schedule.read',
      'schedule.read_all',
      'agenda.read',
      'sessions.read',
      'sessions.read_all',
      'patient_groups.read',
      'patients_groups.read',
      'subaccounts_analytics.read',
      'subaccounts.read',
      'subaccounts_roles.read',
      'clinic_profile.read',
      'forms.read',
      'anamnesis_forms.read',
      'treasury.read',
      'subscription_billing.read'
    ) OR _canonical_capability IN (
      'patients.read',
      'schedule.read',
      'schedule.read_all',
      'agenda.read',
      'sessions.read',
      'sessions.read_all',
      'patient_groups.read',
      'patients_groups.read',
      'subaccounts_analytics.read',
      'subaccounts.read',
      'subaccounts_roles.read',
      'clinic_profile.read',
      'forms.read',
      'anamnesis_forms.read',
      'treasury.read',
      'subscription_billing.read'
    ) THEN
      RETURN true;
    END IF;

    RETURN false;
  END IF;

  -- 2. Salvaguarda de Plano: Em planos monoposto, subaccounts.* e roles.* são expressamente desabilitados mesmo para o owner
  IF NOT _is_clinic_tier AND _canonical_capability IN (
    'subaccounts.write',
    'subaccounts.manage',
    'subaccounts.delete',
    'subaccounts_roles.manage',
    'team_development.manage'
  ) THEN
    RETURN false;
  END IF;

  IF _is_owner THEN
    RETURN true;
  END IF;

  IF _capability = 'subscription_billing.manage' THEN
    RETURN false;
  END IF;

  -- 3. Checagem de Override na tabela clinic_operational_role_capabilities
  IF _role_key IS NOT NULL AND _role_key <> '' THEN
    SELECT enabled
    INTO _override_enabled
    FROM public.clinic_operational_role_capabilities
    WHERE clinic_id = _resolved_clinic_id
      AND operational_role = _role_key
      AND capability IN (_capability, _canonical_capability)
    ORDER BY (capability = _canonical_capability) DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN _override_enabled;
    END IF;
  END IF;

  SELECT enabled
    INTO _override_enabled
    FROM public.clinic_operational_role_capabilities
    WHERE clinic_id = _resolved_clinic_id
      AND operational_role = _operational_role::text
      AND capability IN (_capability, _canonical_capability)
    ORDER BY (capability = _canonical_capability) DESC
    LIMIT 1;

  IF FOUND THEN
    RETURN _override_enabled;
  END IF;

  -- 4. Matriz Padrão Canônica de Permissões
  CASE _capability
    WHEN 'clinic_profile.read' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'clinic_profile.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'clinic_terms.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'forms.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'forms.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.read' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.write' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.manage' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.delete' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.read' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.manage' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subscription_billing.read' THEN
      RETURN _is_owner;
    WHEN 'team_development.manage' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'treasury.read' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'treasury.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'agenda.delete_events' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_analytics.read' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'patients.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'patients.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'patients.delete' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'patients.manage_groups', 'patient_groups.write', 'patients_groups.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'patient_groups.read', 'patients_groups.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'agenda.read', 'schedule.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.read_all' THEN
      RETURN _operational_role IN ('owner', 'admin', 'assistant');
    WHEN 'agenda.write', 'schedule.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.write_others' THEN
      RETURN _operational_role IN ('owner', 'admin', 'assistant');
    WHEN 'sessions.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'estagiario');
    WHEN 'sessions.read_all' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'sessions.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'estagiario');
    WHEN 'sessions.write_others' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'sessions.share' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'sessions.delete' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'session.delete_draft' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'system.print' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    ELSE
      RETURN false;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_can_role_capability(text, uuid) TO authenticated, anon, service_role;
