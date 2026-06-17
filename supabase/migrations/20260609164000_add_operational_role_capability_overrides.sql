CREATE TABLE IF NOT EXISTS public.clinic_operational_role_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  operational_role public.operational_role_type NOT NULL,
  capability text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinic_operational_role_capabilities_unique UNIQUE (clinic_id, operational_role, capability),
  CONSTRAINT clinic_operational_role_capabilities_no_owner CHECK (operational_role <> 'owner'),
  CONSTRAINT clinic_operational_role_capabilities_known CHECK (
    capability IN (
      'clinic_profile.manage',
      'forms.manage',
      'subaccounts.manage',
      'subaccounts_roles.manage',
      'subscription_billing.manage',
      'treasury.manage',
      'agenda.delete_events',
      'subaccounts_analytics.read',
      'patients.read',
      'patients.write',
      'schedule.read',
      'schedule.write',
      'sessions.read',
      'sessions.write',
      'session.delete_draft'
    )
  )
);

ALTER TABLE public.clinic_operational_role_capabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role capabilities are readable by clinic members" ON public.clinic_operational_role_capabilities;
CREATE POLICY "role capabilities are readable by clinic members"
ON public.clinic_operational_role_capabilities
FOR SELECT
USING (public.user_has_active_clinic_membership(clinic_id, auth.uid()));

DROP POLICY IF EXISTS "role capabilities are manageable by role admins" ON public.clinic_operational_role_capabilities;
CREATE POLICY "role capabilities are manageable by role admins"
ON public.clinic_operational_role_capabilities
FOR ALL
USING (public.current_user_can('subaccounts_roles.manage', clinic_id))
WITH CHECK (public.current_user_can('subaccounts_roles.manage', clinic_id));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_clinic_operational_role_capabilities_updated_at ON public.clinic_operational_role_capabilities;
CREATE TRIGGER set_clinic_operational_role_capabilities_updated_at
BEFORE UPDATE ON public.clinic_operational_role_capabilities
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.current_user_can(_capability text, _clinic_id uuid DEFAULT NULL)
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
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  _resolved_clinic_id := COALESCE(_clinic_id, public.get_user_clinic_id(_user_id));

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

  IF _account_role = 'account_owner' THEN
    RETURN true;
  END IF;

  IF _capability = 'subscription_billing.manage' THEN
    RETURN false;
  END IF;

  SELECT enabled
  INTO _override_enabled
  FROM public.clinic_operational_role_capabilities
  WHERE clinic_id = _resolved_clinic_id
    AND operational_role = _operational_role
    AND capability = _capability;

  IF FOUND THEN
    RETURN _override_enabled;
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
    WHEN 'schedule.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'sessions.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'estagiario');
    WHEN 'sessions.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'estagiario');
    WHEN 'session.delete_draft' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    ELSE
      RETURN false;
  END CASE;
END;
$$;

REVOKE ALL ON TABLE public.clinic_operational_role_capabilities FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clinic_operational_role_capabilities TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can(text, uuid) TO authenticated;
