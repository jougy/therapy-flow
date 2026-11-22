-- Migration: 20261122090000_create_marketing_zap_suite_16.sql
-- Description:
--   Expande o Pluri Zap Engine para a Suite 16 (Multi-LLM Gateway, Compaction,
--   ZapDefender, Turbo Filter, Audiência/Listas, Grupos, Warm-up Pools,
--   OmegaChat Mensagens/Gatilhos e TypeZap Bindings) de forma 100% incremental.

-- ==============================================================================
-- 1. TABELA: public.marketing_llm_providers
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_llm_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_scope text NOT NULL DEFAULT 'platform'
    CHECK (tenant_scope IN ('platform', 'clinic')),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  provider_type text NOT NULL
    CHECK (provider_type IN (
      'local_ollama',
      'opencode_free',
      'gemini',
      'gemma_cloud',
      'openai',
      'anthropic',
      'groq',
      'openrouter',
      'custom_openai'
    )),
  base_url text NOT NULL DEFAULT '',
  credential_alias text NOT NULL DEFAULT '',
  default_model text NOT NULL,
  cached_models_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_enabled boolean NOT NULL DEFAULT true,
  is_free_tier boolean NOT NULL DEFAULT false,
  disable_thinking_default boolean NOT NULL DEFAULT true,
  priority_order integer NOT NULL DEFAULT 10,
  daily_request_cap integer NOT NULL DEFAULT 5000
    CHECK (daily_request_cap >= 0),
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT marketing_llm_providers_scope_clinic_check CHECK (
    (tenant_scope = 'platform' AND clinic_id IS NULL)
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_marketing_llm_providers_active
  ON public.marketing_llm_providers (tenant_scope, clinic_id, is_enabled, priority_order)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_marketing_llm_providers_updated_at ON public.marketing_llm_providers;
CREATE TRIGGER trg_marketing_llm_providers_updated_at
  BEFORE UPDATE ON public.marketing_llm_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.marketing_llm_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Marketing staff manage llm providers" ON public.marketing_llm_providers;
CREATE POLICY "Marketing staff manage llm providers"
  ON public.marketing_llm_providers
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

INSERT INTO public.marketing_llm_providers (
  tenant_scope,
  clinic_id,
  name,
  slug,
  provider_type,
  base_url,
  credential_alias,
  default_model,
  is_enabled,
  is_free_tier,
  disable_thinking_default,
  priority_order
)
VALUES
  (
    'platform',
    NULL,
    'OpenCode Free (Zen)',
    'opencode-free',
    'opencode_free',
    'https://opencode.ai/zen/v1',
    'OPENCODE_API_KEY',
    'deepseek-v4.1-flash-free',
    true,
    true,
    true,
    1
  ),
  (
    'platform',
    NULL,
    'Google Gemini Flash Lite (Pulumi Padrão)',
    'gemini-flash-lite-default',
    'gemini',
    'https://generativelanguage.googleapis.com',
    'GEMINI_API_KEY',
    'gemini-2.5-flash-lite',
    true,
    true,
    true,
    2
  ),
  (
    'platform',
    NULL,
    'Gemma 4 Cloud (Sem Thinking)',
    'gemma4-cloud',
    'gemma_cloud',
    'https://generativelanguage.googleapis.com',
    'GEMINI_API_KEY',
    'gemma4:cloud',
    true,
    true,
    true,
    3
  ),
  (
    'platform',
    NULL,
    'Ollama Local (Este PC — 12GB VRAM)',
    'ollama-local',
    'local_ollama',
    'http://127.0.0.1:11434/v1',
    '',
    'gemma4:e4b',
    true,
    true,
    true,
    4
  ),
  (
    'platform',
    NULL,
    'Groq Ultrarrápido (Llama)',
    'groq-fast',
    'groq',
    'https://api.groq.com/openai/v1',
    'GROQ_API_KEY',
    'llama-3.1-8b-instant',
    true,
    true,
    true,
    5
  ),
  (
    'platform',
    NULL,
    'OpenAI GPT (BYOK)',
    'openai-gpt',
    'openai',
    'https://api.openai.com/v1',
    'OPENAI_API_KEY',
    'gpt-4.1-mini',
    true,
    false,
    true,
    6
  ),
  (
    'platform',
    NULL,
    'Anthropic Claude (BYOK)',
    'anthropic-claude',
    'anthropic',
    'https://api.anthropic.com',
    'ANTHROPIC_API_KEY',
    'claude-3-5-haiku-latest',
    true,
    false,
    true,
    7
  ),
  (
    'platform',
    NULL,
    'OpenRouter Free Models',
    'openrouter-free',
    'openrouter',
    'https://openrouter.ai/api/v1',
    'OPENROUTER_API_KEY',
    'meta-llama/llama-3.3-70b-instruct:free',
    true,
    true,
    true,
    8
  )
ON CONFLICT (slug) DO NOTHING;

-- ==============================================================================
-- 2. EXPANSÃO: public.marketing_ai_agents
-- ==============================================================================

ALTER TABLE public.marketing_ai_agents
  DROP CONSTRAINT IF EXISTS marketing_ai_agents_model_tier_check;

ALTER TABLE public.marketing_ai_agents
  ADD COLUMN IF NOT EXISTS llm_provider_id uuid REFERENCES public.marketing_llm_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS llm_model_id text,
  ADD COLUMN IF NOT EXISTS fallback_chain jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS temperature numeric(3,2) NOT NULL DEFAULT 0.55,
  ADD COLUMN IF NOT EXISTS disable_thinking boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS split_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS simulate_typing boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS audio_reply_mode text NOT NULL DEFAULT 'never',
  ADD COLUMN IF NOT EXISTS max_context_messages integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS auto_compact_context boolean NOT NULL DEFAULT true;

ALTER TABLE public.marketing_ai_agents
  DROP CONSTRAINT IF EXISTS marketing_ai_agents_audio_reply_mode_check;

ALTER TABLE public.marketing_ai_agents
  ADD CONSTRAINT marketing_ai_agents_audio_reply_mode_check
  CHECK (audio_reply_mode IN ('never', 'match_user', 'always_ptt'));

-- ==============================================================================
-- 3. EXPANSÃO: public.marketing_whatsapp_instances
-- ==============================================================================

ALTER TABLE public.marketing_whatsapp_instances
  DROP CONSTRAINT IF EXISTS marketing_whatsapp_instances_provider_check;

DO $$
DECLARE
  v_conname text;
BEGIN
  FOR v_conname IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.marketing_whatsapp_instances'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ~ '\mprovider\M'
  LOOP
    EXECUTE format('ALTER TABLE public.marketing_whatsapp_instances DROP CONSTRAINT IF EXISTS %I', v_conname);
  END LOOP;
END $$;

ALTER TABLE public.marketing_whatsapp_instances
  ADD CONSTRAINT marketing_whatsapp_instances_provider_check
  CHECK (provider IN ('evolution', 'android_bridge'));

ALTER TABLE public.marketing_whatsapp_instances
  ADD COLUMN IF NOT EXISTS pairing_code text,
  ADD COLUMN IF NOT EXISTS warmup_pool_id uuid,
  ADD COLUMN IF NOT EXISTS last_diagnostic_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_sent_lifetime integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_received_lifetime integer NOT NULL DEFAULT 0;

-- ==============================================================================
-- 4. EXPANSÃO: public.marketing_zap_conversations (Context Compaction)
-- ==============================================================================

ALTER TABLE public.marketing_zap_conversations
  ADD COLUMN IF NOT EXISTS rolling_summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS structured_facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS compacted_up_to_msg_id uuid,
  ADD COLUMN IF NOT EXISTS context_tokens_est integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS compaction_count integer NOT NULL DEFAULT 0;

-- ==============================================================================
-- 5. EXPANSÃO: public.marketing_zap_campaigns
-- ==============================================================================

ALTER TABLE public.marketing_zap_campaigns
  ADD COLUMN IF NOT EXISTS campaign_mode text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS instance_pool_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ADD COLUMN IF NOT EXISTS audience_list_id uuid,
  ADD COLUMN IF NOT EXISTS target_group_jids text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS media_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS require_turbo_filter boolean NOT NULL DEFAULT true;

ALTER TABLE public.marketing_zap_campaigns
  DROP CONSTRAINT IF EXISTS marketing_zap_campaigns_campaign_mode_check;

ALTER TABLE public.marketing_zap_campaigns
  ADD CONSTRAINT marketing_zap_campaigns_campaign_mode_check
  CHECK (campaign_mode IN ('standard', 'classic_fast', 'multi_chip', 'push_alert', 'group_broadcast'));

-- ==============================================================================
-- 6. TABELA: public.marketing_account_diagnostics (ZapDefender)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_account_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.marketing_whatsapp_instances(id) ON DELETE CASCADE,
  overall_score integer NOT NULL
    CHECK (overall_score BETWEEN 0 AND 100),
  risk_level text NOT NULL
    CHECK (risk_level IN ('safe', 'warning', 'high_risk')),
  metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_account_diagnostics_instance
  ON public.marketing_account_diagnostics (instance_id, created_at DESC);

ALTER TABLE public.marketing_account_diagnostics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Marketing staff manage account diagnostics" ON public.marketing_account_diagnostics;
CREATE POLICY "Marketing staff manage account diagnostics"
  ON public.marketing_account_diagnostics
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.marketing_whatsapp_instances i
      WHERE i.id = marketing_account_diagnostics.instance_id
        AND (
          (
            i.tenant_scope = 'platform'
            AND (
              public.is_platform_owner((SELECT auth.uid()))
              OR public.is_platform_marketing((SELECT auth.uid()))
              OR public.has_platform_flag('marketing', (SELECT auth.uid()))
            )
          )
          OR (
            i.tenant_scope = 'clinic'
            AND i.clinic_id IS NOT NULL
            AND public.current_user_can('marketing.affiliates.manage', i.clinic_id)
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.marketing_whatsapp_instances i
      WHERE i.id = marketing_account_diagnostics.instance_id
        AND (
          (
            i.tenant_scope = 'platform'
            AND (
              public.is_platform_owner((SELECT auth.uid()))
              OR public.is_platform_marketing((SELECT auth.uid()))
              OR public.has_platform_flag('marketing', (SELECT auth.uid()))
            )
          )
          OR (
            i.tenant_scope = 'clinic'
            AND i.clinic_id IS NOT NULL
            AND public.current_user_can('marketing.affiliates.manage', i.clinic_id)
          )
        )
    )
  );

-- ==============================================================================
-- 7. TABELA: public.marketing_number_validations (Turbo Filter)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_number_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_scope text NOT NULL DEFAULT 'platform'
    CHECK (tenant_scope IN ('platform', 'clinic')),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT,
  phone_e164 text NOT NULL,
  exists_on_whatsapp boolean NOT NULL DEFAULT false,
  whatsapp_jid text,
  verified_name text,
  checked_by_instance_id uuid REFERENCES public.marketing_whatsapp_instances(id) ON DELETE SET NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  CONSTRAINT marketing_number_validations_scope_clinic_check CHECK (
    (tenant_scope = 'platform' AND clinic_id IS NULL)
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_number_validations_unique
  ON public.marketing_number_validations (
    tenant_scope,
    COALESCE(clinic_id, '00000000-0000-0000-0000-000000000000'::uuid),
    phone_e164
  );

ALTER TABLE public.marketing_number_validations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Marketing staff manage number validations" ON public.marketing_number_validations;
CREATE POLICY "Marketing staff manage number validations"
  ON public.marketing_number_validations
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
-- 8. TABELAS: public.marketing_audience_lists & marketing_audience_contacts
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_audience_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_scope text NOT NULL DEFAULT 'platform'
    CHECK (tenant_scope IN ('platform', 'clinic')),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT,
  name text NOT NULL,
  source_type text NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'csv_import', 'txt_import', 'auto_lead', 'group_extract', 'whatsapp_contacts')),
  columns_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_count integer NOT NULL DEFAULT 0,
  valid_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT marketing_audience_lists_scope_clinic_check CHECK (
    (tenant_scope = 'platform' AND clinic_id IS NULL)
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_marketing_audience_lists_active
  ON public.marketing_audience_lists (tenant_scope, clinic_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_marketing_audience_lists_updated_at ON public.marketing_audience_lists;
CREATE TRIGGER trg_marketing_audience_lists_updated_at
  BEFORE UPDATE ON public.marketing_audience_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.marketing_audience_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Marketing staff manage audience lists" ON public.marketing_audience_lists;
CREATE POLICY "Marketing staff manage audience lists"
  ON public.marketing_audience_lists
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

CREATE TABLE IF NOT EXISTS public.marketing_audience_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.marketing_audience_lists(id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  contact_name text NOT NULL DEFAULT '',
  custom_vars jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_status text NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('pending', 'valid', 'invalid', 'opt_out')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_audience_contacts_list
  ON public.marketing_audience_contacts (list_id, validation_status);

ALTER TABLE public.marketing_audience_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Marketing staff manage audience contacts" ON public.marketing_audience_contacts;
CREATE POLICY "Marketing staff manage audience contacts"
  ON public.marketing_audience_contacts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.marketing_audience_lists l
      WHERE l.id = marketing_audience_contacts.list_id
        AND (
          (
            l.tenant_scope = 'platform'
            AND (
              public.is_platform_owner((SELECT auth.uid()))
              OR public.is_platform_marketing((SELECT auth.uid()))
              OR public.has_platform_flag('marketing', (SELECT auth.uid()))
            )
          )
          OR (
            l.tenant_scope = 'clinic'
            AND l.clinic_id IS NOT NULL
            AND public.current_user_can('marketing.affiliates.manage', l.clinic_id)
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.marketing_audience_lists l
      WHERE l.id = marketing_audience_contacts.list_id
        AND (
          (
            l.tenant_scope = 'platform'
            AND (
              public.is_platform_owner((SELECT auth.uid()))
              OR public.is_platform_marketing((SELECT auth.uid()))
              OR public.has_platform_flag('marketing', (SELECT auth.uid()))
            )
          )
          OR (
            l.tenant_scope = 'clinic'
            AND l.clinic_id IS NOT NULL
            AND public.current_user_can('marketing.affiliates.manage', l.clinic_id)
          )
        )
    )
  );

-- ==============================================================================
-- 9. TABELAS: public.marketing_whatsapp_groups & marketing_group_jobs
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_whatsapp_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_scope text NOT NULL DEFAULT 'platform'
    CHECK (tenant_scope IN ('platform', 'clinic')),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT,
  instance_id uuid NOT NULL REFERENCES public.marketing_whatsapp_instances(id) ON DELETE CASCADE,
  group_jid text NOT NULL,
  subject text NOT NULL DEFAULT '',
  participants_count integer NOT NULL DEFAULT 0,
  is_admin boolean NOT NULL DEFAULT false,
  invite_code text,
  participants_sample jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_whatsapp_groups_unique_instance_jid UNIQUE (instance_id, group_jid),
  CONSTRAINT marketing_whatsapp_groups_scope_clinic_check CHECK (
    (tenant_scope = 'platform' AND clinic_id IS NULL)
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_marketing_wa_groups_scope
  ON public.marketing_whatsapp_groups (tenant_scope, clinic_id, instance_id);

DROP TRIGGER IF EXISTS trg_marketing_whatsapp_groups_updated_at ON public.marketing_whatsapp_groups;
CREATE TRIGGER trg_marketing_whatsapp_groups_updated_at
  BEFORE UPDATE ON public.marketing_whatsapp_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.marketing_whatsapp_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Marketing staff manage whatsapp groups" ON public.marketing_whatsapp_groups;
CREATE POLICY "Marketing staff manage whatsapp groups"
  ON public.marketing_whatsapp_groups
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

CREATE TABLE IF NOT EXISTS public.marketing_group_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_scope text NOT NULL DEFAULT 'platform'
    CHECK (tenant_scope IN ('platform', 'clinic')),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT,
  instance_id uuid NOT NULL REFERENCES public.marketing_whatsapp_instances(id) ON DELETE CASCADE,
  group_jid text NOT NULL,
  job_type text NOT NULL
    CHECK (job_type IN ('extract_members', 'add_participants', 'remove_participants', 'broadcast_group')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'paused')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_group_jobs_scope_clinic_check CHECK (
    (tenant_scope = 'platform' AND clinic_id IS NULL)
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_marketing_group_jobs_queue
  ON public.marketing_group_jobs (tenant_scope, clinic_id, status, scheduled_for);

ALTER TABLE public.marketing_group_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Marketing staff manage group jobs" ON public.marketing_group_jobs;
CREATE POLICY "Marketing staff manage group jobs"
  ON public.marketing_group_jobs
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
-- 10. TABELAS: public.marketing_warmup_pools & marketing_warmup_sessions
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_warmup_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_scope text NOT NULL DEFAULT 'platform'
    CHECK (tenant_scope IN ('platform', 'clinic')),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT,
  name text NOT NULL,
  pool_mode text NOT NULL DEFAULT 'private_chips'
    CHECK (pool_mode IN ('private_chips', 'collaborative_optin')),
  invite_token text UNIQUE,
  daily_interactions_target integer NOT NULL DEFAULT 12
    CHECK (daily_interactions_target >= 1),
  enable_media boolean NOT NULL DEFAULT true,
  enable_audio_ptt boolean NOT NULL DEFAULT false,
  enable_reactions boolean NOT NULL DEFAULT true,
  enable_group_interactions boolean NOT NULL DEFAULT false,
  llm_provider_id uuid REFERENCES public.marketing_llm_providers(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT marketing_warmup_pools_scope_clinic_check CHECK (
    (tenant_scope = 'platform' AND clinic_id IS NULL)
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_marketing_warmup_pools_active
  ON public.marketing_warmup_pools (tenant_scope, clinic_id, is_active)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_marketing_warmup_pools_updated_at ON public.marketing_warmup_pools;
CREATE TRIGGER trg_marketing_warmup_pools_updated_at
  BEFORE UPDATE ON public.marketing_warmup_pools
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.marketing_warmup_pools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Marketing staff manage warmup pools" ON public.marketing_warmup_pools;
CREATE POLICY "Marketing staff manage warmup pools"
  ON public.marketing_warmup_pools
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

CREATE TABLE IF NOT EXISTS public.marketing_warmup_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.marketing_warmup_pools(id) ON DELETE CASCADE,
  sender_instance_id uuid NOT NULL REFERENCES public.marketing_whatsapp_instances(id) ON DELETE CASCADE,
  receiver_instance_id uuid NOT NULL REFERENCES public.marketing_whatsapp_instances(id) ON DELETE CASCADE,
  interaction_type text NOT NULL DEFAULT 'text_chat'
    CHECK (interaction_type IN ('text_chat', 'media_reply', 'audio_ptt', 'reaction', 'group_chat')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'replied', 'failed', 'skipped')),
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_warmup_sessions_pool
  ON public.marketing_warmup_sessions (pool_id, status, scheduled_for);

ALTER TABLE public.marketing_warmup_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Marketing staff manage warmup sessions" ON public.marketing_warmup_sessions;
CREATE POLICY "Marketing staff manage warmup sessions"
  ON public.marketing_warmup_sessions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.marketing_warmup_pools p
      WHERE p.id = marketing_warmup_sessions.pool_id
        AND (
          (
            p.tenant_scope = 'platform'
            AND (
              public.is_platform_owner((SELECT auth.uid()))
              OR public.is_platform_marketing((SELECT auth.uid()))
              OR public.has_platform_flag('marketing', (SELECT auth.uid()))
            )
          )
          OR (
            p.tenant_scope = 'clinic'
            AND p.clinic_id IS NOT NULL
            AND public.current_user_can('marketing.affiliates.manage', p.clinic_id)
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.marketing_warmup_pools p
      WHERE p.id = marketing_warmup_sessions.pool_id
        AND (
          (
            p.tenant_scope = 'platform'
            AND (
              public.is_platform_owner((SELECT auth.uid()))
              OR public.is_platform_marketing((SELECT auth.uid()))
              OR public.has_platform_flag('marketing', (SELECT auth.uid()))
            )
          )
          OR (
            p.tenant_scope = 'clinic'
            AND p.clinic_id IS NOT NULL
            AND public.current_user_can('marketing.affiliates.manage', p.clinic_id)
          )
        )
    )
  );

-- ==============================================================================
-- 11. TABELAS: public.marketing_zap_messages & marketing_keyword_triggers (OmegaChat)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_zap_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.marketing_zap_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL
    CHECK (direction IN ('inbound', 'outbound')),
  sender_role text NOT NULL
    CHECK (sender_role IN ('lead', 'ai', 'human', 'flow', 'system')),
  message_type text NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'audio_ptt', 'document', 'video', 'sticker', 'system')),
  body_text text NOT NULL DEFAULT '',
  media_object_key text,
  provider_message_id text,
  model_used text,
  tokens_est integer NOT NULL DEFAULT 0,
  is_compacted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_zap_messages_conv
  ON public.marketing_zap_messages (conversation_id, created_at ASC);

ALTER TABLE public.marketing_zap_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Marketing staff manage zap messages" ON public.marketing_zap_messages;
CREATE POLICY "Marketing staff manage zap messages"
  ON public.marketing_zap_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.marketing_zap_conversations c
      WHERE c.id = marketing_zap_messages.conversation_id
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
      FROM public.marketing_zap_conversations c
      WHERE c.id = marketing_zap_messages.conversation_id
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

CREATE TABLE IF NOT EXISTS public.marketing_keyword_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_scope text NOT NULL DEFAULT 'platform'
    CHECK (tenant_scope IN ('platform', 'clinic')),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT,
  instance_id uuid REFERENCES public.marketing_whatsapp_instances(id) ON DELETE SET NULL,
  name text NOT NULL,
  match_type text NOT NULL DEFAULT 'contains'
    CHECK (match_type IN ('exact', 'contains', 'starts_with', 'regex')),
  pattern text NOT NULL,
  action_type text NOT NULL
    CHECK (action_type IN ('reply_text', 'reply_media', 'start_flow', 'switch_agent', 'handoff_human', 'move_stage')),
  action_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT marketing_keyword_triggers_scope_clinic_check CHECK (
    (tenant_scope = 'platform' AND clinic_id IS NULL)
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_marketing_keyword_triggers_active
  ON public.marketing_keyword_triggers (tenant_scope, clinic_id, is_active, priority)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_marketing_keyword_triggers_updated_at ON public.marketing_keyword_triggers;
CREATE TRIGGER trg_marketing_keyword_triggers_updated_at
  BEFORE UPDATE ON public.marketing_keyword_triggers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.marketing_keyword_triggers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Marketing staff manage keyword triggers" ON public.marketing_keyword_triggers;
CREATE POLICY "Marketing staff manage keyword triggers"
  ON public.marketing_keyword_triggers
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
-- 12. TABELA: public.marketing_typebot_bindings (TypeZap)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_typebot_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_scope text NOT NULL DEFAULT 'platform'
    CHECK (tenant_scope IN ('platform', 'clinic')),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT,
  instance_id uuid REFERENCES public.marketing_whatsapp_instances(id) ON DELETE SET NULL,
  name text NOT NULL,
  typebot_base_url text NOT NULL DEFAULT '',
  typebot_public_id text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'keyword'
    CHECK (trigger_type IN ('all', 'keyword')),
  trigger_operator text NOT NULL DEFAULT 'contains',
  trigger_value text NOT NULL DEFAULT '',
  delay_message_ms integer NOT NULL DEFAULT 1200,
  simulate_typing boolean NOT NULL DEFAULT true,
  simulate_recording boolean NOT NULL DEFAULT true,
  debounce_seconds integer NOT NULL DEFAULT 8,
  keyword_finish text NOT NULL DEFAULT '#sair',
  clone_source_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT marketing_typebot_bindings_scope_clinic_check CHECK (
    (tenant_scope = 'platform' AND clinic_id IS NULL)
    OR (tenant_scope = 'clinic' AND clinic_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_marketing_typebot_bindings_active
  ON public.marketing_typebot_bindings (tenant_scope, clinic_id, is_active)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_marketing_typebot_bindings_updated_at ON public.marketing_typebot_bindings;
CREATE TRIGGER trg_marketing_typebot_bindings_updated_at
  BEFORE UPDATE ON public.marketing_typebot_bindings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.marketing_typebot_bindings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Marketing staff manage typebot bindings" ON public.marketing_typebot_bindings;
CREATE POLICY "Marketing staff manage typebot bindings"
  ON public.marketing_typebot_bindings
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
-- 13. FEATURE FLAG: marketing_zap_suite_16
-- ==============================================================================

DO $$
BEGIN
  IF to_regclass('public.feature_flags') IS NOT NULL THEN
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
      'marketing_zap_suite_16',
      'global'::public.feature_flag_scope,
      NULL,
      NULL,
      'false'::jsonb,
      'Habilita a Suite 16 do Pluri Zap Engine (Multi-LLM, ZapDefender, Turbo Filter, Warm-up Pools, Grupos e TypeZap).',
      'Rollout controlado da Suite 16 no Backoffice (/platform/marketing?subtab=agentes)'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.feature_flags
      WHERE key = 'marketing_zap_suite_16'
        AND scope = 'global'::public.feature_flag_scope
        AND clinic_id IS NULL
        AND tag_id IS NULL
    );
  END IF;
END $$;
