-- Migration: 20260817150000_add_subscription_coupons_and_billing_enhancements.sql
-- Descrição: Módulo de Assinaturas (Etapa 01) - Tabela de Cupons de Desconto (subscription_coupons),
-- extensões para clinic_subscriptions e subscription_invoices, RPCs de validação de cupom, resumo,
-- override administrativo pelo Platform Admin e auditoria/logs de webhooks Asaas.

-- 1. Tabela public.subscription_coupons
create table if not exists public.subscription_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(trim(code)) and length(code) >= 3),
  description text,
  discount_type text not null check (discount_type in ('PERCENTAGE', 'FIXED_AMOUNT', 'TRIAL_DAYS')),
  discount_value numeric(10,2) not null default 0.00 check (discount_value >= 0),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  times_redeemed integer not null default 0 check (times_redeemed >= 0),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  is_active boolean not null default true,
  applicable_plans text[] default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscription_coupons_code on public.subscription_coupons(code);
create index if not exists idx_subscription_coupons_is_active on public.subscription_coupons(is_active);

-- Seed de Cupons Padrão (Idempotente)
insert into public.subscription_coupons (code, description, discount_type, discount_value, max_redemptions, is_active)
values
  ('PRIMEIROMES100', '100% de desconto no primeiro mês de assinatura', 'PERCENTAGE', 100.00, null, true),
  ('BETA50', '50% de desconto promocional Beta', 'PERCENTAGE', 50.00, null, true),
  ('DESCONTO10', 'Desconto fixo de R$ 10,00 na mensalidade', 'FIXED_AMOUNT', 10.00, null, true),
  ('DEGUSTACAO30', '30 dias de degustação gratuita sem cobrança imediata', 'TRIAL_DAYS', 30.00, null, true)
on conflict (code) do update
set
  description = EXCLUDED.description,
  discount_type = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  updated_at = now();

-- 2. Novas colunas em public.clinic_subscriptions
alter table public.clinic_subscriptions
  add column if not exists applied_coupon_id uuid references public.subscription_coupons(id) on delete set null,
  add column if not exists coupon_code text,
  add column if not exists discount_percentage numeric(5,2) default 0.00 check (discount_percentage >= 0 and discount_percentage <= 100),
  add column if not exists discount_fixed_amount numeric(10,2) default 0.00 check (discount_fixed_amount >= 0),
  add column if not exists trial_ends_at timestamptz,
  add column if not exists override_reason text,
  add column if not exists override_by_user_id uuid references public.profiles(id),
  add column if not exists override_at timestamptz,
  add column if not exists cpf_cnpj text,
  add column if not exists billing_email text,
  add column if not exists billing_name text;

create index if not exists idx_clinic_subscriptions_coupon_code on public.clinic_subscriptions(coupon_code);

-- 3. Novas colunas em public.subscription_invoices
alter table public.subscription_invoices
  add column if not exists asaas_customer_id text,
  add column if not exists asaas_subscription_id text,
  add column if not exists discount_amount numeric(10,2) default 0.00,
  add column if not exists original_value numeric(10,2),
  add column if not exists pix_expiration_date timestamptz;

create index if not exists idx_subscription_invoices_status on public.subscription_invoices(status);

-- 4. Novas colunas em public.asaas_webhook_events
alter table public.asaas_webhook_events
  add column if not exists signature text;

-- 5. RPC: public.validate_subscription_coupon(_code text, _plan_type text)
create or replace function public.validate_subscription_coupon(
  _code text,
  _plan_type text default 'clinic'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_normalized_code text;
  v_coupon public.subscription_coupons%rowtype;
begin
  if _code is null or trim(_code) = '' then
    return jsonb_build_object(
      'valid', false,
      'message', 'Código do cupom não informado.'
    );
  end if;

  v_normalized_code := upper(trim(_code));

  select * into v_coupon
  from public.subscription_coupons
  where code = v_normalized_code;

  if v_coupon.id is null then
    return jsonb_build_object(
      'valid', false,
      'message', 'Cupom inválido ou não encontrado.'
    );
  end if;

  if not v_coupon.is_active then
    return jsonb_build_object(
      'valid', false,
      'message', 'Este cupom não está mais ativo.'
    );
  end if;

  if v_coupon.valid_from > now() then
    return jsonb_build_object(
      'valid', false,
      'message', 'Este cupom ainda não está vigente.'
    );
  end if;

  if v_coupon.valid_until is not null and v_coupon.valid_until < now() then
    return jsonb_build_object(
      'valid', false,
      'message', 'Este cupom expirou.'
    );
  end if;

  if v_coupon.max_redemptions is not null and v_coupon.times_redeemed >= v_coupon.max_redemptions then
    return jsonb_build_object(
      'valid', false,
      'message', 'Limite máximo de resgates deste cupom atingido.'
    );
  end if;

  if v_coupon.applicable_plans is not null and array_length(v_coupon.applicable_plans, 1) > 0 then
    if not (_plan_type = any(v_coupon.applicable_plans)) then
      return jsonb_build_object(
        'valid', false,
        'message', 'Este cupom não é aplicável ao plano selecionado.'
      );
    end if;
  end if;

  return jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'description', v_coupon.description,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'message', 'Cupom aplicado com sucesso!'
  );
