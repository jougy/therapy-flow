# Therapy-Flow (Pluri-Health) — Constituição Operacional

> **Diretriz de Economia de Contexto:** Este arquivo contém as regras invariantes obrigatórias em todos os turnos. Detalhes extensos residem nas skills locais `.agents/skills/{mobile-first-ui,kanban-vault-ops,local-token-ops}/SKILL.md`.

## 1. Memória Viva (Obsidian Vault: `core/Pluri-Health`)
- **Não adivinhe a arquitetura.** Antes de explorar na força bruta, use os motores locais custo zero:
  - `npm run ai:vault -- "<termo>"` (ou `--kanban`) — Busca híbrida (texto + grafo + embeddings locais `embeddinggemma-2`).
  - `npm run ai:graph -- <gods|impact|neighbors|path|rpc|vault> [alvo]` — Grafo estrutural AST de código + ponte bidirecional Vault ↔ Código ↔ RPCs.
  - `npm run ai:schema -- <tabela_ou_rpc> [--exact]` — Índice modular `supabase/schema-index/00-INDEX.md` (jamais leia as 22.500 linhas de `supabase/schema.sql` inteiro nem migrações antigas).
  - `npm run ai:scout -- <arquivo_ou_termo>` — Mapa de linhas (`L<ini>-L<fim>`) antes de usar `view_file` (leia apenas blocos de 50–100 linhas).
- **Hubs centrais na Vault:** `00 - Navegacao/Codex Brain.md`, `00 - Navegacao/Mapa da vault.md`, `90 - Meta/Guia operacional da vault Pluri-Health.md` e `00 - Navegacao/Kanban de Tarefas.md`.
- **Documentação viva:** Toda nova decisão técnica, fluxo ou tabela deve atualizar a Vault em notas curtas linkadas com `[[Nome da Nota]]`.

## 2. Banco de Dados, Segurança, RBAC e Supabase
- **Proibido `supabase db reset`** sem autorização explícita do usuário. Use apenas **migrations incrementais** não destrutivas (*Expand and Contract*).
- **Padrão Monetário:** Valores financeiros sempre em centavos `bigint` com sufixo `_cents` (proibido `numeric(10,2)` para novos campos financeiros de sessão).
- **Compliance Clínico (CFM 1.821 / LGPD):** Prontuários e pacientes usam `deleted_at timestamptz` e `ON DELETE RESTRICT` (proibido `ON DELETE CASCADE` em `sessions`).
- **Proibido Overload de RPC:** Nunca crie duas funções com o mesmo nome no schema `public` (evita erro `PGRST203`).
- **Governança RBAC Soberana:**
  - **Proibido hardcode de papéis na UI** (ex: `operationalRole === 'admin'`). Use exclusivamente `can(capability)` no frontend e `current_user_can` no RLS.
  - Respeite papéis dinâmicos (`effectiveRoleKey = membership.role_key || membership.operational_role`).
  - Consulte `[[Guia Arquitetural de Papeis Operacionais, Hierarquias e RBAC]]` e `[[Plano de seguranca - hub]]` antes de alterar acessos, RLS ou sessões.

## 3. Mobile-First, Widescreen, Browser Subagent & Legenda de Cores
- *(Ver skill `mobile-first-ui` para detalhes)*: Design nasce em mobile (`375px`/`390px`) e expande até widescreen (`1440px+` com `max-w-* mx-auto`).
- **Tolerância zero a overflow horizontal:** containers `w-full max-w-full min-w-0 overflow-x-hidden`, tabelas com `overflow-x-auto touch-pan-x`, alturas dinâmicas `100dvh`/`max-h-[88dvh]` (nunca `h-screen` rígido), touch targets ≥ **44x44px**, scroll interno `flex-1 overflow-y-auto overscroll-contain` e ações principais `sticky bottom-0 pb-safe z-10`.
- **Validação de UI:** Use `npm run check:responsive -- <arquivo>` e instancie o subagente `browser` (`Model: "flash"`) na validação final de fluxos/UI (sem deixar prints soltos no repo).
- **Legenda de prints anotados:** **Verde** = manter; **Amarelo** = alterar texto/dado; **Vermelho** = remover/evitar margem; **Roxo** = mover/alinhar/responsividade; **Azul** = virar modal/popup/expansível; **Rosa** = ação interativa/clicável.

## 4. Arquitetura Anti-Monolito, Papel do Agente & Subagentes
- **Proibido criar/expandir monolitos (> 500 linhas):** Modularize em subpastas com barrel leve. Após alterar `schema.sql`, rode `npm run schema:index` (e `npm run types:index` se alterar tipos).
- **Postura de Arquiteto/Tech Lead:** Discuta ideias, tire dúvidas, planeje e classifique a tarefa em **Perfil A** (Frontend Mobile-First Only), **Perfil B** (Fullstack em 2 fases / 4 subagentes) ou **Perfil C** (Backend, Segurança, Dados & Tooling Only) — *ver skill `local-token-ops`*.
- **Subagentes leves:** Em `invoke_subagent`, use obrigatoriamente `Model: "flash"` ou `"flash_lite"` (proibido `pro` sem autorização), com prompts autocontidos e resposta resumida.

## 5. Kanban Obrigatório, Checks Determinísticos, Git & Telemetria
- **Kanban (`00 - Navegacao/Kanban de Tarefas.md`):** Toda tarefa iniciada vai para `## Executando agora` (com datas `AAAA-MM-DD HH:mm`, tag `#origem/...`, solicitante e links) e ao concluir vai para `## Finalizados` (`- [x]`, `✅ Concluído:`). Rode `npm run vault:modularize` para manter apenas os 10 últimos concluídos (*ver skill `kanban-vault-ops`*).
- **Checks e Testes (< 50 tokens):** Use `npm run check:quick` (lint, supabase, responsive, monoliths, clean-logs) e `npm run check:test -- <arquivo>` (omite dumps HTML e resume falhas via LLM local).
- **Git Compacto:** Proibido `git status` ou `git diff` puros; use sempre `git status -s` ou `npm run git:summary`.
- **Segredos e Observabilidade:** Chaves e variáveis sempre via **Pulumi ESC** (`pulumi esc`, zero segredos hardcoded). Métricas, telemetria e logs sempre via **Axiom** e **Upstash Redis**.
- **Protocolo `/compact`:** Ao concluir qualquer entrega e atualizar o Kanban, recomende expressamente ao usuário disparar **/compact** antes da próxima mensagem.
