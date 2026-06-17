create table if not exists public.clinic_operational_roles (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  role_key text not null,
  label text not null,
  description text,
  base_operational_role public.operational_role_type not null default 'professional',
  sort_order integer not null default 100,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_operational_roles_unique unique (clinic_id, role_key),
  constraint clinic_operational_roles_key_shape check (role_key ~ '^[a-z][a-z0-9_]{1,39}$'),
  constraint clinic_operational_roles_label_not_blank check (btrim(label) <> ''),
  constraint clinic_operational_roles_no_custom_owner check (is_system = true or role_key <> 'owner')
);

create table if not exists public.clinic_operational_role_capabilities (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  operational_role text not null,
  capability text not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_operational_role_capabilities_unique unique (clinic_id, operational_role, capability),
  constraint clinic_operational_role_capabilities_no_owner check (operational_role <> 'owner'),
  constraint clinic_operational_role_capabilities_known check (
    capability in (
      'clinic_profile.manage',
      'forms.manage',
      'subaccounts.manage',
      'subaccounts_roles.manage',
      'subscription_billing.manage',
      'treasury.manage',
      'agenda.delete_events',
      'subaccounts_analytics.read',
      'patients.read',
      'patients.write',
      'schedule.read',
      'schedule.write',
      'sessions.read',
      'sessions.write',
      'session.delete_draft'
    )
  )
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.clinic_operational_role_capabilities
  drop constraint if exists clinic_operational_role_capabilities_unique;

alter table public.clinic_operational_role_capabilities
  drop constraint if exists clinic_operational_role_capabilities_no_owner;

alter table public.clinic_operational_role_capabilities
  alter column operational_role type text using operational_role::text;

alter table public.clinic_operational_role_capabilities
  add constraint clinic_operational_role_capabilities_unique unique (clinic_id, operational_role, capability);

alter table public.clinic_operational_role_capabilities
  add constraint clinic_operational_role_capabilities_no_owner check (operational_role <> 'owner');

alter table public.clinic_operational_roles enable row level security;

drop policy if exists "operational roles are readable by clinic members" on public.clinic_operational_roles;
create policy "operational roles are readable by clinic members"
on public.clinic_operational_roles
for select
using (public.user_has_active_clinic_membership(auth.uid(), clinic_id));

drop policy if exists "operational roles are manageable by role admins" on public.clinic_operational_roles;
create policy "operational roles are manageable by role admins"
on public.clinic_operational_roles
for all
using (public.current_user_can('subaccounts_roles.manage', clinic_id))
with check (public.current_user_can('subaccounts_roles.manage', clinic_id));

drop trigger if exists set_clinic_operational_roles_updated_at on public.clinic_operational_roles;
create trigger set_clinic_operational_roles_updated_at
before update on public.clinic_operational_roles
for each row
execute function public.set_updated_at();

revoke all on table public.clinic_operational_roles from public;
grant select, insert, update, delete on table public.clinic_operational_roles to authenticated;
