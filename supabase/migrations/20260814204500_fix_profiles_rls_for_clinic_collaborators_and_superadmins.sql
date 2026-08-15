-- Migration: 20260814204500_fix_profiles_rls_for_clinic_collaborators_and_superadmins.sql
-- Description: Expand public.profiles SELECT RLS policy to allow super_admins, platform admins, clinic members, and direct clinic profiles to view team profiles.

DROP POLICY IF EXISTS "Users read clinic profiles" ON public.profiles;

CREATE POLICY "Users read clinic profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin')
  OR (clinic_id IS NOT NULL AND clinic_id = public.get_user_clinic_id(auth.uid()))
  OR EXISTS (
    SELECT 1
    FROM public.clinic_memberships AS requester_membership
    JOIN public.clinic_memberships AS target_membership
      ON target_membership.clinic_id = requester_membership.clinic_id
    WHERE requester_membership.user_id = auth.uid()
      AND requester_membership.is_active = true
      AND target_membership.user_id = public.profiles.id
  )
);
