-- Migration: Create placeholder system user for community_form_templates seeds
-- This user matches the UUID used in community_form_templates seed migrations
-- It ensures foreign key integrity in production

INSERT INTO auth.users (
  id,
  email,
  role,
  email_confirmed_at,
  created_at,
  updated_at,
  is_super_admin,
  raw_app_meta_data,
  raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'system@plurihealth.com',
  'authenticated',
  now(),
  now(),
  now(),
  FALSE,
  '{}',
  '{}'
)
ON CONFLICT (id) DO NOTHING;
