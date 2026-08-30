-- Migration: 20260827100000_drop_clinics_cnpj_unique_constraint.sql
-- Descricao: Remove a constraint de unicidade direta clinics_cnpj_key na tabela clinics para permitir que o mesmo proprietario (owner) cadastre multiplas clinicas/espacos com o mesmo CNPJ.

ALTER TABLE public.clinics DROP CONSTRAINT IF EXISTS clinics_cnpj_key;
DROP INDEX IF EXISTS public.clinics_cnpj_key;

-- O controle de seguranca contra uso indevido de CNPJ por outros usuarios continua 100% garantido na funcao public.handle_signup
