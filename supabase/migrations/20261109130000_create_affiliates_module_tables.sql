-- Migration: 20261109130000_create_affiliates_module_tables.sql
-- Subetapas 1.1 e 1.2: Criação do Módulo de Marketing de Afiliados (Tabelas, Índices, Triggers e RLS)
-- Em estrita conformidade com:
-- 1. Padrão monetário estrito (_cents BIGINT)
-- 2. Soft delete (deleted_at TIMESTAMPTZ, sem ON DELETE CASCADE)
-- 3. Idempotência estrita (IF NOT EXISTS / DROP POLICY IF EXISTS)
-- 4. RBAC e RLS com can(capability) / is_platform_admin

-- ==============================================================================
-- 1. TABELAS DO MÓDULO DE AFILIADOS
-- ==============================================================================

-- 1.1. Tabela: affiliates
CREATE TABLE IF NOT EXISTS public.affiliates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE RESTRICT,
    coupon_code TEXT NOT NULL UNIQUE,
    referral_slug TEXT NOT NULL UNIQUE,
    asaas_account_id TEXT NOT NULL,
    asaas_wallet_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned', 'absorbed_by_platform')),
    absorbed_at TIMESTAMPTZ,
    locked_reason TEXT,
    tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'sapphire', 'ruby', 'emerald', 'diamond', 'legendary')),
    minimum_tier_floor TEXT NOT NULL DEFAULT 'bronze' CHECK (minimum_tier_floor IN ('bronze', 'silver', 'gold', 'sapphire', 'ruby', 'emerald', 'diamond', 'legendary')),
    is_tier_manual_override BOOLEAN NOT NULL DEFAULT false,
    manual_tier_notes TEXT,
    pix_key TEXT,
    pix_key_type TEXT,
    first_month_commission_percent NUMERIC(5,2) NOT NULL DEFAULT 30.00,
    recurring_commission_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    plan_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    eligible_plan_tier TEXT NOT NULL DEFAULT 'solo' CHECK (eligible_plan_tier IN ('solo', 'team', 'enterprise')),
    is_subscription_waived BOOLEAN NOT NULL DEFAULT false,
    is_waiver_manual_override BOOLEAN NOT NULL DEFAULT false,
    active_referrals_count INTEGER NOT NULL DEFAULT 0,
    total_sales_count INTEGER NOT NULL DEFAULT 0,
    lifetime_commission_cents BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE public.affiliates IS 'Cadastro de parceiros e promotores do programa de afiliados Pluri-Health.';
COMMENT ON COLUMN public.affiliates.lifetime_commission_cents IS 'Total histórico acumulado em centavos de comissões geradas pelo afiliado.';

-- 1.2. Tabela: affiliate_conversions
CREATE TABLE IF NOT EXISTS public.affiliate_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE RESTRICT,
    customer_user_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
    asaas_subscription_id TEXT,
    plan_type TEXT NOT NULL,
    billing_cycle TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trial', 'active', 'past_due', 'canceled')),
    beneficiary_type TEXT NOT NULL DEFAULT 'affiliate' CHECK (beneficiary_type IN ('affiliate', 'platform_master')),
    pending_split_removal BOOLEAN NOT NULL DEFAULT false,
    split_removal_effective_at TIMESTAMPTZ,
    total_cycles_paid INTEGER NOT NULL DEFAULT 0,
    next_due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE public.affiliate_conversions IS 'Assinaturas e contas originadas por cupom ou link de referência de afiliado.';

-- 1.3. Tabela: affiliate_commissions
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE RESTRICT,
    conversion_id UUID NOT NULL REFERENCES public.affiliate_conversions(id) ON DELETE RESTRICT,
    asaas_payment_id TEXT NOT NULL,
    is_first_month BOOLEAN NOT NULL DEFAULT false,
    gross_amount_cents BIGINT NOT NULL,
    commission_percent NUMERIC(5,2) NOT NULL,
    commission_amount_cents BIGINT NOT NULL,
    pluri_net_cents BIGINT NOT NULL,
    payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'received', 'refunded')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE public.affiliate_commissions IS 'Lançamentos individuais de repasse/split de comissão por pagamento faturado no Asaas.';
COMMENT ON COLUMN public.affiliate_commissions.gross_amount_cents IS 'Valor bruto do pagamento em centavos.';
COMMENT ON COLUMN public.affiliate_commissions.commission_amount_cents IS 'Valor repassado ao afiliado em centavos.';
COMMENT ON COLUMN public.affiliate_commissions.pluri_net_cents IS 'Valor líquido retido pela Pluri-Health em centavos.';

