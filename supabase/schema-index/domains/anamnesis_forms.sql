-- ==========================================================================
-- DOMÍNIO: ANAMNESIS_FORMS (Gerado automaticamente por npm run schema:index)
-- Fonte SSOT: supabase/schema.sql
-- ==========================================================================

-- [RPC/FUNCTION] calculate_community_template_fields_count (schema.sql L1055-L1066)
CREATE OR REPLACE FUNCTION "public"."calculate_community_template_fields_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.schema IS NOT NULL AND jsonb_typeof(NEW.schema) = 'array' THEN
    NEW.fields_count := jsonb_array_length(NEW.schema);
  ELSE
    NEW.fields_count := 0;
  END IF;
  RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] can_perform_action (schema.sql L1095-L1206)
CREATE OR REPLACE FUNCTION "public"."can_perform_action"("_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _resolved_clinic_id uuid;
  _account_role public.account_role_type;
  _operational_role public.operational_role_type;
  _membership_status public.membership_status_type;
  _is_active boolean;
  _subscription_plan public.subscription_plan;
  _sub record;
  _is_subscription_expired boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  _resolved_clinic_id := COALESCE(_clinic_id, public.get_user_clinic_id(_user_id));

  SELECT
    clinic_memberships.account_role,
    clinic_memberships.operational_role,
    clinic_memberships.membership_status,
    clinic_memberships.is_active,
    clinics.subscription_plan
  INTO
    _account_role,
    _operational_role,
    _membership_status,
    _is_active,
    _subscription_plan
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

  -- Checar se a assinatura esta expirada
  SELECT * INTO _sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _resolved_clinic_id
  LIMIT 1;

  IF _sub IS NOT NULL AND _sub.status NOT IN ('BETA', 'TRIAL') THEN
    IF _sub.expires_at IS NOT NULL AND _sub.expires_at < now() THEN
      _is_subscription_expired := true;
    ELSIF _sub.status = 'EXPIRED' OR _sub.status = 'SUSPENDED' THEN
      _is_subscription_expired := true;
    END IF;
  END IF;

  -- Se a assinatura estiver expirada, permite APENAS leitura ou gerenciamento da assinatura para renovacao
  IF _is_subscription_expired THEN
    IF _capability = 'subscription_billing.manage' AND _account_role = 'account_owner' THEN
      RETURN true;
    END IF;
    -- Permite apenas acoes de leitura (.read)
    IF _capability IN ('patients.read', 'schedule.read', 'sessions.read', 'subaccounts_analytics.read') THEN
      RETURN true;
    END IF;
    -- Qualquer acao de escrita e bloqueada
    RETURN false;
  END IF;

  IF _account_role = 'account_owner' THEN
    RETURN true;
  END IF;

  CASE _capability
    WHEN 'clinic_profile.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'forms.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.manage' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.manage' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'subscription_billing.manage' THEN
      RETURN false;
    WHEN 'treasury.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'agenda.delete_events' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_analytics.read' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'patients.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'patients.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'sessions.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'sessions.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'session.delete_draft' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- [RPC/FUNCTION] end_platform_clinic_access (schema.sql L2697-L2732)
CREATE OR REPLACE FUNCTION "public"."end_platform_clinic_access"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _user_id uuid := auth.uid();
  _clinic_id uuid;
begin
  if not public.is_platform_owner_mfa_verified(_user_id) then
    raise exception 'Verificacao de dois fatores obrigatoria para acesso de plataforma.';
  end if;

  select clinic_id
  into _clinic_id
  from public.platform_clinic_access_sessions
  where actor_user_id = _user_id
    and ended_at is null
  order by started_at desc
  limit 1;

  update public.platform_clinic_access_sessions
  set ended_at = now(), last_seen_at = now()
  where actor_user_id = _user_id
    and ended_at is null;

  delete from public.user_active_clinic_contexts
  where user_id = _user_id
    and (_clinic_id is null or clinic_id = _clinic_id);

  if _clinic_id is not null then
    perform public.log_platform_audit_event('platform_clinic_access_ended', _clinic_id, null, '{}'::jsonb);
  end if;

  return jsonb_build_object('clinic_id', _clinic_id);
end;
$$;

-- [RPC/FUNCTION] get_active_platform_clinic_id (schema.sql L3337-L3348)
CREATE OR REPLACE FUNCTION "public"."get_active_platform_clinic_id"("_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select platform_clinic_access_sessions.clinic_id
  from public.platform_clinic_access_sessions
  where platform_clinic_access_sessions.actor_user_id = _user_id
    and platform_clinic_access_sessions.ended_at is null
    and public.is_platform_owner_mfa_verified(_user_id)
  order by platform_clinic_access_sessions.started_at desc
  limit 1
$$;

-- [RPC/FUNCTION] get_current_platform_role (schema.sql L4398-L4408)
CREATE OR REPLACE FUNCTION "public"."get_current_platform_role"() RETURNS "public"."platform_admin_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select platform_admins.role
  from public.platform_admins
  where platform_admins.user_id = auth.uid()
    and platform_admins.is_active = true
    and public.is_platform_owner_mfa_verified(auth.uid())
  limit 1
$$;

-- [RPC/FUNCTION] get_platform_clinic_detail (schema.sql L4628-L4688)
CREATE OR REPLACE FUNCTION "public"."get_platform_clinic_detail"("_clinic_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select case
    when not public.is_platform_owner_mfa_verified(auth.uid()) then
      public.raise_exception_json('Verificacao de dois fatores obrigatoria para acesso de plataforma.')
    else (
      select jsonb_build_object(
        'clinic', to_jsonb(clinics),
        'owner', to_jsonb(owner_profile),
        'counts', jsonb_build_object(
          'collaborators', (select count(*) from public.clinic_memberships where clinic_id = clinics.id and is_active = true),
          'patients', (select count(*) from public.patients where clinic_id = clinics.id),
          'sessions', (select count(*) from public.sessions where clinic_id = clinics.id),
          'agendaEvents', (select count(*) from public.agenda_events where clinic_id = clinics.id)
        ),
        'memberships', coalesce((
          select jsonb_agg(member_row order by member_row.full_name nulls last, member_row.email nulls last)
          from (
            select
              clinic_memberships.id,
              clinic_memberships.user_id,
              clinic_memberships.account_role,
              clinic_memberships.operational_role,
              clinic_memberships.membership_status,
              clinic_memberships.is_active,
              clinic_memberships.joined_at,
              profiles.full_name,
              profiles.email
            from public.clinic_memberships
            left join public.profiles on profiles.id = clinic_memberships.user_id
            where clinic_memberships.clinic_id = clinics.id
          ) member_row
        ), '[]'::jsonb),
        'patients', coalesce((
          select jsonb_agg(patient_row order by patient_row.name nulls last, patient_row.created_at desc)
          from (
            select
              patients.id,
              patients.name,
              patients.email,
              patients.phone,
              patients.cpf,
              patients.status,
              patients.registration_complete,
              patients.created_at,
              patients.updated_at
            from public.patients
            where patients.clinic_id = clinics.id
            order by patients.created_at desc
            limit 120
          ) patient_row
        ), '[]'::jsonb)
      )
      from public.clinics
      left join public.profiles owner_profile on owner_profile.id = clinics.account_owner_user_id
      where clinics.id = _clinic_id
    )
  end
$$;

-- [RPC/FUNCTION] get_platform_clinic_detail_by_route_key (schema.sql L4694-L4725)
CREATE OR REPLACE FUNCTION "public"."get_platform_clinic_detail_by_route_key"("_route_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  _clean_route_key text := nullif(trim(coalesce(_route_key, '')), '');
  _clinic_id uuid;
begin
  if not public.is_platform_owner_mfa_verified(auth.uid()) then
    raise exception 'Verificacao de dois fatores obrigatoria para acesso de plataforma.';
  end if;

  if _clean_route_key is null
    or char_length(_clean_route_key) > 80
    or _clean_route_key !~ '^[A-Za-z0-9_-]+$'
  then
    raise exception 'Rota de clinica invalida.';
  end if;

  select clinics.id
  into _clinic_id
  from public.clinics
  where clinics.route_key = _clean_route_key
  limit 1;

  if _clinic_id is null then
    raise exception 'Clinica nao encontrada.';
  end if;

  return public.get_platform_clinic_detail(_clinic_id);
end;
$_$;

-- [RPC/FUNCTION] get_platform_clinic_forms_summary_by_route_key (schema.sql L4731-L4820)
CREATE OR REPLACE FUNCTION "public"."get_platform_clinic_forms_summary_by_route_key"("_route_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  _clean_route_key text := nullif(trim(coalesce(_route_key, '')), '');
  _clinic_id uuid;
  _summary jsonb;
begin
  if not public.is_platform_owner_mfa_verified(auth.uid()) then
    raise exception 'Verificacao de dois fatores obrigatoria para acesso de plataforma.';
  end if;

  if _clean_route_key is null
    or char_length(_clean_route_key) > 80
    or _clean_route_key !~ '^[A-Za-z0-9_-]+$'
  then
    raise exception 'Rota de clinica invalida.';
  end if;

  select clinics.id
  into _clinic_id
  from public.clinics
  where clinics.route_key = _clean_route_key
  limit 1;

  if _clinic_id is null then
    raise exception 'Clinica nao encontrada.';
  end if;

  select jsonb_build_object(
    'base', jsonb_build_object(
      'field_count', coalesce((
        select count(*)::integer
        from jsonb_array_elements(coalesce(clinics.anamnesis_base_schema, '[]'::jsonb)) as field(value)
        where coalesce(field.value->>'type', '') not in ('section', 'horizontal_section', 'section_selector')
      ), 0),
      'section_count', coalesce((
        select count(*)::integer
        from jsonb_array_elements(coalesce(clinics.anamnesis_base_schema, '[]'::jsonb)) as field(value)
        where coalesce(field.value->>'type', '') in ('section', 'horizontal_section', 'section_selector')
      ), 0),
      'schema', coalesce(clinics.anamnesis_base_schema, '[]'::jsonb),
      'updated_at', clinics.updated_at
    ),
    'templates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', templates.id,
          'name', templates.name,
          'description', templates.description,
          'field_count', coalesce((
            select count(*)::integer
            from jsonb_array_elements(coalesce(templates.schema, '[]'::jsonb)) as field(value)
            where coalesce(field.value->>'type', '') not in ('section', 'horizontal_section', 'section_selector')
          ), 0),
          'section_count', coalesce((
            select count(*)::integer
            from jsonb_array_elements(coalesce(templates.schema, '[]'::jsonb)) as field(value)
            where coalesce(field.value->>'type', '') in ('section', 'horizontal_section', 'section_selector')
          ), 0),
          'schema', coalesce(templates.schema, '[]'::jsonb),
          'usage_count', coalesce(template_usage.total, 0),
          'updated_at', templates.updated_at
        )
        order by templates.updated_at desc nulls last, templates.name
      )
      from public.anamnesis_form_templates templates
      left join lateral (
        select count(*)::integer as total
        from public.sessions
        where sessions.anamnesis_template_id = templates.id
      ) template_usage on true
      where templates.clinic_id = clinics.id
    ), '[]'::jsonb)
  )
  into _summary
  from public.clinics
  where clinics.id = _clinic_id;

  perform public.log_platform_audit_event(
    'platform_clinic_forms_summary_read',
    _clinic_id,
    null,
    jsonb_build_object('route_key', _clean_route_key)
  );

  return coalesce(_summary, jsonb_build_object('base', jsonb_build_object(), 'templates', '[]'::jsonb));
end;
$_$;

-- [RPC/FUNCTION] get_platform_clinic_roles_overview (schema.sql L4826-L4898)
CREATE OR REPLACE FUNCTION "public"."get_platform_clinic_roles_overview"("_clinic_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _roles jsonb;
  _capabilities jsonb;
  _usage_counts jsonb;
BEGIN
  IF NOT public.is_platform_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas operadores master da plataforma podem consultar papéis operacionais de clínicas.';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'clinic_id', r.clinic_id,
        'role_key', r.role_key,
        'label', r.label,
        'description', r.description,
        'base_operational_role', r.base_operational_role,
        'sort_order', r.sort_order,
        'is_system', r.is_system,
        'created_at', r.created_at,
        'updated_at', r.updated_at
      ) ORDER BY r.sort_order ASC, r.label ASC
    ),
    '[]'::jsonb
  )
  INTO _roles
  FROM public.clinic_operational_roles r
  WHERE r.clinic_id = _clinic_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'clinic_id', c.clinic_id,
        'operational_role', c.operational_role,
        'capability', c.capability,
        'enabled', c.enabled,
        'created_at', c.created_at,
        'updated_at', c.updated_at
      )
    ),
    '[]'::jsonb
  )
  INTO _capabilities
  FROM public.clinic_operational_role_capabilities c
  WHERE c.clinic_id = _clinic_id;

  SELECT COALESCE(
    jsonb_object_agg(sub.operational_role, sub.total),
    '{}'::jsonb
  )
  INTO _usage_counts
  FROM (
    SELECT cm.operational_role::text AS operational_role, count(*)::int AS total
    FROM public.clinic_memberships cm
    WHERE cm.clinic_id = _clinic_id
      AND cm.membership_status <> 'invited'
      AND cm.is_active = true
    GROUP BY cm.operational_role
  ) sub;

  RETURN jsonb_build_object(
    'roles', _roles,
    'capabilities', _capabilities,
    'usage_counts', _usage_counts
  );
