ALTER TABLE public.patient_groups
ADD COLUMN IF NOT EXISTS group_kind text NOT NULL DEFAULT 'custom';

ALTER TABLE public.patient_groups
DROP CONSTRAINT IF EXISTS patient_groups_group_kind_check;

ALTER TABLE public.patient_groups
ADD CONSTRAINT patient_groups_group_kind_check
CHECK (group_kind IN ('custom', 'default', 'cancelados'));

UPDATE public.patient_groups
SET group_kind = CASE
  WHEN is_default THEN 'default'
  ELSE 'custom'
END
WHERE group_kind IS DISTINCT FROM CASE
  WHEN is_default THEN 'default'
  ELSE 'custom'
END;

CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_groups_default_kind_per_patient
ON public.patient_groups(patient_id)
WHERE group_kind = 'default';

CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_groups_cancelados_kind_per_patient
ON public.patient_groups(patient_id)
WHERE group_kind = 'cancelados';

INSERT INTO public.patient_groups (
  user_id,
  patient_id,
  clinic_id,
  name,
  color,
  status,
  is_default,
  group_kind
)
SELECT
  patients.user_id,
  patients.id,
  patients.clinic_id,
  'Cancelados',
  'rose',
  'cancelado',
  false,
  'cancelados'
FROM public.patients
WHERE NOT EXISTS (
  SELECT 1
  FROM public.patient_groups
  WHERE patient_groups.patient_id = patients.id
    AND patient_groups.group_kind = 'cancelados'
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
    is_default,
    group_kind
  )
  VALUES (
    NEW.user_id,
    NEW.id,
    NEW.clinic_id,
    'Grupo sem definição',
    'gray',
    NULL,
    true,
    'default'
  );

  INSERT INTO public.patient_groups (
    user_id,
    patient_id,
    clinic_id,
    name,
    color,
    status,
    is_default,
    group_kind
  )
  VALUES (
    NEW.user_id,
    NEW.id,
    NEW.clinic_id,
    'Cancelados',
    'rose',
    'cancelado',
    false,
    'cancelados'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_default_patient_group_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.is_default OR OLD.group_kind IN ('default', 'cancelados') THEN
    RAISE EXCEPTION 'Os grupos reservados do paciente não podem ser excluídos.';
  END IF;

  RETURN OLD;
END;
$$;
