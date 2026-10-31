-- ==========================================================================
-- DOMÍNIO: PATIENTS (Gerado automaticamente por npm run schema:index)
-- Fonte SSOT: supabase/schema.sql
-- ==========================================================================

-- [RPC/FUNCTION] authorize_minor_guardian_consent (schema.sql L1007-L1076)
CREATE OR REPLACE FUNCTION "public"."authorize_minor_guardian_consent"("_token" "text", "_password" "text", "_consent_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
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

-- [RPC/FUNCTION] create_patient_registration_link (schema.sql L2479-L2563)
CREATE OR REPLACE FUNCTION "public"."create_patient_registration_link"("_patient_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
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

-- [RPC/FUNCTION] ensure_clinic_patient (schema.sql L3630-L3843)
CREATE OR REPLACE FUNCTION "public"."ensure_clinic_patient"("_clinic_id" "uuid", "_name" "text", "_name_key" "text", "_date_of_birth" "date", "_cpf" "text" DEFAULT NULL::"text", "_phone" "text" DEFAULT NULL::"text", "_email" "text" DEFAULT NULL::"text", "_uses_responsible_cpf" boolean DEFAULT false, "_gender" "text" DEFAULT NULL::"text", "_pronoun" "text" DEFAULT NULL::"text", "_rg" "text" DEFAULT NULL::"text", "_responsible_name" "text" DEFAULT NULL::"text", "_responsible_relationship" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $_$
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
$_$;

-- [RPC/FUNCTION] ensure_default_patient_group (schema.sql L3849-L3880)
CREATE OR REPLACE FUNCTION "public"."ensure_default_patient_group"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.patient_groups (
    user_id,
    patient_id,
    clinic_id,
    name,
    color,
    status,
    is_default
  )
  VALUES (
    NEW.user_id,
    NEW.id,
    NEW.clinic_id,
    'Sintomas não definidos',
    'gray',
    NULL,
    true
  )
  ON CONFLICT (patient_id) WHERE is_default = true
  DO UPDATE SET
    name = 'Sintomas não definidos',
    color = 'gray',
    status = NULL;

  RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] generate_next_patient_code (schema.sql L4160-L4175)
CREATE OR REPLACE FUNCTION "public"."generate_next_patient_code"("_clinic_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  max_num int := 0;
  next_code text;
begin
  select coalesce(max(cast(nullif(regexp_replace(patient_code, '[^0-9]', '', 'g'), '') as integer)), 0)
  into max_num
  from public.patients
  where clinic_id = _clinic_id;

  next_code := 'PAC-' || lpad((max_num + 1)::text, 3, '0');
  return next_code;
end;
$$;

-- [RPC/FUNCTION] get_patient_registration_form (schema.sql L5520-L5600)
CREATE OR REPLACE FUNCTION "public"."get_patient_registration_form"("_token" "text", "_password" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

-- [RPC/FUNCTION] normalize_patient_name_key (schema.sql L9145-L9154)
CREATE OR REPLACE FUNCTION "public"."normalize_patient_name_key"("_value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT lower(regexp_replace(translate(
    coalesce(_value, ''),
    'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
  ), '[^[:alnum:]]+', '', 'g'));
$$;

-- [RPC/FUNCTION] prevent_default_patient_group_delete (schema.sql L9591-L9607)
CREATE OR REPLACE FUNCTION "public"."prevent_default_patient_group_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF (OLD.is_default OR OLD.group_kind IN ('default', 'cancelados'))
    AND EXISTS (
      SELECT 1
      FROM public.patients
      WHERE id = OLD.patient_id
    ) THEN
    RAISE EXCEPTION 'Os grupos reservados do paciente não podem ser excluídos.';
  END IF;

  RETURN OLD;
END;
$$;

-- [RPC/FUNCTION] pseudonymize_patient_name (schema.sql L9613-L9642)
CREATE OR REPLACE FUNCTION "public"."pseudonymize_patient_name"("_name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  _parts text[];
  _part text;
  _initials text := '';
BEGIN
  IF _name IS NULL OR trim(_name) = '' THEN
    RETURN 'Paciente Anônimo';
  END IF;

  _parts := regexp_split_to_array(trim(_name), '\s+');

  FOREACH _part IN ARRAY _parts LOOP
    IF lower(_part) NOT IN ('de', 'da', 'do', 'das', 'dos', 'e', 'd''') AND length(_part) > 0 THEN
      _initials := _initials || upper(substring(_part from 1 for 1)) || '. ';
    END IF;
  END LOOP;

  _initials := trim(_initials);

  IF _initials = '' THEN
    RETURN 'Paciente Anônimo';
  END IF;

  RETURN 'Paciente ' || _initials;
END;
$$;

-- [RPC/FUNCTION] submit_patient_registration_form (schema.sql L11075-L11281)
CREATE OR REPLACE FUNCTION "public"."submit_patient_registration_form"("_token" "text", "_password" "text", "_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;

-- [RPC/FUNCTION] trg_auto_assign_patient_code (schema.sql L11673-L11686)
CREATE OR REPLACE FUNCTION "public"."trg_auto_assign_patient_code"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if new.patient_code is null or trim(new.patient_code) = '' then
    if new.clinic_id is not null then
      new.patient_code := public.generate_next_patient_code(new.clinic_id);
    else
      new.patient_code := 'PAC-' || lpad((floor(extract(epoch from now()))::bigint % 100000)::text, 5, '0');
    end if;
  end if;
  return new;
end;
$$;

-- [RPC/FUNCTION] trg_patient_groups_set_clinic_id (schema.sql L11705-L11715)
CREATE OR REPLACE FUNCTION "public"."trg_patient_groups_set_clinic_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.clinic_id IS NULL THEN
    NEW.clinic_id := public.get_user_clinic_id(COALESCE(auth.uid(), NEW.user_id));
  END IF;
  RETURN NEW;
END;
$$;

-- [RPC/FUNCTION] update_patient_guardian_consent (schema.sql L12573-L12622)
CREATE OR REPLACE FUNCTION "public"."update_patient_guardian_consent"("_patient_id" "uuid", "_consent_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
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

-- [TABLE] patient_clinical_snapshots (schema.sql L14083-L14093)
CREATE TABLE IF NOT EXISTS "public"."patient_clinical_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "change_note" "text",
    "changed_fields" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "change_summary" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "snapshot_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

-- [TABLE] patient_evolution_groups (schema.sql L14099-L14106)
CREATE TABLE IF NOT EXISTS "public"."patient_evolution_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "custom_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [TABLE] patient_file_uploads (schema.sql L14112-L14156)
CREATE TABLE IF NOT EXISTS "public"."patient_file_uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "uploaded_by_user_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'backblaze_b2'::"text" NOT NULL,
    "bucket_name" "text" NOT NULL,
    "object_key" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "content_type" "text" NOT NULL,
    "byte_size" bigint NOT NULL,
    "checksum_sha256" "text",
    "category" "public"."patient_file_upload_category" DEFAULT 'other'::"public"."patient_file_upload_category" NOT NULL,
    "status" "public"."patient_file_upload_status" DEFAULT 'pending'::"public"."patient_file_upload_status" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "upload_expires_at" timestamp with time zone DEFAULT ("now"() + '00:15:00'::interval) NOT NULL,
    "uploaded_at" timestamp with time zone,
    "last_accessed_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "original_byte_size" bigint DEFAULT 0,
    "stored_byte_size" bigint DEFAULT 0,
    "original_content_type" "text",
    "stored_content_type" "text",
    "storage_encoding" "text",
    "compression_profile" "text" DEFAULT 'original'::"text",
    "image_width" integer,
    "image_height" integer,
    "page_count" integer,
    CONSTRAINT "patient_file_uploads_bucket_not_blank" CHECK (("btrim"("bucket_name") <> ''::"text")),
    CONSTRAINT "patient_file_uploads_deleted_status_valid" CHECK (((("status" = 'deleted'::"public"."patient_file_upload_status") AND ("deleted_at" IS NOT NULL)) OR ("status" <> 'deleted'::"public"."patient_file_upload_status"))),
    CONSTRAINT "patient_file_uploads_filename_not_blank" CHECK (("btrim"("original_filename") <> ''::"text")),
    CONSTRAINT "patient_file_uploads_image_dimensions_valid" CHECK (((("image_width" IS NULL) AND ("image_height" IS NULL)) OR ((COALESCE("image_width", 0) > 0) AND (COALESCE("image_height", 0) > 0) AND ("image_width" <= 20000) AND ("image_height" <= 20000)))),
    CONSTRAINT "patient_file_uploads_object_key_not_blank" CHECK (("btrim"("object_key") <> ''::"text")),
    CONSTRAINT "patient_file_uploads_original_size_valid" CHECK ((("original_byte_size" IS NULL) OR ("original_byte_size" >= 0))),
    CONSTRAINT "patient_file_uploads_page_count_valid" CHECK ((("page_count" IS NULL) OR ("page_count" > 0))),
    CONSTRAINT "patient_file_uploads_provider_valid" CHECK (("provider" = 'backblaze_b2'::"text")),
    CONSTRAINT "patient_file_uploads_sha256_valid" CHECK ((("checksum_sha256" IS NULL) OR ("checksum_sha256" ~ '^[a-f0-9]{64}$'::"text"))),
    CONSTRAINT "patient_file_uploads_size_valid" CHECK ((("byte_size" > 0) AND ("byte_size" <= 52428800))),
    CONSTRAINT "patient_file_uploads_storage_encoding_valid" CHECK ((("storage_encoding" IS NULL) OR ("storage_encoding" = ANY (ARRAY['gzip'::"text", 'deflate'::"text"])))),
    CONSTRAINT "patient_file_uploads_stored_size_valid" CHECK ((("stored_byte_size" IS NULL) OR ("stored_byte_size" >= 0))),
    CONSTRAINT "patient_file_uploads_uploaded_status_valid" CHECK (((("status" = 'uploaded'::"public"."patient_file_upload_status") AND ("uploaded_at" IS NOT NULL)) OR ("status" <> 'uploaded'::"public"."patient_file_upload_status")))
);

-- [TABLE] patient_group_templates (schema.sql L14162-L14176)
CREATE TABLE IF NOT EXISTS "public"."patient_group_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "normalized_name" "text" NOT NULL,
    "color" "text" DEFAULT 'lavender'::"text" NOT NULL,
    "status" "text" DEFAULT 'em_andamento'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "clinic_color_slot_id" "uuid",
    CONSTRAINT "patient_group_templates_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "patient_group_templates_normalized_name_not_blank" CHECK (("btrim"("normalized_name") <> ''::"text")),
    CONSTRAINT "patient_group_templates_status_check" CHECK (("status" = ANY (ARRAY['em_andamento'::"text", 'pausado'::"text", 'concluido'::"text", 'cancelado'::"text", 'inativo'::"text"])))
);

-- [TABLE] patient_groups (schema.sql L14182-L14196)
CREATE TABLE IF NOT EXISTS "public"."patient_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT 'lavender'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "clinic_id" "uuid",
    "status" "text" DEFAULT 'em_andamento'::"text",
    "is_default" boolean DEFAULT false NOT NULL,
    "clinic_color_slot_id" "uuid",
    "group_kind" "text" DEFAULT 'custom'::"text" NOT NULL,
    CONSTRAINT "patient_groups_group_kind_check" CHECK (("group_kind" = ANY (ARRAY['custom'::"text", 'default'::"text", 'cancelados'::"text"]))),
    CONSTRAINT "patient_groups_status_check" CHECK ((("status" IS NULL) OR ("status" = ANY (ARRAY['em_andamento'::"text", 'pausado'::"text", 'concluido'::"text", 'cancelado'::"text", 'inativo'::"text"]))))
);

-- [TABLE] patient_health_insurances (schema.sql L14202-L14213)
CREATE TABLE IF NOT EXISTS "public"."patient_health_insurances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "health_insurance_id" "uuid",
    "insurance_name_custom" "text",
    "card_number" "text" NOT NULL,
    "card_valid_until" "date",
    "plan_tier" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [TABLE] patient_payment_plans (schema.sql L14219-L14248)
CREATE TABLE IF NOT EXISTS "public"."patient_payment_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "name" "text" DEFAULT 'Pacote de Sessões'::"text" NOT NULL,
    "total_sessions" integer NOT NULL,
    "used_sessions" integer DEFAULT 0 NOT NULL,
    "total_amount_cents" bigint DEFAULT 0 NOT NULL,
    "session_unit_amount_cents" bigint DEFAULT 0 NOT NULL,
    "payment_method" "text" DEFAULT 'nao_informado'::"text" NOT NULL,
    "payment_installments" integer DEFAULT 1 NOT NULL,
    "payment_status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "payment_status_date" "date",
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_user_id" "uuid",
    "insurance_mode" "text" DEFAULT 'none'::"text",
    "health_insurance_id" "uuid",
    "authorization_number" "text",
    "authorization_valid_until" "date",
    CONSTRAINT "patient_payment_plans_insurance_mode_check" CHECK (("insurance_mode" = ANY (ARRAY['none'::"text", 'direct_billing'::"text", 'reimbursement'::"text"]))),
    CONSTRAINT "patient_payment_plans_payment_installments_check" CHECK (("payment_installments" >= 1)),
    CONSTRAINT "patient_payment_plans_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pendente'::"text", 'pago'::"text", 'parcial'::"text", 'cancelado'::"text"]))),
    CONSTRAINT "patient_payment_plans_session_unit_amount_cents_check" CHECK (("session_unit_amount_cents" >= 0)),
    CONSTRAINT "patient_payment_plans_total_amount_cents_check" CHECK (("total_amount_cents" >= 0)),
    CONSTRAINT "patient_payment_plans_total_sessions_check" CHECK (("total_sessions" > 0)),
    CONSTRAINT "patient_payment_plans_used_sessions_check" CHECK (("used_sessions" >= 0))
);

-- [TABLE] patient_registration_links (schema.sql L14254-L14264)
CREATE TABLE IF NOT EXISTS "public"."patient_registration_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "clinic_id" "uuid",
    "token" "text" DEFAULT "replace"(("gen_random_uuid"())::"text", '-'::"text", ''::"text") NOT NULL,
    "password_prefix" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- [TABLE] patients (schema.sql L14270-L14329)
CREATE TABLE IF NOT EXISTS "public"."patients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "age" integer,
    "phone" "text",
    "cpf" "text",
    "status" "text" DEFAULT 'ativo'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "clinic_id" "uuid",
    "date_of_birth" "date",
    "email" "text",
    "gender" "text",
    "rg" "text",
    "blood_type" "text",
    "pronoun" "text",
    "profession" "text",
    "cep" "text",
    "country" "text" DEFAULT 'Brasil'::"text",
    "state" "text",
    "city" "text",
    "neighborhood" "text",
    "street" "text",
    "address_number" "text",
    "address_complement" "text",
    "chronic_conditions" "text",
    "surgeries" "text",
    "continuous_medications" "text",
    "allergies" "text",
    "clinical_notes" "text",
    "registration_complete" boolean DEFAULT false NOT NULL,
    "clinical_profile" "jsonb",
    "emergency_contact" "jsonb",
    "origin_type" "text" DEFAULT 'outros'::"text" NOT NULL,
    "origin_referrer_name" "text",
    "origin_insurance_provider" "text",
    "origin_insurance_plan" "text",
    "origin_insurance_member_id" "text",
    "origin_other_name" "text",
    "origin_other_description" "text",
    "is_recurring" boolean DEFAULT false NOT NULL,
    "recurring_weekdays" integer[] DEFAULT '{}'::integer[] NOT NULL,
    "recurring_time" "text" DEFAULT '09:00'::"text" NOT NULL,
    "responsible_cpf" "text",
    "uses_responsible_cpf" boolean DEFAULT false NOT NULL,
    "patient_code" "text",
    "responsible_name" "text",
    "responsible_relationship" "text",
    "guardian_consent" "jsonb",
    "deleted_at" timestamp with time zone,
    "deleted_by_user_id" "uuid",
    "version" integer DEFAULT 1 NOT NULL,
    "is_exclusive" boolean DEFAULT false NOT NULL,
    "exclusive_user_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    CONSTRAINT "patients_origin_fields_lengths" CHECK ((("char_length"(COALESCE("origin_referrer_name", ''::"text")) <= 120) AND ("char_length"(COALESCE("origin_insurance_provider", ''::"text")) <= 120) AND ("char_length"(COALESCE("origin_insurance_plan", ''::"text")) <= 120) AND ("char_length"(COALESCE("origin_insurance_member_id", ''::"text")) <= 80) AND ("char_length"(COALESCE("origin_other_name", ''::"text")) <= 120) AND ("char_length"(COALESCE("origin_other_description", ''::"text")) <= 500))),
    CONSTRAINT "patients_origin_type_valid" CHECK (("origin_type" = ANY (ARRAY['particular'::"text", 'indicacao'::"text", 'convenio'::"text", 'filantropia'::"text", 'outros'::"text"]))),
    CONSTRAINT "patients_recurring_time_valid" CHECK (("recurring_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::"text")),
    CONSTRAINT "patients_recurring_weekdays_valid" CHECK ((("cardinality"("recurring_weekdays") <= 7) AND ("recurring_weekdays" <@ ARRAY[0, 1, 2, 3, 4, 5, 6])))
);

-- [POLICY] Authenticated users can insert registration links ON patient_registration_links (schema.sql L16875-L16875)
CREATE POLICY "Authenticated users can insert registration links" ON "public"."patient_registration_links" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));

