-- ==========================================================================
-- DOMÍNIO: CORE_MISC (Gerado automaticamente por npm run schema:index)
-- Fonte SSOT: supabase/schema.sql
-- ==========================================================================

-- [RPC/FUNCTION] batch_sync_push (schema.sql L1272-L1421)
CREATE OR REPLACE FUNCTION "public"."batch_sync_push"("_mutations" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  _item jsonb;
  _table text;
  _action text;
  _id uuid;
  _expected_version integer;
  _current_version integer;
  _data jsonb;
  _results jsonb := '[]'::jsonb;
  _user_id uuid := auth.uid();
  _applied_count integer := 0;
  _conflict_count integer := 0;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF _mutations IS NULL OR jsonb_typeof(_mutations) <> 'array' THEN
    RAISE EXCEPTION 'Payload inválido: array esperado.';
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_mutations)
  LOOP
    _table := _item->>'table';
    _action := _item->>'action'; -- 'upsert' ou 'delete'
    _id := (_item->>'id')::uuid;
    _expected_version := (_item->>'expected_version')::integer;
    _data := COALESCE(_item->'data', '{}'::jsonb);

    IF _table = 'sessions' THEN
      IF _action = 'delete' THEN
        UPDATE public.sessions
        SET deleted_at = now(), deleted_by_user_id = _user_id
        WHERE id = _id AND deleted_at IS NULL;

        _applied_count := _applied_count + 1;
        _results := _results || jsonb_build_object('id', _id, 'status', 'deleted');
      ELSE
        -- Checagem de versão concorrente
        SELECT version INTO _current_version FROM public.sessions WHERE id = _id;

        IF _current_version IS NOT NULL AND _expected_version IS NOT NULL AND _current_version > _expected_version THEN
          _conflict_count := _conflict_count + 1;
          _results := _results || jsonb_build_object('id', _id, 'status', 'conflict', 'server_version', _current_version);
        ELSE
          -- Executar update ou insert seguro
          IF _current_version IS NOT NULL THEN
            UPDATE public.sessions
            SET
              notes = COALESCE(_data->>'notes', notes),
              status = COALESCE(_data->>'status', status),
              pain_score = COALESCE((_data->>'pain_score')::integer, pain_score),
              anamnesis = CASE WHEN _data ? 'anamnesis' THEN _data->'anamnesis' ELSE anamnesis END,
              treatment = CASE WHEN _data ? 'treatment' THEN _data->'treatment' ELSE treatment END,
              updated_at = now()
            WHERE id = _id;
          ELSE
            INSERT INTO public.sessions (
              id,
              user_id,
              patient_id,
              clinic_id,
              session_date,
              notes,
              status,
              pain_score,
              anamnesis,
              treatment
            )
            VALUES (
              _id,
              _user_id,
              (_data->>'patient_id')::uuid,
              (_data->>'clinic_id')::uuid,
              COALESCE((_data->>'session_date')::timestamptz, now()),
              _data->>'notes',
              COALESCE(_data->>'status', 'rascunho'),
              COALESCE((_data->>'pain_score')::integer, 0),
              _data->'anamnesis',
              _data->'treatment'
            );
          END IF;

          _applied_count := _applied_count + 1;
          _results := _results || jsonb_build_object('id', _id, 'status', 'applied');
        END IF;
      END IF;

    ELSIF _table = 'agenda_events' THEN
      IF _action = 'delete' THEN
        DELETE FROM public.agenda_events WHERE id = _id;
        _applied_count := _applied_count + 1;
        _results := _results || jsonb_build_object('id', _id, 'status', 'deleted');
      ELSE
        SELECT version INTO _current_version FROM public.agenda_events WHERE id = _id;

        IF _current_version IS NOT NULL AND _expected_version IS NOT NULL AND _current_version > _expected_version THEN
          _conflict_count := _conflict_count + 1;
          _results := _results || jsonb_build_object('id', _id, 'status', 'conflict', 'server_version', _current_version);
        ELSE
          IF _current_version IS NOT NULL THEN
            UPDATE public.agenda_events
            SET
              title = COALESCE(_data->>'title', title),
              scheduled_for = COALESCE((_data->>'scheduled_for')::timestamptz, scheduled_for),
              status = COALESCE(_data->>'status', status),
              updated_at = now()
            WHERE id = _id;
          ELSE
            INSERT INTO public.agenda_events (
              id,
              user_id,
              clinic_id,
              patient_id,
              title,
              scheduled_for,
              event_type,
              status
            )
            VALUES (
              _id,
              _user_id,
              (_data->>'clinic_id')::uuid,
              (_data->>'patient_id')::uuid,
              COALESCE(_data->>'title', 'Consulta'),
              COALESCE((_data->>'scheduled_for')::timestamptz, now()),
              COALESCE(_data->>'event_type', 'atendimento'),
              COALESCE(_data->>'status', 'agendado')
            );
          END IF;

          _applied_count := _applied_count + 1;
          _results := _results || jsonb_build_object('id', _id, 'status', 'applied');
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'applied_count', _applied_count,
    'conflict_count', _conflict_count,
    'results', _results
  );
