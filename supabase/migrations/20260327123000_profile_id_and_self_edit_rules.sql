CREATE OR REPLACE FUNCTION public.generate_profile_public_code_for_clinic(_clinic_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _next_number integer;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(public_code, '\D', '', 'g'), '')::integer), 0) + 1
  INTO _next_number
  FROM public.profiles
  WHERE clinic_id IS NOT DISTINCT FROM _clinic_id;

  RETURN lpad(_next_number::text, 3, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_profile_public_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NULLIF(trim(COALESCE(NEW.public_code, '')), '') IS NULL THEN
    NEW.public_code := public.generate_profile_public_code_for_clinic(NEW.clinic_id);
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.profiles
  ALTER COLUMN public_code DROP DEFAULT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_public_code_key;

UPDATE public.profiles AS profiles
SET public_code = numbered.public_code
FROM (
  SELECT
    id,
    lpad(row_number() OVER (PARTITION BY clinic_id ORDER BY created_at, id)::text, 3, '0') AS public_code
  FROM public.profiles
) AS numbered
WHERE numbered.id = profiles.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_clinic_id_public_code_key'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_clinic_id_public_code_key UNIQUE (clinic_id, public_code);
  END IF;
END
$$;

DROP TRIGGER IF EXISTS assign_profile_public_code_on_insert ON public.profiles;
CREATE TRIGGER assign_profile_public_code_on_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_profile_public_code();

CREATE OR REPLACE FUNCTION public.update_current_profile(
  _full_name text DEFAULT NULL,
  _social_name text DEFAULT NULL,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _birth_date date DEFAULT NULL,
  _cpf text DEFAULT NULL,
  _professional_license text DEFAULT NULL,
  _specialty text DEFAULT NULL,
  _job_title text DEFAULT NULL,
  _bio text DEFAULT NULL,
  _working_hours text DEFAULT NULL,
  _address jsonb DEFAULT NULL,
  _new_password text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _normalized_email text;
  _normalized_cpf text;
  _current_profile public.profiles%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  SELECT *
  INTO _current_profile
  FROM public.profiles
  WHERE id = _user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil nao encontrado.';
  END IF;

  IF _full_name IS NOT NULL AND NULLIF(trim(_full_name), '') IS NULL THEN
    RAISE EXCEPTION 'O nome nao pode ficar vazio.';
  END IF;

  _normalized_email := NULLIF(lower(trim(coalesce(_email, ''))), '');

  IF _normalized_email IS NOT NULL AND EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = _normalized_email
      AND id <> _user_id
  ) THEN
    RAISE EXCEPTION 'Ja existe uma conta cadastrada com este e-mail.';
  END IF;

  IF NULLIF(coalesce(_new_password, ''), '') IS NOT NULL AND length(_new_password) < 6 THEN
    RAISE EXCEPTION 'A nova senha precisa ter pelo menos 6 caracteres.';
  END IF;

  _normalized_cpf := CASE
    WHEN _cpf IS NULL THEN NULL
    ELSE NULLIF(regexp_replace(_cpf, '\D', '', 'g'), '')
  END;

  IF _job_title IS NOT NULL AND NULLIF(trim(_job_title), '') IS DISTINCT FROM _current_profile.job_title THEN
    RAISE EXCEPTION 'Cargo e gerenciado apenas pela administracao da clinica.';
  END IF;

  IF _specialty IS NOT NULL AND NULLIF(trim(_specialty), '') IS DISTINCT FROM _current_profile.specialty THEN
    RAISE EXCEPTION 'Especialidade e gerenciada apenas pela administracao da clinica.';
  END IF;

  IF _working_hours IS NOT NULL AND NULLIF(trim(_working_hours), '') IS DISTINCT FROM _current_profile.working_hours THEN
    RAISE EXCEPTION 'Horario de trabalho e gerenciado apenas pela administracao da clinica.';
  END IF;

  IF _bio IS NOT NULL AND NULLIF(trim(_bio), '') IS DISTINCT FROM _current_profile.bio THEN
    RAISE EXCEPTION 'Bio nao esta disponivel para autoedicao.';
  END IF;

  IF _full_name IS NOT NULL
    AND NULLIF(trim(_current_profile.full_name), '') IS NOT NULL
    AND NULLIF(trim(_full_name), '') IS DISTINCT FROM _current_profile.full_name THEN
    RAISE EXCEPTION 'Nome completo so pode ser preenchido uma vez; depois disso, apenas a administracao pode alterar.';
  END IF;

  IF _social_name IS NOT NULL
    AND NULLIF(trim(_current_profile.social_name), '') IS NOT NULL
    AND NULLIF(trim(_social_name), '') IS DISTINCT FROM _current_profile.social_name THEN
    RAISE EXCEPTION 'Nome social so pode ser preenchido uma vez; depois disso, apenas a administracao pode alterar.';
  END IF;

  IF _phone IS NOT NULL
    AND NULLIF(trim(_current_profile.phone), '') IS NOT NULL
    AND NULLIF(trim(_phone), '') IS DISTINCT FROM _current_profile.phone THEN
    RAISE EXCEPTION 'Telefone so pode ser preenchido uma vez; depois disso, apenas a administracao pode alterar.';
  END IF;

  IF _birth_date IS NOT NULL
    AND _current_profile.birth_date IS NOT NULL
    AND _birth_date IS DISTINCT FROM _current_profile.birth_date THEN
    RAISE EXCEPTION 'Data de nascimento so pode ser preenchida uma vez; depois disso, apenas a administracao pode alterar.';
  END IF;

  IF _normalized_cpf IS NOT NULL
    AND NULLIF(_current_profile.cpf, '') IS NOT NULL
    AND _normalized_cpf IS DISTINCT FROM _current_profile.cpf THEN
    RAISE EXCEPTION 'CPF so pode ser preenchido uma vez; depois disso, apenas a administracao pode alterar.';
  END IF;

  IF _professional_license IS NOT NULL
    AND NULLIF(trim(_current_profile.professional_license), '') IS NOT NULL
    AND NULLIF(trim(_professional_license), '') IS DISTINCT FROM _current_profile.professional_license THEN
    RAISE EXCEPTION 'Conselho regional so pode ser preenchido uma vez; depois disso, apenas a administracao pode alterar.';
  END IF;

  IF _address IS NOT NULL
    AND COALESCE(_current_profile.address, '{}'::jsonb) <> '{}'::jsonb
    AND _address IS DISTINCT FROM _current_profile.address THEN
    RAISE EXCEPTION 'Endereco so pode ser preenchido uma vez; depois disso, apenas a administracao pode alterar.';
  END IF;

  UPDATE auth.users
  SET
    email = COALESCE(_normalized_email, email),
    encrypted_password = CASE
      WHEN NULLIF(coalesce(_new_password, ''), '') IS NOT NULL THEN extensions.crypt(_new_password, extensions.gen_salt('bf'))
      ELSE encrypted_password
    END,
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || CASE WHEN _full_name IS NOT NULL THEN jsonb_build_object('full_name', trim(_full_name)) ELSE '{}'::jsonb END
      || CASE WHEN _social_name IS NOT NULL THEN jsonb_build_object('social_name', NULLIF(trim(_social_name), '')) ELSE '{}'::jsonb END,
    updated_at = now()
  WHERE id = _user_id;

  IF _normalized_email IS NOT NULL THEN
    UPDATE auth.identities
    SET
      provider_id = _normalized_email,
      identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', _normalized_email),
      updated_at = now()
    WHERE user_id = _user_id
      AND provider = 'email';
  END IF;

  UPDATE public.profiles
  SET
    full_name = COALESCE(NULLIF(trim(_full_name), ''), full_name),
    social_name = CASE WHEN _social_name IS NULL THEN social_name ELSE NULLIF(trim(_social_name), '') END,
    email = COALESCE(_normalized_email, email),
    phone = CASE WHEN _phone IS NULL THEN phone ELSE NULLIF(trim(_phone), '') END,
    birth_date = COALESCE(_birth_date, birth_date),
    cpf = COALESCE(_normalized_cpf, cpf),
    professional_license = CASE WHEN _professional_license IS NULL THEN professional_license ELSE NULLIF(trim(_professional_license), '') END,
    address = COALESCE(_address, address),
    updated_at = now()
  WHERE id = _user_id;

  RETURN jsonb_build_object('user_id', _user_id);
END;
$$;
