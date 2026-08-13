-- Migration: 20260810100000_create_clinic_subscriptions_and_invoices.sql
-- Descrição: Tabelas de Assinatura, Cobrança e Webhook Asaas, RPCs e Triggers de sincronização de limites da clínica.

-- 1. Tabela public.clinic_subscriptions
create table if not exists public.clinic_subscriptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade unique,
  account_owner_user_id uuid not null references public.profiles(id),
  asaas_customer_id text,
  asaas_subscription_id text,
  plan_type public.subscription_plan not null default 'solo',
  billing_cycle text not null default 'MONTHLY',
  payment_method text not null default 'FREE_BETA',
  base_monthly_price numeric(10,2) not null default 60.00,
  base_concurrent_access_count integer not null default 2,
  additional_concurrent_access_count integer not null default 0,
  additional_concurrent_access_price numeric(10,2) not null default 10.00,
  total_recurring_monthly_price numeric(10,2) not null default 60.00,
  base_subaccount_limit integer not null default 30,
  purchased_subaccount_extra_count integer not null default 0,
  purchased_subaccount_unit_price numeric(10,2) not null default 5.00,
  status text not null default 'BETA' check (status in ('ACTIVE', 'OVERDUE', 'PAUSED', 'CANCELED', 'BETA')),
  next_due_date date,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index para buscas otimizadas
create index if not exists idx_clinic_subscriptions_clinic_id on public.clinic_subscriptions(clinic_id);
create index if not exists idx_clinic_subscriptions_asaas_customer_id on public.clinic_subscriptions(asaas_customer_id);
create index if not exists idx_clinic_subscriptions_asaas_subscription_id on public.clinic_subscriptions(asaas_subscription_id);

-- 2. Tabela public.subscription_invoices
create table if not exists public.subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  subscription_id uuid references public.clinic_subscriptions(id),
  asaas_payment_id text not null unique,
  charge_type text not null default 'RECURRING_SUBSCRIPTION' check (charge_type in ('RECURRING_SUBSCRIPTION', 'ONE_TIME_SUBACCOUNT_EXPANSION')),
  status text not null default 'PENDING' check (status in ('PENDING', 'RECEIVED', 'CONFIRMED', 'OVERDUE', 'REFUNDED', 'DELETED')),
  value numeric(10,2) not null,
  net_value numeric(10,2),
  due_date date not null,
  payment_date timestamptz,
  billing_type text,
  invoice_url text,
  bank_slip_url text,
  pix_qr_code text,
  pix_copy_paste text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_subscription_invoices_clinic_id on public.subscription_invoices(clinic_id);
create index if not exists idx_subscription_invoices_asaas_payment_id on public.subscription_invoices(asaas_payment_id);

