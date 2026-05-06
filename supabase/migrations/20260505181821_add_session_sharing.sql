CREATE TABLE IF NOT EXISTS public.session_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  shared_with_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'read',
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT session_shares_access_level_check CHECK (access_level = 'read')
);

CREATE INDEX IF NOT EXISTS idx_session_shares_session_id
ON public.session_shares(session_id);

CREATE INDEX IF NOT EXISTS idx_session_shares_clinic_id
ON public.session_shares(clinic_id);

CREATE INDEX IF NOT EXISTS idx_session_shares_shared_with_user_id
ON public.session_shares(shared_with_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_shares_active_unique
ON public.session_shares(session_id, shared_with_user_id)
WHERE revoked_at IS NULL;

ALTER TABLE public.session_shares ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_user_is_clinic_manager(_clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_can('subaccounts_roles.manage', _clinic_id);
$$;

CREATE OR REPLACE FUNCTION public.is_active_clinic_member(_clinic_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_memberships
    WHERE clinic_memberships.clinic_id = _clinic_id
      AND clinic_memberships.user_id = _user_id
      AND clinic_memberships.is_active = true
      AND clinic_memberships.membership_status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_session(_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _session public.sessions%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT *
  INTO _session
  FROM public.sessions
  WHERE id = _session_id;

  IF _session.id IS NULL OR _session.clinic_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.current_user_can('sessions.read', _session.clinic_id) THEN
    RETURN false;
  END IF;

  IF public.current_user_is_clinic_manager(_session.clinic_id) THEN
    RETURN true;
  END IF;

  IF _session.user_id = _user_id OR _session.provider_id = _user_id THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.session_shares
    WHERE session_shares.session_id = _session.id
      AND session_shares.clinic_id = _session.clinic_id
      AND session_shares.shared_with_user_id = _user_id
      AND session_shares.revoked_at IS NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_share_session(_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _session public.sessions%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT *
  INTO _session
  FROM public.sessions
  WHERE id = _session_id;

  IF _session.id IS NULL OR _session.clinic_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.current_user_can('sessions.read', _session.clinic_id) THEN
    RETURN false;
  END IF;

  RETURN public.current_user_is_clinic_manager(_session.clinic_id)
    OR _session.user_id = _user_id
    OR _session.provider_id = _user_id;
END;
$$;

DROP POLICY IF EXISTS "Users read session shares they can access" ON public.session_shares;
CREATE POLICY "Users read session shares they can access" ON public.session_shares
FOR SELECT TO authenticated
USING (
  clinic_id = public.get_user_clinic_id((SELECT auth.uid()))
  AND public.can_read_session(session_id)
);

DROP POLICY IF EXISTS "Users insert allowed session shares" ON public.session_shares;
CREATE POLICY "Users insert allowed session shares" ON public.session_shares
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.get_user_clinic_id((SELECT auth.uid()))
  AND shared_by_user_id = (SELECT auth.uid())
  AND revoked_at IS NULL
  AND public.can_share_session(session_id)
  AND public.is_active_clinic_member(clinic_id, shared_with_user_id)
);

DROP POLICY IF EXISTS "Users revoke allowed session shares" ON public.session_shares;

CREATE OR REPLACE FUNCTION public.get_clinic_share_collaborators(_clinic_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH resolved AS (
    SELECT COALESCE(_clinic_id, public.get_user_clinic_id(auth.uid())) AS clinic_id
  )
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id', profiles.id,
        'full_name', profiles.full_name,
        'email', profiles.email,
        'job_title', profiles.job_title,
        'operational_role', clinic_memberships.operational_role
      )
      ORDER BY profiles.full_name NULLS LAST, profiles.email
    ),
    '[]'::json
  )
  FROM resolved
  JOIN public.clinic_memberships
    ON clinic_memberships.clinic_id = resolved.clinic_id
    AND clinic_memberships.is_active = true
    AND clinic_memberships.membership_status = 'active'
  JOIN public.profiles
    ON profiles.id = clinic_memberships.user_id
  WHERE public.current_user_can('sessions.read', resolved.clinic_id);
$$;

CREATE OR REPLACE FUNCTION public.get_session_share_recipients(_session_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id', session_shares.shared_with_user_id,
        'full_name', profiles.full_name,
        'email', profiles.email,
        'job_title', profiles.job_title,
        'operational_role', clinic_memberships.operational_role,
        'shared_by_user_id', session_shares.shared_by_user_id,
        'created_at', session_shares.created_at
      )
      ORDER BY profiles.full_name NULLS LAST, profiles.email
    ),
    '[]'::json
  )
  FROM public.session_shares
  JOIN public.profiles
    ON profiles.id = session_shares.shared_with_user_id
  LEFT JOIN public.clinic_memberships
    ON clinic_memberships.clinic_id = session_shares.clinic_id
    AND clinic_memberships.user_id = session_shares.shared_with_user_id
  WHERE session_shares.session_id = _session_id
    AND session_shares.revoked_at IS NULL
    AND public.can_read_session(_session_id);
$$;

