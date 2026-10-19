-- Migration: 20261019140000_non_destructive_invitations_and_idempotent_accept.sql
-- Description: Sistema Inquebrável de Convites de Colaboradores (Etapa 1):
-- 1. Expansão de esquema: coluna valid_token_hashes text[] em clinic_collaborator_invitations + GIN index.
-- 2. Renovação não-destrutiva em invite_clinic_collaborator: reutiliza convite pendente adicionando novos hashes a valid_token_hashes.
-- 3. Renovação não-destrutiva e cooldown rápido (5s) em resend_clinic_collaborator_invitation preservando hashes anteriores.
-- 4. Busca multi-hash em get_clinic_collaborator_invitation com retorno de clinic_route_key e fallback para convites cancelados.
-- 5. Aceite 100% idempotente em accept_clinic_collaborator_invitation, accept_current_user_clinic_invitation
--    e auto_accept_pending_clinic_invitation_for_current_user, com garantia de membership e retorno de clinic_route_key.

-- 1. Schema Expansion: valid_token_hashes e índice GIN
ALTER TABLE public.clinic_collaborator_invitations
  ADD COLUMN IF NOT EXISTS valid_token_hashes text[] DEFAULT '{}'::text[] NOT NULL;

-- Backfill inicial para linhas existentes
UPDATE public.clinic_collaborator_invitations
SET valid_token_hashes = ARRAY[token_hash]
WHERE valid_token_hashes = '{}'::text[];

-- Índice GIN para busca multi-hash em O(1)
CREATE INDEX IF NOT EXISTS idx_clinic_invitations_valid_token_hashes
  ON public.clinic_collaborator_invitations USING gin (valid_token_hashes);

