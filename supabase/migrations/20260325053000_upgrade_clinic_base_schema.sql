UPDATE public.clinics
SET anamnesis_base_schema = jsonb_build_array(
  jsonb_build_object(
    'id', 'section_main',
    'label', 'Anamnese inicial',
    'type', 'section',
    'helpText', 'Campos obrigatórios da primeira parte da anamnese.'
  ),
  jsonb_build_object(
    'id', 'queixa',
    'label', 'Queixa principal',
    'type', 'long_text',
    'required', true,
    'groupKey', 'section_main',
    'systemKey', 'queixa'
  ),
  jsonb_build_object(
    'id', 'sintomas',
    'label', 'Sintomas',
    'type', 'long_text',
    'groupKey', 'section_main',
    'systemKey', 'sintomas'
  ),
  jsonb_build_object(
    'id', 'pain_score',
    'label', 'Nota da dor',
    'type', 'slider',
    'min', 0,
    'max', 10,
    'groupKey', 'section_main',
    'systemKey', 'pain_score'
  ),
  jsonb_build_object(
    'id', 'complexity_score',
    'label', 'Nota de complexidade',
    'type', 'slider',
    'min', 0,
    'max', 10,
    'groupKey', 'section_main',
    'systemKey', 'complexity_score'
  ),
  jsonb_build_object(
    'id', 'observacoes',
    'label', 'Observações',
    'type', 'long_text',
    'groupKey', 'section_main',
    'systemKey', 'observacoes'
  )
)
WHERE jsonb_array_length(anamnesis_base_schema) = 2
  AND anamnesis_base_schema @> jsonb_build_array(
    jsonb_build_object('id', 'section_initial'),
    jsonb_build_object('id', 'main_complaint')
  );
