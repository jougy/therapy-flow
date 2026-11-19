-- Migration: 20261118194500_create_platform_auto_leads_and_agenda_sync.sql
-- Módulo Marketing (Backoffice > Auto-Lead): Pipeline Apify + Lindy AI, Subagentes de Busca e Integração Tripla de Agendas
-- Integra: WhatsApp Bot (+5511960474566), WhatsApp Comercial (+5511980113936) e Agenda Master (/platform/agenda).

-- ==============================================================================
-- 1. EVOLUÇÃO NÃO-DESTRUTIVA DE platform_onboarding_meetings
-- ==============================================================================

ALTER TABLE public.platform_onboarding_meetings
    ADD COLUMN IF NOT EXISTS origin text DEFAULT 'backoffice_agenda',
    ADD COLUMN IF NOT EXISTS confirmation_channel text DEFAULT 'backoffice',
    ADD COLUMN IF NOT EXISTS booked_by_name text DEFAULT 'Backoffice Master',
    ADD COLUMN IF NOT EXISTS whatsapp_line text,
    ADD COLUMN IF NOT EXISTS auto_lead_id uuid;

CREATE INDEX IF NOT EXISTS idx_platform_onboarding_meetings_auto_lead_id
    ON public.platform_onboarding_meetings (auto_lead_id)
    WHERE auto_lead_id IS NOT NULL;

-- ==============================================================================
-- 2. FUNÇÃO UTILITÁRIA DE NORMALIZAÇÃO DE TELEFONE BRASILEIRO
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.normalize_br_phone_key(p_phone text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
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

-- ==============================================================================
-- 3. TABELA: platform_auto_lead_routines (Subagentes & Rotinas de Busca)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.platform_auto_lead_routines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    subagent_role text NOT NULL DEFAULT 'fb_group_intent_hunter'
        CHECK (subagent_role IN ('fb_group_intent_hunter', 'cross_channel_enricher', 'lindy_sdr_qualifier', 'full_pipeline')),
    apify_actor_id text NOT NULL DEFAULT 'apify/facebook-groups-scraper',
    target_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
    search_keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
    enable_cross_enrichment boolean NOT NULL DEFAULT true,
    enable_lindy_qualification boolean NOT NULL DEFAULT true,
    schedule_cron text NOT NULL DEFAULT '0 8 * * *',
    frequency_label text NOT NULL DEFAULT 'Diário às 08:00',
    min_score_auto_assign integer NOT NULL DEFAULT 75 CHECK (min_score_auto_assign >= 0 AND min_score_auto_assign <= 100),
    auto_assign_affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL,
    is_active boolean NOT NULL DEFAULT true,
    last_run_at timestamptz,
    last_run_status text NOT NULL DEFAULT 'idle'
        CHECK (last_run_status IN ('idle', 'running_apify', 'enriching_lindy', 'succeeded', 'failed')),
    total_leads_captured integer NOT NULL DEFAULT 0,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

COMMENT ON TABLE public.platform_auto_lead_routines IS 'Rotinas de busca automática operadas pelos subagentes integrados ao Apify e Lindy AI.';

CREATE INDEX IF NOT EXISTS idx_platform_auto_lead_routines_active
    ON public.platform_auto_lead_routines (is_active)
    WHERE deleted_at IS NULL;

-- ==============================================================================
-- 4. TABELA: platform_auto_lead_runs (Histórico de Execuções & Webhooks)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.platform_auto_lead_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_id uuid REFERENCES public.platform_auto_lead_routines(id) ON DELETE SET NULL,
    run_type text NOT NULL DEFAULT 'subagent_routine'
        CHECK (run_type IN ('subagent_routine', 'apify_scrape', 'lindy_webhook', 'csv_import')),
    subagent_stage text NOT NULL DEFAULT 'completed'
        CHECK (subagent_stage IN ('extracting_apify', 'cross_enriching', 'qualifying_lindy', 'completed', 'failed')),
    status text NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'succeeded', 'failed', 'partial')),
    target_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
    keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
    external_run_id text,
    leads_found_count integer NOT NULL DEFAULT 0,
    leads_inserted_count integer NOT NULL DEFAULT 0,
    leads_updated_count integer NOT NULL DEFAULT 0,
    error_message text,
    triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