-- [POLICY] Authenticated users can update their own registration links ON patient_registration_links (schema.sql L16899-L16899)
CREATE POLICY "Authenticated users can update their own registration links" ON "public"."patient_registration_links" FOR UPDATE TO "authenticated" USING (("created_by" = "auth"."uid"()));

-- [POLICY] Authenticated users can view their own registration links ON patient_registration_links (schema.sql L16907-L16907)
CREATE POLICY "Authenticated users can view their own registration links" ON "public"."patient_registration_links" FOR SELECT TO "authenticated" USING (("created_by" = "auth"."uid"()));

-- [POLICY] Super admins manage all evolution groups ON patient_evolution_groups (schema.sql L17089-L17089)
CREATE POLICY "Super admins manage all evolution groups" ON "public"."patient_evolution_groups" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));

-- [POLICY] Super admins manage all patient_groups ON patient_groups (schema.sql L17093-L17093)
CREATE POLICY "Super admins manage all patient_groups" ON "public"."patient_groups" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));

-- [POLICY] Super admins manage all patients ON patients (schema.sql L17097-L17097)
CREATE POLICY "Super admins manage all patients" ON "public"."patients" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));

-- [POLICY] Super admins manage all payment plans ON patient_payment_plans (schema.sql L17101-L17101)
CREATE POLICY "Super admins manage all payment plans" ON "public"."patient_payment_plans" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));

