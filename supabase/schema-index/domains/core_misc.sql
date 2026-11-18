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

-- [RPC/FUNCTION] calculate_affiliate_tier_benefits (schema.sql L1516-L1727)
CREATE OR REPLACE FUNCTION "public"."calculate_affiliate_tier_benefits"("_active_referrals" integer, "_floor_tier" "text" DEFAULT 'bronze'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_active integer := GREATEST(COALESCE(_active_referrals, 0), 0);
    v_norm_floor text := lower(trim(COALESCE(_floor_tier, 'bronze')));
    v_volume_rank integer;
    v_floor_rank integer;
    v_final_rank integer;
    v_tier text;
    v_first_month numeric(5,2);
    v_recurring numeric(5,2);
    v_discount numeric(5,2);
    v_eligible_plan text;
    v_waived boolean;
    v_extra jsonb;
BEGIN
    -- 3.1. Mapeamento hierárquico do Piso Garantido (_floor_tier)
    -- Suporte a identificadores canônicos e aliases em português
    CASE v_norm_floor
        WHEN 'legendary'  THEN v_floor_rank := 8;
        WHEN 'lenda'      THEN v_floor_rank := 8;
        WHEN 'diamond'    THEN v_floor_rank := 7;
        WHEN 'diamante'   THEN v_floor_rank := 7;
        WHEN 'emerald'    THEN v_floor_rank := 6;
        WHEN 'esmeralda'  THEN v_floor_rank := 6;
        WHEN 'ruby'       THEN v_floor_rank := 5;
        WHEN 'rubi'       THEN v_floor_rank := 5;
        WHEN 'sapphire'   THEN v_floor_rank := 4;
        WHEN 'safira'     THEN v_floor_rank := 4;
        WHEN 'gold'       THEN v_floor_rank := 3;
        WHEN 'ouro'       THEN v_floor_rank := 3;
        WHEN 'silver'     THEN v_floor_rank := 2;
        WHEN 'prata'      THEN v_floor_rank := 2;
        ELSE                   v_floor_rank := 1; -- Bronze ou default
    END CASE;

    -- 3.2. Mapeamento por Volume Orgânico de Assinantes Ativos
    IF v_active >= 201 THEN
        v_volume_rank := 8; -- Legendary (201+ ativos)
    ELSIF v_active >= 101 THEN
        v_volume_rank := 7; -- Diamond (101 a 200 ativos)
    ELSIF v_active >= 51 THEN
        v_volume_rank := 6; -- Emerald (51 a 100 ativos)
    ELSIF v_active >= 31 THEN
        v_volume_rank := 5; -- Ruby (31 a 50 ativos)
    ELSIF v_active >= 21 THEN
        v_volume_rank := 4; -- Sapphire (21 a 30 ativos)
    ELSIF v_active >= 11 THEN
        v_volume_rank := 3; -- Gold (11 a 20 ativos)
    ELSIF v_active >= 4 THEN
        v_volume_rank := 2; -- Silver (4 a 10 ativos)
    ELSE
        v_volume_rank := 1; -- Bronze (0 a 3 ativos)
    END IF;

    -- 3.3. Piso Estratégico Garantido (assume o maior degrau entre volume e piso contratual)
    v_final_rank := GREATEST(v_volume_rank, v_floor_rank);

    -- 3.4. Definição determinística das vantagens e benefícios dos 8 Tiers Oficiais
    CASE v_final_rank
        WHEN 8 THEN -- Legendary (201+ ativos)
            v_tier := 'legendary';
            v_first_month := 65.00;
            v_recurring := 30.00;
            v_discount := 100.00;
            v_eligible_plan := 'enterprise';
            v_waived := true;
            v_extra := jsonb_build_object(
                'badge_label', 'Lenda Pluri-Health',
                'color', '#7C3AED',
                'icon', '👑',
                'min_referrals', 201,
                'max_referrals', null,
                'description', '100% OFF no Plano Enterprise, negociação de patrocínios customizados e canal executivo direto.',
                'perks', jsonb_build_array('enterprise_plan_waived_100', 'custom_sponsorships', 'executive_direct_channel', 'legendary_badge')
            );

        WHEN 7 THEN -- Diamond (101-200 ativos)
            v_tier := 'diamond';
            v_first_month := 60.00;
            v_recurring := 28.00;
            v_discount := 100.00;
            v_eligible_plan := 'enterprise';
            v_waived := true;
            v_extra := jsonb_build_object(
                'badge_label', 'Parceiro Diamante',
                'color', '#06B6D4',
                'icon', '💎',
                'min_referrals', 101,
                'max_referrals', 200,
                'description', '100% OFF no Plano Enterprise e copatrocínio de 50% do estande em congressos e simpósios.',
                'perks', jsonb_build_array('enterprise_plan_waived_100', 'booth_co_sponsorship_50', 'vip_board_summit', 'diamond_badge')
            );

        WHEN 6 THEN -- Emerald (51-100 ativos)
            v_tier := 'emerald';
            v_first_month := 55.00;
            v_recurring := 25.00;
            v_discount := 100.00;
            v_eligible_plan := 'enterprise';
            v_waived := true;
            v_extra := jsonb_build_object(
                'badge_label', 'Autoridade Esmeralda',
                'color', '#059669',
                'icon', '🟢',
                'min_referrals', 51,
                'max_referrals', 100,
                'description', '100% OFF no Plano Enterprise e destaque oficial em eventos, palestras e webinars da Pluri.',
                'perks', jsonb_build_array('enterprise_plan_waived_100', 'events_speaker_reference', 'emerald_badge')
            );

        WHEN 5 THEN -- Ruby (31-50 ativos)
            v_tier := 'ruby';
            v_first_month := 50.00;
            v_recurring := 22.00;
            v_discount := 100.00;
            v_eligible_plan := 'enterprise';
            v_waived := true;
            v_extra := jsonb_build_object(
                'badge_label', 'Líder Rubi',
                'color', '#E11D48',
                'icon', '🔴',
                'min_referrals', 31,
                'max_referrals', 50,
                'description', '100% OFF no Plano Enterprise e consultoria trimestral de estratégia.',
                'perks', jsonb_build_array('enterprise_plan_waived_100', 'vip_founders_group', 'quarterly_strategy_consulting', 'ruby_badge')
            );

        WHEN 4 THEN -- Sapphire (21-30 ativos)
            v_tier := 'sapphire';
            v_first_month := 45.00;
            v_recurring := 19.00;
            v_discount := 100.00;
            v_eligible_plan := 'enterprise';
            v_waived := true;
            v_extra := jsonb_build_object(
                'badge_label', 'Embaixador Safira',
                'color', '#2563EB',
                'icon', '🔵',
                'min_referrals', 21,
                'max_referrals', 30,
                'description', '100% OFF no Plano Enterprise e acesso ao Grupo VIP de Afiliados e Fundadores.',
                'perks', jsonb_build_array('enterprise_plan_waived_100', 'vip_founders_group', 'sapphire_badge')
            );

        WHEN 3 THEN -- Gold (11-20 ativos)
            v_tier := 'gold';
            v_first_month := 40.00;
            v_recurring := 16.00;
            v_discount := 100.00;
            v_eligible_plan := 'team';
            v_waived := true;
            v_extra := jsonb_build_object(
                'badge_label', 'Embaixador Ouro',
                'color', '#EAB308',
                'icon', '🟡',
                'min_referrals', 11,
                'max_referrals', 20,
                'description', '100% OFF no Plano Clínica com Equipe e suporte prioritário via WhatsApp dedicado.',
                'perks', jsonb_build_array('team_plan_waived_100', 'dedicated_whatsapp_support', 'gold_badge')
            );

        WHEN 2 THEN -- Silver (4-10 ativos)
            v_tier := 'silver';
            v_first_month := 35.00;
            v_recurring := 13.00;
            v_discount := 100.00;
            v_eligible_plan := 'solo';
            v_waived := true;
            v_extra := jsonb_build_object(
                'badge_label', 'Embaixador Prata',
                'color', '#94A3B8',
                'icon', '⚪',
                'min_referrals', 4,
                'max_referrals', 10,
                'solo_plan_discount_percent', 100.00,
                'team_plan_discount_percent', 50.00,
                'description', '100% OFF no Plano Profissional Solo ou 50% OFF no Plano com Equipe. Tag oficial de Embaixador Prata.',
                'perks', jsonb_build_array('solo_plan_waived_100', 'team_plan_discount_50', 'silver_badge')
            );

        ELSE -- Bronze (0-3 ativos)
            v_tier := 'bronze';
            v_first_month := 30.00;
            v_recurring := 10.00;
            v_discount := 0.00;
            v_eligible_plan := 'none';
            v_waived := false;
            v_extra := jsonb_build_object(
                'badge_label', 'Afiliado Bronze',
                'color', '#CD7F32',
                'icon', '🟤',
                'min_referrals', 0,
                'max_referrals', 3,
                'description', 'Mini-CRM, link oficial, cupom nominal próprio e kit inicial de divulgação.',
                'perks', jsonb_build_array('mini_crm', 'affiliate_link', 'nominal_coupon', 'starter_kit', 'bronze_badge')
            );
    END CASE;

    RETURN jsonb_build_object(
        'tier', v_tier,
        'first_month_commission_percent', v_first_month,
        'recurring_commission_percent', v_recurring,
        'plan_discount_percent', v_discount,
        'eligible_plan_tier', v_eligible_plan,
        'is_subscription_waived', v_waived,
        'extra_benefits', v_extra
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

-- [RPC/FUNCTION] get_document_signature_by_token (schema.sql L5833-L5889)
CREATE OR REPLACE FUNCTION "public"."get_document_signature_by_token"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  _token_clean text := trim(coalesce(p_token, ''));
  _doc public.clinic_document_signatures%ROWTYPE;
  _clinic_name text;
  _clinic_logo_url text;
  _patient_name text;
BEGIN
  IF _token_clean = '' THEN
    RAISE EXCEPTION 'Token de assinatura inválido.';
  END IF;

  SELECT *
  INTO _doc
  FROM public.clinic_document_signatures
  WHERE sign_token = _token_clean
    AND deleted_at IS NULL
  LIMIT 1;

  IF _doc.id IS NULL THEN
    RAISE EXCEPTION 'Documento para assinatura não encontrado ou removido.';
  END IF;

  SELECT c.name, c.logo_url
  INTO _clinic_name, _clinic_logo_url
  FROM public.clinics c
  WHERE c.id = _doc.clinic_id;

  SELECT p.name
  INTO _patient_name
  FROM public.patients p
  WHERE p.id = _doc.patient_id
    AND p.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'id', _doc.id,
    'clinic_id', _doc.clinic_id,
    'clinic_name', COALESCE(NULLIF(trim(_clinic_name), ''), 'Clínica'),
    'clinic_logo_url', _clinic_logo_url,
    'patient_id', _doc.patient_id,
    'patient_name', _patient_name,
    'session_id', _doc.session_id,
    'template_id', _doc.template_id,
    'template_title', _doc.template_title,
    'rendered_markdown', _doc.rendered_markdown,
    'status', _doc.status,
    'signer_name', _doc.signer_name,
    'signer_role', _doc.signer_role,
    'signed_at', _doc.signed_at,
    'already_signed', (_doc.status IN ('signed_in_person', 'signed_remote')),
    'created_at', _doc.created_at
  );
END;
$$;

-- [RPC/FUNCTION] handle_personal_signup (schema.sql L7003-L7246)
CREATE OR REPLACE FUNCTION "public"."handle_personal_signup"("_user_id" "uuid", "_email" "text", "_full_name" "text" DEFAULT NULL::"text", "_cpf" "text" DEFAULT NULL::"text", "_phone" "text" DEFAULT NULL::"text", "_birth_date" "date" DEFAULT NULL::"date", "_profession" "text" DEFAULT NULL::"text", "_council_number" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  _normalized_cpf text;
  _clean_name text;
  _clean_phone text;
  _clean_profession text;
  _clean_council_number text;
  _existing_cpf_user_id uuid;
  v_public_code text;
  v_clinic_id uuid;
  v_route_suffix text;
  v_route_key text;
  v_clinic_name text;
  v_trial_end timestamptz;
  v_is_already_owner boolean := false;
BEGIN
  -- Higienização dos campos de entrada
  _normalized_cpf := NULLIF(regexp_replace(COALESCE(_cpf, ''), '\D', '', 'g'), '');
  _clean_name := NULLIF(trim(COALESCE(_full_name, '')), '');
  _clean_phone := NULLIF(trim(COALESCE(_phone, '')), '');
  _clean_profession := NULLIF(trim(COALESCE(_profession, '')), '');
  _clean_council_number := NULLIF(trim(COALESCE(_council_number, '')), '');

  -- Validação atômica de CPF: se já existir outro usuário com o mesmo CPF higienizado
  IF _normalized_cpf IS NOT NULL THEN
    SELECT id INTO _existing_cpf_user_id
    FROM public.profiles
    WHERE cpf = _normalized_cpf
      AND id <> _user_id
    LIMIT 1;

    IF _existing_cpf_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'Este CPF já está cadastrado em outra conta.' USING ERRCODE = '23505';
    END IF;
  END IF;

  -- Obter ou gerar o ID Global do perfil (public_code)
  SELECT public_code INTO v_public_code
  FROM public.profiles
  WHERE id = _user_id;

  IF v_public_code IS NULL OR trim(v_public_code) = '' THEN
    v_public_code := public.generate_profile_public_code();
  END IF;

  -- Inserir ou atualizar perfil
  INSERT INTO public.profiles (
    id,
    clinic_id,
    email,
    full_name,
    cpf,
    phone,
    birth_date,
    public_code,
    profession,
    council_name,
    professional_license
  )
  VALUES (
    _user_id,
    NULL,
    lower(trim(_email)),
    _clean_name,
    _normalized_cpf,
    _clean_phone,
    _birth_date,
    v_public_code,
    _clean_profession,
    'CREFITO',
    _clean_council_number
  )
  ON CONFLICT (id) DO UPDATE
  SET email = lower(trim(EXCLUDED.email)),
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      cpf = COALESCE(EXCLUDED.cpf, profiles.cpf),
      phone = COALESCE(EXCLUDED.phone, profiles.phone),
      birth_date = COALESCE(EXCLUDED.birth_date, profiles.birth_date),
      profession = COALESCE(EXCLUDED.profession, profiles.profession),
      council_name = COALESCE(EXCLUDED.council_name, profiles.council_name, 'CREFITO'),
      professional_license = COALESCE(EXCLUDED.professional_license, profiles.professional_license),
      public_code = COALESCE(profiles.public_code, EXCLUDED.public_code),
      updated_at = now();

  -- Papel básico de usuário
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Checar se o usuário já é owner de alguma clínica
  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_memberships cm
    WHERE cm.user_id = _user_id
      AND cm.is_active = true
      AND (cm.account_role = 'account_owner' OR cm.operational_role = 'owner')
  ) OR EXISTS (
    SELECT 1
    FROM public.clinics c
    WHERE c.account_owner_user_id = _user_id
  ) INTO v_is_already_owner;

  -- Se NÃO for owner de nenhuma clínica, provisionar consultório solo gratuito
  IF NOT v_is_already_owner THEN
    v_trial_end := now() + interval '7 days';
    v_clinic_name := 'Consultório - ' || COALESCE(_clean_name, 'Profissional');

    -- Formatar route_key: 'consultorio-' || lower(regexp_replace(v_public_code, '^PLR-|-', '', 'g'))
    v_route_suffix := lower(regexp_replace(COALESCE(v_public_code, gen_random_uuid()::text), '^PLR-|-', '', 'g'));
    v_route_key := 'consultorio-' || v_route_suffix;

    -- Garantir unicidade do route_key caso colida por rara coincidência
    IF EXISTS (SELECT 1 FROM public.clinics WHERE route_key = v_route_key) THEN
      v_route_key := v_route_key || '-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    END IF;

    -- Inserir clínica solo
    INSERT INTO public.clinics (
      name,
      cnpj,
      route_key,
      subscription_plan,
      access_status,
      concurrent_access_limit,
      subaccount_limit,
      account_owner_user_id
    )
    VALUES (
      v_clinic_name,
      COALESCE(_normalized_cpf, '00000000000'),
      v_route_key,
      'prof_basico'::public.subscription_plan,
      'active',
      1,
      1,
      _user_id
    )
    RETURNING id INTO v_clinic_id;

    -- Inserir assinatura em teste gratuito (7 dias, 20 atendimentos, 1 acesso)
    INSERT INTO public.clinic_subscriptions (
      clinic_id,
      account_owner_user_id,
      plan_type,
      billing_cycle,
      payment_method,
      base_monthly_price,
      base_concurrent_access_count,
      total_recurring_monthly_price,
      base_subaccount_limit,
      status,
      is_free_trial,
      is_read_only,
      trial_ends_at,
      trial_max_attendances,
      trial_max_patients,
      trial_max_custom_forms,
      period_duration_days,
      current_period_start,
      current_period_end,
      expires_at
    )
    VALUES (
      v_clinic_id,
      _user_id,
      'prof_basico'::public.subscription_plan,
      'ANNUAL',
      'TRIAL',
      39.99,
      1,
      0,
      1,
      'TRIAL',
      true,
      false,
      v_trial_end,
      20,
      5,
      1,
      7,
      now(),
      v_trial_end,
      v_trial_end
    )
    ON CONFLICT (clinic_id) DO NOTHING;

    -- Vínculo de membership: account_owner, operational_role 'owner', role_key 'owner', status 'active'
    INSERT INTO public.clinic_memberships (
      clinic_id,
      user_id,
      account_role,
      operational_role,
      role_key,
      membership_status,
      is_active
    )
    VALUES (
      v_clinic_id,
      _user_id,
      'account_owner',
      'owner',
      'owner',
      'active',
      true
    )
    ON CONFLICT (clinic_id, user_id) DO UPDATE
    SET
      account_role = 'account_owner',
      operational_role = 'owner',
      role_key = 'owner',
      membership_status = 'active',
      is_active = true,
      updated_at = now();

    -- Definir contexto ativo inicial
    INSERT INTO public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
    VALUES (_user_id, v_clinic_id, now())
    ON CONFLICT (user_id) DO UPDATE
    SET clinic_id = EXCLUDED.clinic_id, updated_at = now();

    -- Atualizar clinic_id no profile
    UPDATE public.profiles
    SET clinic_id = COALESCE(clinic_id, v_clinic_id)
    WHERE id = _user_id;

    RETURN jsonb_build_object(
      'user_id', _user_id,
      'has_clinic', true,
      'clinic_id', v_clinic_id,
      'route_key', v_route_key,
      'subscription_plan', 'prof_basico',
      'subscription_status', 'trialing'
    );
  END IF;

  RETURN jsonb_build_object(
    'user_id', _user_id,
    'has_clinic', true
  );
END;
$$;

-- [RPC/FUNCTION] handle_signup (schema.sql L7265-L7305)
CREATE OR REPLACE FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_full_name" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _clinic_id uuid;
  _is_super_admin boolean := false;
BEGIN
  -- Find or create clinic by CNPJ
  SELECT id INTO _clinic_id FROM public.clinics WHERE cnpj = _cnpj;
  
  IF _clinic_id IS NULL THEN
    INSERT INTO public.clinics (cnpj, name)
    VALUES (_cnpj, 'Clínica ' || _cnpj)
    RETURNING id INTO _clinic_id;
  END IF;
  
  -- Create profile
  INSERT INTO public.profiles (id, clinic_id, email, full_name)
  VALUES (_user_id, _clinic_id, _email, _full_name)
  ON CONFLICT (id) DO NOTHING;
  
  -- Check if super admin (hardcoded email)
  -- The platform owner can change this email
  IF _email = 'admin@prontohealthfisio.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    _is_super_admin := true;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN jsonb_build_object(
    'clinic_id', _clinic_id,
    'is_super_admin', _is_super_admin
  );
