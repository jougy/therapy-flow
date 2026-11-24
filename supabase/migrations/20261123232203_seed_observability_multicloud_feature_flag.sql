-- Migration: Seed idempotente da feature flag observability_multicloud_engine
INSERT INTO public.feature_flags (key, scope, value, description)
VALUES (
  'observability_multicloud_engine',
  'global',
  '{"enabled": true, "metricsDriver": "upstash_redis", "errorLogsDriver": "axiom", "samplingRatePercent": 100}'::jsonb,
  'Motor multicloud de observabilidade (Upstash Redis + Axiom) para zerar Disk I/O de telemetria e logs no Postgres'
)
ON CONFLICT DO NOTHING;
