-- Migration: Corrigir search_path mutável nas 14 funções sinalizadas pelo Supabase Advisor (0011_function_search_path_mutable)

-- 1. generate_uuidv7() usa gen_random_bytes(16) da extensão pgcrypto (schema extensions)
CREATE OR REPLACE FUNCTION public.generate_uuidv7()
RETURNS uuid
LANGUAGE plpgsql
PARALLEL SAFE
SET search_path TO ''
AS $function$
DECLARE
  unix_time_ms bigint;
  uuid_bytes bytea;
BEGIN
  unix_time_ms := (extract(epoch FROM pg_catalog.clock_timestamp()) * 1000)::bigint;

  uuid_bytes := pg_catalog.set_byte(
    pg_catalog.set_byte(
      extensions.gen_random_bytes(16),
      0, (unix_time_ms >> 40)::int
    ),
    1, (unix_time_ms >> 32)::int
  );
  uuid_bytes := pg_catalog.set_byte(uuid_bytes, 2, (unix_time_ms >> 24)::int);
  uuid_bytes := pg_catalog.set_byte(uuid_bytes, 3, (unix_time_ms >> 16)::int);
  uuid_bytes := pg_catalog.set_byte(uuid_bytes, 4, (unix_time_ms >> 8)::int);
  uuid_bytes := pg_catalog.set_byte(uuid_bytes, 5, unix_time_ms::int);

  -- Versão 7 nos bits 48-51
  uuid_bytes := pg_catalog.set_byte(uuid_bytes, 6, (pg_catalog.get_byte(uuid_bytes, 6) & 15) | 112);
  -- Variante RFC 4122/9562 nos bits 64-65
  uuid_bytes := pg_catalog.set_byte(uuid_bytes, 8, (pg_catalog.get_byte(uuid_bytes, 8) & 63) | 128);

  RETURN pg_catalog.encode(uuid_bytes, 'hex')::uuid;
END;
$function$;

-- 2-14. Demais 13 funções (idempotente via to_regprocedure)
DO $$
DECLARE
  _sig text;
  _sigs text[] := ARRAY[
    'public.raise_exception_json(text)',
    'public.set_updated_at()',
    'public.set_clinic_subscriptions_updated_at()',
    'public.slugify_text(text)',
    'public.generate_next_patient_code(uuid)',
    'public.trg_auto_assign_patient_code()',
    'public.touch_platform_feedbacks_updated_at()',
    'public.calculate_community_template_fields_count()',
    'public.trg_increment_row_version()',
    'public.handle_whatsapp_chat_sessions_updated_at()',
    'public.handle_platform_onboarding_meetings_updated_at()',
    'public.prevent_signed_document_mutation()',
    'public.touch_storage_routing_updated_at()'
  ];
BEGIN
  FOREACH _sig IN ARRAY _sigs
  LOOP
    IF to_regprocedure(_sig) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = ''''', _sig);
    END IF;
  END LOOP;
END $$;
