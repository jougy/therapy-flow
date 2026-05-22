ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz,
ADD COLUMN IF NOT EXISTS patient_arrived_at timestamptz,
ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'nao_cobrado',
ADD COLUMN IF NOT EXISTS amount_charged_cents integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS amount_paid_cents integer NOT NULL DEFAULT 0;

ALTER TABLE public.sessions
DROP CONSTRAINT IF EXISTS sessions_payment_status_check;

ALTER TABLE public.sessions
ADD CONSTRAINT sessions_payment_status_check
CHECK (payment_status IN ('nao_cobrado', 'pendente', 'parcial', 'pago', 'credito', 'cortesia'));

ALTER TABLE public.sessions
DROP CONSTRAINT IF EXISTS sessions_amount_charged_cents_nonnegative;

ALTER TABLE public.sessions
ADD CONSTRAINT sessions_amount_charged_cents_nonnegative
CHECK (amount_charged_cents >= 0);

ALTER TABLE public.sessions
DROP CONSTRAINT IF EXISTS sessions_amount_paid_cents_nonnegative;

ALTER TABLE public.sessions
ADD CONSTRAINT sessions_amount_paid_cents_nonnegative
CHECK (amount_paid_cents >= 0);

CREATE INDEX IF NOT EXISTS idx_sessions_scheduled_start_at ON public.sessions(scheduled_start_at);
CREATE INDEX IF NOT EXISTS idx_sessions_payment_status ON public.sessions(payment_status);
