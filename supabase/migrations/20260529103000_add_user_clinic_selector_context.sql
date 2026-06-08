create table if not exists public.user_active_clinic_contexts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.user_active_clinic_contexts enable row level security;

drop trigger if exists update_user_active_clinic_contexts_updated_at on public.user_active_clinic_contexts;
create trigger update_user_active_clinic_contexts_updated_at
before update on public.user_active_clinic_contexts
for each row
execute function public.update_updated_at_column();

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
    where clinic_memberships.user_id = _user_id
      and clinic_memberships.clinic_id = _clinic_id
      and clinic_memberships.is_active = true
      and clinic_memberships.membership_status = 'active'
  )
$$;

create or replace function public.get_user_clinic_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with active_context as (
    select user_active_clinic_contexts.clinic_id
    from public.user_active_clinic_contexts
    where user_active_clinic_contexts.user_id = _user_id
      and public.user_has_active_clinic_membership(_user_id, user_active_clinic_contexts.clinic_id)
    limit 1
  ),
  default_context as (
    select clinic_memberships.clinic_id
    from public.clinic_memberships
    where clinic_memberships.user_id = _user_id
      and clinic_memberships.is_active = true
      and clinic_memberships.membership_status = 'active'
    order by
      case when clinic_memberships.account_role = 'account_owner' then 0 else 1 end,
      clinic_memberships.created_at asc
    limit 1
  )
  select coalesce(
    (select active_context.clinic_id from active_context),
    (select default_context.clinic_id from default_context)
  )
$$;

drop function if exists public.list_current_user_clinics();

create or replace function public.list_current_user_clinics()
returns table (
  membership_id uuid,
  clinic_id uuid,
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

create or replace function public.set_current_user_active_clinic(_clinic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
begin
  if _user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if not public.user_has_active_clinic_membership(_user_id, _clinic_id) then
    raise exception 'Clinica indisponivel para este usuario.';
  end if;

  insert into public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
  values (_user_id, _clinic_id, now())
  on conflict (user_id)
  do update set clinic_id = excluded.clinic_id, updated_at = now();

  return jsonb_build_object('clinic_id', _clinic_id);
end;
$$;

drop policy if exists "Users read own active clinic context" on public.user_active_clinic_contexts;
create policy "Users read own active clinic context" on public.user_active_clinic_contexts
for select to authenticated
using (user_id = auth.uid());

grant execute on function public.user_has_active_clinic_membership(uuid, uuid) to authenticated;
grant execute on function public.list_current_user_clinics() to authenticated;
grant execute on function public.set_current_user_active_clinic(uuid) to authenticated;
