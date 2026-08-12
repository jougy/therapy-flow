-- Migration: 20260810120000_fix_handle_signup_and_subaccount_limits.sql
-- Descrição: Ajusta handle_signup e list_current_user_clinics para salvar e retornar subaccount_limit e concurrent_access_limit reais.

-- 1. Atualização da RPC handle_signup
CREATE OR REPLACE FUNCTION public.handle_signup(
  _user_id uuid,
  _email text,
  _cnpj text,
  _subscription_plan public.subscription_plan DEFAULT 'solo',
  _full_name text DEFAULT NULL,
  _clinic_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clinic_id uuid;
  _is_super_admin boolean := false;
  _resolved_clinic_name text := left(nullif(trim(coalesce(_clinic_name, '')), ''), 120);
BEGIN
  SELECT id INTO _clinic_id
  FROM public.clinics
  WHERE cnpj = _cnpj;

  IF _clinic_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ja existe uma clinica cadastrada com este CNPJ.';
  END IF;

  _resolved_clinic_name := coalesce(_resolved_clinic_name, 'Clínica ' || _cnpj);

  INSERT INTO public.clinics (
    cnpj,
    email,
    legal_name,
    name,
    subscription_plan,
    subaccount_limit,
    concurrent_access_limit
  )
  VALUES (
    _cnpj,
    _email,
    _resolved_clinic_name,
    _resolved_clinic_name,
    _subscription_plan,
    CASE WHEN _subscription_plan = 'clinic' THEN 30 ELSE 0 END,
    CASE WHEN _subscription_plan = 'clinic' THEN 2 ELSE 1 END
  )
  RETURNING id INTO _clinic_id;

  INSERT INTO public.profiles (id, clinic_id, email, full_name)
  VALUES (_user_id, _clinic_id, _email, _full_name)
  ON CONFLICT (id) DO UPDATE
  SET clinic_id = EXCLUDED.clinic_id,
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  INSERT INTO public.clinic_memberships (
    clinic_id,
    user_id,
    account_role,
    operational_role,
    membership_status,
    is_active
  )
  VALUES (
    _clinic_id,
    _user_id,
    'account_owner',
    'owner',
    'active',
    true
  )
  ON CONFLICT (clinic_id, user_id) DO NOTHING;

  UPDATE public.clinics
  SET account_owner_user_id = _user_id
  WHERE id = _clinic_id;

  IF _email = 'admin@prontohealthfisio.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    _is_super_admin := true;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'clinic_id', _clinic_id,
    'clinic_name', _resolved_clinic_name,
    'subscription_plan', _subscription_plan,
    'is_super_admin', _is_super_admin
  );
END;
$$;

-- 2. Atualização da RPC list_current_user_clinics
drop function if exists public.list_current_user_clinics();

create or replace function public.list_current_user_clinics()
returns table (
  membership_id uuid,
  clinic_id uuid,
  clinic_route_key text,
  clinic_name text,
  clinic_logo_url text,
  clinic_subscription_plan public.subscription_plan,
  clinic_subaccount_limit integer,
  clinic_concurrent_access_limit integer,
  clinic_active_access_count integer,
  clinic_active_access_users jsonb,
  clinic_account_owner_user_id uuid,
  account_role public.account_role_type,
  operational_role public.operational_role_type,
  membership_status public.membership_status_type,
  is_active boolean,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    clinic_memberships.id as membership_id,
    clinics.id as clinic_id,
    clinics.route_key as clinic_route_key,
    clinics.name as clinic_name,
    clinics.logo_url as clinic_logo_url,
    clinics.subscription_plan as clinic_subscription_plan,
    coalesce(clinics.subaccount_limit, case when clinics.subscription_plan = 'clinic' then 30 else 0 end)::integer as clinic_subaccount_limit,
    coalesce(clinics.concurrent_access_limit, case when clinics.subscription_plan = 'clinic' then 2 else 1 end)::integer as clinic_concurrent_access_limit,
    coalesce(active_accesses.active_access_count, 0)::integer as clinic_active_access_count,
    coalesce(active_accesses.active_access_users, '[]'::jsonb) as clinic_active_access_users,
    clinics.account_owner_user_id as clinic_account_owner_user_id,
    clinic_memberships.account_role,
    clinic_memberships.operational_role,
    clinic_memberships.membership_status,
    clinic_memberships.is_active,
    clinic_memberships.joined_at
  from public.clinic_memberships
  join public.clinics on clinics.id = clinic_memberships.clinic_id
  left join lateral (
    select
      count(*)::integer as active_access_count,
      jsonb_agg(
        jsonb_build_object(
          'user_id', active_sessions.user_id,
          'full_name', profiles.full_name,
          'email', profiles.email,
          'last_seen_at', active_sessions.last_seen_at,
          'device_label', active_sessions.device_label
        )
        order by active_sessions.last_seen_at desc
      ) as active_access_users
    from public.user_security_sessions active_sessions
    left join public.profiles on profiles.id = active_sessions.user_id
    where active_sessions.clinic_id = clinics.id
      and active_sessions.ended_at is null
      and active_sessions.force_signed_out_at is null
      and active_sessions.last_seen_at >= now() - interval '15 minutes'
  ) active_accesses on true
  where clinic_memberships.user_id = auth.uid()
    and clinic_memberships.is_active = true
    and clinic_memberships.membership_status = 'active'
    and clinics.access_status in ('active', 'payment_pending')
  order by clinic_memberships.joined_at asc;
$$;

grant execute on function public.list_current_user_clinics() to authenticated;
