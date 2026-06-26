CREATE TABLE IF NOT EXISTS public.clinic_collaborator_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  email text NOT NULL,
  operational_role public.operational_role_type NOT NULL DEFAULT 'professional',
  job_title text,
  specialty text,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  existing_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_collaborator_invitations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_clinic_collaborator_invitations_clinic_id
ON public.clinic_collaborator_invitations(clinic_id);

CREATE INDEX IF NOT EXISTS idx_clinic_collaborator_invitations_email
ON public.clinic_collaborator_invitations(lower(email));

DROP TRIGGER IF EXISTS update_clinic_collaborator_invitations_updated_at ON public.clinic_collaborator_invitations;
CREATE TRIGGER update_clinic_collaborator_invitations_updated_at
BEFORE UPDATE ON public.clinic_collaborator_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Managers read clinic collaborator invitations" ON public.clinic_collaborator_invitations;
CREATE POLICY "Managers read clinic collaborator invitations" ON public.clinic_collaborator_invitations
FOR SELECT TO authenticated
USING (public.current_user_can('subaccounts.manage', clinic_id));

CREATE OR REPLACE FUNCTION public.invite_clinic_collaborator(
  _clinic_id uuid DEFAULT NULL,
  _email text DEFAULT NULL,
  _operational_role public.operational_role_type DEFAULT 'professional',
  _job_title text DEFAULT NULL,
  _specialty text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _resolved_clinic_id uuid;
  _normalized_email text := lower(trim(coalesce(_email, '')));
  _token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  _token_hash text := md5(_token);
  _existing_user_id uuid;
  _existing_membership_id uuid;
  _invitation_id uuid;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  _resolved_clinic_id := COALESCE(_clinic_id, public.get_user_clinic_id(_requester_id));

  IF _resolved_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clínica não identificada.';
  END IF;

  IF NOT public.current_user_can('subaccounts.manage', _resolved_clinic_id) THEN
    RAISE EXCEPTION 'Você não tem permissão para convidar colaboradores.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clinics
    WHERE clinics.id = _resolved_clinic_id
      AND clinics.subscription_plan = 'clinic'
  ) THEN
    RAISE EXCEPTION 'Convites de colaboradores estão disponíveis apenas no plano clinic.';
  END IF;

  IF _normalized_email = '' OR _normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Informe um e-mail válido para o convite.';
  END IF;

  IF _operational_role = 'owner' THEN
    RAISE EXCEPTION 'O papel owner não pode ser atribuído por convite operacional.';
  END IF;

  SELECT users.id
  INTO _existing_user_id
  FROM auth.users
  WHERE lower(users.email) = _normalized_email
  LIMIT 1;

  UPDATE public.clinic_collaborator_invitations
  SET status = 'cancelled'
  WHERE clinic_id = _resolved_clinic_id
    AND lower(email) = _normalized_email
    AND status = 'pending';

  INSERT INTO public.clinic_collaborator_invitations (
    clinic_id,
    email,
    operational_role,
    job_title,
    specialty,
    token_hash,
    invited_by,
    existing_user_id
  )
  VALUES (
    _resolved_clinic_id,
    _normalized_email,
    _operational_role,
    NULLIF(trim(coalesce(_job_title, '')), ''),
    NULLIF(trim(coalesce(_specialty, '')), ''),
    _token_hash,
    _requester_id,
    _existing_user_id
  )
  RETURNING id INTO _invitation_id;

  IF _existing_user_id IS NOT NULL THEN
    SELECT id
    INTO _existing_membership_id
    FROM public.clinic_memberships
    WHERE clinic_id = _resolved_clinic_id
      AND user_id = _existing_user_id
    LIMIT 1;

    IF _existing_membership_id IS NULL THEN
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
        _resolved_clinic_id,
        _existing_user_id,
        NULL,
        _operational_role,
        'invited',
        false,
        _requester_id
      );
    ELSE
      UPDATE public.clinic_memberships
      SET
        operational_role = _operational_role,
        membership_status = CASE WHEN membership_status = 'active' THEN membership_status ELSE 'invited'::public.membership_status_type END,
        is_active = CASE WHEN membership_status = 'active' THEN true ELSE false END,
        invited_by = COALESCE(invited_by, _requester_id),
        ended_at = NULL
      WHERE id = _existing_membership_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', _invitation_id,
    'email', _normalized_email,
    'existing_user', _existing_user_id IS NOT NULL,
    'token', _token,
    'path', '/convite/clinica/' || _token,
    'expires_at', (now() + interval '14 days')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_clinic_collaborator_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
  _clinic_name text;
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

  RETURN jsonb_build_object(
    'id', _invitation.id,
    'clinic_id', _invitation.clinic_id,
    'clinic_name', COALESCE(_clinic_name, 'Clínica'),
    'email', _invitation.email,
    'operational_role', _invitation.operational_role,
    'job_title', _invitation.job_title,
    'specialty', _invitation.specialty,
    'status', _invitation.status,
    'existing_user', _invitation.existing_user_id IS NOT NULL,
    'expires_at', _invitation.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_clinic_collaborator_invitation(_token text, _full_name text DEFAULT NULL)
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
  WHERE token_hash = md5(coalesce(_token, ''))
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

  IF _user_email IS DISTINCT FROM lower(_invitation.email) THEN
    RAISE EXCEPTION 'Entre com o e-mail convidado para aceitar este acesso.';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id)
  INTO _profile_exists;

  IF _profile_exists THEN
    UPDATE public.profiles
    SET
      clinic_id = COALESCE(clinic_id, _invitation.clinic_id),
      email = COALESCE(email, _invitation.email),
      full_name = COALESCE(NULLIF(trim(full_name), ''), NULLIF(trim(coalesce(_full_name, '')), '')),
      job_title = COALESCE(NULLIF(trim(_invitation.job_title), ''), job_title),
      specialty = COALESCE(NULLIF(trim(_invitation.specialty), ''), specialty)
    WHERE id = _user_id;
  ELSE
    INSERT INTO public.profiles (
      id,
      clinic_id,
      email,
      full_name,
      job_title,
      specialty,
      public_code
    )
    VALUES (
      _user_id,
      _invitation.clinic_id,
      _invitation.email,
      NULLIF(trim(coalesce(_full_name, '')), ''),
      NULLIF(trim(_invitation.job_title), ''),
      NULLIF(trim(_invitation.specialty), ''),
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
    );
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user')
  ON CONFLICT DO NOTHING;

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

GRANT EXECUTE ON FUNCTION public.invite_clinic_collaborator(uuid, text, public.operational_role_type, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_clinic_collaborator_invitation(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_clinic_collaborator_invitation(text, text) TO authenticated;
