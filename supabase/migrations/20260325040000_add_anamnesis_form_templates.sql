CREATE TABLE public.anamnesis_form_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.anamnesis_form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage clinic anamnesis form templates" ON public.anamnesis_form_templates
FOR ALL TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()))
WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Super admins manage all anamnesis form templates" ON public.anamnesis_form_templates
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_anamnesis_form_templates_clinic_id
ON public.anamnesis_form_templates(clinic_id);

CREATE TRIGGER update_anamnesis_form_templates_updated_at
BEFORE UPDATE ON public.anamnesis_form_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sessions
ADD COLUMN anamnesis_template_id uuid REFERENCES public.anamnesis_form_templates(id) ON DELETE SET NULL,
ADD COLUMN anamnesis_form_response jsonb DEFAULT '{}'::jsonb;

CREATE INDEX idx_sessions_anamnesis_template_id
ON public.sessions(anamnesis_template_id);
