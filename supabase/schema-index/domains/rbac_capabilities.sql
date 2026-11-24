-- ==========================================================================
-- DOMÍNIO: RBAC_CAPABILITIES (Gerado automaticamente por npm run schema:index)
-- Fonte SSOT: supabase/schema.sql
-- ==========================================================================

-- [RPC/FUNCTION] current_user_can (schema.sql L2861-L3163)
CREATE OR REPLACE FUNCTION "public"."current_user_can"("_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _resolved_clinic_id uuid;
  _account_role public.account_role_type;
  _operational_role public.operational_role_type;
  _role_key text;
  _membership_status public.membership_status_type;
  _is_active boolean;
  _subscription_plan public.subscription_plan;
  _plan_str text;
  _clinic_owner_id uuid;
  _override_enabled boolean;
  _sub record;
  _is_subscription_expired boolean := false;
  _is_read_only boolean := false;
  _is_owner boolean := false;
  _can_have_subaccounts boolean := false;
  _canonical_capability text := _capability;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Normalize synonym capabilities
  IF _capability IN ('patient_groups.write', 'patients_groups.write') THEN
    _canonical_capability := 'patients.manage_groups';
  ELSIF _capability IN ('patient_groups.read') THEN
    _canonical_capability := 'patients_groups.read';
  ELSIF _capability = 'agenda.read' THEN
    _canonical_capability := 'schedule.read';
  ELSIF _capability = 'agenda.write' THEN
    _canonical_capability := 'schedule.write';
  END IF;

  _resolved_clinic_id := COALESCE(_clinic_id, public.get_user_clinic_id(_user_id));

  IF _resolved_clinic_id IS NULL THEN
    RETURN false;
  END IF;

  -- Bypass for Platform Owner in active simulation context
  IF public.is_platform_owner(_user_id)
     AND public.get_active_platform_clinic_id(_user_id) = _resolved_clinic_id THEN
    RETURN true;
  END IF;

  SELECT
    clinic_memberships.account_role,
    clinic_memberships.operational_role,
    clinic_memberships.role_key,
    clinic_memberships.membership_status,
    clinic_memberships.is_active,
    clinics.subscription_plan,
    LOWER(COALESCE(clinics.subscription_plan::text, 'solo')),
    clinics.account_owner_user_id
  INTO
    _account_role,
    _operational_role,
    _role_key,
    _membership_status,
    _is_active,
    _subscription_plan,
    _plan_str,
    _clinic_owner_id
  FROM public.clinic_memberships
  JOIN public.clinics ON clinics.id = clinic_memberships.clinic_id
  WHERE clinic_memberships.user_id = _user_id
    AND clinic_memberships.clinic_id = _resolved_clinic_id
  LIMIT 1;

  -- Fallback if user is account_owner_user_id on clinics
  IF _operational_role IS NULL THEN
    SELECT
      'account_owner'::public.account_role_type,
      'owner'::public.operational_role_type,
      'owner',
      'active'::public.membership_status_type,
      true,
      clinics.subscription_plan,
      LOWER(COALESCE(clinics.subscription_plan::text, 'solo')),
      clinics.account_owner_user_id
    INTO
      _account_role,
      _operational_role,
      _role_key,
      _membership_status,
      _is_active,
      _subscription_plan,
      _plan_str,
      _clinic_owner_id
    FROM public.clinics
    WHERE clinics.id = _resolved_clinic_id
      AND clinics.account_owner_user_id = _user_id
    LIMIT 1;
  END IF;

  IF _is_active IS DISTINCT FROM true
     OR _membership_status IS DISTINCT FROM 'active'::public.membership_status_type THEN
    RETURN false;
  END IF;

  _is_owner := (_account_role = 'account_owner' OR _operational_role = 'owner' OR _clinic_owner_id = _user_id);
  _can_have_subaccounts := _plan_str IN ('clinic', 'enterprise', 'clinica_basico', 'clinica_medio', 'clinica_top', 'prof_top');

  -- 1. Check Subscription & Read-Only state
  SELECT * INTO _sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _resolved_clinic_id
  LIMIT 1;

  IF _sub IS NOT NULL THEN
    IF COALESCE(_sub.is_courtesy, false) = false AND _sub.status NOT IN ('ACTIVE', 'BETA', 'COURTESY', 'PENDING') THEN
      IF _sub.status = 'TRIAL_EXPIRED' AND NOT _is_owner THEN
        RETURN false;
      END IF;

      IF public.is_clinic_read_only(_resolved_clinic_id) THEN
        _is_read_only := true;
        IF (_sub.status IN ('TRIAL_EXPIRED', 'TRIAL')) AND NOT _is_owner THEN
          RETURN false;
        END IF;
      END IF;

      IF _sub.status IN ('EXPIRED', 'SUSPENDED', 'CANCELED') THEN
        _is_subscription_expired := true;
      END IF;
    END IF;
  END IF;

  -- If clinic is in read-only or expired subscription mode:
  IF _is_read_only OR _is_subscription_expired THEN
    IF _capability = 'subscription_billing.manage' AND _is_owner THEN
      RETURN true;
    END IF;

    IF _capability IN (
      'patients.read',
      'schedule.read',
      'schedule.read_all',
      'agenda.read',
      'sessions.read',
      'sessions.read_all',
      'patient_groups.read',
      'patients_groups.read',
      'subaccounts_analytics.read',
      'subaccounts.read',
      'subaccounts_roles.read',
      'clinic_profile.read',
      'forms.read',
      'anamnesis_forms.read',
      'treasury.read',
      'subscription_billing.read'
    ) OR _canonical_capability IN (
      'patients.read',
      'schedule.read',
      'schedule.read_all',
      'agenda.read',
      'sessions.read',
      'sessions.read_all',
      'patient_groups.read',
      'patients_groups.read',
      'subaccounts_analytics.read',
      'subaccounts.read',
      'subaccounts_roles.read',
      'clinic_profile.read',
      'forms.read',
      'anamnesis_forms.read',
      'treasury.read',
      'subscription_billing.read'
    ) THEN
      RETURN true;
    END IF;

    RETURN false;
  END IF;

  -- Owner has full access in active clinic
  IF _is_owner THEN
    RETURN true;
  END IF;

  IF _capability = 'subscription_billing.manage' THEN
    RETURN false;
  END IF;

  -- 2. Check Overrides in clinic_operational_role_capabilities
  IF _role_key IS NOT NULL AND _role_key <> '' THEN
    SELECT enabled
    INTO _override_enabled
    FROM public.clinic_operational_role_capabilities
    WHERE clinic_id = _resolved_clinic_id
      AND operational_role = _role_key
      AND capability IN (_capability, _canonical_capability)
    ORDER BY (capability = _canonical_capability) DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN _override_enabled;
    END IF;
  END IF;

  SELECT enabled
  INTO _override_enabled
  FROM public.clinic_operational_role_capabilities
  WHERE clinic_id = _resolved_clinic_id
    AND operational_role = _operational_role::text
    AND capability IN (_capability, _canonical_capability)
  ORDER BY (capability = _canonical_capability) DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN _override_enabled;
  END IF;

  -- 3. Default Canonical Permission Matrix
  CASE _capability
    WHEN 'clinic_profile.read',
         'clinic_profile.manage',
         'clinic_terms.manage',
         'clinic_trash.manage',
         'forms.manage',
         'treasury.read',
         'treasury.manage',
         'agenda.delete_events',
         'patients.delete',
         'sessions.read_all',
         'sessions.write_others',
         'sessions.delete' THEN
      RETURN _operational_role IN ('owner', 'admin');

    WHEN 'marketing.affiliates.view',
         'marketing.affiliates.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');

    WHEN 'marketing.affiliates.withdraw' THEN
      RETURN _is_owner OR _operational_role = 'owner';

    WHEN 'patients.manage_exclusive' THEN
      RETURN _operational_role = 'owner';

    WHEN 'forms.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');

    WHEN 'subaccounts.read',
         'subaccounts.write',
         'subaccounts.manage',
         'subaccounts.delete',
         'subaccounts_roles.read',
         'subaccounts_roles.manage',
         'team_development.manage',
         'subaccounts_analytics.read' THEN
      RETURN _can_have_subaccounts AND _operational_role IN ('owner', 'admin');

    WHEN 'subscription_billing.read' THEN
      RETURN _is_owner OR _operational_role = 'admin';

    WHEN 'patients.read',
         'patients.write',
         'patients.manage_groups',
         'patient_groups.write',
         'patients_groups.write',
         'patient_groups.read',
         'patients_groups.read',
         'system.print' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');

    WHEN 'agenda.read',
         'schedule.read',
         'agenda.write',
         'schedule.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');

    WHEN 'schedule.read_all',
         'schedule.write_others' THEN
      RETURN _operational_role IN ('owner', 'admin', 'assistant');

    WHEN 'sessions.read',
         'sessions.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'estagiario');

    WHEN 'sessions.share',
         'session.delete_draft' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');

    ELSE
      IF _canonical_capability <> _capability THEN
        CASE _canonical_capability
          WHEN 'patients.manage_groups', 'patients_groups.read' THEN
            RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
          WHEN 'schedule.read', 'schedule.write' THEN
            RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
          ELSE
            RETURN false;
        END CASE;
      END IF;
      RETURN false;
  END CASE;
