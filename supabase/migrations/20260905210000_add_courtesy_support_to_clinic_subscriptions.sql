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
  _override_enabled boolean;
  _sub record;
  _is_subscription_expired boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  _resolved_clinic_id := COALESCE(_clinic_id, public.get_user_clinic_id(_user_id));

  -- Bypass para Platform Owner em contexto ativo
  IF _resolved_clinic_id IS NOT NULL
    AND public.is_platform_owner(_user_id)
    AND public.get_active_platform_clinic_id(_user_id) = _resolved_clinic_id THEN
    RETURN true;
  END IF;

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

  -- 1. Checagem Rigorosa de Assinatura Expirada no Kernel do Postgres (ignora se cortesia/trial/beta)
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
    -- Permite apenas consultas de leitura
    IF _capability IN (
      'patients.read',
      'schedule.read',
      'schedule.read_all',
      'sessions.read',
      'sessions.read_all',
      'patient_groups.read',
      'patients_groups.read',
      'subaccounts_analytics.read',
      'subaccounts.read',
      'subaccounts_roles.read',
      'clinic_profile.read',
      'forms.read',
      'treasury.read',
      'subscription_billing.read'
    ) THEN
      RETURN true;
    END IF;
    -- Qualquer escrita e bloqueada
    RETURN false;
  END IF;

  -- Se nao estiver expirado, owner possui acesso pleno:
  IF _account_role = 'account_owner' OR _operational_role = 'owner' THEN
    RETURN true;
  END IF;

  IF _capability = 'subscription_billing.manage' THEN
    RETURN false;
  END IF;

  -- 2. Checagem de Override na tabela clinic_operational_role_capabilities
  SELECT enabled
  INTO _override_enabled
  FROM public.clinic_operational_role_capabilities
  WHERE clinic_id = _resolved_clinic_id
    AND operational_role = _operational_role::text
    AND capability = _capability;

  IF FOUND THEN
    RETURN _override_enabled;
  END IF;

  -- 3. Matriz Padrao Canonica de Permissoes
  CASE _capability
    WHEN 'clinic_profile.read' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'clinic_profile.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'forms.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'forms.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.read' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.write' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.manage' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.delete' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.read' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.manage' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'subscription_billing.read' THEN
      RETURN _account_role = 'account_owner' OR _operational_role = 'owner';
    WHEN 'team_development.manage' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'treasury.read' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'treasury.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'agenda.delete_events' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_analytics.read' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'patients.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'patients.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'patients.delete' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'patients.manage_groups' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'patient_groups.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'patients_groups.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'schedule.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.read_all' THEN
      RETURN _operational_role IN ('owner', 'admin', 'assistant');
    WHEN 'schedule.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.write_others' THEN
      RETURN _operational_role IN ('owner', 'admin', 'assistant');
    WHEN 'sessions.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'estagiario');
    WHEN 'sessions.read_all' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'sessions.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'estagiario');
    WHEN 'sessions.write_others' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'sessions.share' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'sessions.delete' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'session.delete_draft' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'system.print' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    ELSE
      RETURN false;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_can(text, uuid) TO authenticated, anon;
