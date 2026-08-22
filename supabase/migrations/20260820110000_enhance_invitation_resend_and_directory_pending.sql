-- Migration: Enhance invitation resend with 30s rate limit and include pending accounts in Master Directory
-- Date: 2026-08-20

-- 1. Add last_resent_at to clinic_collaborator_invitations
ALTER TABLE public.clinic_collaborator_invitations
ADD COLUMN IF NOT EXISTS last_resent_at timestamptz DEFAULT NULL;

-- 2. RPC to resend a collaborator invitation with 30-second cooldown rate limiting
CREATE OR REPLACE FUNCTION public.resend_clinic_collaborator_invitation(_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  _token_hash text := md5(_token);
  _remaining_seconds integer;
  _account_state text := 'invite_sent';
  _existing_user auth.users%ROWTYPE;
  _clinic_route_key text;
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
    RAISE EXCEPTION 'Apenas convites pendentes podem ser reenviados.';
  END IF;

  IF NOT (
    public.current_user_can('subaccounts.manage', _invitation.clinic_id) OR
    public.is_platform_owner_mfa_verified(_requester_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para reenviar convites desta clínica.';
  END IF;

  -- 30-second rate-limiting check
  IF _invitation.last_resent_at IS NOT NULL AND (now() - _invitation.last_resent_at) < interval '30 seconds' THEN
    _remaining_seconds := 30 - extract(epoch from (now() - _invitation.last_resent_at))::integer;
    RAISE EXCEPTION 'Aguarde % segundos antes de reenviar o convite novamente.', GREATEST(_remaining_seconds, 1);
  END IF;

  -- Update token and resend timestamp
  UPDATE public.clinic_collaborator_invitations
  SET token_hash = _token_hash,
      last_resent_at = now(),
      updated_at = now(),
      expires_at = now() + interval '14 days'
  WHERE id = _invitation_id;

  -- Check user status in auth.users
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
    'path', '/convite/' || _token,
    'email', _invitation.email,
    'clinic_id', _invitation.clinic_id,
    'clinic_route_key', _clinic_route_key,
    'account_state', _account_state,
    'remaining_cooldown', 30
  );
END;
$$;

-- 3. Update get_clinic_pending_collaborator_invitations to include last_resent_at
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

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'clinic_id', i.clinic_id,
      'email', i.email,
      'operational_role', i.operational_role,
      'job_title', i.job_title,
      'specialty', i.specialty,
      'token_hash', i.token_hash,
      'status', i.status,
      'created_at', i.created_at,
      'last_resent_at', i.last_resent_at,
      'expires_at', i.expires_at,
      'existing_user_id', i.existing_user_id,
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

-- 4. Update list_platform_directory to include pending registrations
CREATE OR REPLACE FUNCTION public.list_platform_directory(
  _query text default null,
  _kind text default 'all',
  _limit integer default 80
)
RETURNS TABLE (
  item_type text,
  item_id uuid,
  clinic_id uuid,
  clinic_name text,
  title text,
  subtitle text,
  primary_document text,
  secondary_document text,
  status text,
  metadata jsonb,
  updated_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH input AS (
    SELECT
      nullif(trim(coalesce(_query, '')), '') AS raw_query,
      public.platform_normalize_search(_query) AS normalized_query,
      CASE
        WHEN _kind IN ('clinic', 'account', 'patient', 'pending_account') THEN _kind
        ELSE 'all'
      END AS kind,
      least(greatest(coalesce(_limit, 80), 1), 150) AS row_limit
  ),
  clinics_rows AS (
    SELECT
      'clinic'::text AS item_type,
      clinics.id AS item_id,
      clinics.id AS clinic_id,
      clinics.name AS clinic_name,
      clinics.name AS title,
      coalesce(clinics.legal_name, clinics.email, 'Clínica sem razão social') AS subtitle,
      clinics.cnpj AS primary_document,
      owner_profile.email AS secondary_document,
      clinics.subscription_plan::text AS status,
      jsonb_build_object(
        'route_key', clinics.route_key,
        'owner_user_id', clinics.account_owner_user_id,
        'owner_name', owner_profile.full_name,
        'owner_email', owner_profile.email,
        'team_count', coalesce(membership_counts.total, 0),
        'patients_count', coalesce(patient_counts.total, 0),
        'sessions_count', coalesce(session_counts.total, 0),
        'flags_count', coalesce(flag_counts.total, 0),
        'subaccount_limit', clinics.subaccount_limit,
        'concurrent_access_limit', CASE
          WHEN clinics.subscription_plan = 'solo' THEN 1
          ELSE greatest(clinics.subaccount_limit, 4)
        END
      ) AS metadata,
      clinics.updated_at
    FROM public.clinics
    LEFT JOIN public.profiles owner_profile ON owner_profile.id = clinics.account_owner_user_id
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS total
      FROM public.clinic_memberships
      WHERE clinic_memberships.clinic_id = clinics.id
        AND clinic_memberships.is_active = true
        AND clinic_memberships.membership_status = 'active'
    ) membership_counts ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS total
      FROM public.patients
      WHERE patients.clinic_id = clinics.id
    ) patient_counts ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS total
      FROM public.sessions
      WHERE sessions.clinic_id = clinics.id
    ) session_counts ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS total
      FROM public.feature_flags
      WHERE feature_flags.clinic_id = clinics.id
        AND feature_flags.scope = 'clinic'
    ) flag_counts ON true
    CROSS JOIN input
    WHERE public.is_platform_owner_mfa_verified(auth.uid())
      AND input.kind IN ('all', 'clinic')
      AND (
        input.raw_query IS NULL
        OR public.platform_normalize_search(clinics.name || ' ' || clinics.cnpj || ' ' || coalesce(clinics.legal_name, '') || ' ' || coalesce(owner_profile.email, '') || ' ' || coalesce(owner_profile.full_name, '')) LIKE '%' || input.normalized_query || '%'
      )
  ),
  account_rows AS (
    SELECT
      'account'::text AS item_type,
      profiles.id AS item_id,
      clinic_memberships.clinic_id,
      clinics.name AS clinic_name,
      coalesce(profiles.full_name, profiles.email, 'Conta sem nome') AS title,
      coalesce(profiles.email, profiles.phone, 'Sem contato principal') AS subtitle,
      profiles.cpf AS primary_document,
      profiles.phone AS secondary_document,
      clinic_memberships.membership_status::text AS status,
      jsonb_build_object(
        'email', profiles.email,
        'phone', profiles.phone,
        'birth_date', profiles.birth_date,
        'age', CASE
          WHEN profiles.birth_date IS NULL THEN NULL
          ELSE extract(year FROM age(current_date, profiles.birth_date))::integer
        END,
        'job_title', profiles.job_title,
        'account_role', clinic_memberships.account_role,
        'operational_role', clinic_memberships.operational_role,
        'membership_id', clinic_memberships.id,
        'is_active', clinic_memberships.is_active,
        'is_pending_registration', false,
        'joined_at', clinic_memberships.joined_at
      ) AS metadata,
      greatest(profiles.last_seen_at, profiles.updated_at, clinic_memberships.updated_at) AS updated_at
    FROM public.clinic_memberships
    JOIN public.profiles ON profiles.id = clinic_memberships.user_id
    JOIN public.clinics ON clinics.id = clinic_memberships.clinic_id
    CROSS JOIN input
    WHERE public.is_platform_owner_mfa_verified(auth.uid())
      AND input.kind IN ('all', 'account')
      AND (
        input.raw_query IS NULL
        OR public.platform_normalize_search(coalesce(profiles.full_name, '') || ' ' || coalesce(profiles.email, '') || ' ' || coalesce(profiles.cpf, '') || ' ' || coalesce(profiles.phone, '') || ' ' || coalesce(profiles.job_title, '') || ' ' || clinics.name) LIKE '%' || input.normalized_query || '%'
        OR (profiles.birth_date IS NOT NULL AND extract(year FROM age(current_date, profiles.birth_date))::integer::text = input.raw_query)
      )
  ),
  pending_account_rows AS (
    SELECT
      'account'::text AS item_type,
      COALESCE(u.id, i.id) AS item_id,
      i.clinic_id,
      clinics.name AS clinic_name,
      COALESCE(p.full_name, i.email, 'Colaborador convidado') AS title,
      i.email AS subtitle,
      COALESCE(p.cpf, 'Cadastro incompleto') AS primary_document,
      COALESCE(p.phone, i.job_title, 'Sem telefone') AS secondary_document,
      CASE
        WHEN u.id IS NOT NULL AND u.email_confirmed_at IS NULL THEN 'unconfirmed_email'
        WHEN u.id IS NOT NULL AND u.email_confirmed_at IS NOT NULL THEN 'pending_login'
        ELSE 'pending_invite'
      END AS status,
      jsonb_build_object(
        'email', i.email,
        'phone', p.phone,
        'invitation_id', i.id,
        'user_id', u.id,
        'job_title', i.job_title,
        'specialty', i.specialty,
        'operational_role', i.operational_role,
        'is_active', false,
        'is_pending_registration', true,
        'last_resent_at', i.last_resent_at,
        'created_at', i.created_at,
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
      ) AS metadata,
      COALESCE(i.last_resent_at, i.updated_at, i.created_at) AS updated_at
    FROM public.clinic_collaborator_invitations i
    JOIN public.clinics ON clinics.id = i.clinic_id
    LEFT JOIN auth.users u ON lower(u.email) = lower(i.email)
    LEFT JOIN public.profiles p ON p.id = u.id
    CROSS JOIN input
    WHERE public.is_platform_owner_mfa_verified(auth.uid())
      AND i.status = 'pending'
      AND input.kind IN ('all', 'account', 'pending_account')
      AND (
        input.raw_query IS NULL
        OR public.platform_normalize_search(i.email || ' ' || coalesce(p.full_name, '') || ' ' || coalesce(i.job_title, '') || ' ' || clinics.name) LIKE '%' || input.normalized_query || '%'
      )
  ),
  patient_rows AS (
    SELECT
      'patient'::text AS item_type,
      patients.id AS item_id,
      patients.clinic_id,
      clinics.name AS clinic_name,
      patients.name AS title,
      coalesce(patients.email, patients.phone, 'Paciente sem contato principal') AS subtitle,
      patients.cpf AS primary_document,
      patients.rg AS secondary_document,
      patients.status AS status,
      jsonb_build_object(
        'age', coalesce(patients.age, CASE WHEN patients.date_of_birth IS NULL THEN NULL ELSE extract(year FROM age(current_date, patients.date_of_birth))::integer END),
        'phone', patients.phone,
        'email', patients.email,
        'rg', patients.rg,
        'date_of_birth', patients.date_of_birth,
        'gender', patients.gender,
        'pronoun', patients.pronoun,
        'profession', patients.profession,
        'origin_type', patients.origin_type,
        'blood_type', patients.blood_type,
        'city', patients.city,
        'state', patients.state,
        'registration_complete', patients.registration_complete
      ) AS metadata,
      patients.updated_at
    FROM public.patients
    JOIN public.clinics ON clinics.id = patients.clinic_id
    CROSS JOIN input
    WHERE public.is_platform_owner_mfa_verified(auth.uid())
      AND input.kind IN ('all', 'patient')
      AND (
        input.raw_query IS NULL
        OR public.platform_normalize_search(patients.name || ' ' || coalesce(patients.cpf, '') || ' ' || coalesce(patients.rg, '') || ' ' || coalesce(patients.email, '') || ' ' || coalesce(patients.phone, '') || ' ' || clinics.name) LIKE '%' || input.normalized_query || '%'
        OR (patients.age IS NOT NULL AND patients.age::text = input.raw_query)
        OR (patients.date_of_birth IS NOT NULL AND extract(year FROM age(current_date, patients.date_of_birth))::integer::text = input.raw_query)
      )
  ),
  combined_results AS (
    SELECT * FROM clinics_rows
    UNION ALL
    SELECT * FROM account_rows
    UNION ALL
    SELECT * FROM pending_account_rows
    UNION ALL
    SELECT * FROM patient_rows
  )
  SELECT
    combined_results.item_type,
    combined_results.item_id,
    combined_results.clinic_id,
    combined_results.clinic_name,
    combined_results.title,
    combined_results.subtitle,
    combined_results.primary_document,
    combined_results.secondary_document,
    combined_results.status,
    combined_results.metadata,
    combined_results.updated_at
  FROM combined_results
  CROSS JOIN input
  ORDER BY combined_results.updated_at DESC
  LIMIT (SELECT row_limit FROM input);
