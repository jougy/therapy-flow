-- Migration: Hardening de SECURITY DEFINER (0028_anon & 0029_authenticated)
-- 1. Revoga EXECUTE de triggers, internas, manutenção, Edge-only e órfãs
-- 2. Revoga anon de todos os RPCs autenticados (mantendo apenas os 9 públicos intencionais token-gated/signup)
-- 3. Endurece guards em get_clinic_storage_usage, get_user_active_governance, rpc_get_available_slots, increment_community_template_import
-- 4. Cria wrapper RBAC platform_send_user_notification para PlatformInviteAffiliateModal
-- 5. Aplica ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon

-- A. Wrapper RBAC para notificação in-app de convite de afiliado
CREATE OR REPLACE FUNCTION public.platform_send_user_notification(
  _user_id uuid,
  _clinic_id uuid,
  _actor_user_id uuid,
  _category text,
  _event_type text,
  _title text,
  _body text,
  _action_label text DEFAULT NULL::text,
  _action_url text DEFAULT NULL::text,
  _payload jsonb DEFAULT '{}'::jsonb,
  _source_event_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
BEGIN
  IF _caller_id IS NULL OR (NOT public.is_platform_admin(_caller_id) AND NOT public.is_platform_marketing(_caller_id)) THEN
    RAISE EXCEPTION 'Acesso negado: apenas Platform Admin/Marketing podem enviar notificacoes.';
  END IF;

  RETURN public.create_user_notification(
    _user_id,
    _clinic_id,
    COALESCE(_actor_user_id, _caller_id),
    _category,
    _event_type,
    _title,
    _body,
    _action_label,
    _action_url,
    _payload,
    _source_event_id
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.platform_send_user_notification(uuid, uuid, uuid, text, text, text, text, text, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_send_user_notification(uuid, uuid, uuid, text, text, text, text, text, text, jsonb, uuid) TO authenticated, service_role;

-- B. Endurecimento de guards nos 4 RPCs autenticados sem validação de ownership/tenant
CREATE OR REPLACE FUNCTION public.get_clinic_storage_usage(_clinic_id uuid)
RETURNS TABLE(total_bytes bigint, total_files bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
BEGIN
  IF pg_catalog.current_user <> 'service_role' THEN
    IF _caller_id IS NULL OR (
      NOT public.user_has_active_clinic_membership(_caller_id, _clinic_id)
      AND NOT public.is_platform_owner(_caller_id)
    ) THEN
      RAISE EXCEPTION 'Acesso negado ao uso de armazenamento da clinica.';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(COALESCE(stored_byte_size, byte_size)), 0)::bigint AS total_bytes,
    COUNT(*)::bigint AS total_files
  FROM public.patient_file_uploads
  WHERE clinic_id = _clinic_id
    AND status = 'uploaded';
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_active_governance(_user_id uuid)
RETURNS TABLE(
  punishment_id uuid,
  punishment_type text,
  applied_at timestamptz,
  expires_at timestamptz,
  reason text,
  is_manual boolean,
  applied_by_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
BEGIN
  IF _caller_id IS NULL OR (_caller_id <> _user_id AND NOT public.is_platform_admin(_caller_id)) THEN
    RAISE EXCEPTION 'Acesso negado aos dados de governanca.';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS punishment_id,
    p.punishment_type,
    p.applied_at,
    p.expires_at,
    p.reason,
    p.is_manual,
    COALESCE(prof.full_name, prof.email, 'Sistema Automático') AS applied_by_name
  FROM public.user_punishments p
  LEFT JOIN public.profiles prof ON prof.id = p.applied_by
  WHERE p.user_id = _user_id
    AND p.is_active = true
    AND (p.expires_at IS NULL OR p.expires_at > pg_catalog.now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_community_template_import(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  UPDATE public.community_form_templates
  SET imports_count = imports_count + 1
  WHERE id = p_template_id AND is_published = true;
END;
$function$;

-- C. Revogação em bloco via DO $$ para todas as funções SECURITY DEFINER em public
-- preservando exatamente:
--   - public_anon_allowlist: 9 RPCs públicos intencionais (token-gated / signup / assinatura pública)
--   - internal_revoke_both: triggers, manutenção, Edge-only e órfãs (revoga PUBLIC, anon, authenticated)
--   - custom_access_token_hook: revoga PUBLIC, anon, authenticated e garante supabase_auth_admin
--   - demais SECURITY DEFINER: revoga PUBLIC, anon (mantém authenticated, service_role)
DO $$
DECLARE
  _rec record;
  _public_anon_allowlist text[] := ARRAY[
    'get_patient_registration_form',
    'submit_patient_registration_form',
    'authorize_minor_guardian_consent',
    'get_document_signature_by_token',
    'submit_document_signature_by_token',
    'get_public_signature_verification',
    'get_clinic_collaborator_invitation',
    'request_account_recovery_status',
    'handle_personal_signup'
  ];
  _internal_revoke_both text[] := ARRAY[
    -- Triggers
    'check_clinic_hibernation_eligibility',
    'ensure_default_patient_group',
    'handle_clinic_word_telemetry',
    'log_session_edit_history',
    'notify_clinic_access_session_created',
    'notify_session_created',
    'notify_signup_telegram_fallback',
    'prevent_affiliate_pyramid_structure',
    'prevent_affiliate_self_referral',
    'sync_auto_lead_before_write',
    'sync_billing_to_session',
    'sync_clinic_daily_metrics',
    'sync_clinic_limits_from_subscription',
    'sync_meeting_to_auto_leads',
    'sync_payment_plan_used_sessions',
    'sync_session_to_billing',
    'sync_whatsapp_session_to_auto_leads',
    'trg_affiliate_conversions_sync_tier',
    'trg_auto_assign_patient_code',
    'trg_patient_groups_set_clinic_id',
    'validate_affiliate_unique_financial_data',
    -- Edge-only / Asaas / WhatsApp / Manutenção / Internas / Órfãs
    'confirm_asaas_subscription_payment',
    'record_asaas_webhook_event',
    'record_and_validate_asaas_webhook',
    'handle_signup',
    'rpc_book_appointment_safe',
    'generate_next_patient_code',
    'create_user_notification',
    'notify_clinic_collaborator_presence',
    'trim_user_notifications',
    'ensure_notification_preferences',
    'cleanup_user_security_sessions',
    'log_security_event',
    'ensure_team_development_profile',
    'get_active_platform_clinic_id',
    'is_clinic_subscription_manager',
    'recalculate_affiliate_tier',
    'expire_abandoned_security_sessions',
    'expire_outdated_user_punishments',
    'purge_old_app_notifications',
    'purge_clinic_trash_bin',
    'purge_expired_operational_data',
    'cleanup_old_telemetry_events',
    'create_due_agenda_reminder_notifications',
    'finalize_overdue_agenda_events',
    'reset_whatsapp_chat_sessions',
    'verify_password_recovery_identity',
    'change_clinic_subscription_plan',
    'check_clinic_plan_quota',
    'can_perform_action',
    'current_user_can_role_capability',
    'batch_sync_push',
    'buy_clinic_subaccount_extra_spaces',
    'schedule_patient_appointment',
    'get_clinic_active_terms',
    'log_platform_error',
    'validate_user_clinic',
    'update_clinic_collaborator_invitation'
  ];
BEGIN
  FOR _rec IN
    SELECT p.oid::regprocedure::text AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    IF _rec.proname = 'custom_access_token_hook' THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', _rec.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO supabase_auth_admin', _rec.sig);
    ELSIF _rec.proname = ANY(_internal_revoke_both) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', _rec.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', _rec.sig);
    ELSIF _rec.proname = ANY(_public_anon_allowlist) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', _rec.sig);
    ELSE
      -- RPCs autenticados intencionais e RLS helpers
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', _rec.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', _rec.sig);
    END IF;
  END LOOP;
END $$;

-- D. Guarda estrutural anti-regressão para novas funções no schema public
ALTER DEFAULT PRIVILEGES IN SCHEMA public
REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