END;
$$;

-- [RPC/FUNCTION] get_platform_dashboard (schema.sql L4904-L4962)
CREATE OR REPLACE FUNCTION "public"."get_platform_dashboard"() RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select case
    when not public.is_platform_owner_mfa_verified(auth.uid()) then
      (select raise_exception_json('Verificacao de dois fatores obrigatoria para acesso de plataforma.'))
    else jsonb_build_object(
      'totals', jsonb_build_object(
        'clinics', (select count(*) from public.clinics),
        'profiles', (select count(*) from public.profiles),
        'patients', (select count(*) from public.patients),
        'sessions', (select count(*) from public.sessions),
        'activeFeatureFlags', (
          select count(*)
          from public.feature_flags
          where coalesce(starts_at, '-infinity'::timestamptz) <= now()
            and coalesce(expires_at, 'infinity'::timestamptz) > now()
        )
      ),
      'recentAuditEvents', coalesce((
        select jsonb_agg(event_row order by created_at desc)
        from (
          select
            platform_audit_events.id,
            platform_audit_events.event_type,
            platform_audit_events.reason,
            platform_audit_events.created_at,
            platform_audit_events.clinic_id,
            clinics.name as clinic_name,
            profiles.email as actor_email,
            profiles.full_name as actor_name
          from public.platform_audit_events
          left join public.clinics on clinics.id = platform_audit_events.clinic_id
          left join public.profiles on profiles.id = platform_audit_events.actor_user_id
          order by platform_audit_events.created_at desc
          limit 12
        ) event_row
      ), '[]'::jsonb),
      'recentSecurityEvents', coalesce((
        select jsonb_agg(event_row order by created_at desc)
        from (
          select
            security_events.id,
            security_events.event_type,
            security_events.created_at,
            security_events.clinic_id,
            clinics.name as clinic_name,
            profiles.email as target_email
          from public.security_events
          left join public.clinics on clinics.id = security_events.clinic_id
          left join public.profiles on profiles.id = security_events.target_user_id
          order by security_events.created_at desc
          limit 12
        ) event_row
      ), '[]'::jsonb)
    )
  end
