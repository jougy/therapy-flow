-- Migration: 20260831133000_add_granular_subaccounts_crud_capabilities.sql
-- Adiciona capacidades granulares de CRUD para gestão de colaboradores da clínica:
-- subaccounts.read, subaccounts.write, subaccounts.delete, subaccounts_roles.read.

-- 1. Atualizar constraint clinic_operational_role_capabilities_known
ALTER TABLE public.clinic_operational_role_capabilities
  DROP CONSTRAINT IF EXISTS clinic_operational_role_capabilities_known;

ALTER TABLE public.clinic_operational_role_capabilities
  ADD CONSTRAINT clinic_operational_role_capabilities_known CHECK (
    capability IN (
      'clinic_profile.manage',
      'forms.manage',
      'subaccounts.read',
      'subaccounts.write',
      'subaccounts.manage',
      'subaccounts.delete',
      'subaccounts_roles.read',
      'subaccounts_roles.manage',
      'subscription_billing.manage',
      'treasury.manage',
      'agenda.delete_events',
      'subaccounts_analytics.read',
      'team_development.manage',
      'patients.read',
      'patients.write',
      'patients.delete',
      'patients.manage_groups',
      'schedule.read',
      'schedule.write',
      'schedule.write_others',
      'sessions.read',
      'sessions.write',
      'sessions.read_all',
      'sessions.write_others',
      'sessions.share',
      'sessions.delete',
      'session.delete_draft',
      'system.print'
    )
  );

-- 2. Atualizar função public.current_user_can com as novas capabilities
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
  _override_enabled boolean;
  _sub record;
  _is_subscription_expired boolean := false;
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
    clinics.subscription_plan
  INTO
    _account_role,
    _operational_role,
    _membership_status,
    _is_active,
    _subscription_plan
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

  -- 1. Checagem Rigorosa de Assinatura Expirada no Kernel do Postgres
  SELECT * INTO _sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _resolved_clinic_id
  LIMIT 1;

  IF _sub IS NOT NULL AND _sub.status NOT IN ('BETA', 'TRIAL') THEN
    IF _sub.expires_at IS NOT NULL AND _sub.expires_at < now() THEN
      _is_subscription_expired := true;
    ELSIF _sub.status IN ('EXPIRED', 'SUSPENDED') THEN
      _is_subscription_expired := true;
    END IF;
  END IF;

  -- Se a assinatura estiver expirada, permite APENAS leitura (.read) ou gestao financeira pelo owner
  IF _is_subscription_expired THEN
    IF _capability = 'subscription_billing.manage' AND (_account_role = 'account_owner' OR _operational_role = 'owner') THEN
      RETURN true;
    END IF;
    -- Permite apenas consultas de leitura
    IF _capability IN ('patients.read', 'schedule.read', 'sessions.read', 'sessions.read_all', 'patient_groups.read', 'subaccounts_analytics.read', 'subaccounts.read', 'subaccounts_roles.read') THEN
      RETURN true;
    END IF;
    -- Qualquer escrita e bloqueada
    RETURN false;
  END IF;

  -- Se nao estiver expirado, owner possui acesso pleno:
  IF _account_role = 'account_owner' OR _operational_role = 'owner' THEN
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

  -- 3. Matriz Padrao Canonica de Permissoes
  CASE _capability
    WHEN 'clinic_profile.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'forms.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.read' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.write' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.manage' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.delete' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.read' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.manage' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'team_development.manage' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'treasury.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'agenda.delete_events' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_analytics.read' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
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
    WHEN 'schedule.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
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

-- 3. Atualizar RPC invite_clinic_collaborator para aceitar subaccounts.write ou subaccounts.manage
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

  IF NOT (public.current_user_can('subaccounts.write', _resolved_clinic_id) OR public.current_user_can('subaccounts.manage', _resolved_clinic_id)) THEN
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
    existing_user_id,
    status
  )
  VALUES (
    _resolved_clinic_id,
    _normalized_email,
    _operational_role,
    NULLIF(trim(_job_title), ''),
    NULLIF(trim(_specialty), ''),
    _token_hash,
    _requester_id,
    _existing_user_id,
    'pending'
  )
  RETURNING id INTO _invitation_id;

  PERFORM public.log_security_event(
    _resolved_clinic_id,
    _requester_id,
    _existing_user_id,
    'clinic_collaborator_invited',
    'admin',
    jsonb_build_object(
      'invitation_id', _invitation_id,
      'email', _normalized_email,
      'operational_role', _operational_role,
      'job_title', _job_title,
      'specialty', _specialty
    )
  );

  RETURN jsonb_build_object(
    'invitation_id', _invitation_id,
    'token', _token,
    'status', 'pending'
  );
END;
$$;

