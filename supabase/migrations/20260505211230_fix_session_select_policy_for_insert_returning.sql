DROP POLICY IF EXISTS "Users read clinic sessions" ON public.sessions;
CREATE POLICY "Users read clinic sessions" ON public.sessions
FOR SELECT TO authenticated
USING (
  clinic_id = public.get_user_clinic_id((SELECT auth.uid()))
  AND public.current_user_can('sessions.read', clinic_id)
  AND (
    public.current_user_is_clinic_manager(clinic_id)
    OR user_id = (SELECT auth.uid())
    OR provider_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.session_shares
      WHERE session_shares.session_id = sessions.id
        AND session_shares.clinic_id = sessions.clinic_id
        AND session_shares.shared_with_user_id = (SELECT auth.uid())
        AND session_shares.revoked_at IS NULL
    )
  )
);
