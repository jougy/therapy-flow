-- ==========================================================================
-- DOMÍNIO: SESSIONS (Gerado automaticamente por npm run schema:index)
-- Fonte SSOT: supabase/schema.sql
-- ==========================================================================

-- [RPC/FUNCTION] can_insert_session (schema.sql L1072-L1089)
CREATE OR REPLACE FUNCTION "public"."can_insert_session"("_clinic_id" "uuid", "_user_id" "uuid", "_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    _clinic_id = public.get_user_clinic_id((SELECT auth.uid()))
    AND _user_id = (SELECT auth.uid())
    AND _provider_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.clinic_memberships
      WHERE clinic_memberships.clinic_id = _clinic_id
        AND clinic_memberships.user_id = (SELECT auth.uid())
        AND clinic_memberships.operational_role IN ('owner', 'admin', 'professional', 'estagiario')
        AND clinic_memberships.is_active = true
        AND clinic_memberships.membership_status = 'active'
    );
$$;

-- [RPC/FUNCTION] can_read_session (schema.sql L1277-L1319)
CREATE OR REPLACE FUNCTION "public"."can_read_session"("_session_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _session public.sessions%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT *
  INTO _session
  FROM public.sessions
  WHERE id = _session_id;

  IF _session.id IS NULL OR _session.clinic_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.current_user_can('sessions.read', _session.clinic_id) THEN
    RETURN false;
  END IF;

  IF public.current_user_is_clinic_manager(_session.clinic_id) THEN
    RETURN true;
  END IF;

  IF _session.user_id = _user_id OR _session.provider_id = _user_id THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.session_shares
    WHERE session_shares.session_id = _session.id
      AND session_shares.clinic_id = _session.clinic_id
      AND session_shares.shared_with_user_id = _user_id
      AND session_shares.revoked_at IS NULL
  );
END;
$$;

-- [RPC/FUNCTION] can_share_session (schema.sql L1325-L1354)
CREATE OR REPLACE FUNCTION "public"."can_share_session"("_session_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _session public.sessions%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT *
  INTO _session
  FROM public.sessions
  WHERE id = _session_id;

  IF _session.id IS NULL OR _session.clinic_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.current_user_can('sessions.read', _session.clinic_id) THEN
    RETURN false;
  END IF;

  RETURN public.current_user_is_clinic_manager(_session.clinic_id)
    OR _session.user_id = _user_id
    OR _session.provider_id = _user_id;
END;
$$;

-- [RPC/FUNCTION] cleanup_user_security_sessions (schema.sql L1559-L1622)
CREATE OR REPLACE FUNCTION "public"."cleanup_user_security_sessions"("_user_id" "uuid" DEFAULT "auth"."uid"(), "_inactive_window" interval DEFAULT '00:15:00'::interval, "_retention_window" interval DEFAULT '30 days'::interval) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _stale_count integer := 0;
  _deleted_count integer := 0;
  _stale_session record;
  _clinic_id uuid;
  _has_other_active boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  -- Identificar sessões que estão expirando agora por inatividade
  FOR _stale_session IN
    SELECT id, clinic_id, session_key
    FROM public.user_security_sessions
    WHERE user_id = _user_id
      AND ended_at IS NULL
      AND last_seen_at < now() - _inactive_window
  LOOP
    UPDATE public.user_security_sessions
    SET
      ended_at = COALESCE(last_seen_at, now()),
      updated_at = now()
    WHERE id = _stale_session.id;

    _stale_count := _stale_count + 1;

    -- Verificar se o usuário ficou totalmente offline na clínica
    _clinic_id := _stale_session.clinic_id;
    IF _clinic_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.user_security_sessions
        WHERE user_id = _user_id
          AND clinic_id = _clinic_id
          AND ended_at IS NULL
          AND force_signed_out_at IS NULL
          AND last_seen_at >= now() - INTERVAL '5 minutes'
      ) INTO _has_other_active;

      IF NOT _has_other_active THEN
        PERFORM public.notify_clinic_collaborator_presence(_clinic_id, _user_id, 'offline');
      END IF;
    END IF;
  END LOOP;

  DELETE FROM public.user_security_sessions
  WHERE user_id = _user_id
    AND ended_at IS NOT NULL
    AND ended_at < now() - _retention_window;

  GET DIAGNOSTICS _deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted_count', _deleted_count,
    'stale_count', _stale_count,
    'user_id', _user_id
  );
END;
$$;

