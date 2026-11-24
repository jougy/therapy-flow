-- Migration: Mover extensão pg_trgm para schema extensions (0014_extension_in_public)
-- e documentar bloqueio intencional de public.global_word_telemetry (0008_rls_enabled_no_policy)

ALTER EXTENSION pg_trgm SET SCHEMA extensions;

REVOKE ALL ON TABLE public.global_word_telemetry FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.global_word_telemetry IS
  'RLS habilitado sem policies de forma intencional (deny-all via PostgREST API). Alimentada exclusivamente pela trigger SECURITY DEFINER public.handle_clinic_word_telemetry() e consultas service_role.';
