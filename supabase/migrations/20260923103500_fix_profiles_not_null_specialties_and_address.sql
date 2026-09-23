-- Migration: 20260923103500_fix_profiles_not_null_specialties_and_address.sql
-- Description:
--   Remove a restrição NOT NULL das colunas "specialties" e "address" na tabela "public.profiles".
--   Na migration 20260917032000_storage_bloat_reduction_and_ttl.sql o DEFAULT dessas colunas foi
--   alterado para NULL, porém sem 'DROP NOT NULL'. Isso fazia com que inserções de perfil sem
--   essas colunas (ex: accept_clinic_collaborator_invitation, accept_current_user_clinic_invitation,
--   create_clinic_subaccount, handle_personal_signup, handle_signup) disparassem a violação:
--   "null value in column "specialties" of relation "profiles" violates not-null constraint".

ALTER TABLE public.profiles
  ALTER COLUMN specialties DROP NOT NULL,
  ALTER COLUMN address DROP NOT NULL;
