-- ==========================================================================
-- DOMÍNIO: WHATSAPP_NOTIFICATIONS (Gerado automaticamente por npm run schema:index)
-- Fonte SSOT: supabase/schema.sql
-- ==========================================================================

-- [RPC/FUNCTION] clear_current_user_notifications (schema.sql L2269-L2285)
CREATE OR REPLACE FUNCTION "public"."clear_current_user_notifications"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  DELETE FROM public.app_notifications
  WHERE user_id = _user_id;

  RETURN jsonb_build_object('status', 'cleared');
END;
$$;

-- [RPC/FUNCTION] create_current_user_notification (schema.sql L2613-L2638)
CREATE OR REPLACE FUNCTION "public"."create_current_user_notification"("_clinic_id" "uuid", "_category" "text", "_event_type" "text", "_title" "text", "_body" "text", "_action_label" "text" DEFAULT NULL::"text", "_action_url" "text" DEFAULT NULL::"text", "_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  RETURN public.create_user_notification(
    _user_id,
    _clinic_id,
    _user_id,
    _category,
    _event_type,
    _title,
    _body,
    _action_label,
    _action_url,
    _payload,
    NULL
  );
END;
$$;

-- [RPC/FUNCTION] create_user_notification (schema.sql L2796-L2855)
CREATE OR REPLACE FUNCTION "public"."create_user_notification"("_user_id" "uuid", "_clinic_id" "uuid", "_actor_user_id" "uuid", "_category" "text", "_event_type" "text", "_title" "text", "_body" "text", "_action_label" "text" DEFAULT NULL::"text", "_action_url" "text" DEFAULT NULL::"text", "_payload" "jsonb" DEFAULT '{}'::"jsonb", "_source_event_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _preferences public.notification_preferences%ROWTYPE;
  _notification_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF _category NOT IN ('security', 'clinic_access', 'patient', 'session', 'reminder', 'system') THEN
    RAISE EXCEPTION 'Categoria de notificacao invalida.';
  END IF;

  SELECT *
  INTO _preferences
  FROM public.ensure_notification_preferences(_user_id);

  IF NOT public.notification_category_enabled(_preferences, _category) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.app_notifications (
    user_id,
    clinic_id,
    actor_user_id,
    category,
    event_type,
    title,
    body,
    action_label,
    action_url,
    payload,
    source_event_id
  )
  VALUES (
    _user_id,
    _clinic_id,
    _actor_user_id,
    _category,
    left(btrim(_event_type), 120),
    left(btrim(_title), 160),
    left(btrim(_body), 1000),
    nullif(left(btrim(coalesce(_action_label, '')), 80), ''),
    nullif(left(btrim(coalesce(_action_url, '')), 500), ''),
    coalesce(_payload, '{}'::jsonb),
    _source_event_id
  )
  ON CONFLICT (source_event_id)
  WHERE source_event_id IS NOT NULL
  DO UPDATE SET source_event_id = EXCLUDED.source_event_id
  RETURNING id INTO _notification_id;

  PERFORM public.trim_user_notifications(_user_id);

  RETURN _notification_id;
END;
$$;

-- [RPC/FUNCTION] delete_current_user_notification (schema.sql L3579-L3596)
CREATE OR REPLACE FUNCTION "public"."delete_current_user_notification"("_notification_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  DELETE FROM public.app_notifications
  WHERE id = _notification_id
    AND user_id = _user_id;

  RETURN jsonb_build_object('deleted', FOUND);
END;
$$;

-- [RPC/FUNCTION] disable_user_totp (schema.sql L3602-L3636)
CREATE OR REPLACE FUNCTION "public"."disable_user_totp"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    _current_user_id UUID := auth.uid();
BEGIN
    IF _current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
    END IF;

    DELETE FROM public.user_mfa_credentials
    WHERE user_id = _current_user_id;

    UPDATE public.profiles
    SET 
        totp_secret = NULL,
        totp_enabled = false,
        totp_enabled_at = NULL,
        updated_at = now()
    WHERE id = _current_user_id;

    -- Desconectar sessões ativas do WhatsApp associadas a este usuário
    UPDATE public.whatsapp_chat_sessions
    SET 
        is_authenticated = false,
        authenticated_at = NULL,
        auth_expires_at = NULL,
        current_step = 'initial',
        updated_at = now()
    WHERE user_id = _current_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- [TABLE] notification_preferences (schema.sql L4145-L4159)
CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "user_id" "uuid" NOT NULL,
    "sound_mode" "text" DEFAULT 'default'::"text" NOT NULL,
    "sound_key" "text" DEFAULT 'soft'::"text" NOT NULL,
    "notify_security" boolean DEFAULT true NOT NULL,
    "notify_clinic_access" boolean DEFAULT true NOT NULL,
    "notify_patient_saved" boolean DEFAULT true NOT NULL,
    "notify_session_activity" boolean DEFAULT true NOT NULL,
    "notify_event_reminders" boolean DEFAULT true NOT NULL,
    "notify_system" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_preferences_sound_key_check" CHECK (("sound_key" = ANY (ARRAY['soft'::"text", 'cute'::"text", 'chime'::"text", 'pulse'::"text", 'urgent_alarm'::"text", 'siren'::"text"]))),
    CONSTRAINT "notification_preferences_sound_mode_check" CHECK (("sound_mode" = ANY (ARRAY['default'::"text", 'silent'::"text"])))
);

-- [RPC/FUNCTION] ensure_notification_preferences (schema.sql L4165-L4187)
CREATE OR REPLACE FUNCTION "public"."ensure_notification_preferences"("_user_id" "uuid") RETURNS "public"."notification_preferences"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _preferences public.notification_preferences%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao informado.';
  END IF;

  INSERT INTO public.notification_preferences (user_id)
  VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
  INTO _preferences
  FROM public.notification_preferences
  WHERE user_id = _user_id;

  RETURN _preferences;
END;
$$;

-- [RPC/FUNCTION] get_user_totp_status (schema.sql L6913-L6939)
CREATE OR REPLACE FUNCTION "public"."get_user_totp_status"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    _current_user_id UUID := auth.uid();
    _enabled BOOLEAN := false;
    _enabled_at TIMESTAMPTZ := NULL;
    _phone TEXT := NULL;
BEGIN
    IF _current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
    END IF;

    SELECT totp_enabled, totp_enabled_at, phone
    INTO _enabled, _enabled_at, _phone
    FROM public.profiles
    WHERE id = _current_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'totp_enabled', COALESCE(_enabled, false),
        'totp_enabled_at', _enabled_at,
        'phone', _phone
    );
