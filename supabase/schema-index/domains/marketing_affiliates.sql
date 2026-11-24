-- ==========================================================================
-- DOMÍNIO: MARKETING_AFFILIATES (Gerado automaticamente por npm run schema:index)
-- Fonte SSOT: supabase/schema.sql
-- ==========================================================================

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

-- [RPC/FUNCTION] sync_auto_lead_before_write (schema.sql L7290-L7368)
CREATE OR REPLACE FUNCTION "public"."sync_auto_lead_before_write"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_meeting record;
    v_ws record;
    v_channel text;
BEGIN
    NEW.updated_at := now();
    NEW.normalized_phone_key := public.normalize_br_phone_key(NEW.phone);

    IF NEW.assigned_affiliate_id IS NOT NULL AND NEW.assigned_at IS NULL THEN
        NEW.assigned_at := now();
        IF NEW.stage IN ('new', 'qualified') THEN
            NEW.stage := 'assigned';
        END IF;
    END IF;

    IF NEW.meeting_id IS NULL AND (NEW.normalized_phone_key IS NOT NULL OR NEW.email IS NOT NULL) THEN
        SELECT m.* INTO v_meeting
        FROM public.platform_onboarding_meetings m
        WHERE (NEW.normalized_phone_key IS NOT NULL AND public.normalize_br_phone_key(m.phone) = NEW.normalized_phone_key)
           OR (NEW.email IS NOT NULL AND btrim(NEW.email) <> '' AND lower(COALESCE(m.email, '')) = lower(btrim(NEW.email)))
        ORDER BY m.scheduled_at DESC
        LIMIT 1;

        IF FOUND THEN
            v_channel := CASE
                WHEN v_meeting.whatsapp_line = '5511960474566' OR COALESCE(v_meeting.confirmation_channel, '') ILIKE '%960474566%' OR COALESCE(v_meeting.origin, '') ILIKE '%bot%' OR COALESCE(v_meeting.notes, '') ILIKE '%whatsapp bot%' THEN 'whatsapp_bot_5511960474566'
                WHEN v_meeting.whatsapp_line = '5511980113936' OR COALESCE(v_meeting.confirmation_channel, '') ILIKE '%980113936%' OR COALESCE(v_meeting.origin, '') ILIKE '%commercial%' OR COALESCE(v_meeting.origin, '') ILIKE '%comercial%' THEN 'whatsapp_commercial_5511980113936'
                ELSE 'backoffice_agenda'
            END;

            NEW.meeting_id := v_meeting.id;
            NEW.meeting_status := v_meeting.status;
            NEW.meeting_scheduled_at := v_meeting.scheduled_at;
            NEW.meeting_duration_minutes := v_meeting.duration_minutes;
            NEW.meeting_channel := v_channel;
            NEW.meeting_booked_by := COALESCE(
                NULLIF(btrim(v_meeting.booked_by_name), ''),
                CASE
                    WHEN v_channel = 'whatsapp_bot_5511960474566' THEN v_meeting.lead_name || ' (Bot +55 11 96047-4566)'
                    WHEN v_channel = 'whatsapp_commercial_5511980113936' THEN 'Equipe Comercial (+55 11 98011-3936)'
                    ELSE 'Backoffice Master'
                END
            );

            IF NEW.stage IN ('new', 'qualified', 'assigned', 'contacted', 'replied') AND v_meeting.status IN ('scheduled', 'rescheduled') THEN
                NEW.stage := 'meeting_scheduled';
            END IF;
        END IF;
    END IF;

    IF NEW.meeting_id IS NULL AND NEW.meeting_status IN ('none', 'attempted_bot', 'handed_off_commercial') AND NEW.normalized_phone_key IS NOT NULL THEN
        SELECT ws.* INTO v_ws
        FROM public.whatsapp_chat_sessions ws
        WHERE public.normalize_br_phone_key(ws.phone) = NEW.normalized_phone_key
        ORDER BY ws.last_message_at DESC
        LIMIT 1;

        IF FOUND AND v_ws.current_step IN ('waiting_day', 'waiting_time', 'owner_support_menu', 'support_handoff', 'support_active', 'completed_scheduled') THEN
            NEW.last_scheduling_attempt_at := v_ws.last_message_at;
            IF v_ws.current_step IN ('support_handoff', 'support_active') THEN
                NEW.meeting_status := 'handed_off_commercial';
                NEW.meeting_channel := 'whatsapp_commercial_5511980113936';
                NEW.scheduling_attempt_summary := 'Atendimento/agendamento transferido para WhatsApp Comercial (+55 11 98011-3936).';
            ELSIF v_ws.current_step IN ('waiting_day', 'waiting_time', 'owner_support_menu') THEN
                NEW.meeting_status := 'attempted_bot';
                NEW.meeting_channel := 'whatsapp_bot_5511960474566';
                NEW.scheduling_attempt_summary := 'Iniciou fluxo de agenda no Bot (+55 11 96047-4566) — etapa: ' || v_ws.current_step ||
                    COALESCE(' (Dia: ' || (v_ws.metadata->>'selected_day_label') || ')', '');
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] prevent_affiliate_pyramid_structure (schema.sql L10378-L10391)
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

