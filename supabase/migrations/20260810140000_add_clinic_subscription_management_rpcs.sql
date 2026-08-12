-- Migration: 20260810140000_add_clinic_subscription_management_rpcs.sql
-- Descrição: RPCs para troca de plano (upgrade/downgrade com validação), compra avulsa de vagas e ajuste de acessos simultâneos.

-- 1. Helper function para verificar se o usuário atual é o account_owner ou platform_owner
create or replace function public.is_clinic_subscription_manager(_user_id uuid, _clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clinic_memberships cm
    where cm.clinic_id = _clinic_id
      and cm.user_id = _user_id
      and cm.account_role = 'account_owner'
      and cm.is_active = true
      and cm.membership_status = 'active'
  )
  or exists (
    select 1 from public.platform_admins pa
    where pa.user_id = _user_id
      and pa.is_active = true
  )
$$;

-- 2. RPC: manage_clinic_subscription_plan(_clinic_id uuid, _new_plan public.subscription_plan)
create or replace function public.manage_clinic_subscription_plan(
  _clinic_id uuid,
  _new_plan public.subscription_plan
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid := auth.uid();
  v_active_subaccounts_count integer;
  v_owner_user_id uuid;
  v_sub_record public.clinic_subscriptions%rowtype;
begin
  if not public.is_clinic_subscription_manager(v_current_user_id, _clinic_id) then
    raise exception 'Acesso negado: apenas o responsável pela clínica (account_owner) pode alterar o plano.';
  end if;

  select account_owner_user_id into v_owner_user_id
  from public.clinics
  where id = _clinic_id;

  v_owner_user_id := coalesce(v_owner_user_id, v_current_user_id);

  -- Validação no Downgrade para Solo: Não pode ter colaboradores ativos cadastrados
  if _new_plan = 'solo' then
    select count(*)::integer into v_active_subaccounts_count
    from public.clinic_memberships
    where clinic_id = _clinic_id
      and is_active = true
      and membership_status = 'active'
      and account_role != 'account_owner';

    if v_active_subaccounts_count > 0 then
      raise exception 'Não é possível alterar para o plano Solo enquanto houver % colaborador(es) ativo(s) cadastrado(s). Desative ou remova os colaboradores primeiro.', v_active_subaccounts_count;
    end if;
  end if;

  -- Upsert em clinic_subscriptions
  insert into public.clinic_subscriptions (
    clinic_id,
    account_owner_user_id,
    plan_type,
    base_monthly_price,
    base_subaccount_limit,
    base_concurrent_access_count,
    additional_concurrent_access_count,
    additional_concurrent_access_price,
    total_recurring_monthly_price,
    status
  )
  values (
    _clinic_id,
    v_owner_user_id,
    _new_plan,
    case when _new_plan = 'clinic' then 60.00 else 50.00 end,
    case when _new_plan = 'clinic' then 30 else 1 end,
    case when _new_plan = 'clinic' then 2 else 1 end,
    case when _new_plan = 'solo' then 0 else 0 end,
    10.00,
    case when _new_plan = 'clinic' then 60.00 else 50.00 end,
    'BETA'
  )
  on conflict (clinic_id) do update
  set
    plan_type = EXCLUDED.plan_type,
    base_monthly_price = EXCLUDED.base_monthly_price,
    base_subaccount_limit = EXCLUDED.base_subaccount_limit,
    base_concurrent_access_count = EXCLUDED.base_concurrent_access_count,
    additional_concurrent_access_count = case when EXCLUDED.plan_type = 'solo' then 0 else clinic_subscriptions.additional_concurrent_access_count end,
    total_recurring_monthly_price = case when EXCLUDED.plan_type = 'clinic' then 60.00 + (clinic_subscriptions.additional_concurrent_access_count * 10.00) else 50.00 end,
    updated_at = now()
  returning * into v_sub_record;

  return jsonb_build_object(
    'success', true,
    'clinic_id', _clinic_id,
    'plan_type', v_sub_record.plan_type,
    'base_subaccount_limit', v_sub_record.base_subaccount_limit,
    'base_concurrent_access_count', v_sub_record.base_concurrent_access_count,
    'total_recurring_monthly_price', v_sub_record.total_recurring_monthly_price
  );
end;
$$;

-- 3. RPC: buy_clinic_subaccount_extra_spaces(_clinic_id uuid, _quantity integer, _billing_type text)
create or replace function public.buy_clinic_subaccount_extra_spaces(
  _clinic_id uuid,
  _quantity integer,
  _billing_type text default 'PIX'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid := auth.uid();
  v_sub_record public.clinic_subscriptions%rowtype;
  v_unit_price numeric(10,2) := 5.00;
  v_total_price numeric(10,2);
  v_payment_id text;
  v_invoice_id uuid;
begin
  if not public.is_clinic_subscription_manager(v_current_user_id, _clinic_id) then
    raise exception 'Acesso negado: apenas o responsável pela clínica pode adquirir vagas extras.';
  end if;

  if coalesce(_quantity, 0) <= 0 then
    raise exception 'Quantidade de vagas inválida. Informe um valor maior que zero.';
  end if;

  v_total_price := _quantity * v_unit_price;

  -- Garante que existe registro de assinatura
  select * into v_sub_record from public.clinic_subscriptions where clinic_id = _clinic_id;
  if v_sub_record.id is null then
    insert into public.clinic_subscriptions (clinic_id, account_owner_user_id, plan_type, base_monthly_price, base_subaccount_limit, base_concurrent_access_count, status)
    values (_clinic_id, v_current_user_id, 'clinic', 60.00, 30, 2, 'BETA')
    returning * into v_sub_record;
  end if;

  if v_sub_record.plan_type = 'solo' then
    raise exception 'Não é possível comprar vagas extras no plano Solo. Faça upgrade para o plano Clínica primeiro.';
  end if;

  -- Incrementa vagas compradas em clinic_subscriptions
  update public.clinic_subscriptions
  set
    purchased_subaccount_extra_count = coalesce(purchased_subaccount_extra_count, 0) + _quantity,
    updated_at = now()
  where clinic_id = _clinic_id
  returning * into v_sub_record;

  -- Registra a fatura avulsa
  v_payment_id := 'EXP_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.subscription_invoices (
    clinic_id,
    subscription_id,
    asaas_payment_id,
    charge_type,
    status,
    value,
    due_date,
    payment_date,
    billing_type,
    metadata
  )
  values (
    _clinic_id,
    v_sub_record.id,
    v_payment_id,
    'ONE_TIME_SUBACCOUNT_EXPANSION',
    'CONFIRMED',
    v_total_price,
    current_date,
    now(),
    _billing_type,
    jsonb_build_object(
      'purchased_quantity', _quantity,
      'unit_price', v_unit_price,
      'description', 'Compra avulsa de ' || _quantity || ' vagas de colaboradores'
    )
  )
  returning id into v_invoice_id;

  return jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'purchased_quantity', _quantity,
    'total_price', v_total_price,
    'new_subaccount_limit', v_sub_record.base_subaccount_limit + v_sub_record.purchased_subaccount_extra_count
  );