-- [RPC/FUNCTION] end_clinic_user_security_sessions (schema.sql L2533-L2580)
CREATE OR REPLACE FUNCTION "public"."end_clinic_user_security_sessions"("_target_user_id" "uuid", "_clinic_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _resolved_clinic_id uuid := COALESCE(_clinic_id, public.get_user_clinic_id(_requester_id));
  _affected_count integer := 0;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF _target_user_id IS NULL THEN
    RAISE EXCEPTION 'Colaborador alvo nao informado.';
  END IF;

  IF NOT public.current_user_can('subaccounts.manage', _resolved_clinic_id) THEN
    RAISE EXCEPTION 'Sem permissao para gerenciar acessos desta clinica.';
  END IF;

  UPDATE public.user_security_sessions
  SET
    ended_at = now(),
    force_signed_out_at = now(),
    forced_out_by = _requester_id,
    updated_at = now()
  WHERE clinic_id = _resolved_clinic_id
    AND user_id = _target_user_id
    AND ended_at IS NULL;

  GET DIAGNOSTICS _affected_count = ROW_COUNT;

  PERFORM public.log_security_event(
    _resolved_clinic_id,
    _requester_id,
    _target_user_id,
    'subaccount_signed_out',
    'admin',
    jsonb_build_object('ended_count', _affected_count)
  );

  RETURN jsonb_build_object(
    'ended_count', _affected_count,
    'target_user_id', _target_user_id
  );
END;
$$;

-- [RPC/FUNCTION] end_current_security_session (schema.sql L2586-L2646)
CREATE OR REPLACE FUNCTION "public"."end_current_security_session"("_session_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _affected_count integer := 0;
  _session_row public.user_security_sessions%ROWTYPE;
  _clinic_id uuid;
  _is_completely_offline boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF NULLIF(trim(COALESCE(_session_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida.';
  END IF;

  SELECT *
  INTO _session_row
  FROM public.user_security_sessions
  WHERE user_id = _user_id
    AND session_key = _session_key
  LIMIT 1;

  UPDATE public.user_security_sessions
  SET
    ended_at = now(),
    updated_at = now()
  WHERE user_id = _user_id
    AND session_key = _session_key
    AND ended_at IS NULL;

  GET DIAGNOSTICS _affected_count = ROW_COUNT;

  -- Presença: Se o usuário não tem mais nenhuma sessão ativa nessa clínica, notificar offline
  _clinic_id := COALESCE(_session_row.clinic_id, public.get_user_clinic_id(_user_id));
  IF _clinic_id IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1
      FROM public.user_security_sessions
      WHERE user_id = _user_id
        AND clinic_id = _clinic_id
        AND session_key <> _session_key
        AND ended_at IS NULL
        AND force_signed_out_at IS NULL
        AND last_seen_at >= now() - INTERVAL '5 minutes'
    ) INTO _is_completely_offline;

    IF _is_completely_offline THEN
      PERFORM public.notify_clinic_collaborator_presence(_clinic_id, _user_id, 'offline');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ended_count', _affected_count,
    'user_id', _user_id
  );
END;
$$;

-- [RPC/FUNCTION] end_other_security_sessions (schema.sql L2652-L2691)
CREATE OR REPLACE FUNCTION "public"."end_other_security_sessions"("_current_session_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _affected_count integer := 0;
  _clinic_id uuid := public.get_user_clinic_id(_user_id);
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  PERFORM public.cleanup_user_security_sessions(_user_id);

  UPDATE public.user_security_sessions
  SET
    ended_at = now(),
    updated_at = now()
  WHERE user_id = _user_id
    AND session_key IS DISTINCT FROM _current_session_key
    AND ended_at IS NULL;

  GET DIAGNOSTICS _affected_count = ROW_COUNT;

  PERFORM public.log_security_event(
    _clinic_id,
    _user_id,
    _user_id,
    'other_sessions_signed_out',
    'self',
    jsonb_build_object('ended_count', _affected_count)
  );

  RETURN jsonb_build_object(
    'ended_count', _affected_count,
    'user_id', _user_id
  );
END;
$$;

-- [RPC/FUNCTION] expire_abandoned_security_sessions (schema.sql L3129-L3149)
CREATE OR REPLACE FUNCTION "public"."expire_abandoned_security_sessions"("_abandoned_window" interval DEFAULT '7 days'::interval) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _affected_count integer := 0;
BEGIN
  UPDATE public.user_security_sessions
  SET
    ended_at = COALESCE(last_seen_at, now()),
    updated_at = now()
  WHERE ended_at IS NULL
    AND last_seen_at < now() - _abandoned_window;

  GET DIAGNOSTICS _affected_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'expired_count', _affected_count
  );
END;
$$;

-- [RPC/FUNCTION] get_personal_professional_sessions_portfolio (schema.sql L5181-L5320)
CREATE OR REPLACE FUNCTION "public"."get_personal_professional_sessions_portfolio"("_query" "text" DEFAULT NULL::"text", "_clinic_id" "uuid" DEFAULT NULL::"uuid", "_limit" integer DEFAULT 100, "_offset" integer DEFAULT 0) RETURNS TABLE("session_id" "uuid", "session_date" timestamp with time zone, "session_status" "text", "clinic_id" "uuid", "clinic_name" "text", "clinic_route_key" "text", "patient_id" "uuid", "patient_ref" "text", "patient_name" "text", "patient_pseudonym" "text", "patient_demographics" "text", "notes_sanitized" "text", "treatment_sanitized" "text", "pain_score" integer, "complexity_score" integer, "created_at" timestamp with time zone, "anamnesis_form_response" "jsonb", "care_lines" "jsonb", "anamnesis_base_schema" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  _authenticated_user_id uuid := auth.uid();
  _clean_query text;
  _sanitized_limit integer;
  _sanitized_offset integer;
BEGIN
  -- 1. Validação de autenticação obrigatória
  IF _authenticated_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  -- 2. Saneamento de paginação e busca
  _sanitized_limit := LEAST(GREATEST(COALESCE(_limit, 100), 1), 200);
  _sanitized_offset := GREATEST(COALESCE(_offset, 0), 0);
  _clean_query := NULLIF(trim(_query), '');

  -- 3. Retorno dos atendimentos com isolamento LGPD e guarda legal:
  --    a) Clínicas de terceiros (membro/colaborador): sessões detalhadas nominais só são
  --       retornadas se o vínculo estiver ativo (status = 'active').
  --    b) Própria clínica do usuário (account_owner): sessões históricas continuam sendo
  --       retornadas em modo leitura mesmo se is_hibernated = true (CFM 1.821 / 20 anos).
  --    c) Atendimentos particulares (s.clinic_id IS NULL): retornados diretamente.
  --    d) Soft Delete estrito: s.deleted_at IS NULL.
  RETURN QUERY
  SELECT
    s.id AS session_id,
    s.session_date,
    s.status AS session_status,
    s.clinic_id,
    COALESCE(c.name, 'Atendimento Particular') AS clinic_name,
    c.route_key AS clinic_route_key,
    p.id AS patient_id,
    COALESCE(p.patient_code, p.id::text) AS patient_ref,
    COALESCE(p.name, 'Paciente') AS patient_name,
    public.pseudonymize_patient_name(p.name) AS patient_pseudonym,
    NULLIF(
      TRIM(
        CONCAT_WS(
          ' • ',
          CASE
            WHEN p.date_of_birth IS NOT NULL THEN
              (EXTRACT(YEAR FROM age(COALESCE(s.session_date, now())::date, p.date_of_birth))::integer || ' anos')
            WHEN p.age IS NOT NULL THEN
              (p.age || ' anos')
            ELSE NULL
          END,
          CASE
            WHEN p.gender IS NOT NULL AND trim(p.gender) <> '' THEN
              initcap(trim(p.gender))
            ELSE NULL
          END
        )
      ),
      ''
    ) AS patient_demographics,
    public.sanitize_clinical_free_text(s.notes) AS notes_sanitized,
    CASE
      WHEN s.treatment IS NULL THEN NULL
      WHEN jsonb_typeof(s.treatment) = 'null' THEN NULL
      WHEN jsonb_typeof(s.treatment) = 'string' THEN public.sanitize_clinical_free_text(s.treatment #>> '{}')
      ELSE public.sanitize_clinical_free_text(s.treatment::text)
    END AS treatment_sanitized,
    s.pain_score,
    s.complexity_score,
    s.created_at,
    COALESCE(s.anamnesis_form_response, '{}'::jsonb) AS anamnesis_form_response,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pg.id,
            'name', pg.name,
            'color', pg.color
          )
          ORDER BY pg.name ASC
        )
        FROM (
          SELECT DISTINCT id_val::uuid AS group_uuid
          FROM (
            SELECT jsonb_array_elements_text(
              CASE 
                WHEN jsonb_typeof(s.anamnesis->'care_line_ids') = 'array' THEN s.anamnesis->'care_line_ids'
                ELSE '[]'::jsonb
              END
            ) AS id_val
            UNION ALL
            SELECT s.group_id::text WHERE s.group_id IS NOT NULL
          ) u
          WHERE id_val ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        ) extracted_ids
        JOIN public.patient_groups pg ON pg.id = extracted_ids.group_uuid
      ),
      '[]'::jsonb
    ) AS care_lines,
    COALESCE(c.anamnesis_base_schema, '[]'::jsonb) AS anamnesis_base_schema
  FROM public.sessions s
  LEFT JOIN public.clinics c ON c.id = s.clinic_id
  LEFT JOIN public.patients p ON p.id = s.patient_id
  WHERE COALESCE(s.provider_id, s.user_id) = _authenticated_user_id
    AND s.deleted_at IS NULL
    AND (_clinic_id IS NULL OR s.clinic_id = _clinic_id)
    AND (
      -- Atendimento particular (sem clínica associada)
      s.clinic_id IS NULL
      -- Ou o profissional é o titular/proprietário da clínica (acesso ao acervo histórico preservado mesmo se hibernada)
      OR c.account_owner_user_id = _authenticated_user_id
      OR EXISTS (
        SELECT 1 FROM public.clinic_memberships cm_owner
        WHERE cm_owner.clinic_id = s.clinic_id
          AND cm_owner.user_id = _authenticated_user_id
          AND cm_owner.account_role = 'account_owner'
      )
      -- Ou se for clínica de terceiros, o vínculo com a clínica precisa estar ATIVO
      OR EXISTS (
        SELECT 1 FROM public.clinic_memberships cm_active
        WHERE cm_active.clinic_id = s.clinic_id
          AND cm_active.user_id = _authenticated_user_id
          AND cm_active.is_active = true
          AND (cm_active.membership_status = 'active' OR cm_active.status = 'active')
      )
    )
    AND (
      _clean_query IS NULL
      OR s.notes ILIKE ('%' || _clean_query || '%')
      OR s.treatment::text ILIKE ('%' || _clean_query || '%')
      OR s.status ILIKE ('%' || _clean_query || '%')
      OR COALESCE(c.name, '') ILIKE ('%' || _clean_query || '%')
      OR COALESCE(p.name, '') ILIKE ('%' || _clean_query || '%')
      OR public.pseudonymize_patient_name(p.name) ILIKE ('%' || _clean_query || '%')
      OR to_char(s.session_date, 'YYYY-MM-DD') ILIKE ('%' || _clean_query || '%')
    )
  ORDER BY s.session_date DESC, s.created_at DESC
  LIMIT _sanitized_limit
  OFFSET _sanitized_offset;
