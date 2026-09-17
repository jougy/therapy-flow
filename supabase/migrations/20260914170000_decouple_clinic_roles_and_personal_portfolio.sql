-- Migration: 20260914170000_decouple_clinic_roles_and_personal_portfolio.sql
-- Description: Desacoplamento de cargos operacionais por clínica e RPC do Portfólio Pessoal de Atendimentos

-- ==============================================================================
-- 1. ADIÇÃO DE COLUNAS NA TABELA public.clinic_memberships
-- ==============================================================================
ALTER TABLE public.clinic_memberships
  ADD COLUMN IF NOT EXISTS job_title text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS specialty text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS working_hours jsonb DEFAULT NULL;

COMMENT ON COLUMN public.clinic_memberships.job_title IS 'Cargo operacional do colaborador nesta clínica específica.';
COMMENT ON COLUMN public.clinic_memberships.specialty IS 'Especialidade de atuação do colaborador nesta clínica específica.';
COMMENT ON COLUMN public.clinic_memberships.working_hours IS 'Horários de trabalho estruturados ou descritivos do colaborador nesta clínica.';

-- Índices úteis para filtragem e joins
CREATE INDEX IF NOT EXISTS idx_clinic_memberships_clinic_job_title
  ON public.clinic_memberships (clinic_id, job_title)
  WHERE job_title IS NOT NULL;

-- ==============================================================================
-- 2. POPULAÇÃO INICIAL IDEMPOTENTE DOS DADOS EXISTENTES DE PROFILES
-- ==============================================================================
UPDATE public.clinic_memberships cm
SET
  job_title = COALESCE(cm.job_title, NULLIF(trim(p.job_title), '')),
  specialty = COALESCE(cm.specialty, NULLIF(trim(p.specialty), ''))
FROM public.profiles p
WHERE cm.user_id = p.id
  AND (
    (cm.job_title IS NULL AND p.job_title IS NOT NULL AND trim(p.job_title) <> '')
    OR (cm.specialty IS NULL AND p.specialty IS NOT NULL AND trim(p.specialty) <> '')
  );

