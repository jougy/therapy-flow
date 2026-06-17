alter table public.clinics
  add column if not exists access_status text not null default 'active';

alter table public.clinics
  drop constraint if exists clinics_access_status_check;

alter table public.clinics
  add constraint clinics_access_status_check
  check (access_status in ('active', 'payment_pending', 'temporarily_paused', 'banned'));

create or replace function public.user_has_active_clinic_membership(_user_id uuid, _clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinic_memberships
    join public.clinics on clinics.id = clinic_memberships.clinic_id
    where clinic_memberships.user_id = _user_id
      and clinic_memberships.clinic_id = _clinic_id
      and clinic_memberships.is_active = true
      and clinic_memberships.membership_status = 'active'
      and clinics.access_status in ('active', 'payment_pending')
  )
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
    and clinics.access_status in ('active', 'payment_pending')
  order by
    case when clinic_memberships.account_role = 'account_owner' then 0 else 1 end,
    clinics.name asc,
    clinic_memberships.created_at asc
$$;

grant execute on function public.user_has_active_clinic_membership(uuid, uuid) to authenticated;
grant execute on function public.list_current_user_clinics() to authenticated;
