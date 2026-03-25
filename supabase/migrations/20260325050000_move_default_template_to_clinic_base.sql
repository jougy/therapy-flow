ALTER TABLE public.clinics
ADD COLUMN anamnesis_base_schema jsonb NOT NULL DEFAULT jsonb_build_array(
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
);

ALTER TABLE public.anamnesis_form_templates
ADD COLUMN is_system_default boolean NOT NULL DEFAULT false;

UPDATE public.anamnesis_form_templates
SET is_system_default = true
WHERE name = 'Ficha padrão'
  AND description = 'Ficha inicial padrão da clínica para os atendimentos.';

UPDATE public.clinics
SET anamnesis_base_schema = templates.schema
FROM (
  SELECT DISTINCT ON (clinic_id)
    clinic_id,
    schema
  FROM public.anamnesis_form_templates
  WHERE is_system_default = true
  ORDER BY clinic_id, created_at ASC
) AS templates
WHERE clinics.id = templates.clinic_id;

UPDATE public.sessions
SET anamnesis_template_id = null
WHERE anamnesis_template_id IN (
  SELECT id
  FROM public.anamnesis_form_templates
  WHERE is_system_default = true
);

DELETE FROM public.anamnesis_form_templates
WHERE is_system_default = true;

DROP TRIGGER IF EXISTS create_default_anamnesis_template_for_clinic ON public.profiles;
DROP FUNCTION IF EXISTS public.ensure_default_anamnesis_template();