$$;

-- [RPC/FUNCTION] get_platform_person_detail (schema.sql L4968-L5175)
CREATE OR REPLACE FUNCTION "public"."get_platform_person_detail"("_item_type" "text", "_item_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
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

-- [RPC/FUNCTION] increment_community_template_import (schema.sql L6076-L6085)
CREATE OR REPLACE FUNCTION "public"."increment_community_template_import"("p_template_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.community_form_templates
  SET imports_count = imports_count + 1
  WHERE id = p_template_id AND is_published = true;
END;
$$;

-- [RPC/FUNCTION] is_platform_admin (schema.sql L6378-L6388)
CREATE OR REPLACE FUNCTION "public"."is_platform_admin"("_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.platform_admins
    where platform_admins.user_id = _user_id
      and platform_admins.is_active = true
  )
$$;

-- [RPC/FUNCTION] is_platform_owner (schema.sql L6394-L6405)
CREATE OR REPLACE FUNCTION "public"."is_platform_owner"("_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.platform_admins
    where platform_admins.user_id = _user_id
      and platform_admins.role = 'platform_owner'
      and platform_admins.is_active = true
  )
$$;

-- [RPC/FUNCTION] is_platform_owner_mfa_verified (schema.sql L6411-L6417)
CREATE OR REPLACE FUNCTION "public"."is_platform_owner_mfa_verified"("_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.is_platform_owner(_user_id)
    and coalesce(auth.jwt()->>'aal', '') = 'aal2'
$$;

-- [RPC/FUNCTION] list_platform_audit_events (schema.sql L6715-L6738)
CREATE OR REPLACE FUNCTION "public"."list_platform_audit_events"("_clinic_id" "uuid" DEFAULT NULL::"uuid", "_limit" integer DEFAULT 80) RETURNS TABLE("id" "uuid", "actor_user_id" "uuid", "actor_email" "text", "actor_name" "text", "actor_platform_role" "public"."platform_admin_role", "clinic_id" "uuid", "clinic_name" "text", "event_type" "text", "reason" "text", "metadata" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    platform_audit_events.id,
    platform_audit_events.actor_user_id,
    actor_profile.email,
    actor_profile.full_name,
    platform_audit_events.actor_platform_role,
    platform_audit_events.clinic_id,
    clinics.name,
    platform_audit_events.event_type,
    platform_audit_events.reason,
    platform_audit_events.metadata,
    platform_audit_events.created_at
  from public.platform_audit_events
  left join public.profiles actor_profile on actor_profile.id = platform_audit_events.actor_user_id
  left join public.clinics on clinics.id = platform_audit_events.clinic_id
  where public.is_platform_owner_mfa_verified(auth.uid())
    and (_clinic_id is null or platform_audit_events.clinic_id = _clinic_id)
  order by platform_audit_events.created_at desc
  limit least(greatest(coalesce(_limit, 80), 1), 200)
$$;

-- [RPC/FUNCTION] list_platform_error_logs (schema.sql L6744-L6779)
CREATE OR REPLACE FUNCTION "public"."list_platform_error_logs"("_limit" integer DEFAULT 100, "_error_type" "text" DEFAULT NULL::"text", "_search" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "user_name" "text", "user_email" "text", "clinic_id" "uuid", "clinic_name" "text", "error_type" "text", "scope" "text", "message" "text", "stack_trace" "text", "context" "jsonb", "route" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
  SELECT
    l.id,
    l.user_id,
    p.full_name AS user_name,
    p.email AS user_email,
    l.clinic_id,
    c.name AS clinic_name,
    l.error_type,
    l.scope,
    l.message,
    l.stack_trace,
    l.context,
    l.route,
    l.created_at
  FROM public.platform_error_logs l
  LEFT JOIN public.profiles p ON p.id = l.user_id
  LEFT JOIN public.clinics c ON c.id = l.clinic_id
  WHERE (public.is_platform_admin(auth.uid()) OR public.is_platform_owner(auth.uid()))
    AND (_error_type IS NULL OR _error_type = '' OR l.error_type = _error_type)
    AND (
      _search IS NULL
      OR _search = ''
      OR l.message ILIKE ('%' || _search || '%')
      OR l.scope ILIKE ('%' || _search || '%')
      OR l.route ILIKE ('%' || _search || '%')
      OR coalesce(p.full_name, '') ILIKE ('%' || _search || '%')
      OR coalesce(p.email, '') ILIKE ('%' || _search || '%')
      OR coalesce(c.name, '') ILIKE ('%' || _search || '%')
    )
  ORDER BY l.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 100), 1), 500);
$$;

-- [RPC/FUNCTION] list_platform_clinics (schema.sql L6785-L6839)
CREATE OR REPLACE FUNCTION "public"."list_platform_clinics"() RETURNS TABLE("clinic_id" "uuid", "clinic_route_key" "text", "clinic_name" "text", "clinic_cnpj" "text", "clinic_subscription_plan" "public"."subscription_plan", "clinic_subaccount_limit" integer, "clinic_concurrent_access_limit" integer, "clinic_created_at" timestamp with time zone, "clinic_updated_at" timestamp with time zone, "owner_user_id" "uuid", "owner_name" "text", "owner_email" "text", "collaborators_count" bigint, "patients_count" bigint, "sessions_count" bigint, "active_flags_count" bigint, "last_activity_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    clinics.id,
    clinics.route_key,
    clinics.name,
    clinics.cnpj,
    clinics.subscription_plan,
    clinics.subaccount_limit,
    nullif(to_jsonb(clinics)->>'concurrent_access_limit', '')::integer,
    clinics.created_at,
    clinics.updated_at,
    clinics.account_owner_user_id,
    owner_profile.full_name,
    owner_profile.email,
    coalesce(membership_counts.total, 0),
    coalesce(patient_counts.total, 0),
    coalesce(session_counts.total, 0),
    coalesce(flag_counts.total, 0),
    greatest(
      clinics.updated_at,
      coalesce(patient_counts.last_activity_at, clinics.updated_at),
      coalesce(session_counts.last_activity_at, clinics.updated_at)
    )
  from public.clinics
  left join public.profiles owner_profile on owner_profile.id = clinics.account_owner_user_id
  left join lateral (
    select count(*) as total
    from public.clinic_memberships
    where clinic_memberships.clinic_id = clinics.id
      and clinic_memberships.is_active = true
      and clinic_memberships.membership_status = 'active'
  ) membership_counts on true
  left join lateral (
    select count(*) as total, max(updated_at) as last_activity_at
    from public.patients
    where patients.clinic_id = clinics.id
  ) patient_counts on true
  left join lateral (
    select count(*) as total, max(updated_at) as last_activity_at
    from public.sessions
    where sessions.clinic_id = clinics.id
  ) session_counts on true
  left join lateral (
    select count(*) as total
    from public.feature_flags
    where feature_flags.clinic_id = clinics.id
      and coalesce(feature_flags.starts_at, '-infinity'::timestamptz) <= now()
      and coalesce(feature_flags.expires_at, 'infinity'::timestamptz) > now()
  ) flag_counts on true
  where public.is_platform_owner_mfa_verified(auth.uid())
  order by clinics.updated_at desc nulls last, clinics.created_at desc
$$;

-- [RPC/FUNCTION] list_platform_directory (schema.sql L6845-L6850)
CREATE OR REPLACE FUNCTION "public"."list_platform_directory"("_query" "text" DEFAULT NULL::"text", "_kind" "text" DEFAULT 'all'::"text", "_limit" integer DEFAULT 80) RETURNS TABLE("item_type" "text", "item_id" "uuid", "clinic_id" "uuid", "clinic_name" "text", "title" "text", "subtitle" "text", "primary_document" "text", "secondary_document" "text", "status" "text", "metadata" "jsonb", "updated_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT * FROM public.list_platform_directory(_query, _kind, 'all', null, _limit);
$$;

-- [RPC/FUNCTION] list_platform_directory (schema.sql L6856-L7216)
CREATE OR REPLACE FUNCTION "public"."list_platform_directory"("_query" "text" DEFAULT NULL::"text", "_kind" "text" DEFAULT 'all'::"text", "_status" "text" DEFAULT 'all'::"text", "_tag_id" "uuid" DEFAULT NULL::"uuid", "_limit" integer DEFAULT 80) RETURNS TABLE("item_type" "text", "item_id" "uuid", "clinic_id" "uuid", "clinic_name" "text", "title" "text", "subtitle" "text", "primary_document" "text", "secondary_document" "text", "status" "text", "metadata" "jsonb", "updated_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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
        'is_hibernated', clinics.is_hibernated,
        'last_accessed_at', clinics.last_accessed_at,
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

-- [RPC/FUNCTION] list_platform_telemetry_events (schema.sql L7222-L7249)
CREATE OR REPLACE FUNCTION "public"."list_platform_telemetry_events"("_clinic_id" "uuid", "_limit" integer DEFAULT 100) RETURNS TABLE("id" "uuid", "clinic_id" "uuid", "user_id" "uuid", "user_name" "text", "event_type" "text", "pathname" "text", "resource_type" "text", "resource_id" "text", "metadata" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  -- Verify caller is platform owner
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Acesso negado. Apenas o Backoffice Master pode visualizar eventos de telemetria.';
  END IF;

  RETURN QUERY
  SELECT 
    t.id,
    t.clinic_id,
    t.user_id,
    t.user_name,
    t.event_type,
    t.pathname,
    t.resource_type,
    t.resource_id,
    t.metadata,
    t.created_at
  FROM public.telemetry_events t
  WHERE t.clinic_id = _clinic_id
  ORDER BY t.created_at DESC
  LIMIT LEAST(_limit, 500);
END;
$$;

-- [RPC/FUNCTION] list_platform_user_telemetry_events (schema.sql L7255-L7282)
CREATE OR REPLACE FUNCTION "public"."list_platform_user_telemetry_events"("_user_id" "uuid", "_limit" integer DEFAULT 100) RETURNS TABLE("id" "uuid", "clinic_id" "uuid", "user_id" "uuid", "user_name" "text", "event_type" "text", "pathname" "text", "resource_type" "text", "resource_id" "text", "metadata" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  -- Verify caller is platform owner
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Acesso negado. Apenas o Backoffice Master pode visualizar estatísticas individuais de usuários.';
  END IF;

  RETURN QUERY
  SELECT 
    t.id,
    t.clinic_id,
    t.user_id,
    t.user_name,
    t.event_type,
    t.pathname,
    t.resource_type,
    t.resource_id,
    t.metadata,
    t.created_at
  FROM public.telemetry_events t
  WHERE t.user_id = _user_id
  ORDER BY t.created_at DESC
  LIMIT LEAST(_limit, 500);
END;
$$;

-- [RPC/FUNCTION] log_platform_audit_event (schema.sql L7288-L7331)
CREATE OR REPLACE FUNCTION "public"."log_platform_audit_event"("_event_type" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid", "_reason" "text" DEFAULT NULL::"text", "_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _user_id uuid := auth.uid();
  _role public.platform_admin_role;
  _event_id uuid;
begin
  if _user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select public.get_current_platform_role() into _role;

  if _role is null then
    raise exception 'Acesso de plataforma indisponivel.';
  end if;

  insert into public.platform_audit_events (
    actor_user_id,
    actor_platform_role,
    clinic_id,
    event_type,
    reason,
    metadata
  )
  values (
    _user_id,
    _role,
    _clinic_id,
    left(btrim(_event_type), 120),
    nullif(left(coalesce(_reason, ''), 1000), ''),
    coalesce(_metadata, '{}'::jsonb)
  )
  returning id into _event_id;

  update public.platform_admins
  set last_used_at = now()
  where user_id = _user_id;

  return _event_id;
end;
$$;

-- [RPC/FUNCTION] platform_create_clinic (schema.sql L8183-L8232)
CREATE OR REPLACE FUNCTION "public"."platform_create_clinic"("_name" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan" DEFAULT 'clinic'::"public"."subscription_plan", "_subaccount_limit" integer DEFAULT 4, "_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  _clinic public.clinics%rowtype;
  _clean_name text := nullif(trim(coalesce(_name, '')), '');
  _clean_cnpj text := nullif(trim(coalesce(_cnpj, '')), '');
  _clean_reason text := nullif(trim(coalesce(_reason, '')), '');
begin
  if not public.is_platform_owner_mfa_verified(auth.uid()) then
    raise exception 'Acesso negado ao painel global.';
  end if;

  if _clean_name is null or char_length(_clean_name) < 3 or char_length(_clean_name) > 120 then
    raise exception 'Informe um nome de clinica entre 3 e 120 caracteres.';
  end if;

  if _clean_cnpj is null or char_length(regexp_replace(_clean_cnpj, '[^0-9]', '', 'g')) not in (11, 14) then
    raise exception 'Informe um CPF/CNPJ administrativo valido para iniciar a clinica.';
  end if;

  insert into public.clinics (name, cnpj, subscription_plan, subaccount_limit)
  values (
    _clean_name,
    _clean_cnpj,
    coalesce(_subscription_plan, 'clinic'),
    least(greatest(coalesce(_subaccount_limit, 4), 0), 200)
  )
  returning * into _clinic;

  perform public.log_platform_audit_event(
    'platform_clinic_created',
    _clinic.id,
    _clean_reason,
    jsonb_build_object(
      'clinic_id', _clinic.id,
      'clinic_name', _clinic.name,
      'subscription_plan', _clinic.subscription_plan,
      'subaccount_limit', _clinic.subaccount_limit
    )
  );

  return jsonb_build_object(
    'clinic_id', _clinic.id,
    'route_key', _clinic.route_key,
    'name', _clinic.name
  );
end;
$$;

-- [RPC/FUNCTION] platform_normalize_search (schema.sql L8238-L8243)
CREATE OR REPLACE FUNCTION "public"."platform_normalize_search"("_value" "text") RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select lower(regexp_replace(coalesce(_value, ''), '[^[:alnum:]]+', '', 'g'));
$$;

-- [RPC/FUNCTION] platform_override_clinic_subscription (schema.sql L8249-L8390)
CREATE OR REPLACE FUNCTION "public"."platform_override_clinic_subscription"("_clinic_id" "uuid", "_new_plan" "public"."subscription_plan" DEFAULT NULL::"public"."subscription_plan", "_status" "text" DEFAULT NULL::"text", "_subaccount_limit" integer DEFAULT NULL::integer, "_concurrent_access_limit" integer DEFAULT NULL::integer, "_next_due_date" "date" DEFAULT NULL::"date", "_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_caller_id uuid := auth.uid();
  v_is_platform_admin boolean;
  v_sub_record public.clinic_subscriptions%rowtype;
  v_owner_id uuid;
  v_target_plan text;
  v_default_base_subaccounts integer := 999999;
  v_default_base_concurrent integer := 4;
  v_default_price numeric(10,2) := 139.00;
  v_new_base_subaccounts integer;
  v_new_base_concurrent integer;
begin
  -- Exige permissão de Administrador da Plataforma
  select exists (
    select 1 from public.platform_admins
    where user_id = v_caller_id and is_active = true
  ) into v_is_platform_admin;

  if not v_is_platform_admin then
    raise exception 'Acesso negado: apenas administradores da plataforma podem realizar overrides operacionais.';
  end if;

  if _reason is null or length(trim(_reason)) < 8 then
    raise exception 'Justificativa (motivo) auditável é obrigatória e deve conter pelo menos 8 caracteres para realizar override de assinatura.';
  end if;

  -- Blindagem e clamp seguro contra valores abusivos ou negativos (1 a 999999)
  if _subaccount_limit is not null then
    _subaccount_limit := greatest(1, least(_subaccount_limit, 999999));
  end if;

  if _concurrent_access_limit is not null then
    _concurrent_access_limit := greatest(1, least(_concurrent_access_limit, 999999));
  end if;

  -- Busca owner da clínica
  select account_owner_user_id into v_owner_id from public.clinics where id = _clinic_id;
  v_owner_id := coalesce(v_owner_id, v_caller_id);

  -- Calcula limites e valores base padrão da matriz para o plano alvo
  v_target_plan := lower(coalesce(_new_plan::text, 'clinica_medio'));

  if v_target_plan in ('prof_basico', 'prof_medio', 'solo') then
    v_default_base_subaccounts := 1;
    v_default_base_concurrent := 1;
    v_default_price := case when v_target_plan = 'prof_basico' then 39.99 else 59.99 end;
  elsif v_target_plan = 'prof_top' then
    v_default_base_subaccounts := 2;
    v_default_base_concurrent := 2;
    v_default_price := 89.99;
  elsif v_target_plan = 'clinica_basico' then
    v_default_base_subaccounts := 999999;
    v_default_base_concurrent := 2;
    v_default_price := 99.00;
  elsif v_target_plan in ('clinica_top', 'enterprise') then
    v_default_base_subaccounts := 999999;
    v_default_base_concurrent := 8;
    v_default_price := 199.00;
  else -- clinica_medio, clinic
    v_default_base_subaccounts := 999999;
    v_default_base_concurrent := 4;
    v_default_price := 139.00;
  end if;

  -- Garante registro de assinatura
  select * into v_sub_record from public.clinic_subscriptions where clinic_id = _clinic_id;
  if v_sub_record.id is null then
    insert into public.clinic_subscriptions (
      clinic_id, account_owner_user_id, plan_type, base_monthly_price,
      base_subaccount_limit, base_concurrent_access_count, status
    )
    values (
      _clinic_id,
      v_owner_id,
      coalesce(_new_plan, 'clinica_medio'::public.subscription_plan),
      v_default_price,
      coalesce(_subaccount_limit, v_default_base_subaccounts),
      coalesce(_concurrent_access_limit, v_default_base_concurrent),
      coalesce(_status, 'ACTIVE')
    )
    returning * into v_sub_record;
  end if;

  -- Determina novos limites base se o plano foi alterado
  if _new_plan is not null then
    v_new_base_subaccounts := coalesce(_subaccount_limit, v_default_base_subaccounts);
    v_new_base_concurrent := coalesce(_concurrent_access_limit, v_default_base_concurrent);
  else
    v_new_base_subaccounts := coalesce(_subaccount_limit, v_sub_record.base_subaccount_limit);
    v_new_base_concurrent := v_sub_record.base_concurrent_access_count;
  end if;

  update public.clinic_subscriptions
  set
    plan_type = coalesce(_new_plan, plan_type),
    status = coalesce(_status, status),
    base_subaccount_limit = v_new_base_subaccounts,
    base_concurrent_access_count = v_new_base_concurrent,
    additional_concurrent_access_count = case
      when _concurrent_access_limit is not null then greatest(0, _concurrent_access_limit - v_new_base_concurrent)
      else additional_concurrent_access_count
    end,
    next_due_date = coalesce(_next_due_date, next_due_date),
    override_reason = trim(_reason),
    override_by_user_id = v_caller_id,
    override_at = now(),
    updated_at = now()
  where clinic_id = _clinic_id
  returning * into v_sub_record;

  -- Registro de auditoria obrigatório no log global de eventos da plataforma
  perform public.log_platform_audit_event(
    'platform_override_clinic_subscription',
    _clinic_id,
    trim(_reason),
    jsonb_build_object(
      'plan_type', v_sub_record.plan_type,
      'status', v_sub_record.status,
      'subaccount_limit', v_sub_record.base_subaccount_limit + v_sub_record.purchased_subaccount_extra_count,
      'concurrent_access_limit', v_sub_record.base_concurrent_access_count + v_sub_record.additional_concurrent_access_count,
      'next_due_date', v_sub_record.next_due_date,
      'caller_user_id', v_caller_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'clinic_id', _clinic_id,
    'plan_type', v_sub_record.plan_type,
    'status', v_sub_record.status,
    'subaccount_limit', v_sub_record.base_subaccount_limit + v_sub_record.purchased_subaccount_extra_count,
    'concurrent_access_limit', v_sub_record.base_concurrent_access_count + v_sub_record.additional_concurrent_access_count,
    'next_due_date', v_sub_record.next_due_date,
    'override_reason', v_sub_record.override_reason,
    'override_at', v_sub_record.override_at
  );
end;
$$;

-- [RPC/FUNCTION] start_platform_clinic_access (schema.sql L9084-L9144)
CREATE OR REPLACE FUNCTION "public"."start_platform_clinic_access"("_clinic_id" "uuid", "_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _user_id uuid := auth.uid();
  _clinic public.clinics%rowtype;
  _reason_clean text := nullif(left(btrim(coalesce(_reason, '')), 1000), '');
begin
  if not public.is_platform_owner_mfa_verified(_user_id) then
    raise exception 'Verificacao de dois fatores obrigatoria para acesso de plataforma.';
  end if;

  if _reason_clean is null then
    raise exception 'Informe o motivo para acessar a clinica.';
  end if;

  select *
  into _clinic
  from public.clinics
  where id = _clinic_id;

  if _clinic.id is null then
    raise exception 'Clinica nao encontrada.';
  end if;

  update public.platform_clinic_access_sessions
  set ended_at = now(), last_seen_at = now()
  where actor_user_id = _user_id
    and ended_at is null;

  insert into public.platform_clinic_access_sessions (actor_user_id, clinic_id, reason)
  values (_user_id, _clinic_id, _reason_clean);

  insert into public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
  values (_user_id, _clinic_id, now())
  on conflict (user_id)
  do update set clinic_id = excluded.clinic_id, updated_at = now();

  perform public.log_platform_audit_event(
    'platform_clinic_access_started',
    _clinic_id,
    _reason_clean,
    jsonb_build_object('clinic_name', _clinic.name, 'clinic_route_key', _clinic.route_key)
  );

  return jsonb_build_object(
    'clinic', jsonb_build_object(
      'id', _clinic.id,
      'name', _clinic.name,
      'logo_url', _clinic.logo_url,
      'route_key', _clinic.route_key,
      'subscription_plan', _clinic.subscription_plan,
      'subaccount_limit', _clinic.subaccount_limit,
      'concurrent_access_limit', nullif(to_jsonb(_clinic)->>'concurrent_access_limit', '')::integer,
      'account_owner_user_id', _clinic.account_owner_user_id
    ),
    'reason', _reason_clean
  );
end;
$$;

-- [RPC/FUNCTION] submit_user_platform_feedback (schema.sql L9362-L9443)
CREATE OR REPLACE FUNCTION "public"."submit_user_platform_feedback"("_clinic_id" "uuid", "_ratings" "jsonb", "_problem_report" "text" DEFAULT NULL::"text", "_opinion" "text" DEFAULT NULL::"text", "_page_url" "text" DEFAULT NULL::"text", "_user_agent" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _user_name text;
  _clinic_name text;
  _feedback_id uuid;
  _avg_rating numeric(3,2) := 0;
  _item jsonb;
  _sum numeric := 0;
  _count numeric := 0;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  -- 1. Obter dados do usuário
  SELECT email, COALESCE(NULLIF(trim(full_name), ''), NULLIF(trim(social_name), ''), email)
  INTO _user_email, _user_name
  FROM public.profiles
  WHERE id = _user_id;

  -- 2. Obter dados da clínica se informada
  IF _clinic_id IS NOT NULL THEN
    SELECT name
    INTO _clinic_name
    FROM public.clinics
    WHERE id = _clinic_id;
  END IF;

  -- 3. Calcular média de estrelas
  IF _ratings IS NOT NULL AND jsonb_array_length(_ratings) > 0 THEN
    FOR _item IN SELECT * FROM jsonb_array_elements(_ratings)
    LOOP
      IF (_item->>'rating') IS NOT NULL AND (_item->>'rating')::numeric > 0 THEN
        _sum := _sum + (_item->>'rating')::numeric;
        _count := _count + 1;
      END IF;
    END LOOP;

    IF _count > 0 THEN
      _avg_rating := ROUND((_sum / _count)::numeric, 2);
    END IF;
  END IF;

  -- 4. Inserir feedback
  INSERT INTO public.platform_feedbacks (
    user_id,
    clinic_id,
    user_email,
    user_name,
    clinic_name,
    ratings,
    average_rating,
    problem_report,
    opinion,
    page_url,
    user_agent,
    status
  )
  VALUES (
    _user_id,
    _clinic_id,
    _user_email,
    _user_name,
    _clinic_name,
    COALESCE(_ratings, '[]'::jsonb),
    _avg_rating,
    NULLIF(trim(_problem_report), ''),
    NULLIF(trim(_opinion), ''),
    NULLIF(trim(_page_url), ''),
    NULLIF(trim(_user_agent), ''),
    'pending'
  )
  RETURNING id INTO _feedback_id;

  RETURN _feedback_id;
END;
$$;

-- [RPC/FUNCTION] toggle_community_template_like (schema.sql L9503-L9536)
CREATE OR REPLACE FUNCTION "public"."toggle_community_template_like"("p_template_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_liked boolean;
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF EXISTS (SELECT 1 FROM public.community_form_template_likes WHERE template_id = p_template_id AND user_id = v_user_id) THEN
    DELETE FROM public.community_form_template_likes WHERE template_id = p_template_id AND user_id = v_user_id;
    UPDATE public.community_form_templates
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = p_template_id;
    v_liked := false;
  ELSE
    INSERT INTO public.community_form_template_likes (template_id, user_id)
    VALUES (p_template_id, v_user_id)
    ON CONFLICT DO NOTHING;
    UPDATE public.community_form_templates
    SET likes_count = likes_count + 1
    WHERE id = p_template_id;
    v_liked := true;
  END IF;

  SELECT likes_count INTO v_count FROM public.community_form_templates WHERE id = p_template_id;

  RETURN jsonb_build_object('liked', v_liked, 'likes_count', COALESCE(v_count, 0));
END;
$$;

-- [RPC/FUNCTION] touch_platform_feedbacks_updated_at (schema.sql L9590-L9597)
CREATE OR REPLACE FUNCTION "public"."touch_platform_feedbacks_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] log_platform_error (schema.sql L10714-L10751)
CREATE OR REPLACE FUNCTION "public"."log_platform_error"("_error_type" "text", "_message" "text", "_scope" "text" DEFAULT NULL::"text", "_stack_trace" "text" DEFAULT NULL::"text", "_context" "jsonb" DEFAULT '{}'::"jsonb", "_route" "text" DEFAULT NULL::"text", "_clinic_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
DECLARE
  v_log_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  IF _message IS NULL OR trim(_message) = '' THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.platform_error_logs (
    user_id,
    clinic_id,
    error_type,
    scope,
    message,
    stack_trace,
    context,
    route,
    created_at
  ) VALUES (
    v_user_id,
    _clinic_id,
    COALESCE(NULLIF(trim(_error_type), ''), 'runtime_error'),
    NULLIF(trim(_scope), ''),
    trim(_message),
    NULLIF(trim(_stack_trace), ''),
    COALESCE(_context, '{}'::jsonb),
    NULLIF(trim(_route), ''),
    now()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- [TABLE] anamnesis_form_templates (schema.sql L11327-L11343)
CREATE TABLE IF NOT EXISTS "public"."anamnesis_form_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "schema" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_system_default" boolean DEFAULT false NOT NULL,
    CONSTRAINT "anamnesis_form_templates_schema_shape_check" CHECK ((("jsonb_typeof"("schema") = 'array'::"text") AND
CASE
    WHEN ("jsonb_typeof"("schema") = 'array'::"text") THEN ("jsonb_array_length"("schema") <= 200)
    ELSE false
END))
);

-- [TABLE] community_form_template_comments (schema.sql L11635-L11646)
CREATE TABLE IF NOT EXISTS "public"."community_form_template_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "author_name" "text" NOT NULL,
    "clinic_name" "text",
    "content" "text" NOT NULL,
    "rating" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "community_form_template_comments_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);

-- [TABLE] community_form_template_likes (schema.sql L11652-L11656)
CREATE TABLE IF NOT EXISTS "public"."community_form_template_likes" (
    "template_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [TABLE] community_form_templates (schema.sql L11662-L11681)
CREATE TABLE IF NOT EXISTS "public"."community_form_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "author_name" "text" NOT NULL,
    "clinic_name" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'Geral'::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "schema" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "kind" "text" DEFAULT 'template'::"text" NOT NULL,
    "imports_count" integer DEFAULT 0 NOT NULL,
    "likes_count" integer DEFAULT 0 NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "is_published" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fields_count" smallint DEFAULT 0 NOT NULL
);

-- [TABLE] platform_admins (schema.sql L11942-L11949)
CREATE TABLE IF NOT EXISTS "public"."platform_admins" (
    "user_id" "uuid" NOT NULL,
    "role" "public"."platform_admin_role" DEFAULT 'platform_owner'::"public"."platform_admin_role" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "last_used_at" timestamp with time zone
);

-- [TABLE] platform_audit_events (schema.sql L11955-L11966)
CREATE TABLE IF NOT EXISTS "public"."platform_audit_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "actor_platform_role" "public"."platform_admin_role" NOT NULL,
    "clinic_id" "uuid",
    "event_type" "text" NOT NULL,
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [TABLE] platform_error_logs (schema.sql L11972-L11983)
CREATE TABLE IF NOT EXISTS "public"."platform_error_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "clinic_id" "uuid",
    "error_type" "text" NOT NULL,
    "scope" "text",
    "message" "text" NOT NULL,
    "stack_trace" "text",
    "context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "route" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [TABLE] platform_feedbacks (schema.sql L12003-L12021)
CREATE TABLE IF NOT EXISTS "public"."platform_feedbacks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "clinic_id" "uuid",
    "user_email" "text",
    "user_name" "text",
    "clinic_name" "text",
    "ratings" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "average_rating" numeric(3,2),
    "problem_report" "text",
    "opinion" "text",
    "page_url" "text",
    "user_agent" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_feedbacks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'archived'::"text"])))
);

-- [TABLE] platform_release_note_items (schema.sql L12027-L12036)
CREATE TABLE IF NOT EXISTS "public"."platform_release_note_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "release_id" "uuid" NOT NULL,
    "category" "public"."platform_release_note_category" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_release_note_items_title_not_blank" CHECK (("btrim"("title") <> ''::"text"))
);

-- [TABLE] platform_releases (schema.sql L12042-L12055)
CREATE TABLE IF NOT EXISTS "public"."platform_releases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "version" "text" NOT NULL,
    "version_order" integer NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text",
    "published_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_releases_title_not_blank" CHECK (("btrim"("title") <> ''::"text")),
    CONSTRAINT "platform_releases_version_not_blank" CHECK (("btrim"("version") <> ''::"text")),
    CONSTRAINT "platform_releases_version_order_positive" CHECK (("version_order" > 0))
);

-- [POLICY] Anyone authenticated can view published community templates ON community_form_templates (schema.sql L14021-L14021)
CREATE POLICY "Anyone authenticated can view published community templates" ON "public"."community_form_templates" FOR SELECT TO "authenticated" USING ((("is_published" = true) OR ("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."is_platform_owner"("auth"."uid"())));

-- [POLICY] Authenticated users can insert comments ON community_form_template_comments (schema.sql L14025-L14025)
CREATE POLICY "Authenticated users can insert comments" ON "public"."community_form_template_comments" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));

-- [POLICY] Authenticated users can manage their own likes ON community_form_template_likes (schema.sql L14037-L14037)
CREATE POLICY "Authenticated users can manage their own likes" ON "public"."community_form_template_likes" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));

-- [POLICY] Authenticated users can publish community templates ON community_form_templates (schema.sql L14041-L14041)
CREATE POLICY "Authenticated users can publish community templates" ON "public"."community_form_templates" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));

-- [POLICY] Authenticated users can read comments ON community_form_template_comments (schema.sql L14045-L14045)
CREATE POLICY "Authenticated users can read comments" ON "public"."community_form_template_comments" FOR SELECT TO "authenticated" USING (true);

-- [POLICY] Authenticated users can remove their own likes ON community_form_template_likes (schema.sql L14049-L14049)
CREATE POLICY "Authenticated users can remove their own likes" ON "public"."community_form_template_likes" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));

-- [POLICY] Authenticated users can view template likes ON community_form_template_likes (schema.sql L14057-L14057)
CREATE POLICY "Authenticated users can view template likes" ON "public"."community_form_template_likes" FOR SELECT TO "authenticated" USING (true);

-- [POLICY] Authenticated users insert own feedback ON platform_feedbacks (schema.sql L14065-L14065)
CREATE POLICY "Authenticated users insert own feedback" ON "public"."platform_feedbacks" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR ("user_id" IS NULL)));

-- [POLICY] Authenticated users read platform releases ON platform_releases (schema.sql L14069-L14069)
CREATE POLICY "Authenticated users read platform releases" ON "public"."platform_releases" FOR SELECT TO "authenticated" USING ((("is_active" = true) OR "public"."is_platform_owner"("auth"."uid"())));

-- [POLICY] Authenticated users read release note items ON platform_release_note_items (schema.sql L14073-L14075)
CREATE POLICY "Authenticated users read release note items" ON "public"."platform_release_note_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."platform_releases"
  WHERE (("platform_releases"."id" = "platform_release_note_items"."release_id") AND (("platform_releases"."is_active" = true) OR "public"."is_platform_owner"("auth"."uid"()))))));