END;
$$;

-- [RPC/FUNCTION] custom_access_token_hook (schema.sql L3478-L3516)
CREATE OR REPLACE FUNCTION "public"."custom_access_token_hook"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  _user_id uuid;
  _claims jsonb;
  _active_clinic_id uuid;
  _role text;
  _is_owner boolean := false;
BEGIN
  _user_id := (event->>'user_id')::uuid;
  _claims := COALESCE(event->'claims', '{}'::jsonb);

  IF _user_id IS NOT NULL THEN
    _active_clinic_id := public.get_user_clinic_id(_user_id);

    IF _active_clinic_id IS NOT NULL THEN
      SELECT 
        operational_role::text,
        (account_role = 'account_owner' OR operational_role = 'owner')
      INTO _role, _is_owner
      FROM public.clinic_memberships
      WHERE user_id = _user_id 
        AND clinic_id = _active_clinic_id
        AND is_active = true
        AND membership_status = 'active'
      LIMIT 1;

      _claims := jsonb_set(_claims, '{active_clinic_id}', to_jsonb(_active_clinic_id::text));
      _claims := jsonb_set(_claims, '{operational_role}', to_jsonb(COALESCE(_role, 'professional')));
      _claims := jsonb_set(_claims, '{is_clinic_owner}', to_jsonb(COALESCE(_is_owner, false)));
    END IF;
  END IF;

  event := jsonb_set(event, '{claims}', _claims);
  RETURN event;
END;
$$;

-- [RPC/FUNCTION] generate_uuidv7 (schema.sql L4497-L4527)
CREATE OR REPLACE FUNCTION "public"."generate_uuidv7"() RETURNS "uuid"
    LANGUAGE "plpgsql" PARALLEL SAFE
    AS $$
DECLARE
  unix_time_ms bigint;
  uuid_bytes bytea;
BEGIN
  -- 48 bits de timestamp Unix em milissegundos
  unix_time_ms := (extract(epoch from clock_timestamp()) * 1000)::bigint;

  -- 16 bytes: 6 bytes tempo + 10 bytes aleatórios
  uuid_bytes := set_byte(
    set_byte(
      gen_random_bytes(16),
      0, (unix_time_ms >> 40)::int
    ),
    1, (unix_time_ms >> 32)::int
  );
  uuid_bytes := set_byte(uuid_bytes, 2, (unix_time_ms >> 24)::int);
  uuid_bytes := set_byte(uuid_bytes, 3, (unix_time_ms >> 16)::int);
  uuid_bytes := set_byte(uuid_bytes, 4, (unix_time_ms >> 8)::int);
  uuid_bytes := set_byte(uuid_bytes, 5, unix_time_ms::int);

  -- Versão 7 nos bits 48-51
  uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112);
  -- Variante RFC 4122/9562 nos bits 64-65
  uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128);

  RETURN encode(uuid_bytes, 'hex')::uuid;
