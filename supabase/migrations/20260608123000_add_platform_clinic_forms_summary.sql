create or replace function public.get_platform_clinic_forms_summary_by_route_key(_route_key text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _clean_route_key text := nullif(trim(coalesce(_route_key, '')), '');
  _clinic_id uuid;
  _summary jsonb;
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

  select jsonb_build_object(
    'base', jsonb_build_object(
      'field_count', coalesce((
        select count(*)::integer
        from jsonb_array_elements(coalesce(clinics.anamnesis_base_schema, '[]'::jsonb)) as field(value)
        where coalesce(field.value->>'type', '') not in ('section', 'horizontal_section', 'section_selector')
      ), 0),
      'section_count', coalesce((
        select count(*)::integer
        from jsonb_array_elements(coalesce(clinics.anamnesis_base_schema, '[]'::jsonb)) as field(value)
        where coalesce(field.value->>'type', '') in ('section', 'horizontal_section', 'section_selector')
      ), 0),
      'updated_at', clinics.updated_at
    ),
    'templates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', templates.id,
          'name', templates.name,
          'description', templates.description,
          'field_count', coalesce((
            select count(*)::integer
            from jsonb_array_elements(coalesce(templates.schema, '[]'::jsonb)) as field(value)
            where coalesce(field.value->>'type', '') not in ('section', 'horizontal_section', 'section_selector')
          ), 0),
          'section_count', coalesce((
            select count(*)::integer
            from jsonb_array_elements(coalesce(templates.schema, '[]'::jsonb)) as field(value)
            where coalesce(field.value->>'type', '') in ('section', 'horizontal_section', 'section_selector')
          ), 0),
          'usage_count', coalesce(template_usage.total, 0),
          'updated_at', templates.updated_at
        )
        order by templates.updated_at desc nulls last, templates.name
      )
      from public.anamnesis_form_templates templates
      left join lateral (
        select count(*)::integer as total
        from public.sessions
        where sessions.anamnesis_template_id = templates.id
      ) template_usage on true
      where templates.clinic_id = clinics.id
    ), '[]'::jsonb)
  )
  into _summary
  from public.clinics
  where clinics.id = _clinic_id;

  perform public.log_platform_audit_event(
    'platform_clinic_forms_summary_read',
    _clinic_id,
    null,
    jsonb_build_object('route_key', _clean_route_key)
  );

  return coalesce(_summary, jsonb_build_object('base', jsonb_build_object(), 'templates', '[]'::jsonb));
end;
$$;

revoke all on function public.get_platform_clinic_forms_summary_by_route_key(text) from public;
grant execute on function public.get_platform_clinic_forms_summary_by_route_key(text) to authenticated;
