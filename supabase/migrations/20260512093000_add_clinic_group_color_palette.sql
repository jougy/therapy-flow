CREATE TABLE IF NOT EXISTS public.clinic_group_color_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  slot_index integer NOT NULL,
  color_hex text NOT NULL,
  alpha integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinic_group_color_slots_slot_index_check CHECK (slot_index >= 0 AND slot_index < 21),
  CONSTRAINT clinic_group_color_slots_color_hex_check CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT clinic_group_color_slots_alpha_check CHECK (alpha >= 0 AND alpha <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_group_color_slots_clinic_slot
ON public.clinic_group_color_slots(clinic_id, slot_index);

CREATE INDEX IF NOT EXISTS idx_clinic_group_color_slots_clinic_id
ON public.clinic_group_color_slots(clinic_id);

DROP TRIGGER IF EXISTS update_clinic_group_color_slots_updated_at ON public.clinic_group_color_slots;
CREATE TRIGGER update_clinic_group_color_slots_updated_at
BEFORE UPDATE ON public.clinic_group_color_slots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.clinic_group_color_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read clinic_group_color_slots" ON public.clinic_group_color_slots;
CREATE POLICY "Users read clinic_group_color_slots" ON public.clinic_group_color_slots
FOR SELECT TO authenticated
USING (
  clinic_id = public.get_user_clinic_id((SELECT auth.uid()))
  AND public.current_user_can('patients.read', clinic_id)
);

DROP POLICY IF EXISTS "Users write clinic_group_color_slots" ON public.clinic_group_color_slots;
CREATE POLICY "Users write clinic_group_color_slots" ON public.clinic_group_color_slots
FOR ALL TO authenticated
USING (
  clinic_id = public.get_user_clinic_id((SELECT auth.uid()))
  AND public.current_user_can('patients.write', clinic_id)
)
WITH CHECK (
  clinic_id = public.get_user_clinic_id((SELECT auth.uid()))
  AND public.current_user_can('patients.write', clinic_id)
);

ALTER TABLE public.patient_groups
ADD COLUMN IF NOT EXISTS clinic_color_slot_id uuid REFERENCES public.clinic_group_color_slots(id) ON DELETE SET NULL;

ALTER TABLE public.patient_group_templates
ADD COLUMN IF NOT EXISTS clinic_color_slot_id uuid REFERENCES public.clinic_group_color_slots(id) ON DELETE SET NULL;

WITH clinics_to_seed AS (
  SELECT DISTINCT clinic_id
  FROM public.patient_groups
  WHERE clinic_id IS NOT NULL
  UNION
  SELECT DISTINCT clinic_id
  FROM public.patient_group_templates
  WHERE clinic_id IS NOT NULL
),
default_slots AS (
  SELECT *
  FROM (
    VALUES
      (0, '#E5E7EB', 100, 'gray'),
      (1, '#C4B5FD', 100, 'lavender'),
      (2, '#86EFAC', 100, 'sage'),
      (3, '#FDBA74', 100, 'peach'),
      (4, '#7DD3FC', 100, 'sky'),
      (5, '#FDA4AF', 100, 'rose')
  ) AS defaults(slot_index, color_hex, alpha, legacy_key)
)
INSERT INTO public.clinic_group_color_slots (clinic_id, slot_index, color_hex, alpha)
SELECT clinics_to_seed.clinic_id, default_slots.slot_index, default_slots.color_hex, default_slots.alpha
FROM clinics_to_seed
CROSS JOIN default_slots
ON CONFLICT (clinic_id, slot_index) DO NOTHING;

WITH slot_mapping AS (
  SELECT clinic_group_color_slots.id, clinic_group_color_slots.clinic_id, clinic_group_color_slots.slot_index
  FROM public.clinic_group_color_slots
)
UPDATE public.patient_groups
SET clinic_color_slot_id = slot_mapping.id
FROM slot_mapping
WHERE patient_groups.clinic_id = slot_mapping.clinic_id
  AND patient_groups.clinic_color_slot_id IS NULL
  AND (
    (patient_groups.color = 'gray' AND slot_mapping.slot_index = 0) OR
    (patient_groups.color = 'lavender' AND slot_mapping.slot_index = 1) OR
    (patient_groups.color = 'sage' AND slot_mapping.slot_index = 2) OR
    (patient_groups.color = 'peach' AND slot_mapping.slot_index = 3) OR
    (patient_groups.color = 'sky' AND slot_mapping.slot_index = 4) OR
    (patient_groups.color = 'rose' AND slot_mapping.slot_index = 5)
  );

WITH slot_mapping AS (
  SELECT clinic_group_color_slots.id, clinic_group_color_slots.clinic_id, clinic_group_color_slots.slot_index
  FROM public.clinic_group_color_slots
)
UPDATE public.patient_group_templates
SET clinic_color_slot_id = slot_mapping.id
FROM slot_mapping
WHERE patient_group_templates.clinic_id = slot_mapping.clinic_id
  AND patient_group_templates.clinic_color_slot_id IS NULL
  AND (
    (patient_group_templates.color = 'gray' AND slot_mapping.slot_index = 0) OR
    (patient_group_templates.color = 'lavender' AND slot_mapping.slot_index = 1) OR
    (patient_group_templates.color = 'sage' AND slot_mapping.slot_index = 2) OR
    (patient_group_templates.color = 'peach' AND slot_mapping.slot_index = 3) OR
    (patient_group_templates.color = 'sky' AND slot_mapping.slot_index = 4) OR
    (patient_group_templates.color = 'rose' AND slot_mapping.slot_index = 5)
  );
