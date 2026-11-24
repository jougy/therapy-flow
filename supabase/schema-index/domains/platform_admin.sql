-- ==========================================================================
-- DOMÍNIO: PLATFORM_ADMIN (Gerado automaticamente por npm run schema:index)
-- Fonte SSOT: supabase/schema.sql
-- ==========================================================================

-- [RPC/FUNCTION] acknowledge_current_user_release_notes (schema.sql L703-L762)
CREATE OR REPLACE FUNCTION "public"."acknowledge_current_user_release_notes"("_release_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _user_id uuid := auth.uid();
  _release public.platform_releases%rowtype;
begin
  if _user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if _release_id is null then
    select *
    into _release
    from public.platform_releases
    where is_active = true
    order by version_order desc
    limit 1;
  else
    select *
    into _release
    from public.platform_releases
    where id = _release_id
      and is_active = true;
  end if;

  if _release.id is null then
    raise exception 'Versao de atualizacao indisponivel.';
  end if;

  insert into public.user_release_note_states (
    user_id,
    last_seen_release_id,
    last_seen_release_order,
    last_seen_at
  )
  values (
    _user_id,
    _release.id,
    _release.version_order,
    now()
  )
  on conflict (user_id)
  do update set
    last_seen_release_id = excluded.last_seen_release_id,
    last_seen_release_order = greatest(
      user_release_note_states.last_seen_release_order,
      excluded.last_seen_release_order
    ),
    last_seen_at = now(),
    updated_at = now();

  return jsonb_build_object(
    'acknowledged', true,
    'release_id', _release.id,
    'version', _release.version
  );
end;
$$;

-- [RPC/FUNCTION] cleanup_old_telemetry_events (schema.sql L2161-L2194)
CREATE OR REPLACE FUNCTION "public"."cleanup_old_telemetry_events"("_page_view_retention_days" integer DEFAULT 15, "_security_event_retention_days" integer DEFAULT 90) RETURNS TABLE("deleted_page_views" bigint, "deleted_security_events" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_deleted_page_views BIGINT := 0;
  v_deleted_security_events BIGINT := 0;
  _pv_cutoff timestamptz := now() - (_page_view_retention_days || ' days')::INTERVAL;
  _sec_cutoff timestamptz := now() - (_security_event_retention_days || ' days')::INTERVAL;
BEGIN
  -- Apenas platform owner pode invocar
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Acesso negado. Apenas o Backoffice Master pode executar a limpeza de telemetria.';
  END IF;

  WITH deleted_pv AS (
    DELETE FROM public.telemetry_events
    WHERE event_type = 'page_view'
      AND created_at < _pv_cutoff
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_page_views FROM deleted_pv;

  WITH deleted_sec AS (
    DELETE FROM public.telemetry_events
    WHERE event_type IN ('print_screen', 'document_print', 'export_pdf')
      AND created_at < _sec_cutoff
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_security_events FROM deleted_sec;

  RETURN QUERY SELECT v_deleted_page_views, v_deleted_security_events;
END;
$$;

-- [RPC/FUNCTION] get_clinic_feature_flags (schema.sql L5288-L5340)
CREATE OR REPLACE FUNCTION "public"."get_clinic_feature_flags"("_clinic_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _user_id uuid := auth.uid();
  _result jsonb;
begin
  if _user_id is null then
    return '{}'::jsonb;
  end if;

  -- Verificar se usuario tem acesso (platform owner na visao ou membro da clinica)
  -- NOTA: O platform owner acessando via "start_platform_clinic_access" ja fica 
  -- com membership_status = 'active' em "clinic_memberships" (ver is_platform_owner em useAuth / membership simulada), 
  -- mas apenas localmente. Entao, ou ele eh platform owner MFA verified, ou tem membership.
  if not (
    public.is_platform_owner_mfa_verified(_user_id) or 
    exists (
      select 1 from public.clinic_memberships 
      where user_id = _user_id and clinic_id = _clinic_id and membership_status = 'active' and is_active = true
    )
  ) then
    return '{}'::jsonb;
  end if;

  select coalesce(jsonb_object_agg(sub.key, sub.value), '{}'::jsonb)
  into _result
  from (
    select distinct on (key)
      key,
      value
    from public.feature_flags
    where (
      scope = 'global'
      or (scope = 'clinic' and clinic_id = _clinic_id)
      or (scope = 'tag' and tag_id in (
        select tag_id from public.clinic_tag_relations where clinic_id = _clinic_id
      ))
    )
    and (starts_at is null or starts_at <= now())
    and (expires_at is null or expires_at > now())
    order by key,
      case scope
        when 'clinic' then 1
        when 'tag' then 2
        when 'global' then 3
      end
  ) sub;

  return _result;
end;
$$;

-- [RPC/FUNCTION] get_current_user_pending_release_notes (schema.sql L5700-L5827)
CREATE OR REPLACE FUNCTION "public"."get_current_user_pending_release_notes"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _user_id uuid := auth.uid();
  _latest public.platform_releases%rowtype;
  _state public.user_release_note_states%rowtype;
  _releases jsonb := '[]'::jsonb;
  _categories jsonb := '[]'::jsonb;
begin
  if _user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select *
  into _latest
  from public.platform_releases
  where is_active = true
  order by version_order desc
  limit 1;

  if _latest.id is null then
    return jsonb_build_object('should_show', false, 'reason', 'no_active_release');
  end if;

  select *
  into _state
  from public.user_release_note_states
  where user_id = _user_id;

  if _state.user_id is null then
    insert into public.user_release_note_states (
      user_id,
      last_seen_release_id,
      last_seen_release_order,
      last_seen_at
    )
    values (
      _user_id,
      _latest.id,
      _latest.version_order,
      now()
    );

    return jsonb_build_object(
      'should_show', false,
      'reason', 'first_access_initialized',
      'latest_release_id', _latest.id,
      'latest_version', _latest.version
    );
  end if;

  if _state.last_seen_release_order >= _latest.version_order then
    return jsonb_build_object(
      'should_show', false,
      'reason', 'up_to_date',
      'latest_release_id', _latest.id,
      'latest_version', _latest.version
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pending_releases.id,
        'version', pending_releases.version,
        'version_order', pending_releases.version_order,
        'title', pending_releases.title,
        'summary', pending_releases.summary,
        'published_at', pending_releases.published_at,
        'items', coalesce(items.items, '[]'::jsonb)
      )
      order by pending_releases.version_order asc
    ),
    '[]'::jsonb
  )
  into _releases
  from public.platform_releases pending_releases
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', platform_release_note_items.id,
        'category', platform_release_note_items.category,
        'title', platform_release_note_items.title,
        'body', platform_release_note_items.body,
        'sort_order', platform_release_note_items.sort_order
      )
      order by platform_release_note_items.category, platform_release_note_items.sort_order, platform_release_note_items.created_at
    ) as items
    from public.platform_release_note_items
    where platform_release_note_items.release_id = pending_releases.id
  ) items on true
  where pending_releases.is_active = true
    and pending_releases.version_order > _state.last_seen_release_order
    and pending_releases.version_order <= _latest.version_order;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'category', counted.category,
        'count', counted.item_count
      )
      order by counted.category
    ),
    '[]'::jsonb
  )
  into _categories
  from (
    select platform_release_note_items.category, count(*)::integer as item_count
    from public.platform_releases pending_releases
    join public.platform_release_note_items on platform_release_note_items.release_id = pending_releases.id
    where pending_releases.is_active = true
      and pending_releases.version_order > _state.last_seen_release_order
      and pending_releases.version_order <= _latest.version_order
    group by platform_release_note_items.category
  ) counted;

  return jsonb_build_object(
    'should_show', jsonb_array_length(_releases) > 0,
    'latest_release_id', _latest.id,
    'latest_version', _latest.version,
    'previous_release_order', _state.last_seen_release_order,
    'releases', _releases,
    'categories', _categories
  );