END;
$$;

-- [RPC/FUNCTION] list_current_user_notification_preferences (schema.sql L8639-L8665)
CREATE OR REPLACE FUNCTION "public"."list_current_user_notification_preferences"() RETURNS TABLE("sound_mode" "text", "sound_key" "text", "notify_security" boolean, "notify_clinic_access" boolean, "notify_patient_saved" boolean, "notify_session_activity" boolean, "notify_event_reminders" boolean, "notify_system" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  PERFORM public.ensure_notification_preferences(_user_id);

  RETURN QUERY
  SELECT
    notification_preferences.sound_mode,
    notification_preferences.sound_key,
    notification_preferences.notify_security,
    notification_preferences.notify_clinic_access,
    notification_preferences.notify_patient_saved,
    notification_preferences.notify_session_activity,
    notification_preferences.notify_event_reminders,
    notification_preferences.notify_system
  FROM public.notification_preferences
  WHERE user_id = _user_id;
END;
$$;

-- [RPC/FUNCTION] list_current_user_notifications (schema.sql L8671-L8710)
CREATE OR REPLACE FUNCTION "public"."list_current_user_notifications"() RETURNS TABLE("notification_id" "uuid", "created_at" timestamp with time zone, "category" "text", "event_type" "text", "title" "text", "body" "text", "clinic_id" "uuid", "clinic_name" "text", "actor_user_id" "uuid", "actor_name" "text", "action_label" "text", "action_url" "text", "payload" "jsonb", "read_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  PERFORM public.ensure_notification_preferences(_user_id);

  RETURN QUERY
  SELECT
    app_notifications.id AS notification_id,
    app_notifications.created_at,
    app_notifications.category,
    app_notifications.event_type,
    app_notifications.title,
    app_notifications.body,
    app_notifications.clinic_id,
    clinics.name AS clinic_name,
    app_notifications.actor_user_id,
    actor_profile.full_name AS actor_name,
    app_notifications.action_label,
    app_notifications.action_url,
    app_notifications.payload,
    app_notifications.read_at
  FROM public.app_notifications
  LEFT JOIN public.clinics
    ON clinics.id = app_notifications.clinic_id
  LEFT JOIN public.profiles AS actor_profile
    ON actor_profile.id = app_notifications.actor_user_id
  WHERE app_notifications.user_id = _user_id
    AND app_notifications.dismissed_at IS NULL
  ORDER BY app_notifications.created_at DESC, app_notifications.id DESC
  LIMIT 64;
END;
$$;

-- [RPC/FUNCTION] notification_category_enabled (schema.sql L9947-L9960)
CREATE OR REPLACE FUNCTION "public"."notification_category_enabled"("_preferences" "public"."notification_preferences", "_category" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE _category
    WHEN 'security' THEN _preferences.notify_security
    WHEN 'clinic_access' THEN _preferences.notify_clinic_access
    WHEN 'patient' THEN _preferences.notify_patient_saved
    WHEN 'session' THEN _preferences.notify_session_activity
    WHEN 'reminder' THEN _preferences.notify_event_reminders
    WHEN 'system' THEN _preferences.notify_system
    ELSE false
  END;
$$;

-- [RPC/FUNCTION] purge_old_app_notifications (schema.sql L10658-L10672)
CREATE OR REPLACE FUNCTION "public"."purge_old_app_notifications"("_retention_days" integer DEFAULT 60) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  _deleted_count integer := 0;
BEGIN
  DELETE FROM public.app_notifications
  WHERE (read_at IS NOT NULL OR dismissed_at IS NOT NULL)
    AND created_at < (now() - (_retention_days || ' days')::interval);

  GET DIAGNOSTICS _deleted_count = ROW_COUNT;
  RETURN _deleted_count;
END;
$$;

-- [RPC/FUNCTION] setup_user_totp (schema.sql L12335-L12369)
CREATE OR REPLACE FUNCTION "public"."setup_user_totp"("_totp_secret" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    _current_user_id UUID := auth.uid();
BEGIN
    IF _current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
    END IF;

    IF _totp_secret IS NULL OR length(trim(_totp_secret)) < 16 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Segredo TOTP inválido');
    END IF;

    -- Salvar na tabela isolada
    INSERT INTO public.user_mfa_credentials (user_id, totp_secret, totp_enabled, updated_at)
    VALUES (_current_user_id, trim(_totp_secret), true, now())
    ON CONFLICT (user_id) DO UPDATE
    SET totp_secret = EXCLUDED.totp_secret,
        totp_enabled = true,
        updated_at = now();

    -- Atualizar flag pública/não sensível de status no profile
    UPDATE public.profiles
    SET 
        totp_secret = NULL, -- Garante limpeza contínua
        totp_enabled = true,
        totp_enabled_at = now(),
        updated_at = now()
    WHERE id = _current_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- [RPC/FUNCTION] touch_notification_preferences_updated_at (schema.sql L13252-L13260)
CREATE OR REPLACE FUNCTION "public"."touch_notification_preferences_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] trim_user_notifications (schema.sql L13375-L13392)
CREATE OR REPLACE FUNCTION "public"."trim_user_notifications"("_user_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH ranked_notifications AS (
    SELECT
      id,
      row_number() OVER (ORDER BY created_at DESC, id DESC) AS position
    FROM public.app_notifications
    WHERE user_id = _user_id
  )
  DELETE FROM public.app_notifications
  WHERE id IN (
    SELECT id
    FROM ranked_notifications
    WHERE position > 64
  );
$$;

-- [RPC/FUNCTION] update_current_user_notification_preferences (schema.sql L14194-L14221)
CREATE OR REPLACE FUNCTION "public"."update_current_user_notification_preferences"("_sound_mode" "text" DEFAULT NULL::"text", "_sound_key" "text" DEFAULT NULL::"text", "_notify_security" boolean DEFAULT NULL::boolean, "_notify_clinic_access" boolean DEFAULT NULL::boolean, "_notify_patient_saved" boolean DEFAULT NULL::boolean, "_notify_session_activity" boolean DEFAULT NULL::boolean, "_notify_event_reminders" boolean DEFAULT NULL::boolean, "_notify_system" boolean DEFAULT NULL::boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  PERFORM public.ensure_notification_preferences(_user_id);

  UPDATE public.notification_preferences
  SET
    sound_mode = COALESCE(_sound_mode, sound_mode),
    sound_key = COALESCE(_sound_key, sound_key),
    notify_security = COALESCE(_notify_security, notify_security),
    notify_clinic_access = COALESCE(_notify_clinic_access, notify_clinic_access),
    notify_patient_saved = COALESCE(_notify_patient_saved, notify_patient_saved),
    notify_session_activity = COALESCE(_notify_session_activity, notify_session_activity),
    notify_event_reminders = COALESCE(_notify_event_reminders, notify_event_reminders),
    notify_system = COALESCE(_notify_system, notify_system)
  WHERE user_id = _user_id;

  RETURN jsonb_build_object('status', 'updated');
END;
$$;

-- [TABLE] app_notifications (schema.sql L15420-L15440)
CREATE TABLE IF NOT EXISTS "public"."app_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "clinic_id" "uuid",
    "actor_user_id" "uuid",
    "category" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "action_label" "text",
    "action_url" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source_event_id" "uuid",
    "read_at" timestamp with time zone,
    "dismissed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "app_notifications_body_check" CHECK ((("char_length"("body") >= 1) AND ("char_length"("body") <= 1000))),
    CONSTRAINT "app_notifications_category_check" CHECK (("category" = ANY (ARRAY['security'::"text", 'clinic_access'::"text", 'patient'::"text", 'session'::"text", 'reminder'::"text", 'system'::"text"]))),
    CONSTRAINT "app_notifications_event_type_check" CHECK ((("char_length"("event_type") >= 1) AND ("char_length"("event_type") <= 120))),
    CONSTRAINT "app_notifications_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 160)))
);

-- [TABLE] mfa_recovery_challenges (schema.sql L16046-L16060)
CREATE TABLE IF NOT EXISTS "public"."mfa_recovery_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "target_masked" "text" NOT NULL,
    "code_hash" "text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 5 NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    CONSTRAINT "mfa_recovery_challenges_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'email'::"text"])))
);

