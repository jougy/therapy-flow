---
name: kanban-vault-ops
description: Regras detalhadas de atualização obrigatória do Kanban de Tarefas, templates de cards, arquivamento de concluídos e manutenção da documentação viva na Vault do Obsidian (core/Pluri-Health). Use ao iniciar, atualizar, cancelar ou concluir tarefas e ao documentar decisões arquiteturais.
---

# Governança do Kanban e Documentação Viva na Vault

## 1. Hubs Iniciais da Vault (`core/Pluri-Health`)
Ao precisar de contexto arquitetural amplo:
1. `00 - Navegacao/Codex Brain.md` (Regras e roteiro central)
2. `90 - Meta/Guia operacional da vault Pluri-Health.md` (Procedimentos operacionais)
3. `00 - Navegacao/Mapa da vault.md` (Índice temático)
4. `00 - Navegacao/Kanban de Tarefas.md` (Quadro vivo de demandas)

> Prefira consultar primeiro via CLI custo zero: `npm run ai:vault -- "<termo>"`, `npm run ai:vault -- --kanban` ou `npm run ai:graph -- vault "<nota_ou_arquivo>"`.

## 2. Regras Obrigatórias do Kanban
- **Arquivo Oficial:** `core/Pluri-Health/00 - Navegacao/Kanban de Tarefas.md` (detalhes em `90 - Meta/Regras de Uso do Kanban.md`).
- **Ao iniciar qualquer tarefa:** Criar ou mover o card para `## Executando agora` com o formato:
  ```markdown
  - [ ] **Título da Demanda** #origem/pedido-usuario #modulo/<area> #prioridade/alta
  	  - 📅 **Criado:** AAAA-MM-DD HH:mm | 🔄 **Atualizado:** AAAA-MM-DD HH:mm
  	  - 👤 **Solicitante:** Nome | `email` | ID Global: `usr_xxx`
  	  - 📝 **Descrição:** Escopo técnico resumido e critérios de aceite.
  	  - 🔗 **Links:** `caminho/do/arquivo.ts`, [[Nota da Vault]]
  ```
  - Tags de origem válidas: `#origem/ideia`, `#origem/pedido-usuario`, `#origem/suporte`, `#origem/auditoria`.
- **Ao concluir tarefa e testes:** Mover para `## Finalizados`, marcar `- [x]` e preencher `✅ **Concluído:** AAAA-MM-DD HH:mm`.
- **Se cancelada ou adiada:** Mover para `## Canceladas` com `🛑 **Motivo:**`.
- **Higienização automática (regra dos últimos 10 concluídos):** Rode `npm run vault:modularize` para arquivar excedentes em `00 - Navegacao/Arquivo Kanban/Historico Concluidos.md` e reindexar o grafo da Vault com `npm run graph:update`.

## 3. Documentação Viva & Pós-Etapa
- Novas decisões técnicas, fluxos ou tabelas devem ser registrados em notas curtas na Vault e linkados no hub correspondente com `[[Nome da Nota]]`.
- Registre medições de eficiência em `30 - Referencias/Matriz de contexto do Codex.md`.
- Ao encerrar qualquer entrega, oriente o usuário a executar **/compact** no chat antes da próxima demanda.
