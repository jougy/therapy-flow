CREATE OR REPLACE FUNCTION public.verify_password_recovery_identity(_email text, _cpf text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _normalized_email text := lower(trim(coalesce(_email, '')));
  _normalized_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  _matches boolean := false;
BEGIN
  IF _normalized_email = '' OR _normalized_cpf !~ '^\d{11}$' THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    JOIN public.profiles
      ON profiles.id = users.id
    WHERE lower(users.email) = _normalized_email
      AND regexp_replace(coalesce(profiles.cpf, ''), '\D', '', 'g') = _normalized_cpf
  )
  INTO _matches;

  RETURN COALESCE(_matches, false);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_password_recovery_identity(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_password_recovery_identity(text, text) TO anon, authenticated;