END;
$$;

-- [RPC/FUNCTION] get_session_share_recipients (schema.sql L5326-L5355)
CREATE OR REPLACE FUNCTION "public"."get_session_share_recipients"("_session_id" "uuid") RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    json_agg(
      json_build_object(
        'id', session_shares.shared_with_user_id,
        'full_name', profiles.full_name,
        'email', profiles.email,
        'job_title', profiles.job_title,
        'operational_role', clinic_memberships.operational_role,
        'access_level', session_shares.access_level,
        'shared_by_user_id', session_shares.shared_by_user_id,
        'created_at', session_shares.created_at
      )
      order by profiles.full_name nulls last, profiles.email
    ),
    '[]'::json
  )
  from public.session_shares
  join public.profiles
    on profiles.id = session_shares.shared_with_user_id
  left join public.clinic_memberships
    on clinic_memberships.clinic_id = session_shares.clinic_id
    and clinic_memberships.user_id = session_shares.shared_with_user_id
  where session_shares.session_id = _session_id
    and session_shares.revoked_at is null
    and public.can_read_session(_session_id);
$$;

-- [RPC/FUNCTION] get_session_share_summary (schema.sql L5361-L5399)
CREATE OR REPLACE FUNCTION "public"."get_session_share_summary"("_session_ids" "uuid"[]) RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    json_agg(
      json_build_object(
        'session_id', summaries.session_id,
        'share_count', summaries.share_count,
        'recipients', summaries.recipients
      )
      order by summaries.session_id
    ),
    '[]'::json
  )
  from (
    select
      session_shares.session_id,
      count(*)::int as share_count,
      json_agg(
        json_build_object(
          'id', session_shares.shared_with_user_id,
          'full_name', profiles.full_name,
          'email', profiles.email,
          'job_title', profiles.job_title,
          'access_level', session_shares.access_level,
          'created_at', session_shares.created_at
        )
        order by profiles.full_name nulls last, profiles.email
      ) as recipients
    from public.session_shares
    left join public.profiles
      on profiles.id = session_shares.shared_with_user_id
    where session_shares.session_id = any(_session_ids)
      and session_shares.revoked_at is null
      and public.can_read_session(session_shares.session_id)
    group by session_shares.session_id
  ) as summaries;
