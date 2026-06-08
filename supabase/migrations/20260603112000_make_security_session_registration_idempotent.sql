create or replace function public.register_current_security_session(
  _session_key text,
  _browser text default null,
  _platform text default null,
  _device_label text default null,
  _user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _clinic_id uuid := public.get_user_clinic_id(_user_id);
  _existing_row public.user_security_sessions%rowtype;
  _reactivated boolean := false;
begin
  if _user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if nullif(trim(coalesce(_session_key, '')), '') is null then
    raise exception 'Sessao invalida.';
  end if;

  perform public.cleanup_user_security_sessions(_user_id);

  select *
  into _existing_row
  from public.user_security_sessions
  where session_key = _session_key
  limit 1;

  if found and _existing_row.user_id <> _user_id then
    raise exception 'Sessao invalida.';
  end if;

  if found and _existing_row.force_signed_out_at is not null then
    raise exception 'Sessao encerrada pela administracao da clinica. Entre novamente para continuar.';
  end if;

  if not found then
    begin
      insert into public.user_security_sessions (
        user_id,
        clinic_id,
        session_key,
        browser,
        platform,
        device_label,
        user_agent
      )
      values (
        _user_id,
        _clinic_id,
        _session_key,
        nullif(trim(_browser), ''),
        nullif(trim(_platform), ''),
        nullif(trim(_device_label), ''),
        nullif(trim(_user_agent), '')
      )
      returning * into _existing_row;

      _reactivated := true;
    exception
      when unique_violation then
        select *
        into _existing_row
        from public.user_security_sessions
        where session_key = _session_key
        limit 1;

        if not found or _existing_row.user_id <> _user_id then
          raise exception 'Sessao invalida.';
        end if;

        _reactivated := _existing_row.ended_at is not null;
    end;
  else
    _reactivated := _existing_row.ended_at is not null;
  end if;

  update public.user_security_sessions
  set
    clinic_id = coalesce(_clinic_id, clinic_id),
    browser = coalesce(nullif(trim(_browser), ''), browser),
    platform = coalesce(nullif(trim(_platform), ''), platform),
    device_label = coalesce(nullif(trim(_device_label), ''), device_label),
    user_agent = coalesce(nullif(trim(_user_agent), ''), user_agent),
    signed_in_at = case when _reactivated then now() else signed_in_at end,
    ended_at = null,
    force_signed_out_at = null,
    forced_out_by = null,
    last_seen_at = now(),
    updated_at = now()
  where id = _existing_row.id
  returning * into _existing_row;

  if _reactivated then
    perform public.log_security_event(
      _clinic_id,
      _user_id,
      _user_id,
      'session_started',
      'self',
      jsonb_build_object(
        'browser', nullif(trim(_browser), ''),
        'platform', nullif(trim(_platform), ''),
        'device_label', nullif(trim(_device_label), '')
      )
    );
  end if;

  return jsonb_build_object(
    'session_id', _existing_row.id,
    'user_id', _user_id
  );
end;
$$;

grant execute on function public.register_current_security_session(text, text, text, text, text) to authenticated;
