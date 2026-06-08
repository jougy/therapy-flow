create or replace function public.platform_normalize_search(_value text)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select lower(regexp_replace(coalesce(_value, ''), '[^[:alnum:]]+', '', 'g'));
$$;

create or replace function public.list_platform_directory(
  _query text default null,
  _kind text default 'all',
  _limit integer default 80
)
returns table (
  item_type text,
  item_id uuid,
  clinic_id uuid,
  clinic_name text,
  title text,
  subtitle text,
  primary_document text,
  secondary_document text,
  status text,
  metadata jsonb,
  updated_at timestamp with time zone
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with input as (
    select
      nullif(trim(coalesce(_query, '')), '') as raw_query,
      public.platform_normalize_search(_query) as normalized_query,
      case
        when _kind in ('clinic', 'account', 'patient') then _kind
        else 'all'
      end as kind,
      least(greatest(coalesce(_limit, 80), 1), 120) as row_limit
  ),
  clinics_rows as (
    select
      'clinic'::text as item_type,
      clinics.id as item_id,
      clinics.id as clinic_id,
      clinics.name as clinic_name,
      clinics.name as title,
      coalesce(clinics.legal_name, clinics.email, 'Clínica sem razão social') as subtitle,
      clinics.cnpj as primary_document,
      owner_profile.email as secondary_document,
      clinics.subscription_plan::text as status,
      jsonb_build_object(
        'route_key', clinics.route_key,
        'owner_user_id', clinics.account_owner_user_id,
        'owner_name', owner_profile.full_name,
        'owner_email', owner_profile.email,
        'team_count', coalesce(membership_counts.total, 0),
        'patients_count', coalesce(patient_counts.total, 0),
        'sessions_count', coalesce(session_counts.total, 0),
        'flags_count', coalesce(flag_counts.total, 0),
        'subaccount_limit', clinics.subaccount_limit,
        'concurrent_access_limit', case
          when clinics.subscription_plan = 'solo' then 1
          else greatest(clinics.subaccount_limit, 4)
        end
      ) as metadata,
      clinics.updated_at
    from public.clinics
    left join public.profiles owner_profile on owner_profile.id = clinics.account_owner_user_id
    left join lateral (
      select count(*)::integer as total
      from public.clinic_memberships
      where clinic_memberships.clinic_id = clinics.id
        and clinic_memberships.is_active = true
        and clinic_memberships.membership_status = 'active'
    ) membership_counts on true
    left join lateral (
      select count(*)::integer as total
      from public.patients
      where patients.clinic_id = clinics.id
    ) patient_counts on true
    left join lateral (
      select count(*)::integer as total
      from public.sessions
      where sessions.clinic_id = clinics.id
    ) session_counts on true
    left join lateral (
      select count(*)::integer as total
      from public.feature_flags
      where feature_flags.clinic_id = clinics.id
        and feature_flags.scope = 'clinic'
    ) flag_counts on true
    cross join input
    where public.is_platform_owner_mfa_verified(auth.uid())
      and input.kind in ('all', 'clinic')
      and (
        input.raw_query is null
        or public.platform_normalize_search(clinics.name || ' ' || clinics.cnpj || ' ' || coalesce(clinics.legal_name, '') || ' ' || coalesce(owner_profile.email, '') || ' ' || coalesce(owner_profile.full_name, '')) like '%' || input.normalized_query || '%'
      )
  ),
  account_rows as (
    select
      'account'::text as item_type,
      profiles.id as item_id,
      clinic_memberships.clinic_id,
      clinics.name as clinic_name,
      coalesce(profiles.full_name, profiles.email, 'Conta sem nome') as title,
      coalesce(profiles.email, profiles.phone, 'Sem contato principal') as subtitle,
      profiles.cpf as primary_document,
      profiles.phone as secondary_document,
      clinic_memberships.membership_status::text as status,
      jsonb_build_object(
        'email', profiles.email,
        'phone', profiles.phone,
        'birth_date', profiles.birth_date,
        'age', case
          when profiles.birth_date is null then null
          else extract(year from age(current_date, profiles.birth_date))::integer
        end,
        'job_title', profiles.job_title,
        'account_role', clinic_memberships.account_role,
        'operational_role', clinic_memberships.operational_role,
        'membership_id', clinic_memberships.id,
        'is_active', clinic_memberships.is_active,
        'joined_at', clinic_memberships.joined_at
      ) as metadata,
      greatest(profiles.last_seen_at, profiles.updated_at, clinic_memberships.updated_at) as updated_at
    from public.clinic_memberships
    join public.profiles on profiles.id = clinic_memberships.user_id
    join public.clinics on clinics.id = clinic_memberships.clinic_id
    cross join input
    where public.is_platform_owner_mfa_verified(auth.uid())
      and input.kind in ('all', 'account')
      and (
        input.raw_query is null
        or public.platform_normalize_search(coalesce(profiles.full_name, '') || ' ' || coalesce(profiles.email, '') || ' ' || coalesce(profiles.cpf, '') || ' ' || coalesce(profiles.phone, '') || ' ' || coalesce(profiles.job_title, '') || ' ' || clinics.name) like '%' || input.normalized_query || '%'
        or (profiles.birth_date is not null and extract(year from age(current_date, profiles.birth_date))::integer::text = input.raw_query)
      )
  ),
  patient_rows as (
    select
      'patient'::text as item_type,
      patients.id as item_id,
      patients.clinic_id,
      clinics.name as clinic_name,
      patients.name as title,
      coalesce(patients.email, patients.phone, 'Paciente sem contato principal') as subtitle,
      patients.cpf as primary_document,
      patients.rg as secondary_document,
      patients.status as status,
      jsonb_build_object(
        'age', coalesce(patients.age, case when patients.date_of_birth is null then null else extract(year from age(current_date, patients.date_of_birth))::integer end),
        'phone', patients.phone,
        'email', patients.email,
        'rg', patients.rg,
        'date_of_birth', patients.date_of_birth,
        'gender', patients.gender,
        'pronoun', patients.pronoun,
        'profession', patients.profession,
        'origin_type', patients.origin_type,
        'is_recurring', patients.is_recurring,
        'recurring_weekdays', patients.recurring_weekdays
      ) as metadata,
      patients.updated_at
    from public.patients
    join public.clinics on clinics.id = patients.clinic_id
    cross join input
    where public.is_platform_owner_mfa_verified(auth.uid())
      and input.kind in ('all', 'patient')
      and (
        input.raw_query is null
        or public.platform_normalize_search(patients.name || ' ' || coalesce(patients.cpf, '') || ' ' || coalesce(patients.rg, '') || ' ' || coalesce(patients.phone, '') || ' ' || coalesce(patients.email, '') || ' ' || clinics.name) like '%' || input.normalized_query || '%'
        or coalesce(patients.age, case when patients.date_of_birth is null then null else extract(year from age(current_date, patients.date_of_birth))::integer end)::text = input.raw_query
      )
  ),
  combined as (
    select * from clinics_rows
    union all
    select * from account_rows
    union all
    select * from patient_rows
  )
  select combined.*
  from combined, input
  order by combined.updated_at desc nulls last, combined.title
  limit (select row_limit from input);
$$;

create or replace function public.get_platform_person_detail(_item_type text, _item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _result jsonb;
begin
  if not public.is_platform_owner_mfa_verified(auth.uid()) then
    raise exception 'Acesso negado ao painel global.';
  end if;

  if _item_type = 'account' then
    select jsonb_build_object(
      'type', 'account',
      'profile', to_jsonb(profiles),
      'memberships', coalesce((
        select jsonb_agg(jsonb_build_object(
          'membership_id', clinic_memberships.id,
          'clinic_id', clinic_memberships.clinic_id,
          'clinic_name', clinics.name,
          'clinic_route_key', clinics.route_key,
          'account_role', clinic_memberships.account_role,
          'operational_role', clinic_memberships.operational_role,
          'membership_status', clinic_memberships.membership_status,
          'is_active', clinic_memberships.is_active,
          'joined_at', clinic_memberships.joined_at
        ) order by clinic_memberships.joined_at desc)
        from public.clinic_memberships
        join public.clinics on clinics.id = clinic_memberships.clinic_id
        where clinic_memberships.user_id = profiles.id
      ), '[]'::jsonb),
      'counts', jsonb_build_object(
        'sessions_created', (select count(*) from public.sessions where sessions.user_id = profiles.id),
        'sessions_as_provider', (select count(*) from public.sessions where sessions.provider_id = profiles.id)
      )
    )
    into _result
    from public.profiles
    where profiles.id = _item_id;
  elsif _item_type = 'patient' then
    select jsonb_build_object(
      'type', 'patient',
      'patient', to_jsonb(patients),
      'clinic', jsonb_build_object(
        'id', clinics.id,
        'name', clinics.name,
        'route_key', clinics.route_key,
        'cnpj', clinics.cnpj
      ),
      'counts', jsonb_build_object(
        'sessions', (select count(*) from public.sessions where sessions.patient_id = patients.id),
        'drafts', (select count(*) from public.sessions where sessions.patient_id = patients.id and sessions.status = 'rascunho'),
        'completed', (select count(*) from public.sessions where sessions.patient_id = patients.id and sessions.status = 'concluido')
      ),
      'recent_sessions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', sessions.id,
          'session_date', sessions.session_date,
          'status', sessions.status,
          'payment_status', sessions.payment_status,
          'amount_charged_cents', sessions.amount_charged_cents,
          'amount_paid_cents', sessions.amount_paid_cents
        ) order by sessions.session_date desc)
        from (
          select *
          from public.sessions
          where sessions.patient_id = patients.id
          order by sessions.session_date desc
          limit 10
        ) sessions
      ), '[]'::jsonb)
    )
    into _result
    from public.patients
    join public.clinics on clinics.id = patients.clinic_id
    where patients.id = _item_id;
  else
    raise exception 'Tipo de detalhe invalido.';
  end if;

  perform public.log_platform_audit_event(
    'platform_directory_detail_read',
    coalesce((_result #>> '{clinic,id}')::uuid, null),
    null,
    jsonb_build_object('item_type', _item_type, 'item_id', _item_id)
  );

  return coalesce(_result, '{}'::jsonb);
end;
$$;

create or replace function public.platform_create_clinic(
  _name text,
  _cnpj text,
  _subscription_plan public.subscription_plan default 'clinic',
  _subaccount_limit integer default 4,
  _reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _clinic public.clinics%rowtype;
  _clean_name text := nullif(trim(coalesce(_name, '')), '');
  _clean_cnpj text := nullif(trim(coalesce(_cnpj, '')), '');
  _clean_reason text := nullif(trim(coalesce(_reason, '')), '');
begin
  if not public.is_platform_owner_mfa_verified(auth.uid()) then
    raise exception 'Acesso negado ao painel global.';
  end if;

  if _clean_name is null or char_length(_clean_name) < 3 or char_length(_clean_name) > 120 then
    raise exception 'Informe um nome de clinica entre 3 e 120 caracteres.';
  end if;

  if _clean_cnpj is null or char_length(regexp_replace(_clean_cnpj, '[^0-9]', '', 'g')) not in (11, 14) then
    raise exception 'Informe um CPF/CNPJ administrativo valido para iniciar a clinica.';
  end if;

  insert into public.clinics (name, cnpj, subscription_plan, subaccount_limit)
  values (
    _clean_name,
    _clean_cnpj,
    coalesce(_subscription_plan, 'clinic'),
    least(greatest(coalesce(_subaccount_limit, 4), 0), 200)
  )
  returning * into _clinic;

  perform public.log_platform_audit_event(
    'platform_clinic_created',
    _clinic.id,
    _clean_reason,
    jsonb_build_object(
      'clinic_id', _clinic.id,
      'clinic_name', _clinic.name,
      'subscription_plan', _clinic.subscription_plan,
      'subaccount_limit', _clinic.subaccount_limit
    )
  );

  return jsonb_build_object(
    'clinic_id', _clinic.id,
    'route_key', _clinic.route_key,
    'name', _clinic.name
  );
end;
$$;

revoke all on function public.platform_normalize_search(text) from public;
revoke all on function public.list_platform_directory(text, text, integer) from public;
revoke all on function public.get_platform_person_detail(text, uuid) from public;
revoke all on function public.platform_create_clinic(text, text, public.subscription_plan, integer, text) from public;

grant execute on function public.platform_normalize_search(text) to authenticated;
grant execute on function public.list_platform_directory(text, text, integer) to authenticated;
grant execute on function public.get_platform_person_detail(text, uuid) to authenticated;
grant execute on function public.platform_create_clinic(text, text, public.subscription_plan, integer, text) to authenticated;
