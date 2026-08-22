-- Migration: Add Patient Payment Plans and linking to Sessions and Agenda Events

CREATE TABLE IF NOT EXISTS public.patient_payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Pacote de Sessões',
  total_sessions integer NOT NULL CHECK (total_sessions > 0),
  used_sessions integer NOT NULL DEFAULT 0 CHECK (used_sessions >= 0),
  total_amount_cents bigint NOT NULL DEFAULT 0 CHECK (total_amount_cents >= 0),
  session_unit_amount_cents bigint NOT NULL DEFAULT 0 CHECK (session_unit_amount_cents >= 0),
  payment_method text NOT NULL DEFAULT 'nao_informado',
  payment_installments integer NOT NULL DEFAULT 1 CHECK (payment_installments >= 1),
  payment_status text NOT NULL DEFAULT 'pendente' CHECK (payment_status IN ('pendente', 'pago', 'parcial', 'cancelado')),
  payment_status_date date,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add foreign key columns to sessions and agenda_events
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS payment_plan_id uuid REFERENCES public.patient_payment_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_plan_session_index integer CHECK (payment_plan_session_index IS NULL OR payment_plan_session_index >= 1);

ALTER TABLE public.agenda_events
  ADD COLUMN IF NOT EXISTS payment_plan_id uuid REFERENCES public.patient_payment_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_plan_session_index integer CHECK (payment_plan_session_index IS NULL OR payment_plan_session_index >= 1);

-- RLS
ALTER TABLE public.patient_payment_plans ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_patient_payment_plans_clinic_id ON public.patient_payment_plans(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_payment_plans_patient_id ON public.patient_payment_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_payment_plan_id ON public.sessions(payment_plan_id);
CREATE INDEX IF NOT EXISTS idx_agenda_events_payment_plan_id ON public.agenda_events(payment_plan_id);

DROP TRIGGER IF EXISTS update_patient_payment_plans_updated_at ON public.patient_payment_plans;
CREATE TRIGGER update_patient_payment_plans_updated_at
BEFORE UPDATE ON public.patient_payment_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Users manage clinic payment plans" ON public.patient_payment_plans;
CREATE POLICY "Users manage clinic payment plans"
ON public.patient_payment_plans
FOR ALL
TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()))
WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));

DROP POLICY IF EXISTS "Super admins manage all payment plans" ON public.patient_payment_plans;
CREATE POLICY "Super admins manage all payment plans"
ON public.patient_payment_plans
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
