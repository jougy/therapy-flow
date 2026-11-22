-- Migration: 20261120211500_add_platform_admin_feature_flags.sql
-- Description:
--   Adiciona suporte a Feature Flags por conta do Backoffice em public.platform_admins:
--   1. Adiciona coluna feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb em public.platform_admins.
--   2. Cria função public.has_platform_flag(_flag text, _user_id uuid DEFAULT auth.uid()).
--   3. Atualiza policies e RPCs de Marketing e Agenda da migration
--      20261120205100_add_platform_marketing_role.sql para aceitar também
--      public.has_platform_flag('marketing', ...) e public.has_platform_flag('agenda', ...).
--   4. Cria RPC public.upsert_platform_admin_access(_target_user_id, _has_access, _feature_flags).
--   5. Atualiza o registro de comercial@plurifisio.com.br (se existir) com as flags padrão.

-- ==============================================================================
-- 1. COLUNA FEATURE_FLAGS EM public.platform_admins
-- ==============================================================================

ALTER TABLE public.platform_admins
  ADD COLUMN IF NOT EXISTS feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ==============================================================================
-- 2. FUNÇÃO AUXILIAR public.has_platform_flag
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.has_platform_flag(
  _flag text,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    public.is_platform_owner(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.platform_admins
      WHERE platform_admins.user_id = _user_id
        AND platform_admins.is_active = true
        AND coalesce((platform_admins.feature_flags ->> _flag)::boolean, false) = true
    );
$$;

REVOKE ALL ON FUNCTION public.has_platform_flag(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_platform_flag(text, uuid) TO authenticated, service_role;

-- ==============================================================================
-- 3. RLS: MARKETING AUTO-LEAD & WHATSAPP SESSIONS
-- ==============================================================================

DROP POLICY IF EXISTS "Platform admins manage platform_auto_lead_routines" ON public.platform_auto_lead_routines;
CREATE POLICY "Platform admins manage platform_auto_lead_routines"
  ON public.platform_auto_lead_routines
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
  )
  WITH CHECK (
    public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Platform admins manage platform_auto_lead_runs" ON public.platform_auto_lead_runs;
CREATE POLICY "Platform admins manage platform_auto_lead_runs"
  ON public.platform_auto_lead_runs
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
  )
  WITH CHECK (
    public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Platform admins manage platform_auto_leads" ON public.platform_auto_leads;
CREATE POLICY "Platform admins manage platform_auto_leads"
  ON public.platform_auto_leads
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
  )
  WITH CHECK (
    public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Platform admins podem visualizar whatsapp_chat_sessions" ON public.whatsapp_chat_sessions;
CREATE POLICY "Platform admins podem visualizar whatsapp_chat_sessions"
  ON public.whatsapp_chat_sessions
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
  );

-- ==============================================================================
-- 4. RLS: AGENDA DE REUNIÕES (PLATFORM ONBOARDING MEETINGS)
-- ==============================================================================

DROP POLICY IF EXISTS "Platform admins podem gerenciar platform_onboarding_meetings" ON public.platform_onboarding_meetings;
CREATE POLICY "Platform admins podem gerenciar platform_onboarding_meetings"
  ON public.platform_onboarding_meetings
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('agenda', (SELECT auth.uid()))
  )
  WITH CHECK (
    public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('agenda', (SELECT auth.uid()))
  );

-- ==============================================================================
-- 5. RLS: AFILIADOS, COMISSÕES, CONVERSÕES, CRM LOGS E CONVITES
-- ==============================================================================

DROP POLICY IF EXISTS "Users can read affiliates if owner, clinic admin or platform ad" ON public.affiliates;
CREATE POLICY "Users can read affiliates if owner, clinic admin or platform ad"
  ON public.affiliates
  FOR SELECT
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid()))
    OR (
      clinic_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1
          FROM public.clinic_memberships cm
          WHERE cm.clinic_id = affiliates.clinic_id
            AND cm.user_id = (SELECT auth.uid())
            AND cm.is_active = true
            AND cm.membership_status = 'active'::public.membership_status_type
            AND (
              cm.account_role = 'account_owner'::public.account_role_type
              OR cm.operational_role = ANY (ARRAY['owner'::public.operational_role_type, 'admin'::public.operational_role_type])
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.clinics c
          WHERE c.id = affiliates.clinic_id
            AND c.account_owner_user_id = (SELECT auth.uid())
        )
      )
    )
    OR public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Platform admins manage affiliates" ON public.affiliates;
