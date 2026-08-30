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
- [[Sistema de Feedbacks e Avaliacoes]]
- [[Redesenho de Fluxo de Atendimentos e Linhas de Cuidado]]

### Equipe, acessos e configuracoes

- [[Clinica e colaborador no MVP]]
- [[Hierarquias de colaboradores e acessos]]
- [[Identidade global do usuario e seletor de clinicas]]
- [[Compartilhamento de fichas de atendimento]]
- [[Grupos reutilizaveis de atendimentos]]
- [[Acesso mestre e painel administrativo global]]
- [[Painel de Debug em Tempo Real do Backoffice]]
- [[Reenvio de convites com cooldown e Gestao de Pendencias no Diretorio Mestre]]
- [[Configuracoes - Seguranca]]
- [[Configuracoes - Desenvolvimento da equipe]]

### Operacao tecnica e qualidade

- [[Ambiente e operacao]]
- [[Ambiente Mobile e Scrcpy]]
- [[Deploy - Cloudflare Pages]]
- [[Backup do Supabase antes de deploy]]
- [[TDD e checks]]

### Seguranca e vulnerabilidades

- [[Plano de seguranca - hub]]
- [[Plano de seguranca - visao geral]]
- [[Modelo de ameacas e ativos sensiveis]]
- [[Roteiro de testes de seguranca]]
- [[Matriz de riscos de seguranca]]
- [[Termo de Responsabilidade para Impressao (LGPD)]]

### Implementacao guiada e referencia

- [[Prompt - Homepage filtro e ordenacao de pacientes]]
- [[Inventario de inputs]]
- [[Heuristicas e regras de responsividade mobile-first]]

## Hubs principais

- [[Core do projeto]]: indice central do projeto e dos documentos de produto.
- [[Visao geral do produto]]: apresentacao curta do projeto.
- [[00 - Hub de Tutoriais da Plataforma]]: roteiros, mapeamento e guias passo a passo de todas as páginas da plataforma.
- [[Ambiente e operacao]]: ambiente local, fluxo tecnico e deploy.
- [[TDD e checks]]: estrategia de protecao contra regressao.
- [[Plano de seguranca - hub]]: plano de auditoria, vulnerabilidades e subplanos por camada.
- [[Mapa de skills do Codex]]: indice das skills disponiveis, gatilhos de uso e notas individuais por habilidade.

## Notas por tema

### Produto

- [[README - Produto]]
- [[00 - Hub de Tutoriais da Plataforma]]
- [[00 - Plano Geral de Assinaturas e Asaas]]
- [[Gestao de Assinatura e Integracao Asaas]]
- [[Clinica e colaborador no MVP]]
- [[Identidade global do usuario e seletor de clinicas]]
- [[Hierarquias de colaboradores e acessos]]
- [[Compartilhamento de fichas de atendimento]]
- [[Grupos reutilizaveis de atendimentos]]
- [[Acesso mestre e painel administrativo global]]
- [[Bloco de endereco no criador de formularios e geolocalizacao]]
- [[Configuracoes - Seguranca]]
- [[Configuracoes - Desenvolvimento da equipe]]
- [[Plano de Telemetria Auditoria e Estatisticas do Backoffice]]
- [[Criador de formularios do DesignLab - Arquitetura e Interacoes]]
- [[Biblioteca comunitaria de modelos de formularios]]
- [[Correcao load infinito no cadastro completo de paciente]]

### Engenharia

- [[Ambiente e operacao]]
- [[Ambiente Mobile e Scrcpy]]
- [[Deploy - Cloudflare Pages]]
- [[Distribuicao e App Stores PWA]]
- [[Empacotamento PWA Mobile e Desktop Cross-Platform]]
- [[Backup do Supabase antes de deploy]]
- [[TDD e checks]]
- [[Inventario de inputs]]
- [[Feature Flags - Guia]]
- [[Prevencao de TDZ e ordem de hooks no React]]
- [[Otimizacao de Carregamento e Feedback Humanizado de Rede]]
- [[Site Institucional Astro]]
- [[Plano de Otimizacao de Performance e Loads]]
- [[Arquitetura Client-First e Otimizacao de Performance da Homepage]]
- [[Persistencia Local em IndexedDB e UX Client-First no Prontuario e Formularios]]
- [[Agregacoes de Analytics e Performance do Dashboard]]
- [[Modularizacao do Construtor de Formularios]]

### Seguranca

- [[Plano de seguranca - hub]]
- [[Checklist rapido de auditoria]]
- [[Subplano Supabase Postgres RLS e RPCs]]
- [[Subplano autorizacao RBAC clinicas e colaboradores]]
- [[Subplano formularios publicos e compartilhamentos]]

### Release e Lançamento Oficial

- [[Deploy prod Supabase - 2026-08-30 novidades alfa-26.08.30-01]]
- [[Deploy prod Supabase - 2026-08-26 novidades alfa-26.08.26-01]]
- [[00_MASTER_PLANO_DE_LANCAMENTO_4_DIAS]]
- [[01_Thread_Asaas_Producao_e_Checkout]]
- [[02_Thread_Backoffice_Assinaturas_e_Cupons]]
- [[03_Thread_Alfa_Testers_Comunicacao_e_Cupom]]
- [[04_Thread_Migracao_Dominio_Infra_e_Seguranca]]
- [[05_Thread_Backblaze_B2_Uploads_e_Documentos]]
- [[06_Thread_Tutoriais_QA_e_Mobile_First]]
- [[07_Thread_Landing_Page_Astro_e_Deploy]]
- [[08_Thread_Identidade_Visual_Logos_e_Instagram]]

### Prompts e execucao orientada

- [[Prompt - Homepage filtro e ordenacao de pacientes]]
- [[Prompt - Execucao Telemetria Auditoria e Protecao Anti-Print]]
- [[Matriz de contexto do Codex]]

## Convencao sugerida para novas notas

- Use uma nota-hub curta quando um tema comecar a crescer demais.
- Prefira [[wikilinks]] entre notas da vault em vez de links absolutos para arquivos.
- Mantenha cada nota com um foco unico: overview, especificacao, operacao, referencia ou prompt.
- Adicione uma secao pequena de "Notas relacionadas" no final quando a conexao nao for obvia.
