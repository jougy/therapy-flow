CREATE OR REPLACE FUNCTION public.prevent_default_patient_group_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.is_default
    AND EXISTS (
      SELECT 1
      FROM public.patients
      WHERE id = OLD.patient_id
    ) THEN
    RAISE EXCEPTION 'O grupo padrão do paciente não pode ser excluído.';
  END IF;

  RETURN OLD;
END;
$$;
