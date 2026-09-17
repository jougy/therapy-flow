-- Migration: 20260917030000_rls_jwt_claims_and_inlining.sql
-- Description: Fase A do Plano de Execução:
--   1. Cria hook de acesso customizado no Supabase Auth para injetar active_clinic_id, operational_role e is_clinic_owner no JWT.
--   2. Refatora as políticas de RLS de sessões, pacientes, agenda e faturamento para leitura O(1) diretamente do claim do JWT.
--   3. Mantém fallback transparente para get_user_clinic_id(auth.uid()) garantindo zero quebra em tokens legados.

-- ==============================================================================
-- 1. CUSTOM ACCESS TOKEN HOOK (SUPABASE AUTH)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _user_id uuid;
  _claims jsonb;
  _active_clinic_id uuid;
  _role text;
  _is_owner boolean := false;
BEGIN
  _user_id := (event->>'user_id')::uuid;
  _claims := COALESCE(event->'claims', '{}'::jsonb);

  IF _user_id IS NOT NULL THEN
    _active_clinic_id := public.get_user_clinic_id(_user_id);

    IF _active_clinic_id IS NOT NULL THEN
      SELECT 
        operational_role::text,
        (account_role = 'account_owner' OR operational_role = 'owner')
      INTO _role, _is_owner
      FROM public.clinic_memberships
      WHERE user_id = _user_id 
        AND clinic_id = _active_clinic_id
        AND is_active = true
        AND membership_status = 'active'
      LIMIT 1;

      _claims := jsonb_set(_claims, '{active_clinic_id}', to_jsonb(_active_clinic_id::text));
      _claims := jsonb_set(_claims, '{operational_role}', to_jsonb(COALESCE(_role, 'professional')));
      _claims := jsonb_set(_claims, '{is_clinic_owner}', to_jsonb(COALESCE(_is_owner, false)));
    END IF;
  END IF;

  event := jsonb_set(event, '{claims}', _claims);
  RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO postgres, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
  END IF;
END;
$$;

-- ==============================================================================
-- 2. ATUALIZAÇÃO DE RLS COM AVALIAÇÃO O(1) E FALLBACK TRANSPARENTE
-- ==============================================================================

-- 2.1. Sessions SELECT
DROP POLICY IF EXISTS "Users read clinic sessions" ON public.sessions;
CREATE POLICY "Users read clinic sessions" ON public.sessions
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND clinic_id = COALESCE(
    NULLIF(auth.jwt() ->> 'active_clinic_id', '')::uuid,
    public.get_user_clinic_id(auth.uid())
  )
  AND public.current_user_can('sessions.read', clinic_id)
  AND (
    public.current_user_is_clinic_manager(clinic_id)
    OR user_id = auth.uid()
    OR provider_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.session_shares
      WHERE session_shares.session_id = sessions.id
        AND session_shares.clinic_id = sessions.clinic_id
        AND session_shares.shared_with_user_id = auth.uid()
        AND session_shares.revoked_at IS NULL
    )
  )
);

-- 2.2. Patients SELECT
DROP POLICY IF EXISTS "Users read clinic patients" ON public.patients;
CREATE POLICY "Users read clinic patients" ON public.patients
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND clinic_id = COALESCE(
    NULLIF(auth.jwt() ->> 'active_clinic_id', '')::uuid,
    public.get_user_clinic_id(auth.uid())
  )
  AND public.can_read_clinic_data(clinic_id)
  AND public.current_user_can('patients.read', clinic_id)
);

-- 2.3. Clinical Session Billings SELECT
DROP POLICY IF EXISTS "Users read clinic session billings" ON public.clinical_session_billings;
CREATE POLICY "Users read clinic session billings" ON public.clinical_session_billings
FOR SELECT TO authenticated
USING (
  (clinic_id IS NULL AND session_id IN (SELECT id FROM public.sessions WHERE user_id = auth.uid()))
  OR (
    clinic_id = COALESCE(
      NULLIF(auth.jwt() ->> 'active_clinic_id', '')::uuid,
      public.get_user_clinic_id(auth.uid())
    )
    AND (
      public.current_user_can('treasury.read', clinic_id)
      OR public.current_user_can('sessions.read', clinic_id)
    )
  )
);