END;
$$;

-- [RPC/FUNCTION] current_user_can_role_capability (schema.sql L3169-L3461)
CREATE OR REPLACE FUNCTION "public"."current_user_can_role_capability"("_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _resolved_clinic_id uuid;
  _operational_role public.operational_role_type;
  _role_key text;
  _account_role public.account_role_type;
  _membership_status public.membership_status_type;
  _is_active boolean;
  _subscription_plan public.subscription_plan;
  _clinic_owner_id uuid;
  _override_enabled boolean;
  _sub record;
  _is_subscription_expired boolean := false;
  _is_read_only boolean := false;
  _is_owner boolean := false;
  _canonical_capability text := _capability;
  _is_clinic_tier boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Normalização de capacidades sinônimas/canônicas
  IF _capability IN ('patient_groups.write', 'patients_groups.write') THEN
    _canonical_capability := 'patients.manage_groups';
  ELSIF _capability IN ('patient_groups.read') THEN
    _canonical_capability := 'patients_groups.read';
  ELSIF _capability = 'agenda.read' THEN
    _canonical_capability := 'schedule.read';
  ELSIF _capability = 'agenda.write' THEN
    _canonical_capability := 'schedule.write';
  END IF;

  _resolved_clinic_id := COALESCE(_clinic_id, public.get_user_clinic_id(_user_id));

  -- Bypass para Platform Owner em contexto ativo
  IF _resolved_clinic_id IS NOT NULL
    AND public.is_platform_owner(_user_id)
    AND public.get_active_platform_clinic_id(_user_id) = _resolved_clinic_id THEN
    RETURN true;
  END IF;

  SELECT
    clinic_memberships.account_role,
    clinic_memberships.operational_role,
    clinic_memberships.role_key,
    clinic_memberships.membership_status,
    clinic_memberships.is_active,
    clinics.subscription_plan,
    clinics.account_owner_user_id
  INTO
    _account_role,
    _operational_role,
    _role_key,
    _membership_status,
    _is_active,
    _subscription_plan,
    _clinic_owner_id
  FROM public.clinic_memberships
  JOIN public.clinics ON clinics.id = clinic_memberships.clinic_id
  WHERE clinic_memberships.user_id = _user_id
    AND clinic_memberships.clinic_id = _resolved_clinic_id
  LIMIT 1;

  IF _resolved_clinic_id IS NULL
    OR _is_active IS DISTINCT FROM true
    OR _membership_status IS DISTINCT FROM 'active' THEN
    RETURN false;
  END IF;

  _is_owner := (_account_role = 'account_owner' OR _operational_role = 'owner' OR _clinic_owner_id = _user_id);
  _is_clinic_tier := (_subscription_plan::text IN ('clinic', 'enterprise', 'clinica_basico', 'clinica_medio', 'clinica_top', 'prof_top'));

  -- 1. Checagem de Assinatura e Read-Only
  SELECT * INTO _sub
  FROM public.clinic_subscriptions
  WHERE clinic_id = _resolved_clinic_id
  LIMIT 1;

  IF _sub IS NOT NULL THEN
    IF _sub.status = 'TRIAL_EXPIRED' AND NOT _is_owner THEN
      RETURN false;
    END IF;

    IF public.is_clinic_read_only(_resolved_clinic_id) THEN
      _is_read_only := true;
      IF (_sub.status IN ('TRIAL_EXPIRED', 'TRIAL')) AND NOT _is_owner THEN
        RETURN false;
      END IF;
    END IF;

    IF _sub.status NOT IN ('BETA', 'TRIAL', 'COURTESY') AND COALESCE(_sub.is_courtesy, false) = false THEN
      IF _sub.expires_at IS NOT NULL AND _sub.expires_at < now() THEN
        _is_subscription_expired := true;
      ELSIF _sub.status IN ('EXPIRED', 'SUSPENDED') THEN
        _is_subscription_expired := true;
      END IF;
    END IF;
  END IF;

  IF _is_read_only OR _is_subscription_expired THEN
    IF _capability = 'subscription_billing.manage' AND _is_owner THEN
      RETURN true;
    END IF;

    IF _capability IN (
      'patients.read',
      'schedule.read',
      'schedule.read_all',
      'agenda.read',
      'sessions.read',
      'sessions.read_all',
      'patient_groups.read',
      'patients_groups.read',
      'subaccounts_analytics.read',
      'subaccounts.read',
      'subaccounts_roles.read',
      'clinic_profile.read',
      'forms.read',
      'anamnesis_forms.read',
      'treasury.read',
      'subscription_billing.read'
    ) OR _canonical_capability IN (
      'patients.read',
      'schedule.read',
      'schedule.read_all',
      'agenda.read',
      'sessions.read',
      'sessions.read_all',
      'patient_groups.read',
      'patients_groups.read',
      'subaccounts_analytics.read',
      'subaccounts.read',
      'subaccounts_roles.read',
      'clinic_profile.read',
      'forms.read',
      'anamnesis_forms.read',
      'treasury.read',
      'subscription_billing.read'
    ) THEN
      RETURN true;
    END IF;

    RETURN false;
  END IF;

  -- 2. Salvaguarda de Plano: Em planos monoposto, subaccounts.* e roles.* são expressamente desabilitados mesmo para o owner
  IF NOT _is_clinic_tier AND _canonical_capability IN (
    'subaccounts.write',
    'subaccounts.manage',
    'subaccounts.delete',
    'subaccounts_roles.manage',
    'team_development.manage'
  ) THEN
    RETURN false;
  END IF;

  IF _is_owner THEN
    RETURN true;
  END IF;

  IF _capability = 'subscription_billing.manage' THEN
    RETURN false;
  END IF;

  -- 3. Checagem de Override na tabela clinic_operational_role_capabilities
  IF _role_key IS NOT NULL AND _role_key <> '' THEN
    SELECT enabled
    INTO _override_enabled
    FROM public.clinic_operational_role_capabilities
    WHERE clinic_id = _resolved_clinic_id
      AND operational_role = _role_key
      AND capability IN (_capability, _canonical_capability)
    ORDER BY (capability = _canonical_capability) DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN _override_enabled;
    END IF;
  END IF;

  SELECT enabled
    INTO _override_enabled
    FROM public.clinic_operational_role_capabilities
    WHERE clinic_id = _resolved_clinic_id
      AND operational_role = _operational_role::text
      AND capability IN (_capability, _canonical_capability)
    ORDER BY (capability = _canonical_capability) DESC
    LIMIT 1;

  IF FOUND THEN
    RETURN _override_enabled;
  END IF;

  -- 4. Matriz Padrão Canônica de Permissões
  CASE _capability
    WHEN 'clinic_profile.read' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'clinic_profile.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'clinic_terms.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'clinic_trash.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'forms.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'forms.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.read' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.write' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.manage' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.delete' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.read' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.manage' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'subscription_billing.read' THEN
      RETURN _is_owner;
    WHEN 'team_development.manage' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'treasury.read' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'treasury.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'agenda.delete_events' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_analytics.read' THEN
      RETURN _is_clinic_tier AND _operational_role IN ('owner', 'admin');
    WHEN 'marketing.affiliates.view' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'marketing.affiliates.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'marketing.affiliates.withdraw' THEN
      RETURN _is_owner OR _operational_role = 'owner';
    WHEN 'patients.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'patients.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'patients.delete' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'patients.manage_exclusive' THEN
      RETURN _operational_role = 'owner';
    WHEN 'patients.manage_groups', 'patient_groups.write', 'patients_groups.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'patient_groups.read', 'patients_groups.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
    WHEN 'agenda.read', 'schedule.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.read_all' THEN
      RETURN _operational_role IN ('owner', 'admin', 'assistant');
    WHEN 'agenda.write', 'schedule.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.write_others' THEN
      RETURN _operational_role IN ('owner', 'admin', 'assistant');
    WHEN 'sessions.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'estagiario');
    WHEN 'sessions.read_all' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'sessions.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'estagiario');
    WHEN 'sessions.write_others' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'sessions.share' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'sessions.delete' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'session.delete_draft' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'system.print' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    ELSE
      IF _canonical_capability <> _capability THEN
        CASE _canonical_capability
          WHEN 'patients.manage_groups', 'patients_groups.read' THEN
            RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
          WHEN 'schedule.read', 'schedule.write' THEN
            RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant', 'estagiario');
          ELSE
            RETURN false;
        END CASE;
      END IF;
      RETURN false;
  END CASE;
END;
$$;

-- [RPC/FUNCTION] has_role (schema.sql L7999-L8007)
CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- [TABLE] clinic_operational_roles (schema.sql L15720-L15734)
CREATE TABLE IF NOT EXISTS "public"."clinic_operational_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "role_key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "base_operational_role" "public"."operational_role_type" DEFAULT 'professional'::"public"."operational_role_type" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_system" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "clinic_operational_roles_key_shape" CHECK (("role_key" ~ '^[a-z][a-z0-9_]{1,39}$'::"text")),
    CONSTRAINT "clinic_operational_roles_label_not_blank" CHECK (("btrim"("label") <> ''::"text")),
    CONSTRAINT "clinic_operational_roles_no_custom_owner" CHECK ((("is_system" = true) OR ("role_key" <> 'owner'::"text")))
);

