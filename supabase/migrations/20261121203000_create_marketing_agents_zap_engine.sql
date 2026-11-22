-- Migration: 20261121203000_create_marketing_agents_zap_engine.sql
-- Description:
--   Cria a fundação multi-tenant do Pluri Zap Engine (Painel "Agentes" estilo Ninja Zap)
--   para o módulo de Marketing do Backoffice (/platform/marketing?subtab=agentes):
--   1. marketing_whatsapp_instances (Pool de instâncias Evolution API + saúde + warm-up)
--   2. marketing_ai_agents (Agentes IA Gemini + base de conhecimento + transbordo)
--   3. marketing_opt_outs (Bloqueio LGPD O(1) por telefone/hash)
--   4. marketing_zap_campaigns (Disparos segmentados com Spintax e budget_cap_cents bigint)
--   5. marketing_zap_dispatches (Fila idempotente com Jitter Gaussiano)
--   6. marketing_zap_conversations (CRM/Inbox ao vivo com modo AI vs Humano)
--   7. Índices parciais (deleted_at IS NULL / status = 'queued') e RLS multi-tenant estrita
--   8. Seeds idempotentes do chip dedicado (11) 96512-0431 e 2 agentes iniciais + feature flag

-- ==============================================================================
-- 1. TABELA: public.marketing_whatsapp_instances
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_scope text NOT NULL DEFAULT 'platform'
    CHECK (tenant_scope IN ('platform', 'clinic')),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT,
  instance_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  phone_e164 text NOT NULL,
  provider text NOT NULL DEFAULT 'evolution'
    CHECK (provider IN ('evolution')),
  role_type text NOT NULL DEFAULT 'marketing_automation'
    CHECK (role_type IN ('marketing_automation', 'warmup_pool', 'commercial_backup')),
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'qr_ready', 'connecting', 'connected', 'circuit_broken', 'banned')),
  health_score integer NOT NULL DEFAULT 100
    CHECK (health_score BETWEEN 0 AND 100),
  warmup_day integer NOT NULL DEFAULT 1
    CHECK (warmup_day >= 1),
  daily_limit integer NOT NULL DEFAULT 15
    CHECK (daily_limit >= 0),
  daily_sent_count integer NOT NULL DEFAULT 0
    CHECK (daily_sent_count >= 0),
  anti_ban_config jsonb NOT NULL DEFAULT '{"jitter_mean_sec":42,"jitter_stddev_sec":14,"block_size":15,"block_pause_min":3,"block_pause_max":8,"business_start":"08:30","business_end":"19:30","business_days":[1,2,3,4,5,6],"presence_typing":true,"debounce_sec":6,"circuit_breaker_error_pct":5,"auto_warmup":true,"validate_on_whatsapp":true}'::jsonb,
  last_connected_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT marketing_whatsapp_instances_scope_clinic_check CHECK (
    (tenant_scope = 'platform' AND clinic_id IS NULL)
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_marketing_wa_instances_active
  ON public.marketing_whatsapp_instances (tenant_scope, clinic_id, status)
  WHERE deleted_at IS NULL;

-- ==============================================================================
-- 2. TABELA: public.marketing_ai_agents
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_scope text NOT NULL DEFAULT 'platform'
    CHECK (tenant_scope IN ('platform', 'clinic')),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT,
  instance_id uuid REFERENCES public.marketing_whatsapp_instances(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  persona_role text NOT NULL DEFAULT 'sdr_qualifier',
  is_active boolean NOT NULL DEFAULT true,
  model_tier text NOT NULL DEFAULT 'gemini-4-hydrogen'
    CHECK (model_tier IN ('gemini-decision-1', 'gemini-3.5-flash-lite', 'gemini-4-hydrogen', 'gemma-4-local')),
  system_prompt text NOT NULL,
  knowledge_base text NOT NULL DEFAULT '',
  welcome_message text NOT NULL DEFAULT '',
  handoff_keywords text[] NOT NULL DEFAULT ARRAY['falar com humano', 'atendente', 'suporte', 'fechar plano'],
  handoff_phone text NOT NULL DEFAULT '5511980113936',
  max_chars_per_reply integer NOT NULL DEFAULT 450
    CHECK (max_chars_per_reply BETWEEN 80 AND 2000),
  debounce_seconds integer NOT NULL DEFAULT 6
    CHECK (debounce_seconds BETWEEN 0 AND 30),
  transcribe_audio boolean NOT NULL DEFAULT true,
  analyze_images boolean NOT NULL DEFAULT true,
  enable_semantic_cache boolean NOT NULL DEFAULT true,
  active_hours_window jsonb NOT NULL DEFAULT '{"start":"08:00","end":"21:00","days":[1,2,3,4,5,6],"after_hours_reply":"Olá! Recebemos sua mensagem e nossa equipe comercial retorna no próximo horário útil."}'::jsonb,
  total_conversations integer NOT NULL DEFAULT 0,
  total_handoffs integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT marketing_ai_agents_scope_clinic_check CHECK (
    (tenant_scope = 'platform' AND clinic_id IS NULL)
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_marketing_ai_agents_active
  ON public.marketing_ai_agents (tenant_scope, clinic_id, is_active)
  WHERE deleted_at IS NULL;

-- ==============================================================================
-- 3. TABELA: public.marketing_opt_outs
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_scope text NOT NULL DEFAULT 'platform'
    CHECK (tenant_scope IN ('platform', 'clinic')),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT,
  phone_e164 text NOT NULL,
  phone_hash text NOT NULL,
  reason text NOT NULL DEFAULT 'keyword_opt_out',
  source_channel text NOT NULL DEFAULT 'whatsapp_evolution',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_opt_outs_scope_clinic_check CHECK (
    (tenant_scope = 'platform' AND clinic_id IS NULL)
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_opt_outs_scope_phone
  ON public.marketing_opt_outs (
    tenant_scope,
    COALESCE(clinic_id, '00000000-0000-0000-0000-000000000000'::uuid),
    phone_e164
  );

-- ==============================================================================
-- 4. TABELA: public.marketing_zap_campaigns
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_zap_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_scope text NOT NULL DEFAULT 'platform'
    CHECK (tenant_scope IN ('platform', 'clinic')),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT,
  instance_id uuid REFERENCES public.marketing_whatsapp_instances(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.marketing_ai_agents(id) ON DELETE SET NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'circuit_broken')),
  audience_filter jsonb NOT NULL DEFAULT '{"min_score":70,"only_with_phone":true}'::jsonb,
  message_template text NOT NULL,
  enable_ai_spintax boolean NOT NULL DEFAULT true,
  active_hours_window jsonb NOT NULL DEFAULT '{"start":"08:30","end":"19:30","days":[1,2,3,4,5,6]}'::jsonb,
  budget_cap_cents bigint NOT NULL DEFAULT 0
    CHECK (budget_cap_cents >= 0),
  total_targets integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  replied_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  scheduled_for timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT marketing_zap_campaigns_scope_clinic_check CHECK (
    (tenant_scope = 'platform' AND clinic_id IS NULL)
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_marketing_zap_campaigns_active
  ON public.marketing_zap_campaigns (tenant_scope, clinic_id, status)
  WHERE deleted_at IS NULL;

-- ==============================================================================
-- 5. TABELA: public.marketing_zap_dispatches
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_zap_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_zap_campaigns(id) ON DELETE CASCADE,
  instance_id uuid REFERENCES public.marketing_whatsapp_instances(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.platform_auto_leads(id) ON DELETE SET NULL,
  phone_e164 text NOT NULL,
  step_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'replied', 'failed', 'blocked_optout')),
  rendered_body text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  error_message text,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_zap_dispatches_queue
  ON public.marketing_zap_dispatches (status, scheduled_for)
  WHERE status = 'queued';

-- ==============================================================================
-- 6. TABELA: public.marketing_zap_conversations
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_zap_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_scope text NOT NULL DEFAULT 'platform'
    CHECK (tenant_scope IN ('platform', 'clinic')),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT,
  instance_id uuid REFERENCES public.marketing_whatsapp_instances(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.marketing_ai_agents(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.platform_auto_leads(id) ON DELETE SET NULL,
  phone_e164 text NOT NULL,
  contact_name text NOT NULL DEFAULT 'Lead WhatsApp',
  clinic_or_origin text,
  gemini_interaction_id text,
  agent_mode text NOT NULL DEFAULT 'ai'
    CHECK (agent_mode IN ('ai', 'human', 'paused')),
  funnel_stage text NOT NULL DEFAULT 'lead'
    CHECK (funnel_stage IN ('lead', 'contacted', 'qualified', 'proposal', 'scheduled', 'won', 'opt_out')),
  intent_classification text,
  last_message_preview text,
  last_message_direction text NOT NULL DEFAULT 'inbound'
    CHECK (last_message_direction IN ('inbound', 'outbound')),
  unread_count integer NOT NULL DEFAULT 0,
  ai_turns_count integer NOT NULL DEFAULT 0,
  last_inbound_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT marketing_zap_conversations_scope_clinic_check CHECK (
    (tenant_scope = 'platform' AND clinic_id IS NULL)
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_marketing_zap_conversations_active
  ON public.marketing_zap_conversations (tenant_scope, clinic_id, funnel_stage, updated_at DESC)
  WHERE deleted_at IS NULL;

-- ==============================================================================
-- 7. TRIGGERS DE updated_at
-- ==============================================================================

DROP TRIGGER IF EXISTS trg_marketing_wa_instances_updated_at ON public.marketing_whatsapp_instances;
CREATE TRIGGER trg_marketing_wa_instances_updated_at
  BEFORE UPDATE ON public.marketing_whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_marketing_ai_agents_updated_at ON public.marketing_ai_agents;
CREATE TRIGGER trg_marketing_ai_agents_updated_at
  BEFORE UPDATE ON public.marketing_ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_marketing_zap_campaigns_updated_at ON public.marketing_zap_campaigns;
CREATE TRIGGER trg_marketing_zap_campaigns_updated_at
  BEFORE UPDATE ON public.marketing_zap_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_marketing_zap_conversations_updated_at ON public.marketing_zap_conversations;
CREATE TRIGGER trg_marketing_zap_conversations_updated_at
  BEFORE UPDATE ON public.marketing_zap_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) MULTI-TENANT
-- ==============================================================================

ALTER TABLE public.marketing_whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_opt_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_zap_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_zap_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_zap_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Marketing staff manage whatsapp instances" ON public.marketing_whatsapp_instances;
CREATE POLICY "Marketing staff manage whatsapp instances"
  ON public.marketing_whatsapp_instances
  FOR ALL
  TO authenticated
  USING (
    (
      tenant_scope = 'platform'
      AND (
        public.is_platform_owner((SELECT auth.uid()))
        OR public.is_platform_marketing((SELECT auth.uid()))
        OR public.has_platform_flag('marketing', (SELECT auth.uid()))
      )
    )
    OR (
      tenant_scope = 'clinic'
      AND clinic_id IS NOT NULL
      AND public.current_user_can('marketing.affiliates.manage', clinic_id)
    )
  )
  WITH CHECK (
    (
      tenant_scope = 'platform'
      AND (
        public.is_platform_owner((SELECT auth.uid()))
        OR public.is_platform_marketing((SELECT auth.uid()))
        OR public.has_platform_flag('marketing', (SELECT auth.uid()))
      )
    )
    OR (
      tenant_scope = 'clinic'
      AND clinic_id IS NOT NULL
      AND public.current_user_can('marketing.affiliates.manage', clinic_id)
    )
  );

DROP POLICY IF EXISTS "Marketing staff manage ai agents" ON public.marketing_ai_agents;
CREATE POLICY "Marketing staff manage ai agents"
  ON public.marketing_ai_agents
  FOR ALL
  TO authenticated
  USING (
    (
      tenant_scope = 'platform'
      AND (
        public.is_platform_owner((SELECT auth.uid()))
        OR public.is_platform_marketing((SELECT auth.uid()))
        OR public.has_platform_flag('marketing', (SELECT auth.uid()))
      )
    )
    OR (
      tenant_scope = 'clinic'
      AND clinic_id IS NOT NULL
      AND public.current_user_can('marketing.affiliates.manage', clinic_id)
    )
  )
  WITH CHECK (
    (
      tenant_scope = 'platform'
      AND (
        public.is_platform_owner((SELECT auth.uid()))
        OR public.is_platform_marketing((SELECT auth.uid()))
        OR public.has_platform_flag('marketing', (SELECT auth.uid()))
      )
    )
    OR (
      tenant_scope = 'clinic'
      AND clinic_id IS NOT NULL
      AND public.current_user_can('marketing.affiliates.manage', clinic_id)
    )
  );

DROP POLICY IF EXISTS "Marketing staff manage opt outs" ON public.marketing_opt_outs;
CREATE POLICY "Marketing staff manage opt outs"
  ON public.marketing_opt_outs
  FOR ALL
  TO authenticated
  USING (
    (
      tenant_scope = 'platform'
      AND (
        public.is_platform_owner((SELECT auth.uid()))
        OR public.is_platform_marketing((SELECT auth.uid()))
        OR public.has_platform_flag('marketing', (SELECT auth.uid()))
      )
    )
    OR (
      tenant_scope = 'clinic'
      AND clinic_id IS NOT NULL
      AND public.current_user_can('marketing.affiliates.manage', clinic_id)
    )
  )
  WITH CHECK (
    (
      tenant_scope = 'platform'
      AND (
        public.is_platform_owner((SELECT auth.uid()))
        OR public.is_platform_marketing((SELECT auth.uid()))
        OR public.has_platform_flag('marketing', (SELECT auth.uid()))
      )
    )
    OR (
      tenant_scope = 'clinic'
      AND clinic_id IS NOT NULL
      AND public.current_user_can('marketing.affiliates.manage', clinic_id)
    )
  );

DROP POLICY IF EXISTS "Marketing staff manage zap campaigns" ON public.marketing_zap_campaigns;
CREATE POLICY "Marketing staff manage zap campaigns"
  ON public.marketing_zap_campaigns
  FOR ALL
  TO authenticated
  USING (
    (
      tenant_scope = 'platform'
      AND (
        public.is_platform_owner((SELECT auth.uid()))
        OR public.is_platform_marketing((SELECT auth.uid()))
        OR public.has_platform_flag('marketing', (SELECT auth.uid()))
      )
    )
    OR (
      tenant_scope = 'clinic'
      AND clinic_id IS NOT NULL
      AND public.current_user_can('marketing.affiliates.manage', clinic_id)
    )
  )
  WITH CHECK (
    (
      tenant_scope = 'platform'
      AND (
        public.is_platform_owner((SELECT auth.uid()))
        OR public.is_platform_marketing((SELECT auth.uid()))
        OR public.has_platform_flag('marketing', (SELECT auth.uid()))
      )
    )
    OR (
      tenant_scope = 'clinic'
      AND clinic_id IS NOT NULL
      AND public.current_user_can('marketing.affiliates.manage', clinic_id)
    )
  );

DROP POLICY IF EXISTS "Marketing staff manage zap dispatches" ON public.marketing_zap_dispatches;
CREATE POLICY "Marketing staff manage zap dispatches"
  ON public.marketing_zap_dispatches
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.marketing_zap_campaigns c
      WHERE c.id = marketing_zap_dispatches.campaign_id
        AND (
          (
            c.tenant_scope = 'platform'
            AND (
              public.is_platform_owner((SELECT auth.uid()))
              OR public.is_platform_marketing((SELECT auth.uid()))
              OR public.has_platform_flag('marketing', (SELECT auth.uid()))
            )
          )
          OR (
            c.tenant_scope = 'clinic'
            AND c.clinic_id IS NOT NULL
            AND public.current_user_can('marketing.affiliates.manage', c.clinic_id)
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.marketing_zap_campaigns c
      WHERE c.id = marketing_zap_dispatches.campaign_id
        AND (
          (
            c.tenant_scope = 'platform'
            AND (
              public.is_platform_owner((SELECT auth.uid()))
              OR public.is_platform_marketing((SELECT auth.uid()))
              OR public.has_platform_flag('marketing', (SELECT auth.uid()))
            )
          )
          OR (
            c.tenant_scope = 'clinic'
            AND c.clinic_id IS NOT NULL
            AND public.current_user_can('marketing.affiliates.manage', c.clinic_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS "Marketing staff manage zap conversations" ON public.marketing_zap_conversations;
CREATE POLICY "Marketing staff manage zap conversations"
  ON public.marketing_zap_conversations
  FOR ALL
  TO authenticated
  USING (
    (
      tenant_scope = 'platform'
      AND (
        public.is_platform_owner((SELECT auth.uid()))
        OR public.is_platform_marketing((SELECT auth.uid()))
        OR public.has_platform_flag('marketing', (SELECT auth.uid()))
      )
    )
    OR (
      tenant_scope = 'clinic'
      AND clinic_id IS NOT NULL
      AND public.current_user_can('marketing.affiliates.manage', clinic_id)
    )
  )
  WITH CHECK (
    (
      tenant_scope = 'platform'
      AND (
        public.is_platform_owner((SELECT auth.uid()))
        OR public.is_platform_marketing((SELECT auth.uid()))
        OR public.has_platform_flag('marketing', (SELECT auth.uid()))
      )
    )
    OR (
      tenant_scope = 'clinic'
      AND clinic_id IS NOT NULL
      AND public.current_user_can('marketing.affiliates.manage', clinic_id)
    )
  );

-- ==============================================================================
-- 9. SEEDS IDEMPOTENTES: CHIP DEDICADO (11) 96512-0431 + 2 AGENTES + FEATURE FLAG
-- ==============================================================================

INSERT INTO public.marketing_whatsapp_instances (
  tenant_scope,
  clinic_id,
  instance_key,
  display_name,
  phone_e164,
  provider,
  role_type,
  status,
  health_score,
  warmup_day,
  daily_limit
)
VALUES (
  'platform',
  NULL,
  'pluri-mkt-5511965120431',
  'Chip Marketing Principal — (11) 96512-0431',
  '5511965120431',
  'evolution',
  'marketing_automation',
  'disconnected',
  100,
  1,
  15
)
ON CONFLICT (instance_key) DO NOTHING;

INSERT INTO public.marketing_ai_agents (
  tenant_scope,
  clinic_id,
  instance_id,
  name,
  slug,
  persona_role,
  is_active,
  model_tier,
  system_prompt,
  knowledge_base,
  welcome_message,
  handoff_keywords,
  handoff_phone,
  max_chars_per_reply,
  debounce_seconds
)
SELECT
  'platform',
  NULL,
  inst.id,
  'Agente SDR Pluri Fisio (Qualificação & Demo)',
  'sdr-pluri-fisio',
  'sdr_qualifier',
  true,
  'gemini-4-hydrogen',
  'Você é o consultor SDR oficial do Pluri Fisio / Pluri Health no WhatsApp. Seja cordial, direto e consultivo com fisioterapeutas, donos de clínica e estúdios de Pilates. Descubra o tamanho da equipe, dor principal (prontuário, agenda, repasses ou cobranças) e convide para uma demonstração rápida de 10 minutos. Nunca invente preços ou recursos inexistentes.',
  'Pluri Fisio: Prontuário eletrônico SOAP + Escala EVA + Estúdio de Demarcação de Imagens de Evolução + Agenda Multi-Turno + Termos com Assinatura Digital + WhatsApp Copiloto + Repasses financeiros para clínicas e autônomos. Teste gratuito disponível com link personalizado e suporte comercial pelo (11) 98011-3936.',
  'Olá {{primeiro_nome}}! Aqui é da equipe Pluri Fisio. Vi seu perfil e queria entender como está a organização da agenda e dos prontuários por aí hoje.',
  ARRAY['falar com humano', 'atendente', 'suporte', 'fechar plano', 'comercial'],
  '5511980113936',
  450,
  6
FROM public.marketing_whatsapp_instances inst
WHERE inst.instance_key = 'pluri-mkt-5511965120431'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.marketing_ai_agents (
  tenant_scope,
  clinic_id,
  instance_id,
  name,
  slug,
  persona_role,
  is_active,
  model_tier,
  system_prompt,
  knowledge_base,
  welcome_message,
  handoff_keywords,
  handoff_phone,
  max_chars_per_reply,
  debounce_seconds
)
SELECT
  'platform',
  NULL,
  inst.id,
  'Agente Triagem & Reativação Rápida',
  'triagem-reativacao-lite',
  'reactivation_triage',
  true,
  'gemini-3.5-flash-lite',
  'Você faz triagem rápida e reativação amigável de leads frios que já tiveram contato com o Pluri Fisio. Responda dúvidas objetivas em até 2 frases, confirme interesse e encaminhe leads quentes para demonstração. Se o lead pedir para sair ou não tiver interesse, despeça-se com respeito imediatamente.',
  'Retomada leve de contato para fisioterapeutas autônomos e estúdios de Pilates que buscam sair das planilhas e WhatsApp manual.',
  'Oi {{primeiro_nome}}, tudo bem? Passando rápido para saber se você ainda está avaliando um sistema para organizar prontuários e agenda.',
  ARRAY['falar com humano', 'atendente', 'agendar', 'demonstração'],
  '5511980113936',
  320,
  6
FROM public.marketing_whatsapp_instances inst
WHERE inst.instance_key = 'pluri-mkt-5511965120431'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.feature_flags (
  key,
  scope,
  clinic_id,
  tag_id,
  value,
  description,
  reason
)
SELECT
  'marketing_zap_engine',
  'global'::public.feature_flag_scope,
  NULL,
  NULL,
  'false'::jsonb,
  'Libera o painel de Agentes WhatsApp IA (Pluri Zap Engine) para clínicas no futuro.',
  'Fase 1 exclusiva no Backoffice (/platform/marketing?subtab=agentes)'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.feature_flags
  WHERE key = 'marketing_zap_engine'
    AND scope = 'global'::public.feature_flag_scope
    AND clinic_id IS NULL
    AND tag_id IS NULL
);