-- ==============================================================================
-- 3. ATUALIZAÇÃO DA RPC update_clinic_member_operational_fields
--    Persiste job_title, specialty, working_hours e operational_role na membership,
--    NÃO sobrescrevendo mais profiles.job_title globalmente.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.update_clinic_member_operational_fields(
  _membership_id uuid,
  _job_title text DEFAULT NULL,
  _specialty text DEFAULT NULL,
  _working_hours text DEFAULT NULL,
  _operational_role public.operational_role_type DEFAULT NULL,
  _membership_status public.membership_status_type DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _requester_id uuid := auth.uid();
  _target_membership public.clinic_memberships%ROWTYPE;
  _parsed_working_hours jsonb;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  SELECT *
  INTO _target_membership
  FROM public.clinic_memberships
  WHERE id = _membership_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador nao encontrado.';
  END IF;

  IF _target_membership.account_role = 'account_owner' THEN
    RAISE EXCEPTION 'A conta principal nao pode ser editada por este fluxo.';
  END IF;

  IF NOT (
    public.current_user_can('subaccounts.manage', _target_membership.clinic_id)
    OR public.current_user_can('subaccounts.write', _target_membership.clinic_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissao para editar colaboradores nesta clinica.';
  END IF;

  IF _operational_role IS NOT NULL AND NOT public.current_user_can('subaccounts_roles.manage', _target_membership.clinic_id) THEN
    RAISE EXCEPTION 'Sem permissao para alterar a hierarquia deste colaborador.';
  END IF;

  IF _operational_role = 'owner' THEN
    RAISE EXCEPTION 'O papel owner fica reservado para a conta principal.';
  END IF;

  IF _membership_status IS NOT NULL AND _membership_status = 'invited' THEN
    RAISE EXCEPTION 'Status convidado e controlado pelo fluxo de convites.';
  END IF;

  -- Parse _working_hours de forma segura se fornecido
  IF _working_hours IS NOT NULL THEN
    IF trim(_working_hours) = '' THEN
      _parsed_working_hours := NULL;
    ELSE
      BEGIN
        _parsed_working_hours := _working_hours::jsonb;
      EXCEPTION WHEN OTHERS THEN
        _parsed_working_hours := to_jsonb(trim(_working_hours));
      END;
    END IF;
  END IF;

  -- Atualiza exclusivamente clinic_memberships (desacoplando do profiles global)
  UPDATE public.clinic_memberships
  SET
    job_title = CASE WHEN _job_title IS NULL THEN job_title ELSE NULLIF(trim(_job_title), '') END,
    specialty = CASE WHEN _specialty IS NULL THEN specialty ELSE NULLIF(trim(_specialty), '') END,
    working_hours = CASE WHEN _working_hours IS NULL THEN working_hours ELSE _parsed_working_hours END,
    operational_role = COALESCE(_operational_role, operational_role),
    membership_status = COALESCE(_membership_status, membership_status),
    is_active = CASE
      WHEN COALESCE(_membership_status, membership_status) = 'active' THEN true
      ELSE false
    END,
    ended_at = CASE
      WHEN COALESCE(_membership_status, membership_status) = 'active' THEN NULL
      WHEN ended_at IS NULL THEN now()
      ELSE ended_at
    END
  WHERE id = _membership_id;

  -- Auditoria de alteração de papel operacional
  IF _operational_role IS NOT NULL AND _operational_role IS DISTINCT FROM _target_membership.operational_role THEN
    PERFORM public.log_security_event(
      _target_membership.clinic_id,
      _requester_id,
      _target_membership.user_id,
      'subaccount_role_changed',
      'admin',
      jsonb_build_object(
        'from', _target_membership.operational_role,
        'to', _operational_role
      )
    );
  END IF;

  -- Auditoria de alteração de status
  IF _membership_status IS NOT NULL AND _membership_status IS DISTINCT FROM _target_membership.membership_status THEN
    PERFORM public.log_security_event(
      _target_membership.clinic_id,
      _requester_id,
      _target_membership.user_id,
      'subaccount_status_changed',
      'admin',
      jsonb_build_object(
        'from', _target_membership.membership_status,
        'to', _membership_status
      )
    );
  END IF;

  RETURN jsonb_build_object('membership_id', _membership_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_clinic_member_operational_fields(
  uuid, text, text, text, public.operational_role_type, public.membership_status_type
) TO authenticated;

-- ==============================================================================
-- 4. FUNÇÃO DE ANONIMIZAÇÃO E SANITIZAÇÃO DE PII EM TEXTO LIVRE
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.sanitize_clinical_free_text(_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  _sanitized text := _text;
BEGIN
  IF _sanitized IS NULL OR trim(_sanitized) = '' THEN
    RETURN _sanitized;
  END IF;

  -- 1. Sanitizar e-mails primeiro para não conflitar com regex de pontuação/letras
  _sanitized := regexp_replace(
    _sanitized,
    '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
    '[EMAIL OCULTADO]',
    'g'
  );

  -- 2. Sanitizar CPFs (com pontuação ou sequência de 11 dígitos com separadores opcionais)
  _sanitized := regexp_replace(
    _sanitized,
    '\y\d{3}\.?\d{3}\.?\d{3}[-\s]?\d{2}\y',
    '[DOCUMENTO OCULTADO]',
    'g'
  );

  -- 3. Sanitizar telefones celulares e fixos com DDD ou +55 opcional
  _sanitized := regexp_replace(
    _sanitized,
    '(\+?55\s*)?(\(?\d{2}\)?\s*)?(9\s*)?\d{4}[-\s]?\d{4}',
    '[CONTATO OCULTADO]',
    'g'
  );

  RETURN _sanitized;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sanitize_clinical_free_text(text) TO authenticated;

-- ==============================================================================
-- 5. FUNÇÃO DE PSEUDONIMIZAÇÃO DE NOME DE PACIENTE
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.pseudonymize_patient_name(_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  _parts text[];
  _part text;
  _initials text := '';
BEGIN
  IF _name IS NULL OR trim(_name) = '' THEN
    RETURN 'Paciente Anônimo';
  END IF;

  _parts := regexp_split_to_array(trim(_name), '\s+');

  FOREACH _part IN ARRAY _parts LOOP
    IF lower(_part) NOT IN ('de', 'da', 'do', 'das', 'dos', 'e', 'd''') AND length(_part) > 0 THEN
      _initials := _initials || upper(substring(_part from 1 for 1)) || '. ';
    END IF;
  END LOOP;

  _initials := trim(_initials);

  IF _initials = '' THEN
    RETURN 'Paciente Anônimo';
  END IF;

  RETURN 'Paciente ' || _initials;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pseudonymize_patient_name(text) TO authenticated;

-- ==============================================================================
-- 6. NOVA RPC: get_personal_professional_sessions_portfolio
--    Retorna exclusivamente os atendimentos e evoluções do próprio profissional,
--    com PII sanitizado, dados de faturamento/cobrança omitidos e LGPD preservada.
-- ==============================================================================
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
  patient_pseudonym text,
  patient_demographics text,
  notes_sanitized text,
  treatment_sanitized text,
  pain_score integer,
  complexity_score integer,
  created_at timestamptz
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

  -- 3. Retorno dos atendimentos com pseudonimização estrita e sem dados financeiros/PII
  RETURN QUERY
  SELECT
    s.id AS session_id,
    s.session_date,
    s.status AS session_status,
    s.clinic_id,
    COALESCE(c.name, 'Atendimento Particular') AS clinic_name,
    c.route_key AS clinic_route_key,
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
    s.created_at
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
      OR public.pseudonymize_patient_name(p.name) ILIKE ('%' || _clean_query || '%')
      OR to_char(s.session_date, 'YYYY-MM-DD') ILIKE ('%' || _clean_query || '%')
    )
  ORDER BY s.session_date DESC, s.created_at DESC
  LIMIT _sanitized_limit
  OFFSET _sanitized_offset;
END;
$$;

-- 7. Concessão de permissões
GRANT EXECUTE ON FUNCTION public.get_personal_professional_sessions_portfolio(
  text, uuid, integer, integer
) TO authenticated;

-- Índices de suporte para aceleração de buscas no portfólio
CREATE INDEX IF NOT EXISTS idx_sessions_provider_id
  ON public.sessions (provider_id);

CREATE INDEX IF NOT EXISTS idx_sessions_provider_date
  ON public.sessions (provider_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_effective_provider_date
  ON public.sessions (COALESCE(provider_id, user_id), session_date DESC);
