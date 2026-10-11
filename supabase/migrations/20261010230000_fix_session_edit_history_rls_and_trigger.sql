-- Migration: 20261010230000_fix_session_edit_history_rls_and_trigger.sql
-- Description:
--   1. Garante que session_edit_history suporte clinic_id nulo e possua colunas de auditoria forense.
--   2. Define políticas RLS completas (SELECT e INSERT) para session_edit_history.
--   3. Recria log_session_edit_history() com SECURITY DEFINER e tratamento de exceção seguro.
--   4. Garante permissões GRANT de execução e escrita adequadas para authenticated e service_role.

-- 1. Estrutura da tabela
ALTER TABLE public.session_edit_history
  ALTER COLUMN clinic_id DROP NOT NULL;

ALTER TABLE public.session_edit_history
  ADD COLUMN IF NOT EXISTS old_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS new_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS changed_fields text[] DEFAULT '{}'::text[] NOT NULL,
  ADD COLUMN IF NOT EXISTS change_reason text,
  ADD COLUMN IF NOT EXISTS ip_address text;

-- 2. Habilita RLS e cria políticas de leitura e inserção
ALTER TABLE public.session_edit_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read clinic session edit history" ON public.session_edit_history;
CREATE POLICY "Users read clinic session edit history" ON public.session_edit_history
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.get_user_clinic_id(auth.uid())
    OR editor_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Users insert clinic session edit history" ON public.session_edit_history;
CREATE POLICY "Users insert clinic session edit history" ON public.session_edit_history
  FOR INSERT TO authenticated
  WITH CHECK (
    editor_user_id = auth.uid()
    OR clinic_id = public.get_user_clinic_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR true
  );

DROP POLICY IF EXISTS "Super admins manage all session edit history" ON public.session_edit_history;
CREATE POLICY "Super admins manage all session edit history" ON public.session_edit_history
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 3. Grants na tabela
GRANT SELECT, INSERT ON TABLE public.session_edit_history TO authenticated;
GRANT ALL ON TABLE public.session_edit_history TO service_role;

-- 4. Função de trigger resiliente e SECURITY DEFINER
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
  _actor_id uuid;
BEGIN
  _actor_id := auth.uid();
  IF _actor_id IS NULL THEN
    _actor_id := NEW.user_id;
  END IF;

  -- Se não houver ator identificado, continua a operação normalmente
  IF _actor_id IS NULL THEN
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

  -- Se nenhum campo clínico foi alterado, não registrar
  IF cardinality(_changed) > 0 THEN
    BEGIN
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
        _actor_id,
        _old_snap,
        _new_snap,
        _changed,
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      -- Loga warning sem impedir a gravação clínica do paciente
      RAISE WARNING 'Falha ao registrar session_edit_history para session_id %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Grants na função e trigger
GRANT EXECUTE ON FUNCTION public.log_session_edit_history() TO authenticated, anon, service_role;

DROP TRIGGER IF EXISTS log_session_edit_history_on_update ON public.sessions;
CREATE TRIGGER log_session_edit_history_on_update
AFTER UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.log_session_edit_history();
