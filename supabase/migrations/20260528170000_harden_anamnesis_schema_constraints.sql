alter table public.anamnesis_form_templates
drop constraint if exists anamnesis_form_templates_schema_shape_check;

alter table public.anamnesis_form_templates
add constraint anamnesis_form_templates_schema_shape_check
check (
  jsonb_typeof(schema) = 'array'
  and case
    when jsonb_typeof(schema) = 'array' then jsonb_array_length(schema) <= 200
    else false
  end
);

alter table public.clinics
drop constraint if exists clinics_anamnesis_base_schema_shape_check;

alter table public.clinics
add constraint clinics_anamnesis_base_schema_shape_check
check (
  jsonb_typeof(anamnesis_base_schema) = 'array'
  and case
    when jsonb_typeof(anamnesis_base_schema) = 'array' then jsonb_array_length(anamnesis_base_schema) <= 200
    else false
  end
);
