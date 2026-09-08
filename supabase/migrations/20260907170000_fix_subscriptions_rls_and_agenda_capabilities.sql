-- Migration: 20260907170000_fix_subscriptions_rls_and_agenda_capabilities.sql
-- Descrição: Correções de segurança e consistência de RLS, agenda capabilities, isolamento financeiro e limites de subcontas.
-- IDs: [SEC-01], [BUG-01], [SEC-02], [INT-02]

-- 1. [SEC-01] Corrigir RLS em patient_evolution_groups para blindar contra DELETE em modo somente leitura
DROP POLICY IF EXISTS "Users manage clinic evolution groups" ON public.patient_evolution_groups;
DROP POLICY IF EXISTS "Users read clinic evolution groups" ON public.patient_evolution_groups;
DROP POLICY IF EXISTS "Users write clinic evolution groups" ON public.patient_evolution_groups;

-- Política de leitura: permitida se can_read_clinic_data e sessions.read
CREATE POLICY "Users read clinic evolution groups" ON public.patient_evolution_groups
FOR SELECT TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.can_read_clinic_data(clinic_id)
  AND public.current_user_can('sessions.read', clinic_id)
);

-- Política de mutação (INSERT, UPDATE, DELETE): bloqueada terminantemente se a clínica for read-only
CREATE POLICY "Users write clinic evolution groups" ON public.patient_evolution_groups
FOR ALL TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('sessions.write', clinic_id)
)
WITH CHECK (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('sessions.write', clinic_id)
);

-- 2. [BUG-01] Atualizar current_user_can para suportar 'agenda.read' e 'agenda.write' mapeados canonicamente
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
  _clinic_owner_id uuid;
  _override_enabled boolean;
  _sub record;
  _is_subscription_expired boolean := false;
  _is_read_only boolean := false;
  _is_owner boolean := false;
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
    clinics.subscription_plan,
    clinics.account_owner_user_id
  INTO
    _account_role,
    _operational_role,
    _membership_status,
    _is_active,
    _subscription_plan,
    _clinic_owner_id
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

  _is_owner := (_account_role = 'account_owner' OR _operational_role = 'owner' OR _clinic_owner_id = _user_id);

  -- 1. Checagem de Assinatura e Read-Only
  SELECT * INTO _sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _resolved_clinic_id
  LIMIT 1;

  IF _sub IS NOT NULL THEN
    -- A. Bloqueio completo de colaboradores que NÃO sejam o owner quando status for TRIAL_EXPIRED
    IF _sub.status = 'TRIAL_EXPIRED' AND NOT _is_owner THEN
      RETURN false;
    END IF;

    -- B. Checagem de status TRIAL que expirou
    IF public.is_clinic_read_only(_resolved_clinic_id) THEN
      _is_read_only := true;
      -- Se for colaborador não-owner e o trial já expirou, bloqueia o acesso
      IF (_sub.status = 'TRIAL_EXPIRED' OR _sub.status = 'TRIAL' OR COALESCE(_sub.is_free_trial, false) = true) AND NOT _is_owner THEN
        RETURN false;
      END IF;
    END IF;

    -- C. Checagem de expiração regular (não-trial e não-cortesia)
    IF _sub.status NOT IN ('BETA', 'TRIAL', 'COURTESY') AND COALESCE(_sub.is_courtesy, false) = false THEN
      IF _sub.expires_at IS NOT NULL AND _sub.expires_at < now() THEN
        _is_subscription_expired := true;
      ELSIF _sub.status IN ('EXPIRED', 'SUSPENDED') THEN
        _is_subscription_expired := true;
      END IF;
    END IF;
  END IF;

  -- Se a clínica estiver em modo read-only ou com assinatura expirada:
  IF _is_read_only OR _is_subscription_expired THEN
    -- Owner pode gerenciar cobrança/assinatura para regularizar
    IF _capability = 'subscription_billing.manage' AND _is_owner THEN
      RETURN true;
    END IF;

    -- Permite APENAS permissões de leitura (.read)
    IF _capability IN (
      'patients.read',
      'schedule.read',
      'schedule.read_all',
      'agenda.read',
      'sessions.read',
      'sessions.read_all',
      'patient_groups.read',
      'patients_groups.read',
      'subaccounts_analytics.read',
      'subaccounts.read',
      'subaccounts_roles.read',
      'clinic_profile.read',
      'forms.read',
      'anamnesis_forms.read',
      'treasury.read',
      'subscription_billing.read'
    ) THEN
      RETURN true;
    END IF;

    -- Qualquer escrita ou deleção é ESTRITAMENTE bloqueada
    RETURN false;
  END IF;

  -- Se a clínica estiver normal e não expirada, o owner possui acesso pleno:
  IF _is_owner THEN
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

  -- 3. Matriz Padrão Canônica de Permissões
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
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.write' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.manage' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.delete' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.read' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.manage' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'subscription_billing.read' THEN
      RETURN _is_owner;
    WHEN 'team_development.manage' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'treasury.read' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'treasury.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'agenda.delete_events' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_analytics.read' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
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
    WHEN 'agenda.read', 'schedule.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.read_all' THEN
      RETURN _operational_role IN ('owner', 'admin', 'assistant');
    WHEN 'agenda.write', 'schedule.write' THEN
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

