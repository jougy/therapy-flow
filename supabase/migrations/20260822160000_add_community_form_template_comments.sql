-- Migration: Add comments and reviews for community form templates
CREATE TABLE IF NOT EXISTS public.community_form_template_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.community_form_templates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  clinic_name text,
  content text NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_community_template_comments_template ON public.community_form_template_comments(template_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_template_comments_user ON public.community_form_template_comments(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_community_form_template_comments_updated_at
BEFORE UPDATE ON public.community_form_template_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.community_form_template_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read comments"
ON public.community_form_template_comments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert comments"
ON public.community_form_template_comments
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users and admins can delete own comments"
ON public.community_form_template_comments
FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
