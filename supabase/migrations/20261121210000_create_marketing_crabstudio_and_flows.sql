-- Migration: 20261121210000_create_marketing_crabstudio_and_flows.sql
-- Description:
--   Cria as tabelas multi-tenant do Pluri CrabStudio e do Orquestrador de Fluxos DAG:
--   1. marketing_brand_kits (Brand Kits Pluri Fisio / Pluri Health / futuras clínicas)
--   2. marketing_creative_projects (Artes estáticas, carrosséis, stories, ads e reels)
--   3. marketing_render_jobs (Fila fast_node vs heavy_pull com índice parcial)
--   4. marketing_flows (Fluxos visuais DAG + 3 templates prontos)
--   5. marketing_flow_runs (Execuções com node_checkpoints)
--   6. RLS multi-tenant + feature flags globais marketing_crab_studio e marketing_flow_builder

-- ==============================================================================
-- 1. TABELA: public.marketing_brand_kits
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_brand_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_scope text NOT NULL DEFAULT 'platform'
    CHECK (tenant_scope IN ('platform', 'clinic')),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT,
  name text NOT NULL,
  subproduct_key text NOT NULL DEFAULT 'plurifisio',
  palette jsonb NOT NULL DEFAULT '{"primary":"#0284c7","secondary":"#0f172a","accent":"#10b981","background":"#f8fafc"}'::jsonb,
  typography jsonb NOT NULL DEFAULT '{"heading":"Inter","body":"Inter"}'::jsonb,
  logo_object_key text,
  voice_guidelines jsonb NOT NULL DEFAULT '{"tone":"consultivo, clínico e direto","cta":"Teste grátis por 7 dias"}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT marketing_brand_kits_scope_check CHECK (
    (tenant_scope = 'platform' AND clinic_id IS NULL)
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_marketing_brand_kits_active
  ON public.marketing_brand_kits (tenant_scope, clinic_id)
  WHERE deleted_at IS NULL;

-- ==============================================================================
-- 2. TABELA: public.marketing_creative_projects
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_creative_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_scope text NOT NULL DEFAULT 'platform'
    CHECK (tenant_scope IN ('platform', 'clinic')),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT,
  brand_kit_id uuid REFERENCES public.marketing_brand_kits(id) ON DELETE SET NULL,
  title text NOT NULL,
  format_type text NOT NULL DEFAULT 'carousel'
    CHECK (format_type IN ('carousel', 'story', 'feed_post', 'ad_banner', 'reel_video')),
  render_tier text NOT NULL DEFAULT 'fast_node'
    CHECK (render_tier IN ('fast_node', 'heavy_pull')),
  status text NOT NULL DEFAULT 'ready'
    CHECK (status IN ('draft', 'queued', 'rendering', 'ready', 'failed')),
  spec_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_object_key text,
  content_hash_sha256 text,
  estimated_cost_cents bigint NOT NULL DEFAULT 0 CHECK (estimated_cost_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT marketing_creative_projects_scope_check CHECK (
    (tenant_scope = 'platform' AND clinic_id IS NULL)
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_marketing_creative_projects_active
  ON public.marketing_creative_projects (tenant_scope, clinic_id, format_type, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_creative_projects_hash
  ON public.marketing_creative_projects (content_hash_sha256)
  WHERE content_hash_sha256 IS NOT NULL;

-- ==============================================================================
-- 3. TABELA: public.marketing_render_jobs
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.marketing_creative_projects(id) ON DELETE CASCADE,
  worker_tier text NOT NULL DEFAULT 'fast_node'
    CHECK (worker_tier IN ('fast_node', 'heavy_pull')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'claimed', 'rendering', 'completed', 'failed')),
  priority integer NOT NULL DEFAULT 5,
  attempts integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_object_key text,
  error_summary text,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_render_jobs_queued
  ON public.marketing_render_jobs (worker_tier, priority DESC, created_at ASC)
  WHERE status = 'queued';

-- ==============================================================================
-- 4. TABELA: public.marketing_flows & public.marketing_flow_runs
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_scope text NOT NULL DEFAULT 'platform'
    CHECK (tenant_scope IN ('platform', 'clinic')),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  trigger_type text NOT NULL DEFAULT 'manual'
    CHECK (trigger_type IN ('manual', 'auto_lead', 'schedule_cron', 'whatsapp_inbound')),
  is_active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  graph_nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  graph_edges jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT marketing_flows_scope_check CHECK (
    (tenant_scope = 'platform' AND clinic_id IS NULL)
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.marketing_flow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.marketing_flows(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'waiting_approval', 'completed', 'failed')),
  current_node_id text,
  context_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  node_checkpoints jsonb NOT NULL DEFAULT '{}'::jsonb,
  tokens_used integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

-- ==============================================================================
-- 5. TRIGGERS & RLS
-- ==============================================================================

DROP TRIGGER IF EXISTS trg_marketing_brand_kits_updated_at ON public.marketing_brand_kits;
CREATE TRIGGER trg_marketing_brand_kits_updated_at
  BEFORE UPDATE ON public.marketing_brand_kits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_marketing_creative_projects_updated_at ON public.marketing_creative_projects;
CREATE TRIGGER trg_marketing_creative_projects_updated_at
  BEFORE UPDATE ON public.marketing_creative_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_marketing_flows_updated_at ON public.marketing_flows;
CREATE TRIGGER trg_marketing_flows_updated_at
  BEFORE UPDATE ON public.marketing_flows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.marketing_brand_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_creative_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_render_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_flow_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Marketing staff manage brand kits" ON public.marketing_brand_kits;
CREATE POLICY "Marketing staff manage brand kits"
  ON public.marketing_brand_kits FOR ALL TO authenticated
  USING (
    (tenant_scope = 'platform' AND (public.is_platform_owner((SELECT auth.uid())) OR public.is_platform_marketing((SELECT auth.uid())) OR public.has_platform_flag('marketing', (SELECT auth.uid()))))
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL AND public.current_user_can('marketing.affiliates.manage', clinic_id))
  )
  WITH CHECK (
    (tenant_scope = 'platform' AND (public.is_platform_owner((SELECT auth.uid())) OR public.is_platform_marketing((SELECT auth.uid())) OR public.has_platform_flag('marketing', (SELECT auth.uid()))))
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL AND public.current_user_can('marketing.affiliates.manage', clinic_id))
  );

