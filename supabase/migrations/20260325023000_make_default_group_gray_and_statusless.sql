ALTER TABLE public.patient_groups
DROP CONSTRAINT IF EXISTS patient_groups_status_check;

ALTER TABLE public.patient_groups
ALTER COLUMN status DROP NOT NULL;

ALTER TABLE public.patient_groups
ADD CONSTRAINT patient_groups_status_check
CHECK (
  status IS NULL OR status = ANY (
    ARRAY['em_andamento', 'pausado', 'concluido', 'cancelado', 'inativo']
  )
);

UPDATE public.patient_groups
SET
  name = 'Grupo sem definição',
  color = 'gray',
  status = NULL
WHERE is_default = true;

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
    'gray',
    NULL,
    true
  );

  RETURN NEW;
END;
$$;
