-- Migration: 20260918123000_add_clinic_terms_storage.sql
-- Descrição: Termos de Consentimento Modulares por Clínica e Armazenamento Backblaze B2
-- Padrão: Expand and Contract (não-destrutivo)

-- 1. Criar tabela public.clinic_terms
CREATE TABLE IF NOT EXISTS public.clinic_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  term_type text NOT NULL CHECK (term_type IN ('adult_consent', 'minor_consent')),
  original_filename text NOT NULL,
  content_markdown text NOT NULL,
  b2_object_key text NOT NULL,
  byte_size integer NOT NULL DEFAULT 0,
  compressed_byte_size integer NOT NULL DEFAULT 0,
  storage_encoding text NOT NULL DEFAULT 'gzip',
  version integer NOT NULL DEFAULT 1,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinic_terms_clinic_type_unique UNIQUE (clinic_id, term_type)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_clinic_terms_clinic_id ON public.clinic_terms(clinic_id);

-- Trigger de updated_at
DROP TRIGGER IF EXISTS update_clinic_terms_updated_at ON public.clinic_terms;
CREATE TRIGGER update_clinic_terms_updated_at
  BEFORE UPDATE ON public.clinic_terms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Habilitar RLS
ALTER TABLE public.clinic_terms ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Users read clinic terms" ON public.clinic_terms;
CREATE POLICY "Users read clinic terms" ON public.clinic_terms
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.get_user_clinic_id(auth.uid())
    AND public.can_read_clinic_data(clinic_id)
    AND (
      public.current_user_can('patients.read', clinic_id)
      OR public.current_user_can('clinic_terms.manage', clinic_id)
      OR public.current_user_can('clinic_profile.read', clinic_id)
    )
  );

DROP POLICY IF EXISTS "Users insert clinic terms" ON public.clinic_terms;
CREATE POLICY "Users insert clinic terms" ON public.clinic_terms
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.get_user_clinic_id(auth.uid())
    AND NOT public.is_clinic_read_only(clinic_id)
    AND public.current_user_can('clinic_terms.manage', clinic_id)
  );

DROP POLICY IF EXISTS "Users update clinic terms" ON public.clinic_terms;
CREATE POLICY "Users update clinic terms" ON public.clinic_terms
  FOR UPDATE TO authenticated
  USING (
    clinic_id = public.get_user_clinic_id(auth.uid())
    AND NOT public.is_clinic_read_only(clinic_id)
    AND public.current_user_can('clinic_terms.manage', clinic_id)
  )
  WITH CHECK (
    clinic_id = public.get_user_clinic_id(auth.uid())
    AND NOT public.is_clinic_read_only(clinic_id)
    AND public.current_user_can('clinic_terms.manage', clinic_id)
  );

DROP POLICY IF EXISTS "Users delete clinic terms" ON public.clinic_terms;
CREATE POLICY "Users delete clinic terms" ON public.clinic_terms
  FOR DELETE TO authenticated
  USING (
    clinic_id = public.get_user_clinic_id(auth.uid())
    AND NOT public.is_clinic_read_only(clinic_id)
    AND public.current_user_can('clinic_terms.manage', clinic_id)
  );

-- Permissões de tabela
GRANT ALL ON TABLE public.clinic_terms TO authenticated;
GRANT ALL ON TABLE public.clinic_terms TO service_role;