END;
$$;

-- [RPC/FUNCTION] normalize_br_phone_key (schema.sql L7265-L7284)
CREATE OR REPLACE FUNCTION "public"."normalize_br_phone_key"("p_phone" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_digits text;
BEGIN
    v_digits := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
    IF v_digits = '' THEN
        RETURN NULL;
    END IF;
    IF length(v_digits) IN (12, 13) AND left(v_digits, 2) = '55' THEN
        RETURN substring(v_digits FROM 3);
    END IF;
    IF length(v_digits) > 11 THEN
        RETURN right(v_digits, 11);
    END IF;
    RETURN v_digits;
END;
$$;

-- [RPC/FUNCTION] sync_meeting_to_auto_leads (schema.sql L7374-L7422)
CREATE OR REPLACE FUNCTION "public"."sync_meeting_to_auto_leads"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_phone_key text;
    v_channel text;
    v_booked_by text;
BEGIN
    v_phone_key := public.normalize_br_phone_key(NEW.phone);

    v_channel := CASE
        WHEN NEW.whatsapp_line = '5511960474566' OR COALESCE(NEW.confirmation_channel, '') ILIKE '%960474566%' OR COALESCE(NEW.origin, '') ILIKE '%bot%' OR COALESCE(NEW.notes, '') ILIKE '%whatsapp bot%' THEN 'whatsapp_bot_5511960474566'
        WHEN NEW.whatsapp_line = '5511980113936' OR COALESCE(NEW.confirmation_channel, '') ILIKE '%980113936%' OR COALESCE(NEW.origin, '') ILIKE '%commercial%' OR COALESCE(NEW.origin, '') ILIKE '%comercial%' THEN 'whatsapp_commercial_5511980113936'
        ELSE 'backoffice_agenda'
    END;

    v_booked_by := COALESCE(
        NULLIF(btrim(NEW.booked_by_name), ''),
        CASE
            WHEN v_channel = 'whatsapp_bot_5511960474566' THEN NEW.lead_name || ' (Bot +55 11 96047-4566)'
            WHEN v_channel = 'whatsapp_commercial_5511980113936' THEN 'Equipe Comercial (+55 11 98011-3936)'
            ELSE 'Backoffice Master'
        END
    );

    UPDATE public.platform_auto_leads
    SET
        meeting_id = NEW.id,
        meeting_status = NEW.status,
        meeting_scheduled_at = NEW.scheduled_at,
        meeting_duration_minutes = NEW.duration_minutes,
        meeting_channel = v_channel,
        meeting_booked_by = v_booked_by,
        stage = CASE
            WHEN stage IN ('new', 'qualified', 'assigned', 'contacted', 'replied') AND NEW.status IN ('scheduled', 'rescheduled') THEN 'meeting_scheduled'
            ELSE stage
        END,
        updated_at = now()
    WHERE deleted_at IS NULL
      AND (
          (NEW.auto_lead_id IS NOT NULL AND id = NEW.auto_lead_id)
          OR (v_phone_key IS NOT NULL AND normalized_phone_key = v_phone_key)
          OR (NEW.email IS NOT NULL AND btrim(NEW.email) <> '' AND lower(COALESCE(email, '')) = lower(btrim(NEW.email)))
      );

    RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] move_entity_to_trash (schema.sql L9809-L9926)
