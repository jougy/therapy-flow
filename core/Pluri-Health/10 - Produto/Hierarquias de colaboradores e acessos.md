---
tags:
  - produto
  - equipe
  - acessos
  - rbac
kind: spec
area: produto
aliases:
  - Hierarquias de colaboradores e acessos
  - Hierarquias de colaboradores
  - hierarquias_colaboradores_acessos
---
# Editor de Hierarquias em Colaboradores e acessos

## Objetivo

Definir um plano de produto e implementacao para evoluir `Configuracoes > Colaboradores e acessos` de um RBAC simples com papeis fixos para um editor de hierarquias customizaveis por clinica.

O resultado esperado e permitir que cada clinica:

- crie hierarquias proprias;
- edite hierarquias existentes;
- delete hierarquias deletaveis;
- defina os acessos de cada hierarquia ao aplicativo;
- atribua uma hierarquia a cada colaborador;
- respeite uma ordem de poder com niveis verticais e multiplas hierarquias no mesmo nivel horizontal.

## Estado atual

Hoje o projeto opera com uma hierarquia simples baseada em `operational_role`:

- `owner`
- `admin`
- `professional`
- `assistant`
- `estagiario`

Essa estrutura atende o MVP atual, mas tem limitacoes claras:

- os papeis sao fixos no codigo e no banco;
- a clinica nao consegue criar papeis proprios;
- os acessos estao acoplados ao enum atual;
- a nocao de "quem pode gerenciar quem" ainda esta simplificada demais.

Este plano propoe a evolucao desse modelo sem quebrar o fluxo atual de subcontas.

## Escopo do primeiro ciclo

O primeiro ciclo dessa funcionalidade deve entregar:

1. editor de hierarquias dentro de `Configuracoes > Colaboradores e acessos`;
2. hierarquia padrao `owner` criada automaticamente por clinica;
3. `owner` com todos os acessos e comportamento imutavel;
4. criacao de novas hierarquias com nome, nivel e acessos;
5. edicao de hierarquias permitidas;
6. delecao de hierarquias permitidas;
7. atribuicao de hierarquia ao criar e editar colaboradores;
8. validacao de poder vertical e horizontal;
9. auditoria de alteracoes relevantes.

Fica fora deste primeiro ciclo:

- organograma visual complexo com linhas e conectores;
- heranca automatica entre hierarquias por arvore;
- delegacao multi-clinica;
- historico completo versionado de cada hierarquia;
- permissao por registro clinico individual.

## Conceitos centrais

### 1. Hierarquia

Uma hierarquia passa a ser uma entidade da clinica.

Campos minimos:

- nome da hierarquia;
- nivel vertical de poder;
- ordem horizontal dentro do nivel;
- lista de acessos ao aplicativo;
- flags de sistema, imutabilidade e delecao.

### 2. Nivel vertical

O nivel vertical representa poder.

Regra recomendada:

- quanto menor o `tier_level`, maior o poder;
- `owner` fica sempre no topo, em `tier_level = 0`;
- uma hierarquia so pode gerenciar hierarquias com `tier_level` maior que o seu;
- nunca pode gerenciar niveis acima ou no mesmo nivel.

### 3. Nivel horizontal

O nivel horizontal representa coexistencia no mesmo patamar de poder.

Exemplo:

- `Coordenacao clinica` e `Coordenacao administrativa` podem existir lado a lado no mesmo `tier_level`;
- ambas estao no mesmo nivel horizontal;
- nenhuma delas pode editar a outra.

No primeiro ciclo, a ordem horizontal deve ser tratada como organizacao visual e de listagem, nao como desempate de poder.

### 4. Acessos

Cada hierarquia possui uma lista de capacidades liberadas no aplicativo.

No caminho mais seguro para o projeto atual, essas capacidades devem continuar baseadas na lista existente de `AccessCapability`, para evitar duplicar modelos de permissao.

### 5. Escopo de gestao

Ter acesso de gestao nao significa poder irrestrito.

Mesmo que uma hierarquia tenha capacidade de editar equipe, ela so pode:

- criar hierarquias abaixo dela;
- editar hierarquias abaixo dela;
- deletar hierarquias abaixo dela;
- atribuir colaboradores a hierarquias abaixo dela;
- editar colaboradores que estejam em hierarquias abaixo dela.