CREATE OR REPLACE FUNCTION public.get_session_share_summary(_session_ids uuid[])
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'session_id', summaries.session_id,
        'share_count', summaries.share_count,
        'recipients', summaries.recipients
      )
      ORDER BY summaries.session_id
    ),
    '[]'::json
  )
  FROM (
    SELECT
      session_shares.session_id,
      count(*)::int AS share_count,
      json_agg(
        json_build_object(
          'id', session_shares.shared_with_user_id,
          'full_name', profiles.full_name,
          'email', profiles.email,
          'job_title', profiles.job_title,
          'created_at', session_shares.created_at
        )
        ORDER BY profiles.full_name NULLS LAST, profiles.email
      ) AS recipients
    FROM public.session_shares
    JOIN public.profiles
      ON profiles.id = session_shares.shared_with_user_id
    WHERE session_shares.session_id = ANY(_session_ids)
      AND session_shares.revoked_at IS NULL
      AND public.can_read_session(session_shares.session_id)
    GROUP BY session_shares.session_id
  ) AS summaries;
$$;

CREATE OR REPLACE FUNCTION public.share_sessions_with_collaborators(_session_ids uuid[], _user_ids uuid[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _session_id uuid;
  _target_user_id uuid;
  _session public.sessions%ROWTYPE;
  _inserted_count integer := 0;
  _row_count integer := 0;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF COALESCE(array_length(_session_ids, 1), 0) = 0 OR COALESCE(array_length(_user_ids, 1), 0) = 0 THEN
    RETURN json_build_object('shared_count', 0);
  END IF;

  FOR _session_id IN
    SELECT DISTINCT item
    FROM unnest(_session_ids) AS item
    WHERE item IS NOT NULL
  LOOP
    SELECT *
    INTO _session
    FROM public.sessions
    WHERE id = _session_id;

    IF _session.id IS NULL OR _session.clinic_id IS NULL THEN
      RAISE EXCEPTION 'Ficha de atendimento não encontrada';
    END IF;

    IF NOT public.can_share_session(_session.id) THEN
      RAISE EXCEPTION 'Sem permissão para compartilhar uma ou mais fichas';
    END IF;

    FOR _target_user_id IN
      SELECT DISTINCT item
      FROM unnest(_user_ids) AS item
      WHERE item IS NOT NULL
    LOOP
      IF _target_user_id = _session.user_id OR _target_user_id = _session.provider_id THEN
        CONTINUE;
      END IF;

      IF NOT public.is_active_clinic_member(_session.clinic_id, _target_user_id) THEN
        RAISE EXCEPTION 'Um dos colaboradores selecionados não pertence à clínica';
      END IF;

      INSERT INTO public.session_shares (
        clinic_id,
        session_id,
        shared_with_user_id,
        shared_by_user_id,
        access_level
      )
      VALUES (
        _session.clinic_id,
        _session.id,
        _target_user_id,
        _actor_id,
        'read'
      )
      ON CONFLICT (session_id, shared_with_user_id) WHERE revoked_at IS NULL DO NOTHING;

      GET DIAGNOSTICS _row_count = ROW_COUNT;
      _inserted_count := _inserted_count + _row_count;
    END LOOP;
  END LOOP;

  RETURN json_build_object('shared_count', _inserted_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_session_share(_session_id uuid, _user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _updated_count integer := 0;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.can_share_session(_session_id) THEN
    RAISE EXCEPTION 'Sem permissão para remover compartilhamento';
  END IF;

  UPDATE public.session_shares
  SET
    revoked_at = now(),
    revoked_by_user_id = _actor_id
  WHERE session_id = _session_id
    AND shared_with_user_id = _user_id
    AND revoked_at IS NULL;

  GET DIAGNOSTICS _updated_count = ROW_COUNT;

  RETURN json_build_object('revoked_count', _updated_count);
END;
$$;

DROP POLICY IF EXISTS "Users read clinic sessions" ON public.sessions;
CREATE POLICY "Users read clinic sessions" ON public.sessions
FOR SELECT TO authenticated
USING (
  public.can_read_session(id)
);

DROP POLICY IF EXISTS "Users update clinic sessions" ON public.sessions;
CREATE POLICY "Users update clinic sessions" ON public.sessions
FOR UPDATE TO authenticated
USING (
  clinic_id = public.get_user_clinic_id((SELECT auth.uid()))
  AND public.current_user_can('sessions.write', clinic_id)
  AND (
    public.current_user_is_clinic_manager(clinic_id)
    OR user_id = (SELECT auth.uid())
    OR provider_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  clinic_id = public.get_user_clinic_id((SELECT auth.uid()))
  AND public.current_user_can('sessions.write', clinic_id)
  AND (
    public.current_user_is_clinic_manager(clinic_id)
    OR user_id = (SELECT auth.uid())
    OR provider_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users delete clinic draft sessions" ON public.sessions;
CREATE POLICY "Users delete clinic draft sessions" ON public.sessions
FOR DELETE TO authenticated
USING (
  clinic_id = public.get_user_clinic_id((SELECT auth.uid()))
  AND public.current_user_can('session.delete_draft', clinic_id)
  AND (
    public.current_user_is_clinic_manager(clinic_id)
    OR (
      status = 'rascunho'
      AND (
        user_id = (SELECT auth.uid())
        OR provider_id = (SELECT auth.uid())
      )
    )
  )
);

GRANT EXECUTE ON FUNCTION public.current_user_is_clinic_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_clinic_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_share_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_clinic_share_collaborators(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_session_share_recipients(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_session_share_summary(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.share_sessions_with_collaborators(uuid[], uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_session_share(uuid, uuid) TO authenticated;
