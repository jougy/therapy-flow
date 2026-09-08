-- Migration: 20260907160000_subscription_tiers_and_read_only_mode.sql
-- Descrição: Suporte ao plano 'enterprise', status 'TRIAL_EXPIRED', blindagem RLS de modo Somente Leitura (Read-Only)
-- e bloqueio de colaboradores não-owner em clínicas com TRIAL_EXPIRED.

-- 1. Suporte ao plano 'enterprise' no ENUM subscription_plan
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE pg_type.typname = 'subscription_plan' AND pg_enum.enumlabel = 'enterprise'
  ) THEN
    ALTER TYPE public.subscription_plan ADD VALUE 'enterprise';
  END IF;
END $$;

-- 2. Colunas em public.clinic_subscriptions: trial_card_token e is_read_only
ALTER TABLE public.clinic_subscriptions
  ADD COLUMN IF NOT EXISTS trial_card_token text,
  ADD COLUMN IF NOT EXISTS is_read_only boolean DEFAULT false;

-- 3. Atualizar constraint de status de public.clinic_subscriptions para incluir 'TRIAL_EXPIRED'
ALTER TABLE public.clinic_subscriptions
  DROP CONSTRAINT IF EXISTS clinic_subscriptions_status_check;

ALTER TABLE public.clinic_subscriptions
  ADD CONSTRAINT clinic_subscriptions_status_check
  CHECK (status IN (
    'ACTIVE',
    'PENDING',
    'TRIAL',
    'TRIAL_EXPIRED',
    'BETA',
    'OVERDUE',
    'PAUSED',
    'CANCELED',
    'SUSPENDED',
    'EXPIRED',
    'COURTESY'
  ));

-- 4. Função de checagem de modo somente leitura (Read-Only)
CREATE OR REPLACE FUNCTION public.is_clinic_read_only(_clinic_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
BEGIN
  IF _clinic_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT
    status,
    is_read_only,
    is_free_trial,
    is_courtesy,
    expires_at,
    current_period_end
  INTO v_sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _clinic_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Se flag explícita estiver marcada
  IF COALESCE(v_sub.is_read_only, false) = true THEN
    RETURN true;
  END IF;

  -- Se o status for TRIAL_EXPIRED
  IF v_sub.status = 'TRIAL_EXPIRED' THEN
    RETURN true;
  END IF;

  -- Cortesia parceira ativa nunca fica read-only
  IF COALESCE(v_sub.is_courtesy, false) = true OR v_sub.status = 'COURTESY' THEN
    RETURN false;
  END IF;

  -- Se for TRIAL ou marcado como is_free_trial e expirou sem assinatura ativa
  IF (v_sub.status = 'TRIAL' OR COALESCE(v_sub.is_free_trial, false) = true) THEN
    IF COALESCE(v_sub.expires_at, v_sub.current_period_end) IS NOT NULL
       AND COALESCE(v_sub.expires_at, v_sub.current_period_end) < now() THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_clinic_read_only(uuid) TO authenticated, anon;

-- 5. Helper function para validar se usuário pode ler dados da clínica (bloqueia colaboradores em TRIAL_EXPIRED)
CREATE OR REPLACE FUNCTION public.can_read_clinic_data(_clinic_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub record;
  v_is_owner boolean := false;
BEGIN
  IF v_uid IS NULL OR _clinic_id IS NULL THEN
    RETURN false;
  END IF;

  -- Platform admin bypass
  IF EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE pa.user_id = v_uid AND pa.is_active = true
  ) THEN
    RETURN true;
  END IF;

  -- Verificar se é owner
  IF EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = _clinic_id AND c.account_owner_user_id = v_uid
  ) OR EXISTS (
    SELECT 1 FROM public.clinic_memberships cm
    WHERE cm.clinic_id = _clinic_id
      AND cm.user_id = v_uid
      AND cm.account_role = 'account_owner'
      AND cm.is_active = true
      AND cm.membership_status = 'active'
  ) THEN
    v_is_owner := true;
  END IF;

  -- Checar status da assinatura
  SELECT status, is_free_trial, expires_at, current_period_end INTO v_sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _clinic_id
  LIMIT 1;

  IF FOUND THEN
    -- Se o status for TRIAL_EXPIRED e não for owner, bloqueia leitura completamente
    IF v_sub.status = 'TRIAL_EXPIRED' AND NOT v_is_owner THEN
      RETURN false;
    END IF;

    -- Se for trial expirado sem assinatura ativa e não for owner, bloqueia
    IF (v_sub.status = 'TRIAL' OR COALESCE(v_sub.is_free_trial, false) = true) AND NOT v_is_owner THEN
      IF COALESCE(v_sub.expires_at, v_sub.current_period_end) IS NOT NULL
         AND COALESCE(v_sub.expires_at, v_sub.current_period_end) < now() THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_read_clinic_data(uuid) TO authenticated, anon;