CREATE OR REPLACE FUNCTION "public"."move_entity_to_trash"("_entity_type" "text", "_entity_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  _auth_user_id uuid := auth.uid();
  _clean_entity_type text := lower(trim(COALESCE(_entity_type, '')));
  _clinic_id uuid;
  _affected integer := 0;
  _has_session_delete boolean;
  _has_patient_delete boolean;
  _has_forms_manage boolean;
BEGIN
  -- 1. Validação de autenticação
  IF _auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  -- 2. Identificação da clínica ativa
  _clinic_id := COALESCE(
    NULLIF(auth.jwt() ->> 'active_clinic_id', '')::uuid,
    public.get_user_clinic_id(_auth_user_id)
  );

  IF _clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clinica ativa nao identificada para o usuario.';
  END IF;

  IF public.is_clinic_read_only(_clinic_id) THEN
    RAISE EXCEPTION 'Clinica em modo apenas leitura. Operacao nao permitida.';
  END IF;

  IF _entity_ids IS NULL OR cardinality(_entity_ids) = 0 THEN
    RETURN jsonb_build_object('success', true, 'count', 0, 'entity_type', _clean_entity_type);
  END IF;

  -- Proteção contra DoS e contenção de lock em payloads gigantes
  IF cardinality(_entity_ids) > 200 THEN
    RAISE EXCEPTION 'Limite maximo de 200 itens por lote excedido para protecao de infraestrutura.';
  END IF;

  -- 3. Validação e Execução por tipo de entidade
  IF _clean_entity_type IN ('sessions', 'session') THEN
    _clean_entity_type := 'sessions';
    _has_session_delete := public.current_user_can('sessions.delete', _clinic_id) OR public.current_user_is_clinic_manager(_clinic_id);

    -- Se não possui permissão clínica de deleção, exige ser o criador ou prestador de todos os atendimentos
    IF NOT _has_session_delete THEN
      IF EXISTS (
        SELECT 1 FROM public.sessions
        WHERE id = ANY(_entity_ids)
          AND clinic_id = _clinic_id
          AND user_id <> _auth_user_id
          AND (provider_id IS NULL OR provider_id <> _auth_user_id)
      ) THEN
        RAISE EXCEPTION 'Permissao negada: voce so pode mover para a lixeira atendimentos criados ou prestados por voce.';
      END IF;
    END IF;

    UPDATE public.sessions
    SET deleted_at = now(),
        deleted_by_user_id = _auth_user_id
    WHERE id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NULL;
    GET DIAGNOSTICS _affected = ROW_COUNT;

  ELSIF _clean_entity_type IN ('patients', 'patient') THEN
    _clean_entity_type := 'patients';
    _has_patient_delete := public.current_user_can('patients.delete', _clinic_id) OR public.current_user_is_clinic_manager(_clinic_id);

    IF NOT _has_patient_delete THEN
      RAISE EXCEPTION 'Permissao negada: requer permissao patients.delete.';
    END IF;

    UPDATE public.patients
    SET deleted_at = now(),
        deleted_by_user_id = _auth_user_id
    WHERE id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NULL;
    GET DIAGNOSTICS _affected = ROW_COUNT;

    -- Cascata em sessões ativas filhas do paciente
    UPDATE public.sessions
    SET deleted_at = now(),
        deleted_by_user_id = _auth_user_id
    WHERE patient_id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NULL;

  ELSIF _clean_entity_type IN ('forms', 'form', 'anamnesis_forms', 'anamnesis_form_templates') THEN
    _clean_entity_type := 'forms';
    _has_forms_manage := public.current_user_can('forms.manage', _clinic_id) OR public.current_user_is_clinic_manager(_clinic_id);

    IF NOT _has_forms_manage THEN
      RAISE EXCEPTION 'Permissao negada: requer permissao forms.manage.';
    END IF;

    UPDATE public.anamnesis_form_templates
    SET deleted_at = now(),
        deleted_by_user_id = _auth_user_id
    WHERE id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NULL;
    GET DIAGNOSTICS _affected = ROW_COUNT;

  ELSE
    RAISE EXCEPTION 'Tipo de entidade desconhecido para lixeira: %', _entity_type;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'count', _affected,
    'entity_type', _clean_entity_type
  );
