-- Migration: Add RPCs for managing pending collaborator invitations and unconfirmed users in clinic backoffice
-- Date: 2026-08-17

-- 1. Function to list pending collaborator invitations with detailed account status
CREATE OR REPLACE FUNCTION public.get_clinic_pending_collaborator_invitations(_clinic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _invitations jsonb;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF NOT (
    public.current_user_can('subaccounts.manage', _clinic_id) OR
    public.current_user_can('subaccounts_roles.manage', _clinic_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar convites desta clínica.';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'clinic_id', i.clinic_id,
      'email', i.email,
      'operational_role', i.operational_role,
      'job_title', i.job_title,
      'specialty', i.specialty,
      'token_hash', i.token_hash,
      'status', i.status,
      'created_at', i.created_at,
      'expires_at', i.expires_at,
      'existing_user_id', i.existing_user_id,
      'account_state', CASE
        WHEN u.id IS NOT NULL AND u.email_confirmed_at IS NULL THEN 'registered_unconfirmed'
        WHEN u.id IS NOT NULL AND u.email_confirmed_at IS NOT NULL THEN 'registered_confirmed_pending_acceptance'
        ELSE 'invite_sent'
      END,
      'pending_reason', CASE
        WHEN u.id IS NOT NULL AND u.email_confirmed_at IS NULL THEN 'Conta criada no sistema. Aguardando confirmação do e-mail cadastrado.'
        WHEN u.id IS NOT NULL AND u.email_confirmed_at IS NOT NULL THEN 'E-mail verificado! Aguardando login para ativar o acesso à clínica.'
        ELSE 'Convite enviado por e-mail. Aguardando abertura do link e cadastro da senha.'
      END
    ) ORDER BY i.created_at DESC
  )
  INTO _invitations
  FROM public.clinic_collaborator_invitations i
  LEFT JOIN auth.users u ON lower(u.email) = lower(i.email)
  WHERE i.clinic_id = _clinic_id
    AND i.status = 'pending';

  RETURN COALESCE(_invitations, '[]'::jsonb);
END;
$$;

-- 2. Function to cancel a pending collaborator invitation
CREATE OR REPLACE FUNCTION public.cancel_clinic_collaborator_invitation(_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE id = _invitation_id
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF NOT public.current_user_can('subaccounts.manage', _invitation.clinic_id) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar convites desta clínica.';
  END IF;

  UPDATE public.clinic_collaborator_invitations
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = _invitation_id;

  -- Update any matching invited membership if existing
  UPDATE public.clinic_memberships
  SET membership_status = 'inactive',
      is_active = false,
      ended_at = now()
  WHERE clinic_id = _invitation.clinic_id
    AND membership_status = 'invited'
    AND user_id IN (
      SELECT id FROM auth.users WHERE lower(email) = lower(_invitation.email)
    );

  RETURN jsonb_build_object(
    'success', true,
    'id', _invitation_id,
    'status', 'cancelled'
  );
END;
$$;

-- 3. Function to update a pending collaborator invitation
CREATE OR REPLACE FUNCTION public.update_clinic_collaborator_invitation(
  _invitation_id uuid,
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
  _invitation public.clinic_collaborator_invitations%ROWTYPE;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO _invitation
  FROM public.clinic_collaborator_invitations
  WHERE id = _invitation_id
  LIMIT 1;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF _invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Apenas convites pendentes podem ser editados.';
  END IF;

  IF NOT public.current_user_can('subaccounts.manage', _invitation.clinic_id) THEN
    RAISE EXCEPTION 'Sem permissão para editar convites desta clínica.';
  END IF;

  UPDATE public.clinic_collaborator_invitations
  SET operational_role = _operational_role,
      job_title = NULLIF(trim(coalesce(_job_title, '')), ''),
      specialty = NULLIF(trim(coalesce(_specialty, '')), ''),
      updated_at = now()
  WHERE id = _invitation_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', _invitation_id,
    'operational_role', _operational_role,
    'job_title', _job_title,
    'specialty', _specialty
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_clinic_pending_collaborator_invitations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_clinic_collaborator_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_clinic_collaborator_invitation(uuid, public.operational_role_type, text, text) TO authenticated;
