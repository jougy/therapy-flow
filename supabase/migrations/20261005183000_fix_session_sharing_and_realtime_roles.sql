-- Migration: Fix session sharing canonical RPC signature, summary robustness and realtime roles publication
-- Avoids PGRST203 function overload conflicts and ensures resilient realtime/sharing operation

-- 1. Drop obsolete overloaded signature without default parameter
DROP FUNCTION IF EXISTS public.share_sessions_with_collaborators(uuid[], uuid[]);

-- 2. Recreate/ensure canonical signature with access_level parameter and upsert behavior
CREATE OR REPLACE FUNCTION public.share_sessions_with_collaborators(
  _session_ids uuid[],
  _user_ids uuid[],
  _access_level text DEFAULT 'can_evolve'
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _session_id uuid;
  _target_user_id uuid;
  _session public.sessions%ROWTYPE;
  _inserted_count integer := 0;
  _row_count integer := 0;
  _level text := COALESCE(_access_level, 'can_evolve');
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF COALESCE(array_length(_session_ids, 1), 0) = 0 OR COALESCE(array_length(_user_ids, 1), 0) = 0 THEN
    RETURN json_build_object('shared_count', 0);
  END IF;

  IF _level NOT IN ('read', 'read_only', 'can_evolve') THEN
    _level := 'can_evolve';
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
        _level
      )
      ON CONFLICT (session_id, shared_with_user_id) WHERE revoked_at IS NULL DO UPDATE
      SET access_level = excluded.access_level,
          shared_by_user_id = excluded.shared_by_user_id,
          created_at = now();

      GET DIAGNOSTICS _row_count = ROW_COUNT;
      _inserted_count := _inserted_count + _row_count;
    END LOOP;
  END LOOP;

  RETURN json_build_object('shared_count', _inserted_count);
END;
$$;

ALTER FUNCTION public.share_sessions_with_collaborators(uuid[], uuid[], text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.share_sessions_with_collaborators(uuid[], uuid[], text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.share_sessions_with_collaborators(uuid[], uuid[], text) TO service_role;
GRANT ALL ON FUNCTION public.share_sessions_with_collaborators(uuid[], uuid[], text) TO authenticated;

-- 3. Enhance robustness of get_session_share_summary by using LEFT JOIN with profiles
CREATE OR REPLACE FUNCTION public.get_session_share_summary(_session_ids uuid[]) RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
          'access_level', session_shares.access_level,
          'created_at', session_shares.created_at
        )
        ORDER BY profiles.full_name NULLS LAST, profiles.email
      ) AS recipients
    FROM public.session_shares
    LEFT JOIN public.profiles
      ON profiles.id = session_shares.shared_with_user_id
    WHERE session_shares.session_id = ANY(_session_ids)
      AND session_shares.revoked_at IS NULL
      AND public.can_read_session(session_shares.session_id)
    GROUP BY session_shares.session_id
  ) AS summaries;
$$;

ALTER FUNCTION public.get_session_share_summary(uuid[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_session_share_summary(uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_session_share_summary(uuid[]) TO service_role;
GRANT ALL ON FUNCTION public.get_session_share_summary(uuid[]) TO authenticated;

-- 4. Enable Realtime replication for clinic_operational_roles
ALTER TABLE public.clinic_operational_roles REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'clinic_operational_roles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.clinic_operational_roles;
  END IF;
END $$;

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
