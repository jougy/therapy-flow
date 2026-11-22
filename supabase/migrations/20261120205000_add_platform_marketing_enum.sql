-- Migration: 20261120205000_add_platform_marketing_enum.sql
-- Description: Adiciona o valor 'platform_marketing' ao enum public.platform_admin_role.
-- Executada em migration dedicada antes de 20261120205100 para que o novo valor de enum
-- seja commitado antes de ser referenciado em DML/PLpgSQL (previne SQLSTATE 55P04).

ALTER TYPE public.platform_admin_role ADD VALUE IF NOT EXISTS 'platform_marketing';