$$;

-- [RPC/FUNCTION] log_session_edit_history (schema.sql L7632-L7720)
CREATE OR REPLACE FUNCTION "public"."log_session_edit_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  _changed text[] := ARRAY[]::text[];
  _old_snap jsonb := '{}'::jsonb;
  _new_snap jsonb := '{}'::jsonb;
  _actor_id uuid;
BEGIN
  _actor_id := auth.uid();
  IF _actor_id IS NULL THEN
    _actor_id := NEW.user_id;
  END IF;

  IF _actor_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.notes IS DISTINCT FROM NEW.notes THEN
    _changed := array_append(_changed, 'notes');
    _old_snap := _old_snap || jsonb_build_object('notes', OLD.notes);
    _new_snap := _new_snap || jsonb_build_object('notes', NEW.notes);
  END IF;

  IF OLD.anamnesis IS DISTINCT FROM NEW.anamnesis THEN
    _changed := array_append(_changed, 'anamnesis');
    _old_snap := _old_snap || jsonb_build_object('anamnesis', OLD.anamnesis);
    _new_snap := _new_snap || jsonb_build_object('anamnesis', NEW.anamnesis);
  END IF;

  IF OLD.treatment IS DISTINCT FROM NEW.treatment THEN
    _changed := array_append(_changed, 'treatment');
    _old_snap := _old_snap || jsonb_build_object('treatment', OLD.treatment);
    _new_snap := _new_snap || jsonb_build_object('treatment', NEW.treatment);
  END IF;

  IF OLD.anamnesis_form_response IS DISTINCT FROM NEW.anamnesis_form_response THEN
    _changed := array_append(_changed, 'anamnesis_form_response');
    _old_snap := _old_snap || jsonb_build_object('anamnesis_form_response', OLD.anamnesis_form_response);
    _new_snap := _new_snap || jsonb_build_object('anamnesis_form_response', NEW.anamnesis_form_response);
  END IF;

  IF OLD.pain_score IS DISTINCT FROM NEW.pain_score THEN
    _changed := array_append(_changed, 'pain_score');
    _old_snap := _old_snap || jsonb_build_object('pain_score', OLD.pain_score);
    _new_snap := _new_snap || jsonb_build_object('pain_score', NEW.pain_score);
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    _changed := array_append(_changed, 'status');
    _old_snap := _old_snap || jsonb_build_object('status', OLD.status);
    _new_snap := _new_snap || jsonb_build_object('status', NEW.status);
  END IF;

  IF OLD.session_date IS DISTINCT FROM NEW.session_date THEN
    _changed := array_append(_changed, 'session_date');
    _old_snap := _old_snap || jsonb_build_object('session_date', OLD.session_date);
    _new_snap := _new_snap || jsonb_build_object('session_date', NEW.session_date);
  END IF;

  IF cardinality(_changed) > 0 THEN
    BEGIN
      INSERT INTO public.session_edit_history (
        session_id,
        clinic_id,
        editor_user_id,
        old_data,
        new_data,
        changed_fields,
        edited_at
      )
      VALUES (
        NEW.id,
        NEW.clinic_id,
        _actor_id,
        _old_snap,
        _new_snap,
        _changed,
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Falha ao registrar session_edit_history para session_id %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] notify_clinic_access_session_created (schema.sql L7984-L8029)
CREATE OR REPLACE FUNCTION "public"."notify_clinic_access_session_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _actor_name text;
  _recipient record;