-- [POLICY] Authors, super admins and platform owners can delete community templates ON community_form_templates (schema.sql L14079-L14079)
CREATE POLICY "Authors, super admins and platform owners can delete community templates" ON "public"."community_form_templates" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."is_platform_owner"("auth"."uid"())));

-- [POLICY] Authors, super admins and platform owners can update community templates ON community_form_templates (schema.sql L14083-L14083)
CREATE POLICY "Authors, super admins and platform owners can update community templates" ON "public"."community_form_templates" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."is_platform_owner"("auth"."uid"()))) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."is_platform_owner"("auth"."uid"())));

-- [POLICY] Platform owner manage feedbacks ON platform_feedbacks (schema.sql L14147-L14147)
CREATE POLICY "Platform owner manage feedbacks" ON "public"."platform_feedbacks" TO "authenticated" USING ("public"."is_platform_owner"(( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."is_platform_owner"(( SELECT "auth"."uid"() AS "uid")));

-- [POLICY] Platform owners manage platform release note items ON platform_release_note_items (schema.sql L14183-L14183)
CREATE POLICY "Platform owners manage platform release note items" ON "public"."platform_release_note_items" TO "authenticated" USING ("public"."is_platform_owner"("auth"."uid"())) WITH CHECK ("public"."is_platform_owner"("auth"."uid"()));

-- [POLICY] Platform owners manage platform releases ON platform_releases (schema.sql L14187-L14187)
CREATE POLICY "Platform owners manage platform releases" ON "public"."platform_releases" TO "authenticated" USING ("public"."is_platform_owner"("auth"."uid"())) WITH CHECK ("public"."is_platform_owner"("auth"."uid"()));

-- [POLICY] Platform owners read platform admins ON platform_admins (schema.sql L14191-L14191)
CREATE POLICY "Platform owners read platform admins" ON "public"."platform_admins" FOR SELECT TO "authenticated" USING (("public"."is_platform_owner_mfa_verified"("auth"."uid"()) OR ("user_id" = "auth"."uid"())));

-- [POLICY] Platform owners read platform audit ON platform_audit_events (schema.sql L14195-L14195)
CREATE POLICY "Platform owners read platform audit" ON "public"."platform_audit_events" FOR SELECT TO "authenticated" USING ("public"."is_platform_owner_mfa_verified"("auth"."uid"()));

-- [POLICY] Platform admins can view platform error logs ON platform_error_logs (schema.sql L14199-L14199)
CREATE POLICY "Platform admins can view platform error logs" ON "public"."platform_error_logs" FOR SELECT TO "authenticated" USING (("public"."is_platform_admin"("auth"."uid"()) OR "public"."is_platform_owner"("auth"."uid"())));

-- [POLICY] Authenticated users can insert error logs ON platform_error_logs (schema.sql L14203-L14203)
CREATE POLICY "Authenticated users can insert error logs" ON "public"."platform_error_logs" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() IS NULL) OR ("user_id" = "auth"."uid"())));