END;
$$;

-- [RPC/FUNCTION] handle_signup (schema.sql L7311-L7387)
CREATE OR REPLACE FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan" DEFAULT 'solo'::"public"."subscription_plan", "_full_name" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _clinic_id uuid;
  _is_super_admin boolean := false;
BEGIN
  SELECT id INTO _clinic_id
  FROM public.clinics
  WHERE cnpj = _cnpj;

  IF _clinic_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ja existe uma clinica cadastrada com este CNPJ.';
  END IF;

  INSERT INTO public.clinics (
    cnpj,
    name,
    subscription_plan,
    subaccount_limit
  )
  VALUES (
    _cnpj,
    'Clínica ' || _cnpj,
    _subscription_plan,
    CASE WHEN _subscription_plan = 'clinic' THEN 4 ELSE 0 END
  )
  RETURNING id INTO _clinic_id;

  INSERT INTO public.profiles (id, clinic_id, email, full_name)
  VALUES (_user_id, _clinic_id, _email, _full_name)
  ON CONFLICT (id) DO UPDATE
  SET clinic_id = EXCLUDED.clinic_id,
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  INSERT INTO public.clinic_memberships (
    clinic_id,
    user_id,
    account_role,
    operational_role,
    membership_status,
    is_active
  )
  VALUES (
    _clinic_id,
    _user_id,
    'account_owner',
    'owner',
    'active',
    true
  )
  ON CONFLICT (clinic_id, user_id) DO NOTHING;

  UPDATE public.clinics
  SET account_owner_user_id = _user_id
  WHERE id = _clinic_id;

  IF _email = 'admin@prontohealthfisio.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    _is_super_admin := true;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'clinic_id', _clinic_id,
    'subscription_plan', _subscription_plan,
    'is_super_admin', _is_super_admin
  );
