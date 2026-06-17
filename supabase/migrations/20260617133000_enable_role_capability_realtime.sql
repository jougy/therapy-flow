do $$
begin
  alter table public.clinic_operational_role_capabilities replica identity full;

  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  )
  and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'clinic_operational_role_capabilities'
  ) then
    alter publication supabase_realtime add table public.clinic_operational_role_capabilities;
  end if;
end $$;
