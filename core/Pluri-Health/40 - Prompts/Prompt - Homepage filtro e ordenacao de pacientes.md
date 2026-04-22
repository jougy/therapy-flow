---
tags:
  - prompt
  - homepage
  - pacientes
kind: prompt
area: produto
aliases:
  - Prompt - Homepage filtro e ordenacao de pacientes
  - Prompt homepage pacientes
  - HOMEPAGE_FILTRO_ORDENACAO_PACIENTES_PROMPT
---
# Prompt de Implementacao: Filtro e Ordenacao de Pacientes na Homepage

## Papel

Voce e uma LLM especializada em programacao trabalhando neste repositorio. Sua tarefa e implementar filtros e ordenacao na homepage de pacientes, com o menor risco possivel de regressao, sem inventar regra de negocio nova sem necessidade e reduzindo o maximo de ambiguidade para futuras manutencoes.

## Objetivo

Adicionar, na homepage, controles proximos da barra de busca de pacientes para:

- filtro
- ordenacao

Esses controles devem atuar sobre a lista de pacientes mostrada na homepage.

O objetivo deste prompt nao e apenas "fazer funcionar". O objetivo e produzir uma implementacao que fique previsivel, testavel, facil de evoluir e com poucas interpretacoes subjetivas.

## Contexto real do repositorio

Arquivos mais relevantes:

- `src/pages/Index.tsx`
- `src/components/PatientCard.tsx`
- `src/pages/PacienteDetalhe.tsx`
- `src/lib/patient-groups.ts`
- `src/lib/patient-groups-status.ts`
- `src/integrations/supabase/types.ts`
- `src/pages/Index.test.tsx`

Comportamento atual da homepage em `src/pages/Index.tsx`:

- existe apenas busca textual por nome do paciente
- a busca usa estado local `search`
- a home busca dados de `patients`, `patient_groups` e `sessions`
- a busca atual faz filtro local apenas por nome
- quando ha texto de busca, a tela mostra resultados de pacientes
- quando nao ha texto de busca, a tela mostra dashboard + lista de pacientes recentes

Dados atuais ja disponiveis ou facilmente derivados:

- nome do paciente
- CPF do paciente
- telefone do paciente
- status do paciente
- data de nascimento
- data do ultimo atendimento
- grupos ativos visiveis na homepage
- total de sessoes por paciente

## Principios obrigatorios para esta implementacao

- evitar criar logica importante inline demais em `src/pages/Index.tsx`
- centralizar regras de status e prioridades sempre que possivel
- preferir comportamento explicitamente definido a comportamento "intuitivo" mas nao documentado
- produzir ordenacao estavel e previsivel, com criterio de desempate explicito
- manter o comportamento atual da home quando nenhum filtro estiver ativo e a ordenacao estiver no padrao
- nao ampliar o escopo para funcionalidades paralelas que nao foram pedidas

## Decisoes ja tomadas neste prompt

Trate os pontos abaixo como decisoes do escopo, nao como perguntas abertas:

- `quantidade de secoes` deve ser interpretado como `quantidade de sessoes`
- `filtro por datas` e `dias da semana` devem ser baseados nas sessoes do paciente, nao na data de nascimento
- quando houver busca, filtros ativos ou ordenacao diferente do padrao, a homepage deve entrar em modo de listagem de pacientes
- filtros devem ser combinados com semantica previsivel de `AND` entre blocos e `OR` dentro de uma mesma lista multi-selecao
- a implementacao deve deixar explicita a regra usada para calcular `faltas`

## Status existentes encontrados no codigo

### Status de paciente

Fonte encontrada:

- `src/pages/PacienteDetalhe.tsx`: `ativo`, `pausado`, `inativo`, `alta`
- `src/components/PatientCard.tsx`: `ativo`, `pausado`, `inativo`, `alta`, `pagamento_pendente`

Importante:

- ha inconsistencia entre os arquivos
- nao criar uma nova lista hardcoded em mais um lugar
- antes de finalizar a implementacao, centralizar a fonte de verdade para status de paciente ou, no minimo, reaproveitar uma definicao unica
- se `pagamento_pendente` continuar existindo, ele precisa estar explicitamente contemplado nas regras de filtro, badge e ordenacao
- se `pagamento_pendente` nao for status valido de fato, a implementacao nao deve perpetuar essa divergencia silenciosamente

### Status de grupos do paciente

Encontrados em `src/pages/PacienteDetalhe.tsx` e `src/lib/patient-groups.ts`:

- `em_andamento`
- `pausado`
- `concluido`
- `cancelado`
- `inativo`

### Status de sessoes

Encontrados em `src/pages/SessaoDetalhe.tsx`:

- `rascunho`
- `concluido` na UI aparece como `concluído`
- `cancelado`

