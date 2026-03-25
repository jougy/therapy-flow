INSERT INTO public.anamnesis_form_templates (
  clinic_id,
  user_id,
  name,
  description,
  schema,
  is_active
)
SELECT
  profiles.clinic_id,
  profiles.id,
  'Ficha padrão',
  'Ficha inicial padrão da clínica para os atendimentos.',
  jsonb_build_array(
    jsonb_build_object(
      'id', 'section_initial',
      'label', 'Contexto inicial',
      'type', 'section',
      'helpText', 'Use esta área para orientar o preenchimento da ficha.'
    ),
    jsonb_build_object(
      'id', 'main_complaint',
      'label', 'Queixa principal',
      'type', 'long_text',
      'required', true
    )
  ),
  true
FROM public.profiles
WHERE NOT EXISTS (
  SELECT 1
  FROM public.anamnesis_form_templates
  WHERE anamnesis_form_templates.clinic_id = profiles.clinic_id
)
AND profiles.id = (
  SELECT p.id
  FROM public.profiles p
  WHERE p.clinic_id = profiles.clinic_id
  ORDER BY p.created_at ASC
  LIMIT 1
);

CREATE OR REPLACE FUNCTION public.ensure_default_anamnesis_template()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.anamnesis_form_templates
    WHERE clinic_id = NEW.clinic_id
  ) THEN
    INSERT INTO public.anamnesis_form_templates (
      clinic_id,
      user_id,
      name,
      description,
      schema,
      is_active
    )
    VALUES (
      NEW.clinic_id,
      NEW.id,
      'Ficha padrão',
      'Ficha inicial padrão da clínica para os atendimentos.',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'section_initial',
          'label', 'Contexto inicial',
          'type', 'section',
          'helpText', 'Use esta área para orientar o preenchimento da ficha.'
        ),
        jsonb_build_object(
          'id', 'main_complaint',
          'label', 'Queixa principal',
          'type', 'long_text',
          'required', true
        )
      ),
      true
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_default_anamnesis_template_for_clinic ON public.profiles;

CREATE TRIGGER create_default_anamnesis_template_for_clinic
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_default_anamnesis_template();
