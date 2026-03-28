CREATE TABLE IF NOT EXISTS public.session_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  editor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  edited_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_edit_history_session_id
ON public.session_edit_history(session_id);

CREATE INDEX IF NOT EXISTS idx_session_edit_history_edited_at
ON public.session_edit_history(edited_at DESC);

ALTER TABLE public.session_edit_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read clinic session edit history" ON public.session_edit_history;
CREATE POLICY "Users read clinic session edit history" ON public.session_edit_history
FOR SELECT
USING (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('sessions.read', clinic_id)
);

DROP POLICY IF EXISTS "Users insert clinic session edit history" ON public.session_edit_history;
CREATE POLICY "Users insert clinic session edit history" ON public.session_edit_history
FOR INSERT
WITH CHECK (
  editor_user_id = auth.uid()
  AND clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('sessions.write', clinic_id)
);

CREATE OR REPLACE FUNCTION public.log_session_edit_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.session_edit_history (
      session_id,
      clinic_id,
      editor_user_id
    )
    VALUES (
      NEW.id,
      NEW.clinic_id,
      auth.uid()
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
