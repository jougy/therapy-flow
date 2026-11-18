-- Migration: 20261117181257_create_storage_routing_table.sql
-- Purpose: Multi-provider S3 storage routing table & object route registry (IaC / Pulumi ESC ready)

create table if not exists public.storage_providers (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  driver text not null default 's3' check (driver in ('s3', 'supabase_storage')),
  bucket_name text not null,
  endpoint text not null,
  region text not null default 'us-east-1',
  secret_prefix text not null,
  quota_bytes bigint not null default 10737418240 check (quota_bytes > 0),
  used_bytes bigint not null default 0 check (used_bytes >= 0),
  is_writable boolean not null default true,
  is_active boolean not null default true,
  priority integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.storage_providers is 'Catálogo de provedores de Object Storage (B2, R2, MinIO local, etc.) para roteamento dinâmico de Free Tiers.';

create table if not exists public.storage_object_routes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('patient_file', 'session_archive', 'audit_archive', 'backup_snapshot')),
  entity_id uuid not null,
  clinic_id uuid null references public.clinics(id) on delete restrict,
  provider_id uuid not null references public.storage_providers(id) on delete restrict,
  object_key text not null,
  compression text not null default 'none' check (compression in ('none', 'zstd')),
  original_size_bytes bigint not null default 0 check (original_size_bytes >= 0),
  stored_size_bytes bigint not null default 0 check (stored_size_bytes >= 0),
  checksum_sha256 text null,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, object_key)
);

comment on table public.storage_object_routes is 'Tabela de roteamento que indexa em qual provedor S3 cada arquivo ou dado frio compactado (zstd) reside.';

create index if not exists idx_storage_providers_writable_priority
  on public.storage_providers (is_active, is_writable, priority asc)
  where is_active = true and is_writable = true;

create index if not exists idx_storage_object_routes_entity
  on public.storage_object_routes (entity_type, entity_id);

create index if not exists idx_storage_object_routes_clinic
  on public.storage_object_routes (clinic_id)
  where clinic_id is not null;

-- RLS: Acesso restrito a service_role e platform_admin (governança de infraestrutura)
alter table public.storage_providers enable row level security;
alter table public.storage_object_routes enable row level security;

revoke all on public.storage_providers from anon;
revoke all on public.storage_object_routes from anon;

create or replace function public.touch_storage_routing_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_storage_providers_updated_at on public.storage_providers;
create trigger trg_storage_providers_updated_at
  before update on public.storage_providers
  for each row execute function public.touch_storage_routing_updated_at();

drop trigger if exists trg_storage_object_routes_updated_at on public.storage_object_routes;
create trigger trg_storage_object_routes_updated_at
  before update on public.storage_object_routes
  for each row execute function public.touch_storage_routing_updated_at();

create policy "Platform admins manage storage_providers"
  on public.storage_providers
  for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Platform admins manage storage_object_routes"
  on public.storage_object_routes
  for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Seed idempotente dos provedores iniciais (MinIO Local desativado por padrão em produção)
insert into public.storage_providers (
  provider_key,
  driver,
  bucket_name,
  endpoint,
  region,
  secret_prefix,
  quota_bytes,
  is_writable,
  is_active,
  priority
)
values
  (
    'b2_primary',
    's3',
    'pluri-health-clinical',
    'https://s3.us-east-005.backblazeb2.com',
    'us-east-005',
    'B2',
    10737418240,
    true,
    true,
    10
  ),
  (
    'minio_local',
    's3',
    'pluri-health-local',
    'http://host.docker.internal:9000',
    'us-east-1',
    'MINIO_LOCAL',
    107374182400,
    false,
    false,
    50
  )
on conflict (provider_key) do nothing;
