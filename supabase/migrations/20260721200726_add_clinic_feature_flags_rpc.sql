create or replace function public.get_clinic_feature_flags(_clinic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _result jsonb;
begin
  if _user_id is null then
    return '{}'::jsonb;
  end if;

  -- Verificar se usuario tem acesso (platform owner na visao ou membro da clinica)
  -- NOTA: O platform owner acessando via "start_platform_clinic_access" ja fica 
  -- com membership_status = 'active' em "clinic_memberships" (ver is_platform_owner em useAuth / membership simulada), 
  -- mas apenas localmente. Entao, ou ele eh platform owner MFA verified, ou tem membership.
  if not (
    public.is_platform_owner_mfa_verified(_user_id) or 
    exists (
      select 1 from public.clinic_memberships 
      where user_id = _user_id and clinic_id = _clinic_id and membership_status = 'active' and is_active = true
    )
  ) then
    return '{}'::jsonb;
  end if;

  select coalesce(jsonb_object_agg(sub.key, sub.value), '{}'::jsonb)
  into _result
  from (
    select distinct on (key)
      key,
      value
    from public.feature_flags
    where (
      scope = 'global'
      or (scope = 'clinic' and clinic_id = _clinic_id)
      or (scope = 'tag' and tag_id in (
        select tag_id from public.clinic_tag_relations where clinic_id = _clinic_id
      ))
    )
    and (starts_at is null or starts_at <= now())
    and (expires_at is null or expires_at > now())
    order by key,
      case scope
        when 'clinic' then 1
        when 'tag' then 2
        when 'global' then 3
      end
  ) sub;

  return _result;
end;
$$;

revoke all on function public.get_clinic_feature_flags(uuid) from public;
grant execute on function public.get_clinic_feature_flags(uuid) to authenticated;
