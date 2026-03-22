CREATE POLICY "Authenticated users can view their own registration links"
ON public.patient_registration_links
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Authenticated users can insert registration links"
ON public.patient_registration_links
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Authenticated users can update their own registration links"
ON public.patient_registration_links
FOR UPDATE
TO authenticated
USING (created_by = auth.uid());