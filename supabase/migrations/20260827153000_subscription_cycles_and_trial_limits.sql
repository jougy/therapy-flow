-- Migration: 20260827150000_subscription_cycles_and_trial_limits.sql
-- Descricao: Adiciona colunas para ciclos de cobranca (MONTHLY, QUARTERLY, ANNUAL), controle de Teste Gratis Volumetrico (20 atendimentos, 5 pacientes, 1 formulario) e funcao RPC de checagem de cotas.

-- 1. Atualizar clinic_subscriptions com colunas de ciclos e limites de teste gratis
ALTER TABLE public.clinic_subscriptions
  ADD COLUMN IF NOT EXISTS is_free_trial boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_max_attendances integer DEFAULT 20,
  ADD COLUMN IF NOT EXISTS trial_max_patients integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS trial_max_custom_forms integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS installment_count integer DEFAULT 1;

-- 2. Funcao RPC para checar cotas da clinica de forma centralizada
CREATE OR REPLACE FUNCTION public.check_clinic_plan_quota(
  p_clinic_id uuid,
  p_feature_type text -- 'attendances', 'patients', 'custom_forms', 'concurrent_access'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_count integer := 0;
  v_allowed boolean := true;
  v_limit integer := 0;
  v_is_trial boolean := false;
  v_message text := '';
BEGIN
  -- Buscar assinatura da clinica
  SELECT * INTO v_sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = p_clinic_id
  LIMIT 1;

  -- Se nao encontrou ou se for trial
  IF v_sub IS NULL OR v_sub.status = 'TRIAL' OR v_sub.is_free_trial = true OR v_sub.status = 'BETA' THEN
    v_is_trial := true;
  END IF;

  -- Checagem de Atendimentos
  IF p_feature_type = 'attendances' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.sessions
    WHERE clinic_id = p_clinic_id
      AND status NOT IN ('cancelado', 'rascunho');

    IF v_is_trial THEN
      v_limit := COALESCE(v_sub.trial_max_attendances, 20);
      IF v_count >= v_limit THEN
        v_allowed := false;
        v_message := 'Você atingiu o limite de ' || v_limit || ' atendimentos do seu período de teste grátis. Faça o upgrade para continuar evoluindo seus pacientes.';
      END IF;
    ELSE
      v_limit := -1; -- Ilimitado
      v_allowed := true;
    END IF;

  -- Checagem de Pacientes
  ELSIF p_feature_type = 'patients' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.patients
    WHERE clinic_id = p_clinic_id
      AND is_active = true;

    IF v_is_trial THEN
      v_limit := COALESCE(v_sub.trial_max_patients, 5);
      IF v_count >= v_limit THEN
        v_allowed := false;
        v_message := 'Você atingiu o limite de ' || v_limit || ' pacientes do seu período de teste grátis. Faça o upgrade para cadastrar novos pacientes.';
      END IF;
    ELSE
      v_limit := -1; -- Ilimitado
      v_allowed := true;
    END IF;

  -- Checagem de Modelos de Formulario Personalizados
  ELSIF p_feature_type = 'custom_forms' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.anamnesis_form_templates
    WHERE clinic_id = p_clinic_id
      AND is_system_default = false
      AND is_active = true;

    IF v_is_trial THEN
      v_limit := COALESCE(v_sub.trial_max_custom_forms, 1);
      IF v_count >= v_limit THEN
        v_allowed := false;
        v_message := 'O plano de teste grátis permite 1 modelo de formulário personalizado ativo. Faça o upgrade para criar modelos ilimitados.';
      END IF;
    ELSE
      v_limit := -1; -- Ilimitado
      v_allowed := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'current_count', v_count,
    'max_limit', v_limit,
    'is_free_trial', v_is_trial,
    'message', v_message
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_clinic_plan_quota(uuid, text) TO authenticated, anon;