-- 2. Atualizar invite_clinic_collaborator (reuso não-destrutivo)
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
      role_key = _normalized_role_key,
      job_title = NULLIF(trim(_job_title), ''),
      specialty = NULLIF(trim(_specialty), ''),
      invited_by = _requester_id,
      existing_user_id = _existing_user_id,
      token_hash = _token_hash,
      valid_token_hashes = ARRAY(
        SELECT DISTINCT u
        FROM unnest(
          array_cat(
            COALESCE(valid_token_hashes, ARRAY[token_hash]),
            ARRAY[_token_hash, _sha256_hash]
          )
        ) AS u
        WHERE u IS NOT NULL AND u <> ''
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
      _normalized_role_key,
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

-- 3. Atualizar resend_clinic_collaborator_invitation (não-destrutivo e cooldown 5s)
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

  -- Cooldown reduzido para 5 segundos para testes rápidos e melhor UX
  IF _invitation.last_resent_at IS NOT NULL AND (now() - _invitation.last_resent_at) < interval '5 seconds' THEN
    _remaining_seconds := 5 - extract(epoch from (now() - _invitation.last_resent_at))::integer;
    RAISE EXCEPTION 'Aguarde % segundos antes de reenviar o convite novamente.', GREATEST(_remaining_seconds, 1);
  END IF;

  _sha256_hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  UPDATE public.clinic_collaborator_invitations
  SET status = 'pending',
      token_hash = _token_hash,
      valid_token_hashes = ARRAY(
        SELECT DISTINCT u
        FROM unnest(
          array_cat(
            COALESCE(valid_token_hashes, ARRAY[token_hash]),
            ARRAY[_token_hash, _sha256_hash]
          )
        ) AS u
        WHERE u IS NOT NULL AND u <> ''
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
    'path', '/convite/clinica/' || _token,
    'email', _invitation.email,
    'clinic_id', _invitation.clinic_id,
    'clinic_route_key', _clinic_route_key,
    'account_state', _account_state,
    'remaining_cooldown', 5
  );
END;
$$;

-- 4. Atualizar get_clinic_collaborator_invitation (busca multi-hash e retorno de clinic_route_key)
CREATE OR REPLACE FUNCTION public.get_clinic_collaborator_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
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

-- 5. Atualizar accept_clinic_collaborator_invitation (100% idempotente e multi-hash)
CREATE OR REPLACE FUNCTION public.accept_clinic_collaborator_invitation(
  _token text,
  _full_name text DEFAULT NULL::text
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'auth', 'extensions'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _newer_invitation public.clinic_collaborator_invitations%ROWTYPE;
  _profile_exists boolean;
  _clinic_plan text;
  _subaccount_limit integer;
  _active_members_count integer;
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

  -- Fallback se o convite inicial estava cancelado, busca pending mais recente
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

  -- IDEMPOTÊNCIA: Se convite já aceito, garante membership e contexto e retorna sucesso
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
      _invitation.role_key,
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

  -- Atualizar ou criar perfil
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

-- 6. Atualizar accept_current_user_clinic_invitation (100% idempotente e com clinic_route_key)
CREATE OR REPLACE FUNCTION public.accept_current_user_clinic_invitation(_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _newer_invitation public.clinic_collaborator_invitations%ROWTYPE;
  _profile_exists boolean;
  _clinic_plan text;
  _subaccount_limit integer;
  _active_members_count integer;
  _clinic_route_key text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para aceitar o convite.';
  END IF;

  _user_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF _user_email IS NULL OR _user_email = '' THEN
    SELECT lower(email)
    INTO _user_email
    FROM auth.users
    WHERE id = _user_id;
  END IF;

  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE id = _invitation_id
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  -- Fallback se convite cancelado
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

  IF lower(_invitation.email) IS DISTINCT FROM _user_email THEN
    RAISE EXCEPTION 'Este convite pertence a outro e-mail.';
  END IF;

  SELECT route_key
  INTO _clinic_route_key
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  -- IDEMPOTÊNCIA: Se convite já aceito, garante membership e contexto e retorna sucesso
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
      _invitation.role_key,
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
      job_title = COALESCE(NULLIF(trim(_invitation.job_title), ''), job_title),
      specialty = COALESCE(NULLIF(trim(_invitation.specialty), ''), specialty),
      public_code = COALESCE(NULLIF(trim(public_code), ''), public.generate_profile_public_code())
    WHERE id = _user_id;
  ELSE
    INSERT INTO public.profiles (
      id,
      clinic_id,
      email,
      job_title,
      specialty,
      public_code
    )
    VALUES (
      _user_id,
      _invitation.clinic_id,
      _invitation.email,
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

-- 7. Atualizar auto_accept_pending_clinic_invitation_for_current_user (com clinic_route_key)
CREATE OR REPLACE FUNCTION public.auto_accept_pending_clinic_invitation_for_current_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _profile_exists boolean;
  _clinic_plan text;
  _subaccount_limit integer;
  _active_members_count integer;
  _clinic_route_key text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'unauthenticated');
  END IF;

  _user_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF _user_email IS NULL OR _user_email = '' THEN
    SELECT lower(email)
    INTO _user_email
    FROM auth.users
    WHERE id = _user_id;
  END IF;

  IF _user_email IS NULL OR _user_email = '' THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'email_not_found');
  END IF;

  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE lower(email) = _user_email
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'no_pending_invitation');
  END IF;

  SELECT route_key
  INTO _clinic_route_key
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  -- Validação de cota do plano da clínica antes de admitir novo membro
  SELECT LOWER(COALESCE(subscription_plan::text, 'solo')), COALESCE(subaccount_limit, 1)
  INTO _clinic_plan, _subaccount_limit
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  IF _clinic_plan IN ('prof_basico', 'prof_medio', 'solo') THEN
    RETURN jsonb_build_object(
      'accepted', false,
      'reason', 'plan_monoposto_not_allowed',
      'clinic_id', _invitation.clinic_id,
      'clinic_route_key', _clinic_route_key
    );
  END IF;

  IF _subaccount_limit < 999999 THEN
    SELECT COUNT(*)::integer INTO _active_members_count
    FROM public.clinic_memberships
    WHERE clinic_id = _invitation.clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND user_id <> _user_id;

    IF _active_members_count >= _subaccount_limit THEN
      RETURN jsonb_build_object(
        'accepted', false,
        'reason', 'clinic_subaccount_limit_reached',
        'clinic_id', _invitation.clinic_id,
        'clinic_route_key', _clinic_route_key
      );
    END IF;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id)
  INTO _profile_exists;

  IF _profile_exists THEN
    UPDATE public.profiles
    SET
      clinic_id = COALESCE(clinic_id, _invitation.clinic_id),
      email = COALESCE(email, _invitation.email),
      job_title = COALESCE(NULLIF(trim(_invitation.job_title), ''), job_title),
      specialty = COALESCE(NULLIF(trim(_invitation.specialty), ''), specialty),
      public_code = COALESCE(NULLIF(trim(public_code), ''), public.generate_profile_public_code())
    WHERE id = _user_id;
  ELSE
    INSERT INTO public.profiles (
      id,
      clinic_id,
      email,
      job_title,
      specialty,
      public_code
    )
    VALUES (
      _user_id,
      _invitation.clinic_id,
      _invitation.email,
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
    accepted_at = now(),
    updated_at = now()
  WHERE id = _invitation.id;

  RETURN jsonb_build_object(
    'accepted', true,
    'clinic_id', _invitation.clinic_id,
    'clinic_route_key', _clinic_route_key,
    'invitation_id', _invitation.id,
    'status', 'accepted'
  );
END;
$$;

-- 8. Ownership e Permissões
ALTER FUNCTION public.invite_clinic_collaborator(uuid, text, public.operational_role_type, text, text, text) OWNER TO postgres;
ALTER FUNCTION public.resend_clinic_collaborator_invitation(uuid) OWNER TO postgres;
ALTER FUNCTION public.get_clinic_collaborator_invitation(text) OWNER TO postgres;
ALTER FUNCTION public.accept_clinic_collaborator_invitation(text, text) OWNER TO postgres;
ALTER FUNCTION public.accept_current_user_clinic_invitation(uuid) OWNER TO postgres;
ALTER FUNCTION public.auto_accept_pending_clinic_invitation_for_current_user() OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.invite_clinic_collaborator(uuid, text, public.operational_role_type, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resend_clinic_collaborator_invitation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_clinic_collaborator_invitation(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_clinic_collaborator_invitation(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_current_user_clinic_invitation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auto_accept_pending_clinic_invitation_for_current_user() TO authenticated, service_role;

-- 9. Atualizar list_current_user_clinic_invitations com role_key e filtro expires_at > now()
DROP FUNCTION IF EXISTS public.list_current_user_clinic_invitations();

CREATE OR REPLACE FUNCTION public.list_current_user_clinic_invitations()
RETURNS TABLE(
  invitation_id uuid,
  clinic_id uuid,
  clinic_name text,
  clinic_logo_url text,
  clinic_route_key text,
  operational_role public.operational_role_type,
  role_key text,
  job_title text,
  specialty text,
  invited_by_name text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    invitations.id AS invitation_id,
    invitations.clinic_id,
    clinics.name AS clinic_name,
    clinics.logo_url AS clinic_logo_url,
    clinics.route_key AS clinic_route_key,
    invitations.operational_role,
    invitations.role_key,
    invitations.job_title,
    invitations.specialty,
    inviter.full_name AS invited_by_name,
    invitations.expires_at,
    invitations.created_at
  FROM public.clinic_collaborator_invitations AS invitations
  JOIN public.clinics
    ON clinics.id = invitations.clinic_id
  LEFT JOIN public.profiles AS inviter
    ON inviter.id = invitations.invited_by
  JOIN auth.users
    ON users.id = auth.uid()
  WHERE invitations.status = 'pending'
    AND invitations.expires_at > now()
    AND lower(invitations.email) = lower(users.email)
  ORDER BY invitations.created_at DESC;
$$;

ALTER FUNCTION public.list_current_user_clinic_invitations() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.list_current_user_clinic_invitations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_current_user_clinic_invitations() TO authenticated, service_role;
