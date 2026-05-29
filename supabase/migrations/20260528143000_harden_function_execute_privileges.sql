-- Harden direct RPC/function execution privileges.
-- Tables already rely on RLS; this migration makes function access explicit too.

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from authenticated;

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from authenticated;

grant execute on function public.get_patient_registration_form(text, text) to anon, authenticated;
grant execute on function public.submit_patient_registration_form(text, text, jsonb) to anon, authenticated;

grant execute on function public.can_insert_session(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_read_session(uuid) to authenticated;
grant execute on function public.can_share_session(uuid) to authenticated;
grant execute on function public.cleanup_user_security_sessions(uuid, interval, interval) to authenticated;
grant execute on function public.create_clinic_subaccount(text, text, text, operational_role_type, text, text, uuid) to authenticated;
grant execute on function public.create_patient_registration_link(uuid) to authenticated;
grant execute on function public.current_user_can(text, uuid) to authenticated;
grant execute on function public.current_user_is_clinic_manager(uuid) to authenticated;
grant execute on function public.end_clinic_user_security_sessions(uuid, uuid) to authenticated;
grant execute on function public.end_current_security_session(text) to authenticated;
grant execute on function public.end_other_security_sessions(text) to authenticated;
grant execute on function public.ensure_team_development_profile(uuid, uuid) to authenticated;
grant execute on function public.get_clinic_share_collaborators(uuid) to authenticated;
grant execute on function public.get_session_share_recipients(uuid) to authenticated;
grant execute on function public.get_session_share_summary(uuid[]) to authenticated;
grant execute on function public.get_user_clinic_id(uuid) to authenticated;
grant execute on function public.has_role(uuid, app_role) to authenticated;
grant execute on function public.is_active_clinic_member(uuid, uuid) to authenticated;
grant execute on function public.log_security_event(uuid, uuid, uuid, text, text, jsonb) to authenticated;
grant execute on function public.register_current_security_session(text, text, text, text, text) to authenticated;
grant execute on function public.revoke_session_share(uuid, uuid) to authenticated;
grant execute on function public.share_sessions_with_collaborators(uuid[], uuid[]) to authenticated;
grant execute on function public.update_clinic_subaccount(uuid, text, text, text, text, text, text, text, operational_role_type, membership_status_type, text, text) to authenticated;
grant execute on function public.update_clinic_subaccount_profile(uuid, text, text, text, text, date, text, text, text, text, text, text, jsonb, operational_role_type, membership_status_type, text) to authenticated;
grant execute on function public.update_current_profile(text, text, text, text, date, text, text, text, text, text, text, jsonb, text) to authenticated;
grant execute on function public.update_team_development_profile(uuid, text, text, text, text, date, date, boolean, boolean) to authenticated;
grant execute on function public.upsert_current_user_security_settings(boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.validate_user_clinic(uuid, text) to authenticated;

grant execute on function public.finalize_overdue_agenda_events(integer, text) to service_role;
