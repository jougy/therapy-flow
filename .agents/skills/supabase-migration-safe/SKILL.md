---
name: supabase-migration-safe
description: Checklist e fluxo obrigatório para criar ou alterar tabelas, colunas, RLS, RPCs e migrations no Supabase do Pluri-Health (Expand & Contract, _cents, deleted_at, zero overload PGRST203).
---

# Supabase Migration Safe (Pluri-Health)

1. **Inspeção antes de escrever:**
   - Use `npm run ai:schema <tabela_ou_rpc> --exact` (nunca leia `supabase/schema.sql` inteiro).
   - Use `npm run ai:graph -- rpc <nome_rpc>` para checar todos os callers em TS antes de alterar assinatura.
2. **Regras Invariantes:**
   - **Proibido `supabase db reset`** sem autorização explícita; use apenas **migrations incrementais** (*Expand and Contract*).
   - **Monetário:** `bigint` com sufixo `_cents` (nunca `numeric(10,2)`).
   - **Soft Delete / LGPD / CFM 1.821:** `deleted_at timestamptz` + `ON DELETE RESTRICT` (proibido `ON DELETE CASCADE` em `sessions`).
   - **Zero Overload (`PGRST203`):** nunca crie duas funções com o mesmo nome no schema `public`.
   - **RLS:** use `current_user_can('<capability>')` e `SECURITY DEFINER` com `SET search_path = public`.
3. **Pós-alteração:**
   - Rode `npm run check:supabase` e `npm run schema:index` (e `npm run types:index` se atualizar tipos).
