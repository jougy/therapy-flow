-- Migration: Sistema de Feedbacks e Avaliações de Usuários com Backoffice Master
-- Criação da tabela public.platform_feedbacks, índices e políticas RLS

CREATE TABLE IF NOT EXISTS public.platform_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  user_email text,
  user_name text,
  clinic_name text,
  ratings jsonb NOT NULL DEFAULT '[]'::jsonb,
  average_rating numeric(3,2),
  problem_report text,
  opinion text,
  page_url text,
  user_agent text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'archived')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para consultas rápidas no Backoffice e no usuário
CREATE INDEX IF NOT EXISTS idx_platform_feedbacks_created_at_desc
ON public.platform_feedbacks (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_feedbacks_user_id
ON public.platform_feedbacks (user_id);

CREATE INDEX IF NOT EXISTS idx_platform_feedbacks_clinic_id
ON public.platform_feedbacks (clinic_id);

CREATE INDEX IF NOT EXISTS idx_platform_feedbacks_status
ON public.platform_feedbacks (status);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.platform_feedbacks ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Authenticated users insert own feedback" ON public.platform_feedbacks;
CREATE POLICY "Authenticated users insert own feedback"
ON public.platform_feedbacks
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  OR user_id IS NULL
);

DROP POLICY IF EXISTS "Users read own feedback" ON public.platform_feedbacks;
CREATE POLICY "Users read own feedback"
ON public.platform_feedbacks
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  OR public.is_platform_owner((SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Platform owner manage feedbacks" ON public.platform_feedbacks;
CREATE POLICY "Platform owner manage feedbacks"
ON public.platform_feedbacks
FOR ALL
TO authenticated
USING (
  public.is_platform_owner((SELECT auth.uid()))
)
WITH CHECK (
  public.is_platform_owner((SELECT auth.uid()))
);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION public.touch_platform_feedbacks_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_feedbacks_updated_at ON public.platform_feedbacks;
CREATE TRIGGER trg_platform_feedbacks_updated_at
BEFORE UPDATE ON public.platform_feedbacks
FOR EACH ROW
EXECUTE FUNCTION public.touch_platform_feedbacks_updated_at();

-- RPC para envio de feedback com preenchimento automático de dados contextuais
CREATE OR REPLACE FUNCTION public.submit_user_platform_feedback(
  _clinic_id uuid,
  _ratings jsonb,
  _problem_report text DEFAULT NULL,
  _opinion text DEFAULT NULL,
  _page_url text DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _user_name text;
  _clinic_name text;
  _feedback_id uuid;
  _avg_rating numeric(3,2) := 0;
  _item jsonb;
  _sum numeric := 0;
  _count numeric := 0;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  -- 1. Obter dados do usuário
  SELECT email, COALESCE(NULLIF(trim(full_name), ''), NULLIF(trim(social_name), ''), email)
  INTO _user_email, _user_name
  FROM public.profiles
  WHERE id = _user_id;

  -- 2. Obter dados da clínica se informada
  IF _clinic_id IS NOT NULL THEN
    SELECT name
    INTO _clinic_name
    FROM public.clinics
    WHERE id = _clinic_id;
  END IF;

  -- 3. Calcular média de estrelas
  IF _ratings IS NOT NULL AND jsonb_array_length(_ratings) > 0 THEN
    FOR _item IN SELECT * FROM jsonb_array_elements(_ratings)
    LOOP
      IF (_item->>'rating') IS NOT NULL AND (_item->>'rating')::numeric > 0 THEN
        _sum := _sum + (_item->>'rating')::numeric;
        _count := _count + 1;
      END IF;
    END LOOP;

    IF _count > 0 THEN
      _avg_rating := ROUND((_sum / _count)::numeric, 2);
    END IF;
  END IF;

  -- 4. Inserir feedback
  INSERT INTO public.platform_feedbacks (
    user_id,
    clinic_id,
    user_email,
    user_name,
    clinic_name,
    ratings,
    average_rating,
    problem_report,
    opinion,
    page_url,
    user_agent,
    status
  )
  VALUES (
    _user_id,
    _clinic_id,
    _user_email,
    _user_name,
    _clinic_name,
    COALESCE(_ratings, '[]'::jsonb),
    _avg_rating,
    NULLIF(trim(_problem_report), ''),
    NULLIF(trim(_opinion), ''),
    NULLIF(trim(_page_url), ''),
    NULLIF(trim(_user_agent), ''),
    'pending'
  )
  RETURNING id INTO _feedback_id;

  RETURN _feedback_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_user_platform_feedback(uuid, jsonb, text, text, text, text) TO authenticated;
