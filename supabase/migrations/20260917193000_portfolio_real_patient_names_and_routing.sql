-- Migration: 20260917193000_portfolio_real_patient_names_and_routing.sql
-- Description: Enriquecimento da RPC de Portfólio Pessoal com patient_id, patient_ref, patient_name e clinic_route_key

-- 1. Dropar a função anterior para evitar conflitos de tipo no RETURNS TABLE e evitar PGRST203
DROP FUNCTION IF EXISTS public.get_personal_professional_sessions_portfolio(text, uuid, integer, integer);

-- 2. Recriar a função get_personal_professional_sessions_portfolio com as novas colunas
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

  -- 3. Retorno dos atendimentos com identificação direta para prontuário e histórico
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
    AND (_clinic_id IS NULL OR s.clinic_id = _clinic_id)
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

-- 3. Concessão de permissões
REVOKE ALL ON FUNCTION public.get_personal_professional_sessions_portfolio(text, uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_personal_professional_sessions_portfolio(text, uuid, integer, integer) TO authenticated;