$$;

-- 5. Update get_platform_person_detail to support pending accounts
CREATE OR REPLACE FUNCTION public.get_platform_person_detail(_item_type text, _item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _result jsonb;
  _pending_invitation public.clinic_collaborator_invitations%ROWTYPE;
  _pending_clinic public.clinics%ROWTYPE;
  _pending_user auth.users%ROWTYPE;
BEGIN
  IF NOT public.is_platform_owner_mfa_verified(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado ao painel global.';
  END IF;

  IF _item_type = 'account' THEN
    SELECT jsonb_build_object(
      'type', 'account',
      'profile', to_jsonb(profiles),
      'memberships', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'membership_id', clinic_memberships.id,
          'clinic_id', clinic_memberships.clinic_id,
          'clinic_name', clinics.name,
          'clinic_route_key', clinics.route_key,
          'account_role', clinic_memberships.account_role,
          'operational_role', clinic_memberships.operational_role,
          'membership_status', clinic_memberships.membership_status,
          'is_active', clinic_memberships.is_active,
          'joined_at', clinic_memberships.joined_at
        ) ORDER BY clinic_memberships.joined_at DESC)
        FROM public.clinic_memberships
        JOIN public.clinics ON clinics.id = clinic_memberships.clinic_id
        WHERE clinic_memberships.user_id = profiles.id
      ), '[]'::jsonb),
      'counts', jsonb_build_object(
        'sessions_created', (SELECT count(*) FROM public.sessions WHERE sessions.user_id = profiles.id),
        'sessions_as_provider', (SELECT count(*) FROM public.sessions WHERE sessions.provider_id = profiles.id)
      )
    )
    INTO _result
    FROM public.profiles
    WHERE profiles.id = _item_id;

    -- If profile was not found, check if it is a pending invitation / user
    IF _result IS NULL THEN
      SELECT * INTO _pending_invitation
      FROM public.clinic_collaborator_invitations
      WHERE id = _item_id OR existing_user_id = _item_id
      LIMIT 1;

      IF _pending_invitation.id IS NOT NULL THEN
        SELECT * INTO _pending_clinic
        FROM public.clinics
        WHERE id = _pending_invitation.clinic_id;

        SELECT * INTO _pending_user
        FROM auth.users
        WHERE lower(email) = lower(_pending_invitation.email);

        _result := jsonb_build_object(
          'type', 'account',
          'is_pending_registration', true,
          'profile', jsonb_build_object(
            'id', COALESCE(_pending_user.id, _pending_invitation.id),
            'email', _pending_invitation.email,
            'full_name', _pending_invitation.email,
            'job_title', _pending_invitation.job_title,
            'specialty', _pending_invitation.specialty,
            'created_at', _pending_invitation.created_at,
            'updated_at', _pending_invitation.updated_at,
            'status', CASE
              WHEN _pending_user.id IS NOT NULL AND _pending_user.email_confirmed_at IS NULL THEN 'E-mail não verificado'
              WHEN _pending_user.id IS NOT NULL THEN 'Aguardando login'
              ELSE 'Convite pendente'
            END
          ),
          'invitation', jsonb_build_object(
            'id', _pending_invitation.id,
            'clinic_id', _pending_invitation.clinic_id,
            'email', _pending_invitation.email,
            'operational_role', _pending_invitation.operational_role,
            'job_title', _pending_invitation.job_title,
            'specialty', _pending_invitation.specialty,
            'status', _pending_invitation.status,
            'created_at', _pending_invitation.created_at,
            'last_resent_at', _pending_invitation.last_resent_at,
            'expires_at', _pending_invitation.expires_at,
            'account_state', CASE
              WHEN _pending_user.id IS NOT NULL AND _pending_user.email_confirmed_at IS NULL THEN 'registered_unconfirmed'
              WHEN _pending_user.id IS NOT NULL THEN 'registered_confirmed_pending_acceptance'
              ELSE 'invite_sent'
            END
          ),
          'memberships', jsonb_build_array(
            jsonb_build_object(
              'membership_id', _pending_invitation.id,
              'clinic_id', _pending_clinic.id,
              'clinic_name', _pending_clinic.name,
              'clinic_route_key', _pending_clinic.route_key,
              'account_role', 'user',
              'operational_role', _pending_invitation.operational_role,
              'membership_status', 'invited',
              'is_active', false,
              'joined_at', _pending_invitation.created_at
            )
          ),
          'counts', jsonb_build_object(
            'sessions_created', 0,
            'sessions_as_provider', 0
          )
        );
      END IF;
    END IF;

  ELSIF _item_type = 'patient' THEN
    SELECT jsonb_build_object(
      'type', 'patient',
      'patient', to_jsonb(patients),
      'clinic', jsonb_build_object(
        'id', clinics.id,
        'name', clinics.name,
        'route_key', clinics.route_key,
        'cnpj', clinics.cnpj
      ),
      'counts', jsonb_build_object(
        'sessions', (SELECT count(*) FROM public.sessions WHERE sessions.patient_id = patients.id),
        'drafts', (SELECT count(*) FROM public.sessions WHERE sessions.patient_id = patients.id AND sessions.status = 'rascunho'),
        'completed', (SELECT count(*) FROM public.sessions WHERE sessions.patient_id = patients.id AND sessions.status = 'concluido')
      ),
      'recent_sessions', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', sessions.id,
          'session_date', sessions.session_date,
          'status', sessions.status,
          'payment_status', sessions.payment_status,
          'amount_charged_cents', sessions.amount_charged_cents,
          'amount_paid_cents', sessions.amount_paid_cents
        ) ORDER BY sessions.session_date DESC)
        FROM (
          SELECT *
          FROM public.sessions
          WHERE sessions.patient_id = patients.id
          ORDER BY sessions.session_date DESC
          LIMIT 10
        ) sessions
      ), '[]'::jsonb)
    )
    INTO _result
    FROM public.patients
    JOIN public.clinics ON clinics.id = patients.clinic_id
    WHERE patients.id = _item_id;
  ELSE
    RAISE EXCEPTION 'Tipo de detalhe inválido.';
  END IF;

  PERFORM public.log_platform_audit_event(
    'platform_directory_detail_read',
    coalesce((_result #>> '{clinic,id}')::uuid, null),
    null,
    jsonb_build_object('item_type', _item_type, 'item_id', _item_id)
  );

  RETURN coalesce(_result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resend_clinic_collaborator_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_clinic_pending_collaborator_invitations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_platform_directory(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_person_detail(text, uuid) TO authenticated;