-- 6. Atualizar current_user_can para incorporar is_clinic_read_only e restringir colaboradores em TRIAL_EXPIRED
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
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
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
    AND capability = _capability;

  IF FOUND THEN
    RETURN _override_enabled;
  END IF;

  -- 3. Matriz Padrão Canônica de Permissões
  CASE _capability
    WHEN 'clinic_profile.read' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'clinic_profile.manage' THEN
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
    WHEN 'patients.manage_groups' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'patient_groups.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'patients_groups.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'schedule.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.read_all' THEN
      RETURN _operational_role IN ('owner', 'admin', 'assistant');
    WHEN 'schedule.write' THEN
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
      RETURN false;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_can(text, uuid) TO authenticated, anon;

-- 7. Atualização das Políticas RLS para Blindagem de Escrita (Read-Only) e Leitura Segura

-- A. Tabela public.patients
DROP POLICY IF EXISTS "Users read clinic patients" ON public.patients;
CREATE POLICY "Users read clinic patients" ON public.patients
FOR SELECT TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.can_read_clinic_data(clinic_id)
  AND public.current_user_can('patients.read', clinic_id)
);

DROP POLICY IF EXISTS "Users write clinic patients" ON public.patients;
CREATE POLICY "Users write clinic patients" ON public.patients
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('patients.write', clinic_id)
);

DROP POLICY IF EXISTS "Users update clinic patients" ON public.patients;
CREATE POLICY "Users update clinic patients" ON public.patients
FOR UPDATE TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('patients.write', clinic_id)
)
WITH CHECK (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('patients.write', clinic_id)
);

DROP POLICY IF EXISTS "Users delete clinic patients" ON public.patients;
CREATE POLICY "Users delete clinic patients" ON public.patients
FOR DELETE TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('clinic_profile.manage', clinic_id)
);

-- B. Tabela public.sessions (Prontuários / Atendimentos / Evoluções)
DROP POLICY IF EXISTS "Users read clinic sessions" ON public.sessions;
CREATE POLICY "Users read clinic sessions" ON public.sessions
FOR SELECT TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.can_read_clinic_data(clinic_id)
  AND public.current_user_can('sessions.read', clinic_id)
);

DROP POLICY IF EXISTS "Users insert clinic sessions" ON public.sessions;
CREATE POLICY "Users insert clinic sessions" ON public.sessions
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('sessions.write', clinic_id)
);

DROP POLICY IF EXISTS "Users update clinic sessions" ON public.sessions;
CREATE POLICY "Users update clinic sessions" ON public.sessions
FOR UPDATE TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('sessions.write', clinic_id)
)
WITH CHECK (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('sessions.write', clinic_id)
);

DROP POLICY IF EXISTS "Users delete clinic draft sessions" ON public.sessions;
CREATE POLICY "Users delete clinic draft sessions" ON public.sessions
FOR DELETE TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('session.delete_draft', clinic_id)
  AND (
    public.current_user_is_clinic_manager(clinic_id)
    OR (
      user_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.clinic_memberships
        WHERE clinic_memberships.clinic_id = sessions.clinic_id
          AND clinic_memberships.user_id = (SELECT auth.uid())
          AND clinic_memberships.operational_role = 'professional'
          AND clinic_memberships.is_active = true
          AND clinic_memberships.membership_status = 'active'
      )
    )
  )
);

-- C. Tabela public.agenda_events (Compromissos / Agendamentos)
DROP POLICY IF EXISTS "Users read clinic agenda events" ON public.agenda_events;
CREATE POLICY "Users read clinic agenda events" ON public.agenda_events
FOR SELECT TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.can_read_clinic_data(clinic_id)
  AND public.current_user_can('agenda.read', clinic_id)
);

DROP POLICY IF EXISTS "Users write clinic agenda events" ON public.agenda_events;
CREATE POLICY "Users write clinic agenda events" ON public.agenda_events
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('agenda.write', clinic_id)
);

DROP POLICY IF EXISTS "Users update clinic agenda events" ON public.agenda_events;
CREATE POLICY "Users update clinic agenda events" ON public.agenda_events
FOR UPDATE TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('agenda.write', clinic_id)
)
WITH CHECK (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('agenda.write', clinic_id)
);

DROP POLICY IF EXISTS "Users delete clinic agenda events" ON public.agenda_events;
CREATE POLICY "Users delete clinic agenda events" ON public.agenda_events
FOR DELETE TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('agenda.delete_events', clinic_id)
);