COMMENT ON TABLE public.platform_auto_lead_runs IS 'Histórico de execuções dos subagentes Apify, webhooks Lindy AI e importações em lote.';

CREATE INDEX IF NOT EXISTS idx_platform_auto_lead_runs_routine_created
    ON public.platform_auto_lead_runs (routine_id, created_at DESC);

-- ==============================================================================
-- 5. TABELA: platform_auto_leads (Tabela de Contatos & Sincronização de Agendas)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.platform_auto_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_id uuid REFERENCES public.platform_auto_lead_routines(id) ON DELETE SET NULL,
    full_name text NOT NULL,
    phone text,
    normalized_phone_key text,
    email text,
    instagram_handle text,
    facebook_profile_url text,
    facebook_group_name text,
    facebook_group_url text,
    linkedin_url text,
    website_url text,
    city text,
    state text,
    clinic_name text,
    specialty text,
    icp_tier text NOT NULL DEFAULT 'solo_physio'
        CHECK (icp_tier IN ('clinic_owner', 'solo_physio', 'studio_pilates', 'student', 'other')),
    source_platform text NOT NULL DEFAULT 'facebook_group'
        CHECK (source_platform IN ('facebook_group', 'instagram', 'google_maps', 'lindy_agent', 'apify_direct', 'csv_import', 'whatsapp_inbound')),
    source_post_url text,
    source_post_excerpt text,
    ai_score integer NOT NULL DEFAULT 50 CHECK (ai_score >= 0 AND ai_score <= 100),
    ai_qualification_summary text,
    ai_icebreaker_message text,
    subagent_captured_by text DEFAULT 'fb_group_intent_hunter',
    stage text NOT NULL DEFAULT 'new'
        CHECK (stage IN ('new', 'qualified', 'assigned', 'contacted', 'replied', 'meeting_scheduled', 'converted_trial', 'discarded')),
    assigned_affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL,
    assigned_at timestamptz,
    converted_clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
    meeting_id uuid REFERENCES public.platform_onboarding_meetings(id) ON DELETE SET NULL,
    meeting_status text NOT NULL DEFAULT 'none'
        CHECK (meeting_status IN ('none', 'attempted_bot', 'handed_off_commercial', 'scheduled', 'rescheduled', 'completed', 'canceled', 'no_show')),
    meeting_scheduled_at timestamptz,
    meeting_duration_minutes integer,
    meeting_channel text
        CHECK (meeting_channel IS NULL OR meeting_channel IN ('whatsapp_bot_5511960474566', 'whatsapp_commercial_5511980113936', 'backoffice_agenda')),
    meeting_booked_by text,
    last_scheduling_attempt_at timestamptz,
    scheduling_attempt_summary text,
    external_lead_key text NOT NULL UNIQUE,
    apify_run_id text,
    lindy_task_id text,
    raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    notes text,
    last_contacted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

COMMENT ON TABLE public.platform_auto_leads IS 'Tabela unificada de leads capturados via Apify/Lindy AI com sincronização de agenda (Bot +5511960474566, Comercial +5511980113936 e Backoffice).';

