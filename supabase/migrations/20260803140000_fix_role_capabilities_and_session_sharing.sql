-- Fix operational role capabilities check constraint and session sharing access levels

-- 1. Update clinic_operational_role_capabilities_known check constraint
alter table public.clinic_operational_role_capabilities
  drop constraint if exists clinic_operational_role_capabilities_known;

alter table public.clinic_operational_role_capabilities
  add constraint clinic_operational_role_capabilities_known check (
    capability in (
      'clinic_profile.manage',
      'forms.manage',
      'subaccounts.manage',
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
      'session.delete_draft'
    )
  );

-- 2. Update session_shares access_level check constraint
alter table public.session_shares
  drop constraint if exists session_shares_access_level_check;

alter table public.session_shares
  add constraint session_shares_access_level_check check (access_level in ('read', 'read_only', 'can_evolve'));

-- 3. Update get_session_share_recipients to include access_level
create or replace function public.get_session_share_recipients(_session_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    json_agg(
      json_build_object(
        'id', session_shares.shared_with_user_id,
        'full_name', profiles.full_name,
        'email', profiles.email,
        'job_title', profiles.job_title,
        'operational_role', clinic_memberships.operational_role,
        'access_level', session_shares.access_level,
        'shared_by_user_id', session_shares.shared_by_user_id,
        'created_at', session_shares.created_at
      )
      order by profiles.full_name nulls last, profiles.email
    ),
    '[]'::json
  )
  from public.session_shares
  join public.profiles
    on profiles.id = session_shares.shared_with_user_id
  left join public.clinic_memberships
    on clinic_memberships.clinic_id = session_shares.clinic_id
    and clinic_memberships.user_id = session_shares.shared_with_user_id
  where session_shares.session_id = _session_id
    and session_shares.revoked_at is null
    and public.can_read_session(_session_id);
$$;

-- 4. Update get_session_share_summary to include access_level
create or replace function public.get_session_share_summary(_session_ids uuid[])
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    json_agg(
      json_build_object(
        'session_id', summaries.session_id,
        'share_count', summaries.share_count,
        'recipients', summaries.recipients
      )
      order by summaries.session_id
    ),
    '[]'::json
  )
  from (
    select
      session_shares.session_id,
      count(*)::int as share_count,
      json_agg(
        json_build_object(
          'id', session_shares.shared_with_user_id,
          'full_name', profiles.full_name,
          'email', profiles.email,
          'job_title', profiles.job_title,
          'access_level', session_shares.access_level,
          'created_at', session_shares.created_at
        )
        order by profiles.full_name nulls last, profiles.email
      ) as recipients
    from public.session_shares
    join public.profiles
      on profiles.id = session_shares.shared_with_user_id
    where session_shares.session_id = any(_session_ids)
      and session_shares.revoked_at is null
      and public.can_read_session(session_shares.session_id)
    group by session_shares.session_id
  ) as summaries;
$$;

-- 5. Update share_sessions_with_collaborators to store access_level
create or replace function public.share_sessions_with_collaborators(
  _session_ids uuid[],
  _user_ids uuid[],
  _access_level text default 'can_evolve'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  _actor_id uuid := auth.uid();
  _session_id uuid;
  _target_user_id uuid;
  _session public.sessions%rowtype;
  _inserted_count integer := 0;
  _row_count integer := 0;
  _level text := coalesce(_access_level, 'can_evolve');
begin
  if _actor_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if coalesce(array_length(_session_ids, 1), 0) = 0 or coalesce(array_length(_user_ids, 1), 0) = 0 then
    return json_build_object('shared_count', 0);
  end if;

  if _level not in ('read', 'read_only', 'can_evolve') then
    _level := 'can_evolve';
  end if;

  for _session_id in
    select distinct item
    from unnest(_session_ids) as item
    where item is not null
  loop
    select *
    into _session
    from public.sessions
    where id = _session_id;

    if _session.id is null or _session.clinic_id is null then
      raise exception 'Ficha de atendimento não encontrada';
    end if;

    if not public.can_share_session(_session.id) then
      raise exception 'Sem permissão para compartilhar uma ou mais fichas';
    end if;

    for _target_user_id in
      select distinct item
      from unnest(_user_ids) as item
      where item is not null
    loop
      if _target_user_id = _session.user_id or _target_user_id = _session.provider_id then
        continue;
      end if;

      if not public.is_active_clinic_member(_session.clinic_id, _target_user_id) then
        raise exception 'Um dos colaboradores selecionados não pertence à clínica';
      end if;

      insert into public.session_shares (
        clinic_id,
        session_id,
        shared_with_user_id,
        shared_by_user_id,
        access_level
      )
      values (
        _session.clinic_id,
        _session.id,
        _target_user_id,
        _actor_id,
        _level
      )
      on conflict (session_id, shared_with_user_id) where revoked_at is null do update
      set access_level = excluded.access_level,
          shared_by_user_id = excluded.shared_by_user_id,
          created_at = now();

      get diagnostics _row_count = row_count;
      _inserted_count := _inserted_count + _row_count;
    end loop;
  end loop;

  return json_build_object('shared_count', _inserted_count);
end;
$$;