-- [POLICY] Users delete clinic patients ON patients (schema.sql L17159-L17159)
CREATE POLICY "Users delete clinic patients" ON "public"."patients" FOR DELETE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('patients.delete'::"text", "clinic_id") AND ((NOT "is_exclusive") OR "public"."is_clinic_owner"("clinic_id", "auth"."uid"()) OR ("auth"."uid"() = ANY ("exclusive_user_ids")))));

-- [POLICY] Users delete patient file uploads ON patient_file_uploads (schema.sql L17171-L17171)
CREATE POLICY "Users delete patient file uploads" ON "public"."patient_file_uploads" FOR DELETE TO "authenticated" USING ((("clinic_id" IS NOT NULL) AND ("public"."current_user_can"('patients.delete'::"text", "clinic_id") OR "public"."current_user_can"('patients.write'::"text", "clinic_id"))));

-- [POLICY] Users insert patient file uploads ON patient_file_uploads (schema.sql L17191-L17191)
CREATE POLICY "Users insert patient file uploads" ON "public"."patient_file_uploads" FOR INSERT TO "authenticated" WITH CHECK ((("uploaded_by_user_id" = "auth"."uid"()) AND ("clinic_id" IS NOT NULL) AND "public"."current_user_can"('patients.write'::"text", "clinic_id")));

