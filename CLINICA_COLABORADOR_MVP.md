# Clinica, Colaborador e RBAC Simples no MVP

## Objetivo

Definir a estrutura inicial de conta, clinica, colaborador e acessos para o MVP, considerando:

- dados operacionais compartilhados por clinica;
- multiplos colaboradores na mesma clinica;
- diferenca entre plano solo e plano para clinicas com equipe;
- uma hierarquia simples de acessos;
- base suficiente para implementar RBAC sem transformar o MVP em um sistema complexo demais.

Este documento deve servir como referencia de produto, dados e regras de acesso antes da implementacao.

## Principio base

- A clinica e a unidade organizacional dona dos dados.
- O colaborador e a identidade pessoal de quem acessa e opera o sistema.
- Pacientes, agenda, atendimentos, formularios e configuracoes operacionais pertencem a clinica.
- O sistema registra autoria e profissional responsavel.
- O poder maximo da conta pertence ao comprador da assinatura.
- Tipo de plano, papel da conta e papel operacional sao coisas diferentes e devem permanecer separados.

## Camadas de decisao

### 1. Plano contratado

O plano define o que a conta pode contratar e quantos usuarios pode operar.

Planos previstos:

- `solo`
- `clinic`

Regras:

- `solo`: atende profissionais que trabalham sozinhos.
- `solo`: nao pode criar subcontas.
- `clinic`: permite conta principal e subcontas.
- `clinic`: permite hierarquia simples de acessos entre colaboradores.

### 2. Papel de conta

O papel de conta define quem controla a assinatura e a estrutura principal da clinica.

Papel previsto:

- `account_owner`

Regras:

- e sempre a conta compradora;
- tem poder maximo sobre a conta;
- em `solo`, e o unico usuario da conta;
- em `clinic`, fica no topo da hierarquia;
- pode acumular tambem um papel operacional dentro da clinica.

### 3. Papel operacional

O papel operacional define o que cada usuario faz dentro da rotina da clinica.

Papeis previstos para o MVP:

- `owner`
- `admin`
- `professional`
- `assistant`

Regra:

- `owner` e o topo operacional e, no MVP, normalmente sera o mesmo usuario que tambem e `account_owner`.

## Diferenca entre conta e operacao

Esta distincao precisa ficar explicita:

- plano define limite comercial do produto;
- papel de conta define quem manda na assinatura e na estrutura principal;
- papel operacional define o que cada pessoa faz no sistema no dia a dia.

Exemplo:

- uma conta pode ser `clinic`;
- o comprador e o `account_owner`;
- esse mesmo usuario pode operar como `owner`;
- uma recepcionista pode ser `assistant`;
- um fisioterapeuta pode ser `professional`.

## O que pertence a clinica

Dados compartilhados dentro da mesma clinica:

- nome fantasia e razao social;
- CNPJ;
- endereco;
- telefone e e-mail institucional;
- logo e identidade visual;
- horario de funcionamento;
- configuracoes gerais da agenda;
- configuracoes compartilhadas de atendimento;
- modelos de documentos e formularios;
- pacientes;
- grupos de atendimento;
- atendimentos e prontuarios;
- eventos da agenda;
- politicas operacionais da clinica;
- tesouraria e financeiro interno da clinica;
- configuracoes da assinatura vinculadas a clinica.

## O que pertence ao colaborador

Dados pessoais e profissionais do usuario:

- nome completo;
- nome social;
- e-mail de acesso;
- telefone;
- data de nascimento;
- cargo;
- especialidade principal;
- outras especialidades;
- numero de registro profissional, quando aplicavel;
- mini bio ou apresentacao;
- foto ou avatar;
- preferencias pessoais leves.

## Estrutura recomendada para o MVP

### clinics

Tabela institucional que representa a clinica.

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
- `subscription_plan`
- `account_owner_user_id`
- `created_at`
- `updated_at`

Observacoes:

- `subscription_plan` deve aceitar pelo menos `solo` e `clinic`;
- `account_owner_user_id` identifica o comprador com poder maximo.

### profiles

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

### clinic_memberships

Tabela de vinculo entre usuario e clinica.

Mesmo no MVP, esta tabela deve existir desde o inicio. Ela e a base de acesso, hierarquia e historico.

Campos minimos sugeridos:

- `id`
- `clinic_id`
- `user_id`
- `account_role`
- `operational_role`
- `membership_status`
- `is_active`
- `joined_at`
- `ended_at`
- `invited_by`
- `created_at`
- `updated_at`

Observacoes:

- `account_role` no MVP pode ser `account_owner` ou `null`;
- `operational_role` pode ser `owner`, `admin`, `professional` ou `assistant`;
- `membership_status` pode ser `invited`, `active`, `inactive` ou `suspended`;
- em plano `solo`, a clinica deve ter apenas um membership ativo.

## Regras de membership

- Toda pessoa que acessa uma clinica precisa ter um membership.
- O membership determina se a pessoa pode entrar naquela clinica.
- O membership tambem guarda hierarquia operacional.
- Colaborador inativo nao deve desaparecer do historico.
- Encerrar um membership nao remove registros clinicos antigos.
- Em `solo`, nao existe criacao de subcontas.
- Em `clinic`, subcontas sao permitidas.

## Regra operacional do MVP

- Todos os dados operacionais pertencem a clinica.
- Toda tabela operacional importante deve guardar `clinic_id`.
- Toda acao relevante deve guardar `created_by`.
- Quando fizer sentido, registros clinicos devem guardar tambem `provider_id` ou `attended_by`.
- O desligamento de um colaborador nao remove dados da clinica.
- A saida de um colaborador nao apaga historico de autoria.

## Atendimentos

No atendimento, separar posse, autoria e responsabilidade profissional.

Campos sugeridos:

