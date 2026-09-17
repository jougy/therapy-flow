-- Migration: 20260916223000_harden_clinical_compliance_and_audit.sql
-- Description: Fase 1 do Plano Diretor de Banco de Dados:
--   1. Substitui ON DELETE CASCADE por ON DELETE RESTRICT em sessões clínicas para compliance legal CFM/LGPD.
--   2. Adiciona colunas de Soft Delete (deleted_at, deleted_by_user_id) em public.patients e public.sessions.
--   3. Atualiza políticas RLS para ocultar registros com soft-delete de consultas normais.
--   4. Reformula public.session_edit_history para auditoria clínica estruturada (diff JSONB, reason, IP).
--   5. Atualiza o trigger log_session_edit_history_on_update para disparar apenas em alterações clínicas, ignorando financeiro e prevenindo falhas de clinic_id nulo.

-- ==============================================================================
-- 1. SOFT DELETE COLUMNS
-- ==============================================================================

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patients_active_lookup
  ON public.patients(clinic_id, updated_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_active_lookup
  ON public.sessions(clinic_id, session_date DESC)
  WHERE deleted_at IS NULL;

-- ==============================================================================
-- 2. HARDEN FOREIGN KEYS (CFM Nº 1.821/2007: GUARDA OBRIGATÓRIA DE 20 ANOS)
-- ==============================================================================

-- Remover CASCADE de sessions -> patients e sessions -> users
ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_patient_id_fkey;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE RESTRICT;

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- ==============================================================================
-- 3. EXPAND & HARDEN session_edit_history (AUDITORIA ESTRUTURADA DE PRONTUÁRIO)
-- ==============================================================================

ALTER TABLE public.session_edit_history
  ALTER COLUMN clinic_id DROP NOT NULL;

ALTER TABLE public.session_edit_history
  ADD COLUMN IF NOT EXISTS old_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS new_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS changed_fields text[] DEFAULT '{}'::text[] NOT NULL,
  ADD COLUMN IF NOT EXISTS change_reason text,
  ADD COLUMN IF NOT EXISTS ip_address text;

COMMENT ON TABLE public.session_edit_history IS 'Registro forense e imutável de alterações em prontuários clínicos (CFM/CFP/LGPD).';

CREATE OR REPLACE FUNCTION public.log_session_edit_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _changed text[] := ARRAY[]::text[];
  _old_snap jsonb := '{}'::jsonb;
  _new_snap jsonb := '{}'::jsonb;
BEGIN
  -- Apenas disparar para usuários autenticados
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Detectar modificações exclusivamente clínicas/de prontuário
  IF OLD.notes IS DISTINCT FROM NEW.notes THEN
    _changed := array_append(_changed, 'notes');
    _old_snap := _old_snap || jsonb_build_object('notes', OLD.notes);
    _new_snap := _new_snap || jsonb_build_object('notes', NEW.notes);
  END IF;

  IF OLD.anamnesis IS DISTINCT FROM NEW.anamnesis THEN
    _changed := array_append(_changed, 'anamnesis');
    _old_snap := _old_snap || jsonb_build_object('anamnesis', OLD.anamnesis);
    _new_snap := _new_snap || jsonb_build_object('anamnesis', NEW.anamnesis);
  END IF;

  IF OLD.treatment IS DISTINCT FROM NEW.treatment THEN
    _changed := array_append(_changed, 'treatment');
    _old_snap := _old_snap || jsonb_build_object('treatment', OLD.treatment);
    _new_snap := _new_snap || jsonb_build_object('treatment', NEW.treatment);
  END IF;

  IF OLD.anamnesis_form_response IS DISTINCT FROM NEW.anamnesis_form_response THEN
    _changed := array_append(_changed, 'anamnesis_form_response');
    _old_snap := _old_snap || jsonb_build_object('anamnesis_form_response', OLD.anamnesis_form_response);
    _new_snap := _new_snap || jsonb_build_object('anamnesis_form_response', NEW.anamnesis_form_response);
  END IF;

  IF OLD.pain_score IS DISTINCT FROM NEW.pain_score THEN
    _changed := array_append(_changed, 'pain_score');
    _old_snap := _old_snap || jsonb_build_object('pain_score', OLD.pain_score);
    _new_snap := _new_snap || jsonb_build_object('pain_score', NEW.pain_score);
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    _changed := array_append(_changed, 'status');
    _old_snap := _old_snap || jsonb_build_object('status', OLD.status);
    _new_snap := _new_snap || jsonb_build_object('status', NEW.status);
  END IF;

  IF OLD.session_date IS DISTINCT FROM NEW.session_date THEN
    _changed := array_append(_changed, 'session_date');
    _old_snap := _old_snap || jsonb_build_object('session_date', OLD.session_date);
    _new_snap := _new_snap || jsonb_build_object('session_date', NEW.session_date);
  END IF;

  IF OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN
    _changed := array_append(_changed, 'deleted_at');
    _old_snap := _old_snap || jsonb_build_object('deleted_at', OLD.deleted_at);
    _new_snap := _new_snap || jsonb_build_object('deleted_at', NEW.deleted_at);
  END IF;

  -- Se nenhum campo clínico foi alterado (ex: apenas mudou status de pagamento ou timestamps), não poluir o histórico médico
  IF cardinality(_changed) > 0 THEN
    INSERT INTO public.session_edit_history (
      session_id,
      clinic_id,
      editor_user_id,
      old_data,
      new_data,
      changed_fields,
      edited_at
    )
    VALUES (
      NEW.id,
      NEW.clinic_id,
      auth.uid(),
      _old_snap,
      _new_snap,
      _changed,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_session_edit_history_on_update ON public.sessions;
CREATE TRIGGER log_session_edit_history_on_update
AFTER UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.log_session_edit_history();

-- ==============================================================================
-- 4. ATUALIZAR POLÍTICAS RLS DE SESSIONS E PATIENTS COM SOFT DELETE FILTER
-- ==============================================================================

-- Atualizar RLS de leitura de sessões para respeitar deleted_at IS NULL
DROP POLICY IF EXISTS "Users read clinic sessions" ON public.sessions;
CREATE POLICY "Users read clinic sessions" ON public.sessions
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('sessions.read', clinic_id)
  AND (
    public.current_user_is_clinic_manager(clinic_id)
    OR user_id = auth.uid()
    OR provider_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.session_shares
      WHERE session_shares.session_id = sessions.id
        AND session_shares.clinic_id = sessions.clinic_id
        AND session_shares.shared_with_user_id = auth.uid()
        AND session_shares.revoked_at IS NULL
    )
  )
);

-- Atualizar RLS de leitura de pacientes para respeitar deleted_at IS NULL
DROP POLICY IF EXISTS "Users read clinic patients" ON public.patients;
CREATE POLICY "Users read clinic patients" ON public.patients
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.can_read_clinic_data(clinic_id)
  AND public.current_user_can('patients.read', clinic_id)
);
