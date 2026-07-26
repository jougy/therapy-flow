-- 1. Create a unique index for tag scope
create unique index if not exists feature_flags_tag_key_key
on public.feature_flags (tag_id, key)
where scope = 'tag';

-- 2. Drop the old function (with old signature)
drop function if exists public.upsert_feature_flag(text, public.feature_flag_scope, uuid, jsonb, text, timestamptz, timestamptz, text);

-- 3. Recreate the function with _tag_id support
create or replace function public.upsert_feature_flag(
  _key text,
  _scope public.feature_flag_scope,
  _clinic_id uuid default null,
  _tag_id uuid default null,
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
  if not public.is_platform_owner_mfa_verified(_user_id) then
    raise exception 'Acesso de plataforma indisponivel.';
  end if;

  if _clean_key = '' then
    raise exception 'Informe uma chave de feature flag.';
  end if;

  if _scope = 'global' then
    _clinic_id := null;
    _tag_id := null;
  elsif _scope = 'tag' then
    _clinic_id := null;
    if _tag_id is null then
      raise exception 'Informe uma tag_id para flag por tag.';
    end if;
  elsif _scope = 'clinic' then
    _tag_id := null;
    if _clinic_id is null then
      raise exception 'Informe uma clinica para flag por clinica.';
    end if;
  end if;

  select to_jsonb(feature_flags.*)
  into _previous
  from public.feature_flags
  where feature_flags.key = _clean_key
    and feature_flags.scope = _scope
    and feature_flags.clinic_id is not distinct from _clinic_id
    and feature_flags.tag_id is not distinct from _tag_id
  limit 1;

  if _scope = 'global' then
    insert into public.feature_flags (
      key,
      scope,
      clinic_id,
      tag_id,
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
      _tag_id,
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
  elsif _scope = 'tag' then
    insert into public.feature_flags (
      key,
      scope,
      clinic_id,
      tag_id,
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
      _tag_id,
      coalesce(_value, 'false'::jsonb),
      nullif(left(coalesce(_description, ''), 500), ''),
      _starts_at,
      _expires_at,
      nullif(left(coalesce(_reason, ''), 1000), ''),
      _user_id,
      _user_id
    )
    on conflict (tag_id, key) where scope = 'tag'
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
      and scope = 'tag'
      and tag_id = _tag_id
    returning id into _target_id;
  elsif _scope = 'clinic' then
    insert into public.feature_flags (
      key,
      scope,
      clinic_id,
      tag_id,
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
      _tag_id,
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
