-- Migration incremental: suportar 3 filtros (tipo, status incluindo vencimento, tag) e incluir todos os usuários/owners/órfãos

CREATE OR REPLACE FUNCTION public.list_platform_directory(
  _query text default null,
  _kind text default 'all',
  _status text default 'all',
  _tag_id uuid default null,
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
        WHEN _kind IN ('clinic', 'account', 'owner', 'patient', 'pending_account') THEN _kind
        ELSE 'all'
      END AS kind,
      CASE
        WHEN _status IN ('active', 'pending', 'expiring_soon', 'expired', 'banned', 'paused') THEN _status
        ELSE 'all'
      END AS status_filter,
      _tag_id AS tag_id,
      least(greatest(coalesce(_limit, 80), 1), 200) AS row_limit
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
      CASE
        WHEN clinics.access_status = 'banned' THEN 'banned'
        WHEN clinics.access_status = 'temporarily_paused' THEN 'paused'
        WHEN sub.expires_at IS NOT NULL AND sub.expires_at < now() THEN 'expired'
        WHEN sub.expires_at IS NOT NULL AND sub.expires_at <= now() + interval '7 days' THEN 'expiring_soon'
        WHEN clinics.access_status = 'payment_pending' THEN 'pending'
        ELSE coalesce(clinics.access_status, 'active')
      END AS status,
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
        'access_status', clinics.access_status,
        'subscription_plan', clinics.subscription_plan,
        'expires_at', sub.expires_at,
        'concurrent_access_limit', CASE
          WHEN clinics.subscription_plan = 'solo' THEN 1
          ELSE greatest(clinics.subaccount_limit, 4)
        END
      ) AS metadata,
      clinics.updated_at
    FROM public.clinics
    LEFT JOIN public.profiles owner_profile ON owner_profile.id = clinics.account_owner_user_id
    LEFT JOIN public.clinic_subscriptions sub ON sub.clinic_id = clinics.id
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
      AND (input.tag_id IS NULL OR EXISTS (
        SELECT 1 FROM public.clinic_tag_relations ctr
        WHERE ctr.clinic_id = clinics.id AND ctr.tag_id = input.tag_id
      ))
      AND (
        input.raw_query IS NULL
        OR public.platform_normalize_search(clinics.name || ' ' || clinics.cnpj || ' ' || coalesce(clinics.legal_name, '') || ' ' || coalesce(owner_profile.email, '') || ' ' || coalesce(owner_profile.full_name, '')) LIKE '%' || input.normalized_query || '%'
      )
  ),
  account_rows AS (
    SELECT
      'account'::text AS item_type,
      profiles.id AS item_id,
      user_clinics.primary_clinic_id AS clinic_id,
      coalesce(user_clinics.primary_clinic_name, 'Conta Pessoal / Sem clínica') AS clinic_name,
      coalesce(profiles.full_name, profiles.email, 'Conta sem nome') AS title,
      coalesce(profiles.email, profiles.phone, 'Sem contato principal') AS subtitle,
      profiles.cpf AS primary_document,
      profiles.phone AS secondary_document,
      CASE
        WHEN user_clinics.has_banned THEN 'banned'
        WHEN user_clinics.has_paused THEN 'paused'
        WHEN user_clinics.has_expired THEN 'expired'
        WHEN user_clinics.has_expiring_soon THEN 'expiring_soon'
        WHEN user_clinics.clinics_count = 0 THEN 'personal'
        ELSE 'active'
      END AS status,
      jsonb_build_object(
        'email', profiles.email,
        'phone', profiles.phone,
        'birth_date', profiles.birth_date,
        'age', CASE
          WHEN profiles.birth_date IS NULL THEN NULL
          ELSE extract(year FROM age(current_date, profiles.birth_date))::integer
        END,
        'job_title', profiles.job_title,
        'account_role', CASE WHEN user_clinics.is_owner THEN 'account_owner' ELSE 'user' END,
        'operational_role', coalesce(user_clinics.primary_operational_role, 'professional'),
        'is_active', true,
        'is_pending_registration', false,
        'is_owner', user_clinics.is_owner,
        'clinics_count', user_clinics.clinics_count,
        'clinics', user_clinics.clinics_list,
        'joined_at', user_clinics.first_joined_at
      ) AS metadata,
      greatest(profiles.last_seen_at, profiles.updated_at, user_clinics.latest_update) AS updated_at
    FROM public.profiles
    LEFT JOIN LATERAL (
      SELECT
        count(c.id)::integer AS clinics_count,
        bool_or(m.account_role = 'account_owner' OR c.account_owner_user_id = profiles.id) AS is_owner,
        bool_or(c.access_status = 'banned' OR m.membership_status::text IN ('suspended', 'blocked')) AS has_banned,
        bool_or(c.access_status = 'temporarily_paused' OR m.membership_status::text IN ('inactive', 'paused')) AS has_paused,
        bool_or(sub.expires_at IS NOT NULL AND sub.expires_at < now()) AS has_expired,
        bool_or(sub.expires_at IS NOT NULL AND sub.expires_at <= now() + interval '7 days' AND sub.expires_at >= now()) AS has_expiring_soon,
        min(m.joined_at) AS first_joined_at,
        max(greatest(m.updated_at, c.updated_at)) AS latest_update,
        (
          SELECT c_sub.id FROM public.clinic_memberships m_sub
          JOIN public.clinics c_sub ON c_sub.id = m_sub.clinic_id
          WHERE m_sub.user_id = profiles.id
          ORDER BY (m_sub.account_role = 'account_owner' OR c_sub.account_owner_user_id = profiles.id) DESC, m_sub.created_at ASC
          LIMIT 1
        ) AS primary_clinic_id,
        (
          SELECT c_sub.name FROM public.clinic_memberships m_sub
          JOIN public.clinics c_sub ON c_sub.id = m_sub.clinic_id
          WHERE m_sub.user_id = profiles.id
          ORDER BY (m_sub.account_role = 'account_owner' OR c_sub.account_owner_user_id = profiles.id) DESC, m_sub.created_at ASC
          LIMIT 1
        ) AS primary_clinic_name,
        (
          SELECT m_sub.operational_role::text FROM public.clinic_memberships m_sub
          WHERE m_sub.user_id = profiles.id
          ORDER BY (m_sub.account_role = 'account_owner') DESC, m_sub.created_at ASC
          LIMIT 1
        ) AS primary_operational_role,
        coalesce(jsonb_agg(
          jsonb_build_object(
            'clinic_id', c.id,
            'clinic_name', c.name,
            'route_key', c.route_key,
            'account_role', m.account_role,
            'is_owner', (m.account_role = 'account_owner' OR c.account_owner_user_id = profiles.id),
            'status', c.access_status
          ) ORDER BY (m.account_role = 'account_owner' OR c.account_owner_user_id = profiles.id) DESC, c.name ASC
        ) FILTER (WHERE c.id IS NOT NULL), '[]'::jsonb) AS clinics_list
      FROM public.clinic_memberships m
      JOIN public.clinics c ON c.id = m.clinic_id
      LEFT JOIN public.clinic_subscriptions sub ON sub.clinic_id = c.id
      WHERE m.user_id = profiles.id
    ) user_clinics ON true
    CROSS JOIN input
    WHERE public.is_platform_owner_mfa_verified(auth.uid())
      AND (
        (input.kind = 'all')
        OR (input.kind = 'account' AND (user_clinics.is_owner IS NULL OR user_clinics.is_owner = false))
        OR (input.kind = 'owner' AND user_clinics.is_owner = true)
      )
      AND (input.tag_id IS NULL OR EXISTS (
        SELECT 1 FROM public.clinic_memberships m_tag
        JOIN public.clinic_tag_relations ctr ON ctr.clinic_id = m_tag.clinic_id
        WHERE m_tag.user_id = profiles.id AND ctr.tag_id = input.tag_id
      ))
      AND (
        input.raw_query IS NULL
        OR public.platform_normalize_search(coalesce(profiles.full_name, '') || ' ' || coalesce(profiles.email, '') || ' ' || coalesce(profiles.cpf, '') || ' ' || coalesce(profiles.phone, '') || ' ' || coalesce(profiles.job_title, '') || ' ' || coalesce(user_clinics.primary_clinic_name, '')) LIKE '%' || input.normalized_query || '%'
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
      'pending' AS status,
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
    LEFT JOIN public.clinics ON clinics.id = i.clinic_id
    LEFT JOIN auth.users u ON lower(u.email) = lower(i.email)
    LEFT JOIN public.profiles p ON p.id = u.id
    CROSS JOIN input
    WHERE public.is_platform_owner_mfa_verified(auth.uid())
      AND i.status = 'pending'
      AND input.kind IN ('all', 'account', 'pending_account')
      AND (input.tag_id IS NULL OR (i.clinic_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.clinic_tag_relations ctr
        WHERE ctr.clinic_id = i.clinic_id AND ctr.tag_id = input.tag_id
      )))
      AND (
        input.raw_query IS NULL
        OR public.platform_normalize_search(i.email || ' ' || coalesce(p.full_name, '') || ' ' || coalesce(i.job_title, '') || ' ' || coalesce(clinics.name, '')) LIKE '%' || input.normalized_query || '%'
      )
  ),
  orphan_auth_users AS (
    SELECT
      'account'::text AS item_type,
      u.id AS item_id,
      NULL::uuid AS clinic_id,
      'Cadastro sem perfil'::text AS clinic_name,
      coalesce(u.raw_user_meta_data->>'full_name', u.email, 'Usuário pendente') AS title,
      u.email AS subtitle,
      coalesce(u.raw_user_meta_data->>'cpf', 'Sem CPF no perfil') AS primary_document,
      coalesce(u.raw_user_meta_data->>'phone', 'Sem telefone') AS secondary_document,
      'pending' AS status,
      jsonb_build_object(
        'email', u.email,
        'user_id', u.id,
        'is_active', false,
        'is_pending_registration', true,
        'account_state', CASE WHEN u.email_confirmed_at IS NULL THEN 'registered_unconfirmed' ELSE 'registered_confirmed' END,
        'pending_reason', 'Usuário registrado no Auth sem perfil completo finalizado.'
      ) AS metadata,
      u.created_at AS updated_at
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    CROSS JOIN input
    WHERE public.is_platform_owner_mfa_verified(auth.uid())
      AND p.id IS NULL
      AND input.kind IN ('all', 'account', 'pending_account')
      AND input.tag_id IS NULL
      AND (
        input.raw_query IS NULL
        OR public.platform_normalize_search(u.email || ' ' || coalesce(u.raw_user_meta_data->>'full_name', '') || ' ' || coalesce(u.raw_user_meta_data->>'cpf', '')) LIKE '%' || input.normalized_query || '%'
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
      AND (input.tag_id IS NULL OR EXISTS (
        SELECT 1 FROM public.clinic_tag_relations ctr
        WHERE ctr.clinic_id = clinics.id AND ctr.tag_id = input.tag_id
      ))
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
    SELECT * FROM orphan_auth_users
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
  WHERE (
    input.status_filter = 'all'
    OR (input.status_filter = 'active' AND combined_results.status IN ('active', 'Ativo', 'Ativa', 'personal'))
    OR (input.status_filter = 'pending' AND (combined_results.status IN ('pending', 'pending_invite', 'unconfirmed_email', 'pending_login') OR (combined_results.metadata->>'is_pending_registration')::boolean = true))
    OR (input.status_filter = 'expiring_soon' AND combined_results.status = 'expiring_soon')
    OR (input.status_filter = 'expired' AND combined_results.status = 'expired')
    OR (input.status_filter = 'banned' AND combined_results.status IN ('banned', 'blocked'))
    OR (input.status_filter = 'paused' AND combined_results.status IN ('paused', 'temporarily_paused'))
  )
  ORDER BY combined_results.updated_at DESC
  LIMIT (SELECT row_limit FROM input);
$$;

-- Backward compatible wrapper for callers passing only 3 arguments
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
  SELECT * FROM public.list_platform_directory(_query, _kind, 'all', null, _limit);
$$;

-- Atualizar get_platform_person_detail para cobrir usuários sem perfil ou órfãos
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

    -- Se não achou em profiles, procura em convites pendentes
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
      ELSE
        -- Procura em auth.users para usuário sem perfil (órfão)
        SELECT * INTO _pending_user
        FROM auth.users
        WHERE id = _item_id;

        IF _pending_user.id IS NOT NULL THEN
          _result := jsonb_build_object(
            'type', 'account',
            'is_pending_registration', true,
            'profile', jsonb_build_object(
              'id', _pending_user.id,
              'email', _pending_user.email,
              'full_name', coalesce(_pending_user.raw_user_meta_data->>'full_name', _pending_user.email),
              'cpf', _pending_user.raw_user_meta_data->>'cpf',
              'phone', _pending_user.raw_user_meta_data->>'phone',
              'created_at', _pending_user.created_at,
              'updated_at', _pending_user.updated_at,
              'status', CASE
                WHEN _pending_user.email_confirmed_at IS NULL THEN 'E-mail não verificado'
                ELSE 'Aguardando finalização do perfil'
              END
            ),
            'memberships', '[]'::jsonb,
            'counts', jsonb_build_object('sessions_created', 0, 'sessions_as_provider', 0)
          );
        END IF;
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

GRANT EXECUTE ON FUNCTION public.list_platform_directory(text, text, text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_platform_directory(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_person_detail(text, uuid) TO authenticated;
