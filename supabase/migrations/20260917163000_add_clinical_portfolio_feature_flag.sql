-- Migration: 20260917163000_add_clinical_portfolio_feature_flag.sql
-- Descrição: Registro inicial seguro e idempotente da feature flag 'clinical_portfolio_enabled' (escopo global)
-- Regra: Padrão Expand and Contract, sem alterações destrutivas nem drop de tabelas.

insert into public.feature_flags (
  key,
  scope,
  clinic_id,
  tag_id,
  value,
  description,
  starts_at,
  expires_at,
  reason
)
values (
  'clinical_portfolio_enabled',
  'global',
  null,
  null,
  jsonb_build_object(
    'enabled', true,
    'show_lgpd_banner', true,
    'allow_clinic_filter', true,
    'allow_clinic_redirect', true
  ),
  'Habilita o acervo técnico seguro e o histórico de atendimentos realizados sob a responsabilidade do profissional no Espaço Pessoal (/espacopessoal).',
  null,
  null,
  'Configuração padrão inicial do Portfólio Clínico Profissional no escopo Global'
)
on conflict (key) where scope = 'global'
do nothing;