## Escopo funcional desejado

Adicionar dois controles ao lado da busca de pacientes:

1. `Filtro`
2. `Ordenar`

Esses controles devem ficar visualmente proximos da barra `Buscar paciente...`, sem remover o botao `Novo Paciente`.

Se a implementacao precisar escolher entre uma UI mais bonita e uma UI mais clara e confiavel, priorizar clareza e previsibilidade.

## Regra de exibicao da homepage

Para preservar o comportamento atual e ainda suportar filtros:

- se `search` estiver vazio, nenhum filtro estiver ativo e a ordenacao estiver no padrao, manter a home atual com dashboard + `Pacientes recentes`
- se houver texto de busca, algum filtro ativo ou ordenacao diferente do padrao, exibir a lista de resultados de pacientes
- a lista exibida deve usar o mesmo pipeline: busca + filtros + ordenacao

Importante:

- o pipeline deve ser unico, previsivel e reutilizavel
- evitar ter um filtro aplicado em um lugar e uma ordenacao aplicada em outro fluxo separado
- idealmente a pagina deve calcular uma unica colecao final chamada algo equivalente a `visiblePatients`

## Requisitos do filtro

O controle `Filtro` pode ser implementado como `Popover`, `Dropdown`, `Sheet` leve ou outro componente simples ja presente no projeto. Priorizar reuso de componentes existentes em `src/components/ui/`.

O filtro deve ter estas secoes:

### 1. Sem filtros

- deve existir uma acao clara chamada `Sem filtros`
- ao acionar, limpar todos os filtros ativos
- isso deve desmarcar todos os checklists e limpar datas selecionadas
- depois de limpar, a listagem volta ao estado sem filtros

### 2. Status de atividade

- deve ser um checklist multi-selecao
- mostrar todos os status de paciente realmente suportados pela fonte de verdade do projeto
- ao selecionar um ou mais status, mostrar apenas pacientes cujo `patient.status` esteja entre os selecionados
- nenhum status selecionado significa "nao restringir por status"
- a ordem visual dos status no filtro deve ser coerente com a prioridade de negocio adotada para ordenacao por status
- se houver labels amigaveis para os status, reutilizar essas labels em vez de redefini-las em outro lugar

### 3. Filtro por datas

Implementar como intervalo de datas:

- data inicial
- data final

Regra recomendada:

- o filtro por datas deve considerar as sessoes do paciente
- um paciente passa no filtro se tiver pelo menos uma sessao dentro do intervalo selecionado
- se o filtro por datas estiver ativo e o paciente nao tiver sessoes, ele nao deve aparecer

Definicao obrigatoria para evitar ambiguidade:

- usar a semantica `qualquer sessao dentro do intervalo`
- nao usar a semantica `ultimo atendimento dentro do intervalo`, a menos que isso esteja explicitamente documentado e alterado depois
- quando apenas `data inicial` estiver preenchida, considerar sessoes a partir dessa data
- quando apenas `data final` estiver preenchida, considerar sessoes ate essa data
- quando ambas estiverem vazias, nao restringir por data

Se quiser manter a implementacao simples e coerente com o estado atual da home:

- carregar `session_date` e `status` das sessoes
- derivar tudo localmente no frontend

### 4. Dias da semana

Deve ser um checklist com:

- segunda-feira
- terca-feira
- quarta-feira
- quinta-feira
- sexta-feira
- sabado
- domingo

Regra recomendada:

- o filtro deve considerar as sessoes do paciente
- um paciente passa no filtro se tiver pelo menos uma sessao em algum dos dias da semana selecionados
- nenhum dia selecionado significa "nao restringir por dia da semana"
- o calculo do dia da semana deve usar a mesma normalizacao de data escolhida para o restante da tela

## Regras de combinacao dos filtros

Usar estas regras:

- busca textual combina com filtros via `AND`
- secoes diferentes de filtro combinam via `AND`
- multiplos status selecionados combinam via `OR`
- multiplos dias da semana selecionados combinam via `OR`

Exemplo:

- busca por `maria`
- status `ativo` ou `pausado`
- dia da semana `segunda-feira`

Resultado esperado:

- retornar apenas pacientes cujo nome combine com `maria`
- e cujo status seja `ativo` ou `pausado`
- e que tenham ao menos uma sessao em uma segunda-feira

## Requisitos de ordenacao

Adicionar um controle `Ordenar` proximo da busca. Pode ser um `Select`.

Opcoes esperadas:

- `Padrao atual`
- `Nome`
- `Data de nascimento`
- `Atendimento mais recente`
- `Atendimento mais antigo`
- `Quantidade de sessoes`
- `Quantidade de faltas`
- `Status de atividade`

### Regras recomendadas para cada ordenacao

`Padrao atual`

