DROP POLICY IF EXISTS "Users read clinic profiles" ON public.profiles;
CREATE POLICY "Users read clinic profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.clinic_memberships AS requester_membership
    JOIN public.clinic_memberships AS target_membership
      ON target_membership.clinic_id = requester_membership.clinic_id
    WHERE requester_membership.user_id = auth.uid()
      AND requester_membership.is_active = true
      AND requester_membership.membership_status = 'active'
      AND target_membership.user_id = public.profiles.id
      AND (
        target_membership.membership_status = 'active'
        OR public.current_user_can('subaccounts.manage', target_membership.clinic_id)
      )
  )
);
