-- Migration: 20260919105000_get_personal_portfolio_session_detail.sql
-- Description: RPC para detalhe de atendimento do Portfólio Clínico Pessoal (Acervo Técnico do Profissional)
-- Regras de Segurança:
-- 1. SECURITY DEFINER com search_path seguro
-- 2. Filtro estrito: COALESCE(s.provider_id, s.user_id) = auth.uid()
-- 3. Respeito ao Soft Delete: s.deleted_at IS NULL
-- 4. Omissão absoluta de dados financeiros e comerciais da clínica
-- 5. Sem risco de colisão PGRST203

DROP FUNCTION IF EXISTS public.get_personal_portfolio_session_detail(uuid);

CREATE OR REPLACE FUNCTION public.get_personal_portfolio_session_detail(
  _session_id uuid
)
RETURNS TABLE (
  session_id uuid,
  session_date timestamptz,
  session_status text,
  clinic_id uuid,
  clinic_name text,
  clinic_route_key text,
  clinic_logo_url text,
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
  anamnesis_base_schema jsonb,
  anamnesis_data jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _authenticated_user_id uuid := auth.uid();
BEGIN
  -- 1. Validação de autenticação obrigatória
  IF _authenticated_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF _session_id IS NULL THEN
    RAISE EXCEPTION 'ID de sessao obrigatorio.';
  END IF;

  -- 2. Retorno do atendimento único do profissional
  RETURN QUERY
  SELECT
    s.id AS session_id,
    s.session_date,
    s.status AS session_status,
    s.clinic_id,
    COALESCE(c.name, 'Atendimento Particular') AS clinic_name,
    c.route_key AS clinic_route_key,
    c.logo_url AS clinic_logo_url,
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
    COALESCE(c.anamnesis_base_schema, '[]'::jsonb) AS anamnesis_base_schema,
    COALESCE(s.anamnesis, '{}'::jsonb) AS anamnesis_data
  FROM public.sessions s
  LEFT JOIN public.clinics c ON c.id = s.clinic_id
  LEFT JOIN public.patients p ON p.id = s.patient_id
  WHERE s.id = _session_id
    AND COALESCE(s.provider_id, s.user_id) = _authenticated_user_id
    AND s.deleted_at IS NULL
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_personal_portfolio_session_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_personal_portfolio_session_detail(uuid) TO authenticated;
