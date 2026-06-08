create or replace function public.get_platform_clinic_detail_by_route_key(_route_key text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _clean_route_key text := nullif(trim(coalesce(_route_key, '')), '');
  _clinic_id uuid;
begin
  if not public.is_platform_owner_mfa_verified(auth.uid()) then
    raise exception 'Verificacao de dois fatores obrigatoria para acesso de plataforma.';
  end if;

  if _clean_route_key is null
    or char_length(_clean_route_key) > 80
    or _clean_route_key !~ '^[A-Za-z0-9_-]+$'
  then
    raise exception 'Rota de clinica invalida.';
  end if;

  select clinics.id
  into _clinic_id
  from public.clinics
  where clinics.route_key = _clean_route_key
  limit 1;

  if _clinic_id is null then
    raise exception 'Clinica nao encontrada.';
  end if;

  return public.get_platform_clinic_detail(_clinic_id);
end;
$$;

revoke all on function public.get_platform_clinic_detail_by_route_key(text) from public;
grant execute on function public.get_platform_clinic_detail_by_route_key(text) to authenticated;
