-- Migration: 20261001031500_portfolio_lgpd_isolation_and_hibernation.sql
-- Description:
-- 1. Isolamento LGPD e Guarda Legal no Portfólio Clínico Pessoal (CFM 1.821 / 20 anos):
--    - Clínicas de terceiros (membro/colaborador): sessões detalhadas nominais só são retornadas se o vínculo estiver ativo (clinic_memberships.status = 'active').
--    - Própria clínica do titular (account_owner): sessões históricas continuam sendo retornadas em modo leitura mesmo se is_hibernated = true.
--    - Atendimentos particulares (clinic_id IS NULL): retornados normalmente ao profissional criador.
--    - Respeito irrestrito a deleted_at IS NULL (Soft Delete).
-- 2. Estrutura de Hibernação e Otimização de BD:
--    - Adição de colunas em public.clinics: is_hibernated, hibernated_at, last_accessed_at.
--    - Regra sagrada de segurança: Clínicas com assinatura ativa (status = 'ACTIVE' ou access_status = 'active') NUNCA podem ser marcadas como hibernadas.
--    - Índices parciais de rotina otimizados:
--      idx_clinics_active_not_hibernated ON public.clinics(id) WHERE is_hibernated = false;
--      idx_sessions_active_clinics ON public.sessions(clinic_id, session_date DESC) WHERE deleted_at IS NULL;

-- ==============================================================================
-- 1. COLUNAS DE HIBERNAÇÃO NA TABELA public.clinics
-- ==============================================================================

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS is_hibernated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hibernated_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz DEFAULT now();

COMMENT ON COLUMN public.clinics.is_hibernated IS 'Indica se a clínica está em estado de hibernação por inatividade de pagamento/acesso.';
COMMENT ON COLUMN public.clinics.hibernated_at IS 'Data e hora em que a clínica entrou em estado de hibernação.';
COMMENT ON COLUMN public.clinics.last_accessed_at IS 'Último acesso ou atividade operacional registrada na clínica.';

-- ==============================================================================
-- 2. REGRA SAGRADA DE SEGURANÇA: CLÍNICAS ATIVAS NÃO PODEM SER HIBERNADAS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.check_clinic_hibernation_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_active_subscription boolean := false;
BEGIN
  IF NEW.is_hibernated = true THEN
    -- Regra sagrada: Clínicas com assinatura ativa (ou access_status ativo com plano ativo) não podem ser hibernadas
    IF LOWER(COALESCE(NEW.access_status, '')) = 'active' THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.clinic_subscriptions cs
        WHERE cs.clinic_id = NEW.id
          AND cs.status = 'ACTIVE'
      ) INTO v_has_active_subscription;

      IF v_has_active_subscription THEN
        RAISE EXCEPTION 'Regra sagrada: Clínicas com subscription ativa (subscription_status = ACTIVE / access_status = active) NUNCA podem ser marcadas como hibernadas.';
      END IF;
    END IF;

    -- Preencher hibernated_at se ainda não preenchido
    IF NEW.hibernated_at IS NULL THEN
      NEW.hibernated_at := now();
    END IF;
  ELSE
    -- Ao deshibernar, limpa a data de hibernação
    NEW.hibernated_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_clinic_hibernation_eligibility ON public.clinics;
CREATE TRIGGER trg_check_clinic_hibernation_eligibility
  BEFORE INSERT OR UPDATE OF is_hibernated, access_status
  ON public.clinics
  FOR EACH ROW
  EXECUTE FUNCTION public.check_clinic_hibernation_eligibility();

-- ==============================================================================
-- 3. ÍNDICES PARCIAIS OTIMIZADOS
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_clinics_active_not_hibernated
  ON public.clinics(id)
  WHERE is_hibernated = false;

CREATE INDEX IF NOT EXISTS idx_sessions_active_clinics
  ON public.sessions(clinic_id, session_date DESC)
  WHERE deleted_at IS NULL;

-- ==============================================================================
-- 4. ATUALIZAÇÃO DA RPC public.get_personal_professional_sessions_portfolio
-- ==============================================================================

