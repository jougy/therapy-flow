ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS origin_type text NOT NULL DEFAULT 'outros',
ADD COLUMN IF NOT EXISTS origin_referrer_name text,
ADD COLUMN IF NOT EXISTS origin_insurance_provider text,
ADD COLUMN IF NOT EXISTS origin_insurance_plan text,
ADD COLUMN IF NOT EXISTS origin_insurance_member_id text,
ADD COLUMN IF NOT EXISTS origin_other_name text,
ADD COLUMN IF NOT EXISTS origin_other_description text;

UPDATE public.patients
SET
  origin_type = 'outros',
  origin_other_name = coalesce(nullif(trim(origin_other_name), ''), 'Não informado'),
  origin_other_description = coalesce(
    nullif(trim(origin_other_description), ''),
    'Por favor, adicione uma opção de origem para este paciente'
  )
WHERE origin_type IS NULL
   OR origin_type NOT IN ('particular', 'indicacao', 'convenio', 'filantropia', 'outros')
   OR origin_type = 'particular'
   OR origin_type = 'outros';

ALTER TABLE public.patients
DROP CONSTRAINT IF EXISTS patients_origin_type_valid,
DROP CONSTRAINT IF EXISTS patients_origin_fields_lengths;

ALTER TABLE public.patients
ADD CONSTRAINT patients_origin_type_valid
CHECK (origin_type IN ('particular', 'indicacao', 'convenio', 'filantropia', 'outros'));

ALTER TABLE public.patients
ADD CONSTRAINT patients_origin_fields_lengths
CHECK (
  char_length(coalesce(origin_referrer_name, '')) <= 120
  AND char_length(coalesce(origin_insurance_provider, '')) <= 120
  AND char_length(coalesce(origin_insurance_plan, '')) <= 120
  AND char_length(coalesce(origin_insurance_member_id, '')) <= 80
  AND char_length(coalesce(origin_other_name, '')) <= 120
  AND char_length(coalesce(origin_other_description, '')) <= 500
);

