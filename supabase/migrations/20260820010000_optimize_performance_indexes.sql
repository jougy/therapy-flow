-- Migration: 20260820010000_optimize_performance_indexes.sql
-- Description: Create indexes on core clinical tables to eliminate sequential scans and accelerate queries.

-- 1. Index on sessions by clinic_id and session_date DESC (accelerates homepage and dashboard queries)
CREATE INDEX IF NOT EXISTS idx_sessions_clinic_date_desc 
ON public.sessions (clinic_id, session_date DESC);

-- 2. Index on sessions by clinic_id and patient_id (accelerates patient detail queries within a clinic)
CREATE INDEX IF NOT EXISTS idx_sessions_clinic_patient 
ON public.sessions (clinic_id, patient_id);

-- 3. Index on patient_groups by clinic_id (accelerates group lookups per clinic)
CREATE INDEX IF NOT EXISTS idx_patient_groups_clinic_id 
ON public.patient_groups (clinic_id);

-- 4. Composite index on patients by clinic_id and updated_at DESC (accelerates patient listings)
CREATE INDEX IF NOT EXISTS idx_patients_clinic_updated_desc 
ON public.patients (clinic_id, updated_at DESC);

-- 5. Index on profiles by clinic_id (accelerates team member lookups)
CREATE INDEX IF NOT EXISTS idx_profiles_clinic_id 
ON public.profiles (clinic_id);

-- 6. Partial index for unread notifications per user
CREATE INDEX IF NOT EXISTS idx_app_notifications_user_unread 
ON public.app_notifications (user_id, created_at DESC) 
WHERE read_at IS NULL;
