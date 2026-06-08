create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'platform_admin_role') then
    create type public.platform_admin_role as enum ('platform_owner');
  end if;

  if not exists (select 1 from pg_type where typname = 'feature_flag_scope') then
    create type public.feature_flag_scope as enum ('global', 'clinic');
  end if;
end $$;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.platform_admin_role not null default 'platform_owner',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  last_used_at timestamptz
);

create table if not exists public.platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  actor_platform_role public.platform_admin_role not null,
  clinic_id uuid references public.clinics(id) on delete set null,
  event_type text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  scope public.feature_flag_scope not null default 'global',
  clinic_id uuid references public.clinics(id) on delete cascade,
  value jsonb not null default 'false'::jsonb,
  description text,
  starts_at timestamptz,
  expires_at timestamptz,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feature_flags_key_not_blank check (btrim(key) <> ''),
  constraint feature_flags_scope_clinic_check check (
    (scope = 'global' and clinic_id is null)
    or (scope = 'clinic' and clinic_id is not null)
  )
);

create table if not exists public.platform_clinic_access_sessions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  reason text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_seen_at timestamptz not null default now()
);

create unique index if not exists feature_flags_global_key_key
on public.feature_flags (key)
where scope = 'global';

create unique index if not exists feature_flags_clinic_key_key
on public.feature_flags (clinic_id, key)
where scope = 'clinic';

create index if not exists idx_platform_audit_events_created_at
on public.platform_audit_events (created_at desc);

create index if not exists idx_platform_audit_events_clinic_created_at
on public.platform_audit_events (clinic_id, created_at desc);

create index if not exists idx_feature_flags_scope_clinic
on public.feature_flags (scope, clinic_id);

create unique index if not exists idx_platform_clinic_access_sessions_one_active
on public.platform_clinic_access_sessions (actor_user_id)
where ended_at is null;

alter table public.platform_admins enable row level security;
alter table public.platform_audit_events enable row level security;
alter table public.feature_flags enable row level security;
alter table public.platform_clinic_access_sessions enable row level security;

drop trigger if exists update_feature_flags_updated_at on public.feature_flags;
create trigger update_feature_flags_updated_at
before update on public.feature_flags
for each row
execute function public.update_updated_at_column();

create or replace function public.is_platform_owner(_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins
    where platform_admins.user_id = _user_id
      and platform_admins.role = 'platform_owner'
      and platform_admins.is_active = true
  )
$$;

create or replace function public.get_current_platform_role()
returns public.platform_admin_role
language sql
stable
security definer
set search_path = public
as $$
  select platform_admins.role
  from public.platform_admins
  where platform_admins.user_id = auth.uid()
    and platform_admins.is_active = true
  limit 1
$$;

create or replace function public.get_active_platform_clinic_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select platform_clinic_access_sessions.clinic_id
  from public.platform_clinic_access_sessions
  where platform_clinic_access_sessions.actor_user_id = _user_id
    and platform_clinic_access_sessions.ended_at is null
    and public.is_platform_owner(_user_id)
  order by platform_clinic_access_sessions.started_at desc
  limit 1
$$;

create or replace function public.log_platform_audit_event(
  _event_type text,
  _clinic_id uuid default null,
  _reason text default null,
  _metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _role public.platform_admin_role;
  _event_id uuid;
begin
  if _user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select public.get_current_platform_role() into _role;

  if _role is null then
    raise exception 'Acesso de plataforma indisponivel.';
  end if;

  insert into public.platform_audit_events (
    actor_user_id,
    actor_platform_role,
    clinic_id,
    event_type,
    reason,
    metadata
  )
  values (
    _user_id,
    _role,
    _clinic_id,
    left(btrim(_event_type), 120),
    nullif(left(coalesce(_reason, ''), 1000), ''),
    coalesce(_metadata, '{}'::jsonb)
  )
  returning id into _event_id;

  update public.platform_admins
  set last_used_at = now()
  where user_id = _user_id;

  return _event_id;
end;
$$;

create or replace function public.get_user_clinic_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with platform_context as (
    select public.get_active_platform_clinic_id(_user_id) as clinic_id
  ),
  active_context as (
    select user_active_clinic_contexts.clinic_id
    from public.user_active_clinic_contexts
    where user_active_clinic_contexts.user_id = _user_id
      and (
        public.user_has_active_clinic_membership(_user_id, user_active_clinic_contexts.clinic_id)
        or user_active_clinic_contexts.clinic_id = (select clinic_id from platform_context)
      )
    limit 1
  )
  select coalesce(
    (select clinic_id from platform_context),
    (select active_context.clinic_id from active_context)
  )
$$;

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

  case _capability
    when 'clinic_profile.manage' then
      return _operational_role in ('owner', 'admin');
    when 'forms.manage' then
      return _operational_role in ('owner', 'admin');
    when 'subaccounts.manage' then
      return _subscription_plan = 'clinic' and _operational_role in ('owner', 'admin');
    when 'subaccounts_roles.manage' then
      return _subscription_plan = 'clinic' and _operational_role in ('owner', 'admin');
    when 'subscription_billing.manage' then
      return false;
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

create or replace function public.raise_exception_json(_message text)
returns jsonb
language plpgsql
stable
as $$
begin
  raise exception '%', _message;
end;
$$;

create or replace function public.get_platform_dashboard()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case
    when not public.is_platform_owner(auth.uid()) then
      (select raise_exception_json('Acesso de plataforma indisponivel.'))
    else jsonb_build_object(
      'totals', jsonb_build_object(
        'clinics', (select count(*) from public.clinics),
        'profiles', (select count(*) from public.profiles),
        'patients', (select count(*) from public.patients),
        'sessions', (select count(*) from public.sessions),
        'activeFeatureFlags', (
          select count(*)
          from public.feature_flags
          where coalesce(starts_at, '-infinity'::timestamptz) <= now()
            and coalesce(expires_at, 'infinity'::timestamptz) > now()
        )
      ),
      'recentAuditEvents', coalesce((
        select jsonb_agg(event_row order by created_at desc)
        from (
          select
            platform_audit_events.id,
            platform_audit_events.event_type,
            platform_audit_events.reason,
            platform_audit_events.created_at,
            platform_audit_events.clinic_id,
            clinics.name as clinic_name,
            profiles.email as actor_email,
            profiles.full_name as actor_name
          from public.platform_audit_events
          left join public.clinics on clinics.id = platform_audit_events.clinic_id
          left join public.profiles on profiles.id = platform_audit_events.actor_user_id
          order by platform_audit_events.created_at desc
          limit 12
        ) event_row
      ), '[]'::jsonb),
      'recentSecurityEvents', coalesce((
        select jsonb_agg(event_row order by created_at desc)
        from (
          select
            security_events.id,
            security_events.event_type,
            security_events.created_at,
            security_events.clinic_id,
            clinics.name as clinic_name,
            profiles.email as target_email
          from public.security_events
          left join public.clinics on clinics.id = security_events.clinic_id
          left join public.profiles on profiles.id = security_events.target_user_id
          order by security_events.created_at desc
          limit 12
        ) event_row
      ), '[]'::jsonb)
    )
  end
$$;

create or replace function public.list_platform_clinics()
returns table (
  clinic_id uuid,
  clinic_route_key text,
  clinic_name text,
  clinic_cnpj text,
  clinic_subscription_plan public.subscription_plan,
  clinic_subaccount_limit integer,
  clinic_concurrent_access_limit integer,
  clinic_created_at timestamptz,
  clinic_updated_at timestamptz,
  owner_user_id uuid,
  owner_name text,
  owner_email text,
  collaborators_count bigint,
  patients_count bigint,
  sessions_count bigint,
  active_flags_count bigint,
  last_activity_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    clinics.id,
    clinics.route_key,
    clinics.name,
    clinics.cnpj,
    clinics.subscription_plan,
    clinics.subaccount_limit,
    nullif(to_jsonb(clinics)->>'concurrent_access_limit', '')::integer,
    clinics.created_at,
    clinics.updated_at,
    clinics.account_owner_user_id,
    owner_profile.full_name,
    owner_profile.email,
    coalesce(membership_counts.total, 0),
    coalesce(patient_counts.total, 0),
    coalesce(session_counts.total, 0),
    coalesce(flag_counts.total, 0),
    greatest(
      clinics.updated_at,
      coalesce(patient_counts.last_activity_at, clinics.updated_at),
      coalesce(session_counts.last_activity_at, clinics.updated_at)
    )
  from public.clinics
  left join public.profiles owner_profile on owner_profile.id = clinics.account_owner_user_id
  left join lateral (
    select count(*) as total
    from public.clinic_memberships
    where clinic_memberships.clinic_id = clinics.id
      and clinic_memberships.is_active = true
      and clinic_memberships.membership_status = 'active'
  ) membership_counts on true
  left join lateral (
    select count(*) as total, max(updated_at) as last_activity_at
    from public.patients
    where patients.clinic_id = clinics.id
  ) patient_counts on true
  left join lateral (
    select count(*) as total, max(updated_at) as last_activity_at
    from public.sessions
    where sessions.clinic_id = clinics.id
  ) session_counts on true
  left join lateral (
    select count(*) as total
    from public.feature_flags
    where feature_flags.clinic_id = clinics.id
      and coalesce(feature_flags.starts_at, '-infinity'::timestamptz) <= now()
      and coalesce(feature_flags.expires_at, 'infinity'::timestamptz) > now()
  ) flag_counts on true
  where public.is_platform_owner(auth.uid())
  order by clinics.updated_at desc nulls last, clinics.created_at desc
$$;

create or replace function public.get_platform_clinic_detail(_clinic_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case
    when not public.is_platform_owner(auth.uid()) then
      public.raise_exception_json('Acesso de plataforma indisponivel.')
    else (
      select jsonb_build_object(
        'clinic', to_jsonb(clinics),
        'owner', to_jsonb(owner_profile),
        'counts', jsonb_build_object(
          'collaborators', (select count(*) from public.clinic_memberships where clinic_id = clinics.id and is_active = true),
          'patients', (select count(*) from public.patients where clinic_id = clinics.id),
          'sessions', (select count(*) from public.sessions where clinic_id = clinics.id),
          'agendaEvents', (select count(*) from public.agenda_events where clinic_id = clinics.id)
        ),
        'memberships', coalesce((
          select jsonb_agg(member_row order by member_row.full_name nulls last, member_row.email nulls last)
          from (
            select
              clinic_memberships.id,
              clinic_memberships.user_id,
              clinic_memberships.account_role,
              clinic_memberships.operational_role,
              clinic_memberships.membership_status,
              clinic_memberships.is_active,
              clinic_memberships.joined_at,
              profiles.full_name,
              profiles.email
            from public.clinic_memberships
            left join public.profiles on profiles.id = clinic_memberships.user_id
            where clinic_memberships.clinic_id = clinics.id
          ) member_row
        ), '[]'::jsonb)
      )
      from public.clinics
      left join public.profiles owner_profile on owner_profile.id = clinics.account_owner_user_id
      where clinics.id = _clinic_id
    )
  end
$$;

create or replace function public.list_platform_audit_events(_clinic_id uuid default null, _limit integer default 80)
returns table (
  id uuid,
  actor_user_id uuid,
  actor_email text,
  actor_name text,
  actor_platform_role public.platform_admin_role,
  clinic_id uuid,
  clinic_name text,
  event_type text,
  reason text,
  metadata jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    platform_audit_events.id,
    platform_audit_events.actor_user_id,
    actor_profile.email,
    actor_profile.full_name,
    platform_audit_events.actor_platform_role,
    platform_audit_events.clinic_id,
    clinics.name,
    platform_audit_events.event_type,
    platform_audit_events.reason,
    platform_audit_events.metadata,
    platform_audit_events.created_at
  from public.platform_audit_events
  left join public.profiles actor_profile on actor_profile.id = platform_audit_events.actor_user_id
  left join public.clinics on clinics.id = platform_audit_events.clinic_id
  where public.is_platform_owner(auth.uid())
    and (_clinic_id is null or platform_audit_events.clinic_id = _clinic_id)
  order by platform_audit_events.created_at desc
  limit least(greatest(coalesce(_limit, 80), 1), 200)
$$;

create or replace function public.list_feature_flags(_clinic_id uuid default null)
returns table (
  id uuid,
  key text,
  scope public.feature_flag_scope,
  clinic_id uuid,
  clinic_name text,
  value jsonb,
  description text,
  starts_at timestamptz,
  expires_at timestamptz,
  reason text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  is_active_now boolean
)
language sql
security definer
set search_path = public
as $$
  select
    feature_flags.id,
    feature_flags.key,
    feature_flags.scope,
    feature_flags.clinic_id,
    clinics.name,
    feature_flags.value,
    feature_flags.description,
    feature_flags.starts_at,
    feature_flags.expires_at,
    feature_flags.reason,
    feature_flags.created_by,
    feature_flags.updated_by,
    feature_flags.created_at,
    feature_flags.updated_at,
    coalesce(feature_flags.starts_at, '-infinity'::timestamptz) <= now()
      and coalesce(feature_flags.expires_at, 'infinity'::timestamptz) > now()
  from public.feature_flags
  left join public.clinics on clinics.id = feature_flags.clinic_id
  where public.is_platform_owner(auth.uid())
    and (_clinic_id is null or feature_flags.clinic_id = _clinic_id or feature_flags.scope = 'global')
  order by feature_flags.scope, feature_flags.key
$$;

create or replace function public.upsert_feature_flag(
  _key text,
  _scope public.feature_flag_scope,
  _clinic_id uuid default null,
  _value jsonb default 'false'::jsonb,
  _description text default null,
  _starts_at timestamptz default null,
  _expires_at timestamptz default null,
  _reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _clean_key text := lower(regexp_replace(btrim(coalesce(_key, '')), '[^a-zA-Z0-9_.:-]+', '_', 'g'));
  _target_id uuid;
  _previous jsonb;
  _next jsonb;
begin
  if not public.is_platform_owner(_user_id) then
    raise exception 'Acesso de plataforma indisponivel.';
  end if;

  if _clean_key = '' then
    raise exception 'Informe uma chave de feature flag.';
  end if;

  if _scope = 'global' then
    _clinic_id := null;
  elsif _clinic_id is null then
    raise exception 'Informe uma clinica para flag por clinica.';
  end if;

  select to_jsonb(feature_flags.*)
  into _previous
  from public.feature_flags
  where feature_flags.key = _clean_key
    and feature_flags.scope = _scope
    and feature_flags.clinic_id is not distinct from _clinic_id
  limit 1;

  insert into public.feature_flags (
    key,
    scope,
    clinic_id,
    value,
    description,
    starts_at,
    expires_at,
    reason,
    created_by,
    updated_by
  )
  values (
    _clean_key,
    _scope,
    _clinic_id,
    coalesce(_value, 'false'::jsonb),
    nullif(left(coalesce(_description, ''), 500), ''),
    _starts_at,
    _expires_at,
    nullif(left(coalesce(_reason, ''), 1000), ''),
    _user_id,
    _user_id
  )
  on conflict (key) where scope = 'global'
  do nothing;

  if _scope = 'global' then
    update public.feature_flags
    set
      value = coalesce(_value, 'false'::jsonb),
      description = nullif(left(coalesce(_description, ''), 500), ''),
      starts_at = _starts_at,
      expires_at = _expires_at,
      reason = nullif(left(coalesce(_reason, ''), 1000), ''),
      updated_by = _user_id,
      updated_at = now()
    where key = _clean_key
      and scope = 'global'
    returning id into _target_id;
  else
    insert into public.feature_flags (
      key,
      scope,
      clinic_id,
      value,
      description,
      starts_at,
      expires_at,
      reason,
      created_by,
      updated_by
    )
    values (
      _clean_key,
      _scope,
      _clinic_id,
      coalesce(_value, 'false'::jsonb),
      nullif(left(coalesce(_description, ''), 500), ''),
      _starts_at,
      _expires_at,
      nullif(left(coalesce(_reason, ''), 1000), ''),
      _user_id,
      _user_id
    )
    on conflict (clinic_id, key) where scope = 'clinic'
    do nothing;

    update public.feature_flags
    set
      value = coalesce(_value, 'false'::jsonb),
      description = nullif(left(coalesce(_description, ''), 500), ''),
      starts_at = _starts_at,
      expires_at = _expires_at,
      reason = nullif(left(coalesce(_reason, ''), 1000), ''),
      updated_by = _user_id,
      updated_at = now()
    where key = _clean_key
      and scope = 'clinic'
      and clinic_id = _clinic_id
    returning id into _target_id;
  end if;

  select to_jsonb(feature_flags.*)
  into _next
  from public.feature_flags
  where id = _target_id;

  perform public.log_platform_audit_event(
    'feature_flag_upserted',
    _clinic_id,
    _reason,
    jsonb_build_object('before', coalesce(_previous, 'null'::jsonb), 'after', _next)
  );

  return _target_id;
end;
$$;

create or replace function public.start_platform_clinic_access(_clinic_id uuid, _reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _clinic public.clinics%rowtype;
  _reason_clean text := nullif(left(btrim(coalesce(_reason, '')), 1000), '');
begin
  if not public.is_platform_owner(_user_id) then
    raise exception 'Acesso de plataforma indisponivel.';
  end if;

  if _reason_clean is null then
    raise exception 'Informe o motivo para acessar a clinica.';
  end if;

  select *
  into _clinic
  from public.clinics
  where id = _clinic_id;

  if _clinic.id is null then
    raise exception 'Clinica nao encontrada.';
  end if;

  update public.platform_clinic_access_sessions
  set ended_at = now(), last_seen_at = now()
  where actor_user_id = _user_id
    and ended_at is null;

  insert into public.platform_clinic_access_sessions (actor_user_id, clinic_id, reason)
  values (_user_id, _clinic_id, _reason_clean);

  insert into public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
  values (_user_id, _clinic_id, now())
  on conflict (user_id)
  do update set clinic_id = excluded.clinic_id, updated_at = now();

  perform public.log_platform_audit_event(
    'platform_clinic_access_started',
    _clinic_id,
    _reason_clean,
    jsonb_build_object('clinic_name', _clinic.name, 'clinic_route_key', _clinic.route_key)
  );

  return jsonb_build_object(
    'clinic', jsonb_build_object(
      'id', _clinic.id,
      'name', _clinic.name,
      'logo_url', _clinic.logo_url,
      'route_key', _clinic.route_key,
      'subscription_plan', _clinic.subscription_plan,
      'subaccount_limit', _clinic.subaccount_limit,
      'concurrent_access_limit', nullif(to_jsonb(_clinic)->>'concurrent_access_limit', '')::integer,
      'account_owner_user_id', _clinic.account_owner_user_id
    ),
    'reason', _reason_clean
  );
end;
$$;

create or replace function public.end_platform_clinic_access()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _clinic_id uuid;
begin
  if not public.is_platform_owner(_user_id) then
    raise exception 'Acesso de plataforma indisponivel.';
  end if;

  select clinic_id
  into _clinic_id
  from public.platform_clinic_access_sessions
  where actor_user_id = _user_id
    and ended_at is null
  order by started_at desc
  limit 1;

  update public.platform_clinic_access_sessions
  set ended_at = now(), last_seen_at = now()
  where actor_user_id = _user_id
    and ended_at is null;

  delete from public.user_active_clinic_contexts
  where user_id = _user_id
    and (_clinic_id is null or clinic_id = _clinic_id);

  if _clinic_id is not null then
    perform public.log_platform_audit_event('platform_clinic_access_ended', _clinic_id, null, '{}'::jsonb);
  end if;

  return jsonb_build_object('clinic_id', _clinic_id);
end;
$$;

drop policy if exists "Platform owners read platform admins" on public.platform_admins;
create policy "Platform owners read platform admins" on public.platform_admins
for select to authenticated
using (public.is_platform_owner(auth.uid()) or user_id = auth.uid());

drop policy if exists "Platform owners read platform audit" on public.platform_audit_events;
create policy "Platform owners read platform audit" on public.platform_audit_events
for select to authenticated
using (public.is_platform_owner(auth.uid()));

drop policy if exists "Platform owners manage feature flags" on public.feature_flags;
create policy "Platform owners manage feature flags" on public.feature_flags
for all to authenticated
using (public.is_platform_owner(auth.uid()))
with check (public.is_platform_owner(auth.uid()));

drop policy if exists "Platform owners read support sessions" on public.platform_clinic_access_sessions;
create policy "Platform owners read support sessions" on public.platform_clinic_access_sessions
for select to authenticated
using (public.is_platform_owner(auth.uid()) and actor_user_id = auth.uid());

revoke all on function public.is_platform_owner(uuid) from public;
revoke all on function public.get_current_platform_role() from public;
revoke all on function public.log_platform_audit_event(text, uuid, text, jsonb) from public;
revoke all on function public.get_platform_dashboard() from public;
revoke all on function public.list_platform_clinics() from public;
revoke all on function public.get_platform_clinic_detail(uuid) from public;
revoke all on function public.list_platform_audit_events(uuid, integer) from public;
revoke all on function public.list_feature_flags(uuid) from public;
revoke all on function public.upsert_feature_flag(text, public.feature_flag_scope, uuid, jsonb, text, timestamptz, timestamptz, text) from public;
revoke all on function public.start_platform_clinic_access(uuid, text) from public;
revoke all on function public.end_platform_clinic_access() from public;

grant execute on function public.is_platform_owner(uuid) to authenticated;
grant execute on function public.get_current_platform_role() to authenticated;
grant execute on function public.log_platform_audit_event(text, uuid, text, jsonb) to authenticated;
grant execute on function public.get_platform_dashboard() to authenticated;
grant execute on function public.list_platform_clinics() to authenticated;
grant execute on function public.get_platform_clinic_detail(uuid) to authenticated;
grant execute on function public.list_platform_audit_events(uuid, integer) to authenticated;
grant execute on function public.list_feature_flags(uuid) to authenticated;
grant execute on function public.upsert_feature_flag(text, public.feature_flag_scope, uuid, jsonb, text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.start_platform_clinic_access(uuid, text) to authenticated;
grant execute on function public.end_platform_clinic_access() to authenticated;
