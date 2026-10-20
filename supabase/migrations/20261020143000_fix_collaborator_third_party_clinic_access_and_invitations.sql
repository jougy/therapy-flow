-- =============================================================================
-- Migration: 20261020143000_fix_collaborator_third_party_clinic_access_and_invitations
-- Purpose:
-- 1. Restore collaborator access to third-party clinics immediately:
--    - Clear stale is_free_trial / is_read_only / expired trial flags on active
--      or upgraded clinic subscriptions.
--    - Fix RLS policies on clinics, clinic_memberships, clinic_subscriptions,
--      clinic_operational_roles, and clinic_collaborator_invitations so active
--      collaborators can read third-party clinics and their subscription status.
--    - Prevent reconcile_legacy_users_solo_clinic and handle_personal_signup
--      from overwriting an existing user_active_clinic_contexts entry.
-- 2. Support all multi-user subscription plans ('prof_top', 'clinica_basico',
--    'clinica_medio', 'clinica_top', 'clinic', 'enterprise') in current_user_can,
--    can_perform_action, manage_clinic_subscription_plan, list_current_user_clinics,
--    and collaborator invitation/acceptance RPCs.
-- 3. Fix collaborator slot counting in invite/accept RPCs so the clinic owner's
--    own membership does not consume collaborator subaccount slots, and support
--    role_key aliases ('assistente' -> 'assistant', 'profissional' -> 'professional',
--    'administrador' -> 'admin').
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. DATA REPAIR: Normalize clinic plans, limits, subscription statuses,
--    default operational roles, and backfill any missing memberships
-- =============================================================================

-- 1.1 Normalize clinic access_status and canonical subaccount/concurrent limits
UPDATE public.clinics
SET
  access_status = COALESCE(NULLIF(btrim(access_status), ''), 'active'),
  subaccount_limit = CASE
    WHEN subscription_plan::text IN ('clinica_basico', 'clinica_medio', 'clinica_top', 'clinic', 'enterprise') THEN 999999
    WHEN subscription_plan::text = 'prof_top' THEN GREATEST(COALESCE(subaccount_limit, 2), 2)
    ELSE GREATEST(COALESCE(subaccount_limit, 1), 1)
  END,
  concurrent_access_limit = CASE
    WHEN subscription_plan::text IN ('clinica_top', 'enterprise') THEN GREATEST(COALESCE(concurrent_access_limit, 8), 8)
    WHEN subscription_plan::text IN ('clinica_medio', 'clinic') THEN GREATEST(COALESCE(concurrent_access_limit, 4), 4)
    WHEN subscription_plan::text IN ('clinica_basico', 'prof_top') THEN GREATEST(COALESCE(concurrent_access_limit, 2), 2)
    ELSE GREATEST(COALESCE(concurrent_access_limit, 1), 1)
  END,
  updated_at = now()
WHERE
  access_status IS NULL
  OR (subscription_plan::text = 'prof_top' AND (COALESCE(subaccount_limit, 0) < 2 OR COALESCE(concurrent_access_limit, 0) < 2))
  OR (subscription_plan::text IN ('clinica_basico', 'clinica_medio', 'clinica_top', 'clinic', 'enterprise') AND COALESCE(subaccount_limit, 0) < 999999);

-- 1.2 Clear stale trial / read-only flags on active, courtesy, or upgraded paid subscriptions
UPDATE public.clinic_subscriptions cs
SET
  status = CASE
    WHEN cs.status IN ('TRIAL', 'TRIAL_EXPIRED')
      AND (
        COALESCE(cs.is_courtesy, false) = true
        OR cs.plan_type::text IN ('prof_medio', 'prof_top', 'clinica_basico', 'clinica_medio', 'clinica_top', 'clinic', 'enterprise')
        OR EXISTS (
          SELECT 1 FROM public.clinics c
          WHERE c.id = cs.clinic_id
            AND c.subscription_plan::text IN ('prof_medio', 'prof_top', 'clinica_basico', 'clinica_medio', 'clinica_top', 'clinic', 'enterprise')
        )
      )
    THEN 'ACTIVE'
    ELSE cs.status
  END,
  is_free_trial = CASE
    WHEN cs.status IN ('ACTIVE', 'BETA', 'COURTESY')
      OR COALESCE(cs.is_courtesy, false) = true
      OR cs.plan_type::text IN ('prof_medio', 'prof_top', 'clinica_basico', 'clinica_medio', 'clinica_top', 'clinic', 'enterprise')
      OR EXISTS (
        SELECT 1 FROM public.clinics c
        WHERE c.id = cs.clinic_id
          AND c.subscription_plan::text IN ('prof_medio', 'prof_top', 'clinica_basico', 'clinica_medio', 'clinica_top', 'clinic', 'enterprise')
      )
    THEN false
    ELSE cs.is_free_trial
  END,
  is_read_only = CASE
    WHEN cs.status IN ('ACTIVE', 'BETA', 'COURTESY')
      OR COALESCE(cs.is_courtesy, false) = true
      OR cs.plan_type::text IN ('prof_medio', 'prof_top', 'clinica_basico', 'clinica_medio', 'clinica_top', 'clinic', 'enterprise')
      OR EXISTS (
        SELECT 1 FROM public.clinics c
        WHERE c.id = cs.clinic_id
          AND c.subscription_plan::text IN ('prof_medio', 'prof_top', 'clinica_basico', 'clinica_medio', 'clinica_top', 'clinic', 'enterprise')
      )
    THEN false
    ELSE cs.is_read_only
  END,
  expires_at = CASE
    WHEN (
      cs.status IN ('ACTIVE', 'BETA', 'COURTESY')
      OR COALESCE(cs.is_courtesy, false) = true
      OR cs.plan_type::text IN ('prof_medio', 'prof_top', 'clinica_basico', 'clinica_medio', 'clinica_top', 'clinic', 'enterprise')
    ) AND cs.expires_at IS NOT NULL AND cs.expires_at < now()
    THEN NULL
    ELSE cs.expires_at
  END,
  base_subaccount_limit = CASE
    WHEN cs.plan_type::text IN ('clinica_basico', 'clinica_medio', 'clinica_top', 'clinic', 'enterprise') THEN 999999
    WHEN cs.plan_type::text = 'prof_top' THEN GREATEST(COALESCE(cs.base_subaccount_limit, 2), 2)
    ELSE GREATEST(COALESCE(cs.base_subaccount_limit, 1), 1)
  END,
  base_concurrent_access_count = CASE
    WHEN cs.plan_type::text IN ('clinica_top', 'enterprise') THEN GREATEST(COALESCE(cs.base_concurrent_access_count, 8), 8)
    WHEN cs.plan_type::text IN ('clinica_medio', 'clinic') THEN GREATEST(COALESCE(cs.base_concurrent_access_count, 4), 4)
    WHEN cs.plan_type::text IN ('clinica_basico', 'prof_top') THEN GREATEST(COALESCE(cs.base_concurrent_access_count, 2), 2)
    ELSE GREATEST(COALESCE(cs.base_concurrent_access_count, 1), 1)
  END,
  updated_at = now();

-- 1.3 Ensure system operational roles exist for every clinic
INSERT INTO public.clinic_operational_roles (
  clinic_id,
  role_key,
  label,
  description,
  base_operational_role,
  sort_order,
  is_system
)
SELECT
  c.id,
  r.role_key,
  r.label,
  r.description,
  r.base_operational_role::public.operational_role_type,
  r.sort_order,
  true
FROM public.clinics c
CROSS JOIN (
  VALUES
    ('owner', 'Proprietário(a)', 'Titular da conta com controle total da clínica.', 'owner', 10),
    ('professional', 'Profissional', 'Realiza atendimentos, gerencia prontuários e sua própria agenda.', 'professional', 20),
    ('admin', 'Administrador(a)', 'Gerencia equipe, agenda geral, pacientes e configurações da clínica.', 'admin', 30),
    ('assistant', 'Assistente', 'Apoia na recepção, cadastro de pacientes e gestão de agendamentos.', 'assistant', 40),
    ('estagiario', 'Estagiário(a)', 'Realiza atendimentos e evoluções clínicas sob supervisão.', 'estagiario', 50)
) AS r(role_key, label, description, base_operational_role, sort_order)
ON CONFLICT (clinic_id, role_key) DO NOTHING;