- manter comportamento atual da homepage, hoje baseado em `patients.updated_at desc`
- se houver empate, desempatar por nome ascendente para evitar oscilacao visual

`Nome`

- ordenar por `patient.name` ascendente, ignorando diferencas simples de caixa quando possivel
- em caso de empate, desempatar por `updated_at desc` ou outro criterio estavel e documentado

`Data de nascimento`

- ordenar por `date_of_birth`
- pacientes sem data de nascimento devem ir para o fim
- em caso de empate, desempatar por nome

`Atendimento mais recente`

- ordenar por `lastSessionDate desc`
- pacientes sem atendimento vao para o fim
- em caso de empate, desempatar por nome

`Atendimento mais antigo`

- ordenar por `lastSessionDate asc`
- pacientes sem atendimento vao para o fim
- em caso de empate, desempatar por nome

`Quantidade de sessoes`

- ordenar do maior para o menor numero de sessoes
- em caso de empate, desempatar por nome

`Quantidade de faltas`

- primeiro verificar se ja existe no projeto uma definicao explicita de `falta`
- se nao existir nenhum campo ou regra dedicada, usar temporariamente a seguinte assuncao para conseguir entregar a funcionalidade:
- `faltas = quantidade de sessoes com status cancelado`
- documentar essa assuncao no codigo ou no comentario do helper para facilitar revisao futura
- tratar isso como regra tecnica temporaria e explicitamente nomeada, nao como verdade de negocio definitiva
- em caso de empate, desempatar por nome

`Status de atividade`

- usar uma ordem de prioridade centralizada e explicita
- recomendacao inicial: `ativo`, `pausado`, `pagamento_pendente` se existir na fonte de verdade, `inativo`, `alta`
- em caso de empate, desempatar por nome

## Busca textual

A busca textual atual e por nome. Para esta tarefa:

- o minimo obrigatorio e manter busca por nome
- se for simples aproveitar os dados ja carregados sem aumentar risco, a busca pode tambem considerar CPF e telefone
- se houver ampliacao para CPF e telefone, documentar isso no placeholder, no `aria-label` e nos testes
- nao ampliar a busca para campos demais sem necessidade

## UX obrigatoria ou fortemente recomendada

- mostrar de forma clara quando filtros estao ativos
- fortemente recomendado exibir contador de filtros ativos no gatilho de `Filtro`
- fortemente recomendado exibir um resumo curto dos filtros ativos perto da listagem ou do controle
- se houver resumo visual, ele deve ser legivel e compacto, sem poluir a homepage
- a acao `Sem filtros` deve ser mais facil de descobrir do que limpar campo por campo manualmente

## Assuncoes autorizadas

Para reduzir ambiguidade e permitir implementacao sem travar:

- interpretar `quantidade de secoes` como `quantidade de sessoes`
- interpretar `datas e dias da semana` como filtro baseado nas sessoes do paciente, nao na data de nascimento
- permitir que ordenacao diferente do padrao tambem force a exibicao da lista de pacientes, mesmo sem texto de busca
- adotar `status cancelado de sessao` como proxy tecnico temporario de `falta` se nao houver outra regra ja existente
- manter busca apenas por nome se ampliar para CPF e telefone deixar a implementacao mais fragil do que util

## Recomendacao tecnica importante

Nao concentrar toda a logica diretamente dentro de `src/pages/Index.tsx`.

Preferir extrair a logica para um helper puro, por exemplo:

- `src/lib/home-patients-view.ts`

Esse helper pode:

- receber pacientes brutos
- receber sessoes brutas
- derivar metadados por paciente
- aplicar busca
- aplicar filtros
- aplicar ordenacao
- expor regras puras e testaveis

Isso facilita teste unitario e reduz risco de regressao na tela.

Se fizer sentido, separar em helpers menores:

- derivacao de metadados
- aplicacao de filtros
- aplicacao de ordenacao
- normalizacao de status/prioridade

Mas evitar fragmentacao excessiva se isso piorar legibilidade.

## Metadados recomendados por paciente

Derivar por paciente pelo menos:

- `lastSessionDate`
- `firstSessionDate`
- `sessionCount`
- `missedCount`
- `sessionWeekdays`
- `hasSessionInDateRange`

Opcional se ajudar na clareza:

- `searchableText`
- `statusPriority`

## Cuidado com datas

`sessions.session_date` e `TIMESTAMPTZ`.

Ao comparar dia da semana ou intervalo de datas:

- nao comparar apenas string crua
- normalizar para uma comparacao consistente com a exibicao da aplicacao
- evitar erro de fuso que mude o dia da semana por causa do timezone
- escolher uma estrategia unica para comparacao e reutiliza-la em todo o pipeline
- documentar rapidamente essa estrategia se ela nao for obvia

