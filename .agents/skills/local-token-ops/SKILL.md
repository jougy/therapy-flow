---
name: local-token-ops
description: Guia operacional completo do motor local de IA (Ollama mimo-v2.6/gemma4/embeddinggemma-2 + OpenCode Free cascade), grafo estrutural de código e Vault (ai:graph), suíte de verificação rápida (check:*) e perfis de alocação de subagentes (Perfis A, B e C). Use ao planejar execuções, delegar subagentes ou investigar código/banco/Vault gastando o mínimo de tokens.
---

# Operação de Máxima Economia de Tokens & Perfis de Subagentes

## 1. Ferramentas Locais Custo Zero (`scripts/dev/ai-local-engine.mjs`)
Antes de abrir arquivos grandes com `view_file` ou fazer múltiplos `grep`, utilize os motores locais (saída < 180 tokens):

- **Grafo Estrutural de Código & Ponte Vault (`npm run ai:graph`):**
  - `npm run ai:graph -- gods`: Top nós centrais (`god_nodes`) e comunidades arquiteturais de `src/` e `supabase/functions/`.
  - `npm run ai:graph -- impact <arquivo_ou_simbolo>`: Raio de impacto (quem importa/chama direta e transitivamente + notas da Vault e RPCs ligadas).
  - `npm run ai:graph -- neighbors <arquivo_ou_simbolo>`: Imports, exports, hooks, capabilities `can(...)`, tabelas e RPCs tocadas pelo módulo.
  - `npm run ai:graph -- path <origem> <destino>`: Menor caminho de dependência entre dois módulos/símbolos.
  - `npm run ai:graph -- rpc <nome_rpc>`: Cruza definição SQL (`schema.sql`) com todos os callsites `.rpc('...')` no código TS.
  - `npm run ai:graph -- vault <termo_ou_arquivo>`: Mostra o subgrafo de notas da Vault (`[[wikilinks]]`, backlinks e arquivos de código associados).
- **Busca Híbrida na Vault (`npm run ai:vault`):**
  - `npm run ai:vault -- "<termo>"`: Busca textual com cache inteligente + fallback semântico vetorial via `embeddinggemma-2:latest` + síntese local.
  - `npm run ai:vault -- --kanban`: Resumo instantâneo das tarefas ativas no Kanban.
- **Inspeção Cirúrgica de Schema (`npm run ai:schema`):**
  - `npm run ai:schema -- <tabela_ou_rpc>`: Resumo de colunas (`_cents`, `deleted_at`), RLS e linhas exatas.
  - `npm run ai:schema -- <tabela_ou_rpc> --exact`: Extrai apenas a definição SQL exata (`L<ini>-L<fim>`) + callsites TS.
- **Mapa de Linhas de Arquivo (`npm run ai:scout`):**
  - `npm run ai:scout -- <arquivo_ou_termo>`: Lista linhas exatas (`L<ini>-L<fim>`) de exports, hooks, estados, `can(capability)` e seções JSX.
- **Diagnóstico dos Motores Locais (`npm run ai:health`):**
  - Verifica e testa conectividade com Ollama (`mimo-v2.6:latest`, `gemma4:12b`, `embeddinggemma-2:latest`) e cascata de agentes gratuitos do OpenCode (`opencode/mimo-v2.6-flash-free`, `opencode/deepseek-v4.1-flash-free`, `opencode/nemotron-3.5-lightning-free`, `opencode/big-pickle`).
- **Reindexação Incremental (`npm run ai:reindex`):**
  - Atualiza `schema:index`, `graph:update` (código + Vault + embeddings incrementais) e `vault:modularize`.

## 2. Checkers Determinísticos Locais (< 50 tokens)
- `npm run check:quick`: Validação completa (ESLint/TS, Supabase, Mobile-First, HTML e Anti-Monolitos).
- `npm run check:lint -- <arquivo>`: Apenas erros bloqueantes.
- `npm run check:supabase`: Prevenção de `PGRST203`, sufixo `_cents` e SSOT de migrations.
- `npm run check:responsive -- <arquivo>`: Classes de risco mobile e conformidade com `can(capability)`.
- `npm run check:monoliths`: Bloqueia novos arquivos > 500 linhas e expansão de monolitos legados.
- `npm run check:clean-logs`: Bloqueia `console.log` de debug esquecidos.
- `npm run check:test -- <arquivo_teste>`: Roda Vitest omitindo dumps HTML do Testing Library e resume falhas via LLM local em 2 frases.
- `npm run git:summary` (ou `git status -s`): Status compacto e resumo do diff em 3 bullets via LLM local.

## 3. Perfis de Execução de Subagentes (`Model: "flash"` ou `"flash_lite"`)
O agente principal atua como **Planejador Estratégico e Tech Lead** (alinha requisitos e plano antes de codificar) e seleciona apenas o perfil necessário:

- **📱 Perfil A — UI / Layout / Mobile-First Exclusivo (Frontend Only):**
  - *Subagentes:* (1) Especialista Frontend Mobile-First; (2) Opcional QA Visual/Overflow (`audit:layout` / `browser`).
  - *Dispensados:* Backend/Supabase e Big-O de banco.
- **⚡ Perfil B — Fullstack Padrão (Mudanças Completas):**
  - *Fase 1 (Construção):* (1) Frontend & UI/UX; (2) Backend & Supabase.
  - *Fase 2 (Hardening):* (3) Arquitetura, Modularização & Clean Code (< 500L/arquivo); (4) Eficiência, Big-O & Segurança/LGPD.
- **🛡️ Perfil C — Backend, Segurança, Dados & Tooling Exclusivo:**
  - *Subagentes:* (1) Backend / Modelagem / Tooling; (2) Eficiência, Big-O & Hardening de Segurança.
  - *Dispensados:* Frontend e browser subagent.