-- 3. Atualizar public.current_user_can com a capability 'clinic_terms.manage'
CREATE OR REPLACE FUNCTION "public"."current_user_can"("_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _resolved_clinic_id uuid;
  _account_role public.account_role_type;
  _operational_role public.operational_role_type;
  _membership_status public.membership_status_type;
  _is_active boolean;
  _subscription_plan public.subscription_plan;
  _clinic_owner_id uuid;
  _override_enabled boolean;
  _sub record;
  _is_subscription_expired boolean := false;
  _is_read_only boolean := false;
  _is_owner boolean := false;
  _canonical_capability text := _capability;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Normalização de capacidades sinônimas/canônicas
  IF _capability IN ('patient_groups.write', 'patients_groups.write') THEN
    _canonical_capability := 'patients.manage_groups';
  ELSIF _capability IN ('patient_groups.read') THEN
    _canonical_capability := 'patients_groups.read';
  ELSIF _capability = 'agenda.read' THEN
    _canonical_capability := 'schedule.read';
  ELSIF _capability = 'agenda.write' THEN
    _canonical_capability := 'schedule.write';
  END IF;

  _resolved_clinic_id := COALESCE(_clinic_id, public.get_user_clinic_id(_user_id));

  -- Bypass para Platform Owner em contexto ativo
  IF _resolved_clinic_id IS NOT NULL
    AND public.is_platform_owner(_user_id)
    AND public.get_active_platform_clinic_id(_user_id) = _resolved_clinic_id THEN
    RETURN true;
  END IF;

  SELECT
    clinic_memberships.account_role,
    clinic_memberships.operational_role,
    clinic_memberships.membership_status,
    clinic_memberships.is_active,
    clinics.subscription_plan,
    clinics.account_owner_user_id
  INTO
    _account_role,
    _operational_role,
    _membership_status,
    _is_active,
    _subscription_plan,
    _clinic_owner_id
  FROM public.clinic_memberships
  JOIN public.clinics ON clinics.id = clinic_memberships.clinic_id
  WHERE clinic_memberships.user_id = _user_id
    AND clinic_memberships.clinic_id = _resolved_clinic_id
  LIMIT 1;

  IF _resolved_clinic_id IS NULL
    OR _is_active IS DISTINCT FROM true
    OR _membership_status IS DISTINCT FROM 'active' THEN
    RETURN false;
  END IF;

  _is_owner := (_account_role = 'account_owner' OR _operational_role = 'owner' OR _clinic_owner_id = _user_id);

  -- 1. Checagem de Assinatura e Read-Only
  SELECT * INTO _sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _resolved_clinic_id
  LIMIT 1;

  IF _sub IS NOT NULL THEN
    -- A. Bloqueio completo de colaboradores que NÃO sejam o owner quando status for TRIAL_EXPIRED
    IF _sub.status = 'TRIAL_EXPIRED' AND NOT _is_owner THEN
      RETURN false;
    END IF;

    -- B. Checagem de status TRIAL que expirou
    IF public.is_clinic_read_only(_resolved_clinic_id) THEN
      _is_read_only := true;
      -- Se for colaborador não-owner e o trial já expirou, bloqueia o acesso
      IF (_sub.status = 'TRIAL_EXPIRED' OR _sub.status = 'TRIAL' OR COALESCE(_sub.is_free_trial, false) = true) AND NOT _is_owner THEN
        RETURN false;
      END IF;
    END IF;

    -- C. Checagem de expiração regular (não-trial e não-cortesia)
    IF _sub.status NOT IN ('BETA', 'TRIAL', 'COURTESY') AND COALESCE(_sub.is_courtesy, false) = false THEN
      IF _sub.expires_at IS NOT NULL AND _sub.expires_at < now() THEN
        _is_subscription_expired := true;
      ELSIF _sub.status IN ('EXPIRED', 'SUSPENDED') THEN
        _is_subscription_expired := true;
      END IF;
    END IF;
  END IF;

  -- Se a clínica estiver em modo read-only ou com assinatura expirada:
  IF _is_read_only OR _is_subscription_expired THEN
    -- Owner pode gerenciar cobrança/assinatura para regularizar
    IF _capability = 'subscription_billing.manage' AND _is_owner THEN
      RETURN true;
    END IF;

    -- Permite APENAS permissões de leitura (.read)
    IF _capability IN (
      'patients.read',
      'schedule.read',
      'schedule.read_all',
      'agenda.read',
      'sessions.read',
      'sessions.read_all',
      'patient_groups.read',
      'patients_groups.read',
      'subaccounts_analytics.read',
      'subaccounts.read',
      'subaccounts_roles.read',
      'clinic_profile.read',
      'forms.read',
      'anamnesis_forms.read',
      'treasury.read',
      'subscription_billing.read'
    ) OR _canonical_capability IN (
      'patients.read',
      'schedule.read',
      'schedule.read_all',
      'agenda.read',
      'sessions.read',
      'sessions.read_all',
      'patient_groups.read',
      'patients_groups.read',
      'subaccounts_analytics.read',
      'subaccounts.read',
      'subaccounts_roles.read',
      'clinic_profile.read',
      'forms.read',
      'anamnesis_forms.read',
      'treasury.read',
      'subscription_billing.read'
    ) THEN
      RETURN true;
    END IF;

    -- Qualquer escrita ou deleção é ESTRITAMENTE bloqueada
    RETURN false;
  END IF;

  -- Se a clínica estiver normal e não expirada, o owner possui acesso pleno:
  IF _is_owner THEN
    RETURN true;
  END IF;

  IF _capability = 'subscription_billing.manage' THEN
    RETURN false;
  END IF;

  -- 2. Checagem de Override na tabela clinic_operational_role_capabilities
  SELECT enabled
  INTO _override_enabled
  FROM public.clinic_operational_role_capabilities
  WHERE clinic_id = _resolved_clinic_id
    AND operational_role = _operational_role::text
    AND capability IN (_capability, _canonical_capability)
  ORDER BY (capability = _canonical_capability) DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN _override_enabled;
  END IF;

  -- 3. Matriz Padrão Canônica de Permissões
  CASE _capability
    WHEN 'clinic_profile.read' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'clinic_profile.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'clinic_terms.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'forms.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'forms.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.read' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.write' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.manage' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.delete' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.read' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.manage' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'subscription_billing.read' THEN
      RETURN _is_owner;
    WHEN 'team_development.manage' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'treasury.read' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'treasury.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'agenda.delete_events' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_analytics.read' THEN
      RETURN (_subscription_plan IN ('clinic', 'enterprise')) AND _operational_role IN ('owner', 'admin');
    WHEN 'patients.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'patients.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'patients.delete' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'patients.manage_groups', 'patient_groups.write', 'patients_groups.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'patient_groups.read', 'patients_groups.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'agenda.read', 'schedule.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.read_all' THEN
      RETURN _operational_role IN ('owner', 'admin', 'assistant');
    WHEN 'agenda.write', 'schedule.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.write_others' THEN
      RETURN _operational_role IN ('owner', 'admin', 'assistant');
    WHEN 'sessions.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'estagiario');
    WHEN 'sessions.read_all' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'sessions.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'estagiario');
    WHEN 'sessions.write_others' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'sessions.share' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'sessions.delete' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'session.delete_draft' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'system.print' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    ELSE
      -- Fallback para conferir capacidade canônica caso informada como alias
      IF _canonical_capability <> _capability THEN
        CASE _canonical_capability
          WHEN 'patients.manage_groups' THEN
            RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
          WHEN 'patients_groups.read' THEN
            RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
          WHEN 'schedule.read' THEN
            RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
          WHEN 'schedule.write' THEN
            RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
          ELSE
            RETURN false;
        END CASE;
      END IF;
      RETURN false;
  END CASE;
END;
$$;

-- 4. Função RPC get_clinic_active_terms(p_clinic_id uuid)
CREATE OR REPLACE FUNCTION public.get_clinic_active_terms(p_clinic_id uuid)
RETURNS TABLE (
  term_type text,
  is_custom boolean,
  id uuid,
  clinic_id uuid,
  original_filename text,
  content_markdown text,
  b2_object_key text,
  byte_size integer,
  compressed_byte_size integer,
  storage_encoding text,
  version integer,
  uploaded_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_has_access boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autenticado' USING ERRCODE = '42501';
  END IF;

  -- Checa se o usuário tem permissão para ler dados desta clínica
  IF public.get_user_clinic_id(v_user_id) = p_clinic_id
     OR public.is_platform_owner(v_user_id)
     OR EXISTS (
       SELECT 1 FROM public.clinic_memberships cm
       WHERE cm.clinic_id = p_clinic_id
         AND cm.user_id = v_user_id
         AND cm.is_active = true
         AND cm.membership_status = 'active'
     ) THEN
    v_has_access := true;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Acesso não autorizado para esta clínica' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH requested_types AS (
    SELECT unnest(ARRAY['adult_consent', 'minor_consent']) AS expected_type
  )
  SELECT
    rt.expected_type AS term_type,
    (ct.id IS NOT NULL) AS is_custom,
    ct.id,
    p_clinic_id AS clinic_id,
    COALESCE(ct.original_filename, rt.expected_type || '_padrao.md') AS original_filename,
    COALESCE(ct.content_markdown, '') AS content_markdown,
    COALESCE(ct.b2_object_key, '') AS b2_object_key,
    COALESCE(ct.byte_size, 0) AS byte_size,
    COALESCE(ct.compressed_byte_size, 0) AS compressed_byte_size,
    COALESCE(ct.storage_encoding, 'gzip') AS storage_encoding,
    COALESCE(ct.version, 1) AS version,
    ct.uploaded_by,
    ct.created_at,
    ct.updated_at
  FROM requested_types rt
  LEFT JOIN public.clinic_terms ct
    ON ct.clinic_id = p_clinic_id
   AND ct.term_type = rt.expected_type;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_clinic_active_terms(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_clinic_active_terms(uuid) TO service_role;
