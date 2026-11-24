# Regras Supabase (`supabase/`)
- **Proibido `supabase db reset`** sem autorização explícita; use apenas migrations incrementais não destrutivas (*Expand and Contract*).
- **Padrão Monetário:** valores financeiros sempre em centavos `bigint` com sufixo `_cents`.
- **Compliance Clínico (CFM 1.821 / LGPD):** prontuários e pacientes usam `deleted_at timestamptz` e `ON DELETE RESTRICT` (nunca `ON DELETE CASCADE` em `sessions`).
- **Proibido Overload de RPC:** nunca crie duas funções com o mesmo nome no schema `public` (evita erro `PGRST203`).
- **RBAC:** use `current_user_can` no RLS. Consulte `npm run ai:schema <alvo> --exact` em vez de ler `schema.sql` inteiro.