end;
$$;

grant execute on function public.validate_subscription_coupon(text, text) to authenticated;
grant execute on function public.validate_subscription_coupon(text, text) to anon;

-- 6. Atualização do RPC: public.get_clinic_subscription_summary(_clinic_id uuid)
drop function if exists public.get_clinic_subscription_summary(uuid);
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
  asaas_subscription_id text,
  applied_coupon_id uuid,
  coupon_code text,
  discount_percentage numeric(5,2),
  discount_fixed_amount numeric(10,2),
  trial_ends_at timestamptz,
  override_reason text,
  override_by_user_id uuid,
  override_at timestamptz,
  cpf_cnpj text,
  billing_email text,
  billing_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Permissão: Usuário logado deve ser membro ativo da clínica OU Administrador da Plataforma
  if not (
    exists (
      select 1 from public.clinic_memberships cm
      where cm.clinic_id = _clinic_id
        and cm.user_id = auth.uid()
        and cm.is_active = true
        and cm.membership_status = 'active'
    )
    or exists (
      select 1 from public.platform_admins pa
      where pa.user_id = auth.uid()
        and pa.is_active = true
    )
  ) then
    raise exception 'Acesso negado: você não tem permissão para visualizar a assinatura desta clínica.';
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
    cs.asaas_subscription_id,
    cs.applied_coupon_id,
    cs.coupon_code,
    cs.discount_percentage,
    cs.discount_fixed_amount,
    cs.trial_ends_at,
    cs.override_reason,
    cs.override_by_user_id,
    cs.override_at,
    cs.cpf_cnpj,
    cs.billing_email,
    cs.billing_name
  from public.clinic_subscriptions cs
  where cs.clinic_id = _clinic_id;
end;
$$;

grant execute on function public.get_clinic_subscription_summary(uuid) to authenticated;

