CREATE TABLE IF NOT EXISTS public.patient_clinical_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  change_note text,
  changed_fields text[] NOT NULL DEFAULT '{}',
  change_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_patient_clinical_snapshots_patient_created_at
ON public.patient_clinical_snapshots(patient_id, created_at DESC);

ALTER TABLE public.patient_clinical_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read patient_clinical_snapshots" ON public.patient_clinical_snapshots;
CREATE POLICY "Users read patient_clinical_snapshots" ON public.patient_clinical_snapshots
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND public.current_user_can('patients.read', clinic_id)
);

DROP POLICY IF EXISTS "Users write patient_clinical_snapshots" ON public.patient_clinical_snapshots;
CREATE POLICY "Users write patient_clinical_snapshots" ON public.patient_clinical_snapshots
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND public.current_user_can('patients.write', clinic_id)
);