-- [RPC/FUNCTION] prevent_affiliate_self_referral (schema.sql L10401-L10433)
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

-- [RPC/FUNCTION] recalculate_affiliate_tier (schema.sql L10690-L10810)
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

-- [RPC/FUNCTION] respond_affiliate_invitation (schema.sql L11577-L11696)
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

-- [RPC/FUNCTION] trg_affiliate_conversions_sync_tier (schema.sql L13279-L13317)
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

-- [RPC/FUNCTION] validate_affiliate_unique_financial_data (schema.sql L14769-L14802)
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

-- [TABLE] affiliate_commissions (schema.sql L15150-L15166)
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

-- [TABLE] affiliate_conversions (schema.sql L15188-L15207)
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

-- [TABLE] affiliate_crm_logs (schema.sql L15217-L15225)
CREATE TABLE IF NOT EXISTS "public"."affiliate_crm_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "affiliate_id" "uuid" NOT NULL,
    "conversion_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "content" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "affiliate_crm_logs_action_type_check" CHECK (("action_type" = ANY (ARRAY['whatsapp_contact'::"text", 'note'::"text", 'status_change'::"text", 'churn_alert'::"text"])))
);

-- [TABLE] affiliate_invitations (schema.sql L15235-L15251)
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

-- [TABLE] affiliates (schema.sql L15273-L15309)
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

-- [TABLE] platform_auto_lead_routines (schema.sql L16416-L16441)
CREATE TABLE IF NOT EXISTS "public"."platform_auto_lead_routines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "subagent_role" "text" DEFAULT 'fb_group_intent_hunter'::"text" NOT NULL,
    "apify_actor_id" "text" DEFAULT 'apify/facebook-groups-scraper'::"text" NOT NULL,
    "target_groups" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "search_keywords" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "enable_cross_enrichment" boolean DEFAULT true NOT NULL,
    "enable_lindy_qualification" boolean DEFAULT true NOT NULL,
    "schedule_cron" "text" DEFAULT '0 8 * * *'::"text" NOT NULL,
    "frequency_label" "text" DEFAULT 'Diário às 08:00'::"text" NOT NULL,
    "min_score_auto_assign" integer DEFAULT 75 NOT NULL,
    "auto_assign_affiliate_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "last_run_at" timestamp with time zone,
    "last_run_status" "text" DEFAULT 'idle'::"text" NOT NULL,
    "total_leads_captured" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "platform_auto_lead_routines_last_run_status_check" CHECK (("last_run_status" = ANY (ARRAY['idle'::"text", 'running_apify'::"text", 'enriching_lindy'::"text", 'succeeded'::"text", 'failed'::"text"]))),
    CONSTRAINT "platform_auto_lead_routines_min_score_auto_assign_check" CHECK ((("min_score_auto_assign" >= 0) AND ("min_score_auto_assign" <= 100))),
    CONSTRAINT "platform_auto_lead_routines_subagent_role_check" CHECK (("subagent_role" = ANY (ARRAY['fb_group_intent_hunter'::"text", 'cross_channel_enricher'::"text", 'lindy_sdr_qualifier'::"text", 'full_pipeline'::"text"])))
);

-- [TABLE] platform_auto_lead_runs (schema.sql L16447-L16466)
CREATE TABLE IF NOT EXISTS "public"."platform_auto_lead_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "routine_id" "uuid",
    "run_type" "text" DEFAULT 'subagent_routine'::"text" NOT NULL,
    "subagent_stage" "text" DEFAULT 'completed'::"text" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "target_groups" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "keywords" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "external_run_id" "text",
    "leads_found_count" integer DEFAULT 0 NOT NULL,
    "leads_inserted_count" integer DEFAULT 0 NOT NULL,
    "leads_updated_count" integer DEFAULT 0 NOT NULL,
    "error_message" "text",
    "triggered_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "platform_auto_lead_runs_run_type_check" CHECK (("run_type" = ANY (ARRAY['subagent_routine'::"text", 'apify_scrape'::"text", 'lindy_webhook'::"text", 'csv_import'::"text"]))),
    CONSTRAINT "platform_auto_lead_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'succeeded'::"text", 'failed'::"text", 'partial'::"text"]))),
    CONSTRAINT "platform_auto_lead_runs_subagent_stage_check" CHECK (("subagent_stage" = ANY (ARRAY['extracting_apify'::"text", 'cross_enriching'::"text", 'qualifying_lindy'::"text", 'completed'::"text", 'failed'::"text"])))
);