-- [POLICY] Users manage clinic payment plans ON patient_payment_plans (schema.sql L17195-L17195)
CREATE POLICY "Users manage clinic payment plans" ON "public"."patient_payment_plans" TO "authenticated" USING (("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"()))) WITH CHECK (("clinic_id" = "public"."get_user_clinic_id"("auth"."uid"())));

-- [POLICY] Users read clinic evolution groups ON patient_evolution_groups (schema.sql L17223-L17223)
CREATE POLICY "Users read clinic evolution groups" ON "public"."patient_evolution_groups" FOR SELECT TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND "public"."can_read_clinic_data"("clinic_id") AND "public"."current_user_can"('sessions.read'::"text", "clinic_id")));

-- [POLICY] Users read clinic patient_group_templates ON patient_group_templates (schema.sql L17231-L17231)
CREATE POLICY "Users read clinic patient_group_templates" ON "public"."patient_group_templates" FOR SELECT TO "authenticated" USING ((("clinic_id" = "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid"))) AND "public"."current_user_can"('patients.read'::"text", "clinic_id")));

-- [POLICY] Users read clinic patient_groups ON patient_groups (schema.sql L17235-L17235)
CREATE POLICY "Users read clinic patient_groups" ON "public"."patient_groups" FOR SELECT TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND "public"."can_read_clinic_data"("clinic_id") AND ("public"."current_user_can"('patient_groups.read'::"text", "clinic_id") OR "public"."current_user_can"('patients_groups.read'::"text", "clinic_id") OR "public"."current_user_can"('patients.read'::"text", "clinic_id") OR "public"."current_user_can"('sessions.read'::"text", "clinic_id"))));