## UI/UX esperada

- controles proximos da busca e do botao `Novo Paciente`
- layout responsivo
- sem poluir a homepage
- mostrar claramente quando filtros estao ativos
- preferencialmente exibir contador de filtros ativos no botao de filtro
- preferencialmente exibir um resumo curto dos filtros ativos
- manter acessibilidade basica com labels e `aria-label` quando fizer sentido
- manter nomenclatura consistente entre labels da UI, testes e helper interno

## Comportamentos esperados

- `Sem filtros` limpa status, datas e dias da semana
- filtros podem ser usados sem digitar nada na busca
- ordenacao pode ser usada sem digitar nada na busca
- busca, filtros e ordenacao devem funcionar em conjunto
- quando houver filtros ativos, isso deve ficar perceptivel sem o usuario precisar reabrir o popover
- lista vazia deve mostrar estado de nenhum resultado
- lista de resultados deve continuar navegando para `PacienteDetalhe`

## Impacto esperado em consultas

Hoje a home busca:

- `patients`
- `patient_groups`
- `sessions`

Para implementar tudo com os dados necessarios, a consulta de `sessions` da homepage deve incluir pelo menos:

- `id`
- `patient_id`
- `session_date`
- `status`

Para manter opcao de ampliar a busca sem retrabalho grande, a consulta de `patients` ja contem o necessario para nome, CPF e telefone.

Nao criar migracoes nem alterar schema para esta tarefa.

## Testes esperados

Criar ou ajustar testes cobrindo pelo menos:

- limpar filtros com `Sem filtros`
- filtrar por status com multi-selecao
- filtrar por intervalo de datas
- filtrar por dias da semana
- combinacao de filtros com semantica `AND`
- ordenar por nome
- ordenar por ultimo atendimento recente e antigo
- ordenar por quantidade de sessoes
- ordenar por quantidade de faltas com a assuncao adotada
- ordenacao com desempate estavel
- se houver resumo visual ou contador de filtros, cobrir ao menos um caso de exibicao
- manter a remocao local de paciente apagado a partir de `location.state.deletedPatientId`
- manter o comportamento padrao da home sem busca e sem filtros

Se a logica for extraida para helper puro, priorizar testes unitarios nesse helper e deixar `Index.test.tsx` cobrindo apenas integracao essencial da pagina.

## Criterios de aceite

- existe um controle de filtro ao lado da busca de pacientes
- existe um controle de ordenacao ao lado da busca de pacientes
- `Sem filtros` limpa completamente os filtros
- filtro por status usa checklist multi-selecao
- filtro por datas funciona por intervalo
- filtro por dias da semana funciona com checklist
- a home entra em modo de listagem quando houver busca, filtros ativos ou ordenacao fora do padrao
- a ordenacao suporta todas as opcoes pedidas
- a implementacao nao duplica fonte de verdade de status sem necessidade
- a regra de `faltas` usada pela implementacao fica explicita e rastreavel
- os criterios de desempate ficam definidos para evitar oscilacao visual
- o usuario consegue perceber quando ha filtros ativos
- o comportamento atual da home sem filtros e sem busca continua preservado

## Nao fazer

- nao criar migracao de banco
- nao alterar fluxo de cadastro de paciente
- nao alterar regras de grupos do paciente alem do necessario
- nao esconder o botao `Novo Paciente`
- nao quebrar o estado atual da home quando nenhum filtro estiver ativo
- nao introduzir nova ambiguidade sobre status de paciente
- nao tratar uma assuncao tecnica temporaria como se fosse regra oficial de negocio
- nao espalhar labels e prioridades de status em varios arquivos se isso puder ser evitado

## Ordem sugerida de trabalho

1. Ler `src/pages/Index.tsx` e confirmar o fluxo atual.
2. Definir e centralizar a fonte de verdade dos status e suas prioridades.
3. Criar helper puro para derivacao, filtro e ordenacao.
4. Cobrir o helper com testes.
5. Integrar os novos estados e controles em `src/pages/Index.tsx`.
6. Ajustar `src/pages/Index.test.tsx` apenas para o comportamento de tela.
7. Validar manualmente a UX da homepage.

## Observacao final importante

Se durante a implementacao ficar claro que `pagamento_pendente` nao deveria existir como status de paciente na home, nao perpetuar essa inconsistencia silenciosamente. Centralize, normalize ou deixe essa divergencia explicitamente tratada.

Se houver duvida entre "entregar rapido" e "deixar a regra rastreavel", priorizar deixar a regra rastreavel. Este prompt foi escrito para minimizar erro de implementacao por interpretacao solta.

## Notas relacionadas

- [[Mapa da vault]]
- [[Core do projeto]]
- [[Inventario de inputs]]
- [[TDD e checks]]
