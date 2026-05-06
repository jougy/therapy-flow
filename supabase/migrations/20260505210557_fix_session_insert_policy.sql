DROP POLICY IF EXISTS "Users insert clinic sessions" ON public.sessions;
CREATE POLICY "Users insert clinic sessions" ON public.sessions
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.get_user_clinic_id((SELECT auth.uid()))
  AND user_id = (SELECT auth.uid())
  AND provider_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.clinic_memberships
    WHERE clinic_memberships.clinic_id = sessions.clinic_id
      AND clinic_memberships.user_id = (SELECT auth.uid())
      AND clinic_memberships.operational_role IN ('owner', 'admin', 'professional', 'estagiario')
      AND clinic_memberships.is_active = true
      AND clinic_memberships.membership_status = 'active'
  )
);