-- [POLICY] Users read clinic patients ON patients (schema.sql L17239-L17239)
CREATE POLICY "Users read clinic patients" ON "public"."patients" FOR SELECT TO "authenticated" USING ((("deleted_at" IS NULL) AND ("clinic_id" = COALESCE((NULLIF(("auth"."jwt"() ->> 'active_clinic_id'::"text"), ''::"text"))::"uuid", "public"."get_user_clinic_id"("auth"."uid"()))) AND "public"."can_read_clinic_data"("clinic_id") AND "public"."current_user_can"('patients.read'::"text", "clinic_id") AND ((NOT "is_exclusive") OR "public"."is_clinic_owner"("clinic_id", "auth"."uid"()) OR ("auth"."uid"() = ANY ("exclusive_user_ids")))));

-- [POLICY] Users read patient file uploads ON patient_file_uploads (schema.sql L17298-L17298)
CREATE POLICY "Users read patient file uploads" ON "public"."patient_file_uploads" FOR SELECT TO "authenticated" USING ((("clinic_id" IS NOT NULL) AND "public"."current_user_can"('patients.read'::"text", "clinic_id")));

-- [POLICY] Users read patient_clinical_snapshots ON patient_clinical_snapshots (schema.sql L17302-L17302)
CREATE POLICY "Users read patient_clinical_snapshots" ON "public"."patient_clinical_snapshots" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND "public"."current_user_can"('patients.read'::"text", "clinic_id")));

