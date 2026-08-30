-- Migration: 20260828030000_subscription_membership_duration_and_auto_renew.sql
-- Descricao: Adiciona controle de duracao do periodo (Mensal 30d, Trimestral 90d, Anual 365d), renovacao automatica (auto_renew), expiracao e bloqueio de escrita (apenas leitura quando expirado).

-- 1. Adicionar colunas na tabela clinic_subscriptions
ALTER TABLE public.clinic_subscriptions
  ADD COLUMN IF NOT EXISTS auto_renew boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS period_duration_days integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 2. Atualizar assinaturas existentes calculando expires_at
UPDATE public.clinic_subscriptions
SET 
  period_duration_days = CASE 
    WHEN billing_cycle = 'ANNUAL' THEN 365
    WHEN billing_cycle = 'QUARTERLY' THEN 90
    ELSE 30
  END,
  expires_at = COALESCE(
    current_period_end,
    (COALESCE(current_period_start, created_at, now()) + (
      CASE 
        WHEN billing_cycle = 'ANNUAL' THEN interval '365 days'
        WHEN billing_cycle = 'QUARTERLY' THEN interval '90 days'
        ELSE interval '30 days'
      END
    ))
  )
WHERE expires_at IS NULL;

-- 3. RPC para alternar renovacao automatica pelo Owner
CREATE OR REPLACE FUNCTION public.toggle_subscription_auto_renew(
  _clinic_id uuid,
  _auto_renew boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Verificar se quem esta chamando e o owner da clinica ou admin da plataforma
  SELECT account_owner_user_id INTO v_owner_id
  FROM public.clinics
  WHERE id = _clinic_id;

  IF v_owner_id IS DISTINCT FROM auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Apenas o proprietário da clínica pode alterar a renovação automática.';
  END IF;

  UPDATE public.clinic_subscriptions
  SET auto_renew = _auto_renew,
      updated_at = now()
  WHERE clinic_id = _clinic_id;

  RETURN jsonb_build_object(
    'success', true,
    'auto_renew', _auto_renew
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_subscription_auto_renew(uuid, boolean) TO authenticated;

-- 4. Atualizar get_clinic_subscription_summary com dados de expiracao e dias restantes
DROP FUNCTION IF EXISTS public.get_clinic_subscription_summary(uuid);
CREATE OR REPLACE FUNCTION public.get_clinic_subscription_summary(_clinic_id uuid)
RETURNS TABLE (
  subscription_id uuid,
  clinic_id uuid,
  account_owner_user_id uuid,
  plan_type public.subscription_plan,
  status text,
  billing_cycle text,
  payment_method text,
  base_monthly_price numeric(10,2),
  total_recurring_monthly_price numeric(10,2),
  base_subaccount_limit integer,
  purchased_subaccount_extra_count integer,
  total_subaccount_limit integer,
  base_concurrent_access_count integer,
  additional_concurrent_access_count integer,
  total_concurrent_access_limit integer,
  next_due_date date,
  current_period_start timestamptz,
  current_period_end timestamptz,
  expires_at timestamptz,
  period_duration_days integer,
  auto_renew boolean,
  days_remaining integer,
  is_expired boolean,
  asaas_customer_id text,
  asaas_subscription_id text,
  applied_coupon_id uuid,
  coupon_code text,
  discount_percentage numeric(5,2),
  discount_fixed_amount numeric(10,2),
  trial_ends_at timestamptz,
  override_reason text,
  override_by_user_id uuid,
  override_at timestamptz,
  cpf_cnpj text,
  billing_email text,
  billing_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.clinic_id = _clinic_id
        AND cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.membership_status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
        AND pa.is_active = true
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado: você não tem permissão para visualizar a assinatura desta clínica.';
  END IF;

  RETURN QUERY
  SELECT
    cs.id AS subscription_id,
    cs.clinic_id,
    cs.account_owner_user_id,
    cs.plan_type,
    cs.status,
    cs.billing_cycle,
    cs.payment_method,
    cs.base_monthly_price,
    cs.total_recurring_monthly_price,
    cs.base_subaccount_limit,
    cs.purchased_subaccount_extra_count,
    (CASE WHEN cs.plan_type = 'solo' THEN 1 ELSE (COALESCE(cs.base_subaccount_limit, 30) + COALESCE(cs.purchased_subaccount_extra_count, 0)) END)::integer AS total_subaccount_limit,
    cs.base_concurrent_access_count,
    cs.additional_concurrent_access_count,
    (CASE WHEN cs.plan_type = 'solo' THEN 1 ELSE (COALESCE(cs.base_concurrent_access_count, 2) + COALESCE(cs.additional_concurrent_access_count, 0)) END)::integer AS total_concurrent_access_limit,
    cs.next_due_date,
    cs.current_period_start,
    cs.current_period_end,
    COALESCE(cs.expires_at, cs.current_period_end, cs.current_period_start + interval '30 days') AS expires_at,
    COALESCE(cs.period_duration_days, 30) AS period_duration_days,
    COALESCE(cs.auto_renew, true) AS auto_renew,
    GREATEST(0, EXTRACT(DAY FROM (COALESCE(cs.expires_at, cs.current_period_end, cs.current_period_start + interval '30 days') - now()))::integer) AS days_remaining,
    (CASE WHEN COALESCE(cs.expires_at, cs.current_period_end) < now() AND cs.status NOT IN ('BETA', 'TRIAL') THEN true ELSE false END) AS is_expired,
    cs.asaas_customer_id,
    cs.asaas_subscription_id,
    cs.applied_coupon_id,
    cs.coupon_code,
    cs.discount_percentage,
    cs.discount_fixed_amount,
    cs.trial_ends_at,
    cs.override_reason,
    cs.override_by_user_id,
    cs.override_at,
    cs.cpf_cnpj,
    cs.billing_email,
    cs.billing_name
  FROM public.clinic_subscriptions cs
  WHERE cs.clinic_id = _clinic_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_clinic_subscription_summary(uuid) TO authenticated;

-- 5. Atualizar can_perform_action para revogar escrita quando a assinatura estiver expirada (Modo Somente Leitura)
CREATE OR REPLACE FUNCTION public.can_perform_action(
  _capability text,
  _clinic_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _resolved_clinic_id uuid;
  _account_role public.account_role_type;
  _operational_role public.operational_role_type;
  _membership_status public.membership_status_type;
  _is_active boolean;
  _subscription_plan public.subscription_plan;
  _sub record;
  _is_subscription_expired boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  _resolved_clinic_id := COALESCE(_clinic_id, public.get_user_clinic_id(_user_id));

  SELECT
    clinic_memberships.account_role,
    clinic_memberships.operational_role,
    clinic_memberships.membership_status,
    clinic_memberships.is_active,
    clinics.subscription_plan
  INTO
    _account_role,
    _operational_role,
    _membership_status,
    _is_active,
    _subscription_plan
  FROM public.clinic_memberships
  JOIN public.clinics ON clinics.id = clinic_memberships.clinic_id
  WHERE clinic_memberships.user_id = _user_id
    AND clinic_memberships.clinic_id = _resolved_clinic_id
  LIMIT 1;

  IF _resolved_clinic_id IS NULL
    OR _is_active IS DISTINCT FROM true
    OR _membership_status IS DISTINCT FROM 'active' THEN
    RETURN false;
  END IF;

  -- Checar se a assinatura esta expirada
  SELECT * INTO _sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _resolved_clinic_id
  LIMIT 1;

  IF _sub IS NOT NULL AND _sub.status NOT IN ('BETA', 'TRIAL') THEN
    IF _sub.expires_at IS NOT NULL AND _sub.expires_at < now() THEN
      _is_subscription_expired := true;
    ELSIF _sub.status = 'EXPIRED' OR _sub.status = 'SUSPENDED' THEN
      _is_subscription_expired := true;
    END IF;
  END IF;

  -- Se a assinatura estiver expirada, permite APENAS leitura ou gerenciamento da assinatura para renovacao
  IF _is_subscription_expired THEN
    IF _capability = 'subscription_billing.manage' AND _account_role = 'account_owner' THEN
      RETURN true;
    END IF;
    -- Permite apenas acoes de leitura (.read)
    IF _capability IN ('patients.read', 'schedule.read', 'sessions.read', 'subaccounts_analytics.read') THEN
      RETURN true;
    END IF;
    -- Qualquer acao de escrita e bloqueada
    RETURN false;
  END IF;

  IF _account_role = 'account_owner' THEN
    RETURN true;
  END IF;

  CASE _capability
    WHEN 'clinic_profile.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'forms.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.manage' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.manage' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'subscription_billing.manage' THEN
      RETURN false;
    WHEN 'treasury.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'agenda.delete_events' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_analytics.read' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'patients.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'patients.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'sessions.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'sessions.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'session.delete_draft' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    ELSE
      RETURN false;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_perform_action(text, uuid) TO authenticated, anon;
