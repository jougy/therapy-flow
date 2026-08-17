-- Migration: Fix clinic collaborator invitation existing user dynamic check
-- Date: 2026-08-17

CREATE OR REPLACE FUNCTION public.get_clinic_collaborator_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _clinic_name text;
  _is_existing_user boolean := false;
BEGIN
  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE token_hash = md5(coalesce(_token, ''))
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF _invitation.status = 'pending' AND _invitation.expires_at < now() THEN
    UPDATE public.clinic_collaborator_invitations
    SET status = 'expired'
    WHERE id = _invitation.id;

    _invitation.status := 'expired';
  END IF;

  SELECT name
  INTO _clinic_name
  FROM public.clinics
  WHERE id = _invitation.clinic_id;

  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(users.email) = lower(_invitation.email)
  ) INTO _is_existing_user;

  RETURN jsonb_build_object(
    'id', _invitation.id,
    'clinic_id', _invitation.clinic_id,
    'clinic_name', COALESCE(_clinic_name, 'Clínica'),
    'email', _invitation.email,
    'operational_role', _invitation.operational_role,
    'job_title', _invitation.job_title,
    'specialty', _invitation.specialty,
    'status', _invitation.status,
    'existing_user', (_invitation.existing_user_id IS NOT NULL OR _is_existing_user),
    'expires_at', _invitation.expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_clinic_collaborator_invitation(text) TO anon, authenticated;
