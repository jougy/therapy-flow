# Plano de Execução - Agente 5: Modularização e Otimização do Editor de Formulários

> **Identificador do Agente**: `AGENT-5-FORM-EDITOR-MODULARIZATION`  
> **Objetivo**: Fatiar o construtor visual de formulários e anamneses (`FormularioEditor.tsx` de 4.669 linhas) em subcomponentes isolados, preservando o motor de Undo/Redo (50 snapshots), o sistema de multiseleção com atalhos de teclado e a recuperação automática de rascunhos locais.

---

## 1. Contexto e Diagnóstico

1. [`FormularioEditor.tsx`](file:///Users/jougy/Documents/therapy-flow/src/pages/FormularioEditor.tsx) é o maior arquivo do sistema (4.669 linhas).
2. Ele engloba:
   - Gerenciamento da pilha de histórico de 50 estados (`handleUndo`, `handleRedo`).
   - Automação de auto-salvamento em `localStorage` e diálogo de restauração de rascunho.
   - Canvas de arrastar e soltar (drag-and-drop) para campos normais, seções sanfona e seções horizontais.
   - Painel lateral de configurações de campos, máscaras e regras condicionais.
   - Modo de teste ao vivo (*live preview*) com preenchimento simulado.
   - Dock flutuante mobile e inspeção responsiva via Sheet.

---

## 2. Etapas de Execução Passo a Passo

### Etapa 5.1: Criação da Estrutura Modular
- **Diretório**: Criar subcomponentes em `src/components/anamnesis-editor/`
- **Subcomponentes a extrair**:
  1. `FormEditorHeader.tsx`: Nome do modelo, descrição, botões Desfazer/Refazer, modo de edição vs. modo de teste, atalhos do teclado e botão salvar.
  2. `FormEditorPaletteSidebar.tsx`: Biblioteca lateral com as 4 categorias de campos (Básicos, Opções & Seleção, Estrutura & Agrupamento, Especiais).
  3. `FormEditorCanvas.tsx`: Área central de edição com suporte a drop zones, reordenação, seções sanfona colapsáveis e seções horizontais com scroll navigator.
  4. `FormEditorInspectorPanel.tsx`: Painel de propriedades do campo selecionado (rótulo, placeholder, ajuda, obrigatoriedade, opções, matrizes e paleta de cores de seção).
  5. `FormEditorBatchActionBar.tsx`: Barra inferior flutuante para ações em lote de múltiplos campos selecionados (duplicar, mover de seção, alterar cores, excluir).
  6. `FormEditorLivePreview.tsx`: Simulador interativo para testar o comportamento do formulário como se fosse uma sessão clínica real.
  7. `FormEditorDraftRestoreDialog.tsx`: Modal automático para restauração de rascunhos locais não salvos.

### Etapa 5.2: Extração do Estado e Redutores do Editor
- **Arquivo**: `src/components/anamnesis-editor/useFormEditorState.ts`
- **Ação**:
  - Encapsular a lógica de pilha de histórico (Undo/Redo), seleção múltipla (`selectedFieldIds`), drag-over states e auto-save em um hook customizado coeso.

### Etapa 5.3: Montagem do Orquestrador `FormularioEditor.tsx`
- **Arquivo**: `src/pages/FormularioEditor.tsx`
- **Ação**:
  - Reduzir o arquivo principal para um orquestrador limpo de ~250 linhas que conecta o hook de estado aos 6 subcomponentes.
  - Assegurar que os atalhos `Ctrl+A`, `Ctrl+Z`, `Ctrl+Y` e toque longo mobile continuem funcionando de maneira idêntica.

---

## 3. Critérios de Conclusão (Definition of Done)
- [ ] `FormularioEditor.tsx` reduzido de 4.669 linhas para < 300 linhas.
- [ ] O sistema de Undo/Redo e restauração de rascunho continua 100% funcional.
- [ ] O modo de teste ao vivo permite preencher e resetar respostas sem afetar o esquema original.
- [ ] O layout mobile adapta-se perfeitamente com a gaveta (Sheet) de propriedades e dock flutuante.
- [ ] Compilação de build limpa com zero erros no TypeScript.