-- [TABLE] user_mfa_credentials (schema.sql L16942-L16949)
CREATE TABLE IF NOT EXISTS "public"."user_mfa_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "totp_secret" "text" NOT NULL,
    "totp_enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [POLICY] Service role manages mfa recovery challenges ON mfa_recovery_challenges (schema.sql L19896-L19896)
CREATE POLICY "Service role manages mfa recovery challenges" ON "public"."mfa_recovery_challenges" TO "service_role" USING (true) WITH CHECK (true);

-- [POLICY] Users can manage own MFA credentials ON user_mfa_credentials (schema.sql L19980-L19980)
CREATE POLICY "Users can manage own MFA credentials" ON "public"."user_mfa_credentials" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

-- [POLICY] Users can only read own MFA credentials ON user_mfa_credentials (schema.sql L19984-L19984)
CREATE POLICY "Users can only read own MFA credentials" ON "public"."user_mfa_credentials" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

-- [POLICY] Users delete own app notifications ON app_notifications (schema.sql L20038-L20038)
CREATE POLICY "Users delete own app notifications" ON "public"."app_notifications" FOR DELETE USING (("user_id" = "auth"."uid"()));

-- [POLICY] Users manage own notification preferences ON notification_preferences (schema.sql L20088-L20088)
CREATE POLICY "Users manage own notification preferences" ON "public"."notification_preferences" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));

-- [POLICY] Users read own app notifications ON app_notifications (schema.sql L20167-L20167)
CREATE POLICY "Users read own app notifications" ON "public"."app_notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));

-- [POLICY] Users update own app notifications ON app_notifications (schema.sql L20231-L20231)
CREATE POLICY "Users update own app notifications" ON "public"."app_notifications" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
