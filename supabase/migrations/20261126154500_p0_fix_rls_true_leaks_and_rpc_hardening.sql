-- Onda 1: Estancamento P0 de Segurança (RLS true/OR true, handle_personal_signup, rpc_get_available_slots, overload PGRST203 e funções mortas)

-- ============================================================================
-- 1. Corrigir RLS com `true` / `OR true` em 8 tabelas sensíveis + governance_rules
-- ============================================================================

-- 1.1 whatsapp_chat_sessions (zera 0024 + remove OR true no SELECT; escritas apenas via service_role)
DROP POLICY IF EXISTS "whatsapp_chat_sessions_select_authenticated_consolidated" ON public.whatsapp_chat_sessions;
DROP POLICY IF EXISTS "whatsapp_chat_sessions_insert_authenticated_consolidated" ON public.whatsapp_chat_sessions;
DROP POLICY IF EXISTS "whatsapp_chat_sessions_update_authenticated_consolidated" ON public.whatsapp_chat_sessions;
DROP POLICY IF EXISTS "whatsapp_chat_sessions_delete_authenticated_consolidated" ON public.whatsapp_chat_sessions;

CREATE POLICY "whatsapp_chat_sessions_select_authenticated_consolidated"
  ON public.whatsapp_chat_sessions
  FOR SELECT TO authenticated
  USING (
    public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR user_id = (SELECT auth.uid())
  );

-- 1.2 affiliates
DROP POLICY IF EXISTS "affiliates_select_authenticated_consolidated" ON public.affiliates;
DROP POLICY IF EXISTS "affiliates_insert_authenticated_consolidated" ON public.affiliates;
DROP POLICY IF EXISTS "affiliates_update_authenticated_consolidated" ON public.affiliates;
DROP POLICY IF EXISTS "affiliates_delete_authenticated_consolidated" ON public.affiliates;

CREATE POLICY "affiliates_select_authenticated_consolidated"
  ON public.affiliates
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

CREATE POLICY "affiliates_insert_authenticated_consolidated"
  ON public.affiliates
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

CREATE POLICY "affiliates_update_authenticated_consolidated"
  ON public.affiliates
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

