-- Migration: 20261008093000_fix_governance_ambiguity_and_security_session_grant.sql
-- Description: Fixes column reference "expires_at" ambiguity with #variable_conflict use_column
-- and ensures execute grant on register_current_security_session.

CREATE OR REPLACE FUNCTION public.get_user_active_governance(
  _user_id UUID
)
RETURNS TABLE (
  punishment_id UUID,
  punishment_type TEXT,
  applied_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  reason TEXT,
  is_manual BOOLEAN,
  applied_by_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
#variable_conflict use_column
BEGIN
  -- Auto-expire outdated punishments first
  UPDATE public.user_punishments up
  SET is_active = false
  WHERE up.user_id = _user_id
    AND up.is_active = true
    AND up.expires_at IS NOT NULL
    AND up.expires_at < now();

  RETURN QUERY
  SELECT 
    p.id AS punishment_id,
    p.punishment_type,
    p.applied_at,
    p.expires_at,
    p.reason,
    p.is_manual,
    COALESCE(prof.full_name, prof.email, 'Sistema Automático') AS applied_by_name
  FROM public.user_punishments p
  LEFT JOIN public.profiles prof ON prof.id = p.applied_by
  WHERE p.user_id = _user_id
    AND p.is_active = true
    AND (p.expires_at IS NULL OR p.expires_at > now())
  ORDER BY p.applied_at DESC;
END;
$$;

ALTER FUNCTION public.get_user_active_governance(_user_id UUID) OWNER TO postgres;
GRANT ALL ON FUNCTION public.get_user_active_governance(_user_id UUID) TO service_role;
GRANT ALL ON FUNCTION public.get_user_active_governance(_user_id UUID) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_active_governance(_user_id UUID) TO anon;

-- Ensure execute grant on register_current_security_session
GRANT EXECUTE ON FUNCTION public.register_current_security_session(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_current_security_session(text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_current_security_session(text, text, text, text, text) TO anon;
