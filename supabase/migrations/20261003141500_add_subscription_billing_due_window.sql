-- Migration: 20261003141500_add_subscription_billing_due_window.sql
-- Descrição: Adiciona configuração de janela de débito/vencimento mensal em clinic_subscriptions
--            com trava de alteração de 1x por mês e aplicação para o ciclo subsequente.

-- 1. Adicionar colunas em clinic_subscriptions
ALTER TABLE public.clinic_subscriptions 
  ADD COLUMN IF NOT EXISTS billing_due_window text DEFAULT 'DAY_1_TO_5',
  ADD COLUMN IF NOT EXISTS billing_due_window_updated_at timestamptz DEFAULT now();

-- Constraint check para as 3 janelas permitidas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clinic_subscriptions_billing_due_window_check'
  ) THEN
    ALTER TABLE public.clinic_subscriptions
      ADD CONSTRAINT clinic_subscriptions_billing_due_window_check
      CHECK (billing_due_window IN ('DAY_1_TO_5', 'DAY_10_TO_15', 'DAY_25_TO_30'));
  END IF;
END $$;

-- 2. Função RPC segura para alteração da janela de vencimento (1x por mês)
CREATE OR REPLACE FUNCTION public.update_clinic_billing_due_window(
  _clinic_id uuid,
  _window text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sub record;
  v_is_owner boolean;
  v_is_admin boolean;
  v_last_updated timestamptz;
  v_now timestamptz := clock_timestamp();
  v_days_since_last_update integer;
  v_next_allowed_at timestamptz;
  v_target_day integer;
  v_current_next_due date;
  v_new_next_due date;
BEGIN
  -- Validar parâmetro de entrada
  IF _window NOT IN ('DAY_1_TO_5', 'DAY_10_TO_15', 'DAY_25_TO_30') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Janela de vencimento inválida. Opções permitidas: DAY_1_TO_5, DAY_10_TO_15, DAY_25_TO_30.'
    );
  END IF;

  -- Verificar autorização: proprietário da clínica ou platform_admin
  SELECT (cm.account_role = 'account_owner' AND cm.is_active = true)
  INTO v_is_owner
  FROM public.clinic_memberships cm
  WHERE cm.clinic_id = _clinic_id AND cm.user_id = v_user_id;

  SELECT (pa.is_active = true)
  INTO v_is_admin
  FROM public.platform_admins pa
  WHERE pa.user_id = v_user_id;

  IF NOT (COALESCE(v_is_owner, false) OR COALESCE(v_is_admin, false)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Apenas o proprietário da clínica ou administrador pode alterar as preferências de cobrança.'
    );
  END IF;

  -- Buscar assinatura atual
  SELECT * INTO v_sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _clinic_id;

  IF v_sub.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Assinatura da clínica não encontrada.'
    );
  END IF;

  -- Se já for a mesma janela, apenas retornar sucesso
  IF v_sub.billing_due_window = _window THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'A janela de vencimento informada já está ativa.',
      'billing_due_window', _window,
      'billing_due_window_updated_at', v_sub.billing_due_window_updated_at
    );
  END IF;

  -- Validar se já houve alteração nos últimos 30 dias (Regra: 1 vez por mês)
  v_last_updated := v_sub.billing_due_window_updated_at;
  IF v_last_updated IS NOT NULL THEN
    v_days_since_last_update := EXTRACT(DAY FROM (v_now - v_last_updated))::integer;
    v_next_allowed_at := v_last_updated + interval '30 days';
    
    -- Se tiver sido alterado há menos de 30 dias e não for a primeira configuração
    IF v_days_since_last_update < 30 AND v_sub.billing_due_window IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('A janela de vencimento só pode ser alterada uma vez a cada 30 dias. Próxima alteração permitida em %s.', to_char(v_next_allowed_at, 'DD/MM/YYYY')),
        'next_allowed_at', v_next_allowed_at,
        'days_remaining', (30 - v_days_since_last_update)
      );
    END IF;
  END IF;

  -- Mapear dia de vencimento alvo da janela escolhida
  v_target_day := CASE 
    WHEN _window = 'DAY_1_TO_5' THEN 5
    WHEN _window = 'DAY_10_TO_15' THEN 15
    WHEN _window = 'DAY_25_TO_30' THEN 30
    ELSE 5
  END;

  -- Calcular o vencimento para o próximo ciclo subsequente
  v_current_next_due := COALESCE(v_sub.next_due_date, CURRENT_DATE + interval '30 days');
  -- Ajustar para o dia alvo mantendo ou projetando para o mês seguinte
  v_new_next_due := make_date(
    EXTRACT(YEAR FROM v_current_next_due)::integer,
    EXTRACT(MONTH FROM v_current_next_due)::integer,
    LEAST(v_target_day, EXTRACT(DAY FROM (date_trunc('month', v_current_next_due) + interval '1 month - 1 day'))::integer)
  );

  IF v_new_next_due <= CURRENT_DATE THEN
    v_new_next_due := make_date(
      EXTRACT(YEAR FROM v_current_next_due + interval '1 month')::integer,
      EXTRACT(MONTH FROM v_current_next_due + interval '1 month')::integer,
      LEAST(v_target_day, EXTRACT(DAY FROM (date_trunc('month', v_current_next_due + interval '1 month') + interval '1 month - 1 day'))::integer)
    );
  END IF;

  -- Atualizar registro na base local
  UPDATE public.clinic_subscriptions
  SET 
    billing_due_window = _window,
    billing_due_window_updated_at = v_now,
    next_due_date = v_new_next_due,
    updated_at = v_now
  WHERE clinic_id = _clinic_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Janela de vencimento atualizada com sucesso para os próximos ciclos.',
    'billing_due_window', _window,
    'billing_due_window_updated_at', v_now,
    'target_due_day', v_target_day,
    'next_due_date', v_new_next_due,
    'next_allowed_at', v_now + interval '30 days'
  );
