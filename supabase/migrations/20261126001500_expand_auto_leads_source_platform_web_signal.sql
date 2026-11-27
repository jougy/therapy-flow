-- Migration incremental (Expand & Contract, zero perda de dados):
-- Adiciona 'web_signal' ao CHECK de origem de platform_auto_leads para sinais públicos
-- minerados pela skill first-customer-finder (Pluri Fisio).

ALTER TABLE public.platform_auto_leads
  DROP CONSTRAINT IF EXISTS platform_auto_leads_source_platform_check;

ALTER TABLE public.platform_auto_leads
  ADD CONSTRAINT platform_auto_leads_source_platform_check
  CHECK (
    source_platform = ANY (ARRAY[
      'facebook_group'::text,
      'instagram'::text,
      'google_maps'::text,
      'lindy_agent'::text,
      'apify_direct'::text,
      'csv_import'::text,
      'whatsapp_inbound'::text,
      'web_signal'::text
    ])
  );
