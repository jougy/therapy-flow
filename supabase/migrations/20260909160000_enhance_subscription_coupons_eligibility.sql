-- Migration: 20260909160000_enhance_subscription_coupons_eligibility.sql
-- Descrição: Evolução da estrutura de cupons promocionais (subscription_coupons)
-- Adiciona suporte a duração do desconto, regras de elegibilidade da conta (JSONB)
-- e atualiza a RPC validate_subscription_coupon com validações completas de elegibilidade.

-- 1. Novas colunas em public.subscription_coupons
alter table public.subscription_coupons
  add column if not exists discount_duration_type text not null default 'FOREVER'
    check (discount_duration_type in ('ONCE', 'REPEATING', 'FOREVER')),
  add column if not exists discount_duration_months integer default null
    check (discount_duration_months is null or discount_duration_months > 0),
  add column if not exists eligibility_rules jsonb not null default '{}'::jsonb;

comment on column public.subscription_coupons.discount_duration_type is 'Duração do desconto: ONCE (1ª fatura), REPEATING (por X meses), FOREVER (vitalício/todas as faturas)';
comment on column public.subscription_coupons.discount_duration_months is 'Quantidade de meses/renovações quando discount_duration_type = REPEATING';
comment on column public.subscription_coupons.eligibility_rules is 'Configurações de elegibilidade da conta: data de criação, colaboradores, sessões, novos clientes, pacientes, ciclos, winback, estados';

