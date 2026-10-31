-- ==========================================================================
-- DOMÍNIO: WHATSAPP_NOTIFICATIONS (Gerado automaticamente por npm run schema:index)
-- Fonte SSOT: supabase/schema.sql
-- ==========================================================================

-- [RPC/FUNCTION] create_due_agenda_reminder_notifications (schema.sql L2417-L2473)
CREATE OR REPLACE FUNCTION "public"."create_due_agenda_reminder_notifications"("_lookahead" interval DEFAULT '00:30:00'::interval) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _event record;
  _created_count integer := 0;
  _notification_id uuid;
BEGIN
  FOR _event IN
    SELECT
      agenda_events.id,
      agenda_events.clinic_id,
      agenda_events.user_id,
      agenda_events.patient_id,
      agenda_events.title,
      agenda_events.scheduled_for,
      clinics.route_key,
      patients.name AS patient_name
    FROM public.agenda_events
    LEFT JOIN public.clinics ON clinics.id = agenda_events.clinic_id
    LEFT JOIN public.patients ON patients.id = agenda_events.patient_id
    WHERE agenda_events.status = 'agendado'
      AND agenda_events.scheduled_for > now()
      AND agenda_events.scheduled_for <= now() + _lookahead
  LOOP
    SELECT public.create_user_notification(
      _event.user_id,
      _event.clinic_id,
      NULL,
      'reminder',
      'agenda_event_due',
      'Evento se aproximando',
      COALESCE(_event.title, 'Evento') || ' está próximo do horário agendado.',
      'Abrir agenda',
      CASE
        WHEN _event.route_key IS NULL THEN NULL
        ELSE '/clinica/' || _event.route_key
      END,
      jsonb_build_object(
        'agenda_event_id', _event.id,
        'patient_id', _event.patient_id,
        'scheduled_for', _event.scheduled_for,
        'patient_name', _event.patient_name
      ),
      _event.id
    )
    INTO _notification_id;

    IF _notification_id IS NOT NULL THEN
      _created_count := _created_count + 1;
    END IF;
  END LOOP;

  RETURN _created_count;
END;
$$;

-- [TABLE] notification_preferences (schema.sql L3890-L3904)
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

-- [RPC/FUNCTION] ensure_notification_preferences (schema.sql L3910-L3932)
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

-- [RPC/FUNCTION] notification_category_enabled (schema.sql L9160-L9173)
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

-- [RPC/FUNCTION] purge_old_app_notifications (schema.sql L9760-L9774)
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

-- [RPC/FUNCTION] touch_notification_preferences_updated_at (schema.sql L11646-L11654)
CREATE OR REPLACE FUNCTION "public"."touch_notification_preferences_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- [TABLE] app_notifications (schema.sql L13594-L13614)
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

-- [POLICY] Users delete own app notifications ON app_notifications (schema.sql L17167-L17167)
CREATE POLICY "Users delete own app notifications" ON "public"."app_notifications" FOR DELETE USING (("user_id" = "auth"."uid"()));

-- [POLICY] Users manage own notification preferences ON notification_preferences (schema.sql L17207-L17207)
CREATE POLICY "Users manage own notification preferences" ON "public"."notification_preferences" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));

-- [POLICY] Users read own app notifications ON app_notifications (schema.sql L17278-L17278)
CREATE POLICY "Users read own app notifications" ON "public"."app_notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));

-- [POLICY] Users update own app notifications ON app_notifications (schema.sql L17334-L17334)
CREATE POLICY "Users update own app notifications" ON "public"."app_notifications" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
