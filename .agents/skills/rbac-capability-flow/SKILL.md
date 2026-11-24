---
name: rbac-capability-flow
description: Passo a passo ponta a ponta para criar ou auditar capabilities RBAC no Pluri-Health (SQL/RLS -> Tipos TS -> can(capability) na UI), sem hardcode de papéis.
---

# RBAC Capability Flow (Pluri-Health)

1. **Regra de Ouro:**
   - **Proibido hardcode de papéis** (`operationalRole === 'admin'`).
   - Frontend usa exclusivamente `can('<capability>')` e `effectiveRoleKey = membership.role_key || membership.operational_role`.
   - Backend/RLS usa exclusivamente `current_user_can('<capability>')`.
2. **Fluxo de Implementação:**
   - **Passo 1 (Banco):** Adicione a capability na tabela/seed de capabilities e vincule aos papéis padrão via migration incremental; proteja a tabela/RPC com `current_user_can(...)`.
   - **Passo 2 (Frontend):** Adicione a capability ao catálogo tipado de capabilities (consulte `npm run ai:graph -- neighbors src/hooks/` se precisar localizar) e aplique `can('<capability>')` nos componentes/rotas.
   - **Passo 3 (Auditoria):** Rode `npm run check:quick` (valida ausência de hardcode de papéis) e `npm run app:map` para atualizar `.cache/app-map.json`.