## Regras invariantes

Estas regras devem ser tratadas como criticas e protegidas no banco e no frontend.

### Regra base do owner

- Toda clinica deve ter exatamente uma hierarquia `owner` de sistema.
- `owner` e a unica hierarquia imutavel.
- `owner` nao pode ser deletada.
- `owner` sempre possui todos os acessos.
- Em relacao a definicao da hierarquia, o `owner` pode no maximo ter o nome alterado.
- Em relacao ao membership do comprador da conta, a vinculacao ao topo deve permanecer protegida.

### Regras de nome

- O nome da hierarquia deve ser obrigatorio.
- O nome deve ser unico por clinica, idealmente com comparacao case-insensitive.

### Regras de poder

- Hierarquias nunca podem editar outras hierarquias no mesmo nivel horizontal.
- Hierarquias nunca podem editar outras hierarquias em nivel vertical superior.
- Hierarquias so podem agir sobre niveis verticais inferiores.
- O usuario atual nunca pode atribuir a outro colaborador uma hierarquia igual ou superior a dele.
- O usuario atual nunca pode criar uma hierarquia no proprio nivel ou acima.

### Regras de acesso

- Uma hierarquia nova so pode receber acessos que o ator atual ja possua.
- Nenhuma hierarquia abaixo pode ganhar acesso de gestao para atuar sobre niveis iguais ou superiores.
- O `owner` sempre ignora essa restricao por ser superusuario da clinica.

### Regras de delecao

- Hierarquia com colaboradores vinculados nao deve ser deletada diretamente.
- Antes de deletar, os colaboradores devem ser reatribuido(s) para outra hierarquia valida.
- Hierarquias de sistema marcadas como nao deletaveis nao podem ser removidas.

### Regras de plano

- O editor so existe no plano `clinic`.
- No plano `solo`, a secao continua oculta ou somente informativa.

## Modelo de dados proposto

## Tabela `clinic_hierarchies`

Nova tabela para guardar as hierarquias da clinica.

Campos sugeridos:

- `id`
- `clinic_id`
- `name`
- `tier_level`
- `horizontal_order`
- `is_system`
- `is_immutable`
- `is_deletable`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

Observacoes:

- `tier_level` define poder vertical;
- `horizontal_order` organiza a exibicao dentro do mesmo nivel;
- `is_system` ajuda a distinguir sementes padrao;
- `is_immutable` protege o `owner`;
- `is_deletable` permite futuros papeis padrao nao deletaveis.

## Tabela `clinic_hierarchy_capabilities`

Tabela relacional para os acessos concedidos a cada hierarquia.

Campos sugeridos:

- `hierarchy_id`
- `capability`
- `created_at`

Vantagens desse formato:

- evita guardar arrays dificeis de validar;
- facilita comparar acessos entre hierarquias;
- simplifica regras de subset no banco.

## Evolucao de `clinic_memberships`

Adicionar o campo:

- `hierarchy_id`

Regras:

- no inicio pode entrar como nullable para permitir backfill;
- depois deve ficar `not null` para plano `clinic`;
- `operational_role` pode permanecer por compatibilidade durante a migracao;
- no medio prazo, `operational_role` vira legado ou derivado.

## Estrategia de compatibilidade

Para reduzir risco, o primeiro rollout deve manter compatibilidade com os papeis atuais.

Seed inicial por clinica:

- `owner`
- `admin`
- `professional`
- `assistant`
- `estagiario`

Backfill inicial:

- membership `owner` atual aponta para a hierarquia `owner`;
- membership `admin` atual aponta para a hierarquia `admin`;
- membership `professional` atual aponta para a hierarquia `professional`;
- membership `assistant` atual aponta para a hierarquia `assistant`;
- membership `estagiario` atual aponta para a hierarquia `estagiario`.

Assim, a clinica nao perde o comportamento atual enquanto a tela nova ainda esta sendo implementada.

## Estrategia de autorizacao

## Reaproveitar o modelo por capacidades

O projeto ja possui `AccessCapability` e `current_user_can`.

A melhor evolucao inicial e:

- manter as capacidades atuais;
- fazer `current_user_can` olhar para os acessos da hierarquia vinculada ao membership;
- manter o override de `account_owner`;
- adicionar validacoes especificas de escopo para alvos abaixo do ator atual.