DROP FUNCTION IF EXISTS public.get_personal_professional_sessions_portfolio(text, uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_personal_professional_sessions_portfolio(
  _query text DEFAULT NULL,
  _clinic_id uuid DEFAULT NULL,
  _limit integer DEFAULT 100,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  session_id uuid,
  session_date timestamptz,
  session_status text,
  clinic_id uuid,
  clinic_name text,
  clinic_route_key text,
  patient_id uuid,
  patient_ref text,
  patient_name text,
  patient_pseudonym text,
  patient_demographics text,
  notes_sanitized text,
  treatment_sanitized text,
  pain_score integer,
  complexity_score integer,
  created_at timestamptz,
  anamnesis_form_response jsonb,
  care_lines jsonb,
  anamnesis_base_schema jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _authenticated_user_id uuid := auth.uid();
  _clean_query text;
  _sanitized_limit integer;
  _sanitized_offset integer;
BEGIN
  -- 1. Validação de autenticação obrigatória
  IF _authenticated_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  -- 2. Saneamento de paginação e busca
  _sanitized_limit := LEAST(GREATEST(COALESCE(_limit, 100), 1), 200);
  _sanitized_offset := GREATEST(COALESCE(_offset, 0), 0);
  _clean_query := NULLIF(trim(_query), '');

  -- 3. Retorno dos atendimentos com isolamento LGPD e guarda legal:
  --    a) Clínicas de terceiros (membro/colaborador): sessões detalhadas nominais só são
  --       retornadas se o vínculo estiver ativo (status = 'active').
  --    b) Própria clínica do usuário (account_owner): sessões históricas continuam sendo
  --       retornadas em modo leitura mesmo se is_hibernated = true (CFM 1.821 / 20 anos).
  --    c) Atendimentos particulares (s.clinic_id IS NULL): retornados diretamente.
  --    d) Soft Delete estrito: s.deleted_at IS NULL.
  RETURN QUERY
  SELECT
    s.id AS session_id,
    s.session_date,
    s.status AS session_status,
    s.clinic_id,
    COALESCE(c.name, 'Atendimento Particular') AS clinic_name,
    c.route_key AS clinic_route_key,
    p.id AS patient_id,
    COALESCE(p.patient_code, p.id::text) AS patient_ref,
    COALESCE(p.name, 'Paciente') AS patient_name,
    public.pseudonymize_patient_name(p.name) AS patient_pseudonym,
    NULLIF(
      TRIM(
        CONCAT_WS(
          ' • ',
          CASE
            WHEN p.date_of_birth IS NOT NULL THEN
              (EXTRACT(YEAR FROM age(COALESCE(s.session_date, now())::date, p.date_of_birth))::integer || ' anos')
            WHEN p.age IS NOT NULL THEN
              (p.age || ' anos')
            ELSE NULL
          END,
          CASE
            WHEN p.gender IS NOT NULL AND trim(p.gender) <> '' THEN
              initcap(trim(p.gender))
            ELSE NULL
          END
        )
      ),
      ''
    ) AS patient_demographics,
    public.sanitize_clinical_free_text(s.notes) AS notes_sanitized,
    CASE
      WHEN s.treatment IS NULL THEN NULL
      WHEN jsonb_typeof(s.treatment) = 'null' THEN NULL
      WHEN jsonb_typeof(s.treatment) = 'string' THEN public.sanitize_clinical_free_text(s.treatment #>> '{}')
      ELSE public.sanitize_clinical_free_text(s.treatment::text)
    END AS treatment_sanitized,
    s.pain_score,
    s.complexity_score,
    s.created_at,
    COALESCE(s.anamnesis_form_response, '{}'::jsonb) AS anamnesis_form_response,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pg.id,
            'name', pg.name,
            'color', pg.color
          )
          ORDER BY pg.name ASC
        )
        FROM (
          SELECT DISTINCT id_val::uuid AS group_uuid
          FROM (
            SELECT jsonb_array_elements_text(
              CASE 
                WHEN jsonb_typeof(s.anamnesis->'care_line_ids') = 'array' THEN s.anamnesis->'care_line_ids'
                ELSE '[]'::jsonb
              END
            ) AS id_val
            UNION ALL
            SELECT s.group_id::text WHERE s.group_id IS NOT NULL
          ) u
          WHERE id_val ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        ) extracted_ids
        JOIN public.patient_groups pg ON pg.id = extracted_ids.group_uuid
      ),
      '[]'::jsonb
    ) AS care_lines,
    COALESCE(c.anamnesis_base_schema, '[]'::jsonb) AS anamnesis_base_schema
  FROM public.sessions s
  LEFT JOIN public.clinics c ON c.id = s.clinic_id
  LEFT JOIN public.patients p ON p.id = s.patient_id
  WHERE COALESCE(s.provider_id, s.user_id) = _authenticated_user_id
    AND s.deleted_at IS NULL
    AND (_clinic_id IS NULL OR s.clinic_id = _clinic_id)
    AND (
      -- Atendimento particular (sem clínica associada)
      s.clinic_id IS NULL
      -- Ou o profissional é o titular/proprietário da clínica (acesso ao acervo histórico preservado mesmo se hibernada)
      OR c.account_owner_user_id = _authenticated_user_id
      OR EXISTS (
        SELECT 1 FROM public.clinic_memberships cm_owner
        WHERE cm_owner.clinic_id = s.clinic_id
          AND cm_owner.user_id = _authenticated_user_id
          AND cm_owner.account_role = 'account_owner'
      )
      -- Ou se for clínica de terceiros, o vínculo com a clínica precisa estar ATIVO
      OR EXISTS (
        SELECT 1 FROM public.clinic_memberships cm_active
        WHERE cm_active.clinic_id = s.clinic_id
          AND cm_active.user_id = _authenticated_user_id
          AND cm_active.is_active = true
          AND (cm_active.membership_status = 'active' OR cm_active.status = 'active')
      )
    )
    AND (
      _clean_query IS NULL
      OR s.notes ILIKE ('%' || _clean_query || '%')
      OR s.treatment::text ILIKE ('%' || _clean_query || '%')
      OR s.status ILIKE ('%' || _clean_query || '%')
      OR COALESCE(c.name, '') ILIKE ('%' || _clean_query || '%')
      OR COALESCE(p.name, '') ILIKE ('%' || _clean_query || '%')
      OR public.pseudonymize_patient_name(p.name) ILIKE ('%' || _clean_query || '%')
      OR to_char(s.session_date, 'YYYY-MM-DD') ILIKE ('%' || _clean_query || '%')
    )
  ORDER BY s.session_date DESC, s.created_at DESC
  LIMIT _sanitized_limit
  OFFSET _sanitized_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_personal_professional_sessions_portfolio(text, uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_personal_professional_sessions_portfolio(text, uuid, integer, integer) TO authenticated;
