-- Migration: 20261022094500_add_patient_exclusive_access.sql
-- Description: Adiciona suporte backend a pacientes exclusivos e capability patients.manage_exclusive

-- ==============================================================================
-- 1. COLUNAS DE EXCLUSIVIDADE NA TABELA PATIENTS
-- ==============================================================================

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS is_exclusive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclusive_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- Índices otimizados
CREATE INDEX IF NOT EXISTS idx_patients_is_exclusive ON public.patients (clinic_id, is_exclusive) WHERE is_exclusive = true;
CREATE INDEX IF NOT EXISTS idx_patients_exclusive_users ON public.patients USING gin (exclusive_user_ids);

-- ==============================================================================
-- 2. FUNÇÃO AUXILIAR: is_clinic_owner
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_clinic_owner(
  _clinic_id uuid,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_memberships cm
    WHERE cm.clinic_id = _clinic_id
      AND cm.user_id = _user_id
      AND cm.is_active = true
      AND cm.membership_status = 'active'
      AND (cm.account_role = 'account_owner' OR cm.operational_role = 'owner')
  ) OR EXISTS (
    SELECT 1
    FROM public.clinics c
    WHERE c.id = _clinic_id
      AND c.account_owner_user_id = _user_id
  );
$$;

ALTER FUNCTION public.is_clinic_owner(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_clinic_owner(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_clinic_owner(uuid, uuid) TO authenticated, service_role, anon;

-- ==============================================================================
-- 3. CONSTRAINT DE CAPABILITIES CONHECIDAS
-- ==============================================================================

ALTER TABLE public.clinic_operational_role_capabilities
  DROP CONSTRAINT IF EXISTS clinic_operational_role_capabilities_known;

ALTER TABLE public.clinic_operational_role_capabilities
  ADD CONSTRAINT clinic_operational_role_capabilities_known CHECK (
    capability IN (
      'clinic_profile.read',
      'clinic_profile.manage',
      'clinic_terms.manage',
      'clinic_trash.manage',
      'forms.read',
      'forms.manage',
      'subaccounts.read',
      'subaccounts.write',
      'subaccounts.manage',
      'subaccounts.delete',
      'subaccounts_roles.read',
      'subaccounts_roles.manage',
      'subscription_billing.read',
      'subscription_billing.manage',
      'treasury.read',
      'treasury.manage',
      'agenda.delete_events',
      'subaccounts_analytics.read',
      'team_development.manage',
      'patients.read',
      'patients.write',
      'patients.delete',
      'patients.manage_exclusive',
      'patients_groups.read',
      'patients.manage_groups',
      'schedule.read',
      'schedule.read_all',
      'schedule.write',
      'schedule.write_others',
      'sessions.read',
      'sessions.write',
      'sessions.read_all',
      'sessions.write_others',
      'sessions.share',
      'sessions.delete',
      'session.delete_draft',
      'system.print'
    )
  );

-- ==============================================================================
-- 4. ATUALIZAR current_user_can E current_user_can_role_capability
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.current_user_can(
  _capability text,
  _clinic_id uuid DEFAULT NULL::uuid
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
  _role_key text;
  _membership_status public.membership_status_type;
  _is_active boolean;
  _subscription_plan public.subscription_plan;
  _plan_str text;
  _clinic_owner_id uuid;
  _override_enabled boolean;
  _sub record;
  _is_subscription_expired boolean := false;
  _is_read_only boolean := false;
  _is_owner boolean := false;
  _can_have_subaccounts boolean := false;
  _canonical_capability text := _capability;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Normalize synonym capabilities
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

  IF _resolved_clinic_id IS NULL THEN
    RETURN false;
  END IF;

  -- Bypass for Platform Owner in active simulation context
  IF public.is_platform_owner(_user_id)
     AND public.get_active_platform_clinic_id(_user_id) = _resolved_clinic_id THEN
    RETURN true;
  END IF;

  SELECT
    clinic_memberships.account_role,
    clinic_memberships.operational_role,
    clinic_memberships.role_key,
    clinic_memberships.membership_status,
    clinic_memberships.is_active,
    clinics.subscription_plan,
    LOWER(COALESCE(clinics.subscription_plan::text, 'solo')),
    clinics.account_owner_user_id
  INTO
    _account_role,
    _operational_role,
    _role_key,
    _membership_status,
    _is_active,
    _subscription_plan,
    _plan_str,
    _clinic_owner_id
  FROM public.clinic_memberships
  JOIN public.clinics ON clinics.id = clinic_memberships.clinic_id
  WHERE clinic_memberships.user_id = _user_id
    AND clinic_memberships.clinic_id = _resolved_clinic_id
  LIMIT 1;

  -- Fallback if user is account_owner_user_id on clinics
  IF _operational_role IS NULL THEN
    SELECT
      'account_owner'::public.account_role_type,
      'owner'::public.operational_role_type,
      'owner',
      'active'::public.membership_status_type,
      true,
      clinics.subscription_plan,
      LOWER(COALESCE(clinics.subscription_plan::text, 'solo')),
      clinics.account_owner_user_id
    INTO
      _account_role,
      _operational_role,
      _role_key,
      _membership_status,
      _is_active,
      _subscription_plan,
      _plan_str,
      _clinic_owner_id
    FROM public.clinics
    WHERE clinics.id = _resolved_clinic_id
      AND clinics.account_owner_user_id = _user_id
    LIMIT 1;
  END IF;

  IF _is_active IS DISTINCT FROM true
     OR _membership_status IS DISTINCT FROM 'active'::public.membership_status_type THEN
    RETURN false;
  END IF;

  _is_owner := (_account_role = 'account_owner' OR _operational_role = 'owner' OR _clinic_owner_id = _user_id);
  _can_have_subaccounts := _plan_str IN ('clinic', 'enterprise', 'clinica_basico', 'clinica_medio', 'clinica_top', 'prof_top');

  -- 1. Check Subscription & Read-Only state
  SELECT * INTO _sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _resolved_clinic_id
  LIMIT 1;

  IF _sub IS NOT NULL THEN
    IF COALESCE(_sub.is_courtesy, false) = false AND _sub.status NOT IN ('ACTIVE', 'BETA', 'COURTESY', 'PENDING') THEN
      IF _sub.status = 'TRIAL_EXPIRED' AND NOT _is_owner THEN
        RETURN false;
      END IF;

      IF public.is_clinic_read_only(_resolved_clinic_id) THEN
        _is_read_only := true;
        IF (_sub.status IN ('TRIAL_EXPIRED', 'TRIAL')) AND NOT _is_owner THEN
          RETURN false;
        END IF;
      END IF;

      IF _sub.status IN ('EXPIRED', 'SUSPENDED', 'CANCELED') THEN
        _is_subscription_expired := true;
      END IF;
    END IF;
  END IF;

  -- If clinic is in read-only or expired subscription mode:
  IF _is_read_only OR _is_subscription_expired THEN
    IF _capability = 'subscription_billing.manage' AND _is_owner THEN
      RETURN true;
    END IF;

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

    RETURN false;
  END IF;

  -- Owner has full access in active clinic
  IF _is_owner THEN
    RETURN true;
  END IF;

  IF _capability = 'subscription_billing.manage' THEN
    RETURN false;
  END IF;

  -- 2. Check Overrides in clinic_operational_role_capabilities
  IF _role_key IS NOT NULL AND _role_key <> '' THEN
    SELECT enabled
    INTO _override_enabled
    FROM public.clinic_operational_role_capabilities
    WHERE clinic_id = _resolved_clinic_id
      AND operational_role = _role_key
      AND capability IN (_capability, _canonical_capability)
    ORDER BY (capability = _canonical_capability) DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN _override_enabled;
    END IF;
  END IF;

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

  -- 3. Default Canonical Permission Matrix
  CASE _capability
    WHEN 'clinic_profile.read',
         'clinic_profile.manage',
         'clinic_terms.manage',
         'clinic_trash.manage',
         'forms.manage',
         'treasury.read',
         'treasury.manage',
         'agenda.delete_events',
         'patients.delete',
         'sessions.read_all',
         'sessions.write_others',
         'sessions.delete' THEN
      RETURN _operational_role IN ('owner', 'admin');

    WHEN 'patients.manage_exclusive' THEN
      RETURN _operational_role = 'owner';

    WHEN 'forms.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');

    WHEN 'subaccounts.read',
         'subaccounts.write',
         'subaccounts.manage',
         'subaccounts.delete',
         'subaccounts_roles.read',
         'subaccounts_roles.manage',
         'team_development.manage',
         'subaccounts_analytics.read' THEN
      RETURN _can_have_subaccounts AND _operational_role IN ('owner', 'admin');

    WHEN 'subscription_billing.read' THEN
      RETURN _is_owner OR _operational_role = 'admin';

    WHEN 'patients.read',
         'patients.write',
         'patients.manage_groups',
         'patient_groups.write',
         'patients_groups.write',
         'patient_groups.read',
         'patients_groups.read',
         'system.print' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');

    WHEN 'agenda.read',
         'schedule.read',
         'agenda.write',
         'schedule.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');

    WHEN 'schedule.read_all',
         'schedule.write_others' THEN
      RETURN _operational_role IN ('owner', 'admin', 'assistant');

    WHEN 'sessions.read',
         'sessions.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'estagiario');

    WHEN 'sessions.share',
         'session.delete_draft' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');

    ELSE
      IF _canonical_capability <> _capability THEN
        CASE _canonical_capability
          WHEN 'patients.manage_groups', 'patients_groups.read' THEN
            RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
          WHEN 'schedule.read', 'schedule.write' THEN
            RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
          ELSE
            RETURN false;
        END CASE;
      END IF;
      RETURN false;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_role_capability(
  _capability text,
  _clinic_id uuid DEFAULT NULL::uuid
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
  _operational_role public.operational_role_type;
  _role_key text;
  _account_role public.account_role_type;
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
  _is_clinic_tier boolean := false;
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
    clinic_memberships.role_key,
    clinic_memberships.membership_status,
    clinic_memberships.is_active,
    clinics.subscription_plan,
    clinics.account_owner_user_id
  INTO
    _account_role,
    _operational_role,
    _role_key,
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
  _is_clinic_tier := (_subscription_plan::text IN ('clinic', 'enterprise', 'clinica_basico', 'clinica_medio', 'clinica_top', 'prof_top'));

  -- 1. Checagem de Assinatura e Read-Only
  SELECT * INTO _sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _resolved_clinic_id
  LIMIT 1;

  IF _sub IS NOT NULL THEN
    IF _sub.status = 'TRIAL_EXPIRED' AND NOT _is_owner THEN
      RETURN false;
    END IF;

    IF public.is_clinic_read_only(_resolved_clinic_id) THEN
      _is_read_only := true;
      IF (_sub.status IN ('TRIAL_EXPIRED', 'TRIAL')) AND NOT _is_owner THEN
        RETURN false;
      END IF;
    END IF;

    IF _sub.status NOT IN ('BETA', 'TRIAL', 'COURTESY') AND COALESCE(_sub.is_courtesy, false) = false THEN
      IF _sub.expires_at IS NOT NULL AND _sub.expires_at < now() THEN
        _is_subscription_expired := true;
      ELSIF _sub.status IN ('EXPIRED', 'SUSPENDED') THEN
        _is_subscription_expired := true;
      END IF;
    END IF;
  END IF;

  IF _is_read_only OR _is_subscription_expired THEN
    IF _capability = 'subscription_billing.manage' AND _is_owner THEN
      RETURN true;
    END IF;

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

    RETURN false;
  END IF;

  -- 2. Salvaguarda de Plano: Em planos monoposto, subaccounts.* e roles.* são expressamente desabilitados mesmo para o owner
  IF NOT _is_clinic_tier AND _canonical_capability IN (
    'subaccounts.write',
    'subaccounts.manage',
    'subaccounts.delete',
    'subaccounts_roles.manage',
    'team_development.manage'
  ) THEN
    RETURN false;
  END IF;

  IF _is_owner THEN
    RETURN true;
  END IF;

  IF _capability = 'subscription_billing.manage' THEN
    RETURN false;
  END IF;

  -- 3. Checagem de Override na tabela clinic_operational_role_capabilities
  IF _role_key IS NOT NULL AND _role_key <> '' THEN
    SELECT enabled
    INTO _override_enabled
    FROM public.clinic_operational_role_capabilities
    WHERE clinic_id = _resolved_clinic_id
      AND operational_role = _role_key
      AND capability IN (_capability, _canonical_capability)
    ORDER BY (capability = _canonical_capability) DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN _override_enabled;
    END IF;
  END IF;

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

  -- 4. Matriz Padrão Canônica de Permissões
  CASE _capability
    WHEN 'clinic_profile.read' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'clinic_profile.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'clinic_terms.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'clinic_trash.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'forms.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'forms.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.read' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.write' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.manage' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.delete' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.read' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.manage' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subscription_billing.read' THEN
      RETURN _is_owner;
    WHEN 'team_development.manage' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'treasury.read' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'treasury.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'agenda.delete_events' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_analytics.read' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'patients.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'patients.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'patients.delete' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'patients.manage_exclusive' THEN
      RETURN _operational_role = 'owner';
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
      RETURN _operational_role IN ('owner', 'admin');
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
      IF _canonical_capability <> _capability THEN
        CASE _canonical_capability
          WHEN 'patients.manage_groups', 'patients_groups.read' THEN
            RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
          WHEN 'schedule.read', 'schedule.write' THEN
            RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
          ELSE
            RETURN false;
        END CASE;
      END IF;
      RETURN false;
  END CASE;
END;
$$;

-- ==============================================================================
-- 5. ATUALIZAR POLÍTICAS RLS EM PUBLIC.PATIENTS
-- ==============================================================================

-- 5.1. LEITURA (SELECT)
DROP POLICY IF EXISTS "Users read clinic patients" ON public.patients;

CREATE POLICY "Users read clinic patients" ON public.patients
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND clinic_id = COALESCE(
    (NULLIF(auth.jwt() ->> 'active_clinic_id', ''))::uuid,
    public.get_user_clinic_id(auth.uid())
  )
  AND public.can_read_clinic_data(clinic_id)
  AND public.current_user_can('patients.read'::text, clinic_id)
  AND (
    NOT is_exclusive
    OR public.is_clinic_owner(clinic_id, auth.uid())
    OR auth.uid() = ANY(exclusive_user_ids)
  )
);

-- 5.2. ATUALIZAÇÃO (UPDATE)
DROP POLICY IF EXISTS "Users update clinic patients" ON public.patients;

CREATE POLICY "Users update clinic patients" ON public.patients
FOR UPDATE TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('patients.write'::text, clinic_id)
  AND (
    NOT is_exclusive
    OR public.is_clinic_owner(clinic_id, auth.uid())
    OR auth.uid() = ANY(exclusive_user_ids)
  )
)
WITH CHECK (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('patients.write'::text, clinic_id)
  AND (
    NOT is_exclusive
    OR public.is_clinic_owner(clinic_id, auth.uid())
    OR auth.uid() = ANY(exclusive_user_ids)
  )
);

-- 5.3. EXCLUSÃO (DELETE)
DROP POLICY IF EXISTS "Users delete clinic patients" ON public.patients;

CREATE POLICY "Users delete clinic patients" ON public.patients
FOR DELETE TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('patients.delete'::text, clinic_id)
  AND (
    NOT is_exclusive
    OR public.is_clinic_owner(clinic_id, auth.uid())
    OR auth.uid() = ANY(exclusive_user_ids)
  )
);
