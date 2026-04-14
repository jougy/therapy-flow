DROP POLICY IF EXISTS "Users delete clinic patients" ON public.patients;

CREATE POLICY "Users delete clinic patients" ON public.patients
FOR DELETE TO authenticated
USING (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('clinic_profile.manage', clinic_id)
);
