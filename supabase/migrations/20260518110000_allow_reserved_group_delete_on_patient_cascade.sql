CREATE OR REPLACE FUNCTION public.prevent_default_patient_group_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (OLD.is_default OR OLD.group_kind IN ('default', 'cancelados'))
    AND EXISTS (
      SELECT 1
      FROM public.patients
      WHERE id = OLD.patient_id
    ) THEN
    RAISE EXCEPTION 'Os grupos reservados do paciente não podem ser excluídos.';
  END IF;

  RETURN OLD;
END;
$$;
