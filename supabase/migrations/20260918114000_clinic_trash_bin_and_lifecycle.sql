-- Migration: 20260918114000_clinic_trash_bin_and_lifecycle.sql
-- Description: Implementação da infraestrutura de Lixeira da Clínica (Soft Delete com ciclo de vida semanal e expurgo aos domingos)

-- ==============================================================================
-- 1. ESTRUTURA DE SOFT DELETE: anamnesis_form_templates
-- ==============================================================================

ALTER TABLE public.anamnesis_form_templates
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_anamnesis_form_templates_active
  ON public.anamnesis_form_templates(clinic_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_anamnesis_form_templates_trash
  ON public.anamnesis_form_templates(clinic_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

-- Atualizar RLS de anamnesis_form_templates para ocultar registros soft-deleted de consultas normais
DROP POLICY IF EXISTS "Users read clinic anamnesis forms" ON public.anamnesis_form_templates;
CREATE POLICY "Users read clinic anamnesis forms" ON public.anamnesis_form_templates
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND clinic_id = COALESCE(
    NULLIF(auth.jwt() ->> 'active_clinic_id', '')::uuid,
    public.get_user_clinic_id(auth.uid())
  )
  AND public.can_read_clinic_data(clinic_id)
  AND (
    public.current_user_can('forms.read', clinic_id)
    OR public.current_user_can('anamnesis_forms.read', clinic_id)
  )
);

-- ==============================================================================
-- 2. ÍNDICES DE SUPORTE À LIXEIRA: patients e sessions
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_patients_trash_bin
  ON public.patients(clinic_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_trash_bin
  ON public.sessions(clinic_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

-- ==============================================================================
-- 3. AJUSTE DE CONSTRAINTS: clinical_session_billings
--    Garante ON DELETE CASCADE em session_id para expurgo definitivo sem falha 23503
-- ==============================================================================

ALTER TABLE public.clinical_session_billings
  DROP CONSTRAINT IF EXISTS clinical_session_billings_session_id_fkey;

ALTER TABLE public.clinical_session_billings
  ADD CONSTRAINT clinical_session_billings_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

-- ==============================================================================
-- 4. ATUALIZAR current_user_can PARA SUPORTAR clinic_trash.read E clinic_trash.manage
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.current_user_can(
  _capability text,
  _clinic_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
    IF _sub.status = 'TRIAL_EXPIRED' AND NOT _is_owner THEN
      RETURN false;
    END IF;

    IF public.is_clinic_read_only(_resolved_clinic_id) THEN
      _is_read_only := true;
      IF (_sub.status = 'TRIAL_EXPIRED' OR _sub.status = 'TRIAL' OR COALESCE(_sub.is_free_trial, false) = true) AND NOT _is_owner THEN
        RETURN false;
      END IF;
    END IF;

    IF _sub.status NOT IN ('BETA', 'TRIAL', 'COURTESY') AND COALESCE(_sub.is_courtesy, false) = false THEN
      IF _sub.expires_at IS NOT NULL AND _sub.expires_at < now() THEN
        _is_subscription_expired := true;
      ELSIF _sub.status IN ('EXPIRED', 'SUSPENDED') THEN
        _is_subscription_expired := true;
      END IF;
    END IF;
  END IF;

  -- Modo apenas leitura
  IF _is_read_only OR _is_subscription_expired THEN
    IF _capability = 'subscription_billing.manage' AND _is_owner THEN
      RETURN true;
    END IF;

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
      'subscription_billing.read',
      'clinic_trash.read'
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
      'subscription_billing.read',
      'clinic_trash.read'
    ) THEN
      RETURN true;
    END IF;

    RETURN false;
  END IF;

  IF _is_owner THEN
    RETURN true;
  END IF;

  IF _capability = 'subscription_billing.manage' THEN
    RETURN false;
  END IF;

  -- 2. Checagem de Override em clinic_operational_role_capabilities
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
    WHEN 'clinic_trash.read' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'clinic_trash.manage' THEN
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

GRANT EXECUTE ON FUNCTION public.current_user_can(text, uuid) TO authenticated, anon;

-- ==============================================================================
-- 5. RPC: public.move_entity_to_trash
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.move_entity_to_trash(
  _entity_type text,
  _entity_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _auth_user_id uuid := auth.uid();
  _clean_entity_type text := lower(trim(COALESCE(_entity_type, '')));
  _clinic_id uuid;
  _affected integer := 0;
  _has_session_delete boolean;
  _has_patient_delete boolean;
  _has_forms_manage boolean;
BEGIN
  -- 1. Validação de autenticação
  IF _auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  -- 2. Identificação da clínica ativa
  _clinic_id := COALESCE(
    NULLIF(auth.jwt() ->> 'active_clinic_id', '')::uuid,
    public.get_user_clinic_id(_auth_user_id)
  );

  IF _clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clinica ativa nao identificada para o usuario.';
  END IF;

  IF public.is_clinic_read_only(_clinic_id) THEN
    RAISE EXCEPTION 'Clinica em modo apenas leitura. Operacao nao permitida.';
  END IF;

  IF _entity_ids IS NULL OR cardinality(_entity_ids) = 0 THEN
    RETURN jsonb_build_object('success', true, 'count', 0, 'entity_type', _clean_entity_type);
  END IF;

  -- Proteção contra DoS e contenção de lock em payloads gigantes
  IF cardinality(_entity_ids) > 200 THEN
    RAISE EXCEPTION 'Limite maximo de 200 itens por lote excedido para protecao de infraestrutura.';
  END IF;

  -- 3. Validação e Execução por tipo de entidade
  IF _clean_entity_type IN ('sessions', 'session') THEN
    _clean_entity_type := 'sessions';
    _has_session_delete := public.current_user_can('sessions.delete', _clinic_id) OR public.current_user_is_clinic_manager(_clinic_id);

    -- Se não possui permissão clínica de deleção, exige ser o criador ou prestador de todos os atendimentos
    IF NOT _has_session_delete THEN
      IF EXISTS (
        SELECT 1 FROM public.sessions
        WHERE id = ANY(_entity_ids)
          AND clinic_id = _clinic_id
          AND user_id <> _auth_user_id
          AND (provider_id IS NULL OR provider_id <> _auth_user_id)
      ) THEN
        RAISE EXCEPTION 'Permissao negada: voce so pode mover para a lixeira atendimentos criados ou prestados por voce.';
      END IF;
    END IF;

    UPDATE public.sessions
    SET deleted_at = now(),
        deleted_by_user_id = _auth_user_id
    WHERE id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NULL;
    GET DIAGNOSTICS _affected = ROW_COUNT;

  ELSIF _clean_entity_type IN ('patients', 'patient') THEN
    _clean_entity_type := 'patients';
    _has_patient_delete := public.current_user_can('patients.delete', _clinic_id) OR public.current_user_is_clinic_manager(_clinic_id);

    IF NOT _has_patient_delete THEN
      RAISE EXCEPTION 'Permissao negada: requer permissao patients.delete.';
    END IF;

    UPDATE public.patients
    SET deleted_at = now(),
        deleted_by_user_id = _auth_user_id
    WHERE id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NULL;
    GET DIAGNOSTICS _affected = ROW_COUNT;

    -- Cascata em sessões ativas filhas do paciente
    UPDATE public.sessions
    SET deleted_at = now(),
        deleted_by_user_id = _auth_user_id
    WHERE patient_id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NULL;

  ELSIF _clean_entity_type IN ('forms', 'form', 'anamnesis_forms', 'anamnesis_form_templates') THEN
    _clean_entity_type := 'forms';
    _has_forms_manage := public.current_user_can('forms.manage', _clinic_id) OR public.current_user_is_clinic_manager(_clinic_id);

    IF NOT _has_forms_manage THEN
      RAISE EXCEPTION 'Permissao negada: requer permissao forms.manage.';
    END IF;

    UPDATE public.anamnesis_form_templates
    SET deleted_at = now(),
        deleted_by_user_id = _auth_user_id
    WHERE id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NULL;
    GET DIAGNOSTICS _affected = ROW_COUNT;

  ELSE
    RAISE EXCEPTION 'Tipo de entidade desconhecido para lixeira: %', _entity_type;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'count', _affected,
    'entity_type', _clean_entity_type
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_entity_to_trash(text, uuid[]) TO authenticated;

-- ==============================================================================
-- 6. RPC: public.restore_entity_from_trash
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.restore_entity_from_trash(
  _entity_type text,
  _entity_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _auth_user_id uuid := auth.uid();
  _clean_entity_type text := lower(trim(COALESCE(_entity_type, '')));
  _clinic_id uuid;
  _affected integer := 0;
  _can_restore boolean;
BEGIN
  -- 1. Validação de autenticação
  IF _auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  -- 2. Identificação da clínica ativa
  _clinic_id := COALESCE(
    NULLIF(auth.jwt() ->> 'active_clinic_id', '')::uuid,
    public.get_user_clinic_id(_auth_user_id)
  );

  IF _clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clinica ativa nao identificada para o usuario.';
  END IF;

  IF public.is_clinic_read_only(_clinic_id) THEN
    RAISE EXCEPTION 'Clinica em modo apenas leitura. Operacao nao permitida.';
  END IF;

  -- 3. Validação de permissões: clinic_trash.manage ou role owner/admin
  _can_restore := (
    public.current_user_can('clinic_trash.manage', _clinic_id)
    OR public.current_user_is_clinic_manager(_clinic_id)
    OR EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.user_id = _auth_user_id
        AND cm.clinic_id = _clinic_id
        AND cm.is_active = true
        AND cm.membership_status = 'active'
        AND (cm.account_role = 'account_owner' OR cm.operational_role IN ('owner', 'admin'))
    )
  );

  IF NOT _can_restore THEN
    RAISE EXCEPTION 'Permissao negada para restaurar itens da lixeira. Requer perfil owner ou admin.';
  END IF;

  IF _entity_ids IS NULL OR cardinality(_entity_ids) = 0 THEN
    RETURN jsonb_build_object('success', true, 'count', 0, 'entity_type', _clean_entity_type);
  END IF;

  -- Proteção contra DoS e contenção de lock em payloads gigantes
  IF cardinality(_entity_ids) > 200 THEN
    RAISE EXCEPTION 'Limite maximo de 200 itens por lote excedido para protecao de infraestrutura.';
  END IF;

  -- 4. Restauração por entidade
  IF _clean_entity_type IN ('sessions', 'session') THEN
    _clean_entity_type := 'sessions';

    UPDATE public.sessions
    SET deleted_at = NULL,
        deleted_by_user_id = NULL
    WHERE id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NOT NULL;
    GET DIAGNOSTICS _affected = ROW_COUNT;

  ELSIF _clean_entity_type IN ('patients', 'patient') THEN
    _clean_entity_type := 'patients';

    UPDATE public.patients
    SET deleted_at = NULL,
        deleted_by_user_id = NULL
    WHERE id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NOT NULL;
    GET DIAGNOSTICS _affected = ROW_COUNT;

    -- Restaura também sessões filhas vinculadas aos pacientes restaurados
    UPDATE public.sessions
    SET deleted_at = NULL,
        deleted_by_user_id = NULL
    WHERE patient_id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NOT NULL;

  ELSIF _clean_entity_type IN ('forms', 'form', 'anamnesis_forms', 'anamnesis_form_templates') THEN
    _clean_entity_type := 'forms';

    UPDATE public.anamnesis_form_templates
    SET deleted_at = NULL,
        deleted_by_user_id = NULL
    WHERE id = ANY(_entity_ids)
      AND clinic_id = _clinic_id
      AND deleted_at IS NOT NULL;
    GET DIAGNOSTICS _affected = ROW_COUNT;

  ELSE
    RAISE EXCEPTION 'Tipo de entidade desconhecido para lixeira: %', _entity_type;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'count', _affected,
    'entity_type', _clean_entity_type
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_entity_from_trash(text, uuid[]) TO authenticated;

-- ==============================================================================
-- 7. RPC: public.get_clinic_trash_items
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_clinic_trash_items(
  _clinic_id uuid,
  _entity_type text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _auth_user_id uuid := auth.uid();
  _clean_entity_type text := lower(trim(COALESCE(_entity_type, 'all')));
  _result jsonb;
BEGIN
  -- 1. Validação de autenticação
  IF _auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  -- 2. Validação de pertinência à clínica
  IF NOT (
    public.is_active_clinic_member(_clinic_id, _auth_user_id)
    OR public.has_role(_auth_user_id, 'super_admin'::app_role)
    OR (public.is_platform_owner(_auth_user_id) AND public.get_active_platform_clinic_id(_auth_user_id) = _clinic_id)
  ) THEN
    RAISE EXCEPTION 'Acesso negado para a clinica informada.';
  END IF;

  -- 3. Validação de permissões: clinic_trash.read, clinic_trash.manage ou manager
  IF NOT (
    public.current_user_can('clinic_trash.read', _clinic_id)
    OR public.current_user_can('clinic_trash.manage', _clinic_id)
    OR public.current_user_is_clinic_manager(_clinic_id)
  ) THEN
    RAISE EXCEPTION 'Permissao negada para visualizar a lixeira da clinica.';
  END IF;

  -- 4. Construção dos itens da lixeira
  WITH trash_union AS (
    -- SESSÕES
    SELECT
      s.id,
      'sessions'::text AS entity_type,
      COALESCE(p.name, 'Atendimento sem paciente') AS title,
      CONCAT_WS(
        ' • ',
        'Data: ' || to_char(s.session_date, 'DD/MM/YYYY HH24:MI'),
        CASE WHEN prof.full_name IS NOT NULL THEN 'Profissional: ' || prof.full_name ELSE NULL END
      ) AS subtitle,
      s.deleted_at,
      COALESCE(del_prof.full_name, del_prof.social_name, del_prof.email, 'Usuário') AS deleted_by_name,
      (date_trunc('week', s.deleted_at) + interval '6 days 23 hours 59 minutes 59 seconds') AS expires_at
    FROM public.sessions s
    LEFT JOIN public.patients p ON p.id = s.patient_id
    LEFT JOIN public.profiles prof ON prof.id = COALESCE(s.provider_id, s.user_id)
    LEFT JOIN public.profiles del_prof ON del_prof.id = s.deleted_by_user_id
    WHERE s.clinic_id = _clinic_id
      AND s.deleted_at IS NOT NULL
      AND _clean_entity_type IN ('all', 'sessions', 'session')

    UNION ALL

    -- PACIENTES
    SELECT
      p.id,
      'patients'::text AS entity_type,
      p.name AS title,
      COALESCE(
        NULLIF(
          CONCAT_WS(
            ' • ',
            CASE WHEN p.patient_code IS NOT NULL AND trim(p.patient_code) <> '' THEN 'Código: ' || p.patient_code ELSE NULL END,
            CASE WHEN p.cpf IS NOT NULL AND trim(p.cpf) <> '' THEN 'CPF: ' || p.cpf ELSE NULL END,
            CASE WHEN p.phone IS NOT NULL AND trim(p.phone) <> '' THEN 'Tel: ' || p.phone ELSE NULL END
          ),
          ''
        ),
        'Paciente cadastrado'
      ) AS subtitle,
      p.deleted_at,
      COALESCE(del_prof.full_name, del_prof.social_name, del_prof.email, 'Usuário') AS deleted_by_name,
      (date_trunc('week', p.deleted_at) + interval '6 days 23 hours 59 minutes 59 seconds') AS expires_at
    FROM public.patients p
    LEFT JOIN public.profiles del_prof ON del_prof.id = p.deleted_by_user_id
    WHERE p.clinic_id = _clinic_id
      AND p.deleted_at IS NOT NULL
      AND _clean_entity_type IN ('all', 'patients', 'patient')

    UNION ALL

    -- FORMULÁRIOS / MODELOS DE ANAMNESE
    SELECT
      f.id,
      'forms'::text AS entity_type,
      f.name AS title,
      COALESCE(NULLIF(trim(f.description), ''), 'Modelo de anamnese') AS subtitle,
      f.deleted_at,
      COALESCE(del_prof.full_name, del_prof.social_name, del_prof.email, 'Usuário') AS deleted_by_name,
      (date_trunc('week', f.deleted_at) + interval '6 days 23 hours 59 minutes 59 seconds') AS expires_at
    FROM public.anamnesis_form_templates f
    LEFT JOIN public.profiles del_prof ON del_prof.id = f.deleted_by_user_id
    WHERE f.clinic_id = _clinic_id
      AND f.deleted_at IS NOT NULL
      AND _clean_entity_type IN ('all', 'forms', 'form', 'anamnesis_forms', 'anamnesis_form_templates')
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', tu.id,
        'entity_type', tu.entity_type,
        'title', tu.title,
        'subtitle', tu.subtitle,
        'deleted_at', tu.deleted_at,
        'deleted_by_name', tu.deleted_by_name,
        'expires_at', tu.expires_at
      )
      ORDER BY tu.deleted_at DESC
    ),
    '[]'::jsonb
  )
  INTO _result
  FROM trash_union tu;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_clinic_trash_items(uuid, text) TO authenticated;

-- ==============================================================================
-- 8. RPC: public.purge_clinic_trash_bin
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.purge_clinic_trash_bin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _purged_sessions_count integer := 0;
  _purged_patients_count integer := 0;
  _purged_forms_count integer := 0;
  _session_ids uuid[];
  _patient_ids uuid[];
  _patient_session_ids uuid[];
  _form_ids uuid[];
BEGIN
  -- Validação de segurança: apenas chamadas internas de sistema (pg_cron/service_role) ou platform owner/super_admin
  IF auth.uid() IS NOT NULL AND NOT (
    public.is_platform_owner(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas rotinas internas de sistema ou administradores da plataforma podem executar o expurgo.';
  END IF;

  -- 1. Identifica os formulários elegíveis para expurgo definitivo:
  -- Itens cuja semana já se encerrou (domingo 23:59:59 passou) OU carência superior a 7 dias
  SELECT array_agg(id) INTO _form_ids
  FROM public.anamnesis_form_templates
  WHERE deleted_at IS NOT NULL
    AND (
      (date_trunc('week', deleted_at) + interval '6 days 23 hours 59 minutes 59 seconds') <= now()
      OR deleted_at <= (now() - interval '7 days')
      OR deleted_at < date_trunc('week', now())
    );

  IF _form_ids IS NOT NULL AND cardinality(_form_ids) > 0 THEN
    -- Desvincula templates de sessões se houver referência
    UPDATE public.sessions
    SET anamnesis_template_id = NULL
    WHERE anamnesis_template_id = ANY(_form_ids);

    DELETE FROM public.anamnesis_form_templates
    WHERE id = ANY(_form_ids);
    GET DIAGNOSTICS _purged_forms_count = ROW_COUNT;
  END IF;

  -- 2. Identifica pacientes elegíveis para expurgo definitivo
  SELECT array_agg(id) INTO _patient_ids
  FROM public.patients
  WHERE deleted_at IS NOT NULL
    AND (
      (date_trunc('week', deleted_at) + interval '6 days 23 hours 59 minutes 59 seconds') <= now()
      OR deleted_at <= (now() - interval '7 days')
      OR deleted_at < date_trunc('week', now())
    );

  IF _patient_ids IS NOT NULL AND cardinality(_patient_ids) > 0 THEN
    -- Mapeia todas as sessões ligadas a estes pacientes para remoção completa respeitando FKs
    SELECT array_agg(id) INTO _patient_session_ids
    FROM public.sessions
    WHERE patient_id = ANY(_patient_ids);

    IF _patient_session_ids IS NOT NULL AND cardinality(_patient_session_ids) > 0 THEN
      DELETE FROM public.clinical_session_billings WHERE session_id = ANY(_patient_session_ids);
      DELETE FROM public.session_edit_history WHERE session_id = ANY(_patient_session_ids);
      DELETE FROM public.session_shares WHERE session_id = ANY(_patient_session_ids);
      UPDATE public.sessions SET parent_session_id = NULL WHERE parent_session_id = ANY(_patient_session_ids);
      DELETE FROM public.sessions WHERE id = ANY(_patient_session_ids);
    END IF;

    -- Limpa registros dependentes de pacientes
    DELETE FROM public.clinical_session_billings WHERE patient_id = ANY(_patient_ids);
    DELETE FROM public.agenda_events WHERE patient_id = ANY(_patient_ids);
    DELETE FROM public.patient_clinical_snapshots WHERE patient_id = ANY(_patient_ids);
    DELETE FROM public.patient_file_uploads WHERE patient_id = ANY(_patient_ids);
    DELETE FROM public.patient_payment_plans WHERE patient_id = ANY(_patient_ids);
    DELETE FROM public.patient_evolution_groups WHERE patient_id = ANY(_patient_ids);
    DELETE FROM public.patient_registration_links WHERE patient_id = ANY(_patient_ids);
    DELETE FROM public.patient_groups WHERE patient_id = ANY(_patient_ids);

    DELETE FROM public.patients WHERE id = ANY(_patient_ids);
    GET DIAGNOSTICS _purged_patients_count = ROW_COUNT;
  END IF;

  -- 3. Identifica sessões individuais elegíveis para expurgo definitivo
  SELECT array_agg(id) INTO _session_ids
  FROM public.sessions
  WHERE deleted_at IS NOT NULL
    AND (
      (date_trunc('week', deleted_at) + interval '6 days 23 hours 59 minutes 59 seconds') <= now()
      OR deleted_at <= (now() - interval '7 days')
      OR deleted_at < date_trunc('week', now())
    );

  IF _session_ids IS NOT NULL AND cardinality(_session_ids) > 0 THEN
    -- Remove faturamentos clínicos vinculados
    DELETE FROM public.clinical_session_billings WHERE session_id = ANY(_session_ids);

    -- Remove histórico de edições e compartilhamentos
    DELETE FROM public.session_edit_history WHERE session_id = ANY(_session_ids);
    DELETE FROM public.session_shares WHERE session_id = ANY(_session_ids);

    -- Limpa dependências de autorreferência e uploads
    UPDATE public.sessions SET parent_session_id = NULL WHERE parent_session_id = ANY(_session_ids);
    UPDATE public.patient_file_uploads SET session_id = NULL WHERE session_id = ANY(_session_ids);

    -- Expurga definitivamente as sessões
    DELETE FROM public.sessions WHERE id = ANY(_session_ids);
    GET DIAGNOSTICS _purged_sessions_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'purged_sessions', _purged_sessions_count,
    'purged_patients', _purged_patients_count,
    'purged_forms', _purged_forms_count,
    'executed_at', now()
  );
END;
$$;

-- Restringe estritamente o expurgo físico ao service_role (rotina agendada ou super admin)
REVOKE ALL ON FUNCTION public.purge_clinic_trash_bin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_clinic_trash_bin() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purge_clinic_trash_bin() TO service_role;

-- Agendamento semanal automático aos domingos às 23:59 UTC caso pg_cron esteja ativo
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      EXECUTE 'SELECT cron.unschedule(''purge-clinic-trash-bin-sunday'')';
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;

    EXECUTE $cron$
      SELECT cron.schedule(
        'purge-clinic-trash-bin-sunday',
        '59 23 * * 0',
        $job$SELECT public.purge_clinic_trash_bin();$job$
      )
    $cron$;
  END IF;
END;
$$;

-- ==============================================================================
-- 9. ATUALIZAR get_personal_professional_sessions_portfolio: deleted_at IS NULL
-- ==============================================================================

DROP FUNCTION IF EXISTS public.get_personal_professional_sessions_portfolio(text, uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_personal_professional_sessions_portfolio(
  _query text DEFAULT NULL,
  _clinic_id uuid DEFAULT NULL,
  _limit integer DEFAULT 100,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  session_id uuid,
  session_date timestamptz,
  session_status text,
  clinic_id uuid,
  clinic_name text,
  clinic_route_key text,
  patient_id uuid,
  patient_ref text,
  patient_name text,
  patient_pseudonym text,
  patient_demographics text,
  notes_sanitized text,
  treatment_sanitized text,
  pain_score integer,
  complexity_score integer,
  created_at timestamptz,
  anamnesis_form_response jsonb,
  care_lines jsonb,
  anamnesis_base_schema jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _authenticated_user_id uuid := auth.uid();
  _clean_query text;
  _sanitized_limit integer;
  _sanitized_offset integer;
BEGIN
  -- 1. Validação de autenticação obrigatória
  IF _authenticated_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  -- 2. Saneamento de paginação e busca
  _sanitized_limit := LEAST(GREATEST(COALESCE(_limit, 100), 1), 200);
  _sanitized_offset := GREATEST(COALESCE(_offset, 0), 0);
  _clean_query := NULLIF(trim(_query), '');

  -- 3. Retorno dos atendimentos com identificação direta para prontuário e histórico
  --    Respeitando estritamente s.deleted_at IS NULL
  RETURN QUERY
  SELECT
    s.id AS session_id,
    s.session_date,
    s.status AS session_status,
    s.clinic_id,
    COALESCE(c.name, 'Atendimento Particular') AS clinic_name,
    c.route_key AS clinic_route_key,
    p.id AS patient_id,
    COALESCE(p.patient_code, p.id::text) AS patient_ref,
    COALESCE(p.name, 'Paciente') AS patient_name,
    public.pseudonymize_patient_name(p.name) AS patient_pseudonym,
    NULLIF(
      TRIM(
        CONCAT_WS(
          ' • ',
          CASE
            WHEN p.date_of_birth IS NOT NULL THEN
              (EXTRACT(YEAR FROM age(COALESCE(s.session_date, now())::date, p.date_of_birth))::integer || ' anos')
            WHEN p.age IS NOT NULL THEN
              (p.age || ' anos')
            ELSE NULL
          END,
          CASE
            WHEN p.gender IS NOT NULL AND trim(p.gender) <> '' THEN
              initcap(trim(p.gender))
            ELSE NULL
          END
        )
      ),
      ''
    ) AS patient_demographics,
    public.sanitize_clinical_free_text(s.notes) AS notes_sanitized,
    CASE
      WHEN s.treatment IS NULL THEN NULL
      WHEN jsonb_typeof(s.treatment) = 'null' THEN NULL
      WHEN jsonb_typeof(s.treatment) = 'string' THEN public.sanitize_clinical_free_text(s.treatment #>> '{}')
      ELSE public.sanitize_clinical_free_text(s.treatment::text)
    END AS treatment_sanitized,
    s.pain_score,
    s.complexity_score,
    s.created_at,
    COALESCE(s.anamnesis_form_response, '{}'::jsonb) AS anamnesis_form_response,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pg.id,
            'name', pg.name,
            'color', pg.color
          )
          ORDER BY pg.name ASC
        )
        FROM (
          SELECT DISTINCT id_val::uuid AS group_uuid
          FROM (
            SELECT jsonb_array_elements_text(
              CASE 
                WHEN jsonb_typeof(s.anamnesis->'care_line_ids') = 'array' THEN s.anamnesis->'care_line_ids'
                ELSE '[]'::jsonb
              END
            ) AS id_val
            UNION ALL
            SELECT s.group_id::text WHERE s.group_id IS NOT NULL
          ) u
          WHERE id_val ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        ) extracted_ids
        JOIN public.patient_groups pg ON pg.id = extracted_ids.group_uuid
      ),
      '[]'::jsonb
    ) AS care_lines,
    COALESCE(c.anamnesis_base_schema, '[]'::jsonb) AS anamnesis_base_schema
  FROM public.sessions s
  LEFT JOIN public.clinics c ON c.id = s.clinic_id
  LEFT JOIN public.patients p ON p.id = s.patient_id
  WHERE COALESCE(s.provider_id, s.user_id) = _authenticated_user_id
    AND s.deleted_at IS NULL
    AND (_clinic_id IS NULL OR s.clinic_id = _clinic_id)
    AND (
      _clean_query IS NULL
      OR s.notes ILIKE ('%' || _clean_query || '%')
      OR s.treatment::text ILIKE ('%' || _clean_query || '%')
      OR s.status ILIKE ('%' || _clean_query || '%')
      OR COALESCE(c.name, '') ILIKE ('%' || _clean_query || '%')
      OR COALESCE(p.name, '') ILIKE ('%' || _clean_query || '%')
      OR public.pseudonymize_patient_name(p.name) ILIKE ('%' || _clean_query || '%')
      OR to_char(s.session_date, 'YYYY-MM-DD') ILIKE ('%' || _clean_query || '%')
    )
  ORDER BY s.session_date DESC, s.created_at DESC
  LIMIT _sanitized_limit
  OFFSET _sanitized_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_personal_professional_sessions_portfolio(text, uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_personal_professional_sessions_portfolio(text, uuid, integer, integer) TO authenticated;