-- D. Tabela public.anamnesis_form_templates (Modelos de Formulários)
DROP POLICY IF EXISTS "Users manage clinic anamnesis form templates" ON public.anamnesis_form_templates;
DROP POLICY IF EXISTS "Users write clinic anamnesis forms" ON public.anamnesis_form_templates;
DROP POLICY IF EXISTS "Users read clinic anamnesis forms" ON public.anamnesis_form_templates;
DROP POLICY IF EXISTS "Users update clinic anamnesis forms" ON public.anamnesis_form_templates;
DROP POLICY IF EXISTS "Users delete clinic anamnesis forms" ON public.anamnesis_form_templates;

CREATE POLICY "Users read clinic anamnesis forms" ON public.anamnesis_form_templates
FOR SELECT TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.can_read_clinic_data(clinic_id)
  AND (
    public.current_user_can('forms.read', clinic_id)
    OR public.current_user_can('anamnesis_forms.read', clinic_id)
  )
);

CREATE POLICY "Users write clinic anamnesis forms" ON public.anamnesis_form_templates
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('forms.manage', clinic_id)
);

CREATE POLICY "Users update clinic anamnesis forms" ON public.anamnesis_form_templates
FOR UPDATE TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('forms.manage', clinic_id)
)
WITH CHECK (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('forms.manage', clinic_id)
);

CREATE POLICY "Users delete clinic anamnesis forms" ON public.anamnesis_form_templates
FOR DELETE TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('forms.manage', clinic_id)
);

-- E. Tabela public.patient_groups (Grupos de Pacientes)
DROP POLICY IF EXISTS "Users read clinic patient_groups" ON public.patient_groups;
CREATE POLICY "Users read clinic patient_groups" ON public.patient_groups
FOR SELECT TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.can_read_clinic_data(clinic_id)
  AND public.current_user_can('patient_groups.read', clinic_id)
);

DROP POLICY IF EXISTS "Users write clinic patient_groups" ON public.patient_groups;
CREATE POLICY "Users write clinic patient_groups" ON public.patient_groups
FOR ALL TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('patient_groups.write', clinic_id)
)
WITH CHECK (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
  AND public.current_user_can('patient_groups.write', clinic_id)
);

-- F. Tabela public.patient_evolution_groups
DROP POLICY IF EXISTS "Users manage clinic evolution groups" ON public.patient_evolution_groups;
CREATE POLICY "Users manage clinic evolution groups" ON public.patient_evolution_groups
FOR ALL TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND (
    (NOT public.is_clinic_read_only(clinic_id) AND public.can_read_clinic_data(clinic_id))
    OR (public.is_clinic_read_only(clinic_id) AND current_user_can('sessions.read', clinic_id))
  )
)
WITH CHECK (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND NOT public.is_clinic_read_only(clinic_id)
);

-- 8. Atualizar trigger sync_clinic_limits_from_subscription para suportar enterprise
CREATE OR REPLACE FUNCTION public.sync_clinic_limits_from_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_subaccount_limit integer;
  v_effective_concurrent_access_limit integer;
BEGIN
  -- Cálculo dos limites totais (base + adicionais comprados)
  IF NEW.plan_type = 'solo' THEN
    v_effective_subaccount_limit := 1;
    v_effective_concurrent_access_limit := 1;
  ELSE
    v_effective_subaccount_limit := coalesce(NEW.base_subaccount_limit, 30) + coalesce(NEW.purchased_subaccount_extra_count, 0);
    v_effective_concurrent_access_limit := coalesce(NEW.base_concurrent_access_count, 2) + coalesce(NEW.additional_concurrent_access_count, 0);
  END IF;

  UPDATE public.clinics
  SET
    subscription_plan = NEW.plan_type,
    subaccount_limit = v_effective_subaccount_limit,
    concurrent_access_limit = v_effective_concurrent_access_limit,
    updated_at = now()
  WHERE id = NEW.clinic_id;

  RETURN NEW;
END;
$$;

-- 9. Dropar assinatura legada e recriar RPC public.activate_clinic_free_trial
DROP FUNCTION IF EXISTS public.activate_clinic_free_trial(uuid, public.subscription_plan);
DROP FUNCTION IF EXISTS public.activate_clinic_free_trial(uuid, text);

