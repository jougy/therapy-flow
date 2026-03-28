CREATE TABLE IF NOT EXISTS public.team_development_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  development_status text NOT NULL DEFAULT 'onboarding'
    CHECK (development_status IN ('onboarding', 'em_evolucao', 'consolidado', 'precisa_supervisao', 'em_pausa')),
  internal_level text NOT NULL DEFAULT 'junior'
    CHECK (internal_level IN ('estagiario', 'junior', 'pleno', 'senior', 'referencia')),
  goals text,
  review_notes text,
  last_review_at date,
  next_review_at date,
  onboarding_flow_read boolean NOT NULL DEFAULT false,
  onboarding_initial_training boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, user_id)
);

ALTER TABLE public.team_development_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team development readable by clinic admins or self" ON public.team_development_profiles;
CREATE POLICY "team development readable by clinic admins or self"
ON public.team_development_profiles
FOR SELECT
USING (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND (
    public.current_user_can('subaccounts_analytics.read', clinic_id)
    OR user_id = auth.uid()
  )
);

DROP TRIGGER IF EXISTS update_team_development_profiles_updated_at ON public.team_development_profiles;
CREATE TRIGGER update_team_development_profiles_updated_at
BEFORE UPDATE ON public.team_development_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.ensure_team_development_profile(_clinic_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _profile_id uuid;
  _last_seen_at timestamptz;
  _operational_role public.operational_role_type;
BEGIN
  SELECT id
  INTO _profile_id
  FROM public.team_development_profiles
  WHERE clinic_id = _clinic_id
    AND user_id = _user_id;

  IF _profile_id IS NOT NULL THEN
    RETURN _profile_id;
  END IF;

  SELECT last_seen_at
  INTO _last_seen_at
  FROM public.profiles
  WHERE id = _user_id;

  SELECT operational_role
  INTO _operational_role
  FROM public.clinic_memberships
  WHERE clinic_id = _clinic_id
    AND user_id = _user_id
  ORDER BY created_at ASC
  LIMIT 1;

  INSERT INTO public.team_development_profiles (
    clinic_id,
    user_id,
    development_status,
    internal_level
  )
  VALUES (
    _clinic_id,
    _user_id,
    CASE
      WHEN _last_seen_at IS NULL THEN 'onboarding'
      ELSE 'em_evolucao'
    END,
    CASE
      WHEN _operational_role IN ('owner', 'admin') THEN 'senior'
      ELSE 'junior'
    END
  )
  RETURNING id INTO _profile_id;

  RETURN _profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_team_development_profile_from_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_team_development_profile(NEW.clinic_id, NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_team_development_profile_from_membership ON public.clinic_memberships;
CREATE TRIGGER ensure_team_development_profile_from_membership
AFTER INSERT ON public.clinic_memberships
FOR EACH ROW
EXECUTE FUNCTION public.ensure_team_development_profile_from_membership();

INSERT INTO public.team_development_profiles (
  clinic_id,
  user_id,
  development_status,
  internal_level
)
SELECT
  memberships.clinic_id,
  memberships.user_id,
  CASE
    WHEN profiles.last_seen_at IS NULL THEN 'onboarding'
    ELSE 'em_evolucao'
  END,
  CASE
    WHEN memberships.operational_role IN ('owner', 'admin') THEN 'senior'
    ELSE 'junior'
  END
FROM public.clinic_memberships AS memberships
LEFT JOIN public.profiles AS profiles
  ON profiles.id = memberships.user_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.team_development_profiles AS development
  WHERE development.clinic_id = memberships.clinic_id
    AND development.user_id = memberships.user_id
);

CREATE OR REPLACE FUNCTION public.update_team_development_profile(
  _user_id uuid,
  _development_status text DEFAULT NULL,
  _internal_level text DEFAULT NULL,
  _goals text DEFAULT NULL,
  _review_notes text DEFAULT NULL,
  _last_review_at date DEFAULT NULL,
  _next_review_at date DEFAULT NULL,
  _onboarding_flow_read boolean DEFAULT NULL,
  _onboarding_initial_training boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _clinic_id uuid := public.get_user_clinic_id(_requester_id);
  _target_profile public.profiles%ROWTYPE;
  _development_id uuid;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF _clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clinica nao encontrada para o usuario atual.';
  END IF;

  IF NOT public.current_user_can('subaccounts_analytics.read', _clinic_id) THEN
    RAISE EXCEPTION 'Sem permissao para editar desenvolvimento da equipe nesta clinica.';
  END IF;

  SELECT *
  INTO _target_profile
  FROM public.profiles
  WHERE id = _user_id
    AND clinic_id = _clinic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador nao encontrado nesta clinica.';
  END IF;

  IF _development_status IS NOT NULL
    AND _development_status NOT IN ('onboarding', 'em_evolucao', 'consolidado', 'precisa_supervisao', 'em_pausa') THEN
    RAISE EXCEPTION 'Status de desenvolvimento invalido.';
  END IF;

  IF _internal_level IS NOT NULL
    AND _internal_level NOT IN ('estagiario', 'junior', 'pleno', 'senior', 'referencia') THEN
    RAISE EXCEPTION 'Nivel interno invalido.';
  END IF;

  IF _next_review_at IS NOT NULL AND _last_review_at IS NOT NULL AND _next_review_at < _last_review_at THEN
    RAISE EXCEPTION 'A proxima revisao nao pode ficar antes da ultima revisao.';
  END IF;

  _development_id := public.ensure_team_development_profile(_clinic_id, _user_id);

  UPDATE public.team_development_profiles
  SET
    development_status = COALESCE(_development_status, development_status),
    internal_level = COALESCE(_internal_level, internal_level),
    goals = CASE WHEN _goals IS NULL THEN goals ELSE NULLIF(trim(_goals), '') END,
    review_notes = CASE WHEN _review_notes IS NULL THEN review_notes ELSE NULLIF(trim(_review_notes), '') END,
    last_review_at = COALESCE(_last_review_at, last_review_at),
    next_review_at = COALESCE(_next_review_at, next_review_at),
    onboarding_flow_read = COALESCE(_onboarding_flow_read, onboarding_flow_read),
    onboarding_initial_training = COALESCE(_onboarding_initial_training, onboarding_initial_training)
  WHERE id = _development_id;

  RETURN jsonb_build_object(
    'clinic_id', _clinic_id,
    'development_profile_id', _development_id,
    'user_id', _user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_team_development_profile(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_team_development_profile(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.update_team_development_profile(uuid, text, text, text, text, date, date, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_team_development_profile(uuid, text, text, text, text, date, date, boolean, boolean) TO authenticated;
