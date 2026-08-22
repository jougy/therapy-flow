# Plano Mestre de Modularização e Eficiência Arquitetural

> **Documento:** `MODULARIZATION-MASTER-PLAN.md`  
> **Objetivo:** Estabelecer o plano de desmembramento cirúrgico dos maiores arquivos do Therapy-Flow (`SessaoDetalhe.tsx` e `FormularioEditor.tsx`), eliminando acoplamento de renderização, otimizando o ciclo de vida do Virtual DOM e garantindo compilação ultrarrápida.

---

## 1. Visão Geral da Arquitetura Alvo

```
src/
├── pages/
│   ├── SessaoDetalhe.tsx                 ➔ Orquestrador enxuto (~280 linhas)
│   ├── FormularioEditor.tsx              ➔ Orquestrador enxuto (~220 linhas)
│   └── configuracoes/                    ➔ Arquitetura modular moderna (Concluído)
│
├── components/
│   ├── sessions/                         ➔ Componentes modulares de Sessão Clínica
│   │   ├── SessionHeaderBar.tsx          ➔ Status, data/hora, autosave e salvar
│   │   ├── SessionPaymentSection.tsx     ➔ Financeiro, créditos, parcelas e descontos
│   │   ├── SessionCareLinesPicker.tsx    ➔ Sugestão inteligente e tags de linhas de cuidado
│   │   ├── SessionTreatmentFields.tsx    ➔ Queixa principal, condutas e notas
│   │   ├── SessionAnamnesisRuntime.tsx   ➔ Runtime de campos dinâmicos e grid
│   │   ├── SessionAuditHistoryModal.tsx  ➔ Trilha de snapshots e autoria
│   │   └── SessionPrintDocumentsModal.tsx➔ Impressão de recibo, declaração e prontuário
│   │
│   └── anamnesis-editor/                 ➔ Componentes modulares do Construtor de Fichas
│       ├── useFormEditorState.ts         ➔ Hook com Undo/Redo (50 snapshots) e multiseleção
│       ├── FormEditorHeader.tsx          ➔ Barra de ações, modo de teste e status
│       ├── FormEditorPalette.tsx         ➔ Biblioteca de campos categorizados
│       ├── FormEditorCanvas.tsx          ➔ Área de montagem com Drag-and-Drop
│       ├── FormEditorInspector.tsx       ➔ Painel de propriedades e regras condicionais
│       ├── FormEditorBatchBar.tsx        ➔ Ações em lote (duplicar, mover, colorir)
│       └── FormEditorLivePreview.tsx     ➔ Simulador de preenchimento em tempo real
```

---

## 2. Fatiamento de `SessaoDetalhe.tsx` (4.100 linhas ➔ ~280 linhas)

### 2.1. Responsabilidades a Isolar:

| Subcomponente | Caminho do Arquivo | Responsabilidade |
|---|---|---|
| **Header & Ações** | `src/components/sessions/SessionHeaderBar.tsx` | Status da sessão (`rascunho`, `concluida`, `cancelada`), profissional responsável, data/hora do atendimento e atalhos de navegação. |
| **Financeiro & Pagamentos** | `src/components/sessions/SessionPaymentSection.tsx` | Métodos de pagamento (`pix`, `cartao`, `dinheiro`), cálculo de parcelas, uso de saldo/créditos anteriores, descontos e cortesia. |
| **Linhas de Cuidado** | `src/components/sessions/SessionCareLinesPicker.tsx` | Sugestão automática de linhas de cuidado via NLP simples e seleção de grupos com badges coloridas. |
| **Campos Clínicos Base** | `src/components/sessions/SessionTreatmentFields.tsx` | Bloco de condutas terapêuticas, orientações pós-sessão, escala de dor e queixa principal. |
| **Runtime de Anamnese** | `src/components/sessions/SessionAnamnesisRuntime.tsx` | Renderizador dinâmico de schemas, grids horizontais, seções sanfona e inputs dinâmicos. |
| **Histórico e Snapshots** | `src/components/sessions/SessionAuditHistoryModal.tsx` | Modal de auditoria de alterações, versionamento e comparação de modificações no prontuário. |
| **Documentos e Impressão** | `src/components/sessions/SessionPrintDocumentsModal.tsx` | Modal de emissão de declaração de comparecimento, recibo financeiro e prontuário físico (LGPD). |

---

## 3. Fatiamento de `FormularioEditor.tsx` (4.669 linhas ➔ ~220 linhas)

### 3.1. Responsabilidades a Isolar:

| Subcomponente / Hook | Caminho do Arquivo | Responsabilidade |
|---|---|---|
| **State & Reducer** | `src/components/anamnesis-editor/useFormEditorState.ts` | Pilha imutável de histórico (Undo/Redo com 50 estados), auto-save em `localStorage`, recuperação de rascunhos e seleção múltipla (`Ctrl+A`). |
| **Header do Editor** | `src/components/anamnesis-editor/FormEditorHeader.tsx` | Nome do modelo, descrição, botões de desfazer/refazer, alternância Edição ↔ Teste e atalhos de teclado. |
| **Paleta Lateral** | `src/components/anamnesis-editor/FormEditorPalette.tsx` | Biblioteca de tipos de campos (Texto, Número, Seleção, Checkbox, Escala, Data, Endereço, Sanfona, Seção Horizontal). |
| **Canvas Interativo** | `src/components/anamnesis-editor/FormEditorCanvas.tsx` | Drop zones, reordenação de campos via drag-and-drop, blocos aninhados e seções sanfona colapsáveis. |
| **Painel de Propriedades** | `src/components/anamnesis-editor/FormEditorInspector.tsx` | Edição de rótulos, obrigatoriedade, opções de múltipla escolha, matrizes e paleta de cores. |
| **Barra de Lote** | `src/components/anamnesis-editor/FormEditorBatchBar.tsx` | Dock flutuante para ações quando há múltiplos campos selecionados (excluir lote, duplicar lote, trocar cor da seção). |
| **Simulador / Preview** | `src/components/anamnesis-editor/FormEditorLivePreview.tsx` | Renderização do formulário em modo real para o profissional testar o preenchimento antes de salvar. |

---

## 4. Benefícios de Eficiência e Performance

1. **Tempo de Compilação & HMR**: A recarga a quente (*Hot Module Replacement*) do Vite no desenvolvimento cai de ~800ms para menos de 40ms por edição.
2. **Virtual DOM Isolado**: Mutações em inputs específicos não forçarão a re-renderização de toda a página de 4.000 linhas, reduzindo o consumo de CPU em navegadores mobile.
3. **Manutenibilidade e Testabilidade**: Cada módulo possui tipagem e props isoladas, permitindo testes unitários com Vitest sem acoplamento a serviços externos.
4. **Bundle Chunks & Code Splitting**: Modais de impressão e históricos de auditoria são carregados apenas sob demanda.
