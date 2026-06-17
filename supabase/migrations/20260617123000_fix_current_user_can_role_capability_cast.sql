create or replace function public.current_user_can(_capability text, _clinic_id uuid default null)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _resolved_clinic_id uuid;
  _account_role public.account_role_type;
  _operational_role public.operational_role_type;
  _membership_status public.membership_status_type;
  _is_active boolean;
  _subscription_plan public.subscription_plan;
  _override_enabled boolean;
begin
  if _user_id is null then
    return false;
  end if;

  _resolved_clinic_id := coalesce(_clinic_id, public.get_user_clinic_id(_user_id));

  if _resolved_clinic_id is not null
    and public.is_platform_owner(_user_id)
    and public.get_active_platform_clinic_id(_user_id) = _resolved_clinic_id then
    return true;
  end if;

  select
    clinic_memberships.account_role,
    clinic_memberships.operational_role,
    clinic_memberships.membership_status,
    clinic_memberships.is_active,
    clinics.subscription_plan
  into
    _account_role,
    _operational_role,
    _membership_status,
    _is_active,
    _subscription_plan
  from public.clinic_memberships
  join public.clinics on clinics.id = clinic_memberships.clinic_id
  where clinic_memberships.user_id = _user_id
    and clinic_memberships.clinic_id = _resolved_clinic_id
  limit 1;

  if _resolved_clinic_id is null
    or _is_active is distinct from true
    or _membership_status is distinct from 'active' then
    return false;
  end if;

  if _account_role = 'account_owner' then
    return true;
  end if;

  if _capability = 'subscription_billing.manage' then
    return false;
  end if;

  select enabled
  into _override_enabled
  from public.clinic_operational_role_capabilities
  where clinic_id = _resolved_clinic_id
    and operational_role = _operational_role::text
    and capability = _capability;

  if found then
    return _override_enabled;
  end if;

  case _capability
    when 'clinic_profile.manage' then
      return _operational_role in ('owner', 'admin');
    when 'forms.manage' then
      return _operational_role in ('owner', 'admin');
    when 'subaccounts.manage' then
      return _subscription_plan = 'clinic' and _operational_role in ('owner', 'admin');
    when 'subaccounts_roles.manage' then
      return _subscription_plan = 'clinic' and _operational_role in ('owner', 'admin');
    when 'treasury.manage' then
      return _operational_role in ('owner', 'admin');
    when 'agenda.delete_events' then
      return _operational_role in ('owner', 'admin');
    when 'subaccounts_analytics.read' then
      return _subscription_plan = 'clinic' and _operational_role in ('owner', 'admin');
    when 'patients.read' then
      return _operational_role in ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    when 'patients.write' then
      return _operational_role in ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    when 'schedule.read' then
      return _operational_role in ('owner', 'admin', 'professional', 'assistant');
    when 'schedule.write' then
      return _operational_role in ('owner', 'admin', 'professional', 'assistant');
    when 'sessions.read' then
      return _operational_role in ('owner', 'admin', 'professional', 'estagiario');
    when 'sessions.write' then
      return _operational_role in ('owner', 'admin', 'professional', 'estagiario');
    when 'session.delete_draft' then
      return _operational_role in ('owner', 'admin', 'professional');
    else
      return false;
  end case;
end;
$$;

grant execute on function public.current_user_can(text, uuid) to authenticated;