CREATE INDEX IF NOT EXISTS idx_platform_auto_leads_phone_key
    ON public.platform_auto_leads (normalized_phone_key)
    WHERE deleted_at IS NULL AND normalized_phone_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_platform_auto_leads_stage_score
    ON public.platform_auto_leads (stage, ai_score DESC, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_platform_auto_leads_affiliate
    ON public.platform_auto_leads (assigned_affiliate_id)
    WHERE deleted_at IS NULL AND assigned_affiliate_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_platform_auto_leads_meeting_status
    ON public.platform_auto_leads (meeting_status, meeting_scheduled_at)
    WHERE deleted_at IS NULL;

-- ==============================================================================
-- 6. TRIGGERS DE SINCRONIZAÇÃO BIDIRECIONAL ENTRE LEAD E AS 3 AGENDAS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.sync_auto_lead_before_write() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

    -- 1. Cruzamento automático com platform_onboarding_meetings (Backoffice + Bot + Comercial)
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

    -- 2. Cruzamento com tentativas incompletas no WhatsApp Bot (+5511960474566) / Comercial (+5511980113936)
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

DROP TRIGGER IF EXISTS trg_sync_auto_lead_before_write ON public.platform_auto_leads;
CREATE TRIGGER trg_sync_auto_lead_before_write
    BEFORE INSERT OR UPDATE ON public.platform_auto_leads
    FOR EACH ROW EXECUTE FUNCTION public.sync_auto_lead_before_write();

CREATE OR REPLACE FUNCTION public.sync_meeting_to_auto_leads() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

DROP TRIGGER IF EXISTS trg_sync_meeting_to_auto_leads ON public.platform_onboarding_meetings;
CREATE TRIGGER trg_sync_meeting_to_auto_leads
    AFTER INSERT OR UPDATE ON public.platform_onboarding_meetings
    FOR EACH ROW EXECUTE FUNCTION public.sync_meeting_to_auto_leads();

CREATE OR REPLACE FUNCTION public.sync_whatsapp_session_to_auto_leads() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_phone_key text;
BEGIN
    v_phone_key := public.normalize_br_phone_key(NEW.phone);
    IF v_phone_key IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.current_step IN ('waiting_day', 'waiting_time', 'owner_support_menu', 'support_handoff', 'support_active') THEN
        UPDATE public.platform_auto_leads
        SET
            meeting_status = CASE
                WHEN NEW.current_step IN ('support_handoff', 'support_active') THEN 'handed_off_commercial'
                ELSE 'attempted_bot'
            END,
            meeting_channel = CASE
                WHEN NEW.current_step IN ('support_handoff', 'support_active') THEN 'whatsapp_commercial_5511980113936'
                ELSE 'whatsapp_bot_5511960474566'
            END,
            last_scheduling_attempt_at = NEW.last_message_at,
            scheduling_attempt_summary = CASE
                WHEN NEW.current_step IN ('support_handoff', 'support_active') THEN 'Atendimento/agendamento transferido para WhatsApp Comercial (+55 11 98011-3936).'
                ELSE 'Iniciou fluxo de agenda no Bot (+55 11 96047-4566) — etapa: ' || NEW.current_step ||
                    COALESCE(' (Dia: ' || (NEW.metadata->>'selected_day_label') || ')', '')
            END,
            updated_at = now()
        WHERE deleted_at IS NULL
          AND normalized_phone_key = v_phone_key
          AND meeting_status IN ('none', 'attempted_bot', 'handed_off_commercial');
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_whatsapp_session_to_auto_leads ON public.whatsapp_chat_sessions;
CREATE TRIGGER trg_sync_whatsapp_session_to_auto_leads
    AFTER INSERT OR UPDATE ON public.whatsapp_chat_sessions
    FOR EACH ROW EXECUTE FUNCTION public.sync_whatsapp_session_to_auto_leads();

DROP TRIGGER IF EXISTS trg_update_platform_auto_lead_routines_updated_at ON public.platform_auto_lead_routines;
CREATE TRIGGER trg_update_platform_auto_lead_routines_updated_at
    BEFORE UPDATE ON public.platform_auto_lead_routines
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================================================
-- 7. RPC DE INGESTÃO E DEDUPLICAÇÃO EM LOTE
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.upsert_platform_auto_leads_batch(
    p_leads jsonb,
    p_run_id uuid DEFAULT NULL,
    p_routine_id uuid DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_item jsonb;
    v_inserted integer := 0;
    v_updated integer := 0;
    v_total integer := 0;
    v_ext_key text;
    v_phone_key text;
    v_existing_id uuid;
    v_score integer;
    v_stage text;
BEGIN
    IF p_leads IS NULL OR jsonb_typeof(p_leads) <> 'array' THEN
        RETURN jsonb_build_object('inserted_count', 0, 'updated_count', 0, 'total_processed', 0);
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_leads)
    LOOP
        v_total := v_total + 1;
        v_phone_key := public.normalize_br_phone_key(v_item->>'phone');
        v_ext_key := COALESCE(
            NULLIF(btrim(v_item->>'external_lead_key'), ''),
            'lead:' || COALESCE(
                v_phone_key,
                NULLIF(lower(btrim(v_item->>'email')), ''),
                NULLIF(lower(btrim(v_item->>'facebook_profile_url')), ''),
                md5(COALESCE(v_item->>'full_name', 'lead') || '|' || COALESCE(v_item->>'source_post_url', v_item->>'facebook_group_name', ''))
            )
        );
        v_score := LEAST(100, GREATEST(0, COALESCE((v_item->>'ai_score')::integer, 60)));
        v_stage := COALESCE(NULLIF(v_item->>'stage', ''), CASE WHEN v_score >= 70 THEN 'qualified' ELSE 'new' END);

        SELECT id INTO v_existing_id
        FROM public.platform_auto_leads
        WHERE external_lead_key = v_ext_key
        LIMIT 1;

        IF v_existing_id IS NULL THEN
            INSERT INTO public.platform_auto_leads (
                routine_id,
                full_name,
                phone,
                email,
                instagram_handle,
                facebook_profile_url,
                facebook_group_name,
                facebook_group_url,
                linkedin_url,
                website_url,
                city,
                state,
                clinic_name,
                specialty,
                icp_tier,
                source_platform,
                source_post_url,
                source_post_excerpt,
                ai_score,
                ai_qualification_summary,
                ai_icebreaker_message,
                subagent_captured_by,
                stage,
                external_lead_key,
                apify_run_id,
                lindy_task_id,
                raw_metadata
            ) VALUES (
                COALESCE(p_routine_id, NULLIF(v_item->>'routine_id', '')::uuid),
                COALESCE(NULLIF(btrim(v_item->>'full_name'), ''), 'Lead Sem Nome'),
                NULLIF(btrim(v_item->>'phone'), ''),
                NULLIF(lower(btrim(v_item->>'email')), ''),
                NULLIF(btrim(v_item->>'instagram_handle'), ''),
                NULLIF(btrim(v_item->>'facebook_profile_url'), ''),
                NULLIF(btrim(v_item->>'facebook_group_name'), ''),
                NULLIF(btrim(v_item->>'facebook_group_url'), ''),
                NULLIF(btrim(v_item->>'linkedin_url'), ''),
                NULLIF(btrim(v_item->>'website_url'), ''),
                NULLIF(btrim(v_item->>'city'), ''),
                NULLIF(btrim(v_item->>'state'), ''),
                NULLIF(btrim(v_item->>'clinic_name'), ''),
                NULLIF(btrim(v_item->>'specialty'), ''),
                COALESCE(NULLIF(v_item->>'icp_tier', ''), 'solo_physio'),
                COALESCE(NULLIF(v_item->>'source_platform', ''), 'facebook_group'),
                NULLIF(btrim(v_item->>'source_post_url'), ''),
                NULLIF(btrim(v_item->>'source_post_excerpt'), ''),
                v_score,
                NULLIF(btrim(v_item->>'ai_qualification_summary'), ''),
                NULLIF(btrim(v_item->>'ai_icebreaker_message'), ''),
                COALESCE(NULLIF(v_item->>'subagent_captured_by', ''), 'fb_group_intent_hunter'),
                v_stage,
                v_ext_key,
                NULLIF(btrim(v_item->>'apify_run_id'), ''),
                NULLIF(btrim(v_item->>'lindy_task_id'), ''),
                COALESCE(v_item->'raw_metadata', '{}'::jsonb)
            );
            v_inserted := v_inserted + 1;
        ELSE
            UPDATE public.platform_auto_leads
            SET
                phone = COALESCE(NULLIF(btrim(phone), ''), NULLIF(btrim(v_item->>'phone'), '')),
                email = COALESCE(NULLIF(btrim(email), ''), NULLIF(lower(btrim(v_item->>'email')), '')),
                instagram_handle = COALESCE(NULLIF(btrim(instagram_handle), ''), NULLIF(btrim(v_item->>'instagram_handle'), '')),
                facebook_profile_url = COALESCE(NULLIF(btrim(facebook_profile_url), ''), NULLIF(btrim(v_item->>'facebook_profile_url'), '')),
                city = COALESCE(NULLIF(btrim(city), ''), NULLIF(btrim(v_item->>'city'), '')),
                state = COALESCE(NULLIF(btrim(state), ''), NULLIF(btrim(v_item->>'state'), '')),
                clinic_name = COALESCE(NULLIF(btrim(clinic_name), ''), NULLIF(btrim(v_item->>'clinic_name'), '')),
                specialty = COALESCE(NULLIF(btrim(specialty), ''), NULLIF(btrim(v_item->>'specialty'), '')),
                ai_score = GREATEST(ai_score, v_score),
                ai_qualification_summary = COALESCE(NULLIF(btrim(v_item->>'ai_qualification_summary'), ''), ai_qualification_summary),
                ai_icebreaker_message = COALESCE(NULLIF(btrim(v_item->>'ai_icebreaker_message'), ''), ai_icebreaker_message),
                apify_run_id = COALESCE(NULLIF(btrim(v_item->>'apify_run_id'), ''), apify_run_id),
                lindy_task_id = COALESCE(NULLIF(btrim(v_item->>'lindy_task_id'), ''), lindy_task_id),
                deleted_at = NULL,
                updated_at = now()
            WHERE id = v_existing_id;
            v_updated := v_updated + 1;
        END IF;
    END LOOP;

    IF p_run_id IS NOT NULL THEN
        UPDATE public.platform_auto_lead_runs
        SET
            leads_found_count = v_total,
            leads_inserted_count = v_inserted,
            leads_updated_count = v_updated,
            status = 'succeeded',
            subagent_stage = 'completed',
            completed_at = now()
        WHERE id = p_run_id;
    END IF;

    IF p_routine_id IS NOT NULL THEN
        UPDATE public.platform_auto_lead_routines
        SET
            last_run_at = now(),
            last_run_status = 'succeeded',
            total_leads_captured = total_leads_captured + v_inserted,
            updated_at = now()
        WHERE id = p_routine_id;
    END IF;

    RETURN jsonb_build_object(
        'inserted_count', v_inserted,
        'updated_count', v_updated,
        'total_processed', v_total
    );
END;
$$;

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) E PERMISSÕES
-- ==============================================================================