CREATE OR REPLACE FUNCTION public.get_patient_registration_form(
  _token text,
  _password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _link public.patient_registration_links%ROWTYPE;
  _patient public.patients%ROWTYPE;
  _normalized_password text := left(regexp_replace(coalesce(_password, ''), '\D', '', 'g'), 6);
  _completed boolean;
BEGIN
  SELECT * INTO _link
  FROM public.patient_registration_links
  WHERE token = _token;

  IF _link.id IS NULL THEN
    RAISE EXCEPTION 'Link inválido';
  END IF;

  IF _link.password_prefix IS DISTINCT FROM _normalized_password THEN
    RAISE EXCEPTION 'Senha inválida';
  END IF;

  SELECT * INTO _patient
  FROM public.patients
  WHERE id = _link.patient_id;

  IF _patient.id IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado';
  END IF;

  _completed := coalesce(_patient.registration_complete, false) OR _link.completed_at IS NOT NULL;

  RETURN jsonb_build_object(
    'completed', _completed,
    'message', CASE
      WHEN _completed THEN 'Cadastro concluído! Caso precise atualizar alguma informação, informe o profissional que está te atendendo.'
      ELSE null
    END,
    'patient', jsonb_build_object(
      'id', _patient.id,
      'name', _patient.name,
      'cpf', _patient.cpf,
      'date_of_birth', _patient.date_of_birth,
      'phone', _patient.phone,
      'email', _patient.email,
      'gender', _patient.gender,
      'rg', _patient.rg,
      'blood_type', _patient.blood_type,
      'pronoun', _patient.pronoun,
      'profession', _patient.profession,
      'origin_type', _patient.origin_type,
      'origin_referrer_name', _patient.origin_referrer_name,
      'origin_insurance_provider', _patient.origin_insurance_provider,
      'origin_insurance_plan', _patient.origin_insurance_plan,
      'origin_insurance_member_id', _patient.origin_insurance_member_id,
      'origin_other_name', _patient.origin_other_name,
      'origin_other_description', _patient.origin_other_description,
      'cep', _patient.cep,
      'country', coalesce(_patient.country, 'Brasil'),
      'state', _patient.state,
      'city', _patient.city,
      'neighborhood', _patient.neighborhood,
      'street', _patient.street,
      'address_number', _patient.address_number,
      'address_complement', _patient.address_complement,
      'chronic_conditions', _patient.chronic_conditions,
      'surgeries', _patient.surgeries,
      'continuous_medications', _patient.continuous_medications,
      'allergies', _patient.allergies,
      'clinical_notes', _patient.clinical_notes,
      'clinical_profile', _patient.clinical_profile,
      'emergency_contact', _patient.emergency_contact
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_patient_registration_form(
  _token text,
  _password text,
  _payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _link public.patient_registration_links%ROWTYPE;
  _patient public.patients%ROWTYPE;
  _normalized_password text := left(regexp_replace(coalesce(_password, ''), '\D', '', 'g'), 6);
  _birth_date date;
  _completed boolean;
  _origin_type text;
BEGIN
  SELECT * INTO _link
  FROM public.patient_registration_links
  WHERE token = _token;

  IF _link.id IS NULL THEN
    RAISE EXCEPTION 'Link inválido';
  END IF;

  IF _link.password_prefix IS DISTINCT FROM _normalized_password THEN
    RAISE EXCEPTION 'Senha inválida';
  END IF;

  SELECT * INTO _patient
  FROM public.patients
  WHERE id = _link.patient_id;

  IF _patient.id IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado';
  END IF;

  _completed := coalesce(_patient.registration_complete, false) OR _link.completed_at IS NOT NULL;

  IF _completed THEN
    RETURN jsonb_build_object(
      'completed', true,
      'message', 'Cadastro concluído! Caso precise atualizar alguma informação, informe o profissional que está te atendendo.'
    );
  END IF;

  _birth_date := nullif(coalesce(_payload->>'date_of_birth', ''), '')::date;
  _origin_type := coalesce(nullif(trim(_payload->>'origin_type'), ''), 'outros');

  IF _origin_type NOT IN ('particular', 'indicacao', 'convenio', 'filantropia', 'outros') THEN
    _origin_type := 'outros';
  END IF;

  UPDATE public.patients
  SET
    name = coalesce(nullif(trim(_payload->>'name'), ''), name),
    date_of_birth = _birth_date,
    age = CASE
      WHEN _birth_date IS NOT NULL THEN extract(year from age(current_date, _birth_date))::integer
      ELSE null
    END,
    phone = nullif(regexp_replace(coalesce(_payload->>'phone', ''), '\D', '', 'g'), ''),
    email = nullif(trim(_payload->>'email'), ''),
    gender = nullif(trim(_payload->>'gender'), ''),
    rg = nullif(trim(_payload->>'rg'), ''),
    blood_type = nullif(trim(_payload->>'blood_type'), ''),
    pronoun = nullif(trim(_payload->>'pronoun'), ''),
    profession = nullif(trim(_payload->>'profession'), ''),
    origin_type = _origin_type,
    origin_referrer_name = CASE WHEN _origin_type = 'indicacao' THEN left(nullif(trim(_payload->>'origin_referrer_name'), ''), 120) ELSE null END,
    origin_insurance_provider = CASE WHEN _origin_type = 'convenio' THEN left(nullif(trim(_payload->>'origin_insurance_provider'), ''), 120) ELSE null END,
    origin_insurance_plan = CASE WHEN _origin_type = 'convenio' THEN left(nullif(trim(_payload->>'origin_insurance_plan'), ''), 120) ELSE null END,
    origin_insurance_member_id = CASE WHEN _origin_type = 'convenio' THEN left(nullif(trim(_payload->>'origin_insurance_member_id'), ''), 80) ELSE null END,
    origin_other_name = CASE
      WHEN _origin_type = 'outros'
      THEN left(coalesce(nullif(trim(_payload->>'origin_other_name'), ''), 'Não informado'), 120)
      ELSE null
    END,
    origin_other_description = CASE
      WHEN _origin_type = 'outros'
      THEN left(coalesce(nullif(trim(_payload->>'origin_other_description'), ''), 'Por favor, adicione uma opção de origem para este paciente'), 500)
      ELSE null
    END,
    cep = nullif(regexp_replace(coalesce(_payload->>'cep', ''), '\D', '', 'g'), ''),
    country = coalesce(nullif(trim(_payload->>'country'), ''), 'Brasil'),
    state = nullif(trim(_payload->>'state'), ''),
    city = nullif(trim(_payload->>'city'), ''),
    neighborhood = nullif(trim(_payload->>'neighborhood'), ''),
    street = nullif(trim(_payload->>'street'), ''),
    address_number = nullif(trim(_payload->>'address_number'), ''),
    address_complement = nullif(trim(_payload->>'address_complement'), ''),
    chronic_conditions = nullif(trim(_payload->>'chronic_conditions'), ''),
    surgeries = nullif(trim(_payload->>'surgeries'), ''),
    continuous_medications = nullif(trim(_payload->>'continuous_medications'), ''),
    allergies = nullif(trim(_payload->>'allergies'), ''),
    clinical_notes = nullif(trim(_payload->>'clinical_notes'), ''),
    clinical_profile = nullif(
      jsonb_strip_nulls(
        jsonb_build_object(
          'diagnoses', nullif(trim(coalesce(_payload->'clinical_profile'->>'diagnoses', '')), ''),
          'clinical_alerts', nullif(trim(coalesce(_payload->'clinical_profile'->>'clinical_alerts', '')), ''),
          'congenital_genetic_conditions', nullif(trim(coalesce(_payload->'clinical_profile'->>'congenital_genetic_conditions', '')), ''),
          'implants_devices', nullif(trim(coalesce(_payload->'clinical_profile'->>'implants_devices', '')), ''),
          'family_history', nullif(trim(coalesce(_payload->'clinical_profile'->>'family_history', '')), ''),
          'lifestyle_notes', nullif(trim(coalesce(_payload->'clinical_profile'->>'lifestyle_notes', '')), ''),
          'falls_history', nullif(trim(coalesce(_payload->'clinical_profile'->>'falls_history', '')), ''),
          'mobility_aids', nullif(trim(coalesce(_payload->'clinical_profile'->>'mobility_aids', '')), ''),
          'functional_independence', nullif(trim(coalesce(_payload->'clinical_profile'->>'functional_independence', '')), ''),
          'substance_use_history', nullif(trim(coalesce(_payload->'clinical_profile'->>'substance_use_history', '')), ''),
          'treatment_goals', nullif(trim(coalesce(_payload->'clinical_profile'->>'treatment_goals', '')), '')
        )
      ),
      '{}'::jsonb
    ),
    emergency_contact = nullif(
      jsonb_strip_nulls(
        jsonb_build_object(
          'name', nullif(trim(coalesce(_payload->'emergency_contact'->>'name', '')), ''),
          'relationship', nullif(trim(coalesce(_payload->'emergency_contact'->>'relationship', '')), ''),
          'phone', nullif(regexp_replace(coalesce(_payload->'emergency_contact'->>'phone', ''), '\D', '', 'g'), '')
        )
      ),
      '{}'::jsonb
    ),
    registration_complete = true,
    updated_at = now()
  WHERE id = _patient.id;

  UPDATE public.patient_registration_links
  SET
    completed_at = now(),
    updated_at = now()
  WHERE id = _link.id;

  RETURN jsonb_build_object(
    'completed', true,
    'message', 'Cadastro concluído! Caso precise atualizar alguma informação, informe o profissional que está te atendendo.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_registration_form(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_patient_registration_form(text, text, jsonb) TO anon, authenticated;
