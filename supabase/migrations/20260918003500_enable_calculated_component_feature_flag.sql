-- Migration: 20260918003500_enable_calculated_component_feature_flag.sql
-- Descrição: Assegura de forma incremental e idempotente a habilitação do componente 'calculated'
-- na feature flag 'forms_editor' para todos os escopos configurados.
-- Regra: Padrão Expand and Contract, estritamente não-destrutivo.

UPDATE public.feature_flags
SET 
  value = jsonb_set(
    value,
    '{components,calculated}',
    'true'::jsonb,
    true
  ),
  updated_at = now()
WHERE key = 'forms_editor'
  AND (value->'components'->'calculated') IS NULL;
