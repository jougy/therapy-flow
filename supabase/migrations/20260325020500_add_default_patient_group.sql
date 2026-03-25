ALTER TABLE public.patient_groups
ADD COLUMN is_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX idx_patient_groups_default_per_patient
ON public.patient_groups(patient_id)
WHERE is_default;

INSERT INTO public.patient_groups (user_id, patient_id, clinic_id, name, color, status, is_default)
SELECT
  patients.user_id,
  patients.id,
  patients.clinic_id,
  'Grupo sem definição',
  'lavender',
  'em_andamento',
  true
FROM public.patients
WHERE NOT EXISTS (
  SELECT 1
  FROM public.patient_groups
  WHERE patient_groups.patient_id = patients.id
    AND patient_groups.is_default = true
);

CREATE OR REPLACE FUNCTION public.ensure_default_patient_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.patient_groups (
    user_id,
    patient_id,
    clinic_id,
    name,
    color,
    status,
    is_default
  )
  VALUES (
    NEW.user_id,
    NEW.id,
    NEW.clinic_id,
    'Grupo sem definição',
    'lavender',
    'em_andamento',
    true
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_default_group_for_patient ON public.patients;

CREATE TRIGGER create_default_group_for_patient
AFTER INSERT ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.ensure_default_patient_group();

CREATE OR REPLACE FUNCTION public.prevent_default_patient_group_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.is_default THEN
    RAISE EXCEPTION 'O grupo padrão do paciente não pode ser excluído.';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_default_group_delete ON public.patient_groups;

CREATE TRIGGER prevent_default_group_delete
BEFORE DELETE ON public.patient_groups
FOR EACH ROW
EXECUTE FUNCTION public.prevent_default_patient_group_delete();