-- [TABLE] user_roles (schema.sql L16984-L16988)
CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL
);

-- [POLICY] Super admins manage all roles ON user_roles (schema.sql L19956-L19956)
CREATE POLICY "Super admins manage all roles" ON "public"."user_roles" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));

-- [POLICY] Users read own roles ON user_roles (schema.sql L20183-L20183)
CREATE POLICY "Users read own roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

-- [POLICY] operational roles are manageable by role admins ON clinic_operational_roles (schema.sql L20416-L20416)
CREATE POLICY "operational roles are manageable by role admins" ON "public"."clinic_operational_roles" USING ("public"."current_user_can"('subaccounts_roles.manage'::"text", "clinic_id")) WITH CHECK ("public"."current_user_can"('subaccounts_roles.manage'::"text", "clinic_id"));

-- [POLICY] operational roles are readable by clinic members ON clinic_operational_roles (schema.sql L20420-L20420)
CREATE POLICY "operational roles are readable by clinic members" ON "public"."clinic_operational_roles" FOR SELECT USING ("public"."user_has_active_clinic_membership"("auth"."uid"(), "clinic_id"));

-- [POLICY] platform owners can manage all clinic operational role capabili ON clinic_operational_role_capabilities (schema.sql L20459-L20459)
CREATE POLICY "platform owners can manage all clinic operational role capabili" ON "public"."clinic_operational_role_capabilities" USING ("public"."is_platform_owner"("auth"."uid"())) WITH CHECK ("public"."is_platform_owner"("auth"."uid"()));

