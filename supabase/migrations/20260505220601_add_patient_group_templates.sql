CREATE TABLE IF NOT EXISTS public.patient_group_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  color text NOT NULL DEFAULT 'lavender',
  status text NOT NULL DEFAULT 'em_andamento',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_group_templates_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT patient_group_templates_normalized_name_not_blank CHECK (btrim(normalized_name) <> ''),
  CONSTRAINT patient_group_templates_status_check CHECK (
    status IN ('em_andamento', 'pausado', 'concluido', 'cancelado', 'inativo')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_group_templates_clinic_normalized_name
ON public.patient_group_templates(clinic_id, normalized_name);

CREATE INDEX IF NOT EXISTS idx_patient_group_templates_clinic_id
ON public.patient_group_templates(clinic_id);

DROP TRIGGER IF EXISTS update_patient_group_templates_updated_at ON public.patient_group_templates;
CREATE TRIGGER update_patient_group_templates_updated_at
BEFORE UPDATE ON public.patient_group_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.patient_group_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read clinic patient_group_templates" ON public.patient_group_templates;
CREATE POLICY "Users read clinic patient_group_templates" ON public.patient_group_templates
FOR SELECT TO authenticated
USING (
  clinic_id = public.get_user_clinic_id((SELECT auth.uid()))
  AND public.current_user_can('patients.read', clinic_id)
);

DROP POLICY IF EXISTS "Users write clinic patient_group_templates" ON public.patient_group_templates;
CREATE POLICY "Users write clinic patient_group_templates" ON public.patient_group_templates
FOR ALL TO authenticated
USING (
  clinic_id = public.get_user_clinic_id((SELECT auth.uid()))
  AND public.current_user_can('patients.write', clinic_id)
)
WITH CHECK (
  clinic_id = public.get_user_clinic_id((SELECT auth.uid()))
  AND public.current_user_can('patients.write', clinic_id)
);

INSERT INTO public.patient_group_templates (
  clinic_id,
  name,
  normalized_name,
  color,
  status,
  created_by,
  created_at,
  updated_at
)
SELECT
  ranked.clinic_id,
  ranked.name,
  ranked.normalized_name,
  ranked.color,
  ranked.status,
  ranked.user_id,
  ranked.created_at,
  now()
FROM (
  SELECT
    patient_groups.*,
    lower(regexp_replace(btrim(patient_groups.name), '\s+', ' ', 'g')) AS normalized_name,
    row_number() OVER (
      PARTITION BY patient_groups.clinic_id, lower(regexp_replace(btrim(patient_groups.name), '\s+', ' ', 'g'))
      ORDER BY patient_groups.created_at ASC, patient_groups.id ASC
    ) AS template_rank
  FROM public.patient_groups
  WHERE patient_groups.clinic_id IS NOT NULL
    AND patient_groups.is_default = false
    AND btrim(patient_groups.name) <> ''
) AS ranked
WHERE ranked.template_rank = 1
ON CONFLICT (clinic_id, normalized_name) DO UPDATE
SET
  name = EXCLUDED.name,
  color = EXCLUDED.color,
  status = EXCLUDED.status,
  updated_at = now();
