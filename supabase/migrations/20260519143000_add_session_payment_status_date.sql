alter table public.sessions
add column if not exists payment_status_date date;
