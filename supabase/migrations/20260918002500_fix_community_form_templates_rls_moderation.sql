-- Migration: Allow platform owners to moderate, update and delete community form templates
-- Ensures platform admins can toggle 'is_featured', toggle 'is_published', edit and delete official/community templates

-- 1. SELECT policy: authenticated users can view published, authors can view own, super_admins and platform owners can view all
DROP POLICY IF EXISTS "Anyone authenticated can view published community templates" ON public.community_form_templates;
CREATE POLICY "Anyone authenticated can view published community templates"
ON public.community_form_templates
FOR SELECT
TO authenticated
USING (
  is_published = true 
  OR user_id = auth.uid() 
  OR public.has_role(auth.uid(), 'super_admin') 
  OR public.is_platform_owner(auth.uid())
);

-- 2. UPDATE policy: authors, super admins and platform owners can update
DROP POLICY IF EXISTS "Authors and super admins can update own community templates" ON public.community_form_templates;
DROP POLICY IF EXISTS "Authors, super admins and platform owners can update community templates" ON public.community_form_templates;
CREATE POLICY "Authors, super admins and platform owners can update community templates"
ON public.community_form_templates
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.has_role(auth.uid(), 'super_admin') 
  OR public.is_platform_owner(auth.uid())
)
WITH CHECK (
  user_id = auth.uid() 
  OR public.has_role(auth.uid(), 'super_admin') 
  OR public.is_platform_owner(auth.uid())
);

-- 3. DELETE policy: authors, super admins and platform owners can delete
DROP POLICY IF EXISTS "Authors and super admins can delete own community templates" ON public.community_form_templates;
DROP POLICY IF EXISTS "Authors, super admins and platform owners can delete community templates" ON public.community_form_templates;
CREATE POLICY "Authors, super admins and platform owners can delete community templates"
ON public.community_form_templates
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.has_role(auth.uid(), 'super_admin') 
  OR public.is_platform_owner(auth.uid())
);
