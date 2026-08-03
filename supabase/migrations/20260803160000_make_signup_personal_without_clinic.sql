-- Make signup personal without automatic clinic creation

-- 1. Allow profiles.clinic_id to be NULL for personal user accounts before joining/creating a clinic
ALTER TABLE public.profiles
  ALTER COLUMN clinic_id DROP NOT NULL;

-- 2. Create RPC handle_personal_signup to register user profile without initial clinic
CREATE OR REPLACE FUNCTION public.handle_personal_signup(
  _user_id uuid,
  _email text,
  _full_name text DEFAULT NULL,
  _cpf text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _birth_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _normalized_cpf text;
BEGIN
  _normalized_cpf := NULLIF(regexp_replace(COALESCE(_cpf, ''), '\D', '', 'g'), '');

  INSERT INTO public.profiles (
    id,
    clinic_id,
    email,
    full_name,
    cpf,
    phone,
    birth_date
  )
  VALUES (
    _user_id,
    NULL,
    _email,
    _full_name,
    _normalized_cpf,
    _phone,
    _birth_date
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      cpf = COALESCE(EXCLUDED.cpf, profiles.cpf),
      phone = COALESCE(EXCLUDED.phone, profiles.phone),
      birth_date = COALESCE(EXCLUDED.birth_date, profiles.birth_date);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object(
    'user_id', _user_id,
    'has_clinic', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.handle_personal_signup(uuid, text, text, text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_personal_signup(uuid, text, text, text, text, date) TO authenticated, anon;
