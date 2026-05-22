ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS payment_installments smallint NOT NULL DEFAULT 1;

ALTER TABLE public.sessions
DROP CONSTRAINT IF EXISTS sessions_payment_installments_range;

ALTER TABLE public.sessions
ADD CONSTRAINT sessions_payment_installments_range
CHECK (payment_installments BETWEEN 1 AND 12);
