-- ==========================================================================
-- DOMÍNIO: AGENDA_SCHEDULE (Gerado automaticamente por npm run schema:index)
-- Fonte SSOT: supabase/schema.sql
-- ==========================================================================

-- [RPC/FUNCTION] create_due_agenda_reminder_notifications (schema.sql L2644-L2700)
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

-- [RPC/FUNCTION] finalize_overdue_agenda_events (schema.sql L4315-L4427)
CREATE OR REPLACE FUNCTION "public"."finalize_overdue_agenda_events"("_batch_size" integer DEFAULT 500, "_timezone" "text" DEFAULT 'America/Sao_Paulo'::"text") RETURNS TABLE("cancelled_count" integer, "deleted_event_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _safe_batch_size integer := LEAST(GREATEST(COALESCE(_batch_size, 500), 1), 5000);
  _today_start timestamptz;
BEGIN
  _today_start := date_trunc('day', timezone(_timezone, now())) AT TIME ZONE _timezone;

  RETURN QUERY
  WITH due_events AS (
    SELECT agenda_events.*
    FROM public.agenda_events
    WHERE agenda_events.event_type = 'atendimento'
      AND agenda_events.patient_id IS NOT NULL
      AND agenda_events.status <> 'cancelado'
      AND agenda_events.scheduled_for < _today_start
    ORDER BY agenda_events.scheduled_for ASC
    LIMIT _safe_batch_size
    FOR UPDATE SKIP LOCKED
  ),
  ensure_cancelled_groups AS (
    INSERT INTO public.patient_groups (
      user_id,
      patient_id,
      clinic_id,
      name,
      color,
      status,
      is_default,
      group_kind
    )
    SELECT DISTINCT
      due_events.user_id,
      due_events.patient_id,
      due_events.clinic_id,
      'Cancelados',
      'rose',
      'cancelado',
      false,
      'cancelados'
    FROM due_events
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.patient_groups
      WHERE patient_groups.patient_id = due_events.patient_id
        AND patient_groups.group_kind = 'cancelados'
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  ),
  cancelled_groups AS (
    SELECT patient_groups.patient_id, patient_groups.id
    FROM public.patient_groups
    JOIN due_events ON due_events.patient_id = patient_groups.patient_id
    WHERE patient_groups.group_kind = 'cancelados'
  ),
  inserted_sessions AS (
    INSERT INTO public.sessions (
      user_id,
      patient_id,
      group_id,
      session_date,
      status,
      anamnesis,
      treatment,
      pain_score,
      complexity_score,
      notes,
      clinic_id,
      provider_id,
      scheduled_start_at,
      patient_arrived_at,
      payment_status,
      amount_charged_cents,
      amount_paid_cents,
      amount_original_cents
    )
    SELECT
      due_events.user_id,
      due_events.patient_id,
      cancelled_groups.id,
      due_events.scheduled_for,
      'cancelado',
      '{}'::jsonb,
      '{}'::jsonb,
      0,
      0,
      'Atendimento cancelado automaticamente porque o agendamento passou do fim do dia sem intervenção do usuário.',
      due_events.clinic_id,
      due_events.user_id,
      due_events.scheduled_for,
      NULL,
      'nao_cobrado',
      0,
      0,
      0
    FROM due_events
    LEFT JOIN cancelled_groups ON cancelled_groups.patient_id = due_events.patient_id
    RETURNING id
  ),
  deleted_events AS (
    DELETE FROM public.agenda_events
    USING due_events
    WHERE agenda_events.id = due_events.id
    RETURNING agenda_events.id
  )
  SELECT
    (SELECT COUNT(*)::integer FROM inserted_sessions),
    (SELECT COUNT(*)::integer FROM deleted_events);
END;
$$;

-- [RPC/FUNCTION] rpc_get_available_slots (schema.sql L12086-L12144)
CREATE OR REPLACE FUNCTION "public"."rpc_get_available_slots"("_clinic_id" "uuid", "_provider_id" "uuid", "_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _slot_time text;
  _slot_start timestamptz;
  _slot_end timestamptz;
  _is_occupied boolean;
  _slots text[] := ARRAY[]::text[];
  _all_slots text[] := ARRAY[
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'
  ];
BEGIN
  IF _clinic_id IS NULL OR _date IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  FOREACH _slot_time IN ARRAY _all_slots
  LOOP
    -- Converte data + horário em timestamptz no timezone da clínica/São Paulo
    _slot_start := (_date::text || ' ' || _slot_time || ':00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
    _slot_end := _slot_start + interval '30 minutes';

    -- Verifica se já há evento ou sessão ocupando este slot
    SELECT EXISTS (
      -- Checa agenda_events
      SELECT 1
      FROM public.agenda_events ae
      WHERE ae.clinic_id = _clinic_id
        AND (_provider_id IS NULL OR ae.user_id = _provider_id)
        AND ae.status NOT IN ('cancelado')
        AND ae.scheduled_for < _slot_end
        AND (ae.scheduled_for + (COALESCE(ae.duration_minutes, 60) * interval '1 minute')) > _slot_start

      UNION ALL

      -- Checa sessions ativas
      SELECT 1
      FROM public.sessions s
      WHERE s.clinic_id = _clinic_id
        AND (_provider_id IS NULL OR COALESCE(s.provider_id, s.user_id) = _provider_id)
        AND s.deleted_at IS NULL
        AND s.status NOT IN ('cancelada')
        AND COALESCE(s.scheduled_start_at, s.session_date) < _slot_end
        AND (COALESCE(s.scheduled_start_at, s.session_date) + interval '30 minutes') > _slot_start
    ) INTO _is_occupied;

    IF NOT _is_occupied THEN
      _slots := array_append(_slots, _slot_time);
    END IF;
  END LOOP;

  RETURN to_jsonb(_slots);
END;
$$;

-- [RPC/FUNCTION] schedule_patient_appointment (schema.sql L12197-L12251)
CREATE OR REPLACE FUNCTION "public"."schedule_patient_appointment"("_clinic_id" "uuid", "_patient_id" "uuid", "_title" "text", "_scheduled_for" timestamp with time zone, "_duration_minutes" integer DEFAULT 50, "_event_type" "text" DEFAULT 'atendimento'::"text", "_status" "text" DEFAULT 'confirmado'::"text") RETURNS TABLE("id" "uuid", "clinic_id" "uuid", "patient_id" "uuid", "title" "text", "scheduled_for" timestamp with time zone, "duration_minutes" integer, "status" "text", "event_type" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_event_id uuid;
BEGIN
  -- Validação de autenticação e contexto
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF NOT public.current_user_can('agenda.write', _clinic_id) THEN
    RAISE EXCEPTION 'Sem permissao para criar agendamentos nesta clinica.';
  END IF;

  -- Inserção atômica utilizando generate_uuidv7
  v_event_id := public.generate_uuidv7();

  INSERT INTO public.agenda_events (
    id,
    clinic_id,
    patient_id,
    user_id,
    title,
    scheduled_for,
    duration_minutes,
    status,
    event_type
  ) VALUES (
    v_event_id,
    _clinic_id,
    _patient_id,
    auth.uid(),
    trim(_title),
    _scheduled_for,
    COALESCE(_duration_minutes, 50),
    COALESCE(_status, 'confirmado'),
    COALESCE(_event_type, 'atendimento')
  );

  RETURN QUERY
  SELECT 
    ae.id,
    ae.clinic_id,
    ae.patient_id,
    ae.title,
    ae.scheduled_for,
    ae.duration_minutes,
    ae.status,
    ae.event_type
  FROM public.agenda_events ae
  WHERE ae.id = v_event_id;
END;
$$;

-- [TABLE] agenda_events (schema.sql L15331-L15414)
CREATE TABLE IF NOT EXISTS "public"."agenda_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "patient_id" "uuid",
    "event_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "scheduled_for" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'aguardando_confirmacao'::"text" NOT NULL,
    "generated_by_recurring_patient" boolean DEFAULT false NOT NULL,
    "payment_plan_id" "uuid",
    "payment_plan_session_index" integer,
    "version" integer DEFAULT 1 NOT NULL,
    "duration_minutes" integer DEFAULT 60 NOT NULL,
    "reminder_configs" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "notify_team" boolean DEFAULT false NOT NULL,
    "notify_patient" boolean DEFAULT false NOT NULL,
    "notified_colleague_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "origin_timezone" "text",
    "origin_lat" double precision,
    "origin_lng" double precision,
    "origin_city" "text",
    "reminder_dispatches" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "last_reminder_dispatched_at" timestamp with time zone,
    CONSTRAINT "agenda_events_duration_minutes_check" CHECK ((("duration_minutes" > 0) AND ("duration_minutes" <= 1440))),
    CONSTRAINT "agenda_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['atendimento'::"text", 'reuniao'::"text", 'evento'::"text"]))),
    CONSTRAINT "agenda_events_payment_plan_session_index_check" CHECK ((("payment_plan_session_index" IS NULL) OR ("payment_plan_session_index" >= 1))),
    CONSTRAINT "agenda_events_status_check" CHECK (("status" = ANY (ARRAY['lembrete'::"text", 'aguardando_confirmacao'::"text", 'confirmado'::"text", 'cancelado'::"text", 'concluido'::"text"])))
)
WITH ("autovacuum_vacuum_scale_factor"='0.05', "autovacuum_vacuum_threshold"='500', "autovacuum_analyze_scale_factor"='0.02');


ALTER TABLE "public"."agenda_events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."agenda_events"."duration_minutes" IS 'Duração do evento na agenda em minutos (padrão 60 min, máximo 24h/1440 min).';



COMMENT ON COLUMN "public"."agenda_events"."origin_timezone" IS 'Identificador IANA do fuso horário de origem do evento (ex: America/Sao_Paulo, America/Manaus).';



COMMENT ON COLUMN "public"."agenda_events"."origin_lat" IS 'Latitude geográfica de origem da criação do evento (opcional).';



COMMENT ON COLUMN "public"."agenda_events"."origin_lng" IS 'Longitude geográfica de origem da criação do evento (opcional).';



COMMENT ON COLUMN "public"."agenda_events"."origin_city" IS 'Nome da cidade ou localidade de origem do agendamento (opcional).';



COMMENT ON COLUMN "public"."agenda_events"."reminder_dispatches" IS 'Histórico estruturado de lembretes já disparados (ex: 24h, 2h, imediato) para prevenir disparos duplicados.';



COMMENT ON COLUMN "public"."agenda_events"."last_reminder_dispatched_at" IS 'Timestamp do último lembrete disparado com sucesso via WhatsApp/SMS.';



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
    "deleted_at" timestamp with time zone,
    "deleted_by_user_id" "uuid",
    CONSTRAINT "anamnesis_form_templates_schema_shape_check" CHECK ((("jsonb_typeof"("schema") = 'array'::"text") AND
CASE
    WHEN ("jsonb_typeof"("schema") = 'array'::"text") THEN ("jsonb_array_length"("schema") <= 200)
    ELSE false
END))
);

-- [TABLE] clinic_group_color_slots (schema.sql L15611-L15622)
CREATE TABLE IF NOT EXISTS "public"."clinic_group_color_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "slot_index" integer NOT NULL,
    "color_hex" "text" NOT NULL,
    "alpha" integer DEFAULT 100 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "clinic_group_color_slots_alpha_check" CHECK ((("alpha" >= 0) AND ("alpha" <= 100))),
    CONSTRAINT "clinic_group_color_slots_color_hex_check" CHECK (("color_hex" ~ '^#[0-9A-Fa-f]{6}$'::"text")),
    CONSTRAINT "clinic_group_color_slots_slot_index_check" CHECK ((("slot_index" >= 0) AND ("slot_index" < 21)))
);

-- [POLICY] Super admins manage all agenda events ON agenda_events (schema.sql L19920-L19920)
CREATE POLICY "Super admins manage all agenda events" ON "public"."agenda_events" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));