-- 1.4 Backfill active clinic_memberships for any accepted invitations missing membership rows
INSERT INTO public.clinic_memberships (
  clinic_id,
  user_id,
  account_role,
  operational_role,
  role_key,
  membership_status,
  is_active,
  invited_by,
  joined_at,
  ended_at,
  updated_at
)
SELECT DISTINCT ON (inv.clinic_id, u.id)
  inv.clinic_id,
  u.id,
  NULL,
  COALESCE(inv.operational_role, 'professional'::public.operational_role_type),
  COALESCE(NULLIF(btrim(inv.role_key), ''), COALESCE(inv.operational_role::text, 'professional')),
  'active'::public.membership_status_type,
  true,
  inv.invited_by,
  COALESCE(inv.accepted_at, now()),
  NULL,
  now()
FROM public.clinic_collaborator_invitations inv
JOIN auth.users u ON lower(btrim(u.email)) = lower(btrim(inv.email))
WHERE inv.status = 'accepted'
ORDER BY inv.clinic_id, u.id, inv.accepted_at DESC NULLS LAST
ON CONFLICT (clinic_id, user_id) DO UPDATE
SET
  membership_status = 'active'::public.membership_status_type,
  is_active = true,
  ended_at = NULL,
  updated_at = now()
WHERE public.clinic_memberships.membership_status <> 'active'::public.membership_status_type
   OR public.clinic_memberships.is_active IS DISTINCT FROM true;


-- =============================================================================
-- 2. CORE MEMBERSHIP & CLINIC ACCESS HELPERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.user_has_active_clinic_membership(_user_id uuid, _clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_memberships
    JOIN public.clinics ON clinics.id = clinic_memberships.clinic_id
    WHERE clinic_memberships.user_id = _user_id
      AND clinic_memberships.clinic_id = _clinic_id
      AND clinic_memberships.is_active = true
      AND clinic_memberships.membership_status = 'active'::public.membership_status_type
      AND COALESCE(clinics.access_status, 'active') IN ('active', 'payment_pending', 'trialing')
  )
  OR EXISTS (
    SELECT 1
    FROM public.clinics
    WHERE clinics.id = _clinic_id
      AND clinics.account_owner_user_id = _user_id
      AND COALESCE(clinics.access_status, 'active') IN ('active', 'payment_pending', 'trialing')
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_clinic_read_only(_clinic_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sub record;
BEGIN
  IF _clinic_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT
    status,
    is_read_only,
    is_free_trial,
    is_courtesy,
    expires_at,
    current_period_end
  INTO v_sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _clinic_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Active, Beta, Courtesy, or Pending subscriptions are never read-only
  IF COALESCE(v_sub.is_courtesy, false) = true OR v_sub.status IN ('ACTIVE', 'BETA', 'COURTESY', 'PENDING') THEN
    RETURN false;
  END IF;

  IF COALESCE(v_sub.is_read_only, false) = true THEN
    RETURN true;
  END IF;

  IF v_sub.status IN ('TRIAL_EXPIRED', 'SUSPENDED', 'CANCELED', 'EXPIRED') THEN
    RETURN true;
  END IF;

  IF v_sub.status = 'TRIAL' THEN
    IF COALESCE(v_sub.expires_at, v_sub.current_period_end) IS NOT NULL
       AND COALESCE(v_sub.expires_at, v_sub.current_period_end) < now() THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_read_clinic_data(_clinic_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_sub record;
  v_is_owner boolean := false;
BEGIN
  IF v_uid IS NULL OR _clinic_id IS NULL THEN
    RETURN false;
  END IF;

  -- Platform admin / owner bypass
  IF EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE pa.user_id = v_uid AND pa.is_active = true
  ) OR public.is_platform_owner(v_uid) THEN
    RETURN true;
  END IF;

  -- Check if user is clinic owner
  IF EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = _clinic_id AND c.account_owner_user_id = v_uid
  ) OR EXISTS (
    SELECT 1 FROM public.clinic_memberships cm
    WHERE cm.clinic_id = _clinic_id
      AND cm.user_id = v_uid
      AND (cm.account_role = 'account_owner' OR cm.operational_role = 'owner')
      AND cm.is_active = true
      AND cm.membership_status = 'active'
  ) THEN
    v_is_owner := true;
  END IF;

  IF NOT v_is_owner AND NOT public.user_has_active_clinic_membership(v_uid, _clinic_id) THEN
    RETURN false;
  END IF;

  -- Check subscription status
  SELECT status, is_free_trial, is_courtesy, expires_at, current_period_end
  INTO v_sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _clinic_id
  LIMIT 1;

  IF FOUND THEN
    IF COALESCE(v_sub.is_courtesy, false) = true OR v_sub.status IN ('ACTIVE', 'BETA', 'COURTESY', 'PENDING') THEN
      RETURN true;
    END IF;

    IF v_sub.status = 'TRIAL_EXPIRED' AND NOT v_is_owner THEN
      RETURN false;
    END IF;

    IF v_sub.status = 'TRIAL' AND NOT v_is_owner THEN
      IF COALESCE(v_sub.expires_at, v_sub.current_period_end) IS NOT NULL
         AND COALESCE(v_sub.expires_at, v_sub.current_period_end) < now() THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  RETURN true;
END;
$function$;


-- =============================================================================
-- 3. UNIFIED RBAC: current_user_can & can_perform_action
-- =============================================================================

CREATE OR REPLACE FUNCTION public.current_user_can(_capability text, _clinic_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.can_perform_action(_capability text, _clinic_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.current_user_can(_capability, _clinic_id);
$function$;


-- =============================================================================
-- 4. FIX SOLO CLINIC RECONCILIATION & SIGNUP SO THEY NEVER HIJACK ACTIVE CONTEXT
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reconcile_legacy_users_solo_clinic()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rec record;
  v_provisioned_count integer := 0;
  v_public_code text;
  v_clinic_id uuid;
  v_route_suffix text;
  v_route_key text;
  v_clinic_name text;
  v_trial_end timestamptz;
BEGIN
  FOR v_rec IN
    SELECT p.id AS user_id, p.full_name, p.cpf, p.public_code
    FROM public.profiles p
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.clinic_memberships cm
      WHERE cm.user_id = p.id
        AND cm.is_active = true
        AND (cm.account_role = 'account_owner' OR cm.operational_role = 'owner')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.clinics c
      WHERE c.account_owner_user_id = p.id
    )
    AND (auth.uid() IS NULL OR p.id = auth.uid())
  LOOP
    v_trial_end := now() + interval '7 days';
    v_public_code := COALESCE(NULLIF(trim(v_rec.public_code), ''), public.generate_profile_public_code());

    IF v_rec.public_code IS NULL OR trim(v_rec.public_code) = '' THEN
      UPDATE public.profiles SET public_code = v_public_code WHERE id = v_rec.user_id;
    END IF;

    v_clinic_name := 'Consultório - ' || COALESCE(NULLIF(trim(v_rec.full_name), ''), 'Profissional');
    v_route_suffix := lower(regexp_replace(v_public_code, '^PLR-|-', '', 'g'));
    v_route_key := 'consultorio-' || v_route_suffix;

    IF EXISTS (SELECT 1 FROM public.clinics WHERE route_key = v_route_key) THEN
      v_route_key := v_route_key || '-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    END IF;

    INSERT INTO public.clinics (
      name,
      cnpj,
      route_key,
      subscription_plan,
      access_status,
      concurrent_access_limit,
      subaccount_limit,
      account_owner_user_id
    )
    VALUES (
      v_clinic_name,
      COALESCE(NULLIF(regexp_replace(COALESCE(v_rec.cpf, ''), '\D', '', 'g'), ''), '00000000000'),
      v_route_key,
      'prof_basico'::public.subscription_plan,
      'active',
      1,
      1,
      v_rec.user_id
    )
    RETURNING id INTO v_clinic_id;

    INSERT INTO public.clinic_subscriptions (
      clinic_id,
      account_owner_user_id,
      plan_type,
      billing_cycle,
      payment_method,
      base_monthly_price,
      base_concurrent_access_count,
      total_recurring_monthly_price,
      base_subaccount_limit,
      status,
      is_free_trial,
      is_read_only,
      trial_ends_at,
      trial_max_attendances,
      trial_max_patients,
      trial_max_custom_forms,
      period_duration_days,
      current_period_start,
      current_period_end,
      expires_at
    )
    VALUES (
      v_clinic_id,
      v_rec.user_id,
      'prof_basico'::public.subscription_plan,
      'ANNUAL',
      'TRIAL',
      39.99,
      1,
      0,
      1,
      'TRIAL',
      true,
      false,
      v_trial_end,
      20,
      5,
      1,
      7,
      now(),
      v_trial_end,
      v_trial_end
    )
    ON CONFLICT (clinic_id) DO NOTHING;

    INSERT INTO public.clinic_memberships (
      clinic_id,
      user_id,
      account_role,
      operational_role,
      role_key,
      membership_status,
      is_active
    )
    VALUES (
      v_clinic_id,
      v_rec.user_id,
      'account_owner',
      'owner',
      'owner',
      'active',
      true
    )
    ON CONFLICT (clinic_id, user_id) DO UPDATE
    SET
      account_role = 'account_owner',
      operational_role = 'owner',
      role_key = 'owner',
      membership_status = 'active',
      is_active = true,
      updated_at = now();

    -- CRITICAL: Do NOT overwrite active clinic context if the user already has one (e.g. a third-party clinic)!
    INSERT INTO public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
    VALUES (v_rec.user_id, v_clinic_id, now())
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.profiles
    SET clinic_id = COALESCE(clinic_id, v_clinic_id)
    WHERE id = v_rec.user_id;

    v_provisioned_count := v_provisioned_count + 1;
  END LOOP;

  RETURN v_provisioned_count;
END;
$function$;


-- =============================================================================
-- 5. FIX list_current_user_clinics & manage_clinic_subscription_plan
-- =============================================================================

CREATE OR REPLACE FUNCTION public.list_current_user_clinics()
RETURNS TABLE(
  membership_id uuid,
  clinic_id uuid,
  clinic_route_key text,
  clinic_name text,
  clinic_logo_url text,
  clinic_subscription_plan public.subscription_plan,
  clinic_subaccount_limit integer,
  clinic_concurrent_access_limit integer,
  clinic_active_access_count integer,
  clinic_active_access_users jsonb,
  clinic_account_owner_user_id uuid,
  account_role public.account_role_type,
  operational_role public.operational_role_type,
  role_key text,
  membership_status public.membership_status_type,
  is_active boolean,
  joined_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    clinic_memberships.id AS membership_id,
    clinics.id AS clinic_id,
    clinics.route_key AS clinic_route_key,
    clinics.name AS clinic_name,
    clinics.logo_url AS clinic_logo_url,
    clinics.subscription_plan AS clinic_subscription_plan,
    CASE
      WHEN clinics.subscription_plan::text IN ('clinica_basico', 'clinica_medio', 'clinica_top', 'clinic', 'enterprise') THEN 999999
      WHEN clinics.subscription_plan::text = 'prof_top' THEN GREATEST(COALESCE(clinics.subaccount_limit, 2), 2)
      ELSE GREATEST(COALESCE(clinics.subaccount_limit, 1), 1)
    END::integer AS clinic_subaccount_limit,
    CASE
      WHEN clinics.subscription_plan::text IN ('clinica_top', 'enterprise') THEN GREATEST(COALESCE(clinics.concurrent_access_limit, 8), 8)
      WHEN clinics.subscription_plan::text IN ('clinica_medio', 'clinic') THEN GREATEST(COALESCE(clinics.concurrent_access_limit, 4), 4)
      WHEN clinics.subscription_plan::text IN ('clinica_basico', 'prof_top') THEN GREATEST(COALESCE(clinics.concurrent_access_limit, 2), 2)
      ELSE GREATEST(COALESCE(clinics.concurrent_access_limit, 1), 1)
    END::integer AS clinic_concurrent_access_limit,
    COALESCE(active_accesses.active_access_count, 0)::integer AS clinic_active_access_count,
    COALESCE(active_accesses.active_access_users, '[]'::jsonb) AS clinic_active_access_users,
    clinics.account_owner_user_id AS clinic_account_owner_user_id,
    clinic_memberships.account_role,
    clinic_memberships.operational_role,
    clinic_memberships.role_key,
    clinic_memberships.membership_status,
    clinic_memberships.is_active,
    clinic_memberships.joined_at
  FROM public.clinic_memberships
  JOIN public.clinics ON clinics.id = clinic_memberships.clinic_id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::integer AS active_access_count,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'user_id', active_sessions.user_id,
            'full_name', profiles.full_name,
            'email', profiles.email,
            'last_seen_at', active_sessions.last_seen_at,
            'device_label', active_sessions.device_label
          )
          ORDER BY active_sessions.last_seen_at DESC
        ) FILTER (WHERE active_sessions.id IS NOT NULL),
        '[]'::jsonb
      ) AS active_access_users
    FROM public.user_security_sessions active_sessions
    LEFT JOIN public.profiles ON profiles.id = active_sessions.user_id
    WHERE active_sessions.clinic_id = clinics.id
      AND active_sessions.ended_at IS NULL
      AND active_sessions.force_signed_out_at IS NULL
      AND active_sessions.last_seen_at >= now() - INTERVAL '15 minutes'
  ) active_accesses ON true
  WHERE clinic_memberships.user_id = (SELECT auth.uid())
    AND clinic_memberships.is_active = true
    AND clinic_memberships.membership_status = 'active'::public.membership_status_type
    AND COALESCE(clinics.access_status, 'active') IN ('active', 'payment_pending', 'trialing')
  ORDER BY clinic_memberships.joined_at ASC;