end;
$$;

-- 4. RPC: update_clinic_concurrent_accesses(_clinic_id uuid, _extra_concurrent integer)
create or replace function public.update_clinic_concurrent_accesses(
  _clinic_id uuid,
  _extra_concurrent integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid := auth.uid();
  v_sub_record public.clinic_subscriptions%rowtype;
begin
  if not public.is_clinic_subscription_manager(v_current_user_id, _clinic_id) then
    raise exception 'Acesso negado: apenas o responsável pela clínica pode ajustar os acessos simultâneos.';
  end if;

  if coalesce(_extra_concurrent, 0) < 0 then
    raise exception 'Quantidade de acessos extras inválida.';
  end if;

  select * into v_sub_record from public.clinic_subscriptions where clinic_id = _clinic_id;
  if v_sub_record.id is null then
    insert into public.clinic_subscriptions (clinic_id, account_owner_user_id, plan_type, base_monthly_price, base_subaccount_limit, base_concurrent_access_count, status)
    values (_clinic_id, v_current_user_id, 'clinic', 60.00, 30, 2, 'BETA')
    returning * into v_sub_record;
  end if;

  if v_sub_record.plan_type = 'solo' then
    raise exception 'Não é possível adicionar acessos simultâneos extras no plano Solo. Faça upgrade para o plano Clínica primeiro.';
  end if;

  update public.clinic_subscriptions
  set
    additional_concurrent_access_count = _extra_concurrent,
    total_recurring_monthly_price = 60.00 + (_extra_concurrent * 10.00),
    updated_at = now()
  where clinic_id = _clinic_id
  returning * into v_sub_record;

  return jsonb_build_object(
    'success', true,
    'additional_concurrent_access_count', _extra_concurrent,
    'total_concurrent_access_limit', v_sub_record.base_concurrent_access_count + _extra_concurrent,
    'total_recurring_monthly_price', v_sub_record.total_recurring_monthly_price
  );
end;
$$;

grant execute on function public.is_clinic_subscription_manager(uuid, uuid) to authenticated;
grant execute on function public.manage_clinic_subscription_plan(uuid, public.subscription_plan) to authenticated;
grant execute on function public.buy_clinic_subaccount_extra_spaces(uuid, integer, text) to authenticated;
grant execute on function public.update_clinic_concurrent_accesses(uuid, integer) to authenticated;
