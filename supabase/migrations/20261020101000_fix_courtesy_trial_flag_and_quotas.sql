-- Migration: 20261020101000_fix_courtesy_trial_flag_and_quotas.sql
-- Descrição:
-- 1. Garante que assinaturas com status COURTESY ou is_courtesy = true tenham is_free_trial = false.
-- 2. Atualiza a RPC check_clinic_plan_quota para nunca considerar plano COURTESY ou is_courtesy como trial.

-- 1. Sanitizar registros existentes no banco
UPDATE public.clinic_subscriptions
SET
  is_free_trial = false,
  updated_at = now()
WHERE
  (status = 'COURTESY' OR is_courtesy = true)
  AND is_free_trial = true;

-- 2. Atualizar check_clinic_plan_quota com guarda estrita para cortesia parceira
CREATE OR REPLACE FUNCTION public.check_clinic_plan_quota(
  p_clinic_id uuid,
  p_feature_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sub record;
  v_count integer := 0;
  v_allowed boolean := true;
  v_limit integer := 0;
  v_is_trial boolean := false;
  v_message text := '';
  v_plan_text text;
  v_is_courtesy boolean := false;
BEGIN
  -- Buscar assinatura da clínica
  SELECT * INTO v_sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = p_clinic_id
  LIMIT 1;

  -- Checar explicitamente se é cortesia parceira
  IF v_sub IS NOT NULL AND (v_sub.status = 'COURTESY' OR COALESCE(v_sub.is_courtesy, false) = true) THEN
    v_is_courtesy := true;
  END IF;

  -- Se não encontrou ou se for trial / beta (e NÃO for cortesia)
  IF NOT v_is_courtesy AND (v_sub IS NULL OR v_sub.status = 'TRIAL' OR COALESCE(v_sub.is_free_trial, false) = true OR v_sub.status = 'BETA') THEN
    v_is_trial := true;
  END IF;

  v_plan_text := LOWER(COALESCE(v_sub.plan_type::text, 'clinica_medio'));

  -- Checagem de Atendimentos (Sessões)
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
      -- Ilimitado em todos os planos pagos e cortesias
      v_limit := -1;
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
      -- Ilimitado em todos os planos pagos e cortesias
      v_limit := -1;
      v_allowed := true;
    END IF;

  -- Checagem de Modelos de Formulário Personalizados
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
    ELSIF v_plan_text = 'prof_basico' AND NOT v_is_courtesy THEN
      -- prof_basico regular tem cota de 1 formulário customizado complementar ativo
      v_limit := 1;
      IF v_count >= v_limit THEN
        v_allowed := false;
        v_message := 'O Plano Profissional Básico permite 1 modelo customizado ativo complementar ao formulário padrão universal. Faça upgrade para formulários ilimitados.';
      END IF;
    ELSE
      -- Todos os outros planos (e cortesia) têm formulários customizados ilimitados (-1)
      v_limit := -1;
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

GRANT EXECUTE ON FUNCTION public.check_clinic_plan_quota(uuid, text) TO authenticated, anon, service_role;
