-- Migração incremental para conceder acesso de SELECT a administradores de plataforma na tabela clinics
-- Permite que o Backoffice Master (PlatformBillingMaster, etc.) liste clinicas e faça joins com clinic_subscriptions

DROP POLICY IF EXISTS "Platform admins podem ver todas as clinicas" ON public.clinics;

CREATE POLICY "Platform admins podem ver todas as clinicas"
  ON public.clinics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
        AND pa.is_active = true
    )
  );

COMMENT ON POLICY "Platform admins podem ver todas as clinicas" ON public.clinics IS 
  'Permite leitura irrestrita da tabela clinics para administradores ativos da plataforma (Backoffice Master).';