END;
$$;

-- [RPC/FUNCTION] handle_signup (schema.sql L7393-L7479)
CREATE OR REPLACE FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan" DEFAULT 'solo'::"public"."subscription_plan", "_full_name" "text" DEFAULT NULL::"text", "_clinic_name" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _clinic_id uuid;
  _is_super_admin boolean := false;
  _resolved_clinic_name text := left(nullif(trim(coalesce(_clinic_name, '')), ''), 120);
BEGIN
  SELECT id INTO _clinic_id
  FROM public.clinics
  WHERE cnpj = _cnpj;

  IF _clinic_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ja existe uma clinica cadastrada com este CNPJ.';
  END IF;

  _resolved_clinic_name := coalesce(_resolved_clinic_name, 'Clínica ' || _cnpj);

  INSERT INTO public.clinics (
    cnpj,
    email,
    legal_name,
    name,
    subscription_plan,
    subaccount_limit,
    concurrent_access_limit
  )
  VALUES (
    _cnpj,
    _email,
    _resolved_clinic_name,
    _resolved_clinic_name,
    _subscription_plan,
    CASE WHEN _subscription_plan = 'clinic' THEN 30 ELSE 0 END,
    CASE WHEN _subscription_plan = 'clinic' THEN 2 ELSE 1 END
  )
  RETURNING id INTO _clinic_id;

  INSERT INTO public.profiles (id, clinic_id, email, full_name)
  VALUES (_user_id, _clinic_id, _email, _full_name)
  ON CONFLICT (id) DO UPDATE
  SET clinic_id = EXCLUDED.clinic_id,
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  INSERT INTO public.clinic_memberships (
    clinic_id,
    user_id,
    account_role,
    operational_role,
    membership_status,
    is_active
  )
  VALUES (
    _clinic_id,
    _user_id,
    'account_owner',
    'owner',
    'active',
    true
  )
  ON CONFLICT (clinic_id, user_id) DO NOTHING;

  UPDATE public.clinics
  SET account_owner_user_id = _user_id
  WHERE id = _clinic_id;

  IF _email = 'admin@prontohealthfisio.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    _is_super_admin := true;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'clinic_id', _clinic_id,
    'clinic_name', _resolved_clinic_name,
    'subscription_plan', _subscription_plan,
    'is_super_admin', _is_super_admin
  );