-- 2. Atualização da RPC public.validate_subscription_coupon
-- Suporta validação temporal, limites, e se _clinic_id for fornecido, valida as regras de elegibilidade da conta.
create or replace function public.validate_subscription_coupon(
  _code text,
  _plan_type text default 'clinic',
  _clinic_id uuid default null,
  _billing_cycle text default null
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
  v_rules jsonb;
  v_clinic record;
  v_collaborator_count integer;
  v_session_count integer;
  v_patient_count integer;
  v_paid_invoices_count integer;
  v_is_winback boolean;
  v_mode text;
  v_after date;
  v_before date;
  v_op text;
  v_val integer;
  v_allowed_cycles jsonb;
  v_allowed_states jsonb;
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

  -- 1. Status manual
  if not v_coupon.is_active then
    return jsonb_build_object(
      'valid', false,
      'message', 'Este cupom está temporariamente pausado ou desativado.'
    );
  end if;

  -- 2. Vigência temporal inicial
  if v_coupon.valid_from > now() then
    return jsonb_build_object(
      'valid', false,
      'message', 'Este cupom ainda não está vigente (inicia em ' || to_char(v_coupon.valid_from, 'DD/MM/YYYY') || ').'
    );
  end if;

  -- 3. Vigência temporal final
  if v_coupon.valid_until is not null and v_coupon.valid_until < now() then
    return jsonb_build_object(
      'valid', false,
      'message', 'Este cupom expirou em ' || to_char(v_coupon.valid_until, 'DD/MM/YYYY') || '.'
    );
  end if;

  -- 4. Limite de resgates
  if v_coupon.max_redemptions is not null and v_coupon.times_redeemed >= v_coupon.max_redemptions then
    return jsonb_build_object(
      'valid', false,
      'message', 'O limite máximo de resgates deste cupom foi atingido.'
    );
  end if;

  -- 5. Planos aplicáveis
  if v_coupon.applicable_plans is not null and array_length(v_coupon.applicable_plans, 1) > 0 then
    if not (_plan_type = any(v_coupon.applicable_plans)) then
      return jsonb_build_object(
        'valid', false,
        'message', 'Este cupom não é aplicável ao plano selecionado (' || _plan_type || ').'
      );
    end if;
  end if;

  v_rules := coalesce(v_coupon.eligibility_rules, '{}'::jsonb);

  -- 6. Validação de Ciclos de Cobrança Alvo (se informado)
  v_allowed_cycles := v_rules->'target_billing_cycles';
  if v_allowed_cycles is not null and jsonb_typeof(v_allowed_cycles) = 'array' and jsonb_array_length(v_allowed_cycles) > 0 then
    if _billing_cycle is not null and trim(_billing_cycle) <> '' then
      if not (v_allowed_cycles ? lower(trim(_billing_cycle))) then
        return jsonb_build_object(
          'valid', false,
          'message', 'Este cupom é exclusivo para ciclos de cobrança específicos (ex: ' || coalesce(v_rules->>'target_billing_cycles_label', 'outro ciclo') || ').'
        );
      end if;
    end if;
  end if;

  -- 7. Validação de Condições da Conta / Clínica (se _clinic_id for fornecido)
  if _clinic_id is not null then
    select id, created_at, address_state, access_status
    into v_clinic
    from public.clinics
    where id = _clinic_id;

    if v_clinic.id is not null then
      -- 7.1 Data de Criação da Clínica
      if v_rules->'account_creation' is not null then
        v_mode := v_rules->'account_creation'->>'mode';
        if v_mode = 'after' and (v_rules->'account_creation'->>'after_date') is not null then
          v_after := (v_rules->'account_creation'->>'after_date')::date;
          if v_clinic.created_at::date < v_after then
            return jsonb_build_object(
              'valid', false,
              'message', 'Este cupom é válido apenas para clínicas cadastradas a partir de ' || to_char(v_after, 'DD/MM/YYYY') || '.'
            );
          end if;
        elsif v_mode = 'before' and (v_rules->'account_creation'->>'before_date') is not null then
          v_before := (v_rules->'account_creation'->>'before_date')::date;
          if v_clinic.created_at::date > v_before then
            return jsonb_build_object(
              'valid', false,
              'message', 'Este cupom é válido apenas para clínicas cadastradas antes de ' || to_char(v_before, 'DD/MM/YYYY') || '.'
            );
          end if;
        elsif v_mode = 'between' then
          v_after := (v_rules->'account_creation'->>'after_date')::date;
          v_before := (v_rules->'account_creation'->>'before_date')::date;
          if v_after is not null and v_clinic.created_at::date < v_after then
            return jsonb_build_object(
              'valid', false,
              'message', 'Este cupom é válido apenas para contas criadas entre ' || to_char(v_after, 'DD/MM/YYYY') || ' e ' || to_char(v_before, 'DD/MM/YYYY') || '.'
            );
          end if;
          if v_before is not null and v_clinic.created_at::date > v_before then
            return jsonb_build_object(
              'valid', false,
              'message', 'Este cupom é válido apenas para contas criadas entre ' || to_char(v_after, 'DD/MM/YYYY') || ' e ' || to_char(v_before, 'DD/MM/YYYY') || '.'
            );
          end if;
        end if;
      end if;

      -- 7.2 Quantidade de Colaboradores Registrados
      if (v_rules->'collaborators'->>'enabled')::boolean is true then
        v_op := coalesce(v_rules->'collaborators'->>'operator', 'gte');
        v_val := coalesce((v_rules->'collaborators'->>'value')::integer, 0);

        select count(*)::integer into v_collaborator_count
        from public.clinic_memberships
        where clinic_id = _clinic_id and is_active = true;

        if v_op = 'gte' and v_collaborator_count < v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Sua clínica precisa ter pelo menos ' || v_val || ' colaboradores ativos para aplicar este cupom (atual: ' || v_collaborator_count || ').'
          );
        elsif v_op = 'lte' and v_collaborator_count > v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom é restrito a equipes de até ' || v_val || ' colaboradores (atual: ' || v_collaborator_count || ').'
          );
        elsif v_op = 'eq' and v_collaborator_count <> v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom exige exatamente ' || v_val || ' colaboradores registrados (atual: ' || v_collaborator_count || ').'
          );
        end if;
      end if;

      -- 7.3 Quantidade de Atendimentos Realizados (sessões clínicas)
      if (v_rules->'sessions'->>'enabled')::boolean is true then
        v_op := coalesce(v_rules->'sessions'->>'operator', 'gte');
        v_val := coalesce((v_rules->'sessions'->>'value')::integer, 0);

        select count(*)::integer into v_session_count
        from public.sessions
        where clinic_id = _clinic_id;

        if v_op = 'gte' and v_session_count < v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Sua clínica precisa ter no mínimo ' || v_val || ' atendimentos registrados para desbloquear este cupom (atual: ' || v_session_count || ').'
          );
        elsif v_op = 'lte' and v_session_count > v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom é exclusivo para clínicas com até ' || v_val || ' atendimentos (atual: ' || v_session_count || ').'
          );
        elsif v_op = 'eq' and v_session_count <> v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom exige exatamente ' || v_val || ' atendimentos realizados (atual: ' || v_session_count || ').'
          );
        end if;
      end if;

      -- 7.4 Sugestão 1: Apenas Primeira Assinatura / Novos Clientes
      if (v_rules->>'first_subscription_only')::boolean is true then
        select count(*)::integer into v_paid_invoices_count
        from public.subscription_invoices
        where clinic_id = _clinic_id and status in ('CONFIRMED', 'RECEIVED');

        if v_paid_invoices_count > 0 then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom de boas-vindas é exclusivo para novos clientes na primeira contratação.'
          );
        end if;
      end if;

      -- 7.5 Sugestão 2: Quantidade de Pacientes Cadastrados
      if (v_rules->'patients'->>'enabled')::boolean is true then
        v_op := coalesce(v_rules->'patients'->>'operator', 'gte');
        v_val := coalesce((v_rules->'patients'->>'value')::integer, 0);

        select count(*)::integer into v_patient_count
        from public.patients
        where clinic_id = _clinic_id;

        if v_op = 'gte' and v_patient_count < v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Sua clínica precisa ter pelo menos ' || v_val || ' pacientes cadastrados para este cupom (atual: ' || v_patient_count || ').'
          );
        elsif v_op = 'lte' and v_patient_count > v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom é voltado para consultórios com até ' || v_val || ' pacientes (atual: ' || v_patient_count || ').'
          );
        elsif v_op = 'eq' and v_patient_count <> v_val then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom exige exatamente ' || v_val || ' pacientes cadastrados (atual: ' || v_patient_count || ').'
          );
        end if;
      end if;

      -- 7.6 Sugestão 4: Condição Winback (Apenas Clínicas Inativas/Canceladas)
      if (v_rules->>'winback_only')::boolean is true then
        select exists (
          select 1 from public.clinic_subscriptions
          where clinic_id = _clinic_id
            and status in ('CANCELED', 'EXPIRED', 'SUSPENDED', 'OVERDUE')
        ) into v_is_winback;

        if not v_is_winback and v_clinic.access_status not in ('suspended', 'blocked', 'past_due') then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom de reativação é exclusivo para contas inativas ou que estão retornando à plataforma.'
          );
        end if;
      end if;

      -- 7.7 Sugestão 5: Filtro Regional por Estado (UF)
      v_allowed_states := v_rules->'allowed_states';
      if v_allowed_states is not null and jsonb_typeof(v_allowed_states) = 'array' and jsonb_array_length(v_allowed_states) > 0 then
        if v_clinic.address_state is null or not (v_allowed_states ? upper(trim(v_clinic.address_state))) then
          return jsonb_build_object(
            'valid', false,
            'message', 'Este cupom é restrito a clínicas sediadas em estados específicos atendidos pela parceria regional.'
          );
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'description', v_coupon.description,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'discount_duration_type', v_coupon.discount_duration_type,
    'discount_duration_months', v_coupon.discount_duration_months,
    'message', 'Cupom aplicado com sucesso!'
  );
end;
$$;

grant execute on function public.validate_subscription_coupon(text, text, uuid, text) to authenticated;
grant execute on function public.validate_subscription_coupon(text, text, uuid, text) to anon;
