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
  _birth_text text := nullif(trim(coalesce(_payload->>'date_of_birth', '')), '');
  _completed boolean;
  _origin_type text;
  _name text := left(trim(coalesce(_payload->>'name', '')), 160);
  _email text := nullif(lower(left(trim(coalesce(_payload->>'email', '')), 254)), '');
  _phone_digits text := regexp_replace(coalesce(_payload->>'phone', ''), '\D', '', 'g');
  _emergency_phone_digits text := regexp_replace(coalesce(_payload->'emergency_contact'->>'phone', ''), '\D', '', 'g');
  _phone text;
  _emergency_phone text;
BEGIN
  _phone_digits := CASE
    WHEN length(_phone_digits) > 11 AND left(_phone_digits, 2) = '55' THEN substr(_phone_digits, 3)
    ELSE _phone_digits
  END;
  _phone := nullif(left(_phone_digits, 11), '');
  _emergency_phone_digits := CASE
    WHEN length(_emergency_phone_digits) > 11 AND left(_emergency_phone_digits, 2) = '55' THEN substr(_emergency_phone_digits, 3)
    ELSE _emergency_phone_digits
  END;
  _emergency_phone := nullif(left(_emergency_phone_digits, 11), '');

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

  IF length(_name) < 3 THEN
    RAISE EXCEPTION 'Informe um nome completo válido';
  END IF;

  IF _birth_text IS NOT NULL THEN
    IF _birth_text !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'Data de nascimento inválida';
    END IF;

    BEGIN
      _birth_date := _birth_text::date;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Data de nascimento inválida';
    END;

    IF _birth_date > current_date OR _birth_date < (current_date - interval '130 years')::date THEN
      RAISE EXCEPTION 'Data de nascimento inválida';
    END IF;
  END IF;

  IF _phone IS NOT NULL AND _phone !~ '^\d{10,11}$' THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;

  IF _email IS NOT NULL AND _email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]{2,}$' THEN
    RAISE EXCEPTION 'E-mail inválido';
  END IF;

  _origin_type := coalesce(nullif(trim(_payload->>'origin_type'), ''), 'outros');

  IF _origin_type NOT IN ('particular', 'indicacao', 'convenio', 'filantropia', 'outros') THEN
    _origin_type := 'outros';
  END IF;

  UPDATE public.patients
  SET
    name = _name,
    date_of_birth = _birth_date,
    age = CASE
      WHEN _birth_date IS NOT NULL THEN extract(year from age(current_date, _birth_date))::integer
      ELSE null
    END,
    phone = _phone,
    email = _email,
    gender = left(nullif(trim(coalesce(_payload->>'gender', '')), ''), 240),
    rg = left(nullif(trim(coalesce(_payload->>'rg', '')), ''), 32),
    blood_type = left(nullif(trim(coalesce(_payload->>'blood_type', '')), ''), 8),
    pronoun = left(nullif(trim(coalesce(_payload->>'pronoun', '')), ''), 240),
    profession = left(nullif(trim(coalesce(_payload->>'profession', '')), ''), 120),
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
    cep = nullif(left(regexp_replace(coalesce(_payload->>'cep', ''), '\D', '', 'g'), 8), ''),
    country = coalesce(left(nullif(trim(_payload->>'country'), ''), 80), 'Brasil'),
    state = left(nullif(trim(coalesce(_payload->>'state', '')), ''), 40),
    city = left(nullif(trim(coalesce(_payload->>'city', '')), ''), 120),
    neighborhood = left(nullif(trim(coalesce(_payload->>'neighborhood', '')), ''), 240),
    street = left(nullif(trim(coalesce(_payload->>'street', '')), ''), 160),
    address_number = left(nullif(trim(coalesce(_payload->>'address_number', '')), ''), 40),
    address_complement = left(nullif(trim(coalesce(_payload->>'address_complement', '')), ''), 120),
    chronic_conditions = left(nullif(trim(coalesce(_payload->>'chronic_conditions', '')), ''), 2000),
    surgeries = left(nullif(trim(coalesce(_payload->>'surgeries', '')), ''), 2000),
    continuous_medications = left(nullif(trim(coalesce(_payload->>'continuous_medications', '')), ''), 2000),
    allergies = left(nullif(trim(coalesce(_payload->>'allergies', '')), ''), 2000),
    clinical_notes = left(nullif(trim(coalesce(_payload->>'clinical_notes', '')), ''), 2000),
    clinical_profile = nullif(
      jsonb_strip_nulls(
        jsonb_build_object(
          'diagnoses', left(nullif(trim(coalesce(_payload->'clinical_profile'->>'diagnoses', '')), ''), 2000),
          'clinical_alerts', left(nullif(trim(coalesce(_payload->'clinical_profile'->>'clinical_alerts', '')), ''), 2000),
          'congenital_genetic_conditions', left(nullif(trim(coalesce(_payload->'clinical_profile'->>'congenital_genetic_conditions', '')), ''), 2000),
          'implants_devices', left(nullif(trim(coalesce(_payload->'clinical_profile'->>'implants_devices', '')), ''), 2000),
          'family_history', left(nullif(trim(coalesce(_payload->'clinical_profile'->>'family_history', '')), ''), 2000),
          'lifestyle_notes', left(nullif(trim(coalesce(_payload->'clinical_profile'->>'lifestyle_notes', '')), ''), 2000),
          'falls_history', left(nullif(trim(coalesce(_payload->'clinical_profile'->>'falls_history', '')), ''), 2000),
          'mobility_aids', left(nullif(trim(coalesce(_payload->'clinical_profile'->>'mobility_aids', '')), ''), 2000),
          'risk_flags', (
            select nullif(jsonb_agg(flag), '[]'::jsonb)
            from jsonb_array_elements_text(
              case
                when jsonb_typeof(_payload->'clinical_profile'->'risk_flags') = 'array'
                then _payload->'clinical_profile'->'risk_flags'
                else '[]'::jsonb
              end
            ) as risk(flag)
            where flag in (
              'fall_risk',
              'allergy',
              'pregnant',
              'high_risk_pregnancy',
              'elderly',
              'aggressive',
              'escape_risk',
              'pediatric',
              'pressure_injury',
              'limb_preservation',
              'infection_risk',
              'diabetes',
              'neuropathy',
              'seizure_risk',
              'speech_difficulty'
            )
          ),
          'functional_independence', left(nullif(trim(coalesce(_payload->'clinical_profile'->>'functional_independence', '')), ''), 80),
          'substance_use_history', _payload->'clinical_profile'->'substance_use_history',
          'treatment_goals', left(nullif(trim(coalesce(_payload->'clinical_profile'->>'treatment_goals', '')), ''), 2000)
        )
      ),
      '{}'::jsonb
    ),
    emergency_contact = nullif(
      jsonb_strip_nulls(
        jsonb_build_object(
          'name', left(nullif(trim(coalesce(_payload->'emergency_contact'->>'name', '')), ''), 160),
          'relationship', left(nullif(trim(coalesce(_payload->'emergency_contact'->>'relationship', '')), ''), 240),
          'phone', _emergency_phone
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
