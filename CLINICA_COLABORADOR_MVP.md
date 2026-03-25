# Clinica e Colaborador no MVP

## Objetivo

Registrar a estrategia inicial de modelagem para suportar multiplos colaboradores por clinica, mantendo os dados operacionais compartilhados dentro da mesma clinica e sem introduzir RBAC nesta primeira versao.

## Principio base

- A clinica e a unidade organizacional dona dos dados.
- O colaborador e a identidade pessoal de quem acessa e opera o sistema.
- Pacientes, agenda, atendimentos e configuracoes pertencem a clinica.
- O sistema registra autoria e profissional responsavel, mas todos os colaboradores ativos da mesma clinica enxergam os mesmos dados no MVP.

## O que pertence a clinica

- Nome fantasia e razao social
- CNPJ
- Endereco
- Telefone e e-mail institucional
- Logo e identidade visual
- Horario de funcionamento
- Configuracoes gerais da agenda
- Configuracoes compartilhadas de atendimento
- Pacientes
- Grupos de atendimento
- Atendimentos e prontuarios
- Eventos da agenda
- Modelos de documentos e formularios
- Politicas operacionais da clinica

## O que pertence ao colaborador

- Nome completo
- Nome social
- E-mail de acesso
- Telefone
- Data de nascimento
- Cargo
- Especialidade principal
- Outras especialidades
- Numero de registro profissional, se fizer sentido
- Mini bio ou apresentacao
- Status do vinculo: ativo, inativo, afastado
- Data de entrada
- Foto ou avatar
- Preferencias pessoais leves

## Estrutura recomendada para o MVP

### clinics

Tabela institucional que representa a clinica e concentra os dados compartilhados.

Campos minimos sugeridos:

- `id`
- `name`
- `legal_name`
- `cnpj`
- `email`
- `phone`
- `logo_url`
- `address`
- `theme`
- `business_hours`
- `created_at`
- `updated_at`

### users ou profiles

Tabela com os dados pessoais do colaborador.

Campos minimos sugeridos:

- `id`
- `full_name`
- `social_name`
- `email`
- `phone`
- `birth_date`
- `job_title`
- `specialty`
- `specialties`
- `professional_license`
- `bio`
- `avatar_url`
- `created_at`
- `updated_at`

### clinic_collaborators

Tabela de vinculo entre colaborador e clinica. Mesmo sem RBAC agora, esta tabela deve existir desde o MVP.

Campos minimos sugeridos:

- `id`
- `clinic_id`
- `user_id`
- `role_label`
- `is_active`
- `joined_at`
- `ended_at`
- `created_at`
- `updated_at`

## Regra operacional do MVP

- Todos os colaboradores ativos da mesma clinica podem acessar os mesmos dados da clinica.
- Toda tabela operacional importante deve guardar `clinic_id`.
- Toda acao importante deve guardar `user_id` para autoria.
- Colaboradores inativos nao devem desaparecer do historico.
- O desligamento de um colaborador nao remove dados clinicos da clinica.

## Atendimentos

No atendimento, separar autoria de responsabilidade profissional.

Campos sugeridos:

- `clinic_id`: a quem o atendimento pertence
- `created_by`: quem criou o registro no sistema
- `provider_id` ou `attended_by`: quem realizou o atendimento

Regra sugerida para o MVP:

- Ao criar um atendimento, preencher `provider_id` com o usuario logado por padrao.
- Permitir ajustar esse campo para outro colaborador da mesma clinica quando necessario.
- Todos os colaboradores da clinica continuam tendo visibilidade sobre o registro.

## Decisoes ja consideradas boas para o MVP

- Paciente pertence a clinica, nao ao colaborador.
- Atendimento pertence a clinica, com autor e profissional responsavel.
- A saida de um colaborador nao remove o historico.
- Toda entidade operacional relevante deve ter `clinic_id`.
- Toda entidade relevante de criacao manual deve registrar autoria.

## O que pode ficar para depois

- RBAC completo
- Permissoes finas por modulo
- Multiplas clinicas por usuario, se ainda nao houver demanda real
- Comissao ou financeiro por colaborador
- Agenda individual complexa
- Assinatura digital e hierarquia formal da equipe

## Objetivo desta nota

Este arquivo serve como referencia de produto e dados para retomarmos essa frente em partes, sem bloquear as demais entregas do MVP.
