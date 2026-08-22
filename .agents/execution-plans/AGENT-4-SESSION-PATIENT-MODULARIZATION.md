# Plano de Execução - Agente 4: Modularização do Prontuário e Atendimentos

> **Identificador do Agente**: `AGENT-4-SESSION-PATIENT-MODULARIZATION`  
> **Objetivo**: Fatiar e desacoplar os dois maiores arquivos clínicos do repositório (`SessaoDetalhe.tsx` com 4.100 linhas e `PacienteDetalhe.tsx` com 3.040 linhas) em subcomponentes coesos, legíveis e de alta performance, mantendo 100% das funcionalidades clínicas e regras de negócio.

---

## 1. Contexto e Diagnóstico

1. [`SessaoDetalhe.tsx`](file:///Users/jougy/Documents/therapy-flow/src/pages/SessaoDetalhe.tsx) (4.100 linhas):
   - Mistura runtime de anamnese dinâmica, seletor de linhas de cuidado com sugestão inteligente, blocos de tratamento, cálculo de parcelas e descontos, impressão de documentos médicos, histórico de edições e manipulação de toques/arrastes para scroll horizontal.
2. [`PacienteDetalhe.tsx`](file:///Users/jougy/Documents/therapy-flow/src/pages/PacienteDetalhe.tsx) (3.040 linhas):
   - Contém o cabeçalho clínico com alertas e bandeiras de risco, widget de agenda, painel de anexos S3, diálogos de criação de grupos de cuidado e gerenciamento de sessões em lote.

A modularização melhorará drasticamente o tempo de compilação, o Garbage Collection em dispositivos mobile e a facilidade de manutenção.

---

## 2. Etapas de Execução Passo a Passo

### Etapa 4.1: Fatiamento de `SessaoDetalhe.tsx`
- **Diretório**: Criar subcomponentes em `src/components/sessions/`
- **Subcomponentes a extrair**:
  1. `SessionHeaderBar.tsx`: Título, status, data/hora, autor, botão salvar e atalhos de navegação.
  2. `SessionAnamnesisRuntime.tsx`: Renderização do template selecionado, inputs dinâmicos, blocos de endereço e matriz de opções.
  3. `SessionTreatmentSection.tsx`: Blocos de tratamento, queixa principal, condutas e orientações gerais.
  4. `SessionPaymentSection.tsx`: Status de pagamento, método, parcelamento, cortesia, compensação de créditos e formulário colapsável de plano de parcelamento.
  5. `SessionCareLinesSelector.tsx`: Combobox e badges de Linhas de Cuidado com auto-detecção por palavras-chave (`detectSuggestedCareLine`).
  6. `SessionModalsContainer.tsx`: Modais de compartilhamento, histórico auditado de alterações e termos de responsabilidade para impressão física.
- **Resultado**: `SessaoDetalhe.tsx` reduzido para um orquestrador limpo de ~400 linhas.

### Etapa 4.2: Fatiamento de `PacienteDetalhe.tsx`
- **Diretório**: Criar subcomponentes em `src/components/patients/detail/`
- **Subcomponentes a extrair**:
  1. `PatientClinicalHeader.tsx`: Identificação, contatos, alertas de risco (popovers com itens), tipo sanguíneo e atalhos (Resumo, Dashboard, Cadastro).
  2. `PatientSessionsTimeline.tsx`: Lista de atendimentos com filtros por status/tags, modo de multiseleção por toque longo e paginação.
  3. `PatientCareGroupsManager.tsx`: Dialog de criação e edição de grupos e linhas de cuidado com paleta de cores.
  4. `PatientRecurrenceDialog.tsx`: Modal de configuração de recorrência de atendimentos semanais.
  5. `PatientAgendaSection.tsx`: Widget de agenda integrado com criação e confirmação rápida de horários.
- **Resultado**: `PacienteDetalhe.tsx` reduzido para um orquestrador de ~350 linhas.

### Etapa 4.3: Verificação Estrita de Regras Visuais e Mobile Scroll
- **Regras Obrigatórias**:
  - Testar rolagem vertical funcional em modais e gavetas (`overflow-y-auto`, `min-h-screen` / `dvh`).
  - Garantir que nenhum evento de toque ou long-press de multiseleção seja quebrado.

---

## 3. Critérios de Conclusão (Definition of Done)
- [ ] `SessaoDetalhe.tsx` reduzido para < 500 linhas, desacoplado em componentes modulares.
- [ ] `PacienteDetalhe.tsx` reduzido para < 450 linhas, desacoplado em componentes modulares.
- [ ] Todos os fluxos clínicos (salvar evolução, imprimir recibo, trocar modelo de anamnese, adicionar anexo S3) continuam funcionando sem regressões.
- [ ] Build do Vite sem erros de tipagem.
