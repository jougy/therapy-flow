ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS recurring_weekdays integer[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS recurring_time text NOT NULL DEFAULT '09:00';

UPDATE public.patients
SET
  recurring_weekdays = coalesce(recurring_weekdays, '{}'),
  recurring_time = coalesce(nullif(trim(recurring_time), ''), '09:00');

ALTER TABLE public.patients
DROP CONSTRAINT IF EXISTS patients_recurring_weekdays_valid,
DROP CONSTRAINT IF EXISTS patients_recurring_time_valid;

ALTER TABLE public.patients
ADD CONSTRAINT patients_recurring_weekdays_valid
  CHECK (
    cardinality(recurring_weekdays) <= 7
    AND recurring_weekdays <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::integer[]
  );

ALTER TABLE public.patients
ADD CONSTRAINT patients_recurring_time_valid
CHECK (recurring_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE public.agenda_events
ADD COLUMN IF NOT EXISTS generated_by_recurring_patient boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_patients_recurrence
ON public.patients (clinic_id, is_recurring)
WHERE is_recurring = true;

CREATE INDEX IF NOT EXISTS idx_agenda_events_generated_recurrence
ON public.agenda_events (patient_id, scheduled_for)
WHERE generated_by_recurring_patient = true;
