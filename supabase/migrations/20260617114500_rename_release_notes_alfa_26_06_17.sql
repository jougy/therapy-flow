do $$
declare
  _wrong_release_id uuid;
  _correct_release_id uuid;
begin
  select id
  into _wrong_release_id
  from public.platform_releases
  where version = 'alfa-2026.06.17-1';

  select id
  into _correct_release_id
  from public.platform_releases
  where version = 'alfa-26.06.17-1';

  if _wrong_release_id is not null and _correct_release_id is null then
    update public.platform_releases
    set
      version = 'alfa-26.06.17-1',
      updated_at = now()
    where id = _wrong_release_id;
  elsif _wrong_release_id is not null and _correct_release_id is not null then
    update public.platform_release_note_items
    set release_id = _correct_release_id
    where release_id = _wrong_release_id
      and not exists (
        select 1
        from public.platform_release_note_items existing_items
        where existing_items.release_id = _correct_release_id
          and existing_items.category = public.platform_release_note_items.category
          and existing_items.title = public.platform_release_note_items.title
      );

    delete from public.platform_releases
    where id = _wrong_release_id;

    update public.platform_releases
    set
      is_active = true,
      updated_at = now()
    where id = _correct_release_id;
  end if;
end $$;
