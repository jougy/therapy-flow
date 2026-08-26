-- Migration: 20260825160000_optimize_clinic_selector_and_sessions_performance.sql
-- Description: Create indexes on user_security_sessions and clinic_memberships, optimize list_current_user_clinics RPC and profiles RLS to eliminate massive load in production.

-- 1. Partial composite index for active security sessions by clinic
-- Accelerates the lateral subquery in list_current_user_clinics() from O(N_sessions) table scan to O(active_per_clinic) index lookup.
CREATE INDEX IF NOT EXISTS idx_user_security_sessions_active_clinic 
ON public.user_security_sessions (clinic_id, last_seen_at DESC) 
WHERE ended_at IS NULL AND force_signed_out_at IS NULL;

-- 2. Index for session cleanup and maintenance
CREATE INDEX IF NOT EXISTS idx_user_security_sessions_stale_cleanup 
ON public.user_security_sessions (user_id, ended_at, last_seen_at);

-- 3. Composite index for user clinic memberships
CREATE INDEX IF NOT EXISTS idx_clinic_memberships_user_active_joined 
ON public.clinic_memberships (user_id, is_active, membership_status, joined_at);

-- 4. Index for clinic access status check
CREATE INDEX IF NOT EXISTS idx_clinics_id_access_status 
ON public.clinics (id, access_status);

-- 5. Optimized list_current_user_clinics RPC with scalar subquery and filtered jsonb_agg
DROP FUNCTION IF EXISTS public.list_current_user_clinics();

CREATE OR REPLACE FUNCTION public.list_current_user_clinics()
RETURNS TABLE (
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
  membership_status public.membership_status_type,
  is_active boolean,
  joined_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    clinic_memberships.id AS membership_id,
    clinics.id AS clinic_id,
    clinics.route_key AS clinic_route_key,
    clinics.name AS clinic_name,
    clinics.logo_url AS clinic_logo_url,
    clinics.subscription_plan AS clinic_subscription_plan,
    COALESCE(clinics.subaccount_limit, CASE WHEN clinics.subscription_plan = 'clinic' THEN 30 ELSE 0 END)::integer AS clinic_subaccount_limit,
    COALESCE(clinics.concurrent_access_limit, CASE WHEN clinics.subscription_plan = 'clinic' THEN 2 ELSE 1 END)::integer AS clinic_concurrent_access_limit,
    COALESCE(active_accesses.active_access_count, 0)::integer AS clinic_active_access_count,
    COALESCE(active_accesses.active_access_users, '[]'::jsonb) AS clinic_active_access_users,
    clinics.account_owner_user_id AS clinic_account_owner_user_id,
    clinic_memberships.account_role,
    clinic_memberships.operational_role,
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
    AND clinic_memberships.membership_status = 'active'
    AND clinics.access_status IN ('active', 'payment_pending')
  ORDER BY clinic_memberships.joined_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_current_user_clinics() TO authenticated;

-- 6. Optimize profiles SELECT RLS policy with scalar subqueries for O(1) evaluation
DROP POLICY IF EXISTS "Users read clinic profiles" ON public.profiles;

CREATE POLICY "Users read clinic profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = (SELECT auth.uid())
  OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'))
  OR (clinic_id IS NOT NULL AND clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid()))))
  OR EXISTS (
    SELECT 1
    FROM public.clinic_memberships AS requester_membership
    JOIN public.clinic_memberships AS target_membership
      ON target_membership.clinic_id = requester_membership.clinic_id
    WHERE requester_membership.user_id = (SELECT auth.uid())
      AND requester_membership.is_active = true
      AND target_membership.user_id = public.profiles.id
  )
);