## Funcoes auxiliares novas

Recomenda-se criar helpers SQL como:

- `get_current_membership_hierarchy(_clinic_id)`
- `can_manage_hierarchy(_target_hierarchy_id, _clinic_id)`
- `can_assign_hierarchy(_target_hierarchy_id, _clinic_id)`
- `can_manage_membership(_target_membership_id, _clinic_id)`

Essas funcoes devem validar ao mesmo tempo:

- se o ator atual tem a capacidade necessaria;
- se o alvo esta em nivel inferior;
- se o alvo nao esta no mesmo tier;
- se o alvo pertence a mesma clinica.

## RPCs a evoluir

As RPCs atuais de equipe devem ser adaptadas para aceitar `hierarchy_id`.

Impacto esperado:

- `create_clinic_subaccount` passa a receber `_hierarchy_id`;
- `update_clinic_subaccount_profile` passa a receber `_hierarchy_id`;
- funcoes de leitura devem retornar a hierarquia vinculada ao membership;
- eventos de seguranca e auditoria devem registrar alteracoes de hierarquia.

## Regras de seguranca no banco

As protecoes importantes nao podem depender so do frontend.

As migrations devem garantir:

- unicidade de nome por clinica;
- existencia de um unico `owner` por clinica;
- bloqueio de delete no `owner`;
- bloqueio de remocao de todos os acessos do `owner`;
- bloqueio de atribuicao de hierarquia igual ou superior ao ator atual;
- bloqueio de criacao de hierarquia acima ou no mesmo nivel do ator atual, salvo `owner`;
- bloqueio de capabilities fora do conjunto do ator atual, salvo `owner`.

## Estrategia de UI

## Local da funcionalidade

A funcionalidade deve nascer dentro de `Configuracoes > Colaboradores e acessos`, porque conversa diretamente com:

- criacao de subcontas;
- edicao de status;
- atribuicao de acessos;
- organizacao administrativa da equipe.

## Estrutura sugerida da tela

Dentro da secao `team`, dividir em dois blocos ou abas:

1. `Colaboradores`
2. `Hierarquias`

### Bloco `Hierarquias`

Deve conter:

- resumo curto das regras de poder;
- grade/lista agrupada por `tier_level`;
- cards de hierarquias com nome e acessos principais;
- destaque visual do `owner` como hierarquia travada;
- botao para criar nova hierarquia abaixo do nivel permitido;
- acao de editar e deletar apenas quando permitido.

### Formulario de hierarquia

Campos do criador/editor:

- nome;
- nivel vertical;
- ordem horizontal;
- lista de acessos;
- resumo do escopo que essa hierarquia podera gerenciar.

Mensagens importantes:

- explicar que hierarquias no mesmo nivel nao se editam;
- explicar que niveis acima nao podem ser tocados;
- explicar quando um acesso foi bloqueado por falta de poder do ator atual.

### Bloco `Colaboradores`

Mudancas previstas:

- ao criar colaborador, selecionar `hierarchy_id` em vez de depender apenas de `operational_role`;
- ao editar colaborador, permitir trocar a hierarquia dentro do escopo permitido;
- mostrar a hierarquia atual no card/lista do colaborador;
- manter filtros e ordenacao por hierarquia.

## Comportamento visual sugerido

Para o primeiro ciclo, a UI nao precisa virar um organograma grafico.

O formato mais seguro e:

- secoes por nivel vertical;
- cards em linha dentro de cada nivel;
- ordenacao horizontal estavel;
- badges de acesso principais;
- labels claras para `imutavel`, `sistema` e `nao deletavel`.

## Experiencia do owner

O `owner` precisa conseguir:

- renomear a propria hierarquia de topo;
- criar novos niveis abaixo;
- redistribuir acessos;
- reatribuir colaboradores;
- manter sempre o controle total da clinica.

Mas o `owner` nao deve conseguir se autodesconfigurar de forma perigosa, como:

- remover todos os acessos do topo;
- deletar a propria hierarquia;
- deixar a clinica sem uma hierarquia superior valida.

## Experiencia das hierarquias gestoras

Uma hierarquia com acesso de gestao deve ver apenas o que ela pode governar.