BEGIN
  IF NEW.clinic_id IS NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO _actor_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  FOR _recipient IN
    SELECT clinic_memberships.user_id
    FROM public.clinic_memberships
    WHERE clinic_memberships.clinic_id = NEW.clinic_id
      AND clinic_memberships.is_active = true
      AND clinic_memberships.membership_status = 'active'
      AND clinic_memberships.user_id <> NEW.user_id
      AND (
        clinic_memberships.account_role = 'account_owner'
        OR clinic_memberships.operational_role IN ('owner', 'admin')
      )
  LOOP
    PERFORM public.create_user_notification(
      _recipient.user_id,
      NEW.clinic_id,
      NEW.user_id,
      'clinic_access',
      'clinic_user_accessed',
      'Usuário acessou a clínica',
      COALESCE(_actor_name, 'Um usuário') || ' acessou a clínica.',
      NULL,
      NULL,
      jsonb_build_object('security_session_id', NEW.id, 'device_label', NEW.device_label),
      NULL
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] notify_session_created (schema.sql L8122-L8177)
CREATE OR REPLACE FUNCTION "public"."notify_session_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _clinic_route_key text;
  _patient_name text;
  _actor_name text;
  _recipient record;
BEGIN
  IF NEW.clinic_id IS NULL OR NEW.user_id IS NULL OR NEW.status = 'rascunho' THEN
    RETURN NEW;
  END IF;

  SELECT route_key INTO _clinic_route_key
  FROM public.clinics
  WHERE id = NEW.clinic_id;

  SELECT name INTO _patient_name
  FROM public.patients
  WHERE id = NEW.patient_id;

  SELECT full_name INTO _actor_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  FOR _recipient IN
    SELECT clinic_memberships.user_id
    FROM public.clinic_memberships
    WHERE clinic_memberships.clinic_id = NEW.clinic_id
      AND clinic_memberships.is_active = true
      AND clinic_memberships.membership_status = 'active'
      AND clinic_memberships.user_id <> NEW.user_id
  LOOP
    PERFORM public.create_user_notification(
      _recipient.user_id,
      NEW.clinic_id,
      NEW.user_id,
      'session',
      'session_created',
      'Atendimento registrado',
      COALESCE(_actor_name, 'Um usuário') || ' registrou um atendimento' ||
        CASE WHEN _patient_name IS NOT NULL THEN ' de ' || _patient_name ELSE '' END || '.',
      'Abrir atendimento',
      CASE
        WHEN _clinic_route_key IS NULL THEN NULL
        ELSE '/clinica/' || _clinic_route_key || '/pacientes/' || NEW.patient_id::text || '/sessao/' || NEW.id::text
      END,
      jsonb_build_object('session_id', NEW.id, 'patient_id', NEW.patient_id),
      NULL
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] register_current_security_session (schema.sql L8482-L8653)
CREATE OR REPLACE FUNCTION "public"."register_current_security_session"("_session_key" "text", "_browser" "text" DEFAULT NULL::"text", "_platform" "text" DEFAULT NULL::"text", "_device_label" "text" DEFAULT NULL::"text", "_user_agent" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _clinic_id uuid := public.get_user_clinic_id(_user_id);
  _existing_row public.user_security_sessions%ROWTYPE;
  _reactivated boolean := false;
  _is_different_device boolean := false;
  _should_notify boolean := false;
  _was_offline boolean := false;
  _normalized_device_label text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF NULLIF(trim(COALESCE(_session_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida.';
  END IF;

  PERFORM public.cleanup_user_security_sessions(_user_id);

  _normalized_device_label := COALESCE(
    NULLIF(trim(_device_label), ''),
    NULLIF(trim(CONCAT_WS(' • ', NULLIF(trim(_browser), ''), NULLIF(trim(_platform), ''))), ''),
    'Dispositivo desconhecido'
  );

  SELECT *
  INTO _existing_row
  FROM public.user_security_sessions
  WHERE session_key = _session_key
  LIMIT 1;

  IF FOUND AND _existing_row.user_id <> _user_id THEN
    RAISE EXCEPTION 'Sessao invalida.';
  END IF;

  IF FOUND AND _existing_row.force_signed_out_at IS NOT NULL THEN
    RAISE EXCEPTION 'Sessao encerrada pela administracao da clinica. Entre novamente para continuar.';
  END IF;

  IF NOT FOUND THEN
    BEGIN
      INSERT INTO public.user_security_sessions (
        user_id,
        clinic_id,
        session_key,
        browser,
        platform,
        device_label,
        user_agent
      )
      VALUES (
        _user_id,
        _clinic_id,
        _session_key,
        NULLIF(trim(_browser), ''),
        NULLIF(trim(_platform), ''),
        _normalized_device_label,
        NULLIF(trim(_user_agent), '')
      )
      RETURNING * INTO _existing_row;

      _reactivated := true;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT *
        INTO _existing_row
        FROM public.user_security_sessions
        WHERE session_key = _session_key
        LIMIT 1;

        IF NOT FOUND OR _existing_row.user_id <> _user_id THEN
          RAISE EXCEPTION 'Sessao invalida.';
        END IF;

        _reactivated := _existing_row.ended_at IS NOT NULL;
    END;
  ELSE
    _reactivated := _existing_row.ended_at IS NOT NULL;
  END IF;

  -- Atualizar a sessão atual
  UPDATE public.user_security_sessions
  SET
    clinic_id = COALESCE(_clinic_id, clinic_id),
    browser = COALESCE(NULLIF(trim(_browser), ''), browser),
    platform = COALESCE(NULLIF(trim(_platform), ''), platform),
    device_label = COALESCE(_normalized_device_label, device_label),
    user_agent = COALESCE(NULLIF(trim(_user_agent), ''), user_agent),
    signed_in_at = CASE WHEN _reactivated THEN now() ELSE signed_in_at END,
    ended_at = NULL,
    force_signed_out_at = NULL,
    forced_out_by = NULL,
    last_seen_at = now(),
    updated_at = now()
  WHERE id = _existing_row.id
  RETURNING * INTO _existing_row;

  -- 1. Alerta de Segurança: Notificar APENAS se for login em NOVO / OUTRO dispositivo
  IF _reactivated THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_security_sessions
      WHERE user_id = _user_id
        AND id <> _existing_row.id
        AND (
          COALESCE(platform, '') <> COALESCE(NULLIF(trim(_platform), ''), '')
          OR COALESCE(browser, '') <> COALESCE(NULLIF(trim(_browser), ''), '')
        )
    ) INTO _is_different_device;

    IF _is_different_device THEN
      SELECT NOT EXISTS (
        SELECT 1
        FROM public.security_events
        WHERE target_user_id = _user_id
          AND event_type = 'session_started'
          AND created_at > now() - INTERVAL '24 hours'
          AND (
            COALESCE(payload->>'platform', '') = COALESCE(NULLIF(trim(_platform), ''), '')
            AND COALESCE(payload->>'browser', '') = COALESCE(NULLIF(trim(_browser), ''), '')
          )
      ) INTO _should_notify;

      IF _should_notify THEN
        PERFORM public.log_security_event(
          _clinic_id,
          _user_id,
          _user_id,
          'session_started',
          'self',
          jsonb_build_object(
            'browser', NULLIF(trim(_browser), ''),
            'platform', NULLIF(trim(_platform), ''),
            'device_label', _normalized_device_label,
            'user_agent', NULLIF(trim(_user_agent), ''),
            'session_key', _session_key,
            'is_new_device', true
          )
        );
      END IF;
    END IF;
  END IF;

  -- 2. Presença de Equipe: Notificar outros membros da clínica se o usuário ficou ONLINE
  IF _clinic_id IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1
      FROM public.user_security_sessions
      WHERE user_id = _user_id
        AND clinic_id = _clinic_id
        AND id <> _existing_row.id
        AND ended_at IS NULL
        AND force_signed_out_at IS NULL
        AND last_seen_at >= now() - INTERVAL '5 minutes'
    ) INTO _was_offline;

    IF _was_offline THEN
      PERFORM public.notify_clinic_collaborator_presence(_clinic_id, _user_id, 'online');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'session_id', _existing_row.id,
    'user_id', _user_id
  );
END;
$$;

-- [RPC/FUNCTION] revoke_session_share (schema.sql L8833-L8861)
CREATE OR REPLACE FUNCTION "public"."revoke_session_share"("_session_id" "uuid", "_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _updated_count integer := 0;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.can_share_session(_session_id) THEN
    RAISE EXCEPTION 'Sem permissão para remover compartilhamento';
  END IF;

  UPDATE public.session_shares
  SET
    revoked_at = now(),
    revoked_by_user_id = _actor_id
  WHERE session_id = _session_id
    AND shared_with_user_id = _user_id
    AND revoked_at IS NULL;

  GET DIAGNOSTICS _updated_count = ROW_COUNT;

  RETURN json_build_object('revoked_count', _updated_count);
END;
$$;

-- [RPC/FUNCTION] share_sessions_with_collaborators (schema.sql L8966-L9048)
CREATE OR REPLACE FUNCTION "public"."share_sessions_with_collaborators"("_session_ids" "uuid"[], "_user_ids" "uuid"[], "_access_level" "text" DEFAULT 'can_evolve'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _actor_id uuid := auth.uid();
  _session_id uuid;
  _target_user_id uuid;
  _session public.sessions%rowtype;
  _inserted_count integer := 0;
  _row_count integer := 0;
  _level text := coalesce(_access_level, 'can_evolve');
begin
  if _actor_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if coalesce(array_length(_session_ids, 1), 0) = 0 or coalesce(array_length(_user_ids, 1), 0) = 0 then
    return json_build_object('shared_count', 0);
  end if;

  if _level not in ('read', 'read_only', 'can_evolve') then
    _level := 'can_evolve';
  end if;

  for _session_id in
    select distinct item
    from unnest(_session_ids) as item
    where item is not null
  loop
    select *
    into _session
    from public.sessions
    where id = _session_id;

    if _session.id is null or _session.clinic_id is null then
      raise exception 'Ficha de atendimento não encontrada';
    end if;

    if not public.can_share_session(_session.id) then
      raise exception 'Sem permissão para compartilhar uma ou mais fichas';
    end if;

    for _target_user_id in
      select distinct item
      from unnest(_user_ids) as item
      where item is not null
    loop
      if _target_user_id = _session.user_id or _target_user_id = _session.provider_id then
        continue;
      end if;

      if not public.is_active_clinic_member(_session.clinic_id, _target_user_id) then
        raise exception 'Um dos colaboradores selecionados não pertence à clínica';
      end if;

      insert into public.session_shares (
        clinic_id,
        session_id,
        shared_with_user_id,
        shared_by_user_id,
        access_level
      )
      values (
        _session.clinic_id,
        _session.id,
        _target_user_id,
        _actor_id,
        _level
      )
      on conflict (session_id, shared_with_user_id) where revoked_at is null do update
      set access_level = excluded.access_level,
          shared_by_user_id = excluded.shared_by_user_id,
          created_at = now();

      get diagnostics _row_count = row_count;
      _inserted_count := _inserted_count + _row_count;
    end loop;
  end loop;

  return json_build_object('shared_count', _inserted_count);
end;
$$;

-- [TABLE] platform_clinic_access_sessions (schema.sql L11989-L11997)
CREATE TABLE IF NOT EXISTS "public"."platform_clinic_access_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [TABLE] session_edit_history (schema.sql L12112-L12123)
CREATE TABLE IF NOT EXISTS "public"."session_edit_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "clinic_id" "uuid",
    "editor_user_id" "uuid" NOT NULL,
    "old_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "new_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "changed_fields" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "change_reason" "text",
    "ip_address" "text",
    "edited_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [TABLE] session_shares (schema.sql L12129-L12140)
CREATE TABLE IF NOT EXISTS "public"."session_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "shared_with_user_id" "uuid" NOT NULL,
    "shared_by_user_id" "uuid" NOT NULL,
    "access_level" "text" DEFAULT 'read'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_by_user_id" "uuid",
    CONSTRAINT "session_shares_access_level_check" CHECK (("access_level" = ANY (ARRAY['read'::"text", 'read_only'::"text", 'can_evolve'::"text"])))
);

-- [TABLE] sessions (schema.sql L12146-L12191)
CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "group_id" "uuid",
    "session_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'rascunho'::"text" NOT NULL,
    "anamnesis" "jsonb" DEFAULT '{}'::"jsonb",
    "treatment" "jsonb" DEFAULT '{}'::"jsonb",
    "pain_score" integer DEFAULT 0,
    "complexity_score" integer DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "clinic_id" "uuid",
    "anamnesis_template_id" "uuid",
    "anamnesis_form_response" "jsonb" DEFAULT '{}'::"jsonb",
    "provider_id" "uuid",
    "scheduled_start_at" timestamp with time zone,
    "patient_arrived_at" timestamp with time zone,
    "payment_status" "text" DEFAULT 'nao_cobrado'::"text" NOT NULL,
    "amount_charged_cents" integer DEFAULT 0 NOT NULL,
    "amount_paid_cents" integer DEFAULT 0 NOT NULL,
    "amount_original_cents" integer DEFAULT 0 NOT NULL,
    "payment_adjustment_reason" "text",
    "payment_status_date" "date",
    "payment_method" "text" DEFAULT 'nao_informado'::"text" NOT NULL,
    "payment_installments" smallint DEFAULT 1 NOT NULL,
    "payment_plan_id" "uuid",
    "payment_plan_session_index" integer,
    "parent_session_id" "uuid",
    "evolution_group_id" "uuid",
    CONSTRAINT "sessions_amount_charged_cents_nonnegative" CHECK (("amount_charged_cents" >= 0)),
    CONSTRAINT "sessions_amount_charged_cents_reasonable" CHECK ((("amount_charged_cents" >= 0) AND ("amount_charged_cents" <= 10000000))),
    CONSTRAINT "sessions_amount_original_cents_range" CHECK ((("amount_original_cents" >= 0) AND ("amount_original_cents" <= 10000000))),
    CONSTRAINT "sessions_amount_paid_cents_nonnegative" CHECK (("amount_paid_cents" >= 0)),
    CONSTRAINT "sessions_amount_paid_cents_reasonable" CHECK ((("amount_paid_cents" >= 0) AND ("amount_paid_cents" <= 10000000))),
    CONSTRAINT "sessions_patient_arrived_at_reasonable" CHECK ((("patient_arrived_at" IS NULL) OR (("patient_arrived_at" >= '2000-01-01 00:00:00+00'::timestamp with time zone) AND ("patient_arrived_at" < '2101-01-01 00:00:00+00'::timestamp with time zone)))),
    CONSTRAINT "sessions_payment_adjustment_reason_length" CHECK ((("payment_adjustment_reason" IS NULL) OR ("char_length"("payment_adjustment_reason") <= 240))),
    CONSTRAINT "sessions_payment_installments_range" CHECK ((("payment_installments" >= 1) AND ("payment_installments" <= 12))),
    CONSTRAINT "sessions_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['dinheiro'::"text", 'pix'::"text", 'cartao_debito'::"text", 'cartao_credito'::"text", 'convenio'::"text", 'transferencia'::"text", 'credito_usado'::"text", 'cortesia'::"text", 'nao_informado'::"text"]))),
    CONSTRAINT "sessions_payment_plan_session_index_check" CHECK ((("payment_plan_session_index" IS NULL) OR ("payment_plan_session_index" >= 1))),
    CONSTRAINT "sessions_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['nao_cobrado'::"text", 'pendente'::"text", 'parcial'::"text", 'pago'::"text", 'credito'::"text", 'cortesia'::"text"]))),
    CONSTRAINT "sessions_payment_status_date_range" CHECK ((("payment_status_date" IS NULL) OR (("payment_status_date" >= '2000-01-01'::"date") AND ("payment_status_date" <= '2100-12-31'::"date")))),
    CONSTRAINT "sessions_scheduled_start_at_reasonable" CHECK ((("scheduled_start_at" IS NULL) OR (("scheduled_start_at" >= '2000-01-01 00:00:00+00'::timestamp with time zone) AND ("scheduled_start_at" < '2101-01-01 00:00:00+00'::timestamp with time zone))))
);

-- [TABLE] user_security_sessions (schema.sql L12380-L12396)
CREATE TABLE IF NOT EXISTS "public"."user_security_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "clinic_id" "uuid",
    "session_key" "text" NOT NULL,
    "browser" "text",
    "platform" "text",
    "device_label" "text",
    "user_agent" "text",
    "signed_in_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "force_signed_out_at" timestamp with time zone,
    "forced_out_by" "uuid"
);

