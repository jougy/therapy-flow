do $$
begin
  if not exists (select 1 from pg_type where typname = 'platform_release_note_category') then
    create type public.platform_release_note_category as enum ('fixed', 'added', 'changed', 'removed');
  end if;
end $$;

create table if not exists public.platform_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  version_order integer not null,
  title text not null,
  summary text,
  published_at timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_releases_version_not_blank check (btrim(version) <> ''),
  constraint platform_releases_title_not_blank check (btrim(title) <> ''),
  constraint platform_releases_version_order_positive check (version_order > 0)
);

create table if not exists public.platform_release_note_items (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.platform_releases(id) on delete cascade,
  category public.platform_release_note_category not null,
  title text not null,
  body text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint platform_release_note_items_title_not_blank check (btrim(title) <> '')
);

create table if not exists public.user_release_note_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_release_id uuid references public.platform_releases(id) on delete set null,
  last_seen_release_order integer not null default 0,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists platform_releases_version_key
on public.platform_releases (version);

create unique index if not exists platform_releases_version_order_key
on public.platform_releases (version_order);

create index if not exists idx_platform_releases_active_order
on public.platform_releases (version_order desc)
where is_active = true;

create index if not exists idx_platform_release_note_items_release_category
on public.platform_release_note_items (release_id, category, sort_order, created_at);

alter table public.platform_releases enable row level security;
alter table public.platform_release_note_items enable row level security;
alter table public.user_release_note_states enable row level security;

drop trigger if exists update_platform_releases_updated_at on public.platform_releases;
create trigger update_platform_releases_updated_at
before update on public.platform_releases
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_user_release_note_states_updated_at on public.user_release_note_states;
create trigger update_user_release_note_states_updated_at
before update on public.user_release_note_states
for each row
execute function public.update_updated_at_column();

drop policy if exists "Authenticated users read active platform releases" on public.platform_releases;
create policy "Authenticated users read active platform releases" on public.platform_releases
for select to authenticated
using (is_active = true);

drop policy if exists "Authenticated users read active release note items" on public.platform_release_note_items;
create policy "Authenticated users read active release note items" on public.platform_release_note_items
for select to authenticated
using (
  exists (
    select 1
    from public.platform_releases
    where platform_releases.id = platform_release_note_items.release_id
      and platform_releases.is_active = true
  )
);

drop policy if exists "Users read own release note state" on public.user_release_note_states;
create policy "Users read own release note state" on public.user_release_note_states
for select to authenticated
using (user_id = auth.uid());

create or replace function public.get_current_user_pending_release_notes()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
    );

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
$$;

create or replace function public.acknowledge_current_user_release_notes(_release_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _release public.platform_releases%rowtype;
begin
  if _user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if _release_id is null then
    select *
    into _release
    from public.platform_releases
    where is_active = true
    order by version_order desc
    limit 1;
  else
    select *
    into _release
    from public.platform_releases
    where id = _release_id
      and is_active = true;
  end if;

  if _release.id is null then
    raise exception 'Versao de atualizacao indisponivel.';
  end if;

  insert into public.user_release_note_states (
    user_id,
    last_seen_release_id,
    last_seen_release_order,
    last_seen_at
  )
  values (
    _user_id,
    _release.id,
    _release.version_order,
    now()
  )
  on conflict (user_id)
  do update set
    last_seen_release_id = excluded.last_seen_release_id,
    last_seen_release_order = greatest(
      user_release_note_states.last_seen_release_order,
      excluded.last_seen_release_order
    ),
    last_seen_at = now(),
    updated_at = now();

  return jsonb_build_object(
    'acknowledged', true,
    'release_id', _release.id,
    'version', _release.version
  );
end;
$$;

revoke all on function public.get_current_user_pending_release_notes() from public;
revoke all on function public.acknowledge_current_user_release_notes(uuid) from public;
grant execute on function public.get_current_user_pending_release_notes() to authenticated;
grant execute on function public.acknowledge_current_user_release_notes(uuid) to authenticated;

insert into public.platform_releases (
  version,
  version_order,
  title,
  summary,
  published_at,
  is_active
)
values (
  'alfa-26.06.07-1',
  2026060701,
  'Versao inicial de acompanhamento',
  'Marco inicial para controlar quais novidades cada usuario ja visualizou.',
  now(),
  true
)
on conflict (version)
do update set
  title = excluded.title,
  summary = excluded.summary,
  is_active = excluded.is_active,
  updated_at = now();