CREATE POLICY "Platform admins manage affiliates"
  ON public.affiliates
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Affiliates and admins read commissions" ON public.affiliate_commissions;
CREATE POLICY "Affiliates and admins read commissions"
  ON public.affiliate_commissions
  FOR SELECT
  TO authenticated
  USING (
    (
      affiliate_id IN (
        SELECT a.id
        FROM public.affiliates a
        WHERE a.user_id = (SELECT auth.uid())
      )
    )
    OR public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Platform admins manage commissions" ON public.affiliate_commissions;
CREATE POLICY "Platform admins manage commissions"
  ON public.affiliate_commissions
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Affiliates and admins read conversions" ON public.affiliate_conversions;
CREATE POLICY "Affiliates and admins read conversions"
  ON public.affiliate_conversions
  FOR SELECT
  TO authenticated
  USING (
    (
      affiliate_id IN (
        SELECT a.id
        FROM public.affiliates a
        WHERE a.user_id = (SELECT auth.uid())
      )
    )
    OR public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Platform admins manage conversions" ON public.affiliate_conversions;
CREATE POLICY "Platform admins manage conversions"
  ON public.affiliate_conversions
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Affiliates and admins read crm logs" ON public.affiliate_crm_logs;
CREATE POLICY "Affiliates and admins read crm logs"
  ON public.affiliate_crm_logs
  FOR SELECT
  TO authenticated
  USING (
    (
      affiliate_id IN (
        SELECT a.id
        FROM public.affiliates a
        WHERE a.user_id = (SELECT auth.uid())
      )
    )
    OR public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Affiliates and admins insert crm logs" ON public.affiliate_crm_logs;
CREATE POLICY "Affiliates and admins insert crm logs"
  ON public.affiliate_crm_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      affiliate_id IN (
        SELECT a.id
        FROM public.affiliates a
        WHERE a.user_id = (SELECT auth.uid())
      )
    )
    OR public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Platform admins manage crm logs" ON public.affiliate_crm_logs;
CREATE POLICY "Platform admins manage crm logs"
  ON public.affiliate_crm_logs
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Invited users and managers read affiliate invitations" ON public.affiliate_invitations;
CREATE POLICY "Invited users and managers read affiliate invitations"
  ON public.affiliate_invitations
  FOR SELECT
  TO authenticated
  USING (
    (invited_user_id IS NOT NULL AND invited_user_id = (SELECT auth.uid()))
    OR (invited_email IS NOT NULL AND lower(invited_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))
    OR (
      clinic_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1
          FROM public.clinic_memberships cm
          WHERE cm.clinic_id = affiliate_invitations.clinic_id
            AND cm.user_id = (SELECT auth.uid())
            AND cm.is_active = true
            AND (
              cm.account_role = 'account_owner'::public.account_role_type
              OR cm.operational_role = ANY (ARRAY['owner'::public.operational_role_type, 'admin'::public.operational_role_type])
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.clinics c
          WHERE c.id = affiliate_invitations.clinic_id
            AND c.account_owner_user_id = (SELECT auth.uid())
        )
        OR public.current_user_can('marketing.affiliates.manage'::text, clinic_id)
        OR public.current_user_can('marketing.affiliates.view'::text, clinic_id)
      )
    )
    OR public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Managers and platform admins manage affiliate invitations" ON public.affiliate_invitations;
CREATE POLICY "Managers and platform admins manage affiliate invitations"
  ON public.affiliate_invitations
  FOR ALL
  TO authenticated
  USING (
    (
      clinic_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1
          FROM public.clinic_memberships cm
          WHERE cm.clinic_id = affiliate_invitations.clinic_id
            AND cm.user_id = (SELECT auth.uid())
            AND cm.is_active = true
            AND (
              cm.account_role = 'account_owner'::public.account_role_type
              OR cm.operational_role = ANY (ARRAY['owner'::public.operational_role_type, 'admin'::public.operational_role_type])
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.clinics c
          WHERE c.id = affiliate_invitations.clinic_id
            AND c.account_owner_user_id = (SELECT auth.uid())
        )
        OR public.current_user_can('marketing.affiliates.manage'::text, clinic_id)
      )
    )
    OR public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    (
      clinic_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1
          FROM public.clinic_memberships cm
          WHERE cm.clinic_id = affiliate_invitations.clinic_id
            AND cm.user_id = (SELECT auth.uid())
            AND cm.is_active = true
            AND (
              cm.account_role = 'account_owner'::public.account_role_type
              OR cm.operational_role = ANY (ARRAY['owner'::public.operational_role_type, 'admin'::public.operational_role_type])
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.clinics c
          WHERE c.id = affiliate_invitations.clinic_id
            AND c.account_owner_user_id = (SELECT auth.uid())
        )
        OR public.current_user_can('marketing.affiliates.manage'::text, clinic_id)
      )
    )
    OR public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing', (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

-- ==============================================================================
-- 6. RLS: GOVERNANCE RULES (CAMPANHAS SAZONAIS E TIERS DE AFILIADOS) E PROFILES
-- ==============================================================================

DROP POLICY IF EXISTS "Platform marketing can manage affiliate governance rules" ON public.governance_rules;
CREATE POLICY "Platform marketing can manage affiliate governance rules"
  ON public.governance_rules
  FOR ALL
  TO authenticated
  USING (
    (
      public.is_platform_marketing((SELECT auth.uid()))
      OR public.has_platform_flag('marketing', (SELECT auth.uid()))
    )
    AND key IN ('affiliate_tiers_config', 'affiliate_campaign_config')
  )
  WITH CHECK (
    (
      public.is_platform_marketing((SELECT auth.uid()))
      OR public.has_platform_flag('marketing', (SELECT auth.uid()))
    )
    AND key IN ('affiliate_tiers_config', 'affiliate_campaign_config')
  );

DROP POLICY IF EXISTS "Platform marketing reads affiliate and conversion profiles" ON public.profiles;
CREATE POLICY "Platform marketing reads affiliate and conversion profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    (
      public.is_platform_marketing((SELECT auth.uid()))
      OR public.has_platform_flag('marketing', (SELECT auth.uid()))
    )
    AND (
      EXISTS (SELECT 1 FROM public.affiliates a WHERE a.user_id = profiles.id)
      OR EXISTS (SELECT 1 FROM public.affiliate_conversions ac WHERE ac.customer_user_id = profiles.id)
      OR EXISTS (SELECT 1 FROM public.affiliate_invitations ai WHERE ai.invited_user_id = profiles.id)
    )
  );

