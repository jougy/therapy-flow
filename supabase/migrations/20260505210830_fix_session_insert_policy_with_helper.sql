CREATE OR REPLACE FUNCTION public.can_insert_session(_clinic_id uuid, _user_id uuid, _provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _clinic_id = public.get_user_clinic_id((SELECT auth.uid()))
    AND _user_id = (SELECT auth.uid())
    AND _provider_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.clinic_memberships
      WHERE clinic_memberships.clinic_id = _clinic_id
        AND clinic_memberships.user_id = (SELECT auth.uid())
        AND clinic_memberships.operational_role IN ('owner', 'admin', 'professional', 'estagiario')
        AND clinic_memberships.is_active = true
        AND clinic_memberships.membership_status = 'active'
    );
$$;

DROP POLICY IF EXISTS "Users insert clinic sessions" ON public.sessions;
CREATE POLICY "Users insert clinic sessions" ON public.sessions
FOR INSERT TO authenticated
WITH CHECK (
  public.can_insert_session(clinic_id, user_id, provider_id)
);

GRANT EXECUTE ON FUNCTION public.can_insert_session(uuid, uuid, uuid) TO authenticated;