-- [POLICY] platform owners can manage all clinic operational roles ON clinic_operational_roles (schema.sql L20463-L20463)
CREATE POLICY "platform owners can manage all clinic operational roles" ON "public"."clinic_operational_roles" USING ("public"."is_platform_owner"("auth"."uid"())) WITH CHECK ("public"."is_platform_owner"("auth"."uid"()));

-- [POLICY] platform owners can read all clinic operational role capabiliti ON clinic_operational_role_capabilities (schema.sql L20467-L20467)
CREATE POLICY "platform owners can read all clinic operational role capabiliti" ON "public"."clinic_operational_role_capabilities" FOR SELECT USING ("public"."is_platform_owner"("auth"."uid"()));

-- [POLICY] platform owners can read all clinic operational roles ON clinic_operational_roles (schema.sql L20471-L20471)
CREATE POLICY "platform owners can read all clinic operational roles" ON "public"."clinic_operational_roles" FOR SELECT USING ("public"."is_platform_owner"("auth"."uid"()));

-- [POLICY] role capabilities are manageable by role admins ON clinic_operational_role_capabilities (schema.sql L20511-L20511)
CREATE POLICY "role capabilities are manageable by role admins" ON "public"."clinic_operational_role_capabilities" USING ("public"."current_user_can"('subaccounts_roles.manage'::"text", "clinic_id")) WITH CHECK ("public"."current_user_can"('subaccounts_roles.manage'::"text", "clinic_id"));

-- [POLICY] role capabilities are readable by clinic members ON clinic_operational_role_capabilities (schema.sql L20515-L20515)
CREATE POLICY "role capabilities are readable by clinic members" ON "public"."clinic_operational_role_capabilities" FOR SELECT USING ("public"."user_has_active_clinic_membership"("auth"."uid"(), "clinic_id"));
