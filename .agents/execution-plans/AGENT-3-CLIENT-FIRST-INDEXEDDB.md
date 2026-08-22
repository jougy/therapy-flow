# Plano de Execução - Agente 3: Expansão da Filosofia Client-First e Persistência em IndexedDB

> **Identificador do Agente**: `AGENT-3-CLIENT-FIRST-INDEXEDDB`  
> **Objetivo**: Expandir o padrão ouro de arquitetura Local-First / Client-First que já existe na Homepage (`Index.tsx`) para o Prontuário do Paciente (`PacienteDetalhe.tsx`), histórico de sessões e formulários públicos, tornando a plataforma ultra-rápida e resiliente a oscilações de rede.

---

## 1. Contexto e Diagnóstico

1. Na Homepage ([`Index.tsx`](file:///Users/jougy/Documents/therapy-flow/src/pages/Index.tsx)), a plataforma possui uma implementação exemplar com `indexed-db-persister.ts`, sincronização incremental por delta (`updated_at > timestamp`), atualizações otimistas e pré-busca com hover (`usePrefetchPatientDetail`).
2. Entretanto, no Prontuário do Paciente ([`PacienteDetalhe.tsx`](file:///Users/jougy/Documents/therapy-flow/src/pages/PacienteDetalhe.tsx)) e no Formulário Público ([`CadastroPacienteCompartilhado.tsx`](file:///Users/jougy/Documents/therapy-flow/src/pages/CadastroPacienteCompartilhado.tsx)):
   - As sessões do paciente e os modelos de anamnese ainda são buscados via queries diretas sem sincronização incremental delta.
   - O formulário público de auto-cadastro não possui auto-save local no celular do paciente, podendo causar perda de dados em caso de fechamento acidental da aba.

---

## 2. Etapas de Execução Passo a Passo

### Etapa 3.1: Criação de Hooks Persistidos para Detalhes do Paciente e Sessões
- **Arquivo**: `src/hooks/queries/usePatientDataQueries.ts` (novo ou estendido)
- **Ação**:
  - Criar `usePatientSessionsQuery(patientId, clinicId)` utilizando persistência no IndexedDB via TanStack Query.
  - Implementar delta sync incremental: buscar apenas sessões atualizadas desde o último sync (`.gt("updated_at", lastSyncedAt)`).
  - Integrar mutações otimistas para alteração de status de sessão, exclusão em lote e atualização de tags.

### Etapa 3.2: Integração no `PacienteDetalhe.tsx`
- **Arquivo**: `src/pages/PacienteDetalhe.tsx`
- **Ação**:
  - Substituir o `fetchData()` imperativo pelo consumo reativo dos hooks persistidos em IndexedDB.
  - O prontuário deve abrir instantaneamente a partir do cache local no IndexedDB enquanto valida deltas em segundo plano (*stale-while-revalidate*).

### Etapa 3.3: Implementação de Auto-Save Local no `CadastroPacienteCompartilhado.tsx`
- **Arquivo**: `src/pages/CadastroPacienteCompartilhado.tsx`
- **Ação**:
  - Implementar hook de auto-salvamento em `localStorage` associado ao `token` público.
  - Adicionar restauração automática transparente dos dados caso o paciente recarregue a página no celular durante o preenchimento das 5 abas.
  - Limpar o rascunho local assim que a submissão for confirmada com sucesso pelo backend.

---

## 3. Critérios de Conclusão (Definition of Done)
- [x] A tela `PacienteDetalhe.tsx` carrega instantaneamente do cache IndexedDB em menos de 50ms.
- [x] Mutações de status no prontuário aplicam optimistic updates visuais antes da resposta do servidor.
- [x] O formulário público de auto-cadastro preserva o progresso do paciente mesmo ao recarregar a página.
- [x] `npm run test` ou builds passam sem quebras de contrato de dados.
