-- Migration: 20260927041500_fix_governance_expires_at_ambiguity.sql
-- Description: Corrige a ambiguidade da coluna 'expires_at' na função 'get_user_active_governance'.
-- PL/pgSQL causava erro 42702 (column reference "expires_at" is ambiguous) durante a checagem
-- do UPDATE em public.user_punishments por colidir o nome da coluna da tabela com a coluna do RETURNS TABLE.

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
BEGIN
  -- Auto-expire outdated punishments first com colunas explicitamente qualificadas para evitar ambiguidade com o RETURNS TABLE
  UPDATE public.user_punishments
  SET is_active = false
  WHERE user_punishments.user_id = _user_id
    AND user_punishments.is_active = true
    AND user_punishments.expires_at IS NOT NULL
    AND user_punishments.expires_at < now();

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