-- [POLICY] Users delete clinic agenda events ON agenda_events (schema.sql L20008-L20008)
CREATE POLICY "Users delete clinic agenda events" ON "public"."agenda_events" FOR DELETE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('agenda.delete_events'::"text", "clinic_id")));

-- [POLICY] Users read clinic agenda events ON agenda_events (schema.sql L20092-L20092)
CREATE POLICY "Users read clinic agenda events" ON "public"."agenda_events" FOR SELECT TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND "public"."can_read_clinic_data"("clinic_id") AND "public"."current_user_can"('agenda.read'::"text", "clinic_id")));

-- [POLICY] Users read clinic_group_color_slots ON clinic_group_color_slots (schema.sql L20159-L20159)
CREATE POLICY "Users read clinic_group_color_slots" ON "public"."clinic_group_color_slots" FOR SELECT TO "authenticated" USING ((("clinic_id" = "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid"))) AND "public"."current_user_can"('patients.read'::"text", "clinic_id")));

-- [POLICY] Users update clinic agenda events ON agenda_events (schema.sql L20199-L20199)
CREATE POLICY "Users update clinic agenda events" ON "public"."agenda_events" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('agenda.write'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('agenda.write'::"text", "clinic_id")));

-- [POLICY] Users write clinic agenda events ON agenda_events (schema.sql L20243-L20243)
CREATE POLICY "Users write clinic agenda events" ON "public"."agenda_events" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('agenda.write'::"text", "clinic_id")));

-- [POLICY] Users write clinic_group_color_slots ON clinic_group_color_slots (schema.sql L20267-L20267)
CREATE POLICY "Users write clinic_group_color_slots" ON "public"."clinic_group_color_slots" TO "authenticated" USING ((("clinic_id" = "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid"))) AND "public"."current_user_can"('patients.write'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" = "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid"))) AND "public"."current_user_can"('patients.write'::"text", "clinic_id")));
