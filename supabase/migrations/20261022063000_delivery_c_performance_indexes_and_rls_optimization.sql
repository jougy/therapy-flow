-- Migration: 20261022063000_delivery_c_performance_indexes_and_rls_optimization.sql
-- Description: Entrega C - Cobertura de Foreign Keys críticas, remoção de índice duplicado e otimização de subqueries RLS

-- ==============================================================================
-- 1. DEDUPLICAÇÃO DE ÍNDICES EM SESSIONS
-- ==============================================================================

-- Remover índice redundante idêntico apontado pelo Advisor
-- idx_sessions_active_lookup e idx_sessions_active_clinics possuem exatamente a mesma definição:
-- (clinic_id, session_date DESC) WHERE deleted_at IS NULL
DROP INDEX IF EXISTS public.idx_sessions_active_clinics;


-- ==============================================================================
-- 2. COBERTURA DE FOREIGN KEYS CRÍTICAS (ELIMINAR SEQ SCANS EM JOINS/CASCADES)
-- ==============================================================================

-- 2.1. Foreign Keys em Sessões e Faturamento
CREATE INDEX IF NOT EXISTS idx_clinical_session_billings_session_cover 
ON public.clinical_session_billings (session_id);

CREATE INDEX IF NOT EXISTS idx_sessions_patient_cover 
ON public.sessions (patient_id) 
WHERE deleted_at IS NULL;

-- 2.2. Foreign Keys em Arquivos de Pacientes e Sessões
-- patient_file_uploads já possui cobertura em (session_id) e (patient_id)
CREATE INDEX IF NOT EXISTS idx_patient_file_uploads_user_cover 
ON public.patient_file_uploads (uploaded_by_user_id) 
WHERE deleted_at IS NULL;

-- 2.3. Foreign Keys em Membros de Clínica e Convites
CREATE INDEX IF NOT EXISTS idx_clinic_memberships_user_cover 
ON public.clinic_memberships (user_id) 
WHERE is_active = true;

-- clinic_collaborator_invitations já possui idx_clinic_collaborator_invitations_clinic_id
CREATE INDEX IF NOT EXISTS idx_clinic_collaborator_invitations_invited_by_cover 
ON public.clinic_collaborator_invitations (invited_by) 
WHERE status = 'pending';

-- 2.4. Foreign Keys em Planos de Pagamento e Assinaturas
CREATE INDEX IF NOT EXISTS idx_patient_payment_plans_patient_cover 
ON public.patient_payment_plans (patient_id);

CREATE INDEX IF NOT EXISTS idx_subscription_invoices_subscription_cover 
ON public.subscription_invoices (subscription_id);

-- 2.5. Foreign Keys em Governança e Auditoria
CREATE INDEX IF NOT EXISTS idx_session_edit_history_session_cover 
ON public.session_edit_history (session_id, edited_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_cover 
ON public.user_roles (user_id);


-- ==============================================================================
-- 3. OTIMIZAÇÃO DE RLS COM SUBQUERIES DE EXECUÇÃO ÚNICA (POSTGRES 17 HOISTING)
-- ==============================================================================

-- No PostgreSQL 17, envelopar auth.uid() e funções STABLE em subqueries (SELECT auth.uid())
-- força a avaliação em tempo de planejamento/início (one-time execution),
-- evitando que a função seja invocada para cada linha avaliada no scan da tabela.

-- 3.1. Otimizar RLS de clinical_session_billings
DROP POLICY IF EXISTS "Users read clinic session billings" ON public.clinical_session_billings;
CREATE POLICY "Users read clinic session billings" ON public.clinical_session_billings
  FOR SELECT TO authenticated
  USING (
    clinic_id IN (
      SELECT cm.clinic_id 
      FROM public.clinic_memberships cm 
      WHERE cm.user_id = (SELECT auth.uid()) 
        AND cm.is_active = true
    )
  );

-- 3.2. Otimizar RLS de sessions (Leitura rápida)
DROP POLICY IF EXISTS "Users read clinic sessions" ON public.sessions;
CREATE POLICY "Users read clinic sessions" ON public.sessions
  FOR SELECT TO authenticated
  USING (
    clinic_id IN (
      SELECT cm.clinic_id 
      FROM public.clinic_memberships cm 
      WHERE cm.user_id = (SELECT auth.uid()) 
        AND cm.is_active = true
    )
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

-- 3.3. Otimizar RLS de patients (Leitura rápida)
DROP POLICY IF EXISTS "Users read clinic patients" ON public.patients;
CREATE POLICY "Users read clinic patients" ON public.patients
  FOR SELECT TO authenticated
  USING (
    clinic_id IN (
      SELECT cm.clinic_id 
      FROM public.clinic_memberships cm 
      WHERE cm.user_id = (SELECT auth.uid()) 
        AND cm.is_active = true
    )
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );
