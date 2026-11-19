-- Incremental migration: add subproduct_key ("frente" / SaaS rail) to clinics and clinic_subscriptions
-- Expand & Contract: non-destructive, defaults to 'plurihealth' for full-platform compatibility.

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS subproduct_key text NOT NULL DEFAULT 'plurihealth';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clinics_subproduct_key_check'
  ) THEN
    ALTER TABLE public.clinics
      ADD CONSTRAINT clinics_subproduct_key_check
      CHECK (subproduct_key IN ('plurifisio', 'pluripsy', 'plurinutri', 'plurinatu', 'plurihealth'));
  END IF;
END $$;

ALTER TABLE public.clinic_subscriptions
  ADD COLUMN IF NOT EXISTS subproduct_key text NOT NULL DEFAULT 'plurihealth';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clinic_subscriptions_subproduct_key_check'
  ) THEN
    ALTER TABLE public.clinic_subscriptions
      ADD CONSTRAINT clinic_subscriptions_subproduct_key_check
      CHECK (subproduct_key IN ('plurifisio', 'pluripsy', 'plurinutri', 'plurinatu', 'plurihealth'));
  END IF;
END $$;

-- Update list_current_user_clinics to return clinic_subproduct_key
DROP FUNCTION IF EXISTS public.list_current_user_clinics();

CREATE OR REPLACE FUNCTION public.list_current_user_clinics()
RETURNS TABLE(
  membership_id uuid,
  clinic_id uuid,
  clinic_route_key text,
  clinic_name text,
  clinic_logo_url text,
  clinic_subscription_plan public.subscription_plan,
  clinic_subproduct_key text,
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
AS $$
  SELECT
    clinic_memberships.id AS membership_id,
    clinics.id AS clinic_id,
    clinics.route_key AS clinic_route_key,
    clinics.name AS clinic_name,
    clinics.logo_url AS clinic_logo_url,
    clinics.subscription_plan AS clinic_subscription_plan,
    COALESCE(clinics.subproduct_key, 'plurihealth')::text AS clinic_subproduct_key,
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
$$;

-- Dedicated RPC to set subproduct_key on clinic & subscription (no overload)
CREATE OR REPLACE FUNCTION public.set_clinic_subproduct_key(
  _clinic_id uuid,
  _subproduct_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_owner boolean := false;
BEGIN
  IF _subproduct_key NOT IN ('plurifisio', 'pluripsy', 'plurinutri', 'plurinatu', 'plurihealth') THEN
    RAISE EXCEPTION 'Frente de produto inválida: %', _subproduct_key;
  END IF;

  IF _uid IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.clinic_memberships cm
      WHERE cm.clinic_id = _clinic_id
        AND cm.user_id = _uid
        AND cm.is_active = true
        AND cm.operational_role = 'owner'
    ) OR public.is_platform_owner()
    INTO _is_owner;

    IF NOT _is_owner THEN
      RAISE EXCEPTION 'Apenas o proprietário da clínica pode alterar a frente do plano.';
    END IF;
  END IF;

  UPDATE public.clinics
  SET subproduct_key = _subproduct_key,
      updated_at = now()
  WHERE id = _clinic_id;

  UPDATE public.clinic_subscriptions
  SET subproduct_key = _subproduct_key,
      updated_at = now()
  WHERE clinic_id = _clinic_id;

  RETURN jsonb_build_object(
    'clinic_id', _clinic_id,
    'subproduct_key', _subproduct_key,
    'updated', true
  );
END;
$$;
