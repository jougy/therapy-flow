-- Migration: 20260905210000_add_courtesy_support_to_clinic_subscriptions.sql
-- Descrição: Adiciona suporte a planos de Cortesia Parceira em clinic_subscriptions,
-- com campos de is_courtesy, courtesy_reason e inclusão do status COURTESY na check constraint.

-- 1. Novas colunas em public.clinic_subscriptions
ALTER TABLE public.clinic_subscriptions
  ADD COLUMN IF NOT EXISTS is_courtesy boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS courtesy_reason text;

-- 2. Atualização da constraint de status para incluir 'COURTESY'
ALTER TABLE public.clinic_subscriptions
  DROP CONSTRAINT IF EXISTS clinic_subscriptions_status_check;

ALTER TABLE public.clinic_subscriptions
  ADD CONSTRAINT clinic_subscriptions_status_check
  CHECK (status IN ('ACTIVE', 'PENDING', 'TRIAL', 'BETA', 'OVERDUE', 'PAUSED', 'CANCELED', 'SUSPENDED', 'EXPIRED', 'COURTESY'));

-- 3. Atualizar função public.current_user_can para garantir que clínicas com cortesia nunca expirem
CREATE OR REPLACE FUNCTION public.current_user_can(
  _clinic_id uuid,
  _capability text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_user_id uuid := auth.uid();
  _resolved_clinic_id uuid;
  _account_role text;
  _operational_role text;
  _membership_status text;
  _is_active boolean;
  _sub public.clinic_subscriptions%ROWTYPE;
  _is_subscription_expired boolean := false;
BEGIN
  IF _current_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Se o clinic_id não foi passado, tenta obter a clínica ativa do usuário
  IF _clinic_id IS NULL THEN
    SELECT last_accessed_clinic_id INTO _resolved_clinic_id
    FROM public.profiles
    WHERE id = _current_user_id;
  ELSE
    _resolved_clinic_id := _clinic_id;
  END IF;

  IF _resolved_clinic_id IS NULL THEN
    RETURN false;
  END IF;

  -- Busca membership ativo do usuário na clínica especificada
  SELECT
    account_role::text,
    operational_role::text,
    membership_status::text,
    is_active
  INTO
    _account_role,
    _operational_role,
    _membership_status,
    _is_active
  FROM public.clinic_memberships
  WHERE clinic_id = _resolved_clinic_id
    AND user_id = _current_user_id
  LIMIT 1;

  IF NOT FOUND OR _is_active IS NOT TRUE OR _membership_status NOT IN ('active', 'invited') THEN
    RETURN false;
  END IF;

  -- Checagem Rigorosa de Assinatura Expirada no Kernel do Postgres
  SELECT * INTO _sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _resolved_clinic_id
  LIMIT 1;

  IF _sub IS NOT NULL AND _sub.status NOT IN ('BETA', 'TRIAL', 'COURTESY') AND COALESCE(_sub.is_courtesy, false) = false THEN
    IF _sub.expires_at IS NOT NULL AND _sub.expires_at < now() THEN
      _is_subscription_expired := true;
    ELSIF _sub.status IN ('EXPIRED', 'SUSPENDED') THEN
      _is_subscription_expired := true;
    END IF;
  END IF;

  -- Se a assinatura estiver expirada, permite APENAS leitura (.read) ou gestao financeira pelo owner
  IF _is_subscription_expired THEN
    IF _capability = 'subscription_billing.manage' AND (_account_role = 'account_owner' OR _operational_role = 'owner') THEN
      RETURN true;
    END IF;
    IF _capability IN ('patients.read', 'schedule.read', 'sessions.read', 'sessions.read_all', 'patient_groups.read', 'subaccounts_analytics.read', 'subaccounts.read', 'subaccounts_roles.read') THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  -- Se nao estiver expirado, owner possui acesso pleno:
  IF _account_role = 'account_owner' OR _operational_role = 'owner' THEN
    RETURN true;
  END IF;

  IF _capability = 'subscription_billing.manage' THEN
    RETURN false;
  END IF;

  RETURN public.role_has_capability(_operational_role, _capability);
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_can(uuid, text) TO authenticated;