-- 3. [SEC-02] Restringir SELECT em clinic_subscriptions e subscription_invoices apenas para o account_owner ou faturamento
DROP POLICY IF EXISTS "Membros ativos da clinica podem ver a assinatura" ON public.clinic_subscriptions;
DROP POLICY IF EXISTS "Owners e gestores podem ver a assinatura" ON public.clinic_subscriptions;

CREATE POLICY "Owners e gestores podem ver a assinatura"
  ON public.clinic_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.clinic_id = clinic_subscriptions.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.membership_status = 'active'
        AND (
          cm.account_role = 'account_owner'
          OR public.current_user_can('subscription_billing.read', clinic_subscriptions.clinic_id)
        )
    )
  );

DROP POLICY IF EXISTS "Membros ativos da clinica podem ver as faturas" ON public.subscription_invoices;
DROP POLICY IF EXISTS "Owners e gestores podem ver as faturas" ON public.subscription_invoices;

CREATE POLICY "Owners e gestores podem ver as faturas"
  ON public.subscription_invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.clinic_id = subscription_invoices.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.membership_status = 'active'
        AND (
          cm.account_role = 'account_owner'
          OR public.current_user_can('subscription_billing.read', subscription_invoices.clinic_id)
        )
    )
  );

-- 4. [INT-02] Atualizar trigger sync_clinic_limits_from_subscription para limites canônicos:
-- Solo: 1 subconta, 1 conc.
-- Clinic: 30 subcontas, 4 conc.
-- Enterprise: 100 subcontas, 10 conc.
CREATE OR REPLACE FUNCTION public.sync_clinic_limits_from_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_subaccount_limit integer;
  v_effective_concurrent_access_limit integer;
  v_base_subaccounts integer;
  v_base_concurrent integer;
BEGIN
  IF NEW.plan_type = 'solo' THEN
    v_base_subaccounts := 1;
    v_base_concurrent := 1;
  ELSIF NEW.plan_type = 'enterprise' THEN
    v_base_subaccounts := coalesce(NEW.base_subaccount_limit, 100);
    v_base_concurrent := coalesce(NEW.base_concurrent_access_count, 10);
  ELSE
    v_base_subaccounts := coalesce(NEW.base_subaccount_limit, 30);
    v_base_concurrent := coalesce(NEW.base_concurrent_access_count, 4);
  END IF;

  v_effective_subaccount_limit := v_base_subaccounts + coalesce(NEW.purchased_subaccount_extra_count, 0);
  v_effective_concurrent_access_limit := v_base_concurrent + coalesce(NEW.additional_concurrent_access_count, 0);

  UPDATE public.clinics
  SET
    subscription_plan = NEW.plan_type,
    subaccount_limit = v_effective_subaccount_limit,
    concurrent_access_limit = v_effective_concurrent_access_limit,
    updated_at = now()
  WHERE id = NEW.clinic_id;

  RETURN NEW;
END;
$$;
