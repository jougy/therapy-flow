DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_plan') THEN
    CREATE TYPE public.subscription_plan AS ENUM ('solo', 'clinic');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_role_type') THEN
    CREATE TYPE public.account_role_type AS ENUM ('account_owner');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operational_role_type') THEN
    CREATE TYPE public.operational_role_type AS ENUM ('owner', 'admin', 'professional', 'assistant');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_status_type') THEN
    CREATE TYPE public.membership_status_type AS ENUM ('invited', 'active', 'inactive', 'suspended');
  END IF;
END
$$;

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS business_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS subscription_plan public.subscription_plan NOT NULL DEFAULT 'solo',
  ADD COLUMN IF NOT EXISTS account_owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subaccount_limit integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS social_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS specialty text,
  ADD COLUMN IF NOT EXISTS specialties jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS professional_license text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.clinic_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_role public.account_role_type,
  operational_role public.operational_role_type NOT NULL DEFAULT 'professional',
  membership_status public.membership_status_type NOT NULL DEFAULT 'active',
  is_active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, user_id)
);

ALTER TABLE public.clinic_memberships ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_clinic_memberships_clinic_id
ON public.clinic_memberships(clinic_id);

CREATE INDEX IF NOT EXISTS idx_clinic_memberships_user_id
ON public.clinic_memberships(user_id);

DROP TRIGGER IF EXISTS update_clinic_memberships_updated_at ON public.clinic_memberships;
CREATE TRIGGER update_clinic_memberships_updated_at
BEFORE UPDATE ON public.clinic_memberships
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

WITH ranked_profiles AS (
  SELECT
    profiles.id AS user_id,
    profiles.clinic_id,
    profiles.created_at,
    row_number() OVER (PARTITION BY profiles.clinic_id ORDER BY profiles.created_at, profiles.id) AS clinic_rank,
    count(*) OVER (PARTITION BY profiles.clinic_id) AS clinic_user_count
  FROM public.profiles
)
UPDATE public.clinics
SET
  subscription_plan = CASE WHEN ranked_profiles.clinic_user_count > 1 THEN 'clinic'::public.subscription_plan ELSE 'solo'::public.subscription_plan END,
  subaccount_limit = CASE WHEN ranked_profiles.clinic_user_count > 1 THEN 4 ELSE 0 END
FROM ranked_profiles
WHERE ranked_profiles.clinic_id = clinics.id
  AND ranked_profiles.clinic_rank = 1;

INSERT INTO public.clinic_memberships (
  clinic_id,
  user_id,
  account_role,
  operational_role,
  membership_status,
  is_active,
  joined_at,
  created_at,
  updated_at
)
SELECT
  ranked_profiles.clinic_id,
  ranked_profiles.user_id,
  CASE WHEN ranked_profiles.clinic_rank = 1 THEN 'account_owner'::public.account_role_type ELSE NULL END,
  CASE WHEN ranked_profiles.clinic_rank = 1 THEN 'owner'::public.operational_role_type ELSE 'professional'::public.operational_role_type END,
  'active'::public.membership_status_type,
  true,
  ranked_profiles.created_at,
  ranked_profiles.created_at,
  now()
FROM (
  SELECT
    profiles.id AS user_id,
    profiles.clinic_id,
    profiles.created_at,
    row_number() OVER (PARTITION BY profiles.clinic_id ORDER BY profiles.created_at, profiles.id) AS clinic_rank
  FROM public.profiles
) AS ranked_profiles
ON CONFLICT (clinic_id, user_id) DO NOTHING;

UPDATE public.clinics
SET account_owner_user_id = owners.user_id
FROM (
  SELECT DISTINCT ON (clinic_id)
    clinic_id,
    user_id
  FROM public.clinic_memberships
  WHERE account_role = 'account_owner'
  ORDER BY clinic_id, created_at ASC
) AS owners
WHERE owners.clinic_id = clinics.id
  AND clinics.account_owner_user_id IS NULL;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.sessions
SET provider_id = user_id
WHERE provider_id IS NULL;