-- [POLICY] Platform owners read support sessions ON platform_clinic_access_sessions (schema.sql L14211-L14211)
CREATE POLICY "Platform owners read support sessions" ON "public"."platform_clinic_access_sessions" FOR SELECT TO "authenticated" USING (("public"."is_platform_owner_mfa_verified"("auth"."uid"()) AND ("actor_user_id" = "auth"."uid"())));

-- [POLICY] Super admins manage all sessions ON sessions (schema.sql L14251-L14251)
CREATE POLICY "Super admins manage all sessions" ON "public"."sessions" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));

-- [POLICY] Users delete clinic draft sessions ON sessions (schema.sql L14287-L14289)
CREATE POLICY "Users delete clinic draft sessions" ON "public"."sessions" FOR DELETE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('session.delete_draft'::"text", "clinic_id") AND ("public"."current_user_is_clinic_manager"("clinic_id") OR (("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."clinic_memberships"
  WHERE (("clinic_memberships"."clinic_id" = "sessions"."clinic_id") AND ("clinic_memberships"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("clinic_memberships"."is_active" = true) AND ("clinic_memberships"."membership_status" = 'active'::"public"."membership_status_type"))))))));

-- [POLICY] Users insert allowed session shares ON session_shares (schema.sql L14309-L14309)
CREATE POLICY "Users insert allowed session shares" ON "public"."session_shares" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid"))) AND ("shared_by_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("revoked_at" IS NULL) AND "public"."can_share_session"("session_id") AND "public"."is_active_clinic_member"("clinic_id", "shared_with_user_id")));

