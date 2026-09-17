-- Migration: 20260912210000_add_patient_guardian_consent_structure.sql
-- Description: Adiciona campos de qualificação do responsável e consentimento LGPD de menores em public.patients

-- 1. Novos campos em public.patients
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS responsible_name text,
  ADD COLUMN IF NOT EXISTS responsible_relationship text,
  ADD COLUMN IF NOT EXISTS guardian_consent jsonb DEFAULT NULL;

COMMENT ON COLUMN public.patients.responsible_name IS 'Nome completo do responsável legal pelo paciente menor';
COMMENT ON COLUMN public.patients.responsible_relationship IS 'Grau de parentesco ou vínculo legal do responsável (Mãe, Pai, Tutor Legal, etc.)';
COMMENT ON COLUMN public.patients.guardian_consent IS 'Estrutura JSON com status, canal, data/hora, IP, assinatura e declaração LGPD do menor';

-- 2. Atualiza ensure_clinic_patient para suportar _responsible_name e _responsible_relationship
DROP FUNCTION IF EXISTS public.ensure_clinic_patient(uuid, text, text, date, text, text, text, boolean, text, text, text);
DROP FUNCTION IF EXISTS public.ensure_clinic_patient(uuid, text, text, date, text, text, text, boolean, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.ensure_clinic_patient(
  _clinic_id uuid,
  _name text,
  _name_key text,
  _date_of_birth date,
  _cpf text DEFAULT null,
  _phone text DEFAULT null,
  _email text DEFAULT null,
  _uses_responsible_cpf boolean DEFAULT false,
  _gender text DEFAULT null,
  _pronoun text DEFAULT null,
  _rg text DEFAULT null,
  _responsible_name text DEFAULT null,
  _responsible_relationship text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  _actor uuid := auth.uid();
  _patient public.patients%ROWTYPE;
  _clean_name text := left(trim(coalesce(_name, '')), 160);
  _clean_name_key text := coalesce(nullif(trim(_name_key), ''), public.normalize_patient_name_key(_clean_name));
  _clean_cpf_digits text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  _clean_cpf text := null;
  _patient_cpf text := null;
  _responsible_cpf text := null;
  _phone_digits text := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
  _clean_phone text := null;
  _clean_email text := nullif(lower(left(trim(coalesce(_email, '')), 254)), '');
  _clean_gender text := nullif(trim(coalesce(_gender, '')), '');
  _clean_pronoun text := nullif(trim(coalesce(_pronoun, '')), '');
  _clean_rg text := nullif(trim(coalesce(_rg, '')), '');
  _clean_responsible_name text := nullif(trim(coalesce(_responsible_name, '')), '');
  _clean_responsible_relationship text := nullif(trim(coalesce(_responsible_relationship, '')), '');
  _matched_by text;
  _calculated_age integer;
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  IF _clinic_id IS NULL OR NOT public.current_user_can('patients.write', _clinic_id) THEN
    RAISE EXCEPTION 'Sem permissão para cadastrar pacientes nesta clínica';
  END IF;

  IF length(_clean_name) < 3 OR length(_clean_name_key) < 3 THEN
    RAISE EXCEPTION 'Informe um nome completo válido';
  END IF;

  IF _clean_cpf_digits <> '' THEN
    _clean_cpf := left(_clean_cpf_digits, 11);
    IF _clean_cpf !~ '^\d{11}$' THEN
      RAISE EXCEPTION 'CPF inválido';
    END IF;

    IF coalesce(_uses_responsible_cpf, false) THEN
      _responsible_cpf := _clean_cpf;
    ELSE
      _patient_cpf := _clean_cpf;
    END IF;
  END IF;

  _phone_digits := CASE
    WHEN length(_phone_digits) > 11 AND left(_phone_digits, 2) = '55' THEN substr(_phone_digits, 3)
    ELSE _phone_digits
  END;
  _clean_phone := nullif(left(_phone_digits, 11), '');

  IF _clean_phone IS NOT NULL AND _clean_phone !~ '^\d{10,11}$' THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;

  IF _clean_email IS NOT NULL AND _clean_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]{2,}$' THEN
    RAISE EXCEPTION 'E-mail inválido';
  END IF;

  IF _date_of_birth IS NULL OR _date_of_birth > current_date OR _date_of_birth < (current_date - interval '130 years')::date THEN
    RAISE EXCEPTION 'Data de nascimento inválida';
  END IF;

  _calculated_age := extract(year from age(current_date, _date_of_birth))::integer;

  IF _patient_cpf IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(_clinic_id::text || ':patient:' || _patient_cpf, 0));
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_clinic_id::text || ':patient-name-birth:' || _clean_name_key || ':' || _date_of_birth::text, 0));

  IF _patient_cpf IS NOT NULL THEN
    SELECT * INTO _patient
    FROM public.patients
    WHERE clinic_id = _clinic_id
      AND cpf = _patient_cpf
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1;

    IF _patient.id IS NOT NULL THEN
      _matched_by := 'cpf';
    END IF;
  END IF;

  IF _patient.id IS NULL THEN
    SELECT * INTO _patient
    FROM public.patients
    WHERE clinic_id = _clinic_id
      AND public.normalize_patient_name_key(name) = _clean_name_key
      AND date_of_birth = _date_of_birth
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1;

    IF _patient.id IS NOT NULL THEN
      _matched_by := 'name_birth';
    END IF;
  END IF;

  IF _patient.id IS NOT NULL THEN
    UPDATE public.patients
    SET
      cpf = coalesce(nullif(cpf, ''), _patient_cpf),
      responsible_cpf = coalesce(nullif(responsible_cpf, ''), _responsible_cpf),
      uses_responsible_cpf = uses_responsible_cpf OR coalesce(_uses_responsible_cpf, false),
      date_of_birth = coalesce(date_of_birth, _date_of_birth),
      age = coalesce(age, _calculated_age),
      phone = coalesce(nullif(phone, ''), _clean_phone),
      email = coalesce(nullif(email, ''), _clean_email),
      gender = coalesce(nullif(gender, ''), _clean_gender),
      pronoun = coalesce(nullif(pronoun, ''), _clean_pronoun),
      rg = coalesce(nullif(rg, ''), _clean_rg),
      responsible_name = coalesce(_clean_responsible_name, responsible_name),
      responsible_relationship = coalesce(_clean_responsible_relationship, responsible_relationship),
      updated_at = now()
    WHERE id = _patient.id
    RETURNING * INTO _patient;

    RETURN jsonb_build_object(
      'id', _patient.id,
      'patient_code', _patient.patient_code,
      'status', 'existing',
      'matched_by', _matched_by,
      'name', _patient.name,
      'date_of_birth', _patient.date_of_birth,
      'age', _patient.age,
      'cpf', _patient.cpf,
      'responsible_cpf', _patient.responsible_cpf,
      'uses_responsible_cpf', _patient.uses_responsible_cpf,
      'responsible_name', _patient.responsible_name,
      'responsible_relationship', _patient.responsible_relationship,
      'guardian_consent', _patient.guardian_consent,
      'phone', _patient.phone,
      'email', _patient.email,
      'gender', _patient.gender,
      'pronoun', _patient.pronoun,
      'rg', _patient.rg
    );
  END IF;

  INSERT INTO public.patients (
    user_id,
    clinic_id,
    name,
    date_of_birth,
    age,
    cpf,
    responsible_cpf,
    uses_responsible_cpf,
    responsible_name,
    responsible_relationship,
    guardian_consent,
    phone,
    email,
    gender,
    pronoun,
    rg,
    status,
    registration_complete
  )
  VALUES (
    _actor,
    _clinic_id,
    _clean_name,
    _date_of_birth,
    _calculated_age,
    _patient_cpf,
    _responsible_cpf,
    coalesce(_uses_responsible_cpf, false),
    _clean_responsible_name,
    _clean_responsible_relationship,
    CASE
      WHEN _calculated_age < 18 THEN jsonb_build_object(
        'status', 'pending',
        'responsible_name', _clean_responsible_name,
        'responsible_relationship', _clean_responsible_relationship,
        'responsible_cpf', _responsible_cpf
      )
      ELSE NULL
    END,
    _clean_phone,
    _clean_email,
    _clean_gender,
    _clean_pronoun,
    _clean_rg,
    'ativo',
    false
  )
  RETURNING * INTO _patient;

  RETURN jsonb_build_object(
    'id', _patient.id,
    'patient_code', _patient.patient_code,
    'status', 'created',
    'matched_by', 'created',
    'name', _patient.name,
    'date_of_birth', _patient.date_of_birth,
    'age', _patient.age,
    'cpf', _patient.cpf,
    'responsible_cpf', _patient.responsible_cpf,
    'uses_responsible_cpf', _patient.uses_responsible_cpf,
    'responsible_name', _patient.responsible_name,
    'responsible_relationship', _patient.responsible_relationship,
    'guardian_consent', _patient.guardian_consent,
    'phone', _patient.phone,
    'email', _patient.email,
    'gender', _patient.gender,
    'pronoun', _patient.pronoun,
    'rg', _patient.rg
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_clinic_patient(uuid, text, text, date, text, text, text, boolean, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.ensure_clinic_patient(uuid, text, text, date, text, text, text, boolean, text, text, text, text, text) TO authenticated;

-- 3. RPC para autorização digital pública do responsável pelo menor
CREATE OR REPLACE FUNCTION public.authorize_minor_guardian_consent(
  _token text,
  _password text,
  _consent_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  _link public.patient_registration_links%ROWTYPE;
  _patient public.patients%ROWTYPE;
  _normalized_password text := left(regexp_replace(coalesce(_password, ''), '\D', '', 'g'), 6);
  _resp_name text;
  _resp_rel text;
  _resp_cpf text;
  _resp_email text;
  _consent_payload jsonb;
BEGIN
  SELECT * INTO _link
  FROM public.patient_registration_links
  WHERE token = _token;

  IF _link.id IS NULL THEN
    RAISE EXCEPTION 'Link de autorização inválido ou expirado';
  END IF;

  IF _link.password_prefix IS DISTINCT FROM _normalized_password THEN
    RAISE EXCEPTION 'Senha incorreta. Digite os 6 primeiros dígitos do CPF/documento.';
  END IF;

  SELECT * INTO _patient
  FROM public.patients
  WHERE id = _link.patient_id;

  IF _patient.id IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado';
  END IF;

  _resp_name := coalesce(nullif(trim(_consent_data->>'responsible_name'), ''), _patient.responsible_name);
  _resp_rel := coalesce(nullif(trim(_consent_data->>'responsible_relationship'), ''), _patient.responsible_relationship);
  _resp_cpf := coalesce(nullif(regexp_replace(coalesce(_consent_data->>'responsible_cpf', ''), '\D', '', 'g'), ''), _patient.responsible_cpf);
  _resp_email := nullif(lower(trim(coalesce(_consent_data->>'responsible_email', ''))), '');

  _consent_payload := jsonb_build_object(
    'status', 'signed',
    'method', coalesce(_consent_data->>'method', 'whatsapp'),
    'signed_at', coalesce(_consent_data->>'signed_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
    'responsible_name', _resp_name,
    'responsible_relationship', _resp_rel,
    'responsible_cpf', _resp_cpf,
    'responsible_email', _resp_email,
    'signature_image_url', _consent_data->>'signature_image_url',
    'ip_address', _consent_data->>'ip_address',
    'user_agent', _consent_data->>'user_agent',
    'legal_declaration', true
  );

  UPDATE public.patients
  SET
    guardian_consent = _consent_payload,
    responsible_name = coalesce(_resp_name, responsible_name),
    responsible_relationship = coalesce(_resp_rel, responsible_relationship),
    responsible_cpf = coalesce(_resp_cpf, responsible_cpf),
    updated_at = now()
  WHERE id = _patient.id;

  RETURN jsonb_build_object(
    'success', true,
    'patient_id', _patient.id,
    'patient_name', _patient.name,
    'consent', _consent_payload
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.authorize_minor_guardian_consent(text, text, jsonb) TO anon, authenticated;

-- 4. RPC para a equipe da clínica atualizar o status do consentimento (presencial na tela ou termo impresso)
CREATE OR REPLACE FUNCTION public.update_patient_guardian_consent(
  _patient_id uuid,
  _consent_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  _actor uuid := auth.uid();
  _patient public.patients%ROWTYPE;
  _clinic_id uuid;
  _resp_name text;
  _resp_rel text;
  _resp_cpf text;
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO _patient
  FROM public.patients
  WHERE id = _patient_id;

  IF _patient.id IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado';
  END IF;

  _clinic_id := _patient.clinic_id;
  IF _clinic_id IS NOT NULL AND NOT public.current_user_can('patients.write', _clinic_id) THEN
    RAISE EXCEPTION 'Sem permissão para atualizar dados de consentimento nesta clínica';
  END IF;

  _resp_name := nullif(trim(coalesce(_consent_payload->>'responsible_name', '')), '');
  _resp_rel := nullif(trim(coalesce(_consent_payload->>'responsible_relationship', '')), '');
  _resp_cpf := nullif(regexp_replace(coalesce(_consent_payload->>'responsible_cpf', ''), '\D', '', 'g'), '');

  UPDATE public.patients
  SET
    guardian_consent = _consent_payload,
    responsible_name = coalesce(_resp_name, responsible_name),
    responsible_relationship = coalesce(_resp_rel, responsible_relationship),
    responsible_cpf = coalesce(_resp_cpf, responsible_cpf),
    updated_at = now()
  WHERE id = _patient.id
  RETURNING * INTO _patient;

  RETURN jsonb_build_object(
    'success', true,
    'patient_id', _patient.id,
    'consent', _patient.guardian_consent
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_patient_guardian_consent(uuid, jsonb) TO authenticated;

-- 5. Atualiza get_patient_registration_form para retornar os novos campos
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
      'age', coalesce(_patient.age, extract(year from age(current_date, _patient.date_of_birth))::integer),
      'responsible_name', _patient.responsible_name,
      'responsible_relationship', _patient.responsible_relationship,
      'responsible_cpf', _patient.responsible_cpf,
      'guardian_consent', _patient.guardian_consent,
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

GRANT EXECUTE ON FUNCTION public.get_patient_registration_form(text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
