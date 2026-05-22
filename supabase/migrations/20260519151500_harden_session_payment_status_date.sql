alter table public.sessions
drop constraint if exists sessions_payment_status_date_range,
add constraint sessions_payment_status_date_range
check (
  payment_status_date is null
  or (
    payment_status_date >= date '2000-01-01'
    and payment_status_date <= date '2100-12-31'
  )
);
