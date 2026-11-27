-- Onda 2: Schema privado app_private para global_word_telemetry (zera 0008) e helpers internos

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

-- 1. Mover global_word_telemetry para app_private (zera 0008_rls_enabled_no_policy)
ALTER TABLE public.global_word_telemetry SET SCHEMA app_private;

CREATE OR REPLACE FUNCTION public.handle_clinic_word_telemetry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private', 'pg_temp'
AS $function$
DECLARE
  v_global_count integer;
  v_already_exists boolean;
BEGIN
  IF NEW.word IS NULL OR length(trim(NEW.word)) < 3 THEN
    RETURN NEW;
  END IF;

  INSERT INTO app_private.global_word_telemetry (word, user_id, clinic_id)
  VALUES (lower(trim(NEW.word)), NEW.created_by, NEW.clinic_id)
  ON CONFLICT (word, user_id, clinic_id) DO NOTHING;

  SELECT COUNT(*) INTO v_global_count
  FROM app_private.global_word_telemetry
  WHERE word = lower(trim(NEW.word));

  IF v_global_count >= 10 THEN
    SELECT EXISTS(
      SELECT 1 FROM public.global_word_candidates WHERE word = lower(trim(NEW.word))
    ) INTO v_already_exists;

    IF NOT v_already_exists THEN
      INSERT INTO public.global_word_candidates (word, unique_users_count, status)
      VALUES (lower(trim(NEW.word)), v_global_count, 'pending')
      ON CONFLICT (word) DO UPDATE
      SET unique_users_count = EXCLUDED.unique_users_count;
    ELSE
      UPDATE public.global_word_candidates
      SET unique_users_count = v_global_count
      WHERE word = lower(trim(NEW.word));
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
