-- ==============================================================================
-- Migration: 20261109200500_affiliate_tiers_and_plan_waivers.sql
-- Fase 4 (Etapas 4.1 e 4.2) do Roteiro Mestre de Marketing de Afiliados Pluri-Health
-- 
-- 1. Compatibilização de constraint de eligible_plan_tier em public.affiliates ('none', 'solo', 'team', 'enterprise').
-- 2. Limpeza defensiva de assinaturas anteriores para prevenir erro PGRST203 (Zero Overload).
-- 3. Função RPC canônica calculate_affiliate_tier_benefits(_active_referrals integer, _floor_tier text DEFAULT 'bronze').
-- 4. Função RPC canônica recalculate_affiliate_tier(_affiliate_id uuid).
-- 5. Trigger pós INSERT / UPDATE / DELETE em affiliate_conversions para recálculo automático em tempo real.
-- 6. Grants de execução para authenticated, anon e service_role.
-- ==============================================================================

-- ==============================================================================
-- 1. COMPATIBILIZAÇÃO IDEMPOTENTE DE CONSTRAINTS EM public.affiliates
-- ==============================================================================

DO $$
BEGIN
    -- Permitir 'none' além de 'solo', 'team', 'enterprise' para planos sem isenção (ex.: Bronze)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'affiliates' 
          AND constraint_name = 'affiliates_eligible_plan_tier_check'
    ) THEN
        ALTER TABLE public.affiliates DROP CONSTRAINT affiliates_eligible_plan_tier_check;
    END IF;

    ALTER TABLE public.affiliates 
        ADD CONSTRAINT affiliates_eligible_plan_tier_check 
        CHECK (eligible_plan_tier IN ('none', 'solo', 'team', 'enterprise'));

    ALTER TABLE public.affiliates 
        ALTER COLUMN eligible_plan_tier SET DEFAULT 'none';
END $$;

-- ==============================================================================
-- 2. LIMPEZA DEFENSIVA PRÉVIA DE RPCs (PREVENÇÃO DE OVERLOAD E ERRO PGRST203)
-- ==============================================================================

DROP FUNCTION IF EXISTS public.calculate_affiliate_tier_benefits(integer, text);
DROP FUNCTION IF EXISTS public.calculate_affiliate_tier_benefits(integer);
DROP FUNCTION IF EXISTS public.recalculate_affiliate_tier(uuid);
DROP FUNCTION IF EXISTS public.trg_affiliate_conversions_sync_tier();

-- ==============================================================================
-- 3. RPC CANÔNICA: calculate_affiliate_tier_benefits
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.calculate_affiliate_tier_benefits(
    _active_referrals integer,
    _floor_tier text DEFAULT 'bronze'
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
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

COMMENT ON FUNCTION public.calculate_affiliate_tier_benefits(integer, text) IS 
'Calcula deterministicamente benefícios, comissões de fechamento/recorrência, isenções de planos e perks dos 8 tiers gamificados de afiliados com suporte a piso estratégico.';

-- ==============================================================================
-- 4. RPC CANÔNICA: recalculate_affiliate_tier
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_affiliate_tier(
    _affiliate_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

COMMENT ON FUNCTION public.recalculate_affiliate_tier(uuid) IS 
'Recalcula e sincroniza em tempo real o contador de ativos, tier, comissões e isenções de plano do afiliado, respeitando overrides manuais.';

-- ==============================================================================
-- 5. TRIGGER: trg_sync_affiliate_tier_on_conversion EM public.affiliate_conversions
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.trg_affiliate_conversions_sync_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

COMMENT ON FUNCTION public.trg_affiliate_conversions_sync_tier() IS 
'Trigger pós inserção, atualização ou exclusão de conversões para sincronizar em tempo real o tier e benefícios do afiliado.';

DROP TRIGGER IF EXISTS trg_sync_affiliate_tier_on_conversion ON public.affiliate_conversions;
CREATE TRIGGER trg_sync_affiliate_tier_on_conversion
    AFTER INSERT OR UPDATE OR DELETE ON public.affiliate_conversions
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_affiliate_conversions_sync_tier();

-- ==============================================================================
-- 6. PERMISSÕES DE EXECUÇÃO (GRANTS)
-- ==============================================================================

-- calculate_affiliate_tier_benefits é uma função pura/determinística, pode ser consultada por authenticated, anon e service_role
GRANT EXECUTE ON FUNCTION public.calculate_affiliate_tier_benefits(integer, text) TO authenticated, anon, service_role;

-- recalculate_affiliate_tier é de gestão de estado, acessível por authenticated e service_role
GRANT EXECUTE ON FUNCTION public.recalculate_affiliate_tier(uuid) TO authenticated, service_role;