END;
$$;

ALTER FUNCTION public.update_clinic_billing_due_window(uuid, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.update_clinic_billing_due_window(uuid, text) TO authenticated, service_role;

-- 3. Atualizar get_clinic_subscription_summary com as novas colunas
DROP FUNCTION IF EXISTS public.get_clinic_subscription_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_clinic_subscription_summary(_clinic_id uuid) 
RETURNS TABLE(
  subscription_id uuid,
  clinic_id uuid,
  account_owner_user_id uuid,
  plan_type public.subscription_plan,
  status text,
  billing_cycle text,
  payment_method text,
  base_monthly_price numeric,
  total_recurring_monthly_price numeric,
  base_subaccount_limit integer,
  purchased_subaccount_extra_count integer,
  total_subaccount_limit integer,
  base_concurrent_access_count integer,
  additional_concurrent_access_count integer,
  total_concurrent_access_limit integer,
  next_due_date date,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  expires_at timestamp with time zone,
  period_duration_days integer,
  auto_renew boolean,
  days_remaining integer,
  is_expired boolean,
  asaas_customer_id text,
  asaas_subscription_id text,
  applied_coupon_id uuid,
  coupon_code text,
  discount_percentage numeric,
  discount_fixed_amount numeric,
  trial_ends_at timestamp with time zone,
  override_reason text,
  override_by_user_id uuid,
  override_at timestamp with time zone,
  cpf_cnpj text,
  billing_email text,
  billing_name text,
  billing_due_window text,
  billing_due_window_updated_at timestamp with time zone,
  can_change_billing_window boolean,
  next_allowed_billing_window_change timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.clinic_id = _clinic_id
        AND cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.membership_status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
        AND pa.is_active = true
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado: você não tem permissão para visualizar a assinatura desta clínica.';
  END IF;

  RETURN QUERY
  SELECT
    cs.id AS subscription_id,
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
    (CASE 
      WHEN cs.plan_type::text IN ('prof_basico', 'prof_medio', 'solo') THEN 1
      WHEN cs.plan_type::text = 'prof_top' THEN 2
      ELSE 999999
    END)::integer AS total_subaccount_limit,
    cs.base_concurrent_access_count,
    cs.additional_concurrent_access_count,
    (CASE 
      WHEN cs.plan_type::text IN ('prof_basico', 'prof_medio', 'solo') THEN 1 
      WHEN cs.plan_type::text = 'prof_top' THEN 2
      WHEN cs.plan_type::text = 'clinica_basico' THEN (2 + COALESCE(cs.additional_concurrent_access_count, 0))
      WHEN cs.plan_type::text IN ('clinica_top', 'enterprise') THEN (COALESCE(cs.base_concurrent_access_count, 8) + COALESCE(cs.additional_concurrent_access_count, 0))
      ELSE (COALESCE(cs.base_concurrent_access_count, 4) + COALESCE(cs.additional_concurrent_access_count, 0)) 
    END)::integer AS total_concurrent_access_limit,
    cs.next_due_date,
    cs.current_period_start,
    cs.current_period_end,
    COALESCE(cs.expires_at, cs.current_period_end, cs.current_period_start + interval '30 days') AS expires_at,
    COALESCE(cs.period_duration_days, 30) AS period_duration_days,
    COALESCE(cs.auto_renew, true) AS auto_renew,
    GREATEST(0, EXTRACT(DAY FROM (COALESCE(cs.expires_at, cs.current_period_end, cs.current_period_start + interval '30 days') - now()))::integer) AS days_remaining,
    (CASE WHEN COALESCE(cs.expires_at, cs.current_period_end) < now() AND cs.status NOT IN ('BETA', 'TRIAL', 'COURTESY') THEN true ELSE false END) AS is_expired,
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
    cs.billing_name,
    COALESCE(cs.billing_due_window, 'DAY_1_TO_5') AS billing_due_window,
    cs.billing_due_window_updated_at,
    (CASE 
      WHEN cs.billing_due_window_updated_at IS NULL THEN true
      WHEN EXTRACT(DAY FROM (clock_timestamp() - cs.billing_due_window_updated_at)) >= 30 THEN true
      ELSE false
    END) AS can_change_billing_window,
    (COALESCE(cs.billing_due_window_updated_at, clock_timestamp()) + interval '30 days') AS next_allowed_billing_window_change
  FROM public.clinic_subscriptions cs
  WHERE cs.clinic_id = _clinic_id
  LIMIT 1;
END;
$$;

ALTER FUNCTION public.get_clinic_subscription_summary(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_clinic_subscription_summary(uuid) TO authenticated, service_role;
