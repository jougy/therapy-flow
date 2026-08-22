-- Migration: Optimize RLS policies with scalar subqueries and add safe stale session cleanup
-- 1. Envelopar chamadas a funções de autorização em subqueries (SELECT ...) para avaliação O(1) por query no PostgreSQL.
-- 2. Manter 100% de isolamento RLS e proteção por clínica e usuário.
-- 3. Adicionar rotina de expiração de sessões abandonadas (> 7 dias).

-- A. Otimização de RLS na tabela patients
DROP POLICY IF EXISTS "Users read clinic patients" ON public.patients;
CREATE POLICY "Users read clinic patients" ON public.patients
FOR SELECT TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.current_user_can('patients.read', clinic_id)
);

DROP POLICY IF EXISTS "Users write clinic patients" ON public.patients;
CREATE POLICY "Users write clinic patients" ON public.patients
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.current_user_can('patients.write', clinic_id)
);

DROP POLICY IF EXISTS "Users update clinic patients" ON public.patients;
CREATE POLICY "Users update clinic patients" ON public.patients
FOR UPDATE TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.current_user_can('patients.write', clinic_id)
)
WITH CHECK (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.current_user_can('patients.write', clinic_id)
);

-- B. Otimização de RLS na tabela sessions
DROP POLICY IF EXISTS "Users read clinic sessions" ON public.sessions;
CREATE POLICY "Users read clinic sessions" ON public.sessions
FOR SELECT TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.current_user_can('sessions.read', clinic_id)
);

DROP POLICY IF EXISTS "Users insert clinic sessions" ON public.sessions;
CREATE POLICY "Users insert clinic sessions" ON public.sessions
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.current_user_can('sessions.write', clinic_id)
);

DROP POLICY IF EXISTS "Users update clinic sessions" ON public.sessions;
CREATE POLICY "Users update clinic sessions" ON public.sessions
FOR UPDATE TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.current_user_can('sessions.write', clinic_id)
)
WITH CHECK (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.current_user_can('sessions.write', clinic_id)
);

-- C. Otimização de RLS na tabela patient_groups
DROP POLICY IF EXISTS "Users read clinic patient_groups" ON public.patient_groups;
CREATE POLICY "Users read clinic patient_groups" ON public.patient_groups
FOR SELECT TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.current_user_can('patient_groups.read', clinic_id)
);

DROP POLICY IF EXISTS "Users write clinic patient_groups" ON public.patient_groups;
CREATE POLICY "Users write clinic patient_groups" ON public.patient_groups
FOR ALL TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.current_user_can('patient_groups.write', clinic_id)
)
WITH CHECK (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.current_user_can('patient_groups.write', clinic_id)
);

-- D. Otimização de RLS na tabela agenda_events
DROP POLICY IF EXISTS "Users read clinic agenda events" ON public.agenda_events;
CREATE POLICY "Users read clinic agenda events" ON public.agenda_events
FOR SELECT TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.current_user_can('agenda.read', clinic_id)
);

DROP POLICY IF EXISTS "Users write clinic agenda events" ON public.agenda_events;
CREATE POLICY "Users write clinic agenda events" ON public.agenda_events
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.current_user_can('agenda.write', clinic_id)
);

DROP POLICY IF EXISTS "Users update clinic agenda events" ON public.agenda_events;
CREATE POLICY "Users update clinic agenda events" ON public.agenda_events
FOR UPDATE TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.current_user_can('agenda.write', clinic_id)
)
WITH CHECK (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.current_user_can('agenda.write', clinic_id)
);

-- E. Otimização de RLS na tabela anamnesis_form_templates
DROP POLICY IF EXISTS "Users read clinic anamnesis forms" ON public.anamnesis_form_templates;
CREATE POLICY "Users read clinic anamnesis forms" ON public.anamnesis_form_templates
FOR SELECT TO authenticated
USING (
  clinic_id = (SELECT public.get_user_clinic_id((SELECT auth.uid())))
  AND public.current_user_can('anamnesis_forms.read', clinic_id)
);

-- F. Função para expirar sessões de segurança abandonadas (> 7 dias sem atividade)
CREATE OR REPLACE FUNCTION public.expire_abandoned_security_sessions(
  _abandoned_window interval DEFAULT INTERVAL '7 days'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _affected_count integer := 0;
BEGIN
  UPDATE public.user_security_sessions
  SET
    ended_at = COALESCE(last_seen_at, now()),
    updated_at = now()
  WHERE ended_at IS NULL
    AND last_seen_at < now() - _abandoned_window;

  GET DIAGNOSTICS _affected_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'expired_count', _affected_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_abandoned_security_sessions(interval) TO authenticated, service_role;