-- [POLICY] Users update clinic patients ON patients (schema.sql L17318-L17318)
CREATE POLICY "Users update clinic patients" ON "public"."patients" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('patients.write'::"text", "clinic_id") AND ((NOT "is_exclusive") OR "public"."is_clinic_owner"("clinic_id", "auth"."uid"()) OR ("auth"."uid"() = ANY ("exclusive_user_ids"))))) WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('patients.write'::"text", "clinic_id") AND ((NOT "is_exclusive") OR "public"."is_clinic_owner"("clinic_id", "auth"."uid"()) OR ("auth"."uid"() = ANY ("exclusive_user_ids")))));

-- [POLICY] Users update patient file uploads ON patient_file_uploads (schema.sql L17342-L17342)
CREATE POLICY "Users update patient file uploads" ON "public"."patient_file_uploads" FOR UPDATE TO "authenticated" USING ((("clinic_id" IS NOT NULL) AND "public"."current_user_can"('patients.write'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" IS NOT NULL) AND "public"."current_user_can"('patients.write'::"text", "clinic_id")));

-- [POLICY] Users write clinic evolution groups ON patient_evolution_groups (schema.sql L17354-L17354)
CREATE POLICY "Users write clinic evolution groups" ON "public"."patient_evolution_groups" TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('sessions.write'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('sessions.write'::"text", "clinic_id")));

-- [POLICY] Users write clinic patient_group_templates ON patient_group_templates (schema.sql L17358-L17358)
CREATE POLICY "Users write clinic patient_group_templates" ON "public"."patient_group_templates" TO "authenticated" USING ((("clinic_id" = "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid"))) AND "public"."current_user_can"('patients.write'::"text", "clinic_id"))) WITH CHECK ((("clinic_id" = "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid"))) AND "public"."current_user_can"('patients.write'::"text", "clinic_id")));

-- [POLICY] Users write clinic patient_groups ON patient_groups (schema.sql L17362-L17362)
CREATE POLICY "Users write clinic patient_groups" ON "public"."patient_groups" TO "authenticated" USING ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND ("public"."current_user_can"('patients.manage_groups'::"text", "clinic_id") OR "public"."current_user_can"('patient_groups.write'::"text", "clinic_id") OR "public"."current_user_can"('sessions.write'::"text", "clinic_id")))) WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND ("public"."current_user_can"('patients.manage_groups'::"text", "clinic_id") OR "public"."current_user_can"('patient_groups.write'::"text", "clinic_id") OR "public"."current_user_can"('sessions.write'::"text", "clinic_id"))));

-- [POLICY] Users write clinic patients ON patients (schema.sql L17366-L17366)
CREATE POLICY "Users write clinic patients" ON "public"."patients" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ( SELECT "public"."get_user_clinic_id"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_clinic_id")) AND (NOT "public"."is_clinic_read_only"("clinic_id")) AND "public"."current_user_can"('patients.write'::"text", "clinic_id")));

-- [POLICY] Users write patient_clinical_snapshots ON patient_clinical_snapshots (schema.sql L17374-L17374)
CREATE POLICY "Users write patient_clinical_snapshots" ON "public"."patient_clinical_snapshots" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND "public"."current_user_can"('patients.write'::"text", "clinic_id")));

-- [POLICY] patient_health_insurances_all ON patient_health_insurances (schema.sql L17512-L17512)
CREATE POLICY "patient_health_insurances_all" ON "public"."patient_health_insurances" USING (("public"."current_user_can"('patients.manage'::"text", "clinic_id") OR "public"."current_user_can"('sessions.create'::"text", "clinic_id"))) WITH CHECK (("public"."current_user_can"('patients.manage'::"text", "clinic_id") OR "public"."current_user_can"('sessions.create'::"text", "clinic_id")));

-- [POLICY] patient_health_insurances_select ON patient_health_insurances (schema.sql L17516-L17516)
CREATE POLICY "patient_health_insurances_select" ON "public"."patient_health_insurances" FOR SELECT USING ("public"."user_has_active_clinic_membership"("auth"."uid"(), "clinic_id"));
