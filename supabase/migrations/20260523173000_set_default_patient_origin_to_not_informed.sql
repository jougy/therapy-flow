ALTER TABLE public.patients
ALTER COLUMN origin_type SET DEFAULT 'outros';

UPDATE public.patients
SET
  origin_type = 'outros',
  origin_other_name = coalesce(nullif(trim(origin_other_name), ''), 'Não informado'),
  origin_other_description = coalesce(
    nullif(trim(origin_other_description), ''),
    'Por favor, adicione uma opção de origem para este paciente'
  )
WHERE origin_type IS NULL
   OR origin_type NOT IN ('indicacao', 'convenio', 'filantropia', 'outros')
   OR origin_type = 'outros';
