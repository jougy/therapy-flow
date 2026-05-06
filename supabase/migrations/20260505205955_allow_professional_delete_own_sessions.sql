DROP POLICY IF EXISTS "Users delete clinic draft sessions" ON public.sessions;
CREATE POLICY "Users delete clinic draft sessions" ON public.sessions
FOR DELETE TO authenticated
USING (
  clinic_id = public.get_user_clinic_id((SELECT auth.uid()))
  AND public.current_user_can('session.delete_draft', clinic_id)
  AND (
    public.current_user_is_clinic_manager(clinic_id)
    OR (
      user_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.clinic_memberships
        WHERE clinic_memberships.clinic_id = sessions.clinic_id
          AND clinic_memberships.user_id = (SELECT auth.uid())
          AND clinic_memberships.operational_role = 'professional'
          AND clinic_memberships.is_active = true
          AND clinic_memberships.membership_status = 'active'
      )
    )
  )
);
