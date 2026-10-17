-- Migration: 20261017094500_agenda_reminders_and_sound_tones.sql
-- Description:
-- 1. Adiciona suporte a múltiplos lembretes e notificações em agenda_events:
--    - reminder_configs: array jsonb de configurações de lembrete
--    - notify_team: flag indicando se a equipe deve ser notificada
--    - notify_patient: flag indicando se o paciente deve ser notificado
--    - notified_colleague_ids: array de UUIDs de colegas notificados
-- 2. Atualiza constraint de sound_key em notification_preferences para suportar os 6 tons sonoros:
--    'soft' (Campanela Zen), 'cute' (Gota Suave), 'chime' (Marimba Clínica),
--    'pulse' (Pulso Duplo), 'urgent_alarm' (Alarme Clínico), 'siren' (Sirene de Urgência)

-- ==============================================================================
-- 1. COLUNAS EM public.agenda_events
-- ==============================================================================

ALTER TABLE public.agenda_events
  ADD COLUMN IF NOT EXISTS reminder_configs jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS notify_team boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS notify_patient boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS notified_colleague_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL;

-- ==============================================================================
-- 2. CONSTRAINT DE SOUND_KEY EM public.notification_preferences (6 TONS)
-- ==============================================================================

ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_sound_key_check;

ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_sound_key_check
  CHECK (sound_key IN ('soft', 'cute', 'chime', 'pulse', 'urgent_alarm', 'siren'));

-- ==============================================================================
-- 3. RPC update_current_user_notification_preferences (SEM OVERLOAD)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.update_current_user_notification_preferences(
  _sound_mode text DEFAULT NULL::text,
  _sound_key text DEFAULT NULL::text,
  _notify_security boolean DEFAULT NULL::boolean,
  _notify_clinic_access boolean DEFAULT NULL::boolean,
  -- Parameter list matches existing signature exactly to prevent PGRST203 overload
  _notify_patient_saved boolean DEFAULT NULL::boolean,
  _notify_session_activity boolean DEFAULT NULL::boolean,
  _notify_event_reminders boolean DEFAULT NULL::boolean,
  _notify_system boolean DEFAULT NULL::boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  PERFORM public.ensure_notification_preferences(_user_id);

  UPDATE public.notification_preferences
  SET
    sound_mode = COALESCE(_sound_mode, sound_mode),
    sound_key = COALESCE(_sound_key, sound_key),
    notify_security = COALESCE(_notify_security, notify_security),
    notify_clinic_access = COALESCE(_notify_clinic_access, notify_clinic_access),
    notify_patient_saved = COALESCE(_notify_patient_saved, notify_patient_saved),
    notify_session_activity = COALESCE(_notify_session_activity, notify_session_activity),
    notify_event_reminders = COALESCE(_notify_event_reminders, notify_event_reminders),
    notify_system = COALESCE(_notify_system, notify_system)
  WHERE user_id = _user_id;

  RETURN jsonb_build_object('status', 'updated');
END;
$$;
