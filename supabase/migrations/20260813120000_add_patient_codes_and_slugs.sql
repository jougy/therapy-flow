-- Migration: Add patient_code to public.patients and convert clinic route_keys to friendly slugs
alter table public.patients add column if not exists patient_code text;

-- Helper function to generate clean slug from text
create or replace function public.slugify_text(_val text)
returns text
language plpgsql
immutable
as $$
declare
  clean_text text;
begin
  if _val is null or trim(_val) = '' then
    return null;
  end if;

  clean_text := lower(trim(_val));
  clean_text := translate(clean_text, 
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
  );
  clean_text := regexp_replace(clean_text, '[^a-z0-9]+', '-', 'g');
  clean_text := regexp_replace(clean_text, '^-+|-+$', '', 'g');

  if clean_text = '' then
    return null;
  end if;

  return clean_text;
end;
$$;

-- Convert existing raw hex clinic route_keys (24 hex chars) to human-friendly slugs
do $$
declare
  c record;
  new_slug text;
  base_slug text;
  counter int;
begin
  for c in select id, name, route_key from public.clinics loop
    if c.route_key is null or c.route_key ~ '^[0-9a-f]{24}$' then
      base_slug := public.slugify_text(c.name);
      if base_slug is null or base_slug = '' then
        base_slug := 'clinica';
      end if;

      new_slug := base_slug;
      counter := 1;
      while exists (select 1 from public.clinics where route_key = new_slug and id <> c.id) loop
        new_slug := base_slug || '-' || counter;
        counter := counter + 1;
      end loop;

      update public.clinics set route_key = new_slug where id = c.id;
    end if;
  end loop;
end $$;

-- Backfill existing patients per clinic with PAC-001, PAC-002, etc.
do $$
declare
  r record;
  c_id uuid;
  p_seq int;
begin
  for c_id in select distinct clinic_id from public.patients where clinic_id is not null loop
    p_seq := 1;
    for r in select id from public.patients where clinic_id = c_id and (patient_code is null or patient_code = '') order by created_at asc, id asc loop
      update public.patients 
      set patient_code = 'PAC-' || lpad(p_seq::text, 3, '0')
      where id = r.id;
      p_seq := p_seq + 1;
    end loop;
  end loop;

  -- Any patients with null clinic_id fallback
  p_seq := 1;
  for r in select id from public.patients where clinic_id is null and (patient_code is null or patient_code = '') order by created_at asc, id asc loop
    update public.patients 
    set patient_code = 'PAC-' || lpad(p_seq::text, 3, '0')
    where id = r.id;
    p_seq := p_seq + 1;
  end loop;
end $$;

-- Create unique index per clinic_id and patient_code
create unique index if not exists patients_clinic_id_patient_code_key 
on public.patients(clinic_id, patient_code) 
where clinic_id is not null and patient_code is not null;

-- Function to generate next patient_code for a clinic
create or replace function public.generate_next_patient_code(_clinic_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  max_num int := 0;
  next_code text;
begin
  select coalesce(max(cast(nullif(regexp_replace(patient_code, '[^0-9]', '', 'g'), '') as integer)), 0)
  into max_num
  from public.patients
  where clinic_id = _clinic_id;

  next_code := 'PAC-' || lpad((max_num + 1)::text, 3, '0');
  return next_code;
end;
$$;

-- Trigger to auto-assign patient_code before insert if empty
create or replace function public.trg_auto_assign_patient_code()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.patient_code is null or trim(new.patient_code) = '' then
    if new.clinic_id is not null then
      new.patient_code := public.generate_next_patient_code(new.clinic_id);
    else
      new.patient_code := 'PAC-' || lpad((floor(extract(epoch from now()))::bigint % 100000)::text, 5, '0');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists set_patient_code_before_insert on public.patients;
create trigger set_patient_code_before_insert
  before insert on public.patients
  for each row
  execute function public.trg_auto_assign_patient_code();
