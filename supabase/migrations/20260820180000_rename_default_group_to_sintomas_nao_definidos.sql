-- Rename default group name from 'Grupo sem definição' to 'Sintomas não definidos'
UPDATE public.patient_groups
SET name = 'Sintomas não definidos'
WHERE is_default = true OR name = 'Grupo sem definição';

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
    'Sintomas não definidos',
    'gray',
    NULL,
    true
  )
  ON CONFLICT (patient_id) WHERE is_default = true
  DO UPDATE SET
    name = 'Sintomas não definidos',
    color = 'gray',
    status = NULL;

  RETURN NEW;
END;
$$;
