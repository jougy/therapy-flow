-- Migration: Enhance patient registration link generation, support for foreign/non-CPF patients and pre-registration with gender and pronoun

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.patient_registration_links 
ALTER COLUMN token SET DEFAULT replace(gen_random_uuid()::text, '-', '');

DROP FUNCTION IF EXISTS public.ensure_clinic_patient(uuid, text, text, date, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.ensure_clinic_patient(uuid, text, text, date, text, text, text, boolean, text, text);
DROP FUNCTION IF EXISTS public.ensure_clinic_patient(uuid, text, text, date, text, text, text, boolean, text, text, text);

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
  _rg text DEFAULT null
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
  _matched_by text;
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
      age = coalesce(age, extract(year from age(current_date, _date_of_birth))::integer),
      phone = coalesce(nullif(phone, ''), _clean_phone),
      email = coalesce(nullif(email, ''), _clean_email),
      gender = coalesce(nullif(gender, ''), _clean_gender),
      pronoun = coalesce(nullif(pronoun, ''), _clean_pronoun),
      rg = coalesce(nullif(rg, ''), _clean_rg),
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
      'cpf', _patient.cpf,
      'responsible_cpf', _patient.responsible_cpf,
      'uses_responsible_cpf', _patient.uses_responsible_cpf,
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
    extract(year from age(current_date, _date_of_birth))::integer,
    _patient_cpf,
    _responsible_cpf,
    coalesce(_uses_responsible_cpf, false),
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
    'cpf', _patient.cpf,
    'responsible_cpf', _patient.responsible_cpf,
    'uses_responsible_cpf', _patient.uses_responsible_cpf,
    'phone', _patient.phone,
    'email', _patient.email,
    'gender', _patient.gender,
    'pronoun', _patient.pronoun,
    'rg', _patient.rg
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_clinic_patient(uuid, text, text, date, text, text, text, boolean, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.ensure_clinic_patient(uuid, text, text, date, text, text, text, boolean, text, text, text) TO authenticated;

-- Enhanced create_patient_registration_link supporting responsible_cpf and regenerating single-use active links
CREATE OR REPLACE FUNCTION public.create_patient_registration_link(_patient_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  _patient public.patients%ROWTYPE;
  _link public.patient_registration_links%ROWTYPE;
  _password_prefix text;
  _token text;
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

  -- 1. Pega os 6 primeiros dígitos do CPF próprio ou do responsável
  _password_prefix := left(regexp_replace(coalesce(_patient.cpf, _patient.responsible_cpf, ''), '\D', '', 'g'), 6);

  -- 2. Se ainda não tiver 6 dígitos, usa a data de nascimento (DDMMAA)
  IF length(_password_prefix) < 6 AND _patient.date_of_birth IS NOT NULL THEN
    _password_prefix := to_char(_patient.date_of_birth, 'DDMMYY');
  END IF;

  -- 3. Fallback para PIN seguro de 6 dígitos caso não haja CPF nem nascimento
  IF length(_password_prefix) < 6 THEN
    _password_prefix := lpad((floor(random() * 900000) + 100000)::text, 6, '0');
  END IF;

  _token := replace(gen_random_uuid()::text, '-', '');

  SELECT * INTO _link
  FROM public.patient_registration_links
  WHERE patient_id = _patient_id;

  IF _link.id IS NULL THEN
    INSERT INTO public.patient_registration_links (
      patient_id,
      clinic_id,
      token,
      password_prefix,
      created_by
    )
    VALUES (
      _patient.id,
      _patient.clinic_id,
      _token,
      _password_prefix,
      auth.uid()
    )
    RETURNING * INTO _link;
  ELSE
    UPDATE public.patient_registration_links
    SET
      clinic_id = _patient.clinic_id,
      token = _token,
      password_prefix = _password_prefix,
      completed_at = null,
      updated_at = now()
    WHERE id = _link.id
    RETURNING * INTO _link;
  END IF;

  RETURN jsonb_build_object(
    'token', _link.token,
    'password_prefix', _password_prefix,
    'completed', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_patient_registration_link(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