-- ==============================================================================
-- 7. RPCS DE MARKETING ATUALIZADAS (SEM OVERLOAD PGRST203)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.respond_affiliate_invitation(
  _invitation_id uuid,
  _response text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _invitation public.affiliate_invitations%ROWTYPE;
  _current_affiliate public.affiliates%ROWTYPE;
  _is_authorized boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF _response IS NULL OR _response NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Resposta inválida. Deve ser accepted ou rejected.';
  END IF;

  SELECT lower(email) INTO _user_email
  FROM auth.users
  WHERE id = _user_id;

  IF _user_email IS NULL THEN
    _user_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  END IF;

  SELECT * INTO _invitation
  FROM public.affiliate_invitations
  WHERE id = _invitation_id
    AND deleted_at IS NULL;

  IF _invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado ou cancelado.';
  END IF;

  IF _invitation.invited_user_id IS NOT NULL AND _invitation.invited_user_id = _user_id THEN
    _is_authorized := true;
  ELSIF _invitation.invited_email IS NOT NULL AND lower(_invitation.invited_email) = _user_email THEN
    _is_authorized := true;
  ELSIF public.is_platform_admin(_user_id)
     OR public.is_platform_owner(_user_id)
     OR public.is_platform_marketing(_user_id)
     OR public.has_platform_flag('marketing', _user_id)
     OR public.has_role(_user_id, 'super_admin'::public.app_role) THEN
    _is_authorized := true;
  END IF;

  IF NOT _is_authorized THEN
    RAISE EXCEPTION 'Permissão negada para responder a este convite.';
  END IF;

  IF _invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Este convite já foi respondido anteriormente (status: %).', _invitation.status;
  END IF;

  IF _invitation.expires_at < now() THEN
    UPDATE public.affiliate_invitations
    SET status = 'expired',
        updated_at = now()
    WHERE id = _invitation_id;

    RAISE EXCEPTION 'Este convite expirou em %.', to_char(_invitation.expires_at, 'DD/MM/YYYY HH24:MI');
  END IF;

  IF _response = 'rejected' THEN
    UPDATE public.affiliate_invitations
    SET status = 'rejected',
        responded_at = now(),
        updated_at = now()
    WHERE id = _invitation_id;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'rejected',
      'invitation_id', _invitation_id,
      'message', 'Convite recusado com sucesso.'
    );
  END IF;

  SELECT * INTO _current_affiliate
  FROM public.affiliates
  WHERE user_id = _user_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF _current_affiliate.id IS NOT NULL THEN
    IF _current_affiliate.can_change_affiliate_context_after IS NOT NULL
       AND _current_affiliate.can_change_affiliate_context_after > now() THEN
      RAISE EXCEPTION 'Período de cooldown ativo (anti-pingue-pongue). Você poderá alterar seu contexto de afiliação após %.',
        to_char(_current_affiliate.can_change_affiliate_context_after, 'DD/MM/YYYY HH24:MI');
    END IF;

    UPDATE public.affiliates
    SET clinic_id = _invitation.clinic_id,
        minimum_tier_floor = COALESCE(_invitation.floor_tier, minimum_tier_floor),
        can_change_affiliate_context_after = now() + interval '15 days',
        updated_at = now()
    WHERE id = _current_affiliate.id;
  END IF;

  UPDATE public.affiliate_invitations
  SET status = 'accepted',
      invited_user_id = COALESCE(invited_user_id, _user_id),
      responded_at = now(),
      updated_at = now()
  WHERE id = _invitation_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'accepted',
    'invitation_id', _invitation_id,
    'clinic_id', _invitation.clinic_id,
    'message', 'Convite aceito com sucesso! Vínculo de afiliação atualizado.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_platform_auto_leads_batch(
  p_leads jsonb,
  p_run_id uuid DEFAULT NULL::uuid,
  p_routine_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_total integer := 0;
  v_ext_key text;
  v_phone_key text;
  v_existing_id uuid;
  v_score integer;
  v_stage text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (
    public.is_platform_owner(auth.uid())
    OR public.is_platform_marketing(auth.uid())
    OR public.has_platform_flag('marketing', auth.uid())
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores da plataforma ou marketing podem importar leads em lote.';
  END IF;

  IF p_leads IS NULL OR jsonb_typeof(p_leads) <> 'array' THEN
    RETURN jsonb_build_object('inserted_count', 0, 'updated_count', 0, 'total_processed', 0);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_leads)
  LOOP
    v_total := v_total + 1;
    v_phone_key := public.normalize_br_phone_key(v_item->>'phone');
    v_ext_key := COALESCE(
      NULLIF(btrim(v_item->>'external_lead_key'), ''),
      'lead:' || COALESCE(
        v_phone_key,
        NULLIF(lower(btrim(v_item->>'email')), ''),
        NULLIF(lower(btrim(v_item->>'facebook_profile_url')), ''),
        md5(COALESCE(v_item->>'full_name', 'lead') || '|' || COALESCE(v_item->>'source_post_url', v_item->>'facebook_group_name', ''))
      )
    );
    v_score := LEAST(100, GREATEST(0, COALESCE((v_item->>'ai_score')::integer, 60)));
    v_stage := COALESCE(NULLIF(v_item->>'stage', ''), CASE WHEN v_score >= 70 THEN 'qualified' ELSE 'new' END);

    SELECT id INTO v_existing_id
    FROM public.platform_auto_leads
    WHERE external_lead_key = v_ext_key
    LIMIT 1;

    IF v_existing_id IS NULL THEN
      INSERT INTO public.platform_auto_leads (
        routine_id,
        full_name,
        phone,
        email,
        instagram_handle,
        facebook_profile_url,
        facebook_group_name,
        facebook_group_url,
        linkedin_url,
        website_url,
        city,
        state,
        clinic_name,
        specialty,
        icp_tier,
        source_platform,
        source_post_url,
        source_post_excerpt,
        ai_score,
        ai_qualification_summary,
        ai_icebreaker_message,
        subagent_captured_by,
        stage,
        external_lead_key,
        apify_run_id,
        lindy_task_id,
        raw_metadata
      ) VALUES (
        COALESCE(p_routine_id, NULLIF(v_item->>'routine_id', '')::uuid),
        COALESCE(NULLIF(btrim(v_item->>'full_name'), ''), 'Lead Sem Nome'),
        NULLIF(btrim(v_item->>'phone'), ''),
        NULLIF(lower(btrim(v_item->>'email')), ''),
        NULLIF(btrim(v_item->>'instagram_handle'), ''),
        NULLIF(btrim(v_item->>'facebook_profile_url'), ''),
        NULLIF(btrim(v_item->>'facebook_group_name'), ''),
        NULLIF(btrim(v_item->>'facebook_group_url'), ''),
        NULLIF(btrim(v_item->>'linkedin_url'), ''),
        NULLIF(btrim(v_item->>'website_url'), ''),
        NULLIF(btrim(v_item->>'city'), ''),
        NULLIF(btrim(v_item->>'state'), ''),
        NULLIF(btrim(v_item->>'clinic_name'), ''),
        NULLIF(btrim(v_item->>'specialty'), ''),
        COALESCE(NULLIF(v_item->>'icp_tier', ''), 'solo_physio'),
        COALESCE(NULLIF(v_item->>'source_platform', ''), 'facebook_group'),
        NULLIF(btrim(v_item->>'source_post_url'), ''),
        NULLIF(btrim(v_item->>'source_post_excerpt'), ''),
        v_score,
        NULLIF(btrim(v_item->>'ai_qualification_summary'), ''),
        NULLIF(btrim(v_item->>'ai_icebreaker_message'), ''),
        COALESCE(NULLIF(v_item->>'subagent_captured_by', ''), 'fb_group_intent_hunter'),
        v_stage,
        v_ext_key,
        NULLIF(btrim(v_item->>'apify_run_id'), ''),
        NULLIF(btrim(v_item->>'lindy_task_id'), ''),
        COALESCE(v_item->'raw_metadata', '{}'::jsonb)
      );
      v_inserted := v_inserted + 1;
    ELSE
      UPDATE public.platform_auto_leads
      SET
        phone = COALESCE(NULLIF(btrim(phone), ''), NULLIF(btrim(v_item->>'phone'), '')),
        email = COALESCE(NULLIF(btrim(email), ''), NULLIF(lower(btrim(v_item->>'email')), '')),
        instagram_handle = COALESCE(NULLIF(btrim(instagram_handle), ''), NULLIF(btrim(v_item->>'instagram_handle'), '')),
        facebook_profile_url = COALESCE(NULLIF(btrim(facebook_profile_url), ''), NULLIF(btrim(v_item->>'facebook_profile_url'), '')),
        city = COALESCE(NULLIF(btrim(city), ''), NULLIF(btrim(v_item->>'city'), '')),
        state = COALESCE(NULLIF(btrim(state), ''), NULLIF(btrim(v_item->>'state'), '')),
        clinic_name = COALESCE(NULLIF(btrim(clinic_name), ''), NULLIF(btrim(v_item->>'clinic_name'), '')),
        specialty = COALESCE(NULLIF(btrim(specialty), ''), NULLIF(btrim(v_item->>'specialty'), '')),
        ai_score = GREATEST(ai_score, v_score),
        ai_qualification_summary = COALESCE(NULLIF(btrim(v_item->>'ai_qualification_summary'), ''), ai_qualification_summary),
        ai_icebreaker_message = COALESCE(NULLIF(btrim(v_item->>'ai_icebreaker_message'), ''), ai_icebreaker_message),
        apify_run_id = COALESCE(NULLIF(btrim(v_item->>'apify_run_id'), ''), apify_run_id),
        lindy_task_id = COALESCE(NULLIF(btrim(v_item->>'lindy_task_id'), ''), lindy_task_id),
        deleted_at = NULL,
        updated_at = now()
      WHERE id = v_existing_id;
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  IF p_run_id IS NOT NULL THEN
    UPDATE public.platform_auto_lead_runs
    SET
      leads_found_count = v_total,
      leads_inserted_count = v_inserted,
      leads_updated_count = v_updated,
      status = 'succeeded',
      subagent_stage = 'completed',
      completed_at = now()
    WHERE id = p_run_id;
  END IF;

  IF p_routine_id IS NOT NULL THEN
    UPDATE public.platform_auto_lead_routines
    SET
      last_run_at = now(),
      last_run_status = 'succeeded',
      total_leads_captured = total_leads_captured + v_inserted,
      updated_at = now()
    WHERE id = p_routine_id;
  END IF;

  RETURN jsonb_build_object(
    'inserted_count', v_inserted,
    'updated_count', v_updated,
    'total_processed', v_total
  );
