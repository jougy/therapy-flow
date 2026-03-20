CREATE TABLE public.patient_registration_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL UNIQUE REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  password_prefix text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_registration_links ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_patient_registration_links_token ON public.patient_registration_links(token);
CREATE INDEX idx_patient_registration_links_patient_id ON public.patient_registration_links(patient_id);

CREATE OR REPLACE FUNCTION public.create_patient_registration_link(_patient_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _patient public.patients%ROWTYPE;
  _link public.patient_registration_links%ROWTYPE;
  _password_prefix text;
  _caller_clinic_id uuid;
  _is_super_admin boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO _patient
  FROM public.patients
  WHERE id = _patient_id;

  IF _patient.id IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado';
  END IF;

  SELECT public.get_user_clinic_id(auth.uid()) INTO _caller_clinic_id;
  SELECT public.has_role(auth.uid(), 'super_admin') INTO _is_super_admin;

  IF NOT _is_super_admin AND _patient.clinic_id IS DISTINCT FROM _caller_clinic_id THEN
    RAISE EXCEPTION 'Sem permissão para compartilhar este cadastro';
  END IF;

  _password_prefix := left(regexp_replace(coalesce(_patient.cpf, ''), '\D', '', 'g'), 6);

  IF length(_password_prefix) < 6 THEN
    RAISE EXCEPTION 'Paciente precisa ter CPF com pelo menos 6 dígitos para compartilhar o cadastro';
  END IF;

  SELECT * INTO _link
  FROM public.patient_registration_links
  WHERE patient_id = _patient_id;

  IF _link.id IS NULL THEN
    INSERT INTO public.patient_registration_links (
      patient_id,
      clinic_id,
      password_prefix,
      created_by
    )
    VALUES (
      _patient.id,
      _patient.clinic_id,
      _password_prefix,
      auth.uid()
    )
    RETURNING * INTO _link;
  ELSE
    UPDATE public.patient_registration_links
    SET
      clinic_id = _patient.clinic_id,
      password_prefix = _password_prefix,
      updated_at = now(),
      completed_at = CASE
        WHEN _patient.registration_complete THEN coalesce(completed_at, now())
        ELSE completed_at
      END
    WHERE id = _link.id
    RETURNING * INTO _link;
  END IF;

  RETURN jsonb_build_object(
    'token', _link.token,
    'password_prefix', _password_prefix,
    'completed', coalesce(_patient.registration_complete, false) OR _link.completed_at IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_patient_registration_form(_token text, _password text)
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
      'clinical_notes', _patient.clinical_notes
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

GRANT EXECUTE ON FUNCTION public.create_patient_registration_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_registration_form(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_patient_registration_form(text, text, jsonb) TO anon, authenticated;