Exemplos:

- pode editar colaborador abaixo dela;
- pode mover colaborador para uma hierarquia abaixo dela;
- pode criar uma nova hierarquia abaixo dela;
- nao pode promover alguem para seu proprio nivel;
- nao pode editar nem deletar pares do mesmo tier.

## Migracao tecnica recomendada

### Fase 1 - Estrutura e compatibilidade

- criar tabelas novas;
- adicionar `hierarchy_id` em `clinic_memberships`;
- semear hierarquias padrao por clinica;
- fazer backfill a partir de `operational_role`;
- atualizar tipos do Supabase.

### Fase 2 - Autorizacao real

- atualizar `current_user_can`;
- criar helpers de escopo por nivel;
- adaptar RPCs de criar e editar subconta;
- registrar eventos de auditoria.

### Fase 3 - UI de leitura

- exibir hierarquia atual dos colaboradores;
- mostrar niveis e cards em modo leitura;
- validar sorting e filtros novos.

### Fase 4 - UI de gestao completa

- criar hierarquia;
- editar hierarquia;
- deletar hierarquia;
- atribuir hierarquia ao colaborador.

### Fase 5 - Limpeza de legado

- reduzir dependencia do `operational_role`;
- manter somente o que ainda for necessario para compatibilidade;
- revisar naming de labels antigas na UI e nos testes.

## Testes necessarios

## Banco e regras

- nao permite deletar `owner`;
- nao permite remover acessos do `owner`;
- nao permite criar hierarquia no mesmo tier do ator atual;
- nao permite editar hierarquia acima;
- nao permite editar hierarquia no mesmo tier;
- nao permite atribuir colaborador para nivel igual ou superior;
- nao permite deletar hierarquia com memberships vinculados.

## Frontend

- renderiza `owner` como travado;
- bloqueia botoes quando o usuario nao tem escopo;
- lista hierarquias por `tier_level` e `horizontal_order`;
- atualiza o formulario de colaborador com a hierarquia correta;
- mostra mensagens de erro compreensiveis.

## Regras de ordenacao

- `owner` sempre primeiro;
- depois, tiers em ordem crescente de poder numerico;
- dentro do tier, `horizontal_order`;
- depois, nome ou data de criacao como desempate.

## Riscos e pontos de atencao

- migrar cedo demais para hierarquia customizada sem fallback pode quebrar a gestao atual de subcontas;
- tentar representar organograma completo no primeiro ciclo pode inflar demais a UI;
- manter `operational_role` e `hierarchy_id` por muito tempo pode gerar duplicidade de regra;
- sem validacao forte no banco, a UI pode permitir estados inconsistentes.

## Decisoes recomendadas para fechar antes da implementacao

1. `horizontal_order` sera apenas visual neste primeiro ciclo.
2. O editor nascera dentro da secao atual `team`, em um bloco/aba separado.
3. O projeto mantera as capacidades atuais e migrara a fonte delas para as hierarquias.
4. A delecao de hierarquia exigira reatribuicao previa dos colaboradores.
5. O `owner` sera uma hierarquia de sistema unica, nao deletavel e com acesso total permanente.

## Ordem recomendada de execucao

1. aprovar este plano;
2. desenhar a migration de dados e compatibilidade;
3. implementar helpers SQL de escopo por nivel;
4. adaptar RPCs e tipos do frontend;
5. exibir hierarquias em modo leitura;
6. liberar criacao e edicao de hierarquias;
7. liberar atribuicao de hierarquia em colaboradores;
8. revisar testes e limpar legado.

## Resumo da direcao

A melhor forma de entregar essa funcionalidade sem perder estabilidade e evoluir do modelo atual de papeis fixos para hierarquias customizadas por clinica, mantendo:

- `owner` como topo absoluto e protegido;
- acessos baseados em capacidades;
- gestao apenas de niveis inferiores;
- multiplas hierarquias no mesmo tier sem poder entre si;
- migracao progressiva, sem quebra brusca do fluxo atual de colaboradores e acessos.

## Notas relacionadas

- [[Core do projeto]]
- [[Clinica e colaborador no MVP]]
- [[Configuracoes - Seguranca]]
- [[Configuracoes - Desenvolvimento da equipe]]
