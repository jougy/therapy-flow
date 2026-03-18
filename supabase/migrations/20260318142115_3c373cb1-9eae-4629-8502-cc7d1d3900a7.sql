
-- 1. Create clinics table
CREATE TABLE public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text UNIQUE NOT NULL,
  name text NOT NULL DEFAULT '',
  logo_url text,
  theme jsonb DEFAULT '{"primary": "221.2 83.2% 53.3%", "secondary": "210 40% 96.1%", "accent": "210 40% 96.1%"}'::jsonb,
  custom_fields jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- 2. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'clinic_admin', 'user');

-- 3. Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 6. Function to get user's clinic_id
CREATE OR REPLACE FUNCTION public.get_user_clinic_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clinic_id FROM public.profiles WHERE id = _user_id
$$;

-- 7. Add clinic_id to existing tables
ALTER TABLE public.patients ADD COLUMN clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE;
ALTER TABLE public.sessions ADD COLUMN clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE;
ALTER TABLE public.patient_groups ADD COLUMN clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE;

-- 8. RLS policies for clinics
CREATE POLICY "Super admins manage all clinics" ON public.clinics
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users read own clinic" ON public.clinics
FOR SELECT TO authenticated
USING (id = public.get_user_clinic_id(auth.uid()));

-- 9. RLS policies for profiles
CREATE POLICY "Users read own profile" ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "Super admins manage all profiles" ON public.profiles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Allow insert for new signups (trigger will handle this)
CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- 10. RLS for user_roles
CREATE POLICY "Users read own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Super admins manage all roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 11. Update patients RLS - scope to clinic
DROP POLICY IF EXISTS "Users manage own patients" ON public.patients;

CREATE POLICY "Users manage clinic patients" ON public.patients
FOR ALL TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()))
WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Super admins manage all patients" ON public.patients
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 12. Update sessions RLS
DROP POLICY IF EXISTS "Users manage own sessions" ON public.sessions;

CREATE POLICY "Users manage clinic sessions" ON public.sessions
FOR ALL TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()))
WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Super admins manage all sessions" ON public.sessions
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 13. Update patient_groups RLS
DROP POLICY IF EXISTS "Users manage own patient groups" ON public.patient_groups;

CREATE POLICY "Users manage clinic patient_groups" ON public.patient_groups
FOR ALL TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()))
WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Super admins manage all patient_groups" ON public.patient_groups
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 14. Trigger to update updated_at on clinics
CREATE TRIGGER update_clinics_updated_at
  BEFORE UPDATE ON public.clinics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
