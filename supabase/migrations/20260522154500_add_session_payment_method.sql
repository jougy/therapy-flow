ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'nao_informado';

ALTER TABLE public.sessions
DROP CONSTRAINT IF EXISTS sessions_payment_method_check;

ALTER TABLE public.sessions
ADD CONSTRAINT sessions_payment_method_check
CHECK (
  payment_method IN (
    'dinheiro',
    'pix',
    'cartao_debito',
    'cartao_credito',
    'convenio',
    'transferencia',
    'credito_usado',
    'cortesia',
    'nao_informado'
  )
);

CREATE INDEX IF NOT EXISTS idx_sessions_payment_method
ON public.sessions(payment_method);
