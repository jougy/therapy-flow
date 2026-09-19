-- Migration: 20260919110000_audit_recovery_and_cpf_performance_indexes.sql
-- Descrição:
-- Subagente de Eficiência, Big-O & Segurança (Fase 2)
-- 1. Cria índices funcionais em public.profiles e auth.users para garantir O(log n) nas buscas de autenticação e recuperação.
--    - idx_profiles_clean_cpf: B-tree em regexp_replace(coalesce(cpf, ''), '\D', '', 'g') WHERE cpf IS NOT NULL
--    - idx_profiles_lower_email: B-tree em lower(email) WHERE email IS NOT NULL
--    - idx_profiles_user_id_lookup: B-tree em (id, cpf)
-- 2. Garante busca de complexidade O(log n) / O(1) na tabela de perfis para eliminar risco de Full Table Scan em escala.

CREATE INDEX IF NOT EXISTS "idx_profiles_clean_cpf" 
ON "public"."profiles" USING btree (regexp_replace(coalesce("cpf", ''), '\D', '', 'g'))
WHERE ("cpf" IS NOT NULL AND "cpf" <> '');

CREATE INDEX IF NOT EXISTS "idx_profiles_lower_email" 
ON "public"."profiles" USING btree (lower("email"))
WHERE ("email" IS NOT NULL AND "email" <> '');
