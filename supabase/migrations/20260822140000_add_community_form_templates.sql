-- Migration: Add community form templates library and interaction RPCs
CREATE TABLE IF NOT EXISTS public.community_form_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  clinic_name text,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'Geral',
  tags text[] NOT NULL DEFAULT '{}',
  schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  kind text NOT NULL DEFAULT 'template', -- 'template' ou 'base'
  imports_count integer NOT NULL DEFAULT 0,
  likes_count integer NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_form_template_likes (
  template_id uuid NOT NULL REFERENCES public.community_form_templates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_community_form_templates_published ON public.community_form_templates(is_published, category);
CREATE INDEX IF NOT EXISTS idx_community_form_templates_user_id ON public.community_form_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_community_form_templates_created_at ON public.community_form_templates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_form_template_likes_user ON public.community_form_template_likes(user_id);

-- Updated_at trigger
CREATE TRIGGER update_community_form_templates_updated_at
BEFORE UPDATE ON public.community_form_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.community_form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_form_template_likes ENABLE ROW LEVEL SECURITY;

-- Policies for community_form_templates
CREATE POLICY "Anyone authenticated can view published community templates"
ON public.community_form_templates
FOR SELECT
TO authenticated
USING (is_published = true OR user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Authenticated users can publish community templates"
ON public.community_form_templates
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authors and super admins can update own community templates"
ON public.community_form_templates
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Authors and super admins can delete own community templates"
ON public.community_form_templates
FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- Policies for likes
CREATE POLICY "Authenticated users can view template likes"
ON public.community_form_template_likes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage their own likes"
ON public.community_form_template_likes
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authenticated users can remove their own likes"
ON public.community_form_template_likes
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- RPC: Increment import count
CREATE OR REPLACE FUNCTION public.increment_community_template_import(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.community_form_templates
  SET imports_count = imports_count + 1
  WHERE id = p_template_id AND is_published = true;
END;
$$;

-- RPC: Toggle template like
CREATE OR REPLACE FUNCTION public.toggle_community_template_like(p_template_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_liked boolean;
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF EXISTS (SELECT 1 FROM public.community_form_template_likes WHERE template_id = p_template_id AND user_id = v_user_id) THEN
    DELETE FROM public.community_form_template_likes WHERE template_id = p_template_id AND user_id = v_user_id;
    UPDATE public.community_form_templates
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = p_template_id;
    v_liked := false;
  ELSE
    INSERT INTO public.community_form_template_likes (template_id, user_id)
    VALUES (p_template_id, v_user_id)
    ON CONFLICT DO NOTHING;
    UPDATE public.community_form_templates
    SET likes_count = likes_count + 1
    WHERE id = p_template_id;
    v_liked := true;
  END IF;

  SELECT likes_count INTO v_count FROM public.community_form_templates WHERE id = p_template_id;

  RETURN jsonb_build_object('liked', v_liked, 'likes_count', COALESCE(v_count, 0));
END;
$$;