CREATE OR REPLACE FUNCTION public.get_user_clinic_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clinic_id
  FROM public.clinic_memberships
  WHERE user_id = _user_id
    AND is_active = true
    AND membership_status = 'active'
  ORDER BY
    CASE WHEN account_role = 'account_owner' THEN 0 ELSE 1 END,
    created_at ASC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_can(_capability text, _clinic_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _resolved_clinic_id uuid;
  _account_role public.account_role_type;
  _operational_role public.operational_role_type;
  _membership_status public.membership_status_type;
  _is_active boolean;
  _subscription_plan public.subscription_plan;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  _resolved_clinic_id := COALESCE(_clinic_id, public.get_user_clinic_id(_user_id));

  SELECT
    clinic_memberships.account_role,
    clinic_memberships.operational_role,
    clinic_memberships.membership_status,
    clinic_memberships.is_active,
    clinics.subscription_plan
  INTO
    _account_role,
    _operational_role,
    _membership_status,
    _is_active,
    _subscription_plan
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

  IF _account_role = 'account_owner' THEN
    RETURN true;
  END IF;

  CASE _capability
    WHEN 'clinic_profile.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'forms.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts.manage' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_roles.manage' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'subscription_billing.manage' THEN
      RETURN false;
    WHEN 'treasury.manage' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'agenda.delete_events' THEN
      RETURN _operational_role IN ('owner', 'admin');
    WHEN 'subaccounts_analytics.read' THEN
      RETURN _subscription_plan = 'clinic' AND _operational_role IN ('owner', 'admin');
    WHEN 'patients.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'patients.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'schedule.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional', 'assistant');
    WHEN 'sessions.read' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'sessions.write' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    WHEN 'session.delete_draft' THEN
      RETURN _operational_role IN ('owner', 'admin', 'professional');
    ELSE
      RETURN false;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_signup(
  _user_id uuid,
  _email text,
  _cnpj text,
  _subscription_plan public.subscription_plan DEFAULT 'solo',
  _full_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clinic_id uuid;
  _is_super_admin boolean := false;
BEGIN
  SELECT id INTO _clinic_id
  FROM public.clinics
  WHERE cnpj = _cnpj;

  IF _clinic_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ja existe uma clinica cadastrada com este CNPJ.';
  END IF;

  INSERT INTO public.clinics (
    cnpj,
    name,
    subscription_plan,
    subaccount_limit
  )
  VALUES (
    _cnpj,
    'Clínica ' || _cnpj,
    _subscription_plan,
    CASE WHEN _subscription_plan = 'clinic' THEN 4 ELSE 0 END
  )
  RETURNING id INTO _clinic_id;

  INSERT INTO public.profiles (id, clinic_id, email, full_name)
  VALUES (_user_id, _clinic_id, _email, _full_name)
  ON CONFLICT (id) DO UPDATE
  SET clinic_id = EXCLUDED.clinic_id,
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  INSERT INTO public.clinic_memberships (
    clinic_id,
    user_id,
    account_role,
    operational_role,
    membership_status,
    is_active
  )
  VALUES (
    _clinic_id,
    _user_id,
    'account_owner',
    'owner',
    'active',
    true
  )
  ON CONFLICT (clinic_id, user_id) DO NOTHING;

  UPDATE public.clinics
  SET account_owner_user_id = _user_id
  WHERE id = _clinic_id;

  IF _email = 'admin@prontohealthfisio.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    _is_super_admin := true;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'clinic_id', _clinic_id,
    'subscription_plan', _subscription_plan,
    'is_super_admin', _is_super_admin
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_user_clinic(_user_id uuid, _cnpj text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_memberships
    JOIN public.clinics ON clinics.id = clinic_memberships.clinic_id
    WHERE clinic_memberships.user_id = _user_id
      AND clinic_memberships.is_active = true
      AND clinic_memberships.membership_status = 'active'
      AND clinics.cnpj = _cnpj
  )
$$;

DROP POLICY IF EXISTS "Users read own clinic" ON public.clinics;
CREATE POLICY "Users read own clinic" ON public.clinics
FOR SELECT TO authenticated
USING (id = public.get_user_clinic_id(auth.uid()));

DROP POLICY IF EXISTS "Users update managed clinic" ON public.clinics;
CREATE POLICY "Users update managed clinic" ON public.clinics
FOR UPDATE TO authenticated
USING (public.current_user_can('clinic_profile.manage', id))
WITH CHECK (public.current_user_can('clinic_profile.manage', id));

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read clinic profiles" ON public.profiles
FOR SELECT TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Managers update clinic profiles" ON public.profiles;
CREATE POLICY "Managers update clinic profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (public.current_user_can('subaccounts.manage', clinic_id))
WITH CHECK (public.current_user_can('subaccounts.manage', clinic_id));

DROP POLICY IF EXISTS "Users read clinic memberships" ON public.clinic_memberships;
CREATE POLICY "Users read clinic memberships" ON public.clinic_memberships
FOR SELECT TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()));

DROP POLICY IF EXISTS "Managers insert clinic memberships" ON public.clinic_memberships;
CREATE POLICY "Managers insert clinic memberships" ON public.clinic_memberships
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_can('subaccounts.manage', clinic_id)
  AND EXISTS (
    SELECT 1
    FROM public.clinics
    WHERE clinics.id = clinic_memberships.clinic_id
      AND clinics.subscription_plan = 'clinic'
  )
);