-- [POLICY] Anon can insert error logs ON platform_error_logs (schema.sql L14207-L14207)
CREATE POLICY "Anon can insert error logs" ON "public"."platform_error_logs" FOR INSERT TO "anon" WITH CHECK (("user_id" IS NULL));

-- [POLICY] Super admins manage all anamnesis form templates ON anamnesis_form_templates (schema.sql L14219-L14219)
CREATE POLICY "Super admins manage all anamnesis form templates" ON "public"."anamnesis_form_templates" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));

-- [POLICY] Users and admins can delete own comments ON community_form_template_comments (schema.sql L14259-L14259)
CREATE POLICY "Users and admins can delete own comments" ON "public"."community_form_template_comments" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));

-- [POLICY] Users delete clinic anamnesis forms ON anamnesis_form_templates (schema.sql L14283-L14283)
CREATE POLICY "Users delete clinic anamnesis forms" ON "public"."anamnesis_form_templates" FOR DELETE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('forms.manage'::"text", "clinic_id")));

-- [POLICY] Users read clinic anamnesis forms ON anamnesis_form_templates (schema.sql L14341-L14341)
CREATE POLICY "Users read clinic anamnesis forms" ON "public"."anamnesis_form_templates" FOR SELECT TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND "public"."can_read_clinic_data"("clinic_id") AND ("public"."current_user_can"('forms.read'::"text", "clinic_id") OR "public"."current_user_can"('anamnesis_forms.read'::"text", "clinic_id"))));

-- [POLICY] Users read own feedback ON platform_feedbacks (schema.sql L14402-L14402)
CREATE POLICY "Users read own feedback" ON "public"."platform_feedbacks" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR "public"."is_platform_owner"(( SELECT "auth"."uid"() AS "uid"))));

-- [POLICY] Users update clinic anamnesis forms ON anamnesis_form_templates (schema.sql L14430-L14430)
CREATE POLICY "Users update clinic anamnesis forms" ON "public"."anamnesis_form_templates" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('forms.manage'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('forms.manage'::"text", "clinic_id")));

-- [POLICY] Users write clinic anamnesis forms ON anamnesis_form_templates (schema.sql L14466-L14466)
CREATE POLICY "Users write clinic anamnesis forms" ON "public"."anamnesis_form_templates" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('forms.manage'::"text", "clinic_id")));

-- [TABLE] platform_onboarding_meetings (schema.sql L16099-L16114)
CREATE TABLE IF NOT EXISTS public.platform_onboarding_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    clinic_name TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 15,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'canceled', 'rescheduled', 'no_show')),
    google_calendar_url TEXT,
    meet_url TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
