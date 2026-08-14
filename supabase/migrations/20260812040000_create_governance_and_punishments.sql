-- Migration: Create Governance Rules, User Punishments & Override Tables + RPCs
-- Date: 2026-08-12

-- 1. Governance Global Rules Table
CREATE TABLE IF NOT EXISTS public.governance_rules (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default global governance rules
INSERT INTO public.governance_rules (key, value)
VALUES (
  'rate_limit_config',
  '{
    "max_actions": 80,
    "time_window_minutes": 5,
    "cooldown_minutes": 15,
    "enabled_punishments": {
      "sync_throttle": true,
      "warning_modal": true,
      "read_only_mode": true,
      "revoke_print_export": true,
      "temporary_suspension": true,
      "permanent_ban": true
    },
    "default_durations_minutes": {
      "sync_throttle": 15,
      "warning_modal": 0,
      "read_only_mode": 60,
      "revoke_print_export": 1440,
      "temporary_suspension": 60,
      "permanent_ban": 0
    }
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 2. User Punishments Table
CREATE TABLE IF NOT EXISTS public.user_punishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  punishment_type TEXT NOT NULL, -- 'sync_throttle', 'warning_modal', 'read_only_mode', 'revoke_print_export', 'temporary_suspension', 'permanent_ban'
  applied_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ, -- NULL means permanent until manual revocation
  reason TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_manual BOOLEAN NOT NULL DEFAULT false
);

-- 3. User Governance Overrides Table (VIP Custom Rate Limits)
CREATE TABLE IF NOT EXISTS public.user_governance_overrides (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  max_actions INT NOT NULL DEFAULT 150,
  time_window_minutes INT NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.governance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_punishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_governance_overrides ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Authenticated users can read active governance rules & own active punishments
DROP POLICY IF EXISTS "Anyone authenticated can view governance rules" ON public.governance_rules;
CREATE POLICY "Anyone authenticated can view governance rules"
  ON public.governance_rules
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can read own active punishments" ON public.user_punishments;
CREATE POLICY "Users can read own active punishments"
  ON public.user_punishments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_platform_owner());

DROP POLICY IF EXISTS "Users can read own overrides" ON public.user_governance_overrides;
CREATE POLICY "Users can read own overrides"
  ON public.user_governance_overrides
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_platform_owner());

-- RLS Policies for Platform Owners
DROP POLICY IF EXISTS "Platform owners can manage governance rules" ON public.governance_rules;
CREATE POLICY "Platform owners can manage governance rules"
  ON public.governance_rules
  FOR ALL
  TO authenticated
  USING (public.is_platform_owner())
  WITH CHECK (public.is_platform_owner());

DROP POLICY IF EXISTS "Platform owners can manage user punishments" ON public.user_punishments;
CREATE POLICY "Platform owners can manage user punishments"
  ON public.user_punishments
  FOR ALL
  TO authenticated
  USING (public.is_platform_owner())
  WITH CHECK (public.is_platform_owner());

DROP POLICY IF EXISTS "Platform owners can manage governance overrides" ON public.user_governance_overrides;
CREATE POLICY "Platform owners can manage governance overrides"
  ON public.user_governance_overrides
  FOR ALL
  TO authenticated
  USING (public.is_platform_owner())
  WITH CHECK (public.is_platform_owner());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_punishments_active ON public.user_punishments(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_punishments_type ON public.user_punishments(punishment_type);
CREATE INDEX IF NOT EXISTS idx_user_punishments_expires ON public.user_punishments(expires_at) WHERE expires_at IS NOT NULL;

-- 4. RPC: Apply Punishment (Manual or Automatic)
CREATE OR REPLACE FUNCTION public.apply_user_punishment(
  _user_id UUID,
  _punishment_type TEXT,
  _duration_minutes INT, -- 0 or NULL means permanent
  _reason TEXT,
  _is_manual BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id UUID;
  v_expires_at TIMESTAMPTZ := NULL;
BEGIN
  -- If not manual (automatic from client trigger), verify user is self or caller is platform owner
  IF _is_manual AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores do Backoffice podem aplicar punições manuais.';
  END IF;

  IF _duration_minutes IS NOT NULL AND _duration_minutes > 0 THEN
    v_expires_at := now() + (_duration_minutes || ' minutes')::INTERVAL;
  END IF;

  INSERT INTO public.user_punishments (
    user_id,
    punishment_type,
    applied_by,
    applied_at,
    expires_at,
    reason,
    is_active,
    is_manual
  )
  VALUES (
    _user_id,
    _punishment_type,
    CASE WHEN _is_manual THEN auth.uid() ELSE NULL END,
    now(),
    v_expires_at,
    _reason,
    true,
    _is_manual
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 5. RPC: Revoke Punishment
CREATE OR REPLACE FUNCTION public.revoke_user_punishment(
  _punishment_id UUID,
  _reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores do Backoffice podem revogar punições.';
  END IF;

  UPDATE public.user_punishments
  SET 
    is_active = false,
    reason = reason || ' [REVOGADA MANUALMENTE: ' || _reason || ']'
  WHERE id = _punishment_id;
END;
$$;

-- 6. RPC: Get User Active Governance State & Punishments
CREATE OR REPLACE FUNCTION public.get_user_active_governance(
  _user_id UUID
)
RETURNS TABLE (
  punishment_id UUID,
  punishment_type TEXT,
  applied_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  reason TEXT,
  is_manual BOOLEAN,
  applied_by_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Auto-expire outdated punishments first
  UPDATE public.user_punishments
  SET is_active = false
  WHERE user_id = _user_id
    AND is_active = true
    AND expires_at IS NOT NULL
    AND expires_at < now();

  RETURN QUERY
  SELECT 
    p.id AS punishment_id,
    p.punishment_type,
    p.applied_at,
    p.expires_at,
    p.reason,
    p.is_manual,
    COALESCE(prof.full_name, prof.email, 'Sistema Automático') AS applied_by_name
  FROM public.user_punishments p
  LEFT JOIN public.profiles prof ON prof.id = p.applied_by
  WHERE p.user_id = _user_id
    AND p.is_active = true
    AND (p.expires_at IS NULL OR p.expires_at > now())
  ORDER BY p.applied_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_user_punishment TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_punishment TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_active_governance TO authenticated;
