ALTER TABLE public.sessions
DROP CONSTRAINT IF EXISTS sessions_amount_charged_cents_reasonable;

ALTER TABLE public.sessions
ADD CONSTRAINT sessions_amount_charged_cents_reasonable
CHECK (amount_charged_cents BETWEEN 0 AND 10000000);

ALTER TABLE public.sessions
DROP CONSTRAINT IF EXISTS sessions_amount_paid_cents_reasonable;

ALTER TABLE public.sessions
ADD CONSTRAINT sessions_amount_paid_cents_reasonable
CHECK (amount_paid_cents BETWEEN 0 AND 10000000);

ALTER TABLE public.sessions
DROP CONSTRAINT IF EXISTS sessions_scheduled_start_at_reasonable;

ALTER TABLE public.sessions
ADD CONSTRAINT sessions_scheduled_start_at_reasonable
CHECK (
  scheduled_start_at IS NULL
  OR (
    scheduled_start_at >= timestamptz '2000-01-01 00:00:00+00'
    AND scheduled_start_at < timestamptz '2101-01-01 00:00:00+00'
  )
);

ALTER TABLE public.sessions
DROP CONSTRAINT IF EXISTS sessions_patient_arrived_at_reasonable;

ALTER TABLE public.sessions
ADD CONSTRAINT sessions_patient_arrived_at_reasonable
CHECK (
  patient_arrived_at IS NULL
  OR (
    patient_arrived_at >= timestamptz '2000-01-01 00:00:00+00'
    AND patient_arrived_at < timestamptz '2101-01-01 00:00:00+00'
  )
);
