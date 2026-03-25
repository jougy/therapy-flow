CREATE TABLE public.agenda_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('atendimento', 'reuniao', 'evento')),
  title text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agenda_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_agenda_events_clinic_id ON public.agenda_events(clinic_id);
CREATE INDEX idx_agenda_events_user_id ON public.agenda_events(user_id);
CREATE INDEX idx_agenda_events_scheduled_for ON public.agenda_events(scheduled_for);
CREATE INDEX idx_agenda_events_patient_id ON public.agenda_events(patient_id);

CREATE TRIGGER update_agenda_events_updated_at
BEFORE UPDATE ON public.agenda_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Users manage clinic agenda events"
ON public.agenda_events
FOR ALL
TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()))
WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Super admins manage all agenda events"
ON public.agenda_events
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