CREATE POLICY "affiliates_delete_authenticated_consolidated"
  ON public.affiliates
  FOR DELETE TO authenticated
  USING (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

-- 1.3 affiliate_commissions
DROP POLICY IF EXISTS "affiliate_commissions_select_authenticated_consolidated" ON public.affiliate_commissions;
DROP POLICY IF EXISTS "affiliate_commissions_insert_authenticated_consolidated" ON public.affiliate_commissions;
DROP POLICY IF EXISTS "affiliate_commissions_update_authenticated_consolidated" ON public.affiliate_commissions;
DROP POLICY IF EXISTS "affiliate_commissions_delete_authenticated_consolidated" ON public.affiliate_commissions;

CREATE POLICY "affiliate_commissions_select_authenticated_consolidated"
  ON public.affiliate_commissions
  FOR SELECT TO authenticated
  USING (
    affiliate_id IN (SELECT a.id FROM public.affiliates a WHERE a.user_id = (SELECT auth.uid()))
    OR public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

CREATE POLICY "affiliate_commissions_insert_authenticated_consolidated"
  ON public.affiliate_commissions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

CREATE POLICY "affiliate_commissions_update_authenticated_consolidated"
  ON public.affiliate_commissions
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

CREATE POLICY "affiliate_commissions_delete_authenticated_consolidated"
  ON public.affiliate_commissions
  FOR DELETE TO authenticated
  USING (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

-- 1.4 affiliate_conversions
DROP POLICY IF EXISTS "affiliate_conversions_select_authenticated_consolidated" ON public.affiliate_conversions;
DROP POLICY IF EXISTS "affiliate_conversions_insert_authenticated_consolidated" ON public.affiliate_conversions;
DROP POLICY IF EXISTS "affiliate_conversions_update_authenticated_consolidated" ON public.affiliate_conversions;
DROP POLICY IF EXISTS "affiliate_conversions_delete_authenticated_consolidated" ON public.affiliate_conversions;

CREATE POLICY "affiliate_conversions_select_authenticated_consolidated"
  ON public.affiliate_conversions
  FOR SELECT TO authenticated
  USING (
    affiliate_id IN (SELECT a.id FROM public.affiliates a WHERE a.user_id = (SELECT auth.uid()))
    OR public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

CREATE POLICY "affiliate_conversions_insert_authenticated_consolidated"
  ON public.affiliate_conversions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

CREATE POLICY "affiliate_conversions_update_authenticated_consolidated"
  ON public.affiliate_conversions
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

CREATE POLICY "affiliate_conversions_delete_authenticated_consolidated"
  ON public.affiliate_conversions
  FOR DELETE TO authenticated
  USING (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

-- 1.5 affiliate_crm_logs
DROP POLICY IF EXISTS "affiliate_crm_logs_select_authenticated_consolidated" ON public.affiliate_crm_logs;
DROP POLICY IF EXISTS "affiliate_crm_logs_insert_authenticated_consolidated" ON public.affiliate_crm_logs;
DROP POLICY IF EXISTS "affiliate_crm_logs_update_authenticated_consolidated" ON public.affiliate_crm_logs;
DROP POLICY IF EXISTS "affiliate_crm_logs_delete_authenticated_consolidated" ON public.affiliate_crm_logs;

CREATE POLICY "affiliate_crm_logs_select_authenticated_consolidated"
  ON public.affiliate_crm_logs
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

CREATE POLICY "affiliate_crm_logs_insert_authenticated_consolidated"
  ON public.affiliate_crm_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

CREATE POLICY "affiliate_crm_logs_update_authenticated_consolidated"
  ON public.affiliate_crm_logs
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

CREATE POLICY "affiliate_crm_logs_delete_authenticated_consolidated"
  ON public.affiliate_crm_logs
  FOR DELETE TO authenticated
  USING (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

-- 1.6 affiliate_invitations
DROP POLICY IF EXISTS "affiliate_invitations_select_authenticated_consolidated" ON public.affiliate_invitations;
DROP POLICY IF EXISTS "affiliate_invitations_insert_authenticated_consolidated" ON public.affiliate_invitations;
DROP POLICY IF EXISTS "affiliate_invitations_update_authenticated_consolidated" ON public.affiliate_invitations;
DROP POLICY IF EXISTS "affiliate_invitations_delete_authenticated_consolidated" ON public.affiliate_invitations;

CREATE POLICY "affiliate_invitations_select_authenticated_consolidated"
  ON public.affiliate_invitations
  FOR SELECT TO authenticated
  USING (
    (clinic_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.clinic_id = affiliate_invitations.clinic_id
        AND cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.membership_status = 'active'::public.membership_status_type
    ))
    OR invited_user_id = (SELECT auth.uid())
    OR public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

CREATE POLICY "affiliate_invitations_insert_authenticated_consolidated"
  ON public.affiliate_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

CREATE POLICY "affiliate_invitations_update_authenticated_consolidated"
  ON public.affiliate_invitations
  FOR UPDATE TO authenticated
  USING (
    invited_user_id = (SELECT auth.uid())
    OR public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    invited_user_id = (SELECT auth.uid())
    OR public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

CREATE POLICY "affiliate_invitations_delete_authenticated_consolidated"
  ON public.affiliate_invitations
  FOR DELETE TO authenticated
  USING (
    public.is_platform_admin((SELECT auth.uid()))
    OR public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

-- 1.7 platform_auto_leads
DROP POLICY IF EXISTS "platform_auto_leads_select_authenticated_consolidated" ON public.platform_auto_leads;
DROP POLICY IF EXISTS "platform_auto_leads_insert_authenticated_consolidated" ON public.platform_auto_leads;
DROP POLICY IF EXISTS "platform_auto_leads_update_authenticated_consolidated" ON public.platform_auto_leads;
DROP POLICY IF EXISTS "platform_auto_leads_delete_authenticated_consolidated" ON public.platform_auto_leads;

CREATE POLICY "platform_auto_leads_select_authenticated_consolidated"
  ON public.platform_auto_leads
  FOR SELECT TO authenticated
  USING (
    public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR (
      deleted_at IS NULL
      AND assigned_affiliate_id IN (
        SELECT a.id FROM public.affiliates a
        WHERE a.user_id = (SELECT auth.uid()) AND a.deleted_at IS NULL
      )
    )
  );

CREATE POLICY "platform_auto_leads_insert_authenticated_consolidated"
  ON public.platform_auto_leads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
  );

CREATE POLICY "platform_auto_leads_update_authenticated_consolidated"
  ON public.platform_auto_leads
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR (
      deleted_at IS NULL
      AND assigned_affiliate_id IN (
        SELECT a.id FROM public.affiliates a
        WHERE a.user_id = (SELECT auth.uid()) AND a.deleted_at IS NULL
      )
    )
  )
  WITH CHECK (
    public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
    OR (
      assigned_affiliate_id IN (
        SELECT a.id FROM public.affiliates a
        WHERE a.user_id = (SELECT auth.uid()) AND a.deleted_at IS NULL
      )
    )
  );

CREATE POLICY "platform_auto_leads_delete_authenticated_consolidated"
  ON public.platform_auto_leads
  FOR DELETE TO authenticated
  USING (
    public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('marketing'::text, (SELECT auth.uid()))
  );

-- 1.8 platform_onboarding_meetings
DROP POLICY IF EXISTS "platform_onboarding_meetings_select_authenticated_consolidated" ON public.platform_onboarding_meetings;
DROP POLICY IF EXISTS "platform_onboarding_meetings_insert_authenticated_consolidated" ON public.platform_onboarding_meetings;
DROP POLICY IF EXISTS "platform_onboarding_meetings_update_authenticated_consolidated" ON public.platform_onboarding_meetings;
DROP POLICY IF EXISTS "platform_onboarding_meetings_delete_authenticated_consolidated" ON public.platform_onboarding_meetings;

CREATE POLICY "platform_onboarding_meetings_select_authenticated_consolidated"
  ON public.platform_onboarding_meetings
  FOR SELECT TO authenticated
  USING (
    public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('agenda'::text, (SELECT auth.uid()))
    OR created_by = (SELECT auth.uid())
  );

CREATE POLICY "platform_onboarding_meetings_insert_authenticated_consolidated"
  ON public.platform_onboarding_meetings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('agenda'::text, (SELECT auth.uid()))
  );

CREATE POLICY "platform_onboarding_meetings_update_authenticated_consolidated"
  ON public.platform_onboarding_meetings
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('agenda'::text, (SELECT auth.uid()))
  )
  WITH CHECK (
    public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('agenda'::text, (SELECT auth.uid()))
  );

CREATE POLICY "platform_onboarding_meetings_delete_authenticated_consolidated"
  ON public.platform_onboarding_meetings
  FOR DELETE TO authenticated
  USING (
    public.is_platform_owner((SELECT auth.uid()))
    OR public.is_platform_marketing((SELECT auth.uid()))
    OR public.has_platform_flag('agenda'::text, (SELECT auth.uid()))
  );

-- 1.9 governance_rules (remover OR true do SELECT)
DROP POLICY IF EXISTS "governance_rules_select_authenticated_consolidated" ON public.governance_rules;

CREATE POLICY "governance_rules_select_authenticated_consolidated"
  ON public.governance_rules
  FOR SELECT TO authenticated
  USING (
    ((public.is_platform_marketing((SELECT auth.uid())) OR public.has_platform_flag('marketing'::text, (SELECT auth.uid())))
      AND key = ANY (ARRAY['affiliate_tiers_config'::text, 'affiliate_campaign_config'::text]))
    OR public.is_platform_owner((SELECT auth.uid()))
  );

-- ============================================================================
-- 2. Endurecer handle_personal_signup (anti-account-takeover / anti-enumeração)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_personal_signup(
  _user_id uuid,
  _email text,
  _full_name text DEFAULT NULL::text,
  _cpf text DEFAULT NULL::text,
  _phone text DEFAULT NULL::text,
  _birth_date date DEFAULT NULL::date,
  _profession text DEFAULT NULL::text,
  _council_number text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
  _normalized_cpf text;
  _clean_name text;
  _clean_phone text;
  _clean_profession text;
  _clean_council_number text;
  _existing_cpf_user_id uuid;
  v_public_code text;
  v_clinic_id uuid;
  v_route_suffix text;
  v_route_key text;
  v_clinic_name text;
  v_trial_end timestamptz;
  v_is_already_owner boolean := false;
BEGIN
  IF _user_id IS NULL OR _email IS NULL OR trim(_email) = '' THEN
    RAISE EXCEPTION 'Parâmetros inválidos para cadastro.';
  END IF;

  -- Guard de identidade:
  -- 1) Se autenticado: só pode atuar sobre o próprio _user_id (ou platform_owner).
  -- 2) Se anônimo (logo após auth.signUp antes de confirmar e-mail): exige usuário recém-criado em auth.users
  --    ainda não confirmado e sem profile existente (impede sobrescrita de contas e enumeração de CPF).
  IF _caller_id IS NOT NULL THEN
    IF _caller_id <> _user_id AND NOT public.is_platform_owner(_caller_id) THEN
      RAISE EXCEPTION 'Acesso negado ao provisionamento de perfil.';
    END IF;
  ELSIF pg_catalog.current_user <> 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE u.id = _user_id
        AND lower(u.email) = lower(trim(_email))
        AND u.email_confirmed_at IS NULL
        AND u.created_at >= now() - interval '15 minutes'
    ) OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = _user_id
    ) THEN
      RAISE EXCEPTION 'Acesso negado ao provisionamento de perfil.';
    END IF;
  END IF;

  _normalized_cpf := NULLIF(regexp_replace(COALESCE(_cpf, ''), '\D', '', 'g'), '');
  _clean_name := NULLIF(trim(COALESCE(_full_name, '')), '');
  _clean_phone := NULLIF(trim(COALESCE(_phone, '')), '');
  _clean_profession := NULLIF(trim(COALESCE(_profession, '')), '');
  _clean_council_number := NULLIF(trim(COALESCE(_council_number, '')), '');

  IF _normalized_cpf IS NOT NULL THEN
    SELECT id INTO _existing_cpf_user_id
    FROM public.profiles
    WHERE cpf = _normalized_cpf
      AND id <> _user_id
    LIMIT 1;

    IF _existing_cpf_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'Este CPF já está cadastrado em outra conta.' USING ERRCODE = '23505';
    END IF;
  END IF;

  SELECT public_code INTO v_public_code
  FROM public.profiles
  WHERE id = _user_id;

  IF v_public_code IS NULL OR trim(v_public_code) = '' THEN
    v_public_code := public.generate_profile_public_code();
  END IF;

  INSERT INTO public.profiles (
    id, clinic_id, email, full_name, cpf, phone, birth_date,
    public_code, profession, council_name, professional_license
  )
  VALUES (
    _user_id, NULL, lower(trim(_email)), _clean_name, _normalized_cpf, _clean_phone, _birth_date,
    v_public_code, _clean_profession, 'CREFITO', _clean_council_number
  )
  ON CONFLICT (id) DO UPDATE
  SET email = lower(trim(EXCLUDED.email)),
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      cpf = COALESCE(EXCLUDED.cpf, profiles.cpf),
      phone = COALESCE(EXCLUDED.phone, profiles.phone),
      birth_date = COALESCE(EXCLUDED.birth_date, profiles.birth_date),
      profession = COALESCE(EXCLUDED.profession, profiles.profession),
      council_name = COALESCE(EXCLUDED.council_name, profiles.council_name, 'CREFITO'),
      professional_license = COALESCE(EXCLUDED.professional_license, profiles.professional_license),
      public_code = COALESCE(profiles.public_code, EXCLUDED.public_code),
      updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  SELECT EXISTS (
    SELECT 1 FROM public.clinic_memberships cm
    WHERE cm.user_id = _user_id AND cm.is_active = true
      AND (cm.account_role = 'account_owner' OR cm.operational_role = 'owner')
  ) OR EXISTS (
    SELECT 1 FROM public.clinics c WHERE c.account_owner_user_id = _user_id
  ) INTO v_is_already_owner;

  IF NOT v_is_already_owner THEN
    v_trial_end := now() + interval '7 days';
    v_clinic_name := 'Consultório - ' || COALESCE(_clean_name, 'Profissional');
    v_route_suffix := lower(regexp_replace(COALESCE(v_public_code, gen_random_uuid()::text), '^PLR-|-', '', 'g'));
    v_route_key := 'consultorio-' || v_route_suffix;

    IF EXISTS (SELECT 1 FROM public.clinics WHERE route_key = v_route_key) THEN
      v_route_key := v_route_key || '-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    END IF;

    INSERT INTO public.clinics (
      name, cnpj, route_key, subscription_plan, access_status,
      concurrent_access_limit, subaccount_limit, account_owner_user_id
    )
    VALUES (
      v_clinic_name, COALESCE(_normalized_cpf, '00000000000'), v_route_key,
      'prof_basico'::public.subscription_plan, 'active', 1, 1, _user_id
    )
    RETURNING id INTO v_clinic_id;

    INSERT INTO public.clinic_subscriptions (
      clinic_id, account_owner_user_id, plan_type, billing_cycle, payment_method,
      base_monthly_price, base_concurrent_access_count, total_recurring_monthly_price,
      base_subaccount_limit, status, is_free_trial, is_read_only, trial_ends_at,
      trial_max_attendances, trial_max_patients, trial_max_custom_forms,
      period_duration_days, current_period_start, current_period_end, expires_at
    )
    VALUES (
      v_clinic_id, _user_id, 'prof_basico'::public.subscription_plan, 'ANNUAL', 'TRIAL',
      39.99, 1, 0, 1, 'TRIAL', true, false, v_trial_end,
      20, 5, 1, 7, now(), v_trial_end, v_trial_end
    )
    ON CONFLICT (clinic_id) DO NOTHING;

    INSERT INTO public.clinic_memberships (
      clinic_id, user_id, account_role, operational_role, role_key, membership_status, is_active
    )
    VALUES (
      v_clinic_id, _user_id, 'account_owner', 'owner', 'owner', 'active', true
    )
    ON CONFLICT (clinic_id, user_id) DO UPDATE
    SET account_role = 'account_owner', operational_role = 'owner', role_key = 'owner',
        membership_status = 'active', is_active = true, updated_at = now();

    INSERT INTO public.user_active_clinic_contexts (user_id, clinic_id, updated_at)
    VALUES (_user_id, v_clinic_id, now())
    ON CONFLICT (user_id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id, updated_at = now();

    UPDATE public.profiles SET clinic_id = COALESCE(clinic_id, v_clinic_id) WHERE id = _user_id;

    RETURN jsonb_build_object(
      'user_id', _user_id, 'has_clinic', true, 'clinic_id', v_clinic_id,
      'route_key', v_route_key, 'subscription_plan', 'prof_basico', 'subscription_status', 'trialing'
    );
  END IF;

  RETURN jsonb_build_object('user_id', _user_id, 'has_clinic', true);
END;
$function$;

-- ============================================================================
-- 3. Endurecer rpc_get_available_slots (anti-IDOR multi-tenant)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_get_available_slots(_clinic_id uuid, _provider_id uuid, _date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
  _slot_time text;
  _slot_start timestamptz;
  _slot_end timestamptz;
  _is_occupied boolean;
  _slots text[] := ARRAY[]::text[];
  _all_slots text[] := ARRAY[
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'
  ];
BEGIN
  IF _clinic_id IS NULL OR _date IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF pg_catalog.current_user <> 'service_role' THEN
    IF _caller_id IS NULL OR (
      NOT public.user_has_active_clinic_membership(_caller_id, _clinic_id)
      AND NOT public.is_platform_owner(_caller_id)
    ) THEN
      RAISE EXCEPTION 'Acesso negado aos horários desta clínica.';
    END IF;
  END IF;

  FOREACH _slot_time IN ARRAY _all_slots
  LOOP
    _slot_start := (_date::text || ' ' || _slot_time || ':00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
    _slot_end := _slot_start + interval '30 minutes';

    SELECT EXISTS (
      SELECT 1
      FROM public.agenda_events ae
      WHERE ae.clinic_id = _clinic_id
        AND (_provider_id IS NULL OR ae.user_id = _provider_id)
        AND ae.status NOT IN ('cancelado')
        AND ae.scheduled_for < _slot_end
        AND (ae.scheduled_for + (COALESCE(ae.duration_minutes, 60) * interval '1 minute')) > _slot_start

      UNION ALL

      SELECT 1
      FROM public.sessions s
      WHERE s.clinic_id = _clinic_id
        AND (_provider_id IS NULL OR COALESCE(s.provider_id, s.user_id) = _provider_id)
        AND s.deleted_at IS NULL
        AND s.status NOT IN ('cancelada')
        AND COALESCE(s.scheduled_start_at, s.session_date) < _slot_end
        AND (COALESCE(s.scheduled_start_at, s.session_date) + (COALESCE(s.duration_minutes, 60) * interval '1 minute')) > _slot_start
    ) INTO _is_occupied;

    IF NOT _is_occupied THEN
      _slots := array_append(_slots, _slot_time);
    END IF;
  END LOOP;

  RETURN to_jsonb(_slots);
END;
$function$;

-- ============================================================================
-- 4. Eliminar overload PGRST203 + 12 funções 100% mortas
-- ============================================================================
DROP FUNCTION IF EXISTS public.activate_clinic_free_trial(uuid, public.subscription_plan);
DROP FUNCTION IF EXISTS public.get_public_signature_verification(text);
DROP FUNCTION IF EXISTS public.can_insert_session(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.create_clinic_subaccount(text, text, text, public.operational_role_type, text, text, uuid);
DROP FUNCTION IF EXISTS public.end_clinic_user_security_sessions(uuid, uuid);
DROP FUNCTION IF EXISTS public.end_other_security_sessions(text);
DROP FUNCTION IF EXISTS public.get_platform_dashboard();
DROP FUNCTION IF EXISTS public.revoke_session_share(uuid, uuid);
DROP FUNCTION IF EXISTS public.update_clinic_subaccount(uuid, text, text, text, text, text, text, text, public.operational_role_type, public.membership_status_type, text, text);
DROP FUNCTION IF EXISTS public.update_clinic_subaccount_profile(uuid, text, text, text, text, date, text, text, text, text, text, text, jsonb, public.operational_role_type, public.membership_status_type, text);
DROP FUNCTION IF EXISTS public.update_current_profile(text, text, text, text, date, text, text, text, text, text, text, jsonb, text);
DROP FUNCTION IF EXISTS public.update_team_development_profile(uuid, text, text, text, text, date, date, boolean, boolean);
DROP FUNCTION IF EXISTS public.upsert_current_user_security_settings(boolean, boolean, boolean, boolean);
