-- ==========================================================================
-- DOMÍNIO: PLATFORM_ADMIN (Gerado automaticamente por npm run schema:index)
-- Fonte SSOT: supabase/schema.sql
-- ==========================================================================

-- [RPC/FUNCTION] cleanup_old_telemetry_events (schema.sql L1520-L1553)
CREATE OR REPLACE FUNCTION "public"."cleanup_old_telemetry_events"("_page_view_retention_days" integer DEFAULT 15, "_security_event_retention_days" integer DEFAULT 90) RETURNS TABLE("deleted_page_views" bigint, "deleted_security_events" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_deleted_page_views BIGINT := 0;
  v_deleted_security_events BIGINT := 0;
BEGIN
  -- Verify caller is platform owner
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Acesso negado. Apenas o Backoffice Master pode executar a limpeza de telemetria.';
  END IF;

  -- Delete routine page_views older than retention limit
  WITH deleted_pv AS (
    DELETE FROM public.telemetry_events
    WHERE event_type = 'page_view'
      AND created_at < now() - (_page_view_retention_days || ' days')::INTERVAL
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_page_views FROM deleted_pv;

  -- Delete security events older than security retention limit
  WITH deleted_sec AS (
    DELETE FROM public.telemetry_events
    WHERE event_type IN ('print_screen', 'document_print', 'export_pdf')
      AND created_at < now() - (_security_event_retention_days || ' days')::INTERVAL
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_security_events FROM deleted_sec;

  RETURN QUERY SELECT v_deleted_page_views, v_deleted_security_events;
END;
$$;

-- [RPC/FUNCTION] list_feature_flags (schema.sql L6674-L6709)
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

-- [RPC/FUNCTION] upsert_feature_flag (schema.sql L10521-L10708)
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

-- [TABLE] feature_flags (schema.sql L11687-L11704)
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

-- [TABLE] governance_rules (schema.sql L11710-L11714)
CREATE TABLE IF NOT EXISTS "public"."governance_rules" (
    "key" "text" NOT NULL,
    "value" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [TABLE] telemetry_events (schema.sql L12303-L12314)
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

-- [POLICY] Anyone authenticated can view governance rules ON governance_rules (schema.sql L14017-L14017)
CREATE POLICY "Anyone authenticated can view governance rules" ON "public"."governance_rules" FOR SELECT TO "authenticated" USING (true);

-- [POLICY] Authenticated users can insert telemetry events ON telemetry_events (schema.sql L14033-L14033)
CREATE POLICY "Authenticated users can insert telemetry events" ON "public"."telemetry_events" FOR INSERT TO "authenticated" WITH CHECK (true);

-- [POLICY] Platform owners can manage governance rules ON governance_rules (schema.sql L14155-L14155)
CREATE POLICY "Platform owners can manage governance rules" ON "public"."governance_rules" TO "authenticated" USING ("public"."is_platform_owner"()) WITH CHECK ("public"."is_platform_owner"());

-- [POLICY] Platform owners can view all telemetry events ON telemetry_events (schema.sql L14167-L14167)
CREATE POLICY "Platform owners can view all telemetry events" ON "public"."telemetry_events" FOR SELECT TO "authenticated" USING ("public"."is_platform_owner"());

-- [POLICY] Platform owners manage feature flags ON feature_flags (schema.sql L14179-L14179)
CREATE POLICY "Platform owners manage feature flags" ON "public"."feature_flags" TO "authenticated" USING ("public"."is_platform_owner_mfa_verified"("auth"."uid"())) WITH CHECK ("public"."is_platform_owner_mfa_verified"("auth"."uid"()));