-- 1.4. Tabela: affiliate_crm_logs
CREATE TABLE IF NOT EXISTS public.affiliate_crm_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE RESTRICT,
    conversion_id UUID NOT NULL REFERENCES public.affiliate_conversions(id) ON DELETE RESTRICT,
    action_type TEXT NOT NULL CHECK (action_type IN ('whatsapp_contact', 'note', 'status_change', 'churn_alert')),
    content TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.affiliate_crm_logs IS 'Histórico e anotações de relacionamento CRM do afiliado com suas indicações.';

-- ==============================================================================
-- 2. ÍNDICES DE PERFORMANCE B-TREE
-- ==============================================================================

-- 2.1. Índices em affiliates
CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON public.affiliates (user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_coupon_code ON public.affiliates (coupon_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_referral_slug ON public.affiliates (referral_slug);
CREATE INDEX IF NOT EXISTS idx_affiliates_clinic_id ON public.affiliates (clinic_id);

-- 2.2. Índices em affiliate_conversions
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_affiliate_id ON public.affiliate_conversions (affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_clinic_id ON public.affiliate_conversions (clinic_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_customer_user_id ON public.affiliate_conversions (customer_user_id);

-- 2.3. Índices em affiliate_commissions
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON public.affiliate_commissions (affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_conversion_id ON public.affiliate_commissions (conversion_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_payment_status ON public.affiliate_commissions (payment_status);

-- 2.4. Índices em affiliate_crm_logs
CREATE INDEX IF NOT EXISTS idx_affiliate_crm_logs_affiliate_created ON public.affiliate_crm_logs (affiliate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_crm_logs_conversion_id ON public.affiliate_crm_logs (conversion_id);

-- ==============================================================================
-- 3. TRIGGERS PARA UPDATED_AT AUTOMÁTICO
-- ==============================================================================

DROP TRIGGER IF EXISTS trg_update_affiliates_updated_at ON public.affiliates;
CREATE TRIGGER trg_update_affiliates_updated_at
    BEFORE UPDATE ON public.affiliates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_affiliate_conversions_updated_at ON public.affiliate_conversions;
CREATE TRIGGER trg_update_affiliate_conversions_updated_at
    BEFORE UPDATE ON public.affiliate_conversions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_affiliate_commissions_updated_at ON public.affiliate_commissions;
CREATE TRIGGER trg_update_affiliate_commissions_updated_at
    BEFORE UPDATE ON public.affiliate_commissions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) & POLÍTICAS DE ACESSO
-- ==============================================================================

-- 4.1. Habilitar RLS nas 4 tabelas
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_crm_logs ENABLE ROW LEVEL SECURITY;

-- 4.2. Políticas para affiliates
-- SELECT: afiliado dono, membro admin/gestor da clínica associada ou admin da plataforma
DROP POLICY IF EXISTS "Users can read affiliates if owner, clinic admin or platform admin" ON public.affiliates;
CREATE POLICY "Users can read affiliates if owner, clinic admin or platform admin"
    ON public.affiliates
    FOR SELECT
    TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR (
            clinic_id IS NOT NULL AND (
                EXISTS (
                    SELECT 1 FROM public.clinic_memberships cm
                    WHERE cm.clinic_id = affiliates.clinic_id
                      AND cm.user_id = (SELECT auth.uid())
                      AND cm.is_active = true
                      AND cm.membership_status = 'active'
                      AND (cm.account_role = 'account_owner' OR cm.operational_role IN ('owner', 'admin'))
                )
                OR EXISTS (
                    SELECT 1 FROM public.clinics c
                    WHERE c.id = affiliates.clinic_id
                      AND c.account_owner_user_id = (SELECT auth.uid())
                )
            )
        )
        OR public.is_platform_admin((SELECT auth.uid()))
        OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
    );

-- Plataforma/Admin gerencia afiliados
DROP POLICY IF EXISTS "Platform admins manage affiliates" ON public.affiliates;
CREATE POLICY "Platform admins manage affiliates"
    ON public.affiliates
    FOR ALL
    TO authenticated
    USING (
        public.is_platform_admin((SELECT auth.uid()))
        OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
    )
    WITH CHECK (
        public.is_platform_admin((SELECT auth.uid()))
        OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
    );

-- Service role bypass/gestão irrestrita
DROP POLICY IF EXISTS "Service role manages all affiliates" ON public.affiliates;
CREATE POLICY "Service role manages all affiliates"
    ON public.affiliates
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4.3. Políticas para affiliate_conversions
-- SELECT: afiliado dono da conversão ou admin da plataforma
DROP POLICY IF EXISTS "Affiliates and admins read conversions" ON public.affiliate_conversions;
CREATE POLICY "Affiliates and admins read conversions"
    ON public.affiliate_conversions
    FOR SELECT
    TO authenticated
    USING (
        affiliate_id IN (
            SELECT a.id FROM public.affiliates a WHERE a.user_id = (SELECT auth.uid())
        )
        OR public.is_platform_admin((SELECT auth.uid()))
        OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
    );

-- Plataforma gerencia conversões
DROP POLICY IF EXISTS "Platform admins manage conversions" ON public.affiliate_conversions;
CREATE POLICY "Platform admins manage conversions"
    ON public.affiliate_conversions
    FOR ALL
    TO authenticated
    USING (
        public.is_platform_admin((SELECT auth.uid()))
        OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
    )
    WITH CHECK (
        public.is_platform_admin((SELECT auth.uid()))
        OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
    );

DROP POLICY IF EXISTS "Service role manages all conversions" ON public.affiliate_conversions;
CREATE POLICY "Service role manages all conversions"
    ON public.affiliate_conversions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4.4. Políticas para affiliate_commissions
-- SELECT: afiliado dono da comissão ou admin da plataforma
DROP POLICY IF EXISTS "Affiliates and admins read commissions" ON public.affiliate_commissions;
CREATE POLICY "Affiliates and admins read commissions"
    ON public.affiliate_commissions
    FOR SELECT
    TO authenticated
    USING (
        affiliate_id IN (
            SELECT a.id FROM public.affiliates a WHERE a.user_id = (SELECT auth.uid())
        )
        OR public.is_platform_admin((SELECT auth.uid()))
        OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
    );

-- INSERT / UPDATE em comissões bloqueado para usuários comuns (somente service_role ou platform_admins)
DROP POLICY IF EXISTS "Platform admins manage commissions" ON public.affiliate_commissions;
CREATE POLICY "Platform admins manage commissions"
    ON public.affiliate_commissions
    FOR ALL
    TO authenticated
    USING (
        public.is_platform_admin((SELECT auth.uid()))
        OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
    )
    WITH CHECK (
        public.is_platform_admin((SELECT auth.uid()))
        OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
    );

DROP POLICY IF EXISTS "Service role manages all commissions" ON public.affiliate_commissions;
CREATE POLICY "Service role manages all commissions"
    ON public.affiliate_commissions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4.5. Políticas para affiliate_crm_logs
-- SELECT: afiliado dono ou admin da plataforma
DROP POLICY IF EXISTS "Affiliates and admins read crm logs" ON public.affiliate_crm_logs;
CREATE POLICY "Affiliates and admins read crm logs"
    ON public.affiliate_crm_logs
    FOR SELECT
    TO authenticated
    USING (
        affiliate_id IN (
            SELECT a.id FROM public.affiliates a WHERE a.user_id = (SELECT auth.uid())
        )
        OR public.is_platform_admin((SELECT auth.uid()))
        OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
    );

-- INSERT: afiliado dono ou admin da plataforma pode inserir novos logs
DROP POLICY IF EXISTS "Affiliates and admins insert crm logs" ON public.affiliate_crm_logs;
CREATE POLICY "Affiliates and admins insert crm logs"
    ON public.affiliate_crm_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        affiliate_id IN (
            SELECT a.id FROM public.affiliates a WHERE a.user_id = (SELECT auth.uid())
        )
        OR public.is_platform_admin((SELECT auth.uid()))
        OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
    );

-- Plataforma gerencia logs
DROP POLICY IF EXISTS "Platform admins manage crm logs" ON public.affiliate_crm_logs;
CREATE POLICY "Platform admins manage crm logs"
    ON public.affiliate_crm_logs
    FOR ALL
    TO authenticated
    USING (
        public.is_platform_admin((SELECT auth.uid()))
        OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
    )
    WITH CHECK (
        public.is_platform_admin((SELECT auth.uid()))
        OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
    );

DROP POLICY IF EXISTS "Service role manages all crm logs" ON public.affiliate_crm_logs;
CREATE POLICY "Service role manages all crm logs"
    ON public.affiliate_crm_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- 5. PERMISSÕES DE TABELA (GRANTS)
-- ==============================================================================

-- Leitura padrão para autenticados
GRANT SELECT ON TABLE public.affiliates TO authenticated;
GRANT SELECT ON TABLE public.affiliate_conversions TO authenticated;
GRANT SELECT ON TABLE public.affiliate_commissions TO authenticated;
GRANT SELECT, INSERT ON TABLE public.affiliate_crm_logs TO authenticated;

-- Gestão completa para service_role (usado em Webhooks Asaas e Edge Functions)
GRANT ALL ON TABLE public.affiliates TO service_role;
GRANT ALL ON TABLE public.affiliate_conversions TO service_role;
GRANT ALL ON TABLE public.affiliate_commissions TO service_role;
GRANT ALL ON TABLE public.affiliate_crm_logs TO service_role;