ALTER TABLE public.platform_auto_lead_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_auto_lead_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_auto_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage platform_auto_lead_routines" ON public.platform_auto_lead_routines;
CREATE POLICY "Platform admins manage platform_auto_lead_routines"
    ON public.platform_auto_lead_routines
    TO authenticated
    USING (public.is_platform_admin(auth.uid()))
    WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Service role full access platform_auto_lead_routines" ON public.platform_auto_lead_routines;
CREATE POLICY "Service role full access platform_auto_lead_routines"
    ON public.platform_auto_lead_routines
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Platform admins manage platform_auto_lead_runs" ON public.platform_auto_lead_runs;
CREATE POLICY "Platform admins manage platform_auto_lead_runs"
    ON public.platform_auto_lead_runs
    TO authenticated
    USING (public.is_platform_admin(auth.uid()))
    WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Service role full access platform_auto_lead_runs" ON public.platform_auto_lead_runs;
CREATE POLICY "Service role full access platform_auto_lead_runs"
    ON public.platform_auto_lead_runs
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Platform admins manage platform_auto_leads" ON public.platform_auto_leads;
CREATE POLICY "Platform admins manage platform_auto_leads"
    ON public.platform_auto_leads
    TO authenticated
    USING (public.is_platform_admin(auth.uid()))
    WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Affiliates read assigned platform_auto_leads" ON public.platform_auto_leads;
