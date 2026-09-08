-- Migration: Permitir que operadores master da plataforma (platform_owner) consultem e gerenciem
-- papéis operacionais e permissões modulares de qualquer clínica no Backoffice.

DO $$
BEGIN
  -- 1. Políticas RLS para clinic_operational_roles
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clinic_operational_roles'
      AND policyname = 'platform owners can read all clinic operational roles'
  ) THEN
    CREATE POLICY "platform owners can read all clinic operational roles"
    ON public.clinic_operational_roles
    FOR SELECT
    USING (public.is_platform_owner(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clinic_operational_roles'
      AND policyname = 'platform owners can manage all clinic operational roles'
  ) THEN
    CREATE POLICY "platform owners can manage all clinic operational roles"
    ON public.clinic_operational_roles
    FOR ALL
    USING (public.is_platform_owner(auth.uid()))
    WITH CHECK (public.is_platform_owner(auth.uid()));
  END IF;

  -- 2. Políticas RLS para clinic_operational_role_capabilities
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clinic_operational_role_capabilities'
      AND policyname = 'platform owners can read all clinic operational role capabilities'
  ) THEN
    CREATE POLICY "platform owners can read all clinic operational role capabilities"
    ON public.clinic_operational_role_capabilities
    FOR SELECT
    USING (public.is_platform_owner(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clinic_operational_role_capabilities'
      AND policyname = 'platform owners can manage all clinic operational role capabilities'
  ) THEN
    CREATE POLICY "platform owners can manage all clinic operational role capabilities"
    ON public.clinic_operational_role_capabilities
    FOR ALL
    USING (public.is_platform_owner(auth.uid()))
    WITH CHECK (public.is_platform_owner(auth.uid()));
  END IF;
END
$$;

-- 3. Função RPC para carregar visão completa das hierarquias e modularizações da clínica
CREATE OR REPLACE FUNCTION public.get_platform_clinic_roles_overview(_clinic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _roles jsonb;
  _capabilities jsonb;
  _usage_counts jsonb;
BEGIN
  IF NOT public.is_platform_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas operadores master da plataforma podem consultar papéis operacionais de clínicas.';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'clinic_id', r.clinic_id,
        'role_key', r.role_key,
        'label', r.label,
        'description', r.description,
        'base_operational_role', r.base_operational_role,
        'sort_order', r.sort_order,
        'is_system', r.is_system,
        'created_at', r.created_at,
        'updated_at', r.updated_at
      ) ORDER BY r.sort_order ASC, r.label ASC
    ),
    '[]'::jsonb
  )
  INTO _roles
  FROM public.clinic_operational_roles r
  WHERE r.clinic_id = _clinic_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'clinic_id', c.clinic_id,
        'operational_role', c.operational_role,
        'capability', c.capability,
        'enabled', c.enabled,
        'created_at', c.created_at,
        'updated_at', c.updated_at
      )
    ),
    '[]'::jsonb
  )
  INTO _capabilities
  FROM public.clinic_operational_role_capabilities c
  WHERE c.clinic_id = _clinic_id;

  SELECT COALESCE(
    jsonb_object_agg(sub.operational_role, sub.total),
    '{}'::jsonb
  )
  INTO _usage_counts
  FROM (
    SELECT cm.operational_role::text AS operational_role, count(*)::int AS total
    FROM public.clinic_memberships cm
    WHERE cm.clinic_id = _clinic_id
      AND cm.membership_status <> 'invited'
      AND cm.is_active = true
    GROUP BY cm.operational_role
  ) sub;

  RETURN jsonb_build_object(
    'roles', _roles,
    'capabilities', _capabilities,
    'usage_counts', _usage_counts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_platform_clinic_roles_overview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_platform_clinic_roles_overview(uuid) TO authenticated;
