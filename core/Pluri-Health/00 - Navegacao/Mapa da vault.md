---
tags:
  - moc
  - navegacao
kind: map
area: documentacao
aliases:
  - Mapa da vault
  - MAPA_DA_VAULT
  - Mapa da documentacao
  - Inicio da vault
---
# Mapa da Vault

## Como navegar com pouco contexto

Se a ideia for ganhar contexto rapido sem abrir a vault inteira:

- Comece por [[Visao geral do produto]] para visao geral do produto.
- Abra [[Core do projeto]] para o indice central.
- Siga apenas o ramo tematico necessario a partir das notas relacionadas.

## Rotas curtas de leitura

### Produto e direcao

- [[README - Produto]]
- [[Visao geral do produto]]
- [[Core do projeto]]
- [[Codex Brain]]
- [[Clinica e colaborador no MVP]]

### Equipe, acessos e configuracoes

- [[Clinica e colaborador no MVP]]
- [[Hierarquias de colaboradores e acessos]]
- [[Identidade global do usuario e seletor de clinicas]]
- [[Compartilhamento de fichas de atendimento]]
- [[Grupos reutilizaveis de atendimentos]]
- [[Acesso mestre e painel administrativo global]]
- [[Configuracoes - Seguranca]]
- [[Configuracoes - Desenvolvimento da equipe]]

### Operacao tecnica e qualidade

- [[Ambiente e operacao]]
- [[Deploy - Cloudflare Pages]]
- [[Backup do Supabase antes de deploy]]
- [[TDD e checks]]

### Seguranca e vulnerabilidades

- [[Plano de seguranca - hub]]
- [[Plano de seguranca - visao geral]]
- [[Modelo de ameacas e ativos sensiveis]]
- [[Roteiro de testes de seguranca]]
- [[Matriz de riscos de seguranca]]

### Implementacao guiada e referencia

- [[Prompt - Homepage filtro e ordenacao de pacientes]]
- [[Inventario de inputs]]

## Hubs principais

- [[Core do projeto]]: indice central do projeto e dos documentos de produto.
- [[Visao geral do produto]]: apresentacao curta do projeto.
- [[Ambiente e operacao]]: ambiente local, fluxo tecnico e deploy.
- [[TDD e checks]]: estrategia de protecao contra regressao.
- [[Plano de seguranca - hub]]: plano de auditoria, vulnerabilidades e subplanos por camada.
- [[Mapa de skills do Codex]]: indice das skills disponiveis, gatilhos de uso e notas individuais por habilidade.

## Notas por tema

### Produto

- [[README - Produto]]
- [[Clinica e colaborador no MVP]]
- [[Identidade global do usuario e seletor de clinicas]]
- [[Hierarquias de colaboradores e acessos]]
- [[Compartilhamento de fichas de atendimento]]
- [[Grupos reutilizaveis de atendimentos]]
- [[Acesso mestre e painel administrativo global]]
- [[Configuracoes - Seguranca]]
- [[Configuracoes - Desenvolvimento da equipe]]

### Engenharia

- [[Ambiente e operacao]]
- [[Deploy - Cloudflare Pages]]
- [[Backup do Supabase antes de deploy]]
- [[TDD e checks]]
- [[Inventario de inputs]]

### Seguranca

- [[Plano de seguranca - hub]]
- [[Checklist rapido de auditoria]]
- [[Subplano Supabase Postgres RLS e RPCs]]
- [[Subplano autorizacao RBAC clinicas e colaboradores]]
- [[Subplano formularios publicos e compartilhamentos]]

### Prompts e execucao orientada

- [[Prompt - Homepage filtro e ordenacao de pacientes]]
- [[Matriz de contexto do Codex]]

## Convencao sugerida para novas notas

- Use uma nota-hub curta quando um tema comecar a crescer demais.
- Prefira [[wikilinks]] entre notas da vault em vez de links absolutos para arquivos.
- Mantenha cada nota com um foco unico: overview, especificacao, operacao, referencia ou prompt.
- Adicione uma secao pequena de "Notas relacionadas" no final quando a conexao nao for obvia.
