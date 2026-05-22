alter table public.sessions
add column if not exists amount_original_cents integer not null default 0,
add column if not exists payment_adjustment_reason text;

update public.sessions
set amount_original_cents = amount_charged_cents
where amount_original_cents = 0
  and amount_charged_cents > 0;

alter table public.sessions
drop constraint if exists sessions_amount_original_cents_range,
add constraint sessions_amount_original_cents_range
check (amount_original_cents >= 0 and amount_original_cents <= 10000000);

alter table public.sessions
drop constraint if exists sessions_payment_adjustment_reason_length,
add constraint sessions_payment_adjustment_reason_length
check (payment_adjustment_reason is null or char_length(payment_adjustment_reason) <= 240);
