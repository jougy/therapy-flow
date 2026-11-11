-- Migration: 20261109134000_affiliates_anti_fraud_and_invitations.sql
-- Fase 2 (Etapa 2.1 e Etapa 2.4/2.5) do Programa de Marketing de Afiliados Pluri-Health:
-- 1. Tabela affiliate_invitations com RLS, índices e soft-delete.
-- 2. Prevenção Anti-Fraude e Anti-Self-Referral (Trigger trg_prevent_affiliate_self_referral).
-- 3. Trava Anti-Pirâmide (Nível Único Estrito - Lei Federal 1.521/1951).
-- 4. RPC respond_affiliate_invitation(_invitation_id UUID, _response TEXT).
-- 5. Cooldown de 15 dias, Unicidade Bancária (PIX/Asaas) e Flag Institucional da Clínica.

-- ==============================================================================
-- 0. GARANTIA IDEMPOTENTE DAS TABELAS BASE (DEFENSIVO CONTRA EXECUÇÃO ISOLADA)
-- ==============================================================================

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

-- ==============================================================================
-- 1. TABELA DE CONVITES DE AFILIAÇÃO (affiliate_invitations)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.affiliate_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE RESTRICT,
    invited_user_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
    invited_email TEXT,
    token TEXT NOT NULL UNIQUE,
    floor_tier TEXT NOT NULL DEFAULT 'bronze' CHECK (floor_tier IN ('bronze', 'silver', 'gold', 'sapphire', 'ruby', 'emerald', 'diamond', 'legendary')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE public.affiliate_invitations IS 'Convites formais de afiliação inter-clínicas e representação parceira no Pluri-Health.';
COMMENT ON COLUMN public.affiliate_invitations.token IS 'Token seguro único para link ou identificação da requisição de convite.';
COMMENT ON COLUMN public.affiliate_invitations.status IS 'Status do convite: pending, accepted, rejected ou expired.';
COMMENT ON COLUMN public.affiliate_invitations.expires_at IS 'Data limite de expiração do convite (padrão: D+15 da emissão).';

-- Índices de performance e consulta
CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_invitations_token ON public.affiliate_invitations(token);
CREATE INDEX IF NOT EXISTS idx_affiliate_invitations_invited_user_id ON public.affiliate_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_invitations_clinic_id ON public.affiliate_invitations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_invitations_status ON public.affiliate_invitations(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_invitations_email_lower ON public.affiliate_invitations(lower(invited_email)) WHERE invited_email IS NOT NULL;

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS trg_update_affiliate_invitations_updated_at ON public.affiliate_invitations;
CREATE TRIGGER trg_update_affiliate_invitations_updated_at
    BEFORE UPDATE ON public.affiliate_invitations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================================================
-- 2. ROW LEVEL SECURITY (RLS) EM affiliate_invitations
-- ==============================================================================

ALTER TABLE public.affiliate_invitations ENABLE ROW LEVEL SECURITY;

-- 2.1. Leitura: usuário convidado (por ID ou e-mail), gestores da clínica anfitriã ou platform admins
DROP POLICY IF EXISTS "Invited users and managers read affiliate invitations" ON public.affiliate_invitations;
CREATE POLICY "Invited users and managers read affiliate invitations"
    ON public.affiliate_invitations
    FOR SELECT
    TO authenticated
    USING (
        (invited_user_id IS NOT NULL AND invited_user_id = (SELECT auth.uid()))
        OR (invited_email IS NOT NULL AND LOWER(invited_email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
        OR (
            clinic_id IS NOT NULL AND (
                EXISTS (
                    SELECT 1 FROM public.clinic_memberships cm
                    WHERE cm.clinic_id = affiliate_invitations.clinic_id
                      AND cm.user_id = (SELECT auth.uid())
                      AND cm.is_active = true
                      AND (cm.account_role = 'account_owner' OR cm.operational_role IN ('owner', 'admin'))
                )
                OR EXISTS (
                    SELECT 1 FROM public.clinics c
                    WHERE c.id = affiliate_invitations.clinic_id
                      AND c.account_owner_user_id = (SELECT auth.uid())
                )
                OR public.current_user_can('marketing.affiliates.manage'::text, affiliate_invitations.clinic_id)
                OR public.current_user_can('marketing.affiliates.view'::text, affiliate_invitations.clinic_id)
            )
        )
        OR public.is_platform_admin((SELECT auth.uid()))
        OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
    );

-- 2.2. Gestão: gestores da clínica e platform admins podem criar e administrar convites
DROP POLICY IF EXISTS "Managers and platform admins manage affiliate invitations" ON public.affiliate_invitations;
CREATE POLICY "Managers and platform admins manage affiliate invitations"
    ON public.affiliate_invitations
    FOR ALL
    TO authenticated
    USING (
        (
            clinic_id IS NOT NULL AND (
                EXISTS (
                    SELECT 1 FROM public.clinic_memberships cm
                    WHERE cm.clinic_id = affiliate_invitations.clinic_id
                      AND cm.user_id = (SELECT auth.uid())
                      AND cm.is_active = true
                      AND (cm.account_role = 'account_owner' OR cm.operational_role IN ('owner', 'admin'))
                )
                OR EXISTS (
                    SELECT 1 FROM public.clinics c
                    WHERE c.id = affiliate_invitations.clinic_id
                      AND c.account_owner_user_id = (SELECT auth.uid())
                )
                OR public.current_user_can('marketing.affiliates.manage'::text, affiliate_invitations.clinic_id)
            )
        )
        OR public.is_platform_admin((SELECT auth.uid()))
        OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
    )
    WITH CHECK (
        (
            clinic_id IS NOT NULL AND (
                EXISTS (
                    SELECT 1 FROM public.clinic_memberships cm
                    WHERE cm.clinic_id = affiliate_invitations.clinic_id
                      AND cm.user_id = (SELECT auth.uid())
                      AND cm.is_active = true
                      AND (cm.account_role = 'account_owner' OR cm.operational_role IN ('owner', 'admin'))
                )
                OR EXISTS (
                    SELECT 1 FROM public.clinics c
                    WHERE c.id = affiliate_invitations.clinic_id
                      AND c.account_owner_user_id = (SELECT auth.uid())
                )
                OR public.current_user_can('marketing.affiliates.manage'::text, affiliate_invitations.clinic_id)
            )
        )
        OR public.is_platform_admin((SELECT auth.uid()))
        OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
    );

-- 2.3. Service role irrestrito
DROP POLICY IF EXISTS "Service role manages all affiliate invitations" ON public.affiliate_invitations;
CREATE POLICY "Service role manages all affiliate invitations"
    ON public.affiliate_invitations
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- 3. PREVENÇÃO ANTI-FRAUDE E ANTI-SELF-REFERRAL (Etapa 2.1)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.prevent_affiliate_self_referral()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

COMMENT ON FUNCTION public.prevent_affiliate_self_referral() IS
'Garante que nenhum usuário assine planos utilizando seu próprio cupom de afiliado (anti-self-referral).';

DROP TRIGGER IF EXISTS trg_prevent_affiliate_self_referral ON public.affiliate_conversions;
CREATE TRIGGER trg_prevent_affiliate_self_referral
    BEFORE INSERT ON public.affiliate_conversions
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_affiliate_self_referral();

-- ==============================================================================
-- 4. TRAVA ANTI-PIRÂMIDE (NÍVEL ÚNICO ESTRITO - LEI FEDERAL 1.521/51)
-- ==============================================================================

-- Adiciona coluna de parent_affiliate_id como sentinela anti-multinível estritamente nula
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS parent_affiliate_id UUID DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_affiliates_single_level_anti_pyramid'
  ) THEN
    ALTER TABLE public.affiliates
      ADD CONSTRAINT chk_affiliates_single_level_anti_pyramid
      CHECK (parent_affiliate_id IS NULL);
  END IF;
END $$;

COMMENT ON COLUMN public.affiliates.parent_affiliate_id IS
'Trava anti-pirâmide (Lei 1.521/51): Obrigatório NULL. O modelo de afiliados Pluri-Health é estritamente de nível único (single-level).';

CREATE OR REPLACE FUNCTION public.prevent_affiliate_pyramid_structure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

COMMENT ON FUNCTION public.prevent_affiliate_pyramid_structure() IS
'Assegura cumprimento estrito da Lei 1.521/51 impedindo qualquer tentativa de estruturação multinível ou sub-afiliação.';

DROP TRIGGER IF EXISTS trg_prevent_affiliate_pyramid_structure ON public.affiliates;
CREATE TRIGGER trg_prevent_affiliate_pyramid_structure
    BEFORE INSERT OR UPDATE ON public.affiliates
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_affiliate_pyramid_structure();

-- ==============================================================================
-- 5. ETAPA 2.5: COOLDOWN 15 DIAS, UNICIDADE BANCÁRIA E FLEXIBILIDADE CLÍNICA
-- ==============================================================================

-- 5.1. Coluna de cooldown temporal (anti-pingue-pongue) em affiliates
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS can_change_affiliate_context_after TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.affiliates.can_change_affiliate_context_after IS
'Trava temporal de 15 dias impedindo alternância contínua entre programas de afiliados de diferentes clínicas.';

-- 5.2. Unicidade estrita de dados bancários (Chave PIX e Subconta Asaas)
CREATE OR REPLACE FUNCTION public.validate_affiliate_unique_financial_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

COMMENT ON FUNCTION public.validate_affiliate_unique_financial_data() IS
'Garante unicidade de Chaves PIX e Subcontas Asaas por afiliado no sistema inteiro.';

DROP TRIGGER IF EXISTS trg_validate_affiliate_unique_financial_data ON public.affiliates;
CREATE TRIGGER trg_validate_affiliate_unique_financial_data
    BEFORE INSERT OR UPDATE OF pix_key, asaas_account_id ON public.affiliates
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_affiliate_unique_financial_data();

-- 5.3. Flag de flexibilidade institucional na clínica (Consentimento Mútuo)
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS allow_team_personal_affiliates BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clinics.allow_team_personal_affiliates IS
'Define se colaboradores da clínica podem operar seu programa pessoal de afiliados fora do expediente da clínica.';

-- ==============================================================================
-- 6. RPC: respond_affiliate_invitation
-- ==============================================================================

DROP FUNCTION IF EXISTS public.respond_affiliate_invitation(uuid, text);

CREATE OR REPLACE FUNCTION public.respond_affiliate_invitation(
    _invitation_id UUID,
    _response TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
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

COMMENT ON FUNCTION public.respond_affiliate_invitation(uuid, text) IS
'Responde a um convite de afiliação inter-clínicas (accepted ou rejected), validando vigência, autorização e aplicando cooldown de 15 dias.';

REVOKE ALL ON FUNCTION public.respond_affiliate_invitation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_affiliate_invitation(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.respond_affiliate_invitation(uuid, text) TO authenticated;