$function$;

CREATE OR REPLACE FUNCTION public.manage_clinic_subscription_plan(
  _clinic_id uuid,
  _new_plan public.subscription_plan,
  _billing_cycle text DEFAULT 'annual'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_current_user_id uuid := auth.uid();
  v_owner_user_id uuid;
  v_is_platform_admin boolean := false;
  v_active_subaccounts_count integer := 0;
  v_sub_record public.clinic_subscriptions%ROWTYPE;
  v_plan_str text := LOWER(_new_plan::text);
  v_billing_cycle text := LOWER(COALESCE(_billing_cycle, 'annual'));
  v_base_monthly_price bigint := 0;
  v_base_subaccount_limit integer := 1;
  v_base_concurrent_access integer := 1;
  v_additional_seat_price bigint := 2990;
BEGIN
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT is_active INTO v_is_platform_admin
  FROM public.platform_admins
  WHERE user_id = v_current_user_id;

  SELECT user_id INTO v_owner_user_id
  FROM public.clinic_memberships
  WHERE clinic_id = _clinic_id
    AND (
      COALESCE(account_role::text, '') IN ('account_owner', 'owner')
      OR COALESCE(operational_role::text, '') = 'owner'
    )
    AND is_active = true
  LIMIT 1;

  IF v_owner_user_id IS NULL THEN
    SELECT account_owner_user_id INTO v_owner_user_id
    FROM public.clinics
    WHERE id = _clinic_id;
  END IF;

  IF NOT (COALESCE(v_is_platform_admin, false) = true OR public.is_platform_owner(v_current_user_id) OR v_owner_user_id = v_current_user_id) THEN
    RAISE EXCEPTION 'Apenas o proprietário da clínica ou um administrador da plataforma pode alterar o plano.';
  END IF;

  v_owner_user_id := COALESCE(v_owner_user_id, v_current_user_id);

  IF v_plan_str IN ('prof_basico', 'prof_medio', 'solo') THEN
    SELECT COUNT(*)::integer INTO v_active_subaccounts_count
    FROM public.clinic_memberships
    WHERE clinic_id = _clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND COALESCE(account_role::text, '') NOT IN ('account_owner', 'owner')
      AND COALESCE(operational_role::text, '') <> 'owner';

    IF v_active_subaccounts_count > 0 THEN
      RAISE EXCEPTION 'Não é possível alterar para plano individual enquanto houver % colaborador(es) ativo(s) cadastrado(s). Desative ou remova os colaboradores primeiro.', v_active_subaccounts_count;
    END IF;
  ELSIF v_plan_str = 'prof_top' THEN
    SELECT COUNT(*)::integer INTO v_active_subaccounts_count
    FROM public.clinic_memberships
    WHERE clinic_id = _clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND COALESCE(account_role::text, '') NOT IN ('account_owner', 'owner')
      AND COALESCE(operational_role::text, '') <> 'owner';

    IF v_active_subaccounts_count > 1 THEN
      RAISE EXCEPTION 'O plano Profissional Top permite no máximo 1 colaborador de apoio (total de 2 membros). Atualmente há % colaboradores ativos.', v_active_subaccounts_count;
    END IF;
  END IF;

  CASE v_plan_str
    WHEN 'prof_basico' THEN
      v_base_monthly_price := CASE WHEN v_billing_cycle = 'annual' THEN 3990 ELSE 4990 END;
      v_base_subaccount_limit := 1;
      v_base_concurrent_access := 1;
    WHEN 'prof_medio' THEN
      v_base_monthly_price := CASE WHEN v_billing_cycle = 'annual' THEN 5990 ELSE 7990 END;
      v_base_subaccount_limit := 1;
      v_base_concurrent_access := 1;
    WHEN 'prof_top' THEN
      v_base_monthly_price := CASE WHEN v_billing_cycle = 'annual' THEN 8990 ELSE 11990 END;
      v_base_subaccount_limit := 2;
      v_base_concurrent_access := 2;
    WHEN 'clinica_basico' THEN
      v_base_monthly_price := CASE WHEN v_billing_cycle = 'annual' THEN 14990 ELSE 18990 END;
      v_base_subaccount_limit := 999999;
      v_base_concurrent_access := 2;
    WHEN 'clinica_medio', 'clinica_intermediario', 'clinic' THEN
      v_base_monthly_price := CASE WHEN v_billing_cycle = 'annual' THEN 24990 ELSE 29990 END;
      v_base_subaccount_limit := 999999;
      v_base_concurrent_access := 4;
    WHEN 'clinica_top', 'clinica_avancado', 'enterprise' THEN
      v_base_monthly_price := CASE WHEN v_billing_cycle = 'annual' THEN 39990 ELSE 49990 END;
      v_base_subaccount_limit := 999999;
      v_base_concurrent_access := 8;
    WHEN 'solo' THEN
      v_base_monthly_price := 0;
      v_base_subaccount_limit := 1;
      v_base_concurrent_access := 1;
    ELSE
      v_base_monthly_price := CASE WHEN v_billing_cycle = 'annual' THEN 14990 ELSE 18990 END;
      v_base_subaccount_limit := 999999;
      v_base_concurrent_access := 2;
  END CASE;

  UPDATE public.clinics
  SET
    subscription_plan = _new_plan,
    subaccount_limit = v_base_subaccount_limit,
    concurrent_access_limit = v_base_concurrent_access,
    access_status = COALESCE(NULLIF(btrim(access_status), ''), 'active'),
    updated_at = now()
  WHERE id = _clinic_id;

  INSERT INTO public.clinic_subscriptions (
    clinic_id,
    account_owner_user_id,
    plan_type,
    billing_cycle,
    status,
    base_monthly_price,
    base_subaccount_limit,
    base_concurrent_access_count,
    additional_concurrent_access_count,
    additional_concurrent_access_price,
    total_recurring_monthly_price,
    is_free_trial,
    is_read_only,
    expires_at,
    updated_at
  )
  VALUES (
    _clinic_id,
    v_owner_user_id,
    _new_plan,
    v_billing_cycle,
    'ACTIVE',
    v_base_monthly_price,
    v_base_subaccount_limit,
    v_base_concurrent_access,
    0,
    v_additional_seat_price,
    v_base_monthly_price,
    false,
    false,
    NULL,
    now()
  )
  ON CONFLICT (clinic_id) DO UPDATE
  SET
    account_owner_user_id = COALESCE(clinic_subscriptions.account_owner_user_id, EXCLUDED.account_owner_user_id),
    plan_type = EXCLUDED.plan_type,
    billing_cycle = EXCLUDED.billing_cycle,
    status = 'ACTIVE',
    is_free_trial = false,
    is_read_only = false,
    expires_at = NULL,
    base_monthly_price = EXCLUDED.base_monthly_price,
    base_subaccount_limit = EXCLUDED.base_subaccount_limit,
    base_concurrent_access_count = EXCLUDED.base_concurrent_access_count,
    additional_concurrent_access_count = CASE
      WHEN EXCLUDED.plan_type::text IN ('prof_basico', 'prof_medio', 'prof_top', 'solo') THEN 0
      ELSE clinic_subscriptions.additional_concurrent_access_count
    END,
    additional_concurrent_access_price = EXCLUDED.additional_concurrent_access_price,
    total_recurring_monthly_price = EXCLUDED.base_monthly_price + (
      CASE
        WHEN EXCLUDED.plan_type::text IN ('prof_basico', 'prof_medio', 'prof_top', 'solo') THEN 0
        ELSE clinic_subscriptions.additional_concurrent_access_count
      END * EXCLUDED.additional_concurrent_access_price
    ),
    updated_at = now()
  RETURNING * INTO v_sub_record;

  UPDATE public.clinics
  SET account_owner_user_id = COALESCE(account_owner_user_id, v_owner_user_id)
  WHERE id = _clinic_id;

  RETURN jsonb_build_object(
    'success', true,
    'clinic_id', _clinic_id,
    'plan_type', v_sub_record.plan_type,
    'billing_cycle', v_sub_record.billing_cycle,
    'base_subaccount_limit', v_sub_record.base_subaccount_limit,
    'base_concurrent_access_count', v_sub_record.base_concurrent_access_count,
    'additional_concurrent_access_count', v_sub_record.additional_concurrent_access_count,
    'total_recurring_monthly_price', v_sub_record.total_recurring_monthly_price
  );
END;
$function$;


-- =============================================================================
-- 6. INVITATION & ACCEPTANCE RPCS (Preserve exact signatures, fix slot math & roles)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.invite_clinic_collaborator(
  _clinic_id uuid DEFAULT NULL::uuid,
  _email text DEFAULT NULL::text,
  _operational_role public.operational_role_type DEFAULT 'professional'::public.operational_role_type,
  _job_title text DEFAULT NULL::text,
  _specialty text DEFAULT NULL::text,
  _role_key text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  _requester_id uuid := auth.uid();
  _resolved_clinic_id uuid;
  _normalized_email text := lower(trim(coalesce(_email, '')));
  _token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  _token_hash text := md5(_token);
  _sha256_hash text;
  _existing_user_id uuid;
  _invitation_id uuid;
  _normalized_role_key text := lower(trim(coalesce(_role_key, '')));
  _inferred_operational_role public.operational_role_type := COALESCE(_operational_role, 'professional'::public.operational_role_type);
  _custom_role record;
  _clinic_plan text;
  _subaccount_limit integer;
  _max_collaborator_slots integer;
  _active_subaccounts_count integer;
  _pending_invites_count integer;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  _resolved_clinic_id := COALESCE(_clinic_id, public.get_user_clinic_id(_requester_id));

  IF _resolved_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clínica não identificada.';
  END IF;

  IF NOT (public.current_user_can('subaccounts.write', _resolved_clinic_id) OR public.current_user_can('subaccounts.manage', _resolved_clinic_id)) THEN
    RAISE EXCEPTION 'Você não tem permissão para convidar colaboradores.';
  END IF;

  -- Lock clinic row to prevent race conditions
  PERFORM 1 FROM public.clinics WHERE id = _resolved_clinic_id FOR UPDATE;

  SELECT
    LOWER(COALESCE(subscription_plan::text, 'solo')),
    CASE
      WHEN subscription_plan::text IN ('clinica_basico', 'clinica_medio', 'clinica_top', 'clinic', 'enterprise') THEN 999999
      WHEN subscription_plan::text = 'prof_top' THEN GREATEST(COALESCE(subaccount_limit, 2), 2)
      ELSE COALESCE(subaccount_limit, 1)
    END
  INTO _clinic_plan, _subaccount_limit
  FROM public.clinics
  WHERE id = _resolved_clinic_id;

  -- Check 1: Single-user plans cannot invite collaborators
  IF _clinic_plan IN ('prof_basico', 'prof_medio', 'solo') THEN
    RAISE EXCEPTION 'Convites de colaboradores não estão disponíveis em planos individuais (monoposto). Faça upgrade para Profissional Top ou Plano Clínica.';
  END IF;

  -- Expire outdated pending invitations before counting slots
  UPDATE public.clinic_collaborator_invitations
  SET status = 'expired', updated_at = now()
  WHERE clinic_id = _resolved_clinic_id
    AND status = 'pending'
    AND expires_at <= now();

  -- Check 2: Collaborator slot limit (excluding the clinic owner)
  IF _subaccount_limit < 999999 THEN
    SELECT COUNT(*)::integer INTO _active_subaccounts_count
    FROM public.clinic_memberships
    WHERE clinic_id = _resolved_clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND COALESCE(account_role::text, '') NOT IN ('account_owner', 'owner')
      AND COALESCE(operational_role::text, '') <> 'owner';

    SELECT COUNT(*)::integer INTO _pending_invites_count
    FROM public.clinic_collaborator_invitations
    WHERE clinic_id = _resolved_clinic_id
      AND status = 'pending'
      AND expires_at > now()
      AND lower(email) <> _normalized_email;

    _max_collaborator_slots := CASE
      WHEN _clinic_plan = 'prof_top' THEN GREATEST(1, _subaccount_limit - 1)
      ELSE GREATEST(1, _subaccount_limit - 1)
    END;

    IF (_active_subaccounts_count + _pending_invites_count) >= _max_collaborator_slots THEN
      IF _clinic_plan = 'prof_top' THEN
        RAISE EXCEPTION 'O plano Profissional Top permite no máximo 1 colaborador de apoio (total de 2 membros). Limite atingido.';
      ELSE
        RAISE EXCEPTION 'O limite de membros da clínica foi atingido para o plano atual.';
      END IF;
    END IF;
  END IF;

  IF _normalized_email = '' OR _normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Informe um e-mail válido para o convite.';
  END IF;

  -- Normalize common Portuguese aliases for standard roles
  IF _normalized_role_key IN ('assistente', 'recepcionista', 'secretaria', 'secretária') THEN
    _normalized_role_key := 'assistant';
  ELSIF _normalized_role_key IN ('profissional', 'fisioterapeuta', 'terapeuta') THEN
    _normalized_role_key := 'professional';
  ELSIF _normalized_role_key IN ('administrador', 'administradora', 'gestor', 'gestora') THEN
    _normalized_role_key := 'admin';
  ELSIF _normalized_role_key IN ('estagiário', 'estagiaria', 'estagiária', 'intern') THEN
    _normalized_role_key := 'estagiario';
  END IF;

  IF _operational_role = 'owner' OR _normalized_role_key = 'owner' THEN
    RAISE EXCEPTION 'O papel owner não pode ser atribuído por convite operacional.';
  END IF;

  -- Ensure default roles exist for this clinic
  INSERT INTO public.clinic_operational_roles (
    clinic_id, role_key, label, description, base_operational_role, sort_order, is_system
  )
  VALUES
    (_resolved_clinic_id, 'owner', 'Proprietário(a)', 'Titular da conta com controle total da clínica.', 'owner', 10, true),
    (_resolved_clinic_id, 'professional', 'Profissional', 'Realiza atendimentos, gerencia prontuários e sua própria agenda.', 'professional', 20, true),
    (_resolved_clinic_id, 'admin', 'Administrador(a)', 'Gerencia equipe, agenda geral, pacientes e configurações da clínica.', 'admin', 30, true),
    (_resolved_clinic_id, 'assistant', 'Assistente', 'Apoia na recepção, cadastro de pacientes e gestão de agendamentos.', 'assistant', 40, true),
    (_resolved_clinic_id, 'estagiario', 'Estagiário(a)', 'Realiza atendimentos e evoluções clínicas sob supervisão.', 'estagiario', 50, true)
  ON CONFLICT (clinic_id, role_key) DO NOTHING;

  -- Resolve role_key and infer operational_role
  IF _normalized_role_key IS NOT NULL AND _normalized_role_key <> '' THEN
    IF _normalized_role_key IN ('admin', 'professional', 'assistant', 'estagiario') THEN
      _inferred_operational_role := _normalized_role_key::public.operational_role_type;
    ELSE
      SELECT *
      INTO _custom_role
      FROM public.clinic_operational_roles
      WHERE clinic_id = _resolved_clinic_id
        AND (LOWER(role_key) = _normalized_role_key OR LOWER(label) = _normalized_role_key)
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Papel operacional inválido para esta clínica.';
      END IF;

      _normalized_role_key := _custom_role.role_key;
      _inferred_operational_role := _custom_role.base_operational_role;
    END IF;
  ELSE
    _normalized_role_key := _inferred_operational_role::text;
  END IF;

  SELECT users.id
  INTO _existing_user_id
  FROM auth.users
  WHERE lower(users.email) = _normalized_email
  LIMIT 1;

  _sha256_hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  SELECT id INTO _invitation_id
  FROM public.clinic_collaborator_invitations
  WHERE clinic_id = _resolved_clinic_id
    AND lower(email) = _normalized_email
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF _invitation_id IS NOT NULL THEN
    UPDATE public.clinic_collaborator_invitations
    SET
      operational_role = _inferred_operational_role,
      role_key = NULLIF(_normalized_role_key, ''),
      job_title = NULLIF(trim(_job_title), ''),
      specialty = NULLIF(trim(_specialty), ''),
      invited_by = _requester_id,
      existing_user_id = _existing_user_id,
      token_hash = _token_hash,
      valid_token_hashes = ARRAY(
        SELECT u FROM (
          SELECT DISTINCT u
          FROM unnest(
            array_cat(
              COALESCE(valid_token_hashes, ARRAY[token_hash]),
              ARRAY[_token_hash, _sha256_hash]
            )
          ) AS u
          WHERE u IS NOT NULL AND u <> ''
        ) sub
        ORDER BY 1 DESC
        LIMIT 10
      ),
      expires_at = now() + interval '14 days',
      updated_at = now(),
      email_delivery_status = 'pending',
      email_last_error = NULL,
      email_sent_at = NULL
    WHERE id = _invitation_id;
  ELSE
    INSERT INTO public.clinic_collaborator_invitations (
      clinic_id,
      email,
      operational_role,
      role_key,
      job_title,
      specialty,
      token_hash,
      valid_token_hashes,
      invited_by,
      existing_user_id,
      status,
      email_delivery_status,
      email_last_error,
      email_sent_at
    )
    VALUES (
      _resolved_clinic_id,
      _normalized_email,
      _inferred_operational_role,
      NULLIF(_normalized_role_key, ''),
      NULLIF(trim(_job_title), ''),
      NULLIF(trim(_specialty), ''),
      _token_hash,
      ARRAY[_token_hash, _sha256_hash],
      _requester_id,
      _existing_user_id,
      'pending',
      'pending',
      NULL,
      NULL
    )
    RETURNING id INTO _invitation_id;
  END IF;

  PERFORM public.log_security_event(
    _resolved_clinic_id,
    _requester_id,
    _existing_user_id,
    'clinic_collaborator_invited',
    'admin',
    jsonb_build_object(
      'invitation_id', _invitation_id,
      'email', _normalized_email,
      'operational_role', _inferred_operational_role,
      'role_key', NULLIF(_normalized_role_key, ''),
      'job_title', _job_title,
      'specialty', _specialty
    )
  );

  RETURN jsonb_build_object(
    'invitation_id', _invitation_id,
    'token', _token,
    'status', 'pending'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_clinic_collaborator_invitation(
  _token text,
  _full_name text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _newer_invitation public.clinic_collaborator_invitations%ROWTYPE;
  _profile_exists boolean;
  _clinic_plan text;
  _subaccount_limit integer;
  _active_collaborators_count integer;
  _token_clean text := trim(coalesce(_token, ''));
  _md5_hash text := md5(_token_clean);
  _sha256_hash text;
  _clinic_route_key text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para aceitar o convite.';
  END IF;

  IF _token_clean = '' THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  _user_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF _user_email IS NULL OR _user_email = '' THEN
    SELECT lower(email)
    INTO _user_email
    FROM auth.users
    WHERE id = _user_id;
  END IF;

  BEGIN
    _sha256_hash := encode(extensions.digest(_token_clean, 'sha256'), 'hex');
  EXCEPTION WHEN OTHERS THEN
    _sha256_hash := NULL;
  END;

  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE token_hash = _md5_hash
     OR (_sha256_hash IS NOT NULL AND token_hash = _sha256_hash)
     OR _md5_hash = ANY(valid_token_hashes)
     OR (_sha256_hash IS NOT NULL AND _sha256_hash = ANY(valid_token_hashes))
  ORDER BY CASE WHEN status = 'pending' THEN 0 WHEN status = 'accepted' THEN 1 ELSE 2 END, created_at DESC
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF _invitation.status = 'cancelled' THEN
    SELECT *
    INTO _newer_invitation
    FROM public.clinic_collaborator_invitations
    WHERE clinic_id = _invitation.clinic_id
      AND lower(email) = lower(_invitation.email)
      AND status = 'pending'
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF _newer_invitation.id IS NOT NULL THEN
      _invitation := _newer_invitation;
    END IF;
  END IF;

  IF _user_email IS DISTINCT FROM lower(_invitation.email) THEN
    RAISE EXCEPTION 'Entre com o e-mail convidado para aceitar este acesso.';
  END IF;

  SELECT route_key
  INTO _clinic_route_key
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  -- Idempotency if already accepted
  IF _invitation.status = 'accepted' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.user_security_settings (user_id, clinic_id)
    VALUES (_user_id, _invitation.clinic_id)
    ON CONFLICT (user_id) DO UPDATE
    SET clinic_id = COALESCE(public.user_security_settings.clinic_id, EXCLUDED.clinic_id);

    INSERT INTO public.clinic_memberships (
      clinic_id,
      user_id,
      account_role,
      operational_role,
      role_key,
      membership_status,
      is_active,
      invited_by
    )
    VALUES (
      _invitation.clinic_id,
      _user_id,
      NULL,
      _invitation.operational_role,
      COALESCE(_invitation.role_key, _invitation.operational_role::text),
      'active',
      true,
      _invitation.invited_by
    )
    ON CONFLICT (clinic_id, user_id)
    DO UPDATE SET
      operational_role = COALESCE(public.clinic_memberships.operational_role, EXCLUDED.operational_role),
      role_key = COALESCE(public.clinic_memberships.role_key, EXCLUDED.role_key),
      membership_status = 'active',
      is_active = true,
      ended_at = NULL;

    INSERT INTO public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
    VALUES (_user_id, _invitation.clinic_id, now())
    ON CONFLICT (user_id)
    DO UPDATE SET clinic_id = EXCLUDED.clinic_id, updated_at = now();

    RETURN jsonb_build_object(
      'clinic_id', _invitation.clinic_id,
      'clinic_route_key', _clinic_route_key,
      'status', 'accepted',
      'already_accepted', true
    );
  END IF;

  IF _invitation.expires_at < now() THEN
    UPDATE public.clinic_collaborator_invitations
    SET status = 'expired', updated_at = now()
    WHERE id = _invitation.id;
    RAISE EXCEPTION 'Este convite expirou.';
  END IF;

  IF _invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Este convite não está mais pendente.';
  END IF;

  -- Validate clinic plan & collaborator quota (counting only non-owner collaborators)
  SELECT
    LOWER(COALESCE(subscription_plan::text, 'solo')),
    CASE
      WHEN subscription_plan::text IN ('clinica_basico', 'clinica_medio', 'clinica_top', 'clinic', 'enterprise') THEN 999999
      WHEN subscription_plan::text = 'prof_top' THEN GREATEST(COALESCE(subaccount_limit, 2), 2)
      ELSE COALESCE(subaccount_limit, 1)
    END
  INTO _clinic_plan, _subaccount_limit
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  IF _clinic_plan IN ('prof_basico', 'prof_medio', 'solo') THEN
    RAISE EXCEPTION 'Esta clínica está atualmente em um plano monoposto (apenas o titular) e não aceita novos colaboradores.';
  END IF;

  IF _subaccount_limit < 999999 THEN
    SELECT COUNT(*)::integer INTO _active_collaborators_count
    FROM public.clinic_memberships
    WHERE clinic_id = _invitation.clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND user_id <> _user_id
      AND COALESCE(account_role::text, '') NOT IN ('account_owner', 'owner')
      AND COALESCE(operational_role::text, '') <> 'owner';

    IF _active_collaborators_count >= GREATEST(1, _subaccount_limit - 1) THEN
      RAISE EXCEPTION 'O limite de membros da clínica foi atingido para o plano atual.';
    END IF;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id)
  INTO _profile_exists;

  IF _profile_exists THEN
    UPDATE public.profiles
    SET
      clinic_id = COALESCE(clinic_id, _invitation.clinic_id),
      email = COALESCE(email, _invitation.email),
      full_name = COALESCE(NULLIF(trim(full_name), ''), NULLIF(trim(coalesce(_full_name, '')), '')),
      job_title = COALESCE(NULLIF(trim(_invitation.job_title), ''), job_title),
      specialty = COALESCE(NULLIF(trim(_invitation.specialty), ''), specialty),
      public_code = COALESCE(NULLIF(trim(public_code), ''), public.generate_profile_public_code())
    WHERE id = _user_id;
  ELSE
    INSERT INTO public.profiles (
      id,
      clinic_id,
      email,
      full_name,
      job_title,
      specialty,
      public_code
    )
    VALUES (
      _user_id,
      _invitation.clinic_id,
      _invitation.email,
      NULLIF(trim(coalesce(_full_name, '')), ''),
      NULLIF(trim(_invitation.job_title), ''),
      NULLIF(trim(_invitation.specialty), ''),
      public.generate_profile_public_code()
    );
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_security_settings (user_id, clinic_id)
  VALUES (_user_id, _invitation.clinic_id)
  ON CONFLICT (user_id) DO UPDATE
  SET clinic_id = COALESCE(public.user_security_settings.clinic_id, EXCLUDED.clinic_id);

  INSERT INTO public.clinic_memberships (
    clinic_id,
    user_id,
    account_role,
    operational_role,
    role_key,
    membership_status,
    is_active,
    invited_by
  )
  VALUES (
    _invitation.clinic_id,
    _user_id,
    NULL,
    _invitation.operational_role,
    COALESCE(_invitation.role_key, _invitation.operational_role::text),
    'active',
    true,
    _invitation.invited_by
  )
  ON CONFLICT (clinic_id, user_id)
  DO UPDATE SET
    operational_role = CASE
      WHEN public.clinic_memberships.account_role = 'account_owner' THEN 'owner'::public.operational_role_type
      ELSE EXCLUDED.operational_role
    END,
    role_key = CASE
      WHEN public.clinic_memberships.account_role = 'account_owner' THEN 'owner'
      ELSE EXCLUDED.role_key
    END,
    membership_status = 'active',
    is_active = true,
    ended_at = NULL,
    invited_by = COALESCE(public.clinic_memberships.invited_by, EXCLUDED.invited_by);

  INSERT INTO public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
  VALUES (_user_id, _invitation.clinic_id, now())
  ON CONFLICT (user_id)
  DO UPDATE SET clinic_id = EXCLUDED.clinic_id, updated_at = now();

  UPDATE public.clinic_collaborator_invitations
  SET
    status = 'accepted',
    accepted_by = _user_id,
    accepted_at = now(),
    updated_at = now()
  WHERE id = _invitation.id;

  RETURN jsonb_build_object(
    'clinic_id', _invitation.clinic_id,
    'clinic_route_key', _clinic_route_key,
    'status', 'accepted'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_current_user_clinic_invitation(_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _newer_invitation public.clinic_collaborator_invitations%ROWTYPE;
  _profile_exists boolean;
  _clinic_plan text;
  _subaccount_limit integer;
  _active_collaborators_count integer;
  _clinic_route_key text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para aceitar o convite.';
  END IF;

  _user_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF _user_email IS NULL OR _user_email = '' THEN
    SELECT lower(email)
    INTO _user_email
    FROM auth.users
    WHERE id = _user_id;
  END IF;

  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE id = _invitation_id
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF _invitation.status = 'cancelled' THEN
    SELECT *
    INTO _newer_invitation
    FROM public.clinic_collaborator_invitations
    WHERE clinic_id = _invitation.clinic_id
      AND lower(email) = lower(_invitation.email)
      AND status = 'pending'
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF _newer_invitation.id IS NOT NULL THEN
      _invitation := _newer_invitation;
    END IF;
  END IF;

  IF lower(_invitation.email) IS DISTINCT FROM _user_email THEN
    RAISE EXCEPTION 'Este convite pertence a outro e-mail.';
  END IF;

  SELECT route_key
  INTO _clinic_route_key
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  -- Idempotency if already accepted
  IF _invitation.status = 'accepted' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.user_security_settings (user_id, clinic_id)
    VALUES (_user_id, _invitation.clinic_id)
    ON CONFLICT (user_id) DO UPDATE
    SET clinic_id = COALESCE(public.user_security_settings.clinic_id, EXCLUDED.clinic_id);

    INSERT INTO public.clinic_memberships (
      clinic_id,
      user_id,
      account_role,
      operational_role,
      role_key,
      membership_status,
      is_active,
      invited_by
    )
    VALUES (
      _invitation.clinic_id,
      _user_id,
      NULL,
      _invitation.operational_role,
      COALESCE(_invitation.role_key, _invitation.operational_role::text),
      'active',
      true,
      _invitation.invited_by
    )
    ON CONFLICT (clinic_id, user_id)
    DO UPDATE SET
      operational_role = COALESCE(public.clinic_memberships.operational_role, EXCLUDED.operational_role),
      role_key = COALESCE(public.clinic_memberships.role_key, EXCLUDED.role_key),
      membership_status = 'active',
      is_active = true,
      ended_at = NULL;

    INSERT INTO public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
    VALUES (_user_id, _invitation.clinic_id, now())
    ON CONFLICT (user_id)
    DO UPDATE SET clinic_id = EXCLUDED.clinic_id, updated_at = now();

    RETURN jsonb_build_object(
      'clinic_id', _invitation.clinic_id,
      'clinic_route_key', _clinic_route_key,
      'status', 'accepted',
      'already_accepted', true
    );
  END IF;

  IF _invitation.expires_at < now() THEN
    UPDATE public.clinic_collaborator_invitations
    SET status = 'expired', updated_at = now()
    WHERE id = _invitation.id;
    RAISE EXCEPTION 'Este convite expirou.';
  END IF;

  IF _invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Este convite não está mais pendente.';
  END IF;

  SELECT
    LOWER(COALESCE(subscription_plan::text, 'solo')),
    CASE
      WHEN subscription_plan::text IN ('clinica_basico', 'clinica_medio', 'clinica_top', 'clinic', 'enterprise') THEN 999999
      WHEN subscription_plan::text = 'prof_top' THEN GREATEST(COALESCE(subaccount_limit, 2), 2)
      ELSE COALESCE(subaccount_limit, 1)
    END
  INTO _clinic_plan, _subaccount_limit
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  IF _clinic_plan IN ('prof_basico', 'prof_medio', 'solo') THEN
    RAISE EXCEPTION 'Esta clínica está atualmente em um plano monoposto (apenas o titular) e não aceita novos colaboradores.';
  END IF;

  IF _subaccount_limit < 999999 THEN
    SELECT COUNT(*)::integer INTO _active_collaborators_count
    FROM public.clinic_memberships
    WHERE clinic_id = _invitation.clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND user_id <> _user_id
      AND COALESCE(account_role::text, '') NOT IN ('account_owner', 'owner')
      AND COALESCE(operational_role::text, '') <> 'owner';

    IF _active_collaborators_count >= GREATEST(1, _subaccount_limit - 1) THEN
      RAISE EXCEPTION 'O limite de membros da clínica foi atingido para o plano atual.';
    END IF;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id)
  INTO _profile_exists;

  IF _profile_exists THEN
    UPDATE public.profiles
    SET
      clinic_id = COALESCE(clinic_id, _invitation.clinic_id),
      email = COALESCE(email, _invitation.email),
      job_title = COALESCE(NULLIF(trim(_invitation.job_title), ''), job_title),
      specialty = COALESCE(NULLIF(trim(_invitation.specialty), ''), specialty),
      public_code = COALESCE(NULLIF(trim(public_code), ''), public.generate_profile_public_code())
    WHERE id = _user_id;
  ELSE
    INSERT INTO public.profiles (
      id,
      clinic_id,
      email,
      job_title,
      specialty,
      public_code
    )
    VALUES (
      _user_id,
      _invitation.clinic_id,
      _invitation.email,
      NULLIF(trim(_invitation.job_title), ''),
      NULLIF(trim(_invitation.specialty), ''),
      public.generate_profile_public_code()
    );
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_security_settings (user_id, clinic_id)
  VALUES (_user_id, _invitation.clinic_id)
  ON CONFLICT (user_id) DO UPDATE
  SET clinic_id = COALESCE(public.user_security_settings.clinic_id, EXCLUDED.clinic_id);

  INSERT INTO public.clinic_memberships (
    clinic_id,
    user_id,
    account_role,
    operational_role,
    role_key,
    membership_status,
    is_active,
    invited_by
  )
  VALUES (
    _invitation.clinic_id,
    _user_id,
    NULL,
    _invitation.operational_role,
    COALESCE(_invitation.role_key, _invitation.operational_role::text),
    'active',
    true,
    _invitation.invited_by
  )
  ON CONFLICT (clinic_id, user_id)
  DO UPDATE SET
    operational_role = CASE
      WHEN public.clinic_memberships.account_role = 'account_owner' THEN 'owner'::public.operational_role_type
      ELSE EXCLUDED.operational_role
    END,
    role_key = CASE
      WHEN public.clinic_memberships.account_role = 'account_owner' THEN 'owner'
      ELSE EXCLUDED.role_key
    END,
    membership_status = 'active',
    is_active = true,
    ended_at = NULL,
    invited_by = COALESCE(public.clinic_memberships.invited_by, EXCLUDED.invited_by);

  INSERT INTO public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
  VALUES (_user_id, _invitation.clinic_id, now())
  ON CONFLICT (user_id)
  DO UPDATE SET clinic_id = EXCLUDED.clinic_id, updated_at = now();

  UPDATE public.clinic_collaborator_invitations
  SET
    status = 'accepted',
    accepted_by = _user_id,
    accepted_at = now(),
    updated_at = now()
  WHERE id = _invitation.id;

  RETURN jsonb_build_object(
    'clinic_id', _invitation.clinic_id,
    'clinic_route_key', _clinic_route_key,
    'status', 'accepted'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_accept_pending_clinic_invitation_for_current_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _profile_exists boolean;
  _clinic_plan text;
  _subaccount_limit integer;
  _active_collaborators_count integer;
  _clinic_route_key text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'unauthenticated');
  END IF;

  _user_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF _user_email IS NULL OR _user_email = '' THEN
    SELECT lower(email)
    INTO _user_email
    FROM auth.users
    WHERE id = _user_id;
  END IF;

  IF _user_email IS NULL OR _user_email = '' THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'email_not_found');
  END IF;

  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE lower(email) = _user_email
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'no_pending_invitation');
  END IF;

  SELECT route_key
  INTO _clinic_route_key
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  SELECT
    LOWER(COALESCE(subscription_plan::text, 'solo')),
    CASE
      WHEN subscription_plan::text IN ('clinica_basico', 'clinica_medio', 'clinica_top', 'clinic', 'enterprise') THEN 999999
      WHEN subscription_plan::text = 'prof_top' THEN GREATEST(COALESCE(subaccount_limit, 2), 2)
      ELSE COALESCE(subaccount_limit, 1)
    END
  INTO _clinic_plan, _subaccount_limit
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  IF _clinic_plan IN ('prof_basico', 'prof_medio', 'solo') THEN
    RETURN jsonb_build_object(
      'accepted', false,
      'reason', 'plan_monoposto_not_allowed',
      'clinic_id', _invitation.clinic_id,
      'clinic_route_key', _clinic_route_key
    );
  END IF;

  IF _subaccount_limit < 999999 THEN
    SELECT COUNT(*)::integer INTO _active_collaborators_count
    FROM public.clinic_memberships
    WHERE clinic_id = _invitation.clinic_id
      AND is_active = true
      AND membership_status = 'active'
      AND user_id <> _user_id
      AND COALESCE(account_role::text, '') NOT IN ('account_owner', 'owner')
      AND COALESCE(operational_role::text, '') <> 'owner';

    IF _active_collaborators_count >= GREATEST(1, _subaccount_limit - 1) THEN
      RETURN jsonb_build_object(
        'accepted', false,
        'reason', 'clinic_subaccount_limit_reached',
        'clinic_id', _invitation.clinic_id,
        'clinic_route_key', _clinic_route_key
      );
    END IF;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id)
  INTO _profile_exists;

  IF _profile_exists THEN
    UPDATE public.profiles
    SET
      clinic_id = COALESCE(clinic_id, _invitation.clinic_id),
      email = COALESCE(email, _invitation.email),
      job_title = COALESCE(NULLIF(trim(_invitation.job_title), ''), job_title),
      specialty = COALESCE(NULLIF(trim(_invitation.specialty), ''), specialty),
      public_code = COALESCE(NULLIF(trim(public_code), ''), public.generate_profile_public_code())
    WHERE id = _user_id;
  ELSE
    INSERT INTO public.profiles (
      id,
      clinic_id,
      email,
      job_title,
      specialty,
      public_code
    )
    VALUES (
      _user_id,
      _invitation.clinic_id,
      _invitation.email,
      NULLIF(trim(_invitation.job_title), ''),
      NULLIF(trim(_invitation.specialty), ''),
      public.generate_profile_public_code()
    );
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_security_settings (user_id, clinic_id)
  VALUES (_user_id, _invitation.clinic_id)
  ON CONFLICT (user_id) DO UPDATE
  SET clinic_id = COALESCE(public.user_security_settings.clinic_id, EXCLUDED.clinic_id);

  INSERT INTO public.clinic_memberships (
    clinic_id,
    user_id,
    account_role,
    operational_role,
    role_key,
    membership_status,
    is_active,
    invited_by
  )
  VALUES (
    _invitation.clinic_id,
    _user_id,
    NULL,
    _invitation.operational_role,
    COALESCE(_invitation.role_key, _invitation.operational_role::text),
    'active',
    true,
    _invitation.invited_by
  )
  ON CONFLICT (clinic_id, user_id)
  DO UPDATE SET
    operational_role = CASE
      WHEN public.clinic_memberships.account_role = 'account_owner' THEN 'owner'::public.operational_role_type
      ELSE EXCLUDED.operational_role
    END,
    role_key = CASE
      WHEN public.clinic_memberships.account_role = 'account_owner' THEN 'owner'
      ELSE EXCLUDED.role_key
    END,
    membership_status = 'active',
    is_active = true,
    ended_at = NULL,
    invited_by = COALESCE(public.clinic_memberships.invited_by, EXCLUDED.invited_by);

  INSERT INTO public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
  VALUES (_user_id, _invitation.clinic_id, now())
  ON CONFLICT (user_id)
  DO UPDATE SET clinic_id = EXCLUDED.clinic_id, updated_at = now();

  UPDATE public.clinic_collaborator_invitations
  SET
    status = 'accepted',
    accepted_by = _user_id,
    accepted_at = now(),
    updated_at = now()
  WHERE id = _invitation.id;

  RETURN jsonb_build_object(
    'accepted', true,
    'clinic_id', _invitation.clinic_id,
    'clinic_route_key', _clinic_route_key,
    'invitation_id', _invitation.id,
    'status', 'accepted'
  );
END;
$function$;


-- =============================================================================
-- 7. CONCURRENT ACCESS OVERVIEW RPC (Used by Team Settings Tab)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_clinic_concurrent_access_overview(_clinic_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_cid uuid := COALESCE(_clinic_id, public.get_user_clinic_id(v_uid));
  v_active_sessions integer := 0;
BEGIN
  IF v_uid IS NULL OR v_cid IS NULL THEN
    RETURN jsonb_build_object('active_sessions', 0);
  END IF;

  IF NOT public.user_has_active_clinic_membership(v_uid, v_cid) AND NOT public.is_platform_owner(v_uid) THEN
    RETURN jsonb_build_object('active_sessions', 0);
  END IF;

  SELECT COUNT(DISTINCT uss.user_id)
  INTO v_active_sessions
  FROM public.user_security_sessions uss
  WHERE uss.clinic_id = v_cid
    AND uss.ended_at IS NULL
    AND uss.force_signed_out_at IS NULL
    AND uss.last_seen_at >= (now() - interval '15 minutes');

  RETURN jsonb_build_object(
    'active_sessions', GREATEST(1, COALESCE(v_active_sessions, 1))
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_clinic_concurrent_access_overview(uuid) TO authenticated;


-- =============================================================================
-- 8. RLS POLICY FIXES FOR MULTI-CLINIC COLLABORATOR ACCESS
-- =============================================================================

-- 8.1 public.clinics: allow reading any clinic where user has active membership or is owner
DROP POLICY IF EXISTS "Users read own clinic" ON public.clinics;
CREATE POLICY "Users read own clinic"
  ON public.clinics
  FOR SELECT
  TO authenticated
  USING (
    id = public.get_user_clinic_id(auth.uid())
    OR public.user_has_active_clinic_membership(auth.uid(), id)
    OR account_owner_user_id = auth.uid()
  );

-- 8.2 public.clinic_memberships: allow reading own memberships across all clinics and co-members of accessible clinics
DROP POLICY IF EXISTS "Users read clinic memberships" ON public.clinic_memberships;
CREATE POLICY "Users read clinic memberships"
  ON public.clinic_memberships
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR clinic_id = public.get_user_clinic_id(auth.uid())
    OR public.user_has_active_clinic_membership(auth.uid(), clinic_id)
  );

-- 8.3 public.clinic_memberships INSERT policy: support all multi-user plans
DROP POLICY IF EXISTS "Managers insert clinic memberships" ON public.clinic_memberships;
CREATE POLICY "Managers insert clinic memberships"
  ON public.clinic_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      public.current_user_can('subaccounts.write'::text, clinic_id)
      OR public.current_user_can('subaccounts.manage'::text, clinic_id)
    )
    AND EXISTS (
      SELECT 1
      FROM public.clinics
      WHERE clinics.id = clinic_memberships.clinic_id
        AND clinics.subscription_plan::text IN ('clinic', 'enterprise', 'clinica_basico', 'clinica_medio', 'clinica_top', 'prof_top')
    )
  );

-- 8.4 public.clinic_subscriptions: allow any active member of the clinic to read subscription status
DROP POLICY IF EXISTS "Owners e gestores podem ver a assinatura" ON public.clinic_subscriptions;
CREATE POLICY "Owners e gestores podem ver a assinatura"
  ON public.clinic_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    clinic_id = public.get_user_clinic_id(auth.uid())
    OR public.user_has_active_clinic_membership(auth.uid(), clinic_id)
    OR public.current_user_can('subscription_billing.read'::text, clinic_id)
  );

-- 8.5 public.clinic_collaborator_invitations: allow subaccounts.read / write / manage
DROP POLICY IF EXISTS "Managers read clinic collaborator invitations" ON public.clinic_collaborator_invitations;
CREATE POLICY "Managers read clinic collaborator invitations"
  ON public.clinic_collaborator_invitations
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_can('subaccounts.read'::text, clinic_id)
    OR public.current_user_can('subaccounts.write'::text, clinic_id)
    OR public.current_user_can('subaccounts.manage'::text, clinic_id)
  );

COMMIT;
