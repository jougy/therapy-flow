CREATE OR REPLACE FUNCTION public.list_current_user_clinic_invitations()
RETURNS TABLE (
  invitation_id uuid,
  clinic_id uuid,
  clinic_name text,
  clinic_logo_url text,
  clinic_route_key text,
  operational_role public.operational_role_type,
  job_title text,
  specialty text,
  invited_by_name text,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    invitations.id AS invitation_id,
    invitations.clinic_id,
    clinics.name AS clinic_name,
    clinics.logo_url AS clinic_logo_url,
    clinics.route_key AS clinic_route_key,
    invitations.operational_role,
    invitations.job_title,
    invitations.specialty,
    inviter.full_name AS invited_by_name,
    invitations.expires_at,
    invitations.created_at
  FROM public.clinic_collaborator_invitations AS invitations
  JOIN public.clinics
    ON clinics.id = invitations.clinic_id
  LEFT JOIN public.profiles AS inviter
    ON inviter.id = invitations.invited_by
  JOIN auth.users
    ON users.id = auth.uid()
  WHERE invitations.status = 'pending'
    AND invitations.expires_at >= now()
    AND lower(invitations.email) = lower(users.email)
  ORDER BY invitations.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.accept_current_user_clinic_invitation(_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _profile_exists boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para aceitar o convite.';
  END IF;

  SELECT lower(email)
  INTO _user_email
  FROM auth.users
  WHERE id = _user_id;

  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE id = _invitation_id
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF _invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Este convite não está mais pendente.';
  END IF;

  IF _invitation.expires_at < now() THEN
    UPDATE public.clinic_collaborator_invitations
    SET status = 'expired'
    WHERE id = _invitation.id;
    RAISE EXCEPTION 'Este convite expirou.';
  END IF;

  IF lower(_invitation.email) IS DISTINCT FROM _user_email THEN
    RAISE EXCEPTION 'Este convite pertence a outro e-mail.';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id)
  INTO _profile_exists;

  IF _profile_exists THEN
    UPDATE public.profiles
    SET
      clinic_id = COALESCE(clinic_id, _invitation.clinic_id),
      email = COALESCE(email, _invitation.email),
      job_title = COALESCE(NULLIF(trim(_invitation.job_title), ''), job_title),
      specialty = COALESCE(NULLIF(trim(_invitation.specialty), ''), specialty)
    WHERE id = _user_id;
  ELSE
    INSERT INTO public.profiles (
      id,
      clinic_id,
      email,
      job_title,
      specialty,
      public_code
    )
    VALUES (
      _user_id,
      _invitation.clinic_id,
      _invitation.email,
      NULLIF(trim(_invitation.job_title), ''),
      NULLIF(trim(_invitation.specialty), ''),
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
    );
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_security_settings (user_id, clinic_id)
  VALUES (_user_id, _invitation.clinic_id)
  ON CONFLICT (user_id) DO UPDATE
  SET clinic_id = COALESCE(public.user_security_settings.clinic_id, EXCLUDED.clinic_id);

  INSERT INTO public.clinic_memberships (
    clinic_id,
    user_id,
    account_role,
    operational_role,
    membership_status,
    is_active,
    invited_by
  )
  VALUES (
    _invitation.clinic_id,
    _user_id,
    NULL,
    _invitation.operational_role,
    'active',
    true,
    _invitation.invited_by
  )
  ON CONFLICT (clinic_id, user_id)
  DO UPDATE SET
    operational_role = EXCLUDED.operational_role,
    membership_status = 'active',
    is_active = true,
    ended_at = NULL,
    invited_by = COALESCE(public.clinic_memberships.invited_by, EXCLUDED.invited_by);

  UPDATE public.clinic_collaborator_invitations
  SET
    status = 'accepted',
    accepted_by = _user_id,
    accepted_at = now()
  WHERE id = _invitation.id;

  RETURN jsonb_build_object(
    'clinic_id', _invitation.clinic_id,
    'status', 'accepted'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_current_user_clinic_invitation(_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para recusar o convite.';
  END IF;

  SELECT lower(email)
  INTO _user_email
  FROM auth.users
  WHERE id = _user_id;

  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE id = _invitation_id
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF lower(_invitation.email) IS DISTINCT FROM _user_email THEN
    RAISE EXCEPTION 'Este convite pertence a outro e-mail.';
  END IF;

  UPDATE public.clinic_collaborator_invitations
  SET status = 'cancelled'
  WHERE id = _invitation.id
    AND status = 'pending';

  UPDATE public.clinic_memberships
  SET
    membership_status = 'inactive',
    is_active = false,
    ended_at = now()
  WHERE clinic_id = _invitation.clinic_id
    AND user_id = _user_id
    AND membership_status = 'invited';

  RETURN jsonb_build_object(
    'clinic_id', _invitation.clinic_id,
    'status', 'declined'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_current_user_clinic_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_current_user_clinic_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_current_user_clinic_invitation(uuid) TO authenticated;
