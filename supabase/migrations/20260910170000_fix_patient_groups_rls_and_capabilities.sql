-- Migration: 20260910170000_fix_patient_groups_rls_and_capabilities.sql
-- Descrição: Corrige políticas de RLS e mapeamento de capacidades para patient_groups (linhas de cuidado),
--            permitindo que profissionais e estagiários criem e associem linhas de cuidado durante atendimentos.

-- 1. Atualizar current_user_can com normalização de capacidades e suporte a patient_groups.write
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
  _canonical_capability text := _capability;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Normalização de capacidades sinônimas/canônicas
  IF _capability IN ('patient_groups.write', 'patients_groups.write') THEN
    _canonical_capability := 'patients.manage_groups';
  ELSIF _capability IN ('patient_groups.read') THEN
    _canonical_capability := 'patients_groups.read';
  ELSIF _capability = 'agenda.read' THEN
    _canonical_capability := 'schedule.read';
  ELSIF _capability = 'agenda.write' THEN
    _canonical_capability := 'schedule.write';
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
    ) OR _canonical_capability IN (
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
    AND capability IN (_capability, _canonical_capability)
  ORDER BY (capability = _canonical_capability) DESC
  LIMIT 1;

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
    WHEN 'patients.manage_groups', 'patient_groups.write', 'patients_groups.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'patient_groups.read', 'patients_groups.read' THEN
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
      -- Fallback para conferir capacidade canônica caso informada como alias
      IF _canonical_capability <> _capability THEN
        CASE _canonical_capability
          WHEN 'patients.manage_groups' THEN
            RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
          WHEN 'patients_groups.read' THEN
            RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
          WHEN 'schedule.read' THEN
            RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
          WHEN 'schedule.write' THEN
            RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
          ELSE
            RETURN false;
        END CASE;
      END IF;
      RETURN false;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_can(text, uuid) TO authenticated, anon;

-- 2. Atualizar políticas de RLS na tabela patient_groups
DROP POLICY IF EXISTS "Users write clinic patient_groups" ON public.patient_groups;
CREATE POLICY "Users write clinic patient_groups" ON public.patient_groups
FOR ALL TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND (
    public.current_user_can('patients.manage_groups', clinic_id)
    OR public.current_user_can('patient_groups.write', clinic_id)
    OR public.current_user_can('sessions.write', clinic_id)
  )
)
WITH CHECK (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND (
    public.current_user_can('patients.manage_groups', clinic_id)
    OR public.current_user_can('patient_groups.write', clinic_id)
    OR public.current_user_can('sessions.write', clinic_id)
  )
);

DROP POLICY IF EXISTS "Users read clinic patient_groups" ON public.patient_groups;
CREATE POLICY "Users read clinic patient_groups" ON public.patient_groups
FOR SELECT TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.can_read_clinic_data(clinic_id)
  AND (
    public.current_user_can('patient_groups.read', clinic_id)
    OR public.current_user_can('patients_groups.read', clinic_id)
    OR public.current_user_can('patients.read', clinic_id)
    OR public.current_user_can('sessions.read', clinic_id)
  )
);

-- 3. Trigger preventivo para preencher clinic_id se omitido
CREATE OR REPLACE FUNCTION public.trg_patient_groups_set_clinic_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.clinic_id IS NULL THEN
    NEW.clinic_id := public.get_user_clinic_id(COALESCE(auth.uid(), NEW.user_id));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_patient_groups_set_clinic_id ON public.patient_groups;
CREATE TRIGGER tr_patient_groups_set_clinic_id
BEFORE INSERT ON public.patient_groups
FOR EACH ROW
EXECUTE FUNCTION public.trg_patient_groups_set_clinic_id();
