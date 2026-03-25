# TDD e Checks do Projeto

## Objetivo

Este arquivo define a estrategia de TDD do projeto e funciona como um documento vivo para registrar novas checagens, riscos recorrentes e protecoes contra regressao.

Ele complementa o fluxo operacional descrito em `AGENTS.md` e serve como referencia de produto e engenharia para manter o MVP evoluindo com seguranca.

## Principios

- Toda mudanca relevante deve tentar nascer com um teste ou com uma checagem objetiva.
- O teste deve cobrir o comportamento esperado, nao apenas a implementacao atual.
- Sempre que um bug aparecer, devemos tentar transformar o caso em teste para evitar reincidencia.
- O escopo da validacao deve comecar pequeno e crescer ate o nivel necessario.
- Nem toda protecao precisa ser um teste automatizado tradicional; algumas podem ser checks estruturais, validacoes de build, regras de banco ou smoke checks.

## Objetivo pratico do TDD aqui

Queremos reduzir principalmente estes riscos:

- regressao silenciosa em fluxos ja implementados
- regras de negocio que quebram ao ajustar UI
- divergencia entre frontend e banco
- erros em migrations e defaults de dados
- comportamentos locais que funcionam de forma diferente em producao
- correcoes de bug que nao ficam protegidas para o futuro

## Camadas de validacao

### 1. Testes de regra de negocio

Devem ser prioridade sempre que a regra puder ser isolada em helper, formatter, builder ou filtro.

Exemplos:

- visibilidade de grupos na homepage
- selecao do grupo padrao do paciente
- payload de eventos da agenda
- regras de status
- normalizacao de dados antes de salvar

Objetivo:

- testar decisao e comportamento
- evitar depender de renderizacao completa quando nao for necessario

### 2. Testes de fluxo de interface

Usar quando a regra depende da interacao do usuario e nao pode ser validada apenas por helper.

Exemplos futuros:

- criar evento na agenda com tipo `atendimento`
- alternar entre busca de paciente e texto livre
- impedir edicao do grupo padrao
- exibicao condicional de blocos na homepage

Objetivo:

- garantir que a tela reaja corretamente
- reduzir regressao em formularios e condicoes de exibicao

### 3. Validacoes de integracao com banco

Usar para regras que dependem do Supabase, migrations, triggers, defaults, constraints e relacoes.

Exemplos:

- paciente novo deve receber `Grupo sem definicao`
- grupo padrao nao pode ser excluido
- atendimento deve gravar `clinic_id` e autoria
- status nulo permitido apenas no grupo padrao, se essa regra for adotada depois

Objetivo:

- proteger regras que precisam existir no banco, nao so no frontend

### 4. Checks de operacao

Sao verificacoes de ambiente e de saude do projeto.

Exemplos:

- `npm run test`
- `npm run build`
- `npm run lint`
- `npm run supabase:status`
- smoke check do frontend local

Objetivo:

- pegar quebras gerais
- evitar merge de mudanca que compila localmente de forma incompleta

## Fluxo recomendado por mudanca

Para qualquer ajuste relevante:

1. entender a regra ou o bug
2. identificar o menor nivel testavel
3. registrar a expectativa em teste ou check
4. rodar o teste pequeno primeiro
5. implementar a mudanca minima
6. reexecutar o teste pequeno
7. rodar validacoes mais amplas
8. registrar novas checagens quando surgir um risco recorrente

## O que deve virar teste com alta prioridade

- bugs que ja aconteceram com usuario real
- regras que envolvem defaults
- regras condicionais de visibilidade
- regras que misturam banco e interface
- qualquer comportamento que pareca simples, mas tenha varias excecoes
- fluxos que afetam agenda, pacientes, sessoes, auth e configuracoes

## O que pode ser validado de outra forma

Nem tudo precisa virar um teste grande.

Opcoes validas:

- helper com teste unitario
- migration com validacao manual documentada
- comando de smoke check
- checklist de revisao
- validacao de tipos
- constraint ou trigger no banco

## Politica para bugs encontrados

Quando um bug aparecer:

1. descrever o comportamento esperado
2. identificar onde a regra deveria estar protegida
3. criar ou atualizar teste antes da correcao, quando viavel
4. registrar a nova protecao neste arquivo se ela for util para o futuro

## Backlog vivo de checks

Esta secao deve crescer com o projeto.

### Checks ja importantes

- Regra: somente grupos `em_andamento` aparecem na homepage
- Regra: grupo padrao do paciente deve existir
- Regra: ultimo grupo usado deve ser priorizado em novo atendimento
- Regra: agenda deve distinguir `atendimento`, `reuniao` e `evento`
- Regra: login de teste local nao deve aparecer quando o ambiente estiver apontando para backend remoto
- Regra: `.env.local` precisa ser gerado de forma compativel com Supabase CLI

### Checks que valem entrar em breve

- Agenda: impedir conflito de horario quando essa regra existir
- Agenda: garantir gravacao correta de timezone e horario
- Pacientes: impedir criacao incompleta quando campos obrigatorios forem definidos
- Grupos: impedir edicao estrutural do grupo padrao
- Sessoes: garantir que o profissional responsavel fique salvo
- Clinica e colaborador: garantir vinculacao correta entre usuario e clinica
- Auth: garantir comportamento correto para contas sem confirmacao de e-mail
- Supabase local: smoke check de start, stop e reset em ambiente de desenvolvimento

## Perguntas que devem orientar novas checagens

Sempre que surgir uma mudanca, vale perguntar:

- isso ja quebrou antes?
- se quebrar de novo, o impacto e alto?
- existe mais de um caminho para o mesmo fluxo?
- essa regra depende de UI, banco e estado ao mesmo tempo?
- esse comportamento e central para o MVP?

Se a resposta tender para sim, provavelmente falta uma protecao automatizada.

## Resultado esperado

Ao longo do tempo, este arquivo deve virar:

- um mapa das protecoes mais importantes do projeto
- um backlog de regressao
- uma referencia para decidir rapidamente o que precisa de teste
- uma base para amadurecer a qualidade do produto sem travar a velocidade do MVP