-- [POLICY] Affiliates and admins insert crm logs ON affiliate_crm_logs (schema.sql L19558-L19560)
CREATE POLICY "Affiliates and admins insert crm logs" ON "public"."affiliate_crm_logs" FOR INSERT TO "authenticated" WITH CHECK ((("affiliate_id" IN ( SELECT "a"."id"
   FROM "public"."affiliates" "a"
  WHERE ("a"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Affiliates and admins read commissions ON affiliate_commissions (schema.sql L19564-L19566)
CREATE POLICY "Affiliates and admins read commissions" ON "public"."affiliate_commissions" FOR SELECT TO "authenticated" USING ((("affiliate_id" IN ( SELECT "a"."id"
   FROM "public"."affiliates" "a"
  WHERE ("a"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Affiliates and admins read conversions ON affiliate_conversions (schema.sql L19570-L19572)
CREATE POLICY "Affiliates and admins read conversions" ON "public"."affiliate_conversions" FOR SELECT TO "authenticated" USING ((("affiliate_id" IN ( SELECT "a"."id"
   FROM "public"."affiliates" "a"
  WHERE ("a"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Affiliates and admins read crm logs ON affiliate_crm_logs (schema.sql L19576-L19578)
CREATE POLICY "Affiliates and admins read crm logs" ON "public"."affiliate_crm_logs" FOR SELECT TO "authenticated" USING ((("affiliate_id" IN ( SELECT "a"."id"
   FROM "public"."affiliates" "a"
  WHERE ("a"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Invited users and managers read affiliate invitations ON affiliate_invitations (schema.sql L19662-L19666)
CREATE POLICY "Invited users and managers read affiliate invitations" ON "public"."affiliate_invitations" FOR SELECT TO "authenticated" USING (((("invited_user_id" IS NOT NULL) AND ("invited_user_id" = ( SELECT "auth"."uid"() AS "uid"))) OR (("invited_email" IS NOT NULL) AND ("lower"("invited_email") = "lower"(COALESCE(("auth"."jwt"() ->> 'email'::"text"), ''::"text")))) OR (("clinic_id" IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM "public"."clinic_memberships" "cm"
  WHERE (("cm"."clinic_id" = "affiliate_invitations"."clinic_id") AND ("cm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("cm"."is_active" = true) AND (("cm"."account_role" = 'account_owner'::"public"."account_role_type") OR ("cm"."operational_role" = ANY (ARRAY['owner'::"public"."operational_role_type", 'admin'::"public"."operational_role_type"])))))) OR (EXISTS ( SELECT 1
   FROM "public"."clinics" "c"
  WHERE (("c"."id" = "affiliate_invitations"."clinic_id") AND ("c"."account_owner_user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."current_user_can"('marketing.affiliates.manage'::"text", "clinic_id") OR "public"."current_user_can"('marketing.affiliates.view'::"text", "clinic_id"))) OR "public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Managers and platform admins manage affiliate invitations ON affiliate_invitations (schema.sql L19670-L19678)
CREATE POLICY "Managers and platform admins manage affiliate invitations" ON "public"."affiliate_invitations" TO "authenticated" USING (((("clinic_id" IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM "public"."clinic_memberships" "cm"
  WHERE (("cm"."clinic_id" = "affiliate_invitations"."clinic_id") AND ("cm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("cm"."is_active" = true) AND (("cm"."account_role" = 'account_owner'::"public"."account_role_type") OR ("cm"."operational_role" = ANY (ARRAY['owner'::"public"."operational_role_type", 'admin'::"public"."operational_role_type"])))))) OR (EXISTS ( SELECT 1
   FROM "public"."clinics" "c"
  WHERE (("c"."id" = "affiliate_invitations"."clinic_id") AND ("c"."account_owner_user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."current_user_can"('marketing.affiliates.manage'::"text", "clinic_id"))) OR "public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role"))) WITH CHECK (((("clinic_id" IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM "public"."clinic_memberships" "cm"
  WHERE (("cm"."clinic_id" = "affiliate_invitations"."clinic_id") AND ("cm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("cm"."is_active" = true) AND (("cm"."account_role" = 'account_owner'::"public"."account_role_type") OR ("cm"."operational_role" = ANY (ARRAY['owner'::"public"."operational_role_type", 'admin'::"public"."operational_role_type"])))))) OR (EXISTS ( SELECT 1
   FROM "public"."clinics" "c"
  WHERE (("c"."id" = "affiliate_invitations"."clinic_id") AND ("c"."account_owner_user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."current_user_can"('marketing.affiliates.manage'::"text", "clinic_id"))) OR "public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Platform admins manage affiliates ON affiliates (schema.sql L19730-L19730)
CREATE POLICY "Platform admins manage affiliates" ON "public"."affiliates" TO "authenticated" USING (("public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role"))) WITH CHECK (("public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Platform admins manage commissions ON affiliate_commissions (schema.sql L19734-L19734)
CREATE POLICY "Platform admins manage commissions" ON "public"."affiliate_commissions" TO "authenticated" USING (("public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role"))) WITH CHECK (("public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Platform admins manage conversions ON affiliate_conversions (schema.sql L19738-L19738)
CREATE POLICY "Platform admins manage conversions" ON "public"."affiliate_conversions" TO "authenticated" USING (("public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role"))) WITH CHECK (("public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Platform admins manage crm logs ON affiliate_crm_logs (schema.sql L19742-L19742)
CREATE POLICY "Platform admins manage crm logs" ON "public"."affiliate_crm_logs" TO "authenticated" USING (("public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role"))) WITH CHECK (("public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));

-- [POLICY] Platform admins manage platform_auto_lead_routines ON platform_auto_lead_routines (schema.sql L19760-L19760)
CREATE POLICY "Platform admins manage platform_auto_lead_routines" ON "public"."platform_auto_lead_routines" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

-- [POLICY] Platform admins manage platform_auto_lead_runs ON platform_auto_lead_runs (schema.sql L19764-L19764)
CREATE POLICY "Platform admins manage platform_auto_lead_runs" ON "public"."platform_auto_lead_runs" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

-- [POLICY] Service role manages all affiliate invitations ON affiliate_invitations (schema.sql L19876-L19876)
CREATE POLICY "Service role manages all affiliate invitations" ON "public"."affiliate_invitations" TO "service_role" USING (true) WITH CHECK (true);

-- [POLICY] Service role manages all affiliates ON affiliates (schema.sql L19880-L19880)
CREATE POLICY "Service role manages all affiliates" ON "public"."affiliates" TO "service_role" USING (true) WITH CHECK (true);

-- [POLICY] Service role manages all commissions ON affiliate_commissions (schema.sql L19884-L19884)
CREATE POLICY "Service role manages all commissions" ON "public"."affiliate_commissions" TO "service_role" USING (true) WITH CHECK (true);

-- [POLICY] Service role manages all conversions ON affiliate_conversions (schema.sql L19888-L19888)
CREATE POLICY "Service role manages all conversions" ON "public"."affiliate_conversions" TO "service_role" USING (true) WITH CHECK (true);

-- [POLICY] Service role manages all crm logs ON affiliate_crm_logs (schema.sql L19892-L19892)
CREATE POLICY "Service role manages all crm logs" ON "public"."affiliate_crm_logs" TO "service_role" USING (true) WITH CHECK (true);

-- [POLICY] Service role full access platform_auto_lead_routines ON platform_auto_lead_routines (schema.sql L19900-L19900)
CREATE POLICY "Service role full access platform_auto_lead_routines" ON "public"."platform_auto_lead_routines" TO "service_role" USING (true) WITH CHECK (true);

-- [POLICY] Service role full access platform_auto_lead_runs ON platform_auto_lead_runs (schema.sql L19904-L19904)
CREATE POLICY "Service role full access platform_auto_lead_runs" ON "public"."platform_auto_lead_runs" TO "service_role" USING (true) WITH CHECK (true);

-- [POLICY] Users can read affiliates if owner, clinic admin or platform ad ON affiliates (schema.sql L19988-L19992)
CREATE POLICY "Users can read affiliates if owner, clinic admin or platform ad" ON "public"."affiliates" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("clinic_id" IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM "public"."clinic_memberships" "cm"
  WHERE (("cm"."clinic_id" = "affiliates"."clinic_id") AND ("cm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("cm"."is_active" = true) AND ("cm"."membership_status" = 'active'::"public"."membership_status_type") AND (("cm"."account_role" = 'account_owner'::"public"."account_role_type") OR ("cm"."operational_role" = ANY (ARRAY['owner'::"public"."operational_role_type", 'admin'::"public"."operational_role_type"])))))) OR (EXISTS ( SELECT 1
   FROM "public"."clinics" "c"
  WHERE (("c"."id" = "affiliates"."clinic_id") AND ("c"."account_owner_user_id" = ( SELECT "auth"."uid"() AS "uid"))))))) OR "public"."is_platform_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role")));