-- 4. Atualizar RPC cancel_clinic_collaborator_invitation
CREATE OR REPLACE FUNCTION public.cancel_clinic_collaborator_invitation(_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT *
  INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE id = _invitation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF NOT (
    public.current_user_can('subaccounts.delete', _invitation.clinic_id)
    OR public.current_user_can('subaccounts.write', _invitation.clinic_id)
    OR public.current_user_can('subaccounts.manage', _invitation.clinic_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar este convite.';
  END IF;

  IF _invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Apenas convites pendentes podem ser cancelados.';
  END IF;

  UPDATE public.clinic_collaborator_invitations
  SET status = 'cancelled', updated_at = now()
  WHERE id = _invitation_id;

  PERFORM public.log_security_event(
    _invitation.clinic_id,
    _requester_id,
    _invitation.existing_user_id,
    'clinic_collaborator_invite_cancelled',
    'admin',
    jsonb_build_object('invitation_id', _invitation_id, 'email', _invitation.email)
  );

  RETURN jsonb_build_object('invitation_id', _invitation_id, 'status', 'cancelled');
END;
$$;

-- 5. Atualizar RPC update_clinic_member_operational_fields
CREATE OR REPLACE FUNCTION public.update_clinic_member_operational_fields(
  _membership_id uuid,
  _job_title text DEFAULT NULL,
  _specialty text DEFAULT NULL,
  _working_hours text DEFAULT NULL,
  _operational_role public.operational_role_type DEFAULT NULL,
  _membership_status public.membership_status_type DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _target_membership public.clinic_memberships%ROWTYPE;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  SELECT *
  INTO _target_membership
  FROM public.clinic_memberships
  WHERE id = _membership_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador nao encontrado.';
  END IF;

  IF _target_membership.account_role = 'account_owner' THEN
    RAISE EXCEPTION 'A conta principal nao pode ser editada por este fluxo.';
  END IF;

  IF NOT (
    public.current_user_can('subaccounts.manage', _target_membership.clinic_id)
    OR public.current_user_can('subaccounts.write', _target_membership.clinic_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissao para editar colaboradores nesta clinica.';
  END IF;

  IF _operational_role IS NOT NULL AND NOT public.current_user_can('subaccounts_roles.manage', _target_membership.clinic_id) THEN
    RAISE EXCEPTION 'Sem permissao para alterar a hierarquia deste colaborador.';
  END IF;

  IF _operational_role = 'owner' THEN
    RAISE EXCEPTION 'O papel owner fica reservado para a conta principal.';
  END IF;

  IF _membership_status IS NOT NULL AND _membership_status = 'invited' THEN
    RAISE EXCEPTION 'Status convidado e controlado pelo fluxo de convites.';
  END IF;

  UPDATE public.profiles
  SET
    job_title = CASE WHEN _job_title IS NULL THEN job_title ELSE NULLIF(trim(_job_title), '') END,
    specialty = CASE WHEN _specialty IS NULL THEN specialty ELSE NULLIF(trim(_specialty), '') END,
    working_hours = CASE WHEN _working_hours IS NULL THEN working_hours ELSE NULLIF(trim(_working_hours), '') END,
    updated_at = now()
  WHERE id = _target_membership.user_id;

  UPDATE public.clinic_memberships
  SET
    operational_role = COALESCE(_operational_role, operational_role),
    membership_status = COALESCE(_membership_status, membership_status),
    is_active = CASE
      WHEN COALESCE(_membership_status, membership_status) = 'active' THEN true
      ELSE false
    END,
    ended_at = CASE
      WHEN COALESCE(_membership_status, membership_status) = 'active' THEN NULL
      WHEN ended_at IS NULL THEN now()
      ELSE ended_at
    END
  WHERE id = _membership_id;

  IF _operational_role IS NOT NULL AND _operational_role IS DISTINCT FROM _target_membership.operational_role THEN
    PERFORM public.log_security_event(
      _target_membership.clinic_id,
      _requester_id,
      _target_membership.user_id,
      'subaccount_role_changed',
      'admin',
      jsonb_build_object(
        'from', _target_membership.operational_role,
        'to', _operational_role
      )
    );
  END IF;

  IF _membership_status IS NOT NULL AND _membership_status IS DISTINCT FROM _target_membership.membership_status THEN
    PERFORM public.log_security_event(
      _target_membership.clinic_id,
      _requester_id,
      _target_membership.user_id,
      'subaccount_status_changed',
      'admin',
      jsonb_build_object(
        'from', _target_membership.membership_status,
        'to', _membership_status
      )
    );
  END IF;

  RETURN jsonb_build_object('membership_id', _membership_id);
END;
$$;

-- 6. Atualizar RPC revoke_clinic_member_access para aceitar subaccounts.delete ou subaccounts.manage
CREATE OR REPLACE FUNCTION public.revoke_clinic_member_access(_membership_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _target_membership public.clinic_memberships%ROWTYPE;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  SELECT *
  INTO _target_membership
  FROM public.clinic_memberships
  WHERE id = _membership_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador nao encontrado.';
  END IF;

  IF _target_membership.account_role = 'account_owner' OR _target_membership.operational_role = 'owner' THEN
    RAISE EXCEPTION 'A conta principal nao pode ser removida da clinica.';
  END IF;

  IF _target_membership.user_id = _requester_id THEN
    RAISE EXCEPTION 'Use o fluxo do espaco pessoal para remover seu proprio acesso.';
  END IF;

  IF NOT (
    public.current_user_can('subaccounts.delete', _target_membership.clinic_id)
    OR public.current_user_can('subaccounts.manage', _target_membership.clinic_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissao para remover colaboradores desta clinica.';
  END IF;

  UPDATE public.clinic_memberships
  SET
    membership_status = 'inactive',
    is_active = false,
    ended_at = now()
  WHERE id = _membership_id;

  UPDATE public.user_security_sessions
  SET
    ended_at = now(),
    force_signed_out_at = now(),
    forced_out_by = _requester_id,
    last_seen_at = now()
  WHERE clinic_id = _target_membership.clinic_id
    AND user_id = _target_membership.user_id
    AND ended_at IS NULL;

  DELETE FROM public.user_active_clinic_contexts
  WHERE user_id = _target_membership.user_id
    AND clinic_id = _target_membership.clinic_id;

  PERFORM public.log_security_event(
    _target_membership.clinic_id,
    _requester_id,
    _target_membership.user_id,
    'clinic_member_access_revoked',
    'admin',
    jsonb_build_object(
      'membership_id', _membership_id,
      'previous_status', _target_membership.membership_status,
      'previous_role', _target_membership.operational_role,
      'initiated_by', 'clinic'
    )
  );

  RETURN jsonb_build_object('membership_id', _membership_id, 'status', 'inactive');
END;
$$;