CREATE POLICY "Affiliates read assigned platform_auto_leads"
    ON public.platform_auto_leads
    FOR SELECT
    TO authenticated
    USING (
        deleted_at IS NULL
        AND assigned_affiliate_id IN (
            SELECT a.id FROM public.affiliates a
            WHERE a.user_id = auth.uid() AND a.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS "Affiliates update assigned platform_auto_leads" ON public.platform_auto_leads;
CREATE POLICY "Affiliates update assigned platform_auto_leads"
    ON public.platform_auto_leads
    FOR UPDATE
    TO authenticated
    USING (
        deleted_at IS NULL
        AND assigned_affiliate_id IN (
            SELECT a.id FROM public.affiliates a
            WHERE a.user_id = auth.uid() AND a.deleted_at IS NULL
        )
    )
    WITH CHECK (
        assigned_affiliate_id IN (
            SELECT a.id FROM public.affiliates a
            WHERE a.user_id = auth.uid() AND a.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS "Service role full access platform_auto_leads" ON public.platform_auto_leads;
CREATE POLICY "Service role full access platform_auto_leads"
    ON public.platform_auto_leads
    TO service_role
    USING (true)
    WITH CHECK (true);

GRANT ALL ON TABLE public.platform_auto_lead_routines TO authenticated, service_role;
GRANT ALL ON TABLE public.platform_auto_lead_runs TO authenticated, service_role;
GRANT ALL ON TABLE public.platform_auto_leads TO authenticated, service_role;
GRANT ALL ON FUNCTION public.normalize_br_phone_key(text) TO authenticated, service_role;
GRANT ALL ON FUNCTION public.upsert_platform_auto_leads_batch(jsonb, uuid, uuid) TO authenticated, service_role;

-- ==============================================================================
-- 9. SEED IDEMPOTENTE DAS 3 ROTINAS INICIAIS DOS SUBAGENTES
-- ==============================================================================

INSERT INTO public.platform_auto_lead_routines (
    id,
    name,
    description,
    subagent_role,
    apify_actor_id,
    target_groups,
    search_keywords,
    enable_cross_enrichment,
    enable_lindy_qualification,
    schedule_cron,
    frequency_label,
    min_score_auto_assign,
    is_active
) VALUES
(
    '11111111-1111-4111-8111-111111111001',
    'Subagente 1: Caçador de Intenção (Grupos FB Fisioterapia)',
    'Varre posts recentes pedindo indicação de prontuário, agenda, gestão financeira e software para fisioterapia.',
    'fb_group_intent_hunter',
    'apify/facebook-groups-scraper',
    '[{"name": "Fisioterapia Brasil - Gestão e Clínica", "url": "https://www.facebook.com/groups/fisioterapiabrasilgestao"}, {"name": "Donos de Clínicas de Fisioterapia", "url": "https://www.facebook.com/groups/donosclinicasfisio"}]'::jsonb,
    '["sistema", "prontuário", "software", "agenda", "abrir clínica", "faturamento", "indicação"]'::jsonb,
    true,
    true,
    '0 8 * * *',
    'Diário às 08:00',
    75,
    true
),
(
    '11111111-1111-4111-8111-111111111002',
    'Subagente 2: Mapeador de Estúdios Pilates & Ortopedia',
    'Captura profissionais em grupos de Pilates e cruza perfil FB com Instagram e Google Maps via Apify + Lindy AI.',
    'cross_channel_enricher',
    'apify/facebook-groups-scraper',
    '[{"name": "Pilates Clínico & Estúdios Brasil", "url": "https://www.facebook.com/groups/pilatesclinico"}, {"name": "Fisioterapia Ortopédica & Esportiva", "url": "https://www.facebook.com/groups/fisioortopedica"}]'::jsonb,
    '["pilates", "controle de alunos", "avaliação postural", "recorrente", "planilha", "whatsapp"]'::jsonb,
    true,
    true,
    '0 13 * * *',
    'Diário às 13:00',
    70,
    true
),
(
    '11111111-1111-4111-8111-111111111003',
    'Subagente 3: Reconciliador de Agendas (Bot + Comercial + Backoffice)',
    'Qualifica leads com tentativa incompleta no Bot (+5511960474566) ou conversa no Comercial (+5511980113936) e gera icebreakers de retomada.',
    'lindy_sdr_qualifier',
    'apify/facebook-groups-scraper',
    '[{"name": "Reabilitação e Empreendedorismo em Saúde", "url": "https://www.facebook.com/groups/empreendedorismofisio"}]'::jsonb,
    '["consultório", "atendimento domiciliar", "evolução", "assinatura digital"]'::jsonb,
    true,
    true,
    '0 */6 * * *',
    'A cada 6 horas',
    65,
    true
)
ON CONFLICT (id) DO NOTHING;
