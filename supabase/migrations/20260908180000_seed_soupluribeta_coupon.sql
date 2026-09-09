-- Migration: 20260908180000_seed_soupluribeta_coupon.sql
-- Descrição: Cadastra o cupom exclusivo SOUPLURIBETA que concede 6 meses (180 dias)
-- de isenção total de mensalidade para Beta Testers oficiais do Pluri-Health.

insert into public.subscription_coupons (
  code,
  description,
  discount_type,
  discount_value,
  max_redemptions,
  is_active,
  applicable_plans,
  valid_from
) values (
  'SOUPLURIBETA',
  'Acesso Beta Tester Gratuito por 6 Meses (180 dias de isenção total)',
  'TRIAL_DAYS',
  180.00,
  null,
  true,
  null,
  now()
)
on conflict (code) do update
set
  description = EXCLUDED.description,
  discount_type = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  is_active = true,
  updated_at = now();
