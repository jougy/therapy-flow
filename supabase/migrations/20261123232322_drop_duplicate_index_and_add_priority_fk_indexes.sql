-- Migration: Remover índice duplicado em patient_payment_plans (0009_duplicate_index)
-- e criar 26 índices seletivos para FKs prioritárias (0001_unindexed_foreign_keys)

-- 1. Remoção segura de índice duplicado confirmado (mantém idx_patient_payment_plans_patient_id)
-- Rollback: CREATE INDEX IF NOT EXISTS idx_patient_payment_plans_patient_cover ON public.patient_payment_plans USING btree (patient_id);
DROP INDEX IF EXISTS public.idx_patient_payment_plans_patient_cover;

-- 2. Índices seletivos para FKs operacionais / multi-tenant / ON DELETE em tabelas ativas
CREATE INDEX IF NOT EXISTS idx_app_notifications_clinic_id
  ON public.app_notifications USING btree (clinic_id) WHERE (clinic_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_user_active_clinic_contexts_clinic_id
  ON public.user_active_clinic_contexts USING btree (clinic_id);

CREATE INDEX IF NOT EXISTS idx_platform_auto_leads_converted_clinic_id
  ON public.platform_auto_leads USING btree (converted_clinic_id) WHERE (converted_clinic_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_platform_auto_leads_meeting_id
  ON public.platform_auto_leads USING btree (meeting_id) WHERE (meeting_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_platform_auto_leads_routine_id
  ON public.platform_auto_leads USING btree (routine_id) WHERE (routine_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_sessions_patient_clinic
  ON public.sessions USING btree (patient_id, clinic_id);

CREATE INDEX IF NOT EXISTS idx_sessions_group_id
  ON public.sessions USING btree (group_id) WHERE (group_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_session_edit_history_clinic_id
  ON public.session_edit_history USING btree (clinic_id);

CREATE INDEX IF NOT EXISTS idx_patient_clinical_snapshots_clinic_id
  ON public.patient_clinical_snapshots USING btree (clinic_id);

CREATE INDEX IF NOT EXISTS idx_patient_registration_links_clinic_id
  ON public.patient_registration_links USING btree (clinic_id);

CREATE INDEX IF NOT EXISTS idx_platform_clinic_access_sessions_clinic_id
  ON public.platform_clinic_access_sessions USING btree (clinic_id);

CREATE INDEX IF NOT EXISTS idx_patient_groups_user_id
  ON public.patient_groups USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_patient_groups_clinic_color_slot_id
  ON public.patient_groups USING btree (clinic_color_slot_id) WHERE (clinic_color_slot_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_anamnesis_form_templates_user_id
  ON public.anamnesis_form_templates USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_team_development_profiles_user_id
  ON public.team_development_profiles USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_clinic_subscriptions_account_owner_user_id
  ON public.clinic_subscriptions USING btree (account_owner_user_id);

CREATE INDEX IF NOT EXISTS idx_clinic_subscriptions_applied_coupon_id
  ON public.clinic_subscriptions USING btree (applied_coupon_id) WHERE (applied_coupon_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_patient_health_insurances_clinic_id
  ON public.patient_health_insurances USING btree (clinic_id);

CREATE INDEX IF NOT EXISTS idx_patient_health_insurances_patient_id
  ON public.patient_health_insurances USING btree (patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_health_insurances_health_insurance_id
  ON public.patient_health_insurances USING btree (health_insurance_id);

CREATE INDEX IF NOT EXISTS idx_clinic_health_insurances_clinic_id
  ON public.clinic_health_insurances USING btree (clinic_id);

CREATE INDEX IF NOT EXISTS idx_clinic_insurance_procedures_clinic_id
  ON public.clinic_insurance_procedures USING btree (clinic_id);

CREATE INDEX IF NOT EXISTS idx_clinic_insurance_procedures_health_insurance_id
  ON public.clinic_insurance_procedures USING btree (health_insurance_id);

CREATE INDEX IF NOT EXISTS idx_clinic_document_signatures_session_id
  ON public.clinic_document_signatures USING btree (session_id) WHERE (session_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_clinic_document_signatures_template_id
  ON public.clinic_document_signatures USING btree (template_id) WHERE (template_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_patient_payment_plans_health_insurance_id
  ON public.patient_payment_plans USING btree (health_insurance_id) WHERE (health_insurance_id IS NOT NULL);