CREATE OR REPLACE FUNCTION public.activate_clinic_free_trial(
  _clinic_id uuid,
  _plan_type text DEFAULT 'clinic'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id uuid := auth.uid();
  v_owner_user_id uuid;
  v_is_authorized boolean := false;
  v_typed_plan public.subscription_plan;
  v_trial_duration_days integer := 7;
  v_expires_at timestamptz := now() + interval '7 days';
BEGIN
  IF _clinic_id IS NULL THEN
    RAISE EXCEPTION 'clinic_id é obrigatório para ativar a degustação grátis.';
  END IF;

  -- Validação e coerção do plano
  BEGIN
    v_typed_plan := _plan_type::public.subscription_plan;
  EXCEPTION WHEN OTHERS THEN
    v_typed_plan := 'clinic'::public.subscription_plan;
  END;

  -- 1. Buscar o account_owner_user_id da clínica
  SELECT account_owner_user_id INTO v_owner_user_id
  FROM public.clinics
  WHERE id = _clinic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clínica não encontrada.';
  END IF;

  -- 2. Validação de segurança: verificar se auth.uid() é account_owner ou admin
  IF v_current_user_id IS NOT NULL THEN
    IF v_owner_user_id = v_current_user_id THEN
      v_is_authorized := true;
    ELSIF EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.clinic_id = _clinic_id
        AND cm.user_id = v_current_user_id
        AND cm.account_role = 'account_owner'
        AND cm.is_active = true
        AND cm.membership_status = 'active'
    ) THEN
      v_is_authorized := true;
    ELSIF EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = v_current_user_id
        AND pa.is_active = true
    ) THEN
      v_is_authorized := true;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Acesso negado: apenas o responsável pela clínica (account_owner) ou administrador pode ativar o teste grátis.';
  END IF;

  v_owner_user_id := COALESCE(v_owner_user_id, v_current_user_id);

  -- 3. Realizar UPSERT seguro em public.clinic_subscriptions com parâmetros de 7 dias
  INSERT INTO public.clinic_subscriptions (
    clinic_id,
    account_owner_user_id,
    plan_type,
    billing_cycle,
    payment_method,
    base_monthly_price,
    base_concurrent_access_count,
    total_recurring_monthly_price,
    base_subaccount_limit,
    status,
    is_free_trial,
    is_read_only,
    trial_max_attendances,
    trial_max_patients,
    trial_max_custom_forms,
    period_duration_days,
    current_period_start,
    current_period_end,
    expires_at,
    updated_at
  )
  VALUES (
    _clinic_id,
    v_owner_user_id,
    v_typed_plan,
    'ANNUAL',
    'TRIAL',
    CASE WHEN v_typed_plan = 'solo' THEN 40.00 ELSE 60.00 END,
    4, -- 4 acessos simultâneos no trial
    0,
    CASE WHEN v_typed_plan = 'solo' THEN 1 ELSE 30 END,
    'TRIAL',
    true,
    false,
    20,
    5,
    2, -- 2 formulários editáveis
    v_trial_duration_days,
    now(),
    v_expires_at,
    v_expires_at,
    now()
  )
  ON CONFLICT (clinic_id) DO UPDATE
  SET
    account_owner_user_id = COALESCE(clinic_subscriptions.account_owner_user_id, EXCLUDED.account_owner_user_id),
    plan_type = EXCLUDED.plan_type,
    billing_cycle = 'ANNUAL',
    payment_method = 'TRIAL',
    base_monthly_price = EXCLUDED.base_monthly_price,
    base_concurrent_access_count = 4,
    total_recurring_monthly_price = 0,
    base_subaccount_limit = EXCLUDED.base_subaccount_limit,
    status = 'TRIAL',
    is_free_trial = true,
    is_read_only = false,
    trial_max_attendances = 20,
    trial_max_patients = 5,
    trial_max_custom_forms = 2,
    period_duration_days = v_trial_duration_days,
    current_period_start = now(),
    current_period_end = v_expires_at,
    expires_at = v_expires_at,
    updated_at = now();

  -- 4. Atualizar a clínica em public.clinics
  UPDATE public.clinics
  SET
    subscription_plan = v_typed_plan,
    concurrent_access_limit = 4,
    subaccount_limit = CASE WHEN v_typed_plan = 'solo' THEN 1 ELSE 30 END,
    updated_at = now()
  WHERE id = _clinic_id;

  RETURN jsonb_build_object(
    'success', true,
    'clinic_id', _clinic_id,
    'plan_type', v_typed_plan,
    'status', 'TRIAL',
    'is_free_trial', true,
    'concurrent_access_limit', 4,
    'trial_max_custom_forms', 2,
    'expires_at', v_expires_at,
    'message', 'Degustação grátis de 7 dias ativada com sucesso.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_clinic_free_trial(uuid, text) TO authenticated, anon;

-- Suporte retrocompatível para chamada antiga passando public.subscription_plan
CREATE OR REPLACE FUNCTION public.activate_clinic_free_trial(
  _clinic_id uuid,
  _plan_type public.subscription_plan
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.activate_clinic_free_trial(_clinic_id, _plan_type::text);
$$;

GRANT EXECUTE ON FUNCTION public.activate_clinic_free_trial(uuid, public.subscription_plan) TO authenticated, anon;