END;
$$;

-- [RPC/FUNCTION] handle_signup (schema.sql L7485-L7618)
CREATE OR REPLACE FUNCTION "public"."handle_signup"("_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan" DEFAULT 'solo'::"public"."subscription_plan", "_full_name" "text" DEFAULT NULL::"text", "_clinic_name" "text" DEFAULT NULL::"text", "_allow_duplicate_cnpj" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _clinic_id uuid;
  _existing_clinic_id uuid;
  _existing_owner_user_id uuid;
  _existing_clinic_name text;
  _is_super_admin boolean := false;
  _resolved_clinic_name text := left(nullif(trim(coalesce(_clinic_name, '')), ''), 120);
  _subaccount_limit integer;
  _concurrent_limit integer;
  _plan_str text := lower(_subscription_plan::text);
BEGIN
  -- Verificar se já existe clínica cadastrada com este CNPJ
  SELECT id, account_owner_user_id, name 
  INTO _existing_clinic_id, _existing_owner_user_id, _existing_clinic_name
  FROM public.clinics
  WHERE cnpj = _cnpj
  ORDER BY created_at ASC
  LIMIT 1;

  IF _existing_clinic_id IS NOT NULL THEN
    -- Caso 1: O CNPJ pertence a OUTRO usuário na plataforma
    IF _existing_owner_user_id IS DISTINCT FROM _user_id THEN
      RAISE EXCEPTION 'CNPJ_REGISTERED_TO_OTHER_USER';
    END IF;

    -- Caso 2: O CNPJ pertence ao MESMO usuário, mas ele ainda não confirmou a duplicação
    IF NOT _allow_duplicate_cnpj THEN
      RAISE EXCEPTION 'OWNER_HAS_CLINIC_WITH_CNPJ:%', _existing_clinic_name;
    END IF;
  END IF;

  _resolved_clinic_name := coalesce(_resolved_clinic_name, 'Clínica ' || _cnpj);

  -- Definir limites iniciais de acordo com a matriz de 6 planos
  IF _plan_str IN ('clinica_top', 'enterprise') THEN
    _subaccount_limit := 999999;
    _concurrent_limit := 8;
  ELSIF _plan_str IN ('clinica_medio', 'clinic') THEN
    _subaccount_limit := 999999;
    _concurrent_limit := 4;
  ELSIF _plan_str = 'clinica_basico' THEN
    _subaccount_limit := 999999;
    _concurrent_limit := 2;
  ELSIF _plan_str = 'prof_top' THEN
    _subaccount_limit := 2;
    _concurrent_limit := 2;
  ELSE
    -- prof_basico, prof_medio, solo
    _subaccount_limit := 1;
    _concurrent_limit := 1;
  END IF;

  INSERT INTO public.clinics (
    cnpj,
    email,
    legal_name,
    name,
    subscription_plan,
    subaccount_limit,
    concurrent_access_limit,
    account_owner_user_id
  )
  VALUES (
    _cnpj,
    _email,
    _resolved_clinic_name,
    _resolved_clinic_name,
    _subscription_plan,
    _subaccount_limit,
    _concurrent_limit,
    _user_id
  )
  RETURNING id INTO _clinic_id;

  INSERT INTO public.profiles (id, clinic_id, email, full_name)
  VALUES (_user_id, _clinic_id, _email, _full_name)
  ON CONFLICT (id) DO UPDATE
  SET clinic_id = COALESCE(profiles.clinic_id, EXCLUDED.clinic_id),
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  INSERT INTO public.clinic_memberships (
    clinic_id,
    user_id,
    account_role,
    operational_role,
    role_key,
    membership_status,
    is_active
  )
  VALUES (
    _clinic_id,
    _user_id,
    'account_owner'::account_role_type,
    'owner',
    'owner',
    'active',
    true
  )
  ON CONFLICT (clinic_id, user_id) DO UPDATE
  SET account_role = 'account_owner',
      operational_role = 'owner',
      role_key = 'owner',
      membership_status = 'active',
      is_active = true,
      updated_at = now();

  UPDATE public.clinics
  SET account_owner_user_id = _user_id
  WHERE id = _clinic_id;

  IF _email = 'admin@prontohealthfisio.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    _is_super_admin := true;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'clinic_id', _clinic_id,
    'clinic_name', _resolved_clinic_name,
    'subscription_plan', _subscription_plan,
    'is_super_admin', _is_super_admin
  );
END;
$$;

-- [RPC/FUNCTION] log_security_event (schema.sql L9049-L9145)
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

-- [RPC/FUNCTION] move_entity_to_trash (schema.sql L9447-L9564)
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

-- [RPC/FUNCTION] prevent_affiliate_pyramid_structure (schema.sql L10016-L10029)
CREATE OR REPLACE FUNCTION "public"."prevent_affiliate_pyramid_structure"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    -- Trava Anti-Pirâmide (Lei Federal nº 1.521/1951 - Art. 2º, IX):
    -- Proibição expressa de criação de redes em cascata, sub-afiliados ou matriz multinível.
    IF NEW.parent_affiliate_id IS NOT NULL THEN
        RAISE EXCEPTION 'Operação proibida (Lei 1.521/51): Estruturas multinível e sub-afiliações são estritamente proibidas no Pluri-Health. O modelo é exclusivamente de nível único (single-level).';
    END IF;

    RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] prevent_affiliate_self_referral (schema.sql L10039-L10071)
CREATE OR REPLACE FUNCTION "public"."prevent_affiliate_self_referral"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_affiliate_user_id UUID;
    v_clinic_owner_id UUID;
BEGIN
    SELECT user_id INTO v_affiliate_user_id
    FROM public.affiliates
    WHERE id = NEW.affiliate_id;

    -- 1. Bloqueio por usuário pagador / auth.uid
    IF v_affiliate_user_id IS NOT NULL AND NEW.customer_user_id IS NOT NULL THEN
        IF NEW.customer_user_id = v_affiliate_user_id THEN
            RAISE EXCEPTION 'Auto-indicação proibida: Um usuário não pode utilizar o próprio cupom de afiliado.';
        END IF;
    END IF;

    -- 2. Bloqueio por titularidade da clínica pagadora indicada
    IF v_affiliate_user_id IS NOT NULL AND NEW.clinic_id IS NOT NULL THEN
        SELECT account_owner_user_id INTO v_clinic_owner_id
        FROM public.clinics
        WHERE id = NEW.clinic_id;

        IF v_clinic_owner_id IS NOT NULL AND v_clinic_owner_id = v_affiliate_user_id THEN
            RAISE EXCEPTION 'Auto-indicação proibida: Um usuário não pode utilizar o próprio cupom de afiliado.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] purge_expired_operational_data (schema.sql L10260-L10290)
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

