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

  IF NOT public.current_user_can('subaccounts.manage', _target_membership.clinic_id) THEN
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

  PERFORM public.log_security_event(
    _target_membership.clinic_id,
    _requester_id,
    _target_membership.user_id,
    'clinic_access_removed',
    'self',
    jsonb_build_object(
      'membership_id', _membership_id,
      'initiated_by', 'clinic'
    )
  );

  RETURN jsonb_build_object('membership_id', _membership_id, 'status', 'inactive');
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_current_user_clinic(_clinic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _membership public.clinic_memberships%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  SELECT *
  INTO _membership
  FROM public.clinic_memberships
  WHERE clinic_id = _clinic_id
    AND user_id = _user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acesso da clinica nao encontrado.';
  END IF;

  IF _membership.account_role = 'account_owner' OR _membership.operational_role = 'owner' THEN
    RAISE EXCEPTION 'A conta principal nao pode sair da propria clinica por este fluxo.';
  END IF;

  IF _membership.membership_status <> 'active' THEN
    RAISE EXCEPTION 'Este acesso nao esta ativo.';
  END IF;

  UPDATE public.clinic_memberships
  SET
    membership_status = 'inactive',
    is_active = false,
    ended_at = now()
  WHERE id = _membership.id;

  UPDATE public.user_security_sessions
  SET
    ended_at = now(),
    last_seen_at = now()
  WHERE clinic_id = _membership.clinic_id
    AND user_id = _user_id
    AND ended_at IS NULL;

  DELETE FROM public.user_active_clinic_contexts
  WHERE user_id = _user_id
    AND clinic_id = _membership.clinic_id;

  PERFORM public.log_security_event(
    _membership.clinic_id,
    _user_id,
    _user_id,
    'clinic_member_left',
    'admin',
    jsonb_build_object(
      'membership_id', _membership.id,
      'previous_role', _membership.operational_role,
      'initiated_by', 'member'
    )
  );

  PERFORM public.log_security_event(
    _membership.clinic_id,
    _user_id,
    _user_id,
    'clinic_access_removed',
    'self',
    jsonb_build_object(
      'membership_id', _membership.id,
      'initiated_by', 'member'
    )
  );

  RETURN jsonb_build_object('clinic_id', _membership.clinic_id, 'status', 'inactive');
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_clinic_member_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_current_user_clinic(uuid) TO authenticated;