DROP POLICY IF EXISTS "Managers update clinic memberships" ON public.clinic_memberships;
CREATE POLICY "Managers update clinic memberships" ON public.clinic_memberships
FOR UPDATE TO authenticated
USING (public.current_user_can('subaccounts.manage', clinic_id))
WITH CHECK (public.current_user_can('subaccounts.manage', clinic_id));

DROP POLICY IF EXISTS "Users manage clinic patients" ON public.patients;
CREATE POLICY "Users read clinic patients" ON public.patients
FOR SELECT TO authenticated
USING (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('patients.read', clinic_id)
);

DROP POLICY IF EXISTS "Users write clinic patients" ON public.patients;
CREATE POLICY "Users write clinic patients" ON public.patients
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('patients.write', clinic_id)
);

DROP POLICY IF EXISTS "Users update clinic patients" ON public.patients;
CREATE POLICY "Users update clinic patients" ON public.patients
FOR UPDATE TO authenticated
USING (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('patients.write', clinic_id)
)
WITH CHECK (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('patients.write', clinic_id)
);

DROP POLICY IF EXISTS "Users manage clinic sessions" ON public.sessions;
CREATE POLICY "Users read clinic sessions" ON public.sessions
FOR SELECT TO authenticated
USING (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('sessions.read', clinic_id)
);

DROP POLICY IF EXISTS "Users insert clinic sessions" ON public.sessions;
CREATE POLICY "Users insert clinic sessions" ON public.sessions
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('sessions.write', clinic_id)
);

DROP POLICY IF EXISTS "Users update clinic sessions" ON public.sessions;
CREATE POLICY "Users update clinic sessions" ON public.sessions
FOR UPDATE TO authenticated
USING (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('sessions.write', clinic_id)
)
WITH CHECK (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('sessions.write', clinic_id)
);

DROP POLICY IF EXISTS "Users delete clinic draft sessions" ON public.sessions;
CREATE POLICY "Users delete clinic draft sessions" ON public.sessions
FOR DELETE TO authenticated
USING (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND status = 'rascunho'
  AND public.current_user_can('session.delete_draft', clinic_id)
);

DROP POLICY IF EXISTS "Users manage clinic patient_groups" ON public.patient_groups;
CREATE POLICY "Users read clinic patient_groups" ON public.patient_groups
FOR SELECT TO authenticated
USING (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('patients.read', clinic_id)
);

DROP POLICY IF EXISTS "Users write clinic patient_groups" ON public.patient_groups;
CREATE POLICY "Users write clinic patient_groups" ON public.patient_groups
FOR ALL TO authenticated
USING (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('patients.write', clinic_id)
)
WITH CHECK (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('patients.write', clinic_id)
);

DROP POLICY IF EXISTS "Users manage clinic agenda events" ON public.agenda_events;
CREATE POLICY "Users read clinic agenda events" ON public.agenda_events
FOR SELECT TO authenticated
USING (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('schedule.read', clinic_id)
);

DROP POLICY IF EXISTS "Users write clinic agenda events" ON public.agenda_events;
CREATE POLICY "Users write clinic agenda events" ON public.agenda_events
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('schedule.write', clinic_id)
);

DROP POLICY IF EXISTS "Users update clinic agenda events" ON public.agenda_events;
CREATE POLICY "Users update clinic agenda events" ON public.agenda_events
FOR UPDATE TO authenticated
USING (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('schedule.write', clinic_id)
)
WITH CHECK (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('schedule.write', clinic_id)
);

DROP POLICY IF EXISTS "Users delete clinic agenda events" ON public.agenda_events;
CREATE POLICY "Users delete clinic agenda events" ON public.agenda_events
FOR DELETE TO authenticated
USING (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('agenda.delete_events', clinic_id)
);

DROP POLICY IF EXISTS "Users manage clinic anamnesis forms" ON public.anamnesis_form_templates;
CREATE POLICY "Users read clinic anamnesis forms" ON public.anamnesis_form_templates
FOR SELECT TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()));

DROP POLICY IF EXISTS "Users write clinic anamnesis forms" ON public.anamnesis_form_templates;
CREATE POLICY "Users write clinic anamnesis forms" ON public.anamnesis_form_templates
FOR ALL TO authenticated
USING (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('forms.manage', clinic_id)
)
WITH CHECK (
  clinic_id = public.get_user_clinic_id(auth.uid())
  AND public.current_user_can('forms.manage', clinic_id)
);
