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
          'uses_substances', CASE
            WHEN jsonb_typeof(_payload->'clinical_profile'->'uses_substances') = 'boolean'
            THEN (_payload->'clinical_profile'->>'uses_substances')::boolean
            ELSE null
          END,
          'substance_use_records', CASE
            WHEN jsonb_typeof(_payload->'clinical_profile'->'substance_use_records') = 'array'
            THEN _payload->'clinical_profile'->'substance_use_records'
            ELSE null
          END,
          'has_addictions', CASE
            WHEN jsonb_typeof(_payload->'clinical_profile'->'has_addictions') = 'boolean'
            THEN (_payload->'clinical_profile'->>'has_addictions')::boolean
            ELSE null
          END,
          'addiction_records', CASE
            WHEN jsonb_typeof(_payload->'clinical_profile'->'addiction_records') = 'array'
            THEN _payload->'clinical_profile'->'addiction_records'
            ELSE null
          END,
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

GRANT EXECUTE ON FUNCTION public.submit_patient_registration_form(text, text, jsonb) TO anon, authenticated;
