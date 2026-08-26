-- Migration: Add evolution lineage and patient evolution groups
-- Description: Allows sessions to be grouped into clinical evolution cycles and tracks parent/child session evolution.

CREATE TABLE IF NOT EXISTS public.patient_evolution_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  custom_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add evolution lineage columns to sessions
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS parent_session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evolution_group_id uuid REFERENCES public.patient_evolution_groups(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.patient_evolution_groups ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patient_evolution_groups_clinic_id ON public.patient_evolution_groups(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_evolution_groups_patient_id ON public.patient_evolution_groups(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_evolution_group_id ON public.sessions(evolution_group_id);
CREATE INDEX IF NOT EXISTS idx_sessions_parent_session_id ON public.sessions(parent_session_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_patient_evolution_groups_updated_at ON public.patient_evolution_groups;
CREATE TRIGGER update_patient_evolution_groups_updated_at
BEFORE UPDATE ON public.patient_evolution_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Policies
DROP POLICY IF EXISTS "Users manage clinic evolution groups" ON public.patient_evolution_groups;
CREATE POLICY "Users manage clinic evolution groups"
ON public.patient_evolution_groups
FOR ALL
TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()))
WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));

DROP POLICY IF EXISTS "Super admins manage all evolution groups" ON public.patient_evolution_groups;
CREATE POLICY "Super admins manage all evolution groups"
ON public.patient_evolution_groups
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