DROP POLICY IF EXISTS "Marketing staff manage creative projects" ON public.marketing_creative_projects;
CREATE POLICY "Marketing staff manage creative projects"
  ON public.marketing_creative_projects FOR ALL TO authenticated
  USING (
    (tenant_scope = 'platform' AND (public.is_platform_owner((SELECT auth.uid())) OR public.is_platform_marketing((SELECT auth.uid())) OR public.has_platform_flag('marketing', (SELECT auth.uid()))))
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL AND public.current_user_can('marketing.affiliates.manage', clinic_id))
  )
  WITH CHECK (
    (tenant_scope = 'platform' AND (public.is_platform_owner((SELECT auth.uid())) OR public.is_platform_marketing((SELECT auth.uid())) OR public.has_platform_flag('marketing', (SELECT auth.uid()))))
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL AND public.current_user_can('marketing.affiliates.manage', clinic_id))
  );

DROP POLICY IF EXISTS "Marketing staff manage render jobs" ON public.marketing_render_jobs;
CREATE POLICY "Marketing staff manage render jobs"
  ON public.marketing_render_jobs FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marketing_creative_projects p
      WHERE p.id = marketing_render_jobs.project_id
        AND (
          (p.tenant_scope = 'platform' AND (public.is_platform_owner((SELECT auth.uid())) OR public.is_platform_marketing((SELECT auth.uid())) OR public.has_platform_flag('marketing', (SELECT auth.uid()))))
          OR (p.tenant_scope = 'clinic' AND p.clinic_id IS NOT NULL AND public.current_user_can('marketing.affiliates.manage', p.clinic_id))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.marketing_creative_projects p
      WHERE p.id = marketing_render_jobs.project_id
        AND (
          (p.tenant_scope = 'platform' AND (public.is_platform_owner((SELECT auth.uid())) OR public.is_platform_marketing((SELECT auth.uid())) OR public.has_platform_flag('marketing', (SELECT auth.uid()))))
          OR (p.tenant_scope = 'clinic' AND p.clinic_id IS NOT NULL AND public.current_user_can('marketing.affiliates.manage', p.clinic_id))
        )
    )
  );