-- [POLICY] Users insert clinic session edit history ON session_edit_history (schema.sql L14313-L14313)
CREATE POLICY "Users insert clinic session edit history" ON "public"."session_edit_history" FOR INSERT WITH CHECK ((("editor_user_id" = "auth"."uid"()) AND ("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())) AND "public"."current_user_can"('sessions.write'::"text", "clinic_id")));

-- [POLICY] Users insert clinic sessions ON sessions (schema.sql L14317-L14317)
CREATE POLICY "Users insert clinic sessions" ON "public"."sessions" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('sessions.write'::"text", "clinic_id")));

-- [POLICY] Users read clinic session edit history ON session_edit_history (schema.sql L14372-L14372)
CREATE POLICY "Users read clinic session edit history" ON "public"."session_edit_history" FOR SELECT USING ((("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())) OR ("editor_user_id" = "auth"."uid"()) OR ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"))));

-- [POLICY] Users insert clinic session edit history ON session_edit_history (schema.sql L14374-L14374)
CREATE POLICY "Users insert clinic session edit history" ON "public"."session_edit_history" FOR INSERT TO "authenticated" WITH CHECK ((("editor_user_id" = "auth"."uid"()) OR ("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())) OR ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) OR true));

-- [POLICY] Users read clinic sessions ON sessions (schema.sql L14378-L14378)
CREATE POLICY "Users read clinic sessions" ON "public"."sessions" FOR SELECT TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND "public"."can_read_clinic_data"("clinic_id") AND "public"."current_user_can"('sessions.read'::"text", "clinic_id")));

-- [POLICY] Users read session shares they can access ON session_shares (schema.sql L14422-L14422)
CREATE POLICY "Users read session shares they can access" ON "public"."session_shares" FOR SELECT TO "authenticated" USING ((("clinic_id" = "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid"))) AND "public"."can_read_session"("session_id")));

-- [POLICY] Users update clinic sessions ON sessions (schema.sql L14438-L14438)
CREATE POLICY "Users update clinic sessions" ON "public"."sessions" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('sessions.write'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('sessions.write'::"text", "clinic_id")));

-- [POLICY] users can read own security sessions ON user_security_sessions (schema.sql L14694-L14694)
CREATE POLICY "users can read own security sessions" ON "public"."user_security_sessions" FOR SELECT USING (("user_id" = "auth"."uid"()));

-- [TABLE] whatsapp_chat_sessions (schema.sql L16057-L16070)
CREATE TABLE IF NOT EXISTS public.whatsapp_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
    current_step TEXT NOT NULL DEFAULT 'initial',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    authenticated_at TIMESTAMPTZ DEFAULT NULL,
    auth_expires_at TIMESTAMPTZ DEFAULT NULL,
    is_authenticated BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- [RPC/FUNCTION] reset_whatsapp_chat_sessions (schema.sql L16184-L16189)
CREATE OR REPLACE FUNCTION public.reset_whatsapp_chat_sessions(
    _phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