END;
$$;

-- ==============================================================================
-- 8. RPC: UPSERT DE ACESSO E FEATURE FLAGS DO BACKOFFICE
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.upsert_platform_admin_access(
  _target_user_id uuid,
  _has_access boolean,
  _feature_flags jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _existing_role public.platform_admin_role;
BEGIN
  IF NOT public.is_platform_owner(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id_required';
  END IF;

  SELECT role INTO _existing_role
  FROM public.platform_admins
  WHERE user_id = _target_user_id;

  IF COALESCE(_has_access, false) THEN
    INSERT INTO public.platform_admins (
      user_id,
      role,
      is_active,
      feature_flags,
      created_by
    )
    VALUES (
      _target_user_id,
      COALESCE(_existing_role, 'platform_marketing'::public.platform_admin_role),
      true,
      COALESCE(_feature_flags, '{}'::jsonb),
      auth.uid()
    )
    ON CONFLICT (user_id) DO UPDATE
      SET role = COALESCE(public.platform_admins.role, 'platform_marketing'::public.platform_admin_role),
          is_active = true,
          feature_flags = COALESCE(_feature_flags, '{}'::jsonb);
  ELSE
    IF _existing_role = 'platform_owner'::public.platform_admin_role THEN
      RAISE EXCEPTION 'cannot_deactivate_platform_owner';
    END IF;

    UPDATE public.platform_admins
    SET is_active = false
    WHERE user_id = _target_user_id
      AND role <> 'platform_owner'::public.platform_admin_role;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_platform_admin_access(uuid, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_platform_admin_access(uuid, boolean, jsonb) TO authenticated, service_role;

-- ==============================================================================
-- 9. ATUALIZAÇÃO DE FEATURE FLAGS PARA comercial@plurifisio.com.br
-- ==============================================================================

DO $$
DECLARE
  v_marketing_user_id uuid;
BEGIN
  SELECT id
  INTO v_marketing_user_id
  FROM auth.users
  WHERE lower(email) = 'comercial@plurifisio.com.br'
  LIMIT 1;

  IF v_marketing_user_id IS NOT NULL THEN
    UPDATE public.platform_admins
    SET feature_flags = '{"marketing": true, "agenda": true, "simulation": true, "debug": true}'::jsonb
    WHERE user_id = v_marketing_user_id;
  END IF;
END $$;
