-- 1. Create tags tables
create table if not exists public.clinic_tags (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  color text default '#808080',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.clinic_tag_relations (
  id uuid default gen_random_uuid() primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  tag_id uuid not null references public.clinic_tags(id) on delete cascade,
  created_at timestamptz default now(),
  unique(clinic_id, tag_id)
);

-- RLS for tags tables
alter table public.clinic_tags enable row level security;
alter table public.clinic_tag_relations enable row level security;

create policy "Platform owners manage clinic_tags"
  on public.clinic_tags
  for all using (public.is_platform_owner(auth.uid()));

create policy "Platform owners manage clinic_tag_relations"
  on public.clinic_tag_relations
  for all using (public.is_platform_owner(auth.uid()));

-- 2. Add 'tag' scope to feature_flags
alter type public.feature_flag_scope add value if not exists 'tag';

-- 3. Add tag_id to feature_flags and update constraints
alter table public.feature_flags add column if not exists tag_id uuid references public.clinic_tags(id) on delete cascade;

-- Remove old constraint and add new one
alter table public.feature_flags drop constraint if exists feature_flags_scope_clinic_check;
alter table public.feature_flags add constraint feature_flags_scope_check check (
  (scope::text = 'global' and clinic_id is null and tag_id is null) or
  (scope::text = 'clinic' and clinic_id is not null and tag_id is null) or
  (scope::text = 'tag' and tag_id is not null and clinic_id is null)
);

create index if not exists idx_feature_flags_scope_tag on public.feature_flags (scope, tag_id);

-- 4. Modify function list_feature_flags
drop function if exists public.list_feature_flags(uuid);

create or replace function public.list_feature_flags(_clinic_id uuid default null)
returns table (
  id uuid,
  key text,
  scope public.feature_flag_scope,
  clinic_id uuid,
  tag_id uuid,
  clinic_name text,
  value jsonb,
  description text,
  starts_at timestamptz,
  expires_at timestamptz,
  reason text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  is_active_now boolean
)
language sql
security definer
set search_path = public
as $$
  select
    feature_flags.id,
    feature_flags.key,
    feature_flags.scope,
    feature_flags.clinic_id,
    feature_flags.tag_id,
    clinics.name,
    feature_flags.value,
    feature_flags.description,
    feature_flags.starts_at,
    feature_flags.expires_at,
    feature_flags.reason,
    feature_flags.created_by,
    feature_flags.updated_by,
    feature_flags.created_at,
    feature_flags.updated_at,
    coalesce(feature_flags.starts_at, '-infinity'::timestamptz) <= now()
      and coalesce(feature_flags.expires_at, 'infinity'::timestamptz) > now()
  from public.feature_flags
  left join public.clinics on clinics.id = feature_flags.clinic_id
  where public.is_platform_owner_mfa_verified(auth.uid())
    and (
      _clinic_id is null
      or feature_flags.scope::text = 'global'
      or (feature_flags.scope::text = 'clinic' and feature_flags.clinic_id = _clinic_id)
      or (feature_flags.scope::text = 'tag' and exists (
        select 1 from public.clinic_tag_relations ctr
        where ctr.clinic_id = _clinic_id and ctr.tag_id = feature_flags.tag_id
      ))
    )
  order by feature_flags.scope, feature_flags.key
$$;

revoke all on function public.list_feature_flags(uuid) from public;
grant execute on function public.list_feature_flags(uuid) to authenticated;
