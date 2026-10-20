-- Migration: 20261020095800_allow_system_operational_roles_in_invites_and_updates.sql
-- Description:
-- Permite que papéis operacionais do sistema ('admin', 'professional', 'assistant', 'estagiario')
-- sejam atribuídos diretamente sem falhar na verificação da tabela clinic_operational_roles.
-- Quando _role_key for um papel base do sistema, atribui-o como papel operacional sem exigir linha customizada.
-- Quando for um papel personalizado (ex: 'papel_xyz'), valida na tabela clinic_operational_roles da clínica.

-- 1. Atualizar invite_clinic_collaborator
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
  _sha256_hash text;
  _existing_user_id uuid;
  _invitation_id uuid;
  _normalized_role_key text := lower(trim(coalesce(_role_key, '')));
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

  -- Obter plano e limites canônicos da clínica com lock pessimista para evitar race condition
  PERFORM 1 FROM public.clinics WHERE id = _resolved_clinic_id FOR UPDATE;

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

  -- Resolução de role_key e inferência de operational_role
  IF _normalized_role_key IS NOT NULL AND _normalized_role_key <> '' THEN
    -- Caso 1: É um papel padrão do sistema ('admin', 'professional', 'assistant', 'estagiario')
    IF _normalized_role_key IN ('admin', 'professional', 'assistant', 'estagiario') THEN
      _inferred_operational_role := _normalized_role_key::public.operational_role_type;
    ELSE
      -- Caso 2: Papel customizado salvo na tabela clinic_operational_roles
      SELECT *
      INTO _custom_role
      FROM public.clinic_operational_roles
      WHERE clinic_id = _resolved_clinic_id
        AND role_key = _normalized_role_key
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Papel operacional inválido para esta clínica.';
      END IF;

      _inferred_operational_role := _custom_role.base_operational_role;
    END IF;
  END IF;

  SELECT users.id
  INTO _existing_user_id
  FROM auth.users
  WHERE lower(users.email) = _normalized_email
  LIMIT 1;

  _sha256_hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  -- Reuso / Renovação Não-Destrutiva: se já existir convite pendente, reaproveita e expande tokens válidos
  SELECT id INTO _invitation_id
  FROM public.clinic_collaborator_invitations
  WHERE clinic_id = _resolved_clinic_id
    AND lower(email) = _normalized_email
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF _invitation_id IS NOT NULL THEN
    UPDATE public.clinic_collaborator_invitations
    SET
      operational_role = _inferred_operational_role,
      role_key = NULLIF(_normalized_role_key, ''),
      job_title = NULLIF(trim(_job_title), ''),
      specialty = NULLIF(trim(_specialty), ''),
      invited_by = _requester_id,
      existing_user_id = _existing_user_id,
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
      expires_at = now() + interval '14 days',
      updated_at = now(),
      email_delivery_status = 'pending',
      email_last_error = NULL,
      email_sent_at = NULL
    WHERE id = _invitation_id;
  ELSE
    INSERT INTO public.clinic_collaborator_invitations (
      clinic_id,
      email,
      operational_role,
      role_key,
      job_title,
      specialty,
      token_hash,
      valid_token_hashes,
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
      NULLIF(_normalized_role_key, ''),
      NULLIF(trim(_job_title), ''),
      NULLIF(trim(_specialty), ''),
      _token_hash,
      ARRAY[_token_hash, _sha256_hash],
      _requester_id,
      _existing_user_id,
      'pending',
      'pending',
      NULL,
      NULL
    )
    RETURNING id INTO _invitation_id;
  END IF;

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
      'role_key', NULLIF(_normalized_role_key, ''),
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

-- 2. Atualizar resend_clinic_collaborator_invitation com janela deslizante de 10 tokens
CREATE OR REPLACE FUNCTION public.resend_clinic_collaborator_invitation(_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
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

-- 3. Atualizar update_clinic_member_operational_fields para suportar papéis base do sistema
CREATE OR REPLACE FUNCTION public.update_clinic_member_operational_fields(
  _membership_id uuid,
  _job_title text DEFAULT NULL::text,
  _specialty text DEFAULT NULL::text,
  _working_hours text DEFAULT NULL::text,
  _operational_role public.operational_role_type DEFAULT NULL::public.operational_role_type,
  _membership_status public.membership_status_type DEFAULT NULL::public.membership_status_type,
  _role_key text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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

-- 4. Permissões e Ownership
ALTER FUNCTION public.invite_clinic_collaborator(uuid, text, public.operational_role_type, text, text, text) OWNER TO postgres;
ALTER FUNCTION public.resend_clinic_collaborator_invitation(uuid) OWNER TO postgres;
ALTER FUNCTION public.update_clinic_member_operational_fields(uuid, text, text, text, public.operational_role_type, public.membership_status_type, text) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.invite_clinic_collaborator(uuid, text, public.operational_role_type, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resend_clinic_collaborator_invitation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_clinic_member_operational_fields(uuid, text, text, text, public.operational_role_type, public.membership_status_type, text) TO authenticated, service_role;