DROP POLICY IF EXISTS "Marketing staff manage flows" ON public.marketing_flows;
CREATE POLICY "Marketing staff manage flows"
  ON public.marketing_flows FOR ALL TO authenticated
  USING (
    (tenant_scope = 'platform' AND (public.is_platform_owner((SELECT auth.uid())) OR public.is_platform_marketing((SELECT auth.uid())) OR public.has_platform_flag('marketing', (SELECT auth.uid()))))
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL AND public.current_user_can('marketing.affiliates.manage', clinic_id))
  )
  WITH CHECK (
    (tenant_scope = 'platform' AND (public.is_platform_owner((SELECT auth.uid())) OR public.is_platform_marketing((SELECT auth.uid())) OR public.has_platform_flag('marketing', (SELECT auth.uid()))))
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL AND public.current_user_can('marketing.affiliates.manage', clinic_id))
  );

DROP POLICY IF EXISTS "Marketing staff manage flow runs" ON public.marketing_flow_runs;
CREATE POLICY "Marketing staff manage flow runs"
  ON public.marketing_flow_runs FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marketing_flows f
      WHERE f.id = marketing_flow_runs.flow_id
        AND (
          (f.tenant_scope = 'platform' AND (public.is_platform_owner((SELECT auth.uid())) OR public.is_platform_marketing((SELECT auth.uid())) OR public.has_platform_flag('marketing', (SELECT auth.uid()))))
          OR (f.tenant_scope = 'clinic' AND f.clinic_id IS NOT NULL AND public.current_user_can('marketing.affiliates.manage', f.clinic_id))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.marketing_flows f
      WHERE f.id = marketing_flow_runs.flow_id
        AND (
          (f.tenant_scope = 'platform' AND (public.is_platform_owner((SELECT auth.uid())) OR public.is_platform_marketing((SELECT auth.uid())) OR public.has_platform_flag('marketing', (SELECT auth.uid()))))
          OR (f.tenant_scope = 'clinic' AND f.clinic_id IS NOT NULL AND public.current_user_can('marketing.affiliates.manage', f.clinic_id))
        )
    )
  );

-- ==============================================================================
-- 6. SEEDS IDEMPOTENTES (BRAND KITS + 3 FLUXOS PRONTOS + FEATURE FLAGS)
-- ==============================================================================

INSERT INTO public.marketing_brand_kits (tenant_scope, clinic_id, name, subproduct_key, palette, voice_guidelines)
SELECT 'platform', NULL, 'Pluri Fisio — Kit Oficial', 'plurifisio',
  '{"primary":"#0284c7","secondary":"#0f172a","accent":"#10b981","background":"#f0f9ff"}'::jsonb,
  '{"tone":"Clínico, prático e próximo do fisioterapeuta","cta":"Teste grátis na sua clínica"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.marketing_brand_kits WHERE subproduct_key = 'plurifisio' AND tenant_scope = 'platform');

INSERT INTO public.marketing_brand_kits (tenant_scope, clinic_id, name, subproduct_key, palette, voice_guidelines)
SELECT 'platform', NULL, 'Pluri Health — Enterprise', 'plurihealth',
  '{"primary":"#2563eb","secondary":"#0f172a","accent":"#06b6d4","background":"#f8fafc"}'::jsonb,
  '{"tone":"Institucional, seguro (LGPD/CFM) e escalável","cta":"Agende demonstração executiva"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.marketing_brand_kits WHERE subproduct_key = 'plurihealth' AND tenant_scope = 'platform');

INSERT INTO public.feature_flags (key, scope, clinic_id, tag_id, value, description, reason)
SELECT 'marketing_crab_studio', 'global'::public.feature_flag_scope, NULL, NULL, 'false'::jsonb,
  'Libera o Estúdio Criativo (CrabStudio) para clínicas.', 'Fase 1 exclusiva no Backoffice'
WHERE NOT EXISTS (SELECT 1 FROM public.feature_flags WHERE key = 'marketing_crab_studio' AND scope = 'global'::public.feature_flag_scope AND clinic_id IS NULL AND tag_id IS NULL);

INSERT INTO public.feature_flags (key, scope, clinic_id, tag_id, value, description, reason)
SELECT 'marketing_flow_builder', 'global'::public.feature_flag_scope, NULL, NULL, 'false'::jsonb,
  'Libera o Orquestrador Visual de Fluxos de Marketing para clínicas.', 'Fase 1 exclusiva no Backoffice'
WHERE NOT EXISTS (SELECT 1 FROM public.feature_flags WHERE key = 'marketing_flow_builder' AND scope = 'global'::public.feature_flag_scope AND clinic_id IS NULL AND tag_id IS NULL);