-- 7. RPC: public.platform_override_clinic_subscription (Backoffice Administrative Override)
create or replace function public.platform_override_clinic_subscription(
  _clinic_id uuid,
  _new_plan public.subscription_plan default null,
  _status text default null,
  _subaccount_limit integer default null,
  _concurrent_access_limit integer default null,
  _next_due_date date default null,
  _reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_is_platform_admin boolean;
  v_sub_record public.clinic_subscriptions%rowtype;
  v_owner_id uuid;
begin
  -- Exige permissão de Administrador da Plataforma
  select exists (
    select 1 from public.platform_admins
    where user_id = v_caller_id and is_active = true
  ) into v_is_platform_admin;

  if not v_is_platform_admin then
    raise exception 'Acesso negado: apenas administradores da plataforma podem realizar overrides operacionais.';
  end if;

  if _reason is null or trim(_reason) = '' then
    raise exception 'Justificativa (motivo) é obrigatória para realizar override de assinatura.';
  end if;

  -- Busca owner da clínica
  select account_owner_user_id into v_owner_id from public.clinics where id = _clinic_id;
  v_owner_id := coalesce(v_owner_id, v_caller_id);

  -- Garante registro de assinatura
  select * into v_sub_record from public.clinic_subscriptions where clinic_id = _clinic_id;
  if v_sub_record.id is null then
    insert into public.clinic_subscriptions (
      clinic_id, account_owner_user_id, plan_type, base_monthly_price,
      base_subaccount_limit, base_concurrent_access_count, status
    )
    values (
      _clinic_id, v_owner_id, coalesce(_new_plan, 'clinic'),
      case when coalesce(_new_plan, 'clinic') = 'solo' then 50.00 else 60.00 end,
      case when coalesce(_new_plan, 'clinic') = 'solo' then 1 else 30 end,
      case when coalesce(_new_plan, 'clinic') = 'solo' then 1 else 2 end,
      coalesce(_status, 'ACTIVE')
    )
    returning * into v_sub_record;
  end if;

  update public.clinic_subscriptions
  set
    plan_type = coalesce(_new_plan, plan_type),
    status = coalesce(_status, status),
    base_subaccount_limit = coalesce(_subaccount_limit, base_subaccount_limit),
    additional_concurrent_access_count = case
      when _concurrent_access_limit is not null then greatest(0, _concurrent_access_limit - base_concurrent_access_count)
      else additional_concurrent_access_count
    end,
    next_due_date = coalesce(_next_due_date, next_due_date),
    override_reason = trim(_reason),
    override_by_user_id = v_caller_id,
    override_at = now(),
    updated_at = now()
  where clinic_id = _clinic_id
  returning * into v_sub_record;

  return jsonb_build_object(
    'success', true,
    'clinic_id', _clinic_id,
    'plan_type', v_sub_record.plan_type,
    'status', v_sub_record.status,
    'subaccount_limit', v_sub_record.base_subaccount_limit + v_sub_record.purchased_subaccount_extra_count,
    'concurrent_access_limit', v_sub_record.base_concurrent_access_count + v_sub_record.additional_concurrent_access_count,
    'next_due_date', v_sub_record.next_due_date,
    'override_reason', v_sub_record.override_reason,
    'override_at', v_sub_record.override_at
  );
end;
$$;

grant execute on function public.platform_override_clinic_subscription(uuid, public.subscription_plan, text, integer, integer, date, text) to authenticated;

-- 8. RPC: public.get_asaas_webhook_logs(_limit integer, _offset integer)
create or replace function public.get_asaas_webhook_logs(
  _limit integer default 50,
  _offset integer default 0
)
returns table (
  id uuid,
  asaas_event_id text,
  event_type text,
  payload jsonb,
  processed boolean,
  processed_at timestamptz,
  error_message text,
  signature text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.platform_admins
    where user_id = auth.uid() and is_active = true
  ) then
    raise exception 'Acesso negado: apenas administradores da plataforma podem acessar os logs de webhooks.';
  end if;

  return query
  select
    awe.id,
    awe.asaas_event_id,
    awe.event_type,
    awe.payload,
    awe.processed,
    awe.processed_at,
    awe.error_message,
    awe.signature,
    awe.created_at
  from public.asaas_webhook_events awe
  order by awe.created_at desc
  limit greatest(1, least(200, coalesce(_limit, 50)))
  offset greatest(0, coalesce(_offset, 0));
end;
$$;

grant execute on function public.get_asaas_webhook_logs(integer, integer) to authenticated;

-- 9. Atualização das Políticas RLS
alter table public.subscription_coupons enable row level security;

drop policy if exists "Todos autenticados e anonimos podem consultar cupons ativos" on public.subscription_coupons;
create policy "Todos autenticados e anonimos podem consultar cupons ativos"
  on public.subscription_coupons
  for select
  using (is_active = true and (valid_until is null or valid_until >= now()));

drop policy if exists "Platform admins possuem controle total dos cupons" on public.subscription_coupons;
create policy "Platform admins possuem controle total dos cupons"
  on public.subscription_coupons
  for all
  to authenticated
  using (
    exists (
      select 1 from public.platform_admins pa
      where pa.user_id = auth.uid() and pa.is_active = true
    )
  );

drop policy if exists "Platform admins podem ver todas as assinaturas" on public.clinic_subscriptions;
create policy "Platform admins podem ver todas as assinaturas"
  on public.clinic_subscriptions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.platform_admins pa
      where pa.user_id = auth.uid() and pa.is_active = true
    )
  );

drop policy if exists "Platform admins podem ver todas as faturas" on public.subscription_invoices;
create policy "Platform admins podem ver todas as faturas"
  on public.subscription_invoices
  for select
  to authenticated
  using (
    exists (
      select 1 from public.platform_admins pa
      where pa.user_id = auth.uid() and pa.is_active = true
    )
  );

drop policy if exists "Platform admins podem ver eventos de webhook" on public.asaas_webhook_events;
create policy "Platform admins podem ver eventos de webhook"
  on public.asaas_webhook_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.platform_admins pa
      where pa.user_id = auth.uid() and pa.is_active = true
    )
  );
