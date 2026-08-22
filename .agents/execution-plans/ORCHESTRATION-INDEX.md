# Orquestrador de Agentes Executores - Therapy-Flow (Pluri-Health)

Este documento indexa e orquestra a divisão de trabalho em **5 threads paralelas de agentes executores** para levar a plataforma do estágio de *Beta Maduro* até o *Lançamento Oficial (GA - General Availability)*.

---

## Matriz de Distribuição e Paralelismo

| Agente | Arquivo de Instruções (.md) | Domínio Principal | Dependências |
|---|---|---|---|
| **Agente 1** | [`AGENT-1-ROUTING-CLEANUP.md`](file:///Users/jougy/Documents/therapy-flow/.agents/execution-plans/AGENT-1-ROUTING-CLEANUP.md) | Rotas, Links 404, Monólito Legado `Configuracoes.tsx`, Tipagens | Independente (Pode rodar imediatamente) |
| **Agente 2** | [`AGENT-2-DASHBOARD-AGGREGATIONS.md`](file:///Users/jougy/Documents/therapy-flow/.agents/execution-plans/AGENT-2-DASHBOARD-AGGREGATIONS.md) | Supabase RPCs, Migrations de Analytics, `ClinicDashboard.tsx` | Independente (Pode rodar imediatamente) |
| **Agente 3** | [`AGENT-3-CLIENT-FIRST-INDEXEDDB.md`](file:///Users/jougy/Documents/therapy-flow/.agents/execution-plans/AGENT-3-CLIENT-FIRST-INDEXEDDB.md) | IndexedDB Persister, Delta Sync no Prontuário, Auto-save no Cadastro Público | Independente (Pode rodar imediatamente) |
| **Agente 4** | [`AGENT-4-SESSION-PATIENT-MODULARIZATION.md`](file:///Users/jougy/Documents/therapy-flow/.agents/execution-plans/AGENT-4-SESSION-PATIENT-MODULARIZATION.md) | Fatiamento de `SessaoDetalhe.tsx` (4.1k linhas) e `PacienteDetalhe.tsx` (3k linhas) | Independente (Pode rodar imediatamente) |
| **Agente 5** | [`AGENT-5-FORM-EDITOR-MODULARIZATION.md`](file:///Users/jougy/Documents/therapy-flow/.agents/execution-plans/AGENT-5-FORM-EDITOR-MODULARIZATION.md) | Fatiamento de `FormularioEditor.tsx` (4.6k linhas), Canvas, Inspector, Undo/Redo | Independente (Pode rodar imediatamente) |

---

## Regras Críticas para Todos os Agentes
1. **Preservação de Dados e Banco**: Absolutamente PROIBIDO executar `supabase db reset`. Todas as mudanças no banco devem ser feitas via migrations incrementais não-destrutivas.
2. **Scroll Mobile Obrigatório**: Sempre verificar se containers filhos usam `overflow-y-auto` e não quebrar com `h-screen` indevido. Testar em larguras de 375px–390px.
3. **Memória Externa**: Consultar a Obsidian Vault (`core/Pluri-Health/`) sempre que tiver dúvidas arquiteturais.
4. **Validação de Build**: Toda thread deve rodar `npm run build` ao final de sua execução para assegurar zero regressões de tipagem.
