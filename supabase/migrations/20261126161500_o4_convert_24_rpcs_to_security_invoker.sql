-- Onda 4: Conversão de 24 RPCs para SECURITY INVOKER (tabelas já protegidas por RLS)
DO $$
DECLARE
  _rec record;
  _targets text[] := ARRAY[
    'acknowledge_current_user_release_notes',
    'clear_current_user_notifications',
    'delete_current_user_notification',
    'get_current_user_pending_release_notes',
    'list_current_user_notifications',
    'toggle_community_template_like',
    'submit_user_platform_feedback',
    'get_user_active_governance',
    'get_session_share_recipients',
    'get_session_share_summary',
    'rpc_get_available_slots',
    'get_clinic_storage_usage',
    'get_clinic_feature_flags',
    'get_clinic_subscription_summary',
    'validate_subscription_coupon',
    'increment_community_template_import',
    'list_feature_flags',
    'upsert_feature_flag',
    'list_platform_audit_events',
    'log_platform_audit_event',
    'list_platform_error_logs',
    'list_platform_telemetry_events',
    'list_platform_user_telemetry_events',
    'revoke_user_punishment'
  ];
BEGIN
  FOR _rec IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname = ANY(_targets)
  LOOP
    EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER', _rec.sig);
  END LOOP;
END $$;
