-- Migration: 20261116184500_add_clinic_document_templates.sql
-- Descrição: Tabela clinic_document_templates para modelos de documentos/termos personalizados por clínica
-- Padrão: Expand and Contract (não-destrutivo)

-- 1. Criar tabela public.clinic_document_templates
CREATE TABLE IF NOT EXISTS public.clinic_document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'custom',
  content_md text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Comentários de documentação e conformidade clínica
COMMENT ON TABLE public.clinic_document_templates IS 'Modelos de documentos e termos customizáveis por clínica com suporte a variáveis dinâmicas e versionamento suave';
COMMENT ON COLUMN public.clinic_document_templates.category IS 'Categoria do modelo (ex: adult_consent, minor_consent, print_responsibility, custom)';
COMMENT ON COLUMN public.clinic_document_templates.content_md IS 'Conteúdo do template formatado em Markdown';
COMMENT ON COLUMN public.clinic_document_templates.variables IS 'Lista de chaves de variáveis detectadas no template (ex: ["nome_paciente", "email_colaborador"])';
COMMENT ON COLUMN public.clinic_document_templates.deleted_at IS 'Data de arquivamento/soft-delete (retenção legal conforme CFM 1.821 / LGPD)';

-- 2. Índices de performance e consulta
CREATE INDEX IF NOT EXISTS idx_clinic_document_templates_clinic_id 
  ON public.clinic_document_templates (clinic_id);

CREATE INDEX IF NOT EXISTS idx_clinic_document_templates_clinic_deleted 
  ON public.clinic_document_templates (clinic_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_clinic_document_templates_category 
  ON public.clinic_document_templates (clinic_id, category) 
  WHERE deleted_at IS NULL;

-- 3. Trigger para manter updated_at atualizado automaticamente
DROP TRIGGER IF EXISTS trg_clinic_document_templates_updated_at ON public.clinic_document_templates;
CREATE TRIGGER trg_clinic_document_templates_updated_at
  BEFORE UPDATE ON public.clinic_document_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Habilitar RLS e criar Políticas de Segurança
ALTER TABLE public.clinic_document_templates ENABLE ROW LEVEL SECURITY;

-- 4.1. SELECT: Membros ativos da clínica podem visualizar modelos não deletados (ou gestores podem ver todos incluindo lixeira)
DROP POLICY IF EXISTS "Users read clinic document templates" ON public.clinic_document_templates;
CREATE POLICY "Users read clinic document templates"
  ON public.clinic_document_templates
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
      deleted_at IS NULL
      OR public.current_user_can('clinic_terms.manage', clinic_id)
      OR public.current_user_can('clinic_trash.manage', clinic_id)
      OR public.current_user_can('clinic_profile.manage', clinic_id)
    )
  );

-- 4.2. INSERT: Usuários com permissão de gestão de termos ou perfil da clínica
DROP POLICY IF EXISTS "Users insert clinic document templates" ON public.clinic_document_templates;
CREATE POLICY "Users insert clinic document templates"
  ON public.clinic_document_templates
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
      public.current_user_can('clinic_terms.manage', clinic_id)
      OR public.current_user_can('clinic_profile.manage', clinic_id)
    )
  );

-- 4.3. UPDATE: Usuários com permissão de gestão de termos ou perfil da clínica (edição e soft-delete)
DROP POLICY IF EXISTS "Users update clinic document templates" ON public.clinic_document_templates;
CREATE POLICY "Users update clinic document templates"
  ON public.clinic_document_templates
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
      public.current_user_can('clinic_terms.manage', clinic_id)
      OR public.current_user_can('clinic_profile.manage', clinic_id)
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
      public.current_user_can('clinic_terms.manage', clinic_id)
      OR public.current_user_can('clinic_profile.manage', clinic_id)
    )
  );

-- 4.4. DELETE: Hard delete restrito a gestores da clínica (preferência operacional é soft-delete)
DROP POLICY IF EXISTS "Users delete clinic document templates" ON public.clinic_document_templates;
CREATE POLICY "Users delete clinic document templates"
  ON public.clinic_document_templates
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
      public.current_user_can('clinic_terms.manage', clinic_id)
      OR public.current_user_can('clinic_profile.manage', clinic_id)
    )
  );

-- 5. Permissões de tabela para roles autenticadas e service_role
GRANT ALL ON TABLE public.clinic_document_templates TO authenticated;
GRANT ALL ON TABLE public.clinic_document_templates TO service_role;
