-- Migration incremental: Garantir permissoes explicitas de execucao para RPCs de auditoria e administracao de plataforma
-- Permite que usuarios autenticados e service_role executem list_platform_audit_events e RPCs administrativas correlatas

GRANT EXECUTE ON FUNCTION public.list_platform_audit_events(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_platform_audit_events(uuid, integer) TO service_role;

GRANT EXECUTE ON FUNCTION public.list_platform_clinics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_platform_clinics() TO service_role;

GRANT EXECUTE ON FUNCTION public.get_platform_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_dashboard() TO service_role;

GRANT EXECUTE ON FUNCTION public.get_platform_clinic_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_clinic_detail(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_platform_clinic_detail_by_route_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_clinic_detail_by_route_key(text) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_platform_clinic_forms_summary_by_route_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_clinic_forms_summary_by_route_key(text) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_platform_person_detail(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_person_detail(text, uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.log_platform_audit_event(text, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_platform_audit_event(text, uuid, text, jsonb) TO service_role;

GRANT EXECUTE ON FUNCTION public.start_platform_clinic_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_platform_clinic_access(uuid, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.end_platform_clinic_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_platform_clinic_access() TO service_role;

GRANT EXECUTE ON FUNCTION public.is_platform_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_owner(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.is_platform_owner_mfa_verified(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_owner_mfa_verified(uuid) TO service_role;
