-- Update check constraint on notification_preferences to accommodate all 6 synthesized sound keys
ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_sound_key_check;

ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_sound_key_check
  CHECK (sound_key IN ('soft', 'cute', 'chime', 'pulse', 'urgent_alarm', 'siren'));
