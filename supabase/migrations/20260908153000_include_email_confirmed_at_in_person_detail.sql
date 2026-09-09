-- Adiciona email_confirmed_at e email_status em get_platform_person_detail
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
  _auth_user auth.users%ROWTYPE;
BEGIN
  IF NOT public.is_platform_owner_mfa_verified(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado ao painel global.';
  END IF;

  IF _item_type = 'account' THEN
    SELECT * INTO _auth_user
    FROM auth.users
    WHERE id = _item_id;

    SELECT jsonb_build_object(
      'type', 'account',
      'profile', to_jsonb(profiles) || jsonb_build_object(
        'email_confirmed_at', _auth_user.email_confirmed_at,
        'email_confirmed', (_auth_user.email_confirmed_at IS NOT NULL),
        'status', CASE
          WHEN _auth_user.id IS NOT NULL AND _auth_user.email_confirmed_at IS NULL THEN 'E-mail não verificado'
          ELSE 'Ativo'
        END
      ),
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
            'email_confirmed_at', _pending_user.email_confirmed_at,
            'email_confirmed', (_pending_user.email_confirmed_at IS NOT NULL),
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
              'email_confirmed_at', _pending_user.email_confirmed_at,
              'email_confirmed', (_pending_user.email_confirmed_at IS NOT NULL),
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

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_platform_person_detail(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_platform_person_detail(text, uuid) TO authenticated;