-- 3. Tabela public.asaas_webhook_events
create table if not exists public.asaas_webhook_events (
  id uuid primary key default gen_random_uuid(),
  asaas_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed boolean default false,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_asaas_webhook_events_asaas_event_id on public.asaas_webhook_events(asaas_event_id);

-- 4. Function e Trigger: sync_clinic_limits_from_subscription
-- Sincroniza subaccount_limit e concurrent_access_limit na tabela public.clinics a partir de public.clinic_subscriptions
create or replace function public.sync_clinic_limits_from_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_effective_subaccount_limit integer;
  v_effective_concurrent_access_limit integer;
begin
  -- Cálculo dos limites totais (base + adicionais comprados)
  if NEW.plan_type = 'solo' then
    v_effective_subaccount_limit := 1;
    v_effective_concurrent_access_limit := 1;
  else
    v_effective_subaccount_limit := coalesce(NEW.base_subaccount_limit, 30) + coalesce(NEW.purchased_subaccount_extra_count, 0);
    v_effective_concurrent_access_limit := coalesce(NEW.base_concurrent_access_count, 2) + coalesce(NEW.additional_concurrent_access_count, 0);
  end if;

  update public.clinics
  set
    subscription_plan = NEW.plan_type,
    subaccount_limit = v_effective_subaccount_limit,
    concurrent_access_limit = v_effective_concurrent_access_limit,
    updated_at = now()
  where id = NEW.clinic_id;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_clinic_limits_from_subscription on public.clinic_subscriptions;

create trigger trg_sync_clinic_limits_from_subscription
  after insert or update of plan_type, base_subaccount_limit, purchased_subaccount_extra_count, base_concurrent_access_count, additional_concurrent_access_count
  on public.clinic_subscriptions
  for each row
  execute function public.sync_clinic_limits_from_subscription();

-- Trigger para manter updated_at atualizado em clinic_subscriptions
create or replace function public.set_clinic_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists trg_set_clinic_subscriptions_updated_at on public.clinic_subscriptions;

create trigger trg_set_clinic_subscriptions_updated_at
  before update on public.clinic_subscriptions
  for each row
  execute function public.set_clinic_subscriptions_updated_at();

-- 5. RPC: get_clinic_subscription_summary(_clinic_id uuid)
create or replace function public.get_clinic_subscription_summary(_clinic_id uuid)
returns table (
  subscription_id uuid,
  clinic_id uuid,
  account_owner_user_id uuid,
  plan_type public.subscription_plan,
  status text,
  billing_cycle text,
  payment_method text,
  base_monthly_price numeric(10,2),
  total_recurring_monthly_price numeric(10,2),
  base_subaccount_limit integer,
  purchased_subaccount_extra_count integer,
  total_subaccount_limit integer,
  base_concurrent_access_count integer,
  additional_concurrent_access_count integer,
  total_concurrent_access_limit integer,
  next_due_date date,
  current_period_start timestamptz,
  current_period_end timestamptz,
  asaas_customer_id text,
  asaas_subscription_id text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Verifica permissão: Usuário logado deve ser membro ativo da clínica
  if not exists (
    select 1 from public.clinic_memberships cm
    where cm.clinic_id = _clinic_id
      and cm.user_id = auth.uid()
      and cm.is_active = true
      and cm.membership_status = 'active'
  ) then
    raise exception 'Acesso negado: você não é membro ativo desta clínica.';
  end if;

  return query
  select
    cs.id as subscription_id,
    cs.clinic_id,
    cs.account_owner_user_id,
    cs.plan_type,
    cs.status,
    cs.billing_cycle,
    cs.payment_method,
    cs.base_monthly_price,
    cs.total_recurring_monthly_price,
    cs.base_subaccount_limit,
    cs.purchased_subaccount_extra_count,
    (case when cs.plan_type = 'solo' then 1 else (coalesce(cs.base_subaccount_limit, 30) + coalesce(cs.purchased_subaccount_extra_count, 0)) end)::integer as total_subaccount_limit,
    cs.base_concurrent_access_count,
    cs.additional_concurrent_access_count,
    (case when cs.plan_type = 'solo' then 1 else (coalesce(cs.base_concurrent_access_count, 2) + coalesce(cs.additional_concurrent_access_count, 0)) end)::integer as total_concurrent_access_limit,
    cs.next_due_date,
    cs.current_period_start,
    cs.current_period_end,
    cs.asaas_customer_id,
    cs.asaas_subscription_id
  from public.clinic_subscriptions cs
  where cs.clinic_id = _clinic_id;
end;
$$;

grant execute on function public.get_clinic_subscription_summary(uuid) to authenticated;

-- 6. Row Level Security (RLS)
alter table public.clinic_subscriptions enable row level security;
alter table public.subscription_invoices enable row level security;
alter table public.asaas_webhook_events enable row level security;

-- Policies para clinic_subscriptions
drop policy if exists "Membros ativos da clinica podem ver a assinatura" on public.clinic_subscriptions;
create policy "Membros ativos da clinica podem ver a assinatura"
  on public.clinic_subscriptions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.clinic_memberships cm
      where cm.clinic_id = clinic_subscriptions.clinic_id
        and cm.user_id = auth.uid()
        and cm.is_active = true
        and cm.membership_status = 'active'
    )
  );

-- Policies para subscription_invoices
drop policy if exists "Membros ativos da clinica podem ver as faturas" on public.subscription_invoices;
create policy "Membros ativos da clinica podem ver as faturas"
  on public.subscription_invoices
  for select
  to authenticated
  using (
    exists (
      select 1 from public.clinic_memberships cm
      where cm.clinic_id = subscription_invoices.clinic_id
        and cm.user_id = auth.uid()
        and cm.is_active = true
        and cm.membership_status = 'active'
    )
  );

-- asaas_webhook_events: Sem política pública de leitura/escrita para authenticated, operada via service_role ou definer functions.
