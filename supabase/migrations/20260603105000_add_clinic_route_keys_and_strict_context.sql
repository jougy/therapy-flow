create extension if not exists pgcrypto with schema extensions;

alter table public.clinics
add column if not exists route_key text;

update public.clinics
set route_key = encode(extensions.gen_random_bytes(12), 'hex')
where route_key is null;

alter table public.clinics
alter column route_key set not null;

create unique index if not exists clinics_route_key_key
on public.clinics(route_key);

alter table public.clinics
alter column route_key set default encode(extensions.gen_random_bytes(12), 'hex');

create or replace function public.get_user_clinic_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_active_clinic_contexts.clinic_id
  from public.user_active_clinic_contexts
  where user_active_clinic_contexts.user_id = _user_id
    and public.user_has_active_clinic_membership(_user_id, user_active_clinic_contexts.clinic_id)
  limit 1
$$;

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
    clinics.subaccount_limit as clinic_subaccount_limit,
    nullif(to_jsonb(clinics)->>'concurrent_access_limit', '')::integer as clinic_concurrent_access_limit,
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
  order by
    case when clinic_memberships.account_role = 'account_owner' then 0 else 1 end,
    clinics.name asc,
    clinic_memberships.created_at asc
$$;

create or replace function public.set_current_user_active_clinic_by_route_key(_route_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _clinic_id uuid;
begin
  select clinics.id
  into _clinic_id
  from public.clinics
  where clinics.route_key = _route_key;

  if _clinic_id is null then
    raise exception 'Clinica indisponivel para este usuario.';
  end if;

  return public.set_current_user_active_clinic(_clinic_id);
end;
$$;

grant execute on function public.list_current_user_clinics() to authenticated;
grant execute on function public.set_current_user_active_clinic_by_route_key(text) to authenticated;