- `clinic_id`: a qual clinica o atendimento pertence
- `created_by`: quem criou o registro no sistema
- `provider_id` ou `attended_by`: quem realizou o atendimento

Regra sugerida para o MVP:

- ao criar um atendimento, preencher `provider_id` com o usuario logado por padrao;
- permitir ajustar esse campo para outro colaborador da mesma clinica quando necessario;
- atendimento continua pertencendo a clinica, nunca ao colaborador;
- atendimento com status diferente de `rascunho` e imutavel.

## Capacidades do sistema

Para evitar um RBAC confuso por tela, o MVP deve se orientar por capacidades.

Capacidades principais:

- `clinic_profile.manage`
- `forms.manage`
- `subaccounts.manage`
- `subaccounts_roles.manage`
- `subscription_billing.manage`
- `treasury.manage`
- `agenda.delete_events`
- `subaccounts_analytics.read`
- `patients.read`
- `patients.write`
- `schedule.read`
- `schedule.write`
- `sessions.read`
- `sessions.write`
- `session.delete_draft`

## Matriz simples de acesso do MVP

### account_owner / owner

Pode tudo:

- acessar e editar perfil da clinica;
- acessar `Gerenciar formularios`;
- criar, editar, inativar e revisar subcontas;
- editar acessos das subcontas;
- visualizar e gerenciar assinatura;
- visualizar e gerenciar tesouraria e todas as financas da clinica;
- remover eventos da agenda;
- visualizar desempenho e atividades das subcontas;
- acessar pacientes, agenda e atendimentos.

### admin

Pode quase toda a operacao da clinica, mas sem ser o dono da assinatura por padrao.

Pode:

- editar perfil da clinica, se essa permissao estiver liberada no MVP;
- acessar `Gerenciar formularios`;
- gerenciar subcontas, se a regra do produto permitir;
- visualizar dados operacionais da clinica;
- remover eventos da agenda;
- acessar pacientes, agenda e atendimentos;
- visualizar desempenho da equipe.

Nao deve ter por padrao:

- controle total da assinatura, salvo decisao futura;
- transferencia de propriedade da conta.

### professional

Perfil clinico.

Pode:

- acessar pacientes;
- criar e editar atendimentos;
- usar agenda;
- ler os dados clinicos da clinica;
- atuar como profissional responsavel em atendimentos.

Nao deve ter por padrao:

- editar perfil institucional da clinica;
- gerenciar subcontas;
- editar acessos;
- gerenciar assinatura;
- gerenciar tesouraria global;
- acompanhar desempenho de toda a equipe.

### assistant

Perfil administrativo leve.

Pode:

- acessar agenda;
- cadastrar e atualizar pacientes;
- operar fluxos administrativos;
- apoiar compartilhamentos e organizacao.

Nao deve ter por padrao:

- editar prontuario clinico sensivel;
- alterar acessos de subcontas;
- gerenciar assinatura;
- gerenciar tesouraria completa;
- editar formularios clinicos;
- remover eventos se essa permissao for restrita.

## Regras criticas de acesso

- O comprador da assinatura sempre tem autoridade maxima.
- Somente plano `clinic` pode criar subcontas.
- Apenas usuarios com acesso apropriado podem gerenciar outras contas.
- Apenas usuarios com acesso apropriado podem alterar permissao de subcontas.
- Apenas usuarios com acesso apropriado podem acessar faturamento da assinatura.
- Apenas usuarios com acesso apropriado podem acessar tesouraria e financeiro da clinica.
- Apenas usuarios com acesso apropriado podem remover eventos da agenda.
- Apenas usuarios com acesso apropriado podem visualizar desempenho e atividades das subcontas.
- Atendimento salvo com status diferente de `rascunho` nao pode ser editado.
- Exclusao de atendimento deve continuar limitada a rascunhos, conforme regra atual.

## Fluxo recomendado de onboarding

### Plano solo

1. Usuario cria conta.
2. Usuario compra assinatura `solo`.
3. Sistema cria clinica vinculada a ele.
4. Usuario vira `account_owner` e `owner`.
5. Nao existe fluxo de subconta.

### Plano clinic

1. Usuario cria conta.
2. Usuario compra assinatura `clinic`.
3. Sistema cria clinica vinculada a ele.
4. Usuario vira `account_owner` e `owner`.
5. Usuario pode convidar subcontas.
6. Subconta aceita convite e recebe membership na clinica.
7. Subconta entra como `admin`, `professional` ou `assistant`.

## Decisoes ja consideradas boas para o MVP

- Paciente pertence a clinica, nao ao colaborador.
- Atendimento pertence a clinica, com autor e profissional responsavel.
- O comprador tem poder maximo de conta.
- Plano `solo` nao permite subcontas.
- Plano `clinic` permite subcontas e hierarquia simples.
- Toda entidade operacional relevante deve ter `clinic_id`.
- Toda entidade relevante de criacao manual deve registrar autoria.
- Membership inativo nao remove historico.
- O MVP deve ter RBAC simples por capacidades, nao por dezenas de regras finas.

## O que fica para depois

- RBAC fino por modulo e por acao detalhada;
- permissoes customizaveis por subconta;
- multiplas clinicas por usuario;
- comissao ou financeiro por colaborador;
- agenda individual complexa;
- trilha de auditoria completa de administracao;
- transferencia formal de propriedade da conta;
- assinatura digital e hierarquia formal da equipe.

## Objetivo desta nota

Este arquivo deve ser usado como base de implementacao gradual.

Primeiro ele orienta:

- modelagem de conta e clinica;
- modelagem de memberships;
- definicao de papeis;
- definicao de capacidades;
- regras comerciais entre plano `solo` e plano `clinic`.

Depois ele deve guiar a aplicacao pratica dessas regras na plataforma.