-- [RPC/FUNCTION] raise_exception_json (schema.sql L10316-L10322)
CREATE OR REPLACE FUNCTION "public"."raise_exception_json"("_message" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
begin
  raise exception '%', _message;
end;
$$;

-- [RPC/FUNCTION] recalculate_affiliate_tier (schema.sql L10328-L10448)
CREATE OR REPLACE FUNCTION "public"."recalculate_affiliate_tier"("_affiliate_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_affiliate public.affiliates%ROWTYPE;
    v_active_count integer;
    v_total_sales integer;
    v_calc jsonb;
    v_effective_floor text;
    v_final_tier text;
    v_final_first_month numeric(5,2);
    v_final_recurring numeric(5,2);
    v_final_plan_discount numeric(5,2);
    v_final_eligible_plan text;
    v_final_waived boolean;
    v_result jsonb;
BEGIN
    IF _affiliate_id IS NULL THEN
        RAISE EXCEPTION 'ID do afiliado não informado.';
    END IF;

    -- Obter e bloquear linha do afiliado para garantir atomicidade
    SELECT * INTO v_affiliate
    FROM public.affiliates
    WHERE id = _affiliate_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF v_affiliate.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Afiliado não encontrado ou deletado.'
        );
    END IF;

    -- Conta ativos em affiliate_conversions onde status = 'active' AND deleted_at IS NULL
    SELECT 
        COUNT(*) FILTER (WHERE status = 'active' AND deleted_at IS NULL)::integer,
        COUNT(*) FILTER (WHERE deleted_at IS NULL)::integer
    INTO 
        v_active_count,
        v_total_sales
    FROM public.affiliate_conversions
    WHERE affiliate_id = _affiliate_id;

    v_active_count := COALESCE(v_active_count, 0);
    v_total_sales := COALESCE(v_total_sales, 0);

    -- Determina o piso base: usa minimum_tier_floor ou bronze por padrão
    v_effective_floor := COALESCE(v_affiliate.minimum_tier_floor, 'bronze');

    -- Se houver override manual de tier ativo, usa o tier fixado como referência de piso
    IF v_affiliate.is_tier_manual_override THEN
        v_effective_floor := COALESCE(v_affiliate.tier, v_effective_floor);
    END IF;

    -- Benefícios calculados pelo motor de gamificação
    v_calc := public.calculate_affiliate_tier_benefits(v_active_count, v_effective_floor);

    -- Tratamento de Overrides Manuais:
    -- 1. Tier e Comissões
    IF v_affiliate.is_tier_manual_override THEN
        -- Respeita o override manual: preserva tier e eventuais comissões customizadas pelo admin
        v_final_tier := v_affiliate.tier;
        v_final_first_month := v_affiliate.first_month_commission_percent;
        v_final_recurring := v_affiliate.recurring_commission_percent;
        v_final_plan_discount := v_affiliate.plan_discount_percent;
        v_final_eligible_plan := v_affiliate.eligible_plan_tier;
    ELSE
        -- Aplica os parâmetros dinâmicos calculados pela esteira de gamificação
        v_final_tier := (v_calc->>'tier')::text;
        v_final_first_month := (v_calc->>'first_month_commission_percent')::numeric(5,2);
        v_final_recurring := (v_calc->>'recurring_commission_percent')::numeric(5,2);
        v_final_plan_discount := (v_calc->>'plan_discount_percent')::numeric(5,2);
        v_final_eligible_plan := (v_calc->>'eligible_plan_tier')::text;
    END IF;

    -- 2. Isenção da Assinatura (Waiver Policy)
    IF v_affiliate.is_waiver_manual_override THEN
        -- Respeita o override manual: preserva o status de isenção da clínica do parceiro
        v_final_waived := v_affiliate.is_subscription_waived;
    ELSE
        -- Aplica o waiver calculado dinamicamente
        v_final_waived := (v_calc->>'is_subscription_waived')::boolean;
    END IF;

    -- Atualiza o registro em public.affiliates
    UPDATE public.affiliates
    SET active_referrals_count = v_active_count,
        total_sales_count = v_total_sales,
        tier = v_final_tier,
        first_month_commission_percent = v_final_first_month,
        recurring_commission_percent = v_final_recurring,
        plan_discount_percent = v_final_plan_discount,
        eligible_plan_tier = v_final_eligible_plan,
        is_subscription_waived = v_final_waived,
        updated_at = now()
    WHERE id = _affiliate_id;

    v_result := jsonb_build_object(
        'success', true,
        'affiliate_id', _affiliate_id,
        'active_referrals_count', v_active_count,
        'total_sales_count', v_total_sales,
        'tier', v_final_tier,
        'minimum_tier_floor', v_affiliate.minimum_tier_floor,
        'is_tier_manual_override', v_affiliate.is_tier_manual_override,
        'first_month_commission_percent', v_final_first_month,
        'recurring_commission_percent', v_final_recurring,
        'plan_discount_percent', v_final_plan_discount,
        'eligible_plan_tier', v_final_eligible_plan,
        'is_subscription_waived', v_final_waived,
        'is_waiver_manual_override', v_affiliate.is_waiver_manual_override,
        'extra_benefits', v_calc->'extra_benefits',
        'updated_at', now()
    );

    RETURN v_result;
END;
$$;

-- [RPC/FUNCTION] request_account_recovery_status (schema.sql L10926-L11062)
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

-- [RPC/FUNCTION] respond_affiliate_invitation (schema.sql L11215-L11334)
CREATE OR REPLACE FUNCTION "public"."respond_affiliate_invitation"("_invitation_id" "uuid", "_response" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
DECLARE
    _user_id UUID := auth.uid();
    _user_email TEXT;
    _invitation public.affiliate_invitations%ROWTYPE;
    _current_affiliate public.affiliates%ROWTYPE;
    _is_authorized BOOLEAN := false;
BEGIN
    IF _user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    IF _response IS NULL OR _response NOT IN ('accepted', 'rejected') THEN
        RAISE EXCEPTION 'Resposta inválida. Deve ser accepted ou rejected.';
    END IF;

    SELECT lower(email) INTO _user_email
    FROM auth.users
    WHERE id = _user_id;

    IF _user_email IS NULL THEN
        _user_email := lower(coalesce(auth.jwt() ->> 'email', ''));
    END IF;

    SELECT * INTO _invitation
    FROM public.affiliate_invitations
    WHERE id = _invitation_id
      AND deleted_at IS NULL;

    IF _invitation.id IS NULL THEN
        RAISE EXCEPTION 'Convite não encontrado ou cancelado.';
    END IF;

    -- Validar se o usuário autenticado é o destinatário do convite ou platform admin
    IF _invitation.invited_user_id IS NOT NULL AND _invitation.invited_user_id = _user_id THEN
        _is_authorized := true;
    ELSIF _invitation.invited_email IS NOT NULL AND lower(_invitation.invited_email) = _user_email THEN
        _is_authorized := true;
    ELSIF public.is_platform_admin(_user_id) OR public.has_role(_user_id, 'super_admin'::public.app_role) THEN
        _is_authorized := true;
    END IF;

    IF NOT _is_authorized THEN
        RAISE EXCEPTION 'Permissão negada para responder a este convite.';
    END IF;

    -- Validar se o convite já foi respondido
    IF _invitation.status <> 'pending' THEN
        RAISE EXCEPTION 'Este convite já foi respondido anteriormente (status: %).', _invitation.status;
    END IF;

    -- Validar expiração
    IF _invitation.expires_at < now() THEN
        UPDATE public.affiliate_invitations
        SET status = 'expired',
            updated_at = now()
        WHERE id = _invitation_id;

        RAISE EXCEPTION 'Este convite expirou em %.', to_char(_invitation.expires_at, 'DD/MM/YYYY HH24:MI');
    END IF;

    IF _response = 'rejected' THEN
        UPDATE public.affiliate_invitations
        SET status = 'rejected',
            responded_at = now(),
            updated_at = now()
        WHERE id = _invitation_id;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'rejected',
            'invitation_id', _invitation_id,
            'message', 'Convite recusado com sucesso.'
        );
    END IF;

    -- Se response = 'accepted':
    -- 1. Validar se o usuário já possui afiliação e checar trava de cooldown
    SELECT * INTO _current_affiliate
    FROM public.affiliates
    WHERE user_id = _user_id
      AND deleted_at IS NULL
    LIMIT 1;

    IF _current_affiliate.id IS NOT NULL THEN
        IF _current_affiliate.can_change_affiliate_context_after IS NOT NULL 
           AND _current_affiliate.can_change_affiliate_context_after > now() THEN
            RAISE EXCEPTION 'Período de cooldown ativo (anti-pingue-pongue). Você poderá alterar seu contexto de afiliação após %.',
                to_char(_current_affiliate.can_change_affiliate_context_after, 'DD/MM/YYYY HH24:MI');
        END IF;

        -- Atualiza o vínculo do afiliado para a clínica do convite e grava cooldown de 15 dias
        UPDATE public.affiliates
        SET clinic_id = _invitation.clinic_id,
            minimum_tier_floor = COALESCE(_invitation.floor_tier, minimum_tier_floor),
            can_change_affiliate_context_after = now() + interval '15 days',
            updated_at = now()
        WHERE id = _current_affiliate.id;
    END IF;

    -- 2. Atualizar status do convite
    UPDATE public.affiliate_invitations
    SET status = 'accepted',
        invited_user_id = COALESCE(invited_user_id, _user_id),
        responded_at = now(),
        updated_at = now()
    WHERE id = _invitation_id;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'accepted',
        'invitation_id', _invitation_id,
        'clinic_id', _invitation.clinic_id,
        'message', 'Convite aceito com sucesso! Vínculo de afiliação atualizado.'
    );
