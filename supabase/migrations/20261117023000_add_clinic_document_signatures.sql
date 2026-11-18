-- Migration: 20261117023000_add_clinic_document_signatures.sql
-- Descrição: Assinatura em .webp sem fundo em profiles + tabela clinic_document_signatures + RLS + RPCs públicas por token
-- Padrão: Expand and Contract (não-destrutivo)

-- 1. Adicionar coluna signature_webp_url em public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature_webp_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_signature_webp_url_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_signature_webp_url_check
      CHECK (
        signature_webp_url IS NULL
        OR (
          length(signature_webp_url) <= 700000
          AND (
            signature_webp_url ~* '^data:image/(webp|png);base64,[A-Za-z0-9+/=]+$'
            OR signature_webp_url ~* '^https://'
          )
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.signature_webp_url IS 'URL HTTPS ou data URL (.webp/.png, máx 700KB) da assinatura digital sem fundo do profissional/owner';

-- 2. Criar tabela public.clinic_document_signatures
CREATE TABLE IF NOT EXISTS public.clinic_document_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  session_id uuid REFERENCES public.sessions(id) ON DELETE RESTRICT,
  template_id uuid REFERENCES public.clinic_document_templates(id) ON DELETE SET NULL,
  template_title text NOT NULL,
  rendered_markdown text NOT NULL,
  sign_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  status text NOT NULL DEFAULT 'pending'
    CONSTRAINT clinic_document_signatures_status_check
    CHECK (status IN ('pending', 'signed_in_person', 'signed_remote', 'pending_physical')),
  signer_name text,
  signer_cpf text,
  signer_role text
    CONSTRAINT clinic_document_signatures_signer_role_check
    CHECK (signer_role IS NULL OR signer_role IN ('paciente', 'responsavel', 'colaborador', 'owner')),
  signature_image_url text,
  signature_metadata jsonb DEFAULT '{}'::jsonb,
  signed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

COMMENT ON TABLE public.clinic_document_signatures IS 'Registros de solicitação e assinatura digital/presencial de documentos gerados a partir de clinic_document_templates';
COMMENT ON COLUMN public.clinic_document_signatures.sign_token IS 'Token único e seguro para acesso público à página de assinatura remota (/assinar-documento/:token)';
COMMENT ON COLUMN public.clinic_document_signatures.status IS 'Estado da assinatura: pending, signed_in_person, signed_remote, pending_physical';
COMMENT ON COLUMN public.clinic_document_signatures.signer_role IS 'Papel de quem assinou: paciente, responsavel, colaborador, owner';
COMMENT ON COLUMN public.clinic_document_signatures.signature_metadata IS 'Metadados de auditoria da assinatura (IP, user-agent, data/hora, local, ID global usr_xxx, etc.)';
COMMENT ON COLUMN public.clinic_document_signatures.deleted_at IS 'Data de arquivamento/soft-delete (retenção legal conforme CFM 1.821 / LGPD)';

-- 3. Índices de performance e consulta
CREATE INDEX IF NOT EXISTS idx_clinic_document_signatures_clinic_patient
  ON public.clinic_document_signatures (clinic_id, patient_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clinic_document_signatures_clinic_session
  ON public.clinic_document_signatures (clinic_id, session_id)
  WHERE deleted_at IS NULL AND session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clinic_document_signatures_clinic_status
  ON public.clinic_document_signatures (clinic_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clinic_document_signatures_patient_created
  ON public.clinic_document_signatures (patient_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- 4. Trigger para manter updated_at atualizado automaticamente
DROP TRIGGER IF EXISTS trg_clinic_document_signatures_updated_at ON public.clinic_document_signatures;
CREATE TRIGGER trg_clinic_document_signatures_updated_at
  BEFORE UPDATE ON public.clinic_document_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Habilitar RLS e criar Políticas de Segurança
ALTER TABLE public.clinic_document_signatures ENABLE ROW LEVEL SECURITY;

-- 5.1. Super admins gerenciam tudo
DROP POLICY IF EXISTS "Super admins manage all clinic document signatures" ON public.clinic_document_signatures;
CREATE POLICY "Super admins manage all clinic document signatures"
  ON public.clinic_document_signatures
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 5.2. SELECT: Membros ativos da clínica com acesso a pacientes, sessões ou termos
DROP POLICY IF EXISTS "Users read clinic document signatures" ON public.clinic_document_signatures;
CREATE POLICY "Users read clinic document signatures"
  ON public.clinic_document_signatures
  FOR SELECT
  TO authenticated
  USING (
    (
      clinic_id = COALESCE(
        (NULLIF((auth.jwt() ->> 'active_clinic_id'), ''))::uuid,
        public.get_user_clinic_id(auth.uid())
      )
      OR public.user_has_active_clinic_membership(auth.uid(), clinic_id)
    )
    AND public.can_read_clinic_data(clinic_id)
    AND (
      public.current_user_can('patients.read', clinic_id)
      OR public.current_user_can('sessions.read', clinic_id)
      OR public.current_user_can('clinic_terms.manage', clinic_id)
    )
    AND (
      deleted_at IS NULL
      OR public.current_user_can('clinic_trash.manage', clinic_id)
      OR public.current_user_can('clinic_terms.manage', clinic_id)
    )
  );

-- 5.3. INSERT: Membros ativos da clínica com permissão de escrita em pacientes, sessões ou termos
DROP POLICY IF EXISTS "Users insert clinic document signatures" ON public.clinic_document_signatures;
CREATE POLICY "Users insert clinic document signatures"
  ON public.clinic_document_signatures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      clinic_id = COALESCE(
        (NULLIF((auth.jwt() ->> 'active_clinic_id'), ''))::uuid,
        public.get_user_clinic_id(auth.uid())
      )
      OR public.user_has_active_clinic_membership(auth.uid(), clinic_id)
    )
    AND NOT public.is_clinic_read_only(clinic_id)
    AND (
      public.current_user_can('patients.write', clinic_id)
      OR public.current_user_can('sessions.write', clinic_id)
      OR public.current_user_can('clinic_terms.manage', clinic_id)
    )
  );

-- 5.4. UPDATE: Membros ativos da clínica com permissão de escrita em pacientes, sessões ou termos
DROP POLICY IF EXISTS "Users update clinic document signatures" ON public.clinic_document_signatures;
CREATE POLICY "Users update clinic document signatures"
  ON public.clinic_document_signatures
  FOR UPDATE
  TO authenticated
  USING (
    (
      clinic_id = COALESCE(
        (NULLIF((auth.jwt() ->> 'active_clinic_id'), ''))::uuid,
        public.get_user_clinic_id(auth.uid())
      )
      OR public.user_has_active_clinic_membership(auth.uid(), clinic_id)
    )
    AND NOT public.is_clinic_read_only(clinic_id)
    AND (
      public.current_user_can('patients.write', clinic_id)
      OR public.current_user_can('sessions.write', clinic_id)
      OR public.current_user_can('clinic_terms.manage', clinic_id)
    )
  )
  WITH CHECK (
    (
      clinic_id = COALESCE(
        (NULLIF((auth.jwt() ->> 'active_clinic_id'), ''))::uuid,
        public.get_user_clinic_id(auth.uid())
      )
      OR public.user_has_active_clinic_membership(auth.uid(), clinic_id)
    )
    AND NOT public.is_clinic_read_only(clinic_id)
    AND (
      public.current_user_can('patients.write', clinic_id)
      OR public.current_user_can('sessions.write', clinic_id)
      OR public.current_user_can('clinic_terms.manage', clinic_id)
    )
  );

-- 5.5. DELETE: Hard delete restrito a gestão de lixeira / exclusão de pacientes (preferência operacional é soft-delete)
DROP POLICY IF EXISTS "Users delete clinic document signatures" ON public.clinic_document_signatures;
CREATE POLICY "Users delete clinic document signatures"
  ON public.clinic_document_signatures
  FOR DELETE
  TO authenticated
  USING (
    (
      clinic_id = COALESCE(
        (NULLIF((auth.jwt() ->> 'active_clinic_id'), ''))::uuid,
        public.get_user_clinic_id(auth.uid())
      )
      OR public.user_has_active_clinic_membership(auth.uid(), clinic_id)
    )
    AND NOT public.is_clinic_read_only(clinic_id)
    AND (
      public.current_user_can('clinic_trash.manage', clinic_id)
      OR public.current_user_can('patients.delete', clinic_id)
    )
  );

-- Permissões de tabela (anon acessa apenas via RPCs SECURITY DEFINER)
GRANT ALL ON TABLE public.clinic_document_signatures TO authenticated;
GRANT ALL ON TABLE public.clinic_document_signatures TO service_role;

-- 6. RPCs públicas SECURITY DEFINER sem overload (nomes únicos para evitar PGRST203)

-- 6.1. Leitura segura dos dados públicos do documento pelo token (/assinar-documento/:token)
CREATE OR REPLACE FUNCTION public.get_document_signature_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  _token_clean text := trim(coalesce(p_token, ''));
  _doc public.clinic_document_signatures%ROWTYPE;
  _clinic_name text;
  _clinic_logo_url text;
  _patient_name text;
BEGIN
  IF _token_clean = '' THEN
    RAISE EXCEPTION 'Token de assinatura inválido.';
  END IF;

  SELECT *
  INTO _doc
  FROM public.clinic_document_signatures
  WHERE sign_token = _token_clean
    AND deleted_at IS NULL
  LIMIT 1;

  IF _doc.id IS NULL THEN
    RAISE EXCEPTION 'Documento para assinatura não encontrado ou removido.';
  END IF;

  SELECT c.name, c.logo_url
  INTO _clinic_name, _clinic_logo_url
  FROM public.clinics c
  WHERE c.id = _doc.clinic_id;

  SELECT p.name
  INTO _patient_name
  FROM public.patients p
  WHERE p.id = _doc.patient_id
    AND p.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'id', _doc.id,
    'clinic_id', _doc.clinic_id,
    'clinic_name', COALESCE(NULLIF(trim(_clinic_name), ''), 'Clínica'),
    'clinic_logo_url', _clinic_logo_url,
    'patient_id', _doc.patient_id,
    'patient_name', _patient_name,
    'session_id', _doc.session_id,
    'template_id', _doc.template_id,
    'template_title', _doc.template_title,
    'rendered_markdown', _doc.rendered_markdown,
    'status', _doc.status,
    'signer_name', _doc.signer_name,
    'signer_cpf', CASE
      WHEN _doc.signer_cpf IS NOT NULL AND length(regexp_replace(_doc.signer_cpf, '\D', '', 'g')) = 11
        THEN '***.' || substr(regexp_replace(_doc.signer_cpf, '\D', '', 'g'), 4, 3) || '.' || substr(regexp_replace(_doc.signer_cpf, '\D', '', 'g'), 7, 3) || '-**'
      ELSE NULL
    END,
    'signer_role', _doc.signer_role,
    'signature_image_url', _doc.signature_image_url,
    'signature_metadata', _doc.signature_metadata,
    'council_registration', _doc.signature_metadata ->> 'council_registration',
    'global_user_id', _doc.signature_metadata ->> 'global_user_id',
    'signed_at', _doc.signed_at,
    'already_signed', (_doc.status IN ('signed_in_person', 'signed_remote')),
    'created_at', _doc.created_at
  );
END;
$$;

ALTER FUNCTION public.get_document_signature_by_token(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_document_signature_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_document_signature_by_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_document_signature_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_document_signature_by_token(text) TO authenticated;

-- 6.1b. Leitura pública mínima para verificação via QR Code (LGPD: sem rendered_markdown nem IDs internos, CPF mascarado)
CREATE OR REPLACE FUNCTION public.get_public_signature_verification(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  _token_clean text := trim(coalesce(p_token, ''));
  _doc public.clinic_document_signatures%ROWTYPE;
  _clinic_name text;
  _clinic_logo_url text;
  _cpf_digits text;
BEGIN
  IF _token_clean = '' THEN
    RAISE EXCEPTION 'Token de verificação inválido.';
  END IF;

  SELECT *
  INTO _doc
  FROM public.clinic_document_signatures
  WHERE sign_token = _token_clean
    AND deleted_at IS NULL
  LIMIT 1;

  IF _doc.id IS NULL THEN
    RAISE EXCEPTION 'Registro de assinatura não encontrado ou removido.';
  END IF;

  SELECT c.name, c.logo_url
  INTO _clinic_name, _clinic_logo_url
  FROM public.clinics c
  WHERE c.id = _doc.clinic_id;

  _cpf_digits := regexp_replace(coalesce(_doc.signer_cpf, ''), '\D', '', 'g');

  RETURN jsonb_build_object(
    'id', _doc.id,
    'clinic_name', COALESCE(NULLIF(trim(_clinic_name), ''), 'Clínica'),
    'clinic_logo_url', _clinic_logo_url,
    'template_title', _doc.template_title,
    'status', _doc.status,
    'signer_name', _doc.signer_name,
    'signer_cpf', CASE
      WHEN length(_cpf_digits) = 11
        THEN '***.' || substr(_cpf_digits, 4, 3) || '.' || substr(_cpf_digits, 7, 3) || '-**'
      ELSE NULL
    END,
    'signer_role', _doc.signer_role,
    'signature_image_url', _doc.signature_image_url,
    'signature_metadata', COALESCE(_doc.signature_metadata, '{}'::jsonb) - 'user_agent',
    'council_registration', _doc.signature_metadata ->> 'council_registration',
    'global_user_id', _doc.signature_metadata ->> 'global_user_id',
    'signed_at', _doc.signed_at,
    'already_signed', (_doc.status IN ('signed_in_person', 'signed_remote')),
    'created_at', _doc.created_at
  );
END;
$$;

ALTER FUNCTION public.get_public_signature_verification(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_public_signature_verification(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_signature_verification(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_signature_verification(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_signature_verification(text) TO authenticated;

-- Imutabilidade de campos probatórios após assinatura concluída
CREATE OR REPLACE FUNCTION public.prevent_signed_document_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IN ('signed_in_person', 'signed_remote') THEN
    IF NEW.rendered_markdown IS DISTINCT FROM OLD.rendered_markdown
       OR NEW.signature_image_url IS DISTINCT FROM OLD.signature_image_url
       OR NEW.signer_cpf IS DISTINCT FROM OLD.signer_cpf
       OR NEW.signer_name IS DISTINCT FROM OLD.signer_name
       OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
       OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Campos probatórios de documento já assinado são imutáveis.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_signed_document_mutation ON public.clinic_document_signatures;
CREATE TRIGGER trg_prevent_signed_document_mutation
  BEFORE UPDATE ON public.clinic_document_signatures
  FOR EACH ROW EXECUTE FUNCTION public.prevent_signed_document_mutation();

-- 6.2. Submissão remota da assinatura via token
CREATE OR REPLACE FUNCTION public.submit_document_signature_by_token(
  p_token text,
  p_signer_name text,
  p_signer_cpf text,
  p_signature_image_url text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  _token_clean text := trim(coalesce(p_token, ''));
  _signer_name text := left(trim(coalesce(p_signer_name, '')), 200);
  _signer_cpf text := nullif(regexp_replace(coalesce(p_signer_cpf, ''), '\D', '', 'g'), '');
  _signature_url text := nullif(trim(coalesce(p_signature_image_url, '')), '');
  _metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  _safe_metadata jsonb;
  _doc public.clinic_document_signatures%ROWTYPE;
  _updated public.clinic_document_signatures%ROWTYPE;
  _merged_metadata jsonb;
BEGIN
  IF _token_clean = '' THEN
    RAISE EXCEPTION 'Token de assinatura inválido.';
  END IF;

  IF length(_signer_name) < 2 THEN
    RAISE EXCEPTION 'Informe o nome completo do assinante.';
  END IF;

  IF _signer_cpf IS NOT NULL AND (length(_signer_cpf) <> 11 OR _signer_cpf ~ '^(\d)\1{10}$') THEN
    RAISE EXCEPTION 'CPF inválido. Informe os 11 dígitos válidos.';
  END IF;

  IF _signature_url IS NULL
     OR length(_signature_url) > 700000
     OR _signature_url !~* '^data:image/(webp|png);base64,[A-Za-z0-9+/=]+$' THEN
    RAISE EXCEPTION 'A assinatura visual deve ser uma imagem PNG/WEBP válida (máx 700KB).';
  END IF;

  SELECT *
  INTO _doc
  FROM public.clinic_document_signatures
  WHERE sign_token = _token_clean
    AND deleted_at IS NULL
  FOR UPDATE;

  IF _doc.id IS NULL THEN
    RAISE EXCEPTION 'Documento para assinatura não encontrado ou removido.';
  END IF;

  IF _doc.status IN ('signed_in_person', 'signed_remote') THEN
    RAISE EXCEPTION 'Este documento já foi assinado anteriormente.';
  END IF;

  -- Allowlist estrita de metadados aceitos do cliente anônimo
  _safe_metadata := jsonb_strip_nulls(jsonb_build_object(
    'signed_at_iso', left(_metadata ->> 'signed_at_iso', 64),
    'viewport', left(_metadata ->> 'viewport', 32),
    'device_type', left(_metadata ->> 'device_type', 32),
    'user_agent', left(_metadata ->> 'user_agent', 300)
  ));

  _merged_metadata := COALESCE(_doc.signature_metadata, '{}'::jsonb)
    || _safe_metadata
    || jsonb_build_object(
      'server_signed_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'signed_method', 'remote_link'
    );

  UPDATE public.clinic_document_signatures
  SET
    status = 'signed_remote',
    signer_name = _signer_name,
    signer_cpf = COALESCE(_signer_cpf, signer_cpf),
    signer_role = COALESCE(
      signer_role,
      CASE
        WHEN (_metadata ->> 'signer_role') IN ('paciente', 'responsavel')
          THEN (_metadata ->> 'signer_role')
        ELSE 'paciente'
      END
    ),
    signature_image_url = _signature_url,
    signature_metadata = _merged_metadata,
    signed_at = now(),
    updated_at = now()
  WHERE id = _doc.id
  RETURNING * INTO _updated;

  RETURN jsonb_build_object(
    'success', true,
    'id', _updated.id,
    'status', _updated.status,
    'signer_name', _updated.signer_name,
    'signed_at', _updated.signed_at,
    'template_title', _updated.template_title
  );
END;
$$;

ALTER FUNCTION public.submit_document_signature_by_token(text, text, text, text, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.submit_document_signature_by_token(text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_document_signature_by_token(text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_document_signature_by_token(text, text, text, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_document_signature_by_token(text, text, text, text, jsonb) TO authenticated;
