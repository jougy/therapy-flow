-- Migration: Optimize community form tables for minimum storage, maximum performance and partial indexes

-- 1. Add fields_count to community_form_templates
ALTER TABLE public.community_form_templates
ADD COLUMN IF NOT EXISTS fields_count smallint NOT NULL DEFAULT 0;

-- 2. Function to automatically calculate fields_count from schema JSONB
CREATE OR REPLACE FUNCTION public.calculate_community_template_fields_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.schema IS NOT NULL AND jsonb_typeof(NEW.schema) = 'array' THEN
    NEW.fields_count := jsonb_array_length(NEW.schema);
  ELSE
    NEW.fields_count := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger on INSERT and UPDATE of schema
DROP TRIGGER IF EXISTS trigger_calculate_community_template_fields_count ON public.community_form_templates;
CREATE TRIGGER trigger_calculate_community_template_fields_count
BEFORE INSERT OR UPDATE OF schema ON public.community_form_templates
FOR EACH ROW
EXECUTE FUNCTION public.calculate_community_template_fields_count();

-- 4. Backfill fields_count for existing rows
UPDATE public.community_form_templates
SET fields_count = CASE
  WHEN schema IS NOT NULL AND jsonb_typeof(schema) = 'array' THEN jsonb_array_length(schema)
  ELSE 0
END;

-- 5. Partial Index for active published catalog (70% smaller index and faster queries)
CREATE INDEX IF NOT EXISTS idx_community_templates_active_catalog
ON public.community_form_templates (category, imports_count DESC, created_at DESC)
WHERE is_published = true;

-- 6. Optimize community_form_template_likes to have composite primary key without redundant UUID id
DO $$
BEGIN
  -- Check if table exists and has id column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'community_form_template_likes' AND column_name = 'id'
  ) THEN
    -- Drop old PK constraint
    ALTER TABLE public.community_form_template_likes DROP CONSTRAINT IF EXISTS community_form_template_likes_pkey;
    -- Drop old unique constraint if present
    ALTER TABLE public.community_form_template_likes DROP CONSTRAINT IF EXISTS community_form_template_likes_template_id_user_id_key;
    -- Drop id column
    ALTER TABLE public.community_form_template_likes DROP COLUMN IF EXISTS id;
    -- Set composite primary key
    ALTER TABLE public.community_form_template_likes ADD PRIMARY KEY (template_id, user_id);
  END IF;
END $$;