END;
$$;

-- [RPC/FUNCTION] restore_entity_from_trash (schema.sql L11344-L11453)
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

-- [RPC/FUNCTION] rpc_get_available_slots (schema.sql L11724-L11782)
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

-- [RPC/FUNCTION] set_updated_at (schema.sql L11960-L11967)
CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- [RPC/FUNCTION] slugify_text (schema.sql L12101-L12125)
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

-- [RPC/FUNCTION] submit_document_signature_by_token (schema.sql L12197-L12278)
CREATE OR REPLACE FUNCTION "public"."submit_document_signature_by_token"("p_token" "text", "p_signer_name" "text", "p_signer_cpf" "text", "p_signature_image_url" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  _token_clean text := trim(coalesce(p_token, ''));
  _signer_name text := left(trim(coalesce(p_signer_name, '')), 200);
  _signer_cpf text := nullif(regexp_replace(coalesce(p_signer_cpf, ''), '\D', '', 'g'), '');
  _signature_url text := nullif(trim(coalesce(p_signature_image_url, '')), '');
  _metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  _doc public.clinic_document_signatures%ROWTYPE;
  _updated public.clinic_document_signatures%ROWTYPE;
  _merged_metadata jsonb;
BEGIN
  IF _token_clean = '' THEN
    RAISE EXCEPTION 'Token de assinatura inválido.';
  END IF;

  IF length(_signer_name) < 2 THEN
    RAISE EXCEPTION 'Informe o nome completo do assinante.';
  END IF;

  IF _signer_cpf IS NOT NULL AND length(_signer_cpf) <> 11 THEN
    RAISE EXCEPTION 'CPF inválido. Informe os 11 dígitos.';
  END IF;

  IF _signature_url IS NULL THEN
    RAISE EXCEPTION 'A assinatura visual é obrigatória.';
  END IF;

  SELECT *
  INTO _doc
  FROM public.clinic_document_signatures
  WHERE sign_token = _token_clean
    AND deleted_at IS NULL
  FOR UPDATE;

  IF _doc.id IS NULL THEN
    RAISE EXCEPTION 'Documento para assinatura não encontrado ou removido.';
  END IF;

  IF _doc.status IN ('signed_in_person', 'signed_remote') THEN
    RAISE EXCEPTION 'Este documento já foi assinado anteriormente.';
  END IF;

  _merged_metadata := COALESCE(_doc.signature_metadata, '{}'::jsonb)
    || _metadata
    || jsonb_build_object(
      'server_signed_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'signed_method', 'remote_link'
    );

  UPDATE public.clinic_document_signatures
  SET
    status = 'signed_remote',
    signer_name = _signer_name,
    signer_cpf = COALESCE(_signer_cpf, signer_cpf),
    signer_role = COALESCE(
      signer_role,
      CASE
        WHEN (_metadata ->> 'signer_role') IN ('paciente', 'responsavel', 'colaborador', 'owner')
          THEN (_metadata ->> 'signer_role')
        ELSE NULL
      END
    ),
    signature_image_url = _signature_url,
    signature_metadata = _merged_metadata,
    signed_at = now(),
    updated_at = now()
  WHERE id = _doc.id
  RETURNING * INTO _updated;

  RETURN jsonb_build_object(
    'success', true,
    'id', _updated.id,
    'status', _updated.status,
    'signer_name', _updated.signer_name,
    'signed_at', _updated.signed_at,
    'template_title', _updated.template_title
  );
END;
$$;

-- [RPC/FUNCTION] trg_affiliate_conversions_sync_tier (schema.sql L12917-L12955)
CREATE OR REPLACE FUNCTION "public"."trg_affiliate_conversions_sync_tier"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    -- Ao inserir nova conversão
    IF (TG_OP = 'INSERT') THEN
        IF NEW.affiliate_id IS NOT NULL THEN
            PERFORM public.recalculate_affiliate_tier(NEW.affiliate_id);
        END IF;
        RETURN NEW;
    END IF;

    -- Ao atualizar conversão existente
    IF (TG_OP = 'UPDATE') THEN
        -- Recalcula para o afiliado atual se ativo
        IF NEW.affiliate_id IS NOT NULL THEN
            PERFORM public.recalculate_affiliate_tier(NEW.affiliate_id);
        END IF;

        -- Se houver transferência de afiliado, recalcula também para o afiliado anterior
        IF OLD.affiliate_id IS NOT NULL AND OLD.affiliate_id IS DISTINCT FROM NEW.affiliate_id THEN
            PERFORM public.recalculate_affiliate_tier(OLD.affiliate_id);
        END IF;

        RETURN NEW;
    END IF;

    -- Ao excluir conversão
    IF (TG_OP = 'DELETE') THEN
        IF OLD.affiliate_id IS NOT NULL THEN
            PERFORM public.recalculate_affiliate_tier(OLD.affiliate_id);
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

-- [RPC/FUNCTION] trg_increment_row_version (schema.sql L12984-L12991)
CREATE OR REPLACE FUNCTION "public"."trg_increment_row_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 1) + 1;
  RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] update_updated_at_column (schema.sql L13992-L14000)
CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] validate_affiliate_unique_financial_data (schema.sql L14407-L14440)
CREATE OR REPLACE FUNCTION "public"."validate_affiliate_unique_financial_data"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    -- Unicidade de Chave PIX
    IF NEW.pix_key IS NOT NULL AND BTRIM(NEW.pix_key) <> '' THEN
        IF EXISTS (
            SELECT 1 FROM public.affiliates
            WHERE id <> NEW.id
              AND pix_key = NEW.pix_key
              AND status <> 'banned'
              AND deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION 'Esta chave PIX já está vinculada a outro programa de afiliação ativo no Pluri Health.';
        END IF;
    END IF;

    -- Unicidade de Conta Asaas
    IF NEW.asaas_account_id IS NOT NULL AND BTRIM(NEW.asaas_account_id) <> '' THEN
        IF EXISTS (
            SELECT 1 FROM public.affiliates
            WHERE id <> NEW.id
              AND asaas_account_id = NEW.asaas_account_id
              AND status <> 'banned'
              AND deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION 'Esta conta bancária/Asaas já está vinculada a outro programa de afiliação ativo no Pluri Health.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] verify_password_recovery_identity (schema.sql L14757-L14782)
CREATE OR REPLACE FUNCTION "public"."verify_password_recovery_identity"("_email" "text", "_cpf" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $_$
DECLARE
  _normalized_email text := lower(trim(coalesce(_email, '')));
  _normalized_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  _matches boolean := false;
BEGIN
  IF _normalized_email = '' OR _normalized_cpf !~ '^\d{11}$' THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    JOIN public.profiles
      ON profiles.id = users.id
    WHERE lower(users.email) = _normalized_email
      AND regexp_replace(coalesce(profiles.cpf, ''), '\D', '', 'g') = _normalized_cpf
  )
  INTO _matches;

  RETURN COALESCE(_matches, false);
END;
$_$;

-- [TABLE] affiliate_commissions (schema.sql L14788-L14804)
CREATE TABLE IF NOT EXISTS "public"."affiliate_commissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "affiliate_id" "uuid" NOT NULL,
    "conversion_id" "uuid" NOT NULL,
    "asaas_payment_id" "text" NOT NULL,
    "is_first_month" boolean DEFAULT false NOT NULL,
    "gross_amount_cents" bigint NOT NULL,
    "commission_percent" numeric(5,2) NOT NULL,
    "commission_amount_cents" bigint NOT NULL,
    "pluri_net_cents" bigint NOT NULL,
    "payment_status" "text" NOT NULL,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "affiliate_commissions_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'received'::"text", 'refunded'::"text"])))
);

-- [TABLE] affiliate_conversions (schema.sql L14826-L14845)
CREATE TABLE IF NOT EXISTS "public"."affiliate_conversions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "affiliate_id" "uuid" NOT NULL,
    "customer_user_id" "uuid",
    "clinic_id" "uuid" NOT NULL,
    "asaas_subscription_id" "text",
    "plan_type" "text" NOT NULL,
    "billing_cycle" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "beneficiary_type" "text" DEFAULT 'affiliate'::"text" NOT NULL,
    "pending_split_removal" boolean DEFAULT false NOT NULL,
    "split_removal_effective_at" timestamp with time zone,
    "total_cycles_paid" integer DEFAULT 0 NOT NULL,
    "next_due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "affiliate_conversions_beneficiary_type_check" CHECK (("beneficiary_type" = ANY (ARRAY['affiliate'::"text", 'platform_master'::"text"]))),
    CONSTRAINT "affiliate_conversions_status_check" CHECK (("status" = ANY (ARRAY['trial'::"text", 'active'::"text", 'past_due'::"text", 'canceled'::"text"])))
);

-- [TABLE] affiliate_crm_logs (schema.sql L14855-L14863)
CREATE TABLE IF NOT EXISTS "public"."affiliate_crm_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "affiliate_id" "uuid" NOT NULL,
    "conversion_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "content" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "affiliate_crm_logs_action_type_check" CHECK (("action_type" = ANY (ARRAY['whatsapp_contact'::"text", 'note'::"text", 'status_change'::"text", 'churn_alert'::"text"])))
);

-- [TABLE] affiliate_invitations (schema.sql L14873-L14889)
CREATE TABLE IF NOT EXISTS "public"."affiliate_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid",
    "invited_user_id" "uuid",
    "invited_email" "text",
    "token" "text" NOT NULL,
    "floor_tier" "text" DEFAULT 'bronze'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '15 days'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "responded_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "affiliate_invitations_floor_tier_check" CHECK (("floor_tier" = ANY (ARRAY['bronze'::"text", 'silver'::"text", 'gold'::"text", 'sapphire'::"text", 'ruby'::"text", 'emerald'::"text", 'diamond'::"text", 'legendary'::"text"]))),
    CONSTRAINT "affiliate_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'expired'::"text"])))
);

-- [TABLE] affiliates (schema.sql L14911-L14947)
CREATE TABLE IF NOT EXISTS "public"."affiliates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "clinic_id" "uuid",
    "coupon_code" "text" NOT NULL,
    "referral_slug" "text" NOT NULL,
    "asaas_account_id" "text" NOT NULL,
    "asaas_wallet_id" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "absorbed_at" timestamp with time zone,
    "locked_reason" "text",
    "tier" "text" DEFAULT 'bronze'::"text" NOT NULL,
    "minimum_tier_floor" "text" DEFAULT 'bronze'::"text" NOT NULL,
    "is_tier_manual_override" boolean DEFAULT false NOT NULL,
    "manual_tier_notes" "text",
    "pix_key" "text",
    "pix_key_type" "text",
    "first_month_commission_percent" numeric(5,2) DEFAULT 30.00 NOT NULL,
    "recurring_commission_percent" numeric(5,2) DEFAULT 10.00 NOT NULL,
    "plan_discount_percent" numeric(5,2) DEFAULT 0.00 NOT NULL,
    "eligible_plan_tier" "text" DEFAULT 'none'::"text" NOT NULL,
    "is_subscription_waived" boolean DEFAULT false NOT NULL,
    "is_waiver_manual_override" boolean DEFAULT false NOT NULL,
    "active_referrals_count" integer DEFAULT 0 NOT NULL,
    "total_sales_count" integer DEFAULT 0 NOT NULL,
    "lifetime_commission_cents" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "parent_affiliate_id" "uuid",
    "can_change_affiliate_context_after" timestamp with time zone,
    CONSTRAINT "affiliates_eligible_plan_tier_check" CHECK (("eligible_plan_tier" = ANY (ARRAY['none'::"text", 'solo'::"text", 'team'::"text", 'enterprise'::"text"]))),
    CONSTRAINT "affiliates_minimum_tier_floor_check" CHECK (("minimum_tier_floor" = ANY (ARRAY['bronze'::"text", 'silver'::"text", 'gold'::"text", 'sapphire'::"text", 'ruby'::"text", 'emerald'::"text", 'diamond'::"text", 'legendary'::"text"]))),
    CONSTRAINT "affiliates_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text", 'banned'::"text", 'absorbed_by_platform'::"text"]))),
    CONSTRAINT "affiliates_tier_check" CHECK (("tier" = ANY (ARRAY['bronze'::"text", 'silver'::"text", 'gold'::"text", 'sapphire'::"text", 'ruby'::"text", 'emerald'::"text", 'diamond'::"text", 'legendary'::"text"]))),
    CONSTRAINT "chk_affiliates_single_level_anti_pyramid" CHECK (("parent_affiliate_id" IS NULL))
);

-- [TABLE] agenda_events (schema.sql L14969-L15052)
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

-- [TABLE] global_word_candidates (schema.sql L15646-L15656)
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

-- [TABLE] security_events (schema.sql L16182-L16192)
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

