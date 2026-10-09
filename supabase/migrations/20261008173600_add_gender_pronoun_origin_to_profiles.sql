-- Migration: 20261008173600_add_gender_pronoun_origin_to_profiles.sql
-- Descrição:
-- 1. Adiciona as colunas gender, preferred_pronoun, signup_origin e signup_utm na tabela public.profiles se não existirem.
-- 2. Adiciona comentários descritivos nas novas colunas para compliance e documentação viva.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS preferred_pronoun text,
  ADD COLUMN IF NOT EXISTS signup_origin text,
  ADD COLUMN IF NOT EXISTS signup_utm jsonb;

COMMENT ON COLUMN public.profiles.gender IS 'Gênero autodeclarado do profissional/usuário (ex: Feminino, Masculino, Não-binário, Outro, Prefiro não informar).';
COMMENT ON COLUMN public.profiles.preferred_pronoun IS 'Pronome de preferência de tratamento (ex: Ela/Dela, Ele/Dele, Elu/Delu).';
COMMENT ON COLUMN public.profiles.signup_origin IS 'Origem ou canal de aquisição do cadastro inicial (ex: instagram, google, landing_page, convite_clinica, indicacao).';
COMMENT ON COLUMN public.profiles.signup_utm IS 'Metadados e parâmetros UTM capturados no momento do cadastro (utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer).';
