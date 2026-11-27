-- P0 Hotfix: Destravamento de user_release_note_states, correção de pg_catalog.current_user (42P01)
-- e restauração seletiva de SECURITY DEFINER nas RPCs que cruzam tabelas com RLS restritivo.

-- 1. Policies INSERT/UPDATE em user_release_note_states para o próprio usuário (initplan)
DROP POLICY IF EXISTS "user_release_note_states_insert_authenticated_own" ON public.user_release_note_states;
CREATE POLICY "user_release_note_states_insert_authenticated_own"
  ON public.user_release_note_states
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_release_note_states_update_authenticated_own" ON public.user_release_note_states;
CREATE POLICY "user_release_note_states_update_authenticated_own"
  ON public.user_release_note_states
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 2. Tornar get_current_user_pending_release_notes idempotente no primeiro acesso (ON CONFLICT DO NOTHING)
CREATE OR REPLACE FUNCTION public.get_current_user_pending_release_notes()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  _user_id uuid := auth.uid();
  _latest public.platform_releases%rowtype;
  _state public.user_release_note_states%rowtype;
  _releases jsonb := '[]'::jsonb;
  _categories jsonb := '[]'::jsonb;
begin
  if _user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select *
  into _latest
  from public.platform_releases
  where is_active = true
  order by version_order desc
  limit 1;

  if _latest.id is null then
    return jsonb_build_object('should_show', false, 'reason', 'no_active_release');
  end if;

  select *
  into _state
  from public.user_release_note_states
  where user_id = _user_id;

  if _state.user_id is null then
    insert into public.user_release_note_states (
      user_id,
      last_seen_release_id,
      last_seen_release_order,
      last_seen_at
    )
    values (
      _user_id,
      _latest.id,
      _latest.version_order,
      now()
    )
    on conflict (user_id) do nothing;

    return jsonb_build_object(
      'should_show', false,
      'reason', 'first_access_initialized',
      'latest_release_id', _latest.id,
      'latest_version', _latest.version
    );
  end if;

  if _state.last_seen_release_order >= _latest.version_order then
    return jsonb_build_object(
      'should_show', false,
      'reason', 'up_to_date',
      'latest_release_id', _latest.id,
      'latest_version', _latest.version
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pending_releases.id,
        'version', pending_releases.version,
        'version_order', pending_releases.version_order,
        'title', pending_releases.title,
        'summary', pending_releases.summary,
        'published_at', pending_releases.published_at,
        'items', coalesce(items.items, '[]'::jsonb)
      )
      order by pending_releases.version_order asc
    ),
    '[]'::jsonb
  )
  into _releases
  from public.platform_releases pending_releases
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', platform_release_note_items.id,
        'category', platform_release_note_items.category,
        'title', platform_release_note_items.title,
        'body', platform_release_note_items.body,
        'sort_order', platform_release_note_items.sort_order
      )
      order by platform_release_note_items.category, platform_release_note_items.sort_order, platform_release_note_items.created_at
    ) as items
    from public.platform_release_note_items
    where platform_release_note_items.release_id = pending_releases.id
  ) items on true
  where pending_releases.is_active = true
    and pending_releases.version_order > _state.last_seen_release_order
    and pending_releases.version_order <= _latest.version_order;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'category', counted.category,
        'count', counted.item_count
      )
      order by counted.category
    ),
    '[]'::jsonb
  )
  into _categories
  from (
    select platform_release_note_items.category, count(*)::integer as item_count
    from public.platform_releases pending_releases
    join public.platform_release_note_items on platform_release_note_items.release_id = pending_releases.id
    where pending_releases.is_active = true
      and pending_releases.version_order > _state.last_seen_release_order
      and pending_releases.version_order <= _latest.version_order
    group by platform_release_note_items.category
  ) counted;

  return jsonb_build_object(
    'should_show', jsonb_array_length(_releases) > 0,
    'latest_release_id', _latest.id,
    'latest_version', _latest.version,
    'previous_release_order', _state.last_seen_release_order,
    'releases', _releases,
    'categories', _categories
  );
end;
$function$;

-- 3. Corrigir pg_catalog.current_user (42P01) em get_clinic_storage_usage, handle_personal_signup e rpc_get_available_slots
DO $$
DECLARE
  _rec record;
  _new_def text;
BEGIN
  FOR _rec IN
    SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosrc ILIKE '%pg_catalog.current_user%'
  LOOP
    _new_def := regexp_replace(_rec.def, 'pg_catalog\.current_user', 'current_user', 'gi');
    EXECUTE _new_def;
  END LOOP;
END $$;

-- 4. Restaurar SECURITY DEFINER com search_path seguro nas RPCs que cruzam tabelas com RLS restritivo
DO $$
DECLARE
  _rec record;
  _definer_targets text[] := ARRAY[
    'get_clinic_storage_usage',
    'rpc_get_available_slots',
    'get_clinic_feature_flags',
    'toggle_community_template_like',
    'increment_community_template_import',
    'log_platform_audit_event',
    'upsert_feature_flag',
    'validate_subscription_coupon',
    'get_user_active_governance',
    'list_current_user_notifications',
    'list_platform_error_logs',
    'list_platform_audit_events',
    'list_platform_telemetry_events',
    'list_platform_user_telemetry_events'
  ];
BEGIN
  FOR _rec IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(_definer_targets)
  LOOP
    EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER SET search_path = public, pg_temp', _rec.sig);
  END LOOP;
END $$;
