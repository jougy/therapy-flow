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

  IF NOT public.current_user_can('subaccounts.manage', _target_membership.clinic_id) THEN
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

GRANT EXECUTE ON FUNCTION public.update_clinic_member_operational_fields(uuid, text, text, text, public.operational_role_type, public.membership_status_type) TO authenticated;