end;
$$;

-- [RPC/FUNCTION] get_user_active_governance (schema.sql L6863-L6880)
CREATE OR REPLACE FUNCTION "public"."get_user_active_governance"("_user_id" "uuid") RETURNS TABLE("punishment_id" "uuid", "punishment_type" "text", "applied_at" timestamp with time zone, "expires_at" timestamp with time zone, "reason" "text", "is_manual" boolean, "applied_by_name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  SELECT 
    p.id AS punishment_id,
    p.punishment_type,
    p.applied_at,
    p.expires_at,
    p.reason,
    p.is_manual,
    COALESCE(prof.full_name, prof.email, 'Sistema Automático') AS applied_by_name
  FROM public.user_punishments p
  LEFT JOIN public.profiles prof ON prof.id = p.applied_by
  WHERE p.user_id = _user_id
    AND p.is_active = true
    AND (p.expires_at IS NULL OR p.expires_at > now());
$$;

-- [RPC/FUNCTION] handle_clinic_word_telemetry (schema.sql L6945-L6997)
CREATE OR REPLACE FUNCTION "public"."handle_clinic_word_telemetry"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  clean_word text;
  v_user_count int;
  v_clinic_count int;
BEGIN
  clean_word := lower(trim(NEW.word));

  -- Validação anti-spam / anti-PII mínima (somente letras e hífens, entre 3 e 35 caracteres)
  IF length(clean_word) >= 3 AND length(clean_word) <= 35 AND clean_word ~ '^[a-zà-ÿ]+(-[a-zà-ÿ]+)*$' THEN
    
    -- 1. Garante registro na candidata
    INSERT INTO public.global_word_candidates (word, user_count, clinic_count)
    VALUES (clean_word, 1, 1)
    ON CONFLICT (word) DO NOTHING;

    -- 2. Registra na telemetria (se o usuário for conhecido)
    IF NEW.created_by IS NOT NULL THEN
      INSERT INTO public.global_word_telemetry (word, user_id, clinic_id)
      VALUES (clean_word, NEW.created_by, NEW.clinic_id)
      ON CONFLICT (word, user_id, clinic_id) DO NOTHING;
    END IF;

    -- 3. Recalcula quórum
    SELECT 
      count(DISTINCT user_id),
      count(DISTINCT clinic_id)
    INTO 
      v_user_count, 
      v_clinic_count
    FROM public.global_word_telemetry
    WHERE word = clean_word;

    -- 4. Atualiza métricas e promove se atingiu quórum (10 usuários + 3 clínicas)
    UPDATE public.global_word_candidates
    SET 
      user_count = GREATEST(v_user_count, 1),
      clinic_count = GREATEST(v_clinic_count, 1),
      status = CASE 
        WHEN v_user_count >= 10 AND v_clinic_count >= 3 THEN 'promoted'
        ELSE status
      END,
      updated_at = now()
    WHERE word = clean_word;

  END IF;

  RETURN NEW;
END;
$_$;

-- [RPC/FUNCTION] list_feature_flags (schema.sql L8716-L8751)
CREATE OR REPLACE FUNCTION "public"."list_feature_flags"("_clinic_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "key" "text", "scope" "public"."feature_flag_scope", "clinic_id" "uuid", "tag_id" "uuid", "clinic_name" "text", "value" "jsonb", "description" "text", "starts_at" timestamp with time zone, "expires_at" timestamp with time zone, "reason" "text", "created_by" "uuid", "updated_by" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "is_active_now" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    feature_flags.id,
    feature_flags.key,
    feature_flags.scope,
    feature_flags.clinic_id,
    feature_flags.tag_id,
    clinics.name,
    feature_flags.value,
    feature_flags.description,
    feature_flags.starts_at,
    feature_flags.expires_at,
    feature_flags.reason,
    feature_flags.created_by,
    feature_flags.updated_by,
    feature_flags.created_at,
    feature_flags.updated_at,
    coalesce(feature_flags.starts_at, '-infinity'::timestamptz) <= now()
      and coalesce(feature_flags.expires_at, 'infinity'::timestamptz) > now()
  from public.feature_flags
  left join public.clinics on clinics.id = feature_flags.clinic_id
  where public.is_platform_owner_mfa_verified(auth.uid())
    and (
      _clinic_id is null
      or feature_flags.scope::text = 'global'
      or (feature_flags.scope::text = 'clinic' and feature_flags.clinic_id = _clinic_id)
      or (feature_flags.scope::text = 'tag' and exists (
        select 1 from public.clinic_tag_relations ctr
        where ctr.clinic_id = _clinic_id and ctr.tag_id = feature_flags.tag_id
      ))
    )
  order by feature_flags.scope, feature_flags.key
$$;

-- [RPC/FUNCTION] log_security_event (schema.sql L9411-L9507)
CREATE OR REPLACE FUNCTION "public"."log_security_event"("_clinic_id" "uuid", "_actor_user_id" "uuid", "_target_user_id" "uuid", "_event_type" "text", "_visibility_scope" "text" DEFAULT 'self'::"text", "_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _event_id uuid := gen_random_uuid();
  _title text := 'Atividade de segurança registrada';
  _body text := 'Uma atividade de segurança foi registrada na sua conta.';
  _clinic_name text;
  _device_desc text;
BEGIN
  SELECT name
  INTO _clinic_name
  FROM public.clinics
  WHERE id = _clinic_id;

  INSERT INTO public.security_events (
    id,
    clinic_id,
    actor_user_id,
    target_user_id,
    event_type,
    visibility_scope,
    payload
  )
  VALUES (
    _event_id,
    _clinic_id,
    _actor_user_id,
    _target_user_id,
    _event_type,
    CASE WHEN _visibility_scope IN ('self', 'admin') THEN _visibility_scope ELSE 'self' END,
    COALESCE(_payload, '{}'::jsonb)
  );

  IF _target_user_id IS NOT NULL THEN
    IF _event_type = 'session_started' THEN
      _device_desc := COALESCE(
        NULLIF(trim(_payload->>'device_label'), ''),
        NULLIF(trim(CONCAT_WS(' • ', NULLIF(trim(_payload->>'browser'), ''), NULLIF(trim(_payload->>'platform'), ''))), ''),
        'Novo dispositivo'
      );
      _title := 'Novo dispositivo conectado';
      _body := 'Sua conta foi acessada a partir de um novo dispositivo: ' || _device_desc || '. Se não reconhecer este acesso, revise suas sessões ativas.';
    ELSIF _event_type = 'security_alerts_updated' THEN
      _title := 'Preferências de segurança atualizadas';
      _body := 'Suas preferências de alertas de segurança foram atualizadas.';
    ELSIF _event_type IN ('other_sessions_signed_out', 'other_sessions_ended') THEN
      _title := 'Outras sessões encerradas';
      _body := 'As outras sessões abertas da sua conta foram encerradas.';
    ELSIF _event_type IN ('session_force_signed_out', 'subaccount_signed_out') THEN
      _title := 'Sessão encerrada pela clínica';
      _body := 'Uma sessão da sua conta foi encerrada por um administrador da clínica.';
    ELSIF _event_type = 'subaccount_created' THEN
      _title := 'Acesso criado na clínica';
      _body := 'Seu acesso operacional foi criado' || CASE WHEN _clinic_name IS NULL THEN '.' ELSE ' na clínica ' || _clinic_name || '.' END;
    ELSIF _event_type = 'subaccount_password_reset' THEN
      _title := 'Senha provisória definida';
      _body := 'Um administrador definiu uma senha provisória para o seu acesso.';
    ELSIF _event_type = 'subaccount_status_changed' THEN
      _title := 'Status de acesso alterado';
      _body := 'O status do seu acesso operacional foi alterado' || CASE WHEN _clinic_name IS NULL THEN '.' ELSE ' na clínica ' || _clinic_name || '.' END;
    ELSIF _event_type = 'subaccount_role_changed' THEN
      _title := 'Papel operacional alterado';
      _body := 'Seu papel operacional foi alterado' || CASE WHEN _clinic_name IS NULL THEN '.' ELSE ' na clínica ' || _clinic_name || '.' END;
    ELSIF _event_type = 'clinic_member_access_revoked' THEN
      _title := 'Acesso de colaborador removido';
      _body := 'Um acesso operacional foi removido' || CASE WHEN _clinic_name IS NULL THEN '.' ELSE ' da clínica ' || _clinic_name || '.' END;
    ELSIF _event_type = 'clinic_access_removed' THEN
      _title := 'Acesso à clínica removido';
      _body := 'Seu acesso foi removido ou encerrado' || CASE WHEN _clinic_name IS NULL THEN '.' ELSE ' na clínica ' || _clinic_name || '.' END;
    ELSIF _event_type = 'clinic_member_left' THEN
      _title := 'Saída da clínica registrada';
      _body := 'Sua saída foi registrada' || CASE WHEN _clinic_name IS NULL THEN '.' ELSE ' na clínica ' || _clinic_name || '.' END;
    ELSIF _event_type = 'password_changed' THEN
      _title := 'Senha alterada';
      _body := 'Sua senha foi alterada.';
    END IF;

    PERFORM public.create_user_notification(
      _target_user_id,
      _clinic_id,
      _actor_user_id,
      'security',
      _event_type,
      _title,
      _body,
      NULL,
      NULL,
      COALESCE(_payload, '{}'::jsonb),
      _event_id
    );
  END IF;

  RETURN _event_id;
END;
$$;

-- [RPC/FUNCTION] upsert_feature_flag (schema.sql L14427-L14614)
CREATE OR REPLACE FUNCTION "public"."upsert_feature_flag"("_key" "text", "_scope" "public"."feature_flag_scope", "_clinic_id" "uuid" DEFAULT NULL::"uuid", "_tag_id" "uuid" DEFAULT NULL::"uuid", "_value" "jsonb" DEFAULT 'false'::"jsonb", "_description" "text" DEFAULT NULL::"text", "_starts_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _user_id uuid := auth.uid();
  _clean_key text := lower(regexp_replace(btrim(coalesce(_key, '')), '[^a-zA-Z0-9_.:-]+', '_', 'g'));
  _target_id uuid;
  _previous jsonb;
  _next jsonb;
begin
  if not public.is_platform_owner_mfa_verified(_user_id) then
    raise exception 'Acesso de plataforma indisponivel.';
  end if;

  if _clean_key = '' then
    raise exception 'Informe uma chave de feature flag.';
  end if;

  if _scope = 'global' then
    _clinic_id := null;
    _tag_id := null;
  elsif _scope = 'tag' then
    _clinic_id := null;
    if _tag_id is null then
      raise exception 'Informe uma tag_id para flag por tag.';
    end if;
  elsif _scope = 'clinic' then
    _tag_id := null;
    if _clinic_id is null then
      raise exception 'Informe uma clinica para flag por clinica.';
    end if;
  end if;

  select to_jsonb(feature_flags.*)
  into _previous
  from public.feature_flags
  where feature_flags.key = _clean_key
    and feature_flags.scope = _scope
    and feature_flags.clinic_id is not distinct from _clinic_id
    and feature_flags.tag_id is not distinct from _tag_id
  limit 1;

  if _scope = 'global' then
    insert into public.feature_flags (
      key,
      scope,
      clinic_id,
      tag_id,
      value,
      description,
      starts_at,
      expires_at,
      reason,
      created_by,
      updated_by
    )
    values (
      _clean_key,
      _scope,
      _clinic_id,
      _tag_id,
      coalesce(_value, 'false'::jsonb),
      nullif(left(coalesce(_description, ''), 500), ''),
      _starts_at,
      _expires_at,
      nullif(left(coalesce(_reason, ''), 1000), ''),
      _user_id,
      _user_id
    )
    on conflict (key) where scope = 'global'
    do nothing;

    update public.feature_flags
    set
      value = coalesce(_value, 'false'::jsonb),
      description = nullif(left(coalesce(_description, ''), 500), ''),
      starts_at = _starts_at,
      expires_at = _expires_at,
      reason = nullif(left(coalesce(_reason, ''), 1000), ''),
      updated_by = _user_id,
      updated_at = now()
    where key = _clean_key
      and scope = 'global'
    returning id into _target_id;
  elsif _scope = 'tag' then
    insert into public.feature_flags (
      key,
      scope,
      clinic_id,
      tag_id,
      value,
      description,
      starts_at,
      expires_at,
      reason,
      created_by,
      updated_by
    )
    values (
      _clean_key,
      _scope,
      _clinic_id,
      _tag_id,
      coalesce(_value, 'false'::jsonb),
      nullif(left(coalesce(_description, ''), 500), ''),
      _starts_at,
      _expires_at,
      nullif(left(coalesce(_reason, ''), 1000), ''),
      _user_id,
      _user_id
    )
    on conflict (tag_id, key) where scope = 'tag'
    do nothing;

    update public.feature_flags
    set
      value = coalesce(_value, 'false'::jsonb),
      description = nullif(left(coalesce(_description, ''), 500), ''),
      starts_at = _starts_at,
      expires_at = _expires_at,
      reason = nullif(left(coalesce(_reason, ''), 1000), ''),
      updated_by = _user_id,
      updated_at = now()
    where key = _clean_key
      and scope = 'tag'
      and tag_id = _tag_id
    returning id into _target_id;
  elsif _scope = 'clinic' then
    insert into public.feature_flags (
      key,
      scope,
      clinic_id,
      tag_id,
      value,
      description,
      starts_at,
      expires_at,
      reason,
      created_by,
      updated_by
    )
    values (
      _clean_key,
      _scope,
      _clinic_id,
      _tag_id,
      coalesce(_value, 'false'::jsonb),
      nullif(left(coalesce(_description, ''), 500), ''),
      _starts_at,
      _expires_at,
      nullif(left(coalesce(_reason, ''), 1000), ''),
      _user_id,
      _user_id
    )
    on conflict (clinic_id, key) where scope = 'clinic'
    do nothing;

    update public.feature_flags
    set
      value = coalesce(_value, 'false'::jsonb),
      description = nullif(left(coalesce(_description, ''), 500), ''),
      starts_at = _starts_at,
      expires_at = _expires_at,
      reason = nullif(left(coalesce(_reason, ''), 1000), ''),
      updated_by = _user_id,
      updated_at = now()
    where key = _clean_key
      and scope = 'clinic'
      and clinic_id = _clinic_id
    returning id into _target_id;
  end if;

  select to_jsonb(feature_flags.*)
  into _next
  from public.feature_flags
  where id = _target_id;

  perform public.log_platform_audit_event(
    'feature_flag_upserted',
    _clinic_id,
    _reason,
    jsonb_build_object('before', coalesce(_previous, 'null'::jsonb), 'after', _next)
  );

  return _target_id;
end;
$$;

-- [RPC/FUNCTION] upsert_user_telemetry_summary (schema.sql L14620-L14736)
CREATE OR REPLACE FUNCTION "public"."upsert_user_telemetry_summary"("_clinic_id" "uuid", "_user_name" "text", "_page_views" integer, "_prints_detected" integer, "_docs_printed" integer, "_pdf_exported" integer, "_dwell_seconds" integer, "_top_routes" "jsonb", "_is_spam_flagged" boolean DEFAULT false, "_spam_reason" "text" DEFAULT NULL::"text", "_clinical_records_saved" integer DEFAULT 0, "_forms_completed" integer DEFAULT 0, "_upgrade_views" integer DEFAULT 0, "_form_validation_errors" integer DEFAULT 0, "_recent_errors" "jsonb" DEFAULT '[]'::"jsonb", "_page_dwell_matrix" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $_$
DECLARE
  v_user_id UUID := auth.uid();
  v_clean_user_name TEXT := COALESCE(NULLIF(trim(_user_name), ''), 'Usuário');
  v_clean_spam_reason TEXT := NULLIF(trim(_spam_reason), '');
BEGIN
  -- Safe guard: If session is unauthenticated (e.g. race condition during logout/session teardown), return gracefully
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_telemetry_summaries (
    user_id,
    clinic_id,
    summary_date,
    user_name,
    page_views_count,
    prints_detected_count,
    docs_printed_count,
    pdf_exported_count,
    dwell_time_seconds,
    top_routes,
    page_dwell_matrix,
    is_spam_flagged,
    spam_reason,
    clinical_records_saved_count,
    forms_completed_count,
    upgrade_views_count,
    form_validation_errors_count,
    recent_errors,
    updated_at
  )
  VALUES (
    v_user_id,
    _clinic_id,
    CURRENT_DATE,
    v_clean_user_name,
    GREATEST(0, COALESCE(_page_views, 0)),
    GREATEST(0, COALESCE(_prints_detected, 0)),
    GREATEST(0, COALESCE(_docs_printed, 0)),
    GREATEST(0, COALESCE(_pdf_exported, 0)),
    GREATEST(0, COALESCE(_dwell_seconds, 0)),
    COALESCE(_top_routes, '{}'::jsonb),
    COALESCE(_page_dwell_matrix, '{}'::jsonb),
    COALESCE(_is_spam_flagged, false),
    LEFT(v_clean_spam_reason, 500),
    GREATEST(0, COALESCE(_clinical_records_saved, 0)),
    GREATEST(0, COALESCE(_forms_completed, 0)),
    GREATEST(0, COALESCE(_upgrade_views, 0)),
    GREATEST(0, COALESCE(_form_validation_errors, 0)),
    COALESCE(_recent_errors, '[]'::jsonb),
    now()
  )
  ON CONFLICT (user_id, clinic_id, summary_date)
  DO UPDATE SET
    user_name = EXCLUDED.user_name,
    page_views_count = user_telemetry_summaries.page_views_count + EXCLUDED.page_views_count,
    prints_detected_count = user_telemetry_summaries.prints_detected_count + EXCLUDED.prints_detected_count,
    docs_printed_count = user_telemetry_summaries.docs_printed_count + EXCLUDED.docs_printed_count,
    pdf_exported_count = user_telemetry_summaries.pdf_exported_count + EXCLUDED.pdf_exported_count,
    dwell_time_seconds = user_telemetry_summaries.dwell_time_seconds + EXCLUDED.dwell_time_seconds,
    clinical_records_saved_count = user_telemetry_summaries.clinical_records_saved_count + EXCLUDED.clinical_records_saved_count,
    forms_completed_count = user_telemetry_summaries.forms_completed_count + EXCLUDED.forms_completed_count,
    upgrade_views_count = user_telemetry_summaries.upgrade_views_count + EXCLUDED.upgrade_views_count,
    form_validation_errors_count = user_telemetry_summaries.form_validation_errors_count + EXCLUDED.form_validation_errors_count,
    recent_errors = (
      SELECT COALESCE(jsonb_agg(err_elem), '[]'::jsonb)
      FROM (
        SELECT elem AS err_elem
        FROM jsonb_array_elements(
          COALESCE(user_telemetry_summaries.recent_errors, '[]'::jsonb) ||
          COALESCE(EXCLUDED.recent_errors, '[]'::jsonb)
        ) AS elem
        ORDER BY (elem->>'timestamp') DESC NULLS LAST
        LIMIT 20
      ) sub
    ),
    top_routes = (
      SELECT COALESCE(
        jsonb_object_agg(key, sum_val),
        '{}'::jsonb
      )
      FROM (
        SELECT key, sum(value::numeric)::int AS sum_val
        FROM (
          SELECT key, value FROM jsonb_each_text(COALESCE(user_telemetry_summaries.top_routes, '{}'::jsonb))
          UNION ALL
          SELECT key, value FROM jsonb_each_text(COALESCE(EXCLUDED.top_routes, '{}'::jsonb))
        ) combined
        WHERE value ~ '^-?[0-9]+$'
        GROUP BY key
      ) summed
    ),
    page_dwell_matrix = (
      SELECT COALESCE(
        jsonb_object_agg(key, sum_val),
        '{}'::jsonb
      )
      FROM (
        SELECT key, sum(value::numeric)::int AS sum_val
        FROM (
          SELECT key, value FROM jsonb_each_text(COALESCE(user_telemetry_summaries.page_dwell_matrix, '{}'::jsonb))
          UNION ALL
          SELECT key, value FROM jsonb_each_text(COALESCE(EXCLUDED.page_dwell_matrix, '{}'::jsonb))
        ) combined
        WHERE value ~ '^-?[0-9]+$'
        GROUP BY key
      ) summed
    ),
    is_spam_flagged = user_telemetry_summaries.is_spam_flagged OR EXCLUDED.is_spam_flagged,
    spam_reason = COALESCE(EXCLUDED.spam_reason, user_telemetry_summaries.spam_reason),
    updated_at = now();
END;
$_$;

-- [TABLE] clinic_tag_relations (schema.sql L15800-L15805)
CREATE TABLE IF NOT EXISTS "public"."clinic_tag_relations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

-- [TABLE] clinic_tags (schema.sql L15811-L15817)
CREATE TABLE IF NOT EXISTS "public"."clinic_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#808080'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- [TABLE] feature_flags (schema.sql L15981-L15998)
CREATE TABLE IF NOT EXISTS "public"."feature_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "scope" "public"."feature_flag_scope" DEFAULT 'global'::"public"."feature_flag_scope" NOT NULL,
    "clinic_id" "uuid",
    "value" "jsonb" DEFAULT 'false'::"jsonb" NOT NULL,
    "description" "text",
    "starts_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "reason" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tag_id" "uuid",
    CONSTRAINT "feature_flags_key_not_blank" CHECK (("btrim"("key") <> ''::"text")),
    CONSTRAINT "feature_flags_scope_check" CHECK ((((("scope")::"text" = 'global'::"text") AND ("clinic_id" IS NULL) AND ("tag_id" IS NULL)) OR ((("scope")::"text" = 'clinic'::"text") AND ("clinic_id" IS NOT NULL) AND ("tag_id" IS NULL)) OR ((("scope")::"text" = 'tag'::"text") AND ("tag_id" IS NOT NULL) AND ("clinic_id" IS NULL))))
);

-- [TABLE] global_word_telemetry (schema.sql L16024-L16030)
CREATE TABLE IF NOT EXISTS "public"."global_word_telemetry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "word" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [TABLE] governance_rules (schema.sql L16036-L16040)
CREATE TABLE IF NOT EXISTS "public"."governance_rules" (
    "key" "text" NOT NULL,
    "value" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [TABLE] security_events (schema.sql L16663-L16673)
CREATE TABLE IF NOT EXISTS "public"."security_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid",
    "actor_user_id" "uuid",
    "target_user_id" "uuid",
    "event_type" "text" NOT NULL,
    "visibility_scope" "text" DEFAULT 'self'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "security_events_visibility_scope_check" CHECK (("visibility_scope" = ANY (ARRAY['self'::"text", 'admin'::"text"])))
);

-- [TABLE] telemetry_events (schema.sql L16904-L16915)
CREATE TABLE IF NOT EXISTS "public"."telemetry_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid",
    "user_id" "uuid",
    "user_name" "text",
    "event_type" "text" NOT NULL,
    "pathname" "text" NOT NULL,
    "resource_type" "text",
    "resource_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [TABLE] user_governance_overrides (schema.sql L16931-L16936)
CREATE TABLE IF NOT EXISTS "public"."user_governance_overrides" (
    "user_id" "uuid" NOT NULL,
    "max_actions" integer DEFAULT 150 NOT NULL,
    "time_window_minutes" integer DEFAULT 5 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [TABLE] user_release_note_states (schema.sql L16971-L16978)
CREATE TABLE IF NOT EXISTS "public"."user_release_note_states" (
    "user_id" "uuid" NOT NULL,
    "last_seen_release_id" "uuid",
    "last_seen_release_order" integer DEFAULT 0 NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [TABLE] user_telemetry_summaries (schema.sql L17031-L17052)
CREATE TABLE IF NOT EXISTS "public"."user_telemetry_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "clinic_id" "uuid",
    "summary_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "user_name" "text",
    "page_views_count" integer DEFAULT 0 NOT NULL,
    "prints_detected_count" integer DEFAULT 0 NOT NULL,
    "docs_printed_count" integer DEFAULT 0 NOT NULL,
    "pdf_exported_count" integer DEFAULT 0 NOT NULL,
    "dwell_time_seconds" integer DEFAULT 0 NOT NULL,
    "top_routes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_spam_flagged" boolean DEFAULT false NOT NULL,
    "spam_reason" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "clinical_records_saved_count" integer DEFAULT 0 NOT NULL,
    "forms_completed_count" integer DEFAULT 0 NOT NULL,
    "upgrade_views_count" integer DEFAULT 0 NOT NULL,
    "form_validation_errors_count" integer DEFAULT 0 NOT NULL,
    "recent_errors" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "page_dwell_matrix" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);

-- [POLICY] Anyone authenticated can view governance rules ON governance_rules (schema.sql L19586-L19586)
CREATE POLICY "Anyone authenticated can view governance rules" ON "public"."governance_rules" FOR SELECT TO "authenticated" USING (true);

-- [POLICY] Authenticated users can insert telemetry events ON telemetry_events (schema.sql L19606-L19608)
CREATE POLICY "Authenticated users can insert telemetry events" ON "public"."telemetry_events" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (("clinic_id" IS NULL) OR ("clinic_id" IN ( SELECT "cm"."clinic_id"
   FROM "public"."clinic_memberships" "cm"
  WHERE (("cm"."user_id" = "auth"."uid"()) AND ("cm"."is_active" = true)))))));

-- [POLICY] Platform owners can manage governance overrides ON user_governance_overrides (schema.sql L19824-L19824)
CREATE POLICY "Platform owners can manage governance overrides" ON "public"."user_governance_overrides" TO "authenticated" USING ("public"."is_platform_owner"()) WITH CHECK ("public"."is_platform_owner"());

-- [POLICY] Platform owners can manage governance rules ON governance_rules (schema.sql L19828-L19828)
CREATE POLICY "Platform owners can manage governance rules" ON "public"."governance_rules" TO "authenticated" USING ("public"."is_platform_owner"()) WITH CHECK ("public"."is_platform_owner"());

-- [POLICY] Platform owners can view all summaries ON user_telemetry_summaries (schema.sql L19836-L19836)
CREATE POLICY "Platform owners can view all summaries" ON "public"."user_telemetry_summaries" FOR SELECT TO "authenticated" USING ("public"."is_platform_owner"());

-- [POLICY] Platform owners can view all telemetry events ON telemetry_events (schema.sql L19840-L19840)
CREATE POLICY "Platform owners can view all telemetry events" ON "public"."telemetry_events" FOR SELECT TO "authenticated" USING ("public"."is_platform_owner"());

-- [POLICY] Platform owners manage clinic_tag_relations ON clinic_tag_relations (schema.sql L19844-L19844)
CREATE POLICY "Platform owners manage clinic_tag_relations" ON "public"."clinic_tag_relations" USING ("public"."is_platform_owner"("auth"."uid"()));

-- [POLICY] Platform owners manage clinic_tags ON clinic_tags (schema.sql L19848-L19848)
CREATE POLICY "Platform owners manage clinic_tags" ON "public"."clinic_tags" USING ("public"."is_platform_owner"("auth"."uid"()));

-- [POLICY] Platform owners manage feature flags ON feature_flags (schema.sql L19852-L19852)
CREATE POLICY "Platform owners manage feature flags" ON "public"."feature_flags" TO "authenticated" USING ("public"."is_platform_owner_mfa_verified"("auth"."uid"())) WITH CHECK ("public"."is_platform_owner_mfa_verified"("auth"."uid"()));

-- [POLICY] Users can read own overrides ON user_governance_overrides (schema.sql L20000-L20000)
CREATE POLICY "Users can read own overrides" ON "public"."user_governance_overrides" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."is_platform_owner"()));

-- [POLICY] Users can upsert own summary row ON user_telemetry_summaries (schema.sql L20004-L20004)
CREATE POLICY "Users can upsert own summary row" ON "public"."user_telemetry_summaries" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

-- [POLICY] Users read own release note state ON user_release_note_states (schema.sql L20179-L20179)
CREATE POLICY "Users read own release note state" ON "public"."user_release_note_states" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

-- [POLICY] admins can read clinic security events ON security_events (schema.sql L20283-L20283)
CREATE POLICY "admins can read clinic security events" ON "public"."security_events" FOR SELECT USING ((("visibility_scope" = 'admin'::"text") AND ("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())) AND "public"."current_user_can"('subaccounts.manage'::"text", "clinic_id")));

-- [POLICY] users can read own security events ON security_events (schema.sql L20574-L20574)
CREATE POLICY "users can read own security events" ON "public"."security_events" FOR SELECT USING ((("actor_user_id" = "auth"."uid"()) OR ("target_user_id" = "auth"."uid"())));