END;
$$;

-- [RPC/FUNCTION] purge_expired_operational_data (schema.sql L10622-L10652)
CREATE OR REPLACE FUNCTION "public"."purge_expired_operational_data"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    _purged_telemetry INT := 0;
    _purged_resolved_logs INT := 0;
BEGIN
    -- 1.1. Limpar telemetria com mais de 90 dias
    DELETE FROM public.telemetry_events
    WHERE created_at < (now() - INTERVAL '90 days');
    GET DIAGNOSTICS _purged_telemetry = ROW_COUNT;

    -- 1.2. Limpar logs de erro de plataforma resolvidos com mais de 30 dias
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'platform_error_logs'
    ) THEN
        DELETE FROM public.platform_error_logs
        WHERE resolved = true AND created_at < (now() - INTERVAL '30 days');
        GET DIAGNOSTICS _purged_resolved_logs = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'purged_telemetry_events', _purged_telemetry,
        'purged_resolved_logs', _purged_resolved_logs,
        'executed_at', now()
    );
END;
$$;

-- [RPC/FUNCTION] raise_exception_json (schema.sql L10678-L10684)
CREATE OR REPLACE FUNCTION "public"."raise_exception_json"("_message" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
begin
  raise exception '%', _message;
end;
$$;

-- [RPC/FUNCTION] request_account_recovery_status (schema.sql L11288-L11424)
CREATE OR REPLACE FUNCTION "public"."request_account_recovery_status"("_identifier" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  _trimmed text := trim(coalesce(_identifier, ''));
  _clean_digits text;
  _user_email text;
  _masked_email text;
  _profile_user_id uuid;
  _profile_cpf text;
  _at_pos int;
  _user_part text;
  _domain_part text;
  _masked_user text;
  _first_dot int;
  _domain_name text;
  _domain_tld text;
  _masked_domain text;
BEGIN
  IF _trimmed = '' THEN
    RETURN jsonb_build_object('status', 'invalid_identifier');
  END IF;

  _clean_digits := regexp_replace(_trimmed, '\D', '', 'g');

  -- Se for numérico ou tiver formato de CPF (ex: 11 dígitos numéricos ou sem @ contendo dígitos)
  IF (position('@' in _trimmed) = 0 AND _clean_digits <> '') THEN
    -- Validação básica de tamanho de CPF (deve ter 11 dígitos)
    IF length(_clean_digits) <> 11 THEN
      RETURN jsonb_build_object('status', 'invalid_cpf');
    END IF;

    -- Busca em public.profiles pelo CPF limpo
    SELECT p.id, p.email, p.cpf
    INTO _profile_user_id, _user_email, _profile_cpf
    FROM public.profiles p
    WHERE regexp_replace(coalesce(p.cpf, ''), '\D', '', 'g') = _clean_digits
    LIMIT 1;

    -- Se não achou em profiles pelo CPF
    IF _profile_user_id IS NULL THEN
      RETURN jsonb_build_object('status', 'cpf_not_found');
    END IF;

    -- Se profiles.email for nulo, busca o e-mail em auth.users
    IF _user_email IS NULL OR _user_email = '' THEN
      SELECT lower(u.email)
      INTO _user_email
      FROM auth.users u
      WHERE u.id = _profile_user_id;
    END IF;

    IF _user_email IS NULL OR _user_email = '' THEN
      RETURN jsonb_build_object('status', 'cpf_not_found');
    END IF;

    _user_email := lower(trim(_user_email));

    -- Formata e ofusca o email (ex: j***y@g***.com)
    _at_pos := position('@' in _user_email);
    IF _at_pos > 1 THEN
      _user_part := substring(_user_email from 1 for _at_pos - 1);
      _domain_part := substring(_user_email from _at_pos + 1);

      IF length(_user_part) <= 2 THEN
        _masked_user := substring(_user_part from 1 for 1) || '***';
      ELSE
        _masked_user := substring(_user_part from 1 for 1) || '***' || substring(_user_part from length(_user_part) for 1);
      END IF;

      _first_dot := position('.' in _domain_part);
      IF _first_dot > 1 THEN
        _domain_name := substring(_domain_part from 1 for _first_dot - 1);
        _domain_tld := substring(_domain_part from _first_dot);
        IF length(_domain_name) <= 2 THEN
          _masked_domain := substring(_domain_name from 1 for 1) || '***' || _domain_tld;
        ELSE
          _masked_domain := substring(_domain_name from 1 for 1) || '***' || substring(_domain_name from length(_domain_name) for 1) || _domain_tld;
        END IF;
      ELSE
        _masked_domain := '***';
      END IF;

      _masked_email := _masked_user || '@' || _masked_domain;
    ELSE
      _masked_email := '***@***.com';
    END IF;

    RETURN jsonb_build_object(
      'status', 'cpf_found',
      'email', _user_email,
      'masked_email', _masked_email
    );
  ELSE
    -- Trata como E-mail
    _user_email := lower(_trimmed);

    -- Busca em auth.users ou public.profiles
    SELECT u.id, u.email
    INTO _profile_user_id, _user_email
    FROM auth.users u
    WHERE lower(u.email) = _user_email
    LIMIT 1;

    IF _profile_user_id IS NULL THEN
      SELECT p.id, p.email
      INTO _profile_user_id, _user_email
      FROM public.profiles p
      WHERE lower(p.email) = _user_email
      LIMIT 1;
    END IF;

    IF _profile_user_id IS NULL THEN
      RETURN jsonb_build_object('status', 'email_not_found');
    END IF;

    -- Busca se profiles tem CPF preenchido com 11 dígitos
    SELECT regexp_replace(coalesce(p.cpf, ''), '\D', '', 'g')
    INTO _profile_cpf
    FROM public.profiles p
    WHERE p.id = _profile_user_id;

    IF _profile_cpf IS NOT NULL AND length(_profile_cpf) = 11 THEN
      RETURN jsonb_build_object(
        'status', 'email_found_with_cpf',
        'email', lower(_user_email)
      );
    ELSE
      RETURN jsonb_build_object(
        'status', 'email_found_without_cpf',
        'email', lower(_user_email)
      );
    END IF;
  END IF;
END;
$$;

-- [RPC/FUNCTION] restore_entity_from_trash (schema.sql L11706-L11815)
CREATE OR REPLACE FUNCTION "public"."restore_entity_from_trash"("_entity_type" "text", "_entity_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  _auth_user_id uuid := auth.uid();
  _clean_entity_type text := lower(trim(COALESCE(_entity_type, '')));
  _clinic_id uuid;
  _affected integer := 0;
  _can_restore boolean;
BEGIN
  -- 1. Validação de autenticação
  IF _auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  -- 2. Identificação da clínica ativa
  _clinic_id := COALESCE(
    NULLIF(auth.jwt() ->> 'active_clinic_id', '')::uuid,
    public.get_user_clinic_id(_auth_user_id)
  );

  IF _clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clinica ativa nao identificada para o usuario.';
  END IF;

  IF public.is_clinic_read_only(_clinic_id) THEN
    RAISE EXCEPTION 'Clinica em modo apenas leitura. Operacao nao permitida.';
  END IF;

  -- 3. Validação de permissões: clinic_trash.manage ou role owner/admin
  _can_restore := (
    public.current_user_can('clinic_trash.manage', _clinic_id)
    OR public.current_user_is_clinic_manager(_clinic_id)
    OR EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.user_id = _auth_user_id
        AND cm.clinic_id = _clinic_id
        AND cm.is_active = true
        AND cm.membership_status = 'active'
        AND (cm.account_role = 'account_owner' OR cm.operational_role IN ('owner', 'admin'))
    )
  );

  IF NOT _can_restore THEN
    RAISE EXCEPTION 'Permissao negada para restaurar itens da lixeira. Requer perfil owner ou admin.';
  END IF;

  IF _entity_ids IS NULL OR cardinality(_entity_ids) = 0 THEN
    RETURN jsonb_build_object('success', true, 'count', 0, 'entity_type', _clean_entity_type);
  END IF;

  -- Proteção contra DoS e contenção de lock em payloads gigantes
  IF cardinality(_entity_ids) > 200 THEN
    RAISE EXCEPTION 'Limite maximo de 200 itens por lote excedido para protecao de infraestrutura.';
  END IF;

  -- 4. Restauração por entidade
  IF _clean_entity_type IN ('sessions', 'session') THEN
    _clean_entity_type := 'sessions';

    UPDATE public.sessions
    SET deleted_at = NULL,
        deleted_by_user_id = NULL
    WHERE id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NOT NULL;
    GET DIAGNOSTICS _affected = ROW_COUNT;

  ELSIF _clean_entity_type IN ('patients', 'patient') THEN
    _clean_entity_type := 'patients';

    UPDATE public.patients
    SET deleted_at = NULL,
        deleted_by_user_id = NULL
    WHERE id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NOT NULL;
    GET DIAGNOSTICS _affected = ROW_COUNT;

    -- Restaura também sessões filhas vinculadas aos pacientes restaurados
    UPDATE public.sessions
    SET deleted_at = NULL,
        deleted_by_user_id = NULL
    WHERE patient_id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NOT NULL;

  ELSIF _clean_entity_type IN ('forms', 'form', 'anamnesis_forms', 'anamnesis_form_templates') THEN
    _clean_entity_type := 'forms';

    UPDATE public.anamnesis_form_templates
    SET deleted_at = NULL,
        deleted_by_user_id = NULL
    WHERE id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NOT NULL;
    GET DIAGNOSTICS _affected = ROW_COUNT;

  ELSE
    RAISE EXCEPTION 'Tipo de entidade desconhecido para lixeira: %', _entity_type;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'count', _affected,
    'entity_type', _clean_entity_type
  );
END;
$$;

-- [RPC/FUNCTION] set_updated_at (schema.sql L12322-L12329)
CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- [RPC/FUNCTION] slugify_text (schema.sql L12463-L12487)
CREATE OR REPLACE FUNCTION "public"."slugify_text"("_val" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
declare
  clean_text text;
begin
  if _val is null or trim(_val) = '' then
    return null;
  end if;

  clean_text := lower(trim(_val));
  clean_text := translate(clean_text, 
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
  );
  clean_text := regexp_replace(clean_text, '[^a-z0-9]+', '-', 'g');
  clean_text := regexp_replace(clean_text, '^-+|-+$', '', 'g');

  if clean_text = '' then
    return null;
  end if;

  return clean_text;
end;
$_$;

-- [RPC/FUNCTION] trg_increment_row_version (schema.sql L13346-L13353)
CREATE OR REPLACE FUNCTION "public"."trg_increment_row_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 1) + 1;
  RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] update_updated_at_column (schema.sql L14354-L14362)
CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- [TABLE] global_word_candidates (schema.sql L16008-L16018)
CREATE TABLE IF NOT EXISTS "public"."global_word_candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "word" "text" NOT NULL,
    "user_count" integer DEFAULT 1 NOT NULL,
    "clinic_count" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "promoted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "global_word_candidates_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'promoted'::"text", 'rejected'::"text"])))
);

-- [POLICY] Membros autenticados podem consultar status de palavras globais ON global_word_candidates (schema.sql L19700-L19700)
CREATE POLICY "Membros autenticados podem consultar status de palavras globais" ON "public"."global_word_candidates" FOR SELECT TO "authenticated" USING (true);
