ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS responsible_cpf text,
ADD COLUMN IF NOT EXISTS uses_responsible_cpf boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_patients_clinic_name_birth_lookup
ON public.patients (clinic_id, public.normalize_patient_name_key(name), date_of_birth)
WHERE clinic_id IS NOT NULL
  AND name IS NOT NULL
  AND btrim(name) <> ''
  AND date_of_birth IS NOT NULL;

DROP FUNCTION IF EXISTS public.ensure_clinic_patient(uuid, text, text, date, text, text, text);

CREATE OR REPLACE FUNCTION public.ensure_clinic_patient(
  _clinic_id uuid,
  _name text,
  _name_key text,
  _date_of_birth date,
  _cpf text,
  _phone text,
  _email text,
  _uses_responsible_cpf boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _actor uuid := auth.uid();
  _patient public.patients%ROWTYPE;
  _clean_name text := left(trim(coalesce(_name, '')), 160);
  _clean_name_key text := coalesce(nullif(trim(_name_key), ''), public.normalize_patient_name_key(_clean_name));
  _clean_cpf text := left(regexp_replace(coalesce(_cpf, ''), '\D', '', 'g'), 11);
  _patient_cpf text := null;
  _responsible_cpf text := null;
  _phone_digits text := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
  _clean_phone text := null;
  _clean_email text := nullif(lower(left(trim(coalesce(_email, '')), 254)), '');
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

  IF _clean_cpf !~ '^\d{11}$' THEN
    RAISE EXCEPTION 'CPF inválido';
  END IF;

  IF coalesce(_uses_responsible_cpf, false) THEN
    _responsible_cpf := _clean_cpf;
  ELSE
    _patient_cpf := _clean_cpf;
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
      updated_at = now()
    WHERE id = _patient.id
    RETURNING * INTO _patient;

    RETURN jsonb_build_object(
      'id', _patient.id,
      'status', 'existing',
      'matched_by', _matched_by
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
    'ativo',
    false
  )
  RETURNING * INTO _patient;

  RETURN jsonb_build_object(
    'id', _patient.id,
    'status', 'created',
    'matched_by', 'created'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_clinic_patient(uuid, text, text, date, text, text, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.ensure_clinic_patient(uuid, text, text, date, text, text, text, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