-- [POLICY] Affiliates and admins insert crm logs ON affiliate_crm_logs (schema.sql L18973-L18975)
CREATE POLICY "Affiliates and admins insert crm logs" ON "public"."affiliate_crm_logs" FOR INSERT TO "authenticated" WITH CHECK ((("affiliate_id" IN ( SELECT "a"."id"
   FROM "public"."affiliates" "a"
  WHERE ("a"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Affiliates and admins read commissions ON affiliate_commissions (schema.sql L18979-L18981)
CREATE POLICY "Affiliates and admins read commissions" ON "public"."affiliate_commissions" FOR SELECT TO "authenticated" USING ((("affiliate_id" IN ( SELECT "a"."id"
   FROM "public"."affiliates" "a"
  WHERE ("a"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Affiliates and admins read conversions ON affiliate_conversions (schema.sql L18985-L18987)
CREATE POLICY "Affiliates and admins read conversions" ON "public"."affiliate_conversions" FOR SELECT TO "authenticated" USING ((("affiliate_id" IN ( SELECT "a"."id"
   FROM "public"."affiliates" "a"
  WHERE ("a"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Affiliates and admins read crm logs ON affiliate_crm_logs (schema.sql L18991-L18993)
CREATE POLICY "Affiliates and admins read crm logs" ON "public"."affiliate_crm_logs" FOR SELECT TO "authenticated" USING ((("affiliate_id" IN ( SELECT "a"."id"
   FROM "public"."affiliates" "a"
  WHERE ("a"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Invited users and managers read affiliate invitations ON affiliate_invitations (schema.sql L19077-L19081)
CREATE POLICY "Invited users and managers read affiliate invitations" ON "public"."affiliate_invitations" FOR SELECT TO "authenticated" USING (((("invited_user_id" IS NOT NULL) AND ("invited_user_id" = ( SELECT "auth"."uid"() AS "uid"))) OR (("invited_email" IS NOT NULL) AND ("lower"("invited_email") = "lower"(COALESCE(("auth"."jwt"() ->> 'email'::"text"), ''::"text")))) OR (("clinic_id" IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM "public"."clinic_memberships" "cm"
  WHERE (("cm"."clinic_id" = "affiliate_invitations"."clinic_id") AND ("cm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("cm"."is_active" = true) AND (("cm"."account_role" = 'account_owner'::"public"."account_role_type") OR ("cm"."operational_role" = ANY (ARRAY['owner'::"public"."operational_role_type", 'admin'::"public"."operational_role_type"])))))) OR (EXISTS ( SELECT 1
   FROM "public"."clinics" "c"
  WHERE (("c"."id" = "affiliate_invitations"."clinic_id") AND ("c"."account_owner_user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."current_user_can"('marketing.affiliates.manage'::"text", "clinic_id") OR "public"."current_user_can"('marketing.affiliates.view'::"text", "clinic_id"))) OR "public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Managers and platform admins manage affiliate invitations ON affiliate_invitations (schema.sql L19085-L19093)
CREATE POLICY "Managers and platform admins manage affiliate invitations" ON "public"."affiliate_invitations" TO "authenticated" USING (((("clinic_id" IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM "public"."clinic_memberships" "cm"
  WHERE (("cm"."clinic_id" = "affiliate_invitations"."clinic_id") AND ("cm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("cm"."is_active" = true) AND (("cm"."account_role" = 'account_owner'::"public"."account_role_type") OR ("cm"."operational_role" = ANY (ARRAY['owner'::"public"."operational_role_type", 'admin'::"public"."operational_role_type"])))))) OR (EXISTS ( SELECT 1
   FROM "public"."clinics" "c"
  WHERE (("c"."id" = "affiliate_invitations"."clinic_id") AND ("c"."account_owner_user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."current_user_can"('marketing.affiliates.manage'::"text", "clinic_id"))) OR "public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role"))) WITH CHECK (((("clinic_id" IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM "public"."clinic_memberships" "cm"
  WHERE (("cm"."clinic_id" = "affiliate_invitations"."clinic_id") AND ("cm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("cm"."is_active" = true) AND (("cm"."account_role" = 'account_owner'::"public"."account_role_type") OR ("cm"."operational_role" = ANY (ARRAY['owner'::"public"."operational_role_type", 'admin'::"public"."operational_role_type"])))))) OR (EXISTS ( SELECT 1
   FROM "public"."clinics" "c"
  WHERE (("c"."id" = "affiliate_invitations"."clinic_id") AND ("c"."account_owner_user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."current_user_can"('marketing.affiliates.manage'::"text", "clinic_id"))) OR "public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Membros autenticados podem consultar status de palavras globais ON global_word_candidates (schema.sql L19115-L19115)
CREATE POLICY "Membros autenticados podem consultar status de palavras globais" ON "public"."global_word_candidates" FOR SELECT TO "authenticated" USING (true);

-- [POLICY] Platform admins manage affiliates ON affiliates (schema.sql L19145-L19145)
CREATE POLICY "Platform admins manage affiliates" ON "public"."affiliates" TO "authenticated" USING (("public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role"))) WITH CHECK (("public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Platform admins manage commissions ON affiliate_commissions (schema.sql L19149-L19149)
CREATE POLICY "Platform admins manage commissions" ON "public"."affiliate_commissions" TO "authenticated" USING (("public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role"))) WITH CHECK (("public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Platform admins manage conversions ON affiliate_conversions (schema.sql L19153-L19153)
CREATE POLICY "Platform admins manage conversions" ON "public"."affiliate_conversions" TO "authenticated" USING (("public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role"))) WITH CHECK (("public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Platform admins manage crm logs ON affiliate_crm_logs (schema.sql L19157-L19157)
CREATE POLICY "Platform admins manage crm logs" ON "public"."affiliate_crm_logs" TO "authenticated" USING (("public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role"))) WITH CHECK (("public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Service role manages all affiliate invitations ON affiliate_invitations (schema.sql L19265-L19265)
CREATE POLICY "Service role manages all affiliate invitations" ON "public"."affiliate_invitations" TO "service_role" USING (true) WITH CHECK (true);

-- [POLICY] Service role manages all affiliates ON affiliates (schema.sql L19269-L19269)
CREATE POLICY "Service role manages all affiliates" ON "public"."affiliates" TO "service_role" USING (true) WITH CHECK (true);

-- [POLICY] Service role manages all commissions ON affiliate_commissions (schema.sql L19273-L19273)
CREATE POLICY "Service role manages all commissions" ON "public"."affiliate_commissions" TO "service_role" USING (true) WITH CHECK (true);

-- [POLICY] Service role manages all conversions ON affiliate_conversions (schema.sql L19277-L19277)
CREATE POLICY "Service role manages all conversions" ON "public"."affiliate_conversions" TO "service_role" USING (true) WITH CHECK (true);

-- [POLICY] Service role manages all crm logs ON affiliate_crm_logs (schema.sql L19281-L19281)
CREATE POLICY "Service role manages all crm logs" ON "public"."affiliate_crm_logs" TO "service_role" USING (true) WITH CHECK (true);

-- [POLICY] Super admins manage all agenda events ON agenda_events (schema.sql L19297-L19297)
CREATE POLICY "Super admins manage all agenda events" ON "public"."agenda_events" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));

-- [POLICY] Users can read affiliates if owner, clinic admin or platform ad ON affiliates (schema.sql L19365-L19369)
CREATE POLICY "Users can read affiliates if owner, clinic admin or platform ad" ON "public"."affiliates" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("clinic_id" IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM "public"."clinic_memberships" "cm"
  WHERE (("cm"."clinic_id" = "affiliates"."clinic_id") AND ("cm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("cm"."is_active" = true) AND ("cm"."membership_status" = 'active'::"public"."membership_status_type") AND (("cm"."account_role" = 'account_owner'::"public"."account_role_type") OR ("cm"."operational_role" = ANY (ARRAY['owner'::"public"."operational_role_type", 'admin'::"public"."operational_role_type"])))))) OR (EXISTS ( SELECT 1
   FROM "public"."clinics" "c"
  WHERE (("c"."id" = "affiliates"."clinic_id") AND ("c"."account_owner_user_id" = ( SELECT "auth"."uid"() AS "uid"))))))) OR "public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Users delete clinic agenda events ON agenda_events (schema.sql L19385-L19385)
CREATE POLICY "Users delete clinic agenda events" ON "public"."agenda_events" FOR DELETE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('agenda.delete_events'::"text", "clinic_id")));

-- [POLICY] Users read clinic agenda events ON agenda_events (schema.sql L19469-L19469)
CREATE POLICY "Users read clinic agenda events" ON "public"."agenda_events" FOR SELECT TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND "public"."can_read_clinic_data"("clinic_id") AND "public"."current_user_can"('agenda.read'::"text", "clinic_id")));

-- [POLICY] Users update clinic agenda events ON agenda_events (schema.sql L19576-L19576)
CREATE POLICY "Users update clinic agenda events" ON "public"."agenda_events" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('agenda.write'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('agenda.write'::"text", "clinic_id")));

-- [POLICY] Users write clinic agenda events ON agenda_events (schema.sql L19620-L19620)
CREATE POLICY "Users write clinic agenda events" ON "public"."agenda_events" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('agenda.write'::"text", "clinic_id")));

-- [POLICY] admins can read clinic security events ON security_events (schema.sql L19660-L19660)
CREATE POLICY "admins can read clinic security events" ON "public"."security_events" FOR SELECT USING ((("visibility_scope" = 'admin'::"text") AND ("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())) AND "public"."current_user_can"('subaccounts.manage'::"text", "clinic_id")));

-- [POLICY] users can read own security events ON security_events (schema.sql L19942-L19942)
CREATE POLICY "users can read own security events" ON "public"."security_events" FOR SELECT USING ((("actor_user_id" = "auth"."uid"()) OR ("target_user_id" = "auth"."uid"())));
