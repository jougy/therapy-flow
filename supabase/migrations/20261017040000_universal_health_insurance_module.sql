-- ==============================================================================
-- MIGRATION: Módulo Universal e Modular de Convênios & Reembolso
-- Convenções: Padrão _cents (bigint), RLS estrito via capabilities/membership,
-- Soft delete (deleted_at) e integridade referencial.
-- ==============================================================================

-- 1. Tabela de Convênios / Operadoras cadastradas pela Clínica
CREATE TABLE IF NOT EXISTS public.clinic_health_insurances (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
    name text NOT NULL,
    ans_code text,
    payment_term_days integer DEFAULT 30 NOT NULL CHECK (payment_term_days >= 0),
    requires_authorization_guide boolean DEFAULT true NOT NULL,
    requires_session_signature boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz
);

-- RLS: clinic_health_insurances
ALTER TABLE public.clinic_health_insurances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_health_insurances_select" ON public.clinic_health_insurances
    FOR SELECT USING (
        public.user_has_active_clinic_membership(auth.uid(), clinic_id)
        AND deleted_at IS NULL
    );

CREATE POLICY "clinic_health_insurances_insert" ON public.clinic_health_insurances
    FOR INSERT WITH CHECK (
        public.current_user_can('treasury.manage', clinic_id)
    );

CREATE POLICY "clinic_health_insurances_update" ON public.clinic_health_insurances
    FOR UPDATE USING (
        public.current_user_can('treasury.manage', clinic_id)
    ) WITH CHECK (
        public.current_user_can('treasury.manage', clinic_id)
    );

CREATE POLICY "clinic_health_insurances_delete" ON public.clinic_health_insurances
    FOR DELETE USING (
        public.current_user_can('treasury.manage', clinic_id)
    );

-- 2. Tabela de Procedimentos e Valores Acordados por Convênio
CREATE TABLE IF NOT EXISTS public.clinic_insurance_procedures (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
    health_insurance_id uuid NOT NULL REFERENCES public.clinic_health_insurances(id) ON DELETE CASCADE,
    procedure_name text NOT NULL,
    tuss_code text,
    session_unit_amount_cents bigint NOT NULL CHECK (session_unit_amount_cents >= 0),
    copay_amount_cents bigint DEFAULT 0 NOT NULL CHECK (copay_amount_cents >= 0),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- RLS: clinic_insurance_procedures
ALTER TABLE public.clinic_insurance_procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_insurance_procedures_select" ON public.clinic_insurance_procedures
    FOR SELECT USING (
        public.user_has_active_clinic_membership(auth.uid(), clinic_id)
    );

CREATE POLICY "clinic_insurance_procedures_all" ON public.clinic_insurance_procedures
    FOR ALL USING (
        public.current_user_can('treasury.manage', clinic_id)
    ) WITH CHECK (
        public.current_user_can('treasury.manage', clinic_id)
    );

-- 3. Vínculo do Paciente com Convênio (Carteirinhas)
CREATE TABLE IF NOT EXISTS public.patient_health_insurances (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
    patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
    health_insurance_id uuid REFERENCES public.clinic_health_insurances(id) ON DELETE SET NULL,
    insurance_name_custom text,
    card_number text NOT NULL,
    card_valid_until date,
    plan_tier text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- RLS: patient_health_insurances
ALTER TABLE public.patient_health_insurances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_health_insurances_select" ON public.patient_health_insurances
    FOR SELECT USING (
        public.user_has_active_clinic_membership(auth.uid(), clinic_id)
    );

CREATE POLICY "patient_health_insurances_all" ON public.patient_health_insurances
    FOR ALL USING (
        public.current_user_can('patients.manage', clinic_id)
        OR public.current_user_can('sessions.create', clinic_id)
    ) WITH CHECK (
        public.current_user_can('patients.manage', clinic_id)
        OR public.current_user_can('sessions.create', clinic_id)
    );

-- 4. Extensões em patient_payment_plans
ALTER TABLE public.patient_payment_plans
ADD COLUMN IF NOT EXISTS insurance_mode text DEFAULT 'none' CHECK (insurance_mode IN ('none', 'direct_billing', 'reimbursement')),
ADD COLUMN IF NOT EXISTS health_insurance_id uuid REFERENCES public.clinic_health_insurances(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS authorization_number text,
ADD COLUMN IF NOT EXISTS authorization_valid_until date;

-- 5. Extensões em sessions
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS insurance_mode text DEFAULT 'none' CHECK (insurance_mode IN ('none', 'direct_billing', 'reimbursement')),
ADD COLUMN IF NOT EXISTS authorization_number text,
ADD COLUMN IF NOT EXISTS patient_signature_url text,
ADD COLUMN IF NOT EXISTS patient_signed_at timestamptz;
